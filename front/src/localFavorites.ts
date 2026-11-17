import { storage } from "./storage";
import type { FavoriteInput, LocalFavorite } from "./types";

const key = "voybus-local-favorites";
type SavedFavorites = { favoritos: LocalFavorite[]; firstSaveReminderShown: boolean };
function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function normalize(input: FavoriteInput): LocalFavorite {
  if (!validId(input.linea_id) || (input.recorrido_id != null && !validId(input.recorrido_id))) {
    throw new Error("Invalid favorite identifiers");
  }
  return { linea_id: input.linea_id, recorrido_id: input.recorrido_id ?? null };
}
async function read(): Promise<SavedFavorites> {
  const raw = await storage.get(key);
  if (!raw) return { favoritos: [], firstSaveReminderShown: false };
  const saved: unknown = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || !("favoritos" in saved) || !Array.isArray(saved.favoritos)) {
    throw new Error("Invalid local favorites storage");
  }
  const favoritos: LocalFavorite[] = [];
  for (const item of saved.favoritos) {
    if (!item || typeof item !== "object") throw new Error("Invalid local favorite");
    const favorite = normalize(item as FavoriteInput);
    if (!favoritos.some((entry) => same(entry, favorite))) favoritos.push(favorite);
  }
  return { favoritos, firstSaveReminderShown: "firstSaveReminderShown" in saved && saved.firstSaveReminderShown === true };
}
function same(a: LocalFavorite, b: LocalFavorite) {
  return a.linea_id === b.linea_id && a.recorrido_id === b.recorrido_id;
}
let queue = Promise.resolve();
function update(change: (saved: SavedFavorites) => void) {
  const operation = queue.then(async () => {
    const saved = await read();
    change(saved);
    await storage.set(key, JSON.stringify(saved));
    return saved;
  });
  // Keep subsequent saves usable after a failure; the caller still receives that rejection.
  queue = operation.then(() => undefined, () => undefined);
  return operation;
}
export async function getLocalFavorites() { await queue; return (await read()).favoritos; }
export async function addLocalFavorite(input: FavoriteInput) {
  const favorite = normalize(input);
  return (await update((saved) => {
    if (!saved.favoritos.some((item) => same(item, favorite))) saved.favoritos.push(favorite);
  })).favoritos;
}
export async function removeLocalFavorite(input: FavoriteInput) {
  const favorite = normalize(input);
  return (await update((saved) => { saved.favoritos = saved.favoritos.filter((item) => !same(item, favorite)); })).favoritos;
}
export async function firstSaveReminderShown() { await queue; return (await read()).firstSaveReminderShown; }
export async function markFirstSaveReminderShown() { await update((saved) => { saved.firstSaveReminderShown = true; }); }
export const localFavorites = {
  get: getLocalFavorites, add: addLocalFavorite, remove: removeLocalFavorite,
  firstSaveReminderShown, markFirstSaveReminderShown,
};
