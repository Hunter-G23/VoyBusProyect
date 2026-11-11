import { Platform } from "react-native";
import { session } from "./storage";
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api"
).replace(/\/$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
let onSessionExpired: (() => void) | undefined;
export function setSessionExpired(callback: () => void) {
  onSessionExpired = callback;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const token = await session.get();
    const response = await fetch(API_URL + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && Platform.OS !== "web"
          ? { Authorization: "Bearer " + token }
          : {}),
      },
      credentials: "include",
      signal: controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (
        response.status === 401 &&
        path !== "/auth/login" &&
        path !== "/auth/registro" &&
        path !== "/auth/me"
      )
        onSessionExpired?.();
      throw new ApiError(
        data?.error?.mensaje || "No pudimos completar la operación.",
        response.status,
        data?.error?.campos,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "No hay respuesta del servidor. Revisa tu conexión y vuelve a intentar.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
