import React, { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { storage } from "./storage";
import { apiJson } from "./api";
import { t } from "./i18n";
import type { NotificationPreferences, NotificationType, User } from "./types";

const defaults: NotificationPreferences = { estado_linea_favorita: false, solicitud: false };
const key = "voybus-notifications";
export type InAppNotification = { title: string; body: string };
let notice: InAppNotification | null = null;
const listeners = new Set<() => void>();
function publish(value: InAppNotification | null) { notice = value; listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useInAppNotice() {
  const notification = useSyncExternalStore(subscribe, () => notice, () => null);
  return { notification, dismiss: () => publish(null) };
}
let configured = false;
async function nativeNotifications() {
  const notifications = await import("expo-notifications");
  if (!configured) {
    notifications.setNotificationHandler({ handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }) });
    configured = true;
  }
  return notifications;
}
export async function notify(title: string, body: string): Promise<void> {
  if (Platform.OS === "web") { publish({ title, body }); return; }
  const notifications = await nativeNotifications();
  const permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL) return;
  await notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}
type NotificationValue = {
  preferences: NotificationPreferences; loading: boolean; error: string;
  setPreference: (type: NotificationType, enabled: boolean) => Promise<boolean>;
};
const NotificationContext = createContext<NotificationValue>({ preferences: defaults, loading: true, error: "", setPreference: async () => false });
export function NotificationProvider({ children, user = null }: { children: React.ReactNode; user?: User | null }) {
  const [preferences, setPreferences] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const current = useRef(preferences);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void storage.get(key).then((raw) => {
      const saved: unknown = raw ? JSON.parse(raw) : defaults;
      if (!saved || typeof saved !== "object") throw new Error("Invalid notification preferences");
      const source = user?.notificaciones ?? saved as Partial<NotificationPreferences>;
      if (mounted) {
        const next = { estado_linea_favorita: source.estado_linea_favorita === true, solicitud: source.solicitud === true };
        current.current = next; setPreferences(next);
      }
    }).catch(() => { if (mounted) setError(t("common.storageError")); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [user?.id]);
  function setPreference(type: NotificationType, enabled: boolean): Promise<boolean> {
    if (loading) return Promise.resolve(false);
    const operation = queue.current.then(async () => {
      setError("");
      try {
        if (enabled && !Object.values(current.current).some(Boolean) && Platform.OS !== "web") {
          const notifications = await nativeNotifications();
          if (Platform.OS === "android") await notifications.setNotificationChannelAsync("default", {
            name: "VoyBus", importance: notifications.AndroidImportance.DEFAULT,
          });
          let permission = await notifications.getPermissionsAsync();
          if (!permission.granted && permission.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL && permission.canAskAgain) {
            permission = await notifications.requestPermissionsAsync();
          }
          if (!permission.granted && permission.ios?.status !== notifications.IosAuthorizationStatus.PROVISIONAL) {
            setError(t("common.permissionDenied")); return false;
          }
        }
        const next = { ...current.current, [type]: enabled };
        await storage.set(key, JSON.stringify(next));
        current.current = next; setPreferences(next);
        if (user) await apiJson("/auth/me/preferencias", "PATCH", { notificaciones: { [type]: enabled } });
        return true;
      } catch (reason) { setError(t("common.storageError")); throw reason; }
    });
    queue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }
  return React.createElement(NotificationContext.Provider, { value: { preferences, loading, error, setPreference } }, children);
}
export function useNotificationPreferences() { return useContext(NotificationContext); }
