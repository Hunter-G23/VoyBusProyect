import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { api } from "./api";
export function useResource<T>(path: string | null, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const reload = useCallback(async () => {
    if (!path || busy.current) return;
    busy.current = true;
    const current = version.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (current === version.current) {
        setData(result);
        setError("");
        setUpdated(new Date());
      }
    } catch (e) {
      if (current === version.current) setError((e as Error).message);
    } finally {
      if (current === version.current) {
        setLoading(false);
        busy.current = false;
      }
    }
  }, [path]);
  useEffect(() => {
    version.current++;
    busy.current = false;
    setData(null);
    setError("");
    setUpdated(null);
    setLoading(false);
    void reload();
    return () => {
      version.current++;
      busy.current = false;
    };
  }, [reload]);
  useEffect(() => {
    if (!poll || !path) return;
    const visible = () =>
      AppState.currentState === "active" &&
      (Platform.OS !== "web" || document.visibilityState === "visible");
    const tick = () => {
      if (visible()) void reload();
    };
    const timer = setInterval(tick, 5000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    if (Platform.OS === "web")
      document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      sub.remove();
      if (Platform.OS === "web")
        document.removeEventListener("visibilitychange", tick);
    };
  }, [poll, path, reload]);
  return { data, error, loading, updated, reload };
}
