import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { api, apiJson } from "./api";
import { localFavorites } from "./localFavorites";
import type { Favorite, FavoriteInput, FavoritesResponse, Line, LocalFavorite, Route, User } from "./types";
import "./i18n/favorites";

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());
const matches = (favorite: Favorite, input: FavoriteInput) => favorite.linea.id === input.linea_id && (favorite.recorrido?.id ?? null) === (input.recorrido_id ?? null);

export async function listFavorites(user: User | null): Promise<Favorite[]> {
  if (user) return user.rol === "pasajero" ? (await api<FavoritesResponse>("/favoritos")).favoritos : [];
  const saved = await localFavorites.get();
  if (!saved.length) return [];
  const { lineas } = await api<{ lineas: Line[] }>("/red/lineas?todas=1");
  return Promise.all(saved.map(async (item, index) => {
    const linea = lineas.find((line) => line.id === item.linea_id);
    if (!linea) throw new Error("favorites.unavailable");
    const recorrido = item.recorrido_id === null ? null : (await api<{ recorridos: Route[] }>(`/red/lineas/${linea.id}/recorridos`)).recorridos.find((route) => route.id === item.recorrido_id);
    if (recorrido === undefined) throw new Error("favorites.unavailable");
    return { id: -(index + 1), linea, recorrido, creado_en: "" };
  }));
}

export async function addFavorite(user: User | null, input: FavoriteInput): Promise<boolean> {
  if (user) { await api("/favoritos", input); changed(); return false; }
  await localFavorites.add(input);
  const showReminder = !(await localFavorites.firstSaveReminderShown());
  if (showReminder) await localFavorites.markFirstSaveReminderShown();
  changed();
  return showReminder;
}
export async function removeFavorite(user: User | null, favorite: Favorite) {
  if (user) await apiJson(`/favoritos/${favorite.id}`, "DELETE");
  else await localFavorites.remove({ linea_id: favorite.linea.id, recorrido_id: favorite.recorrido?.id });
  changed();
}
export async function syncDeviceFavorites() {
  const saved = await localFavorites.get();
  // Idempotent POSTs allow retry after any partial failure. Keep every local
  // entry until all uploads are confirmed; never turn a partial upload into loss.
  for (const input of saved) await api("/favoritos", input);
  for (const input of saved) await localFavorites.remove(input);
  changed();
}
export function useFavorites(user: User | null) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [device, setDevice] = useState<LocalFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { listeners.add(reload); return () => { listeners.delete(reload); }; }, [reload]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && (Platform.OS !== "web" || document.visibilityState === "visible")) reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([listFavorites(user), localFavorites.get()]).then(([items, local]) => {
      if (mounted) { setFavorites(items); setDevice(local); setError(""); }
    }).catch((reason: Error) => { if (mounted) setError(reason.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [user?.id, revision]);
  return { favorites, device, loading, error, reload, find: (input: FavoriteInput) => favorites.find((item) => matches(item, input)) };
}
