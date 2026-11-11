import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const storage = {
  async get(key: string) {
    if (Platform.OS === "web")
      return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
// Browser sessions use the server's HttpOnly cookie, never localStorage tokens.
export const session = {
  get: () =>
    Platform.OS === "web"
      ? Promise.resolve(null)
      : SecureStore.getItemAsync("voybus-token"),
  set: (token: string) =>
    Platform.OS === "web"
      ? Promise.resolve()
      : SecureStore.setItemAsync("voybus-token", token),
  remove: () =>
    Platform.OS === "web"
      ? Promise.resolve()
      : SecureStore.deleteItemAsync("voybus-token"),
};
