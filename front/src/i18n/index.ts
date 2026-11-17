import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { storage } from "../storage";
import { apiJson } from "../api";
import type { User } from "../types";
import { common } from "./common";

export type Language = "es" | "en";
export type Dictionary = { es: Record<string, string>; en: Record<string, string> };
export type TranslationParams = Record<string, string | number>;
export type Translate = (key: string, params?: TranslationParams) => string;
const dictionaries = new Map<string, Dictionary>([["common", common]]);
// Each screen registers its own namespace from i18n/<screen>.ts, without editing this file.
export function registerDictionary(namespace: string, dictionary: Dictionary) {
  dictionaries.set(namespace, dictionary);
}
function translate(language: Language, key: string, params?: TranslationParams) {
  const split = key.indexOf(".");
  const namespace = split < 0 ? "common" : key.slice(0, split);
  const name = split < 0 ? key : key.slice(split + 1);
  const dictionary = dictionaries.get(namespace);
  const value = dictionary?.[language][name] ?? dictionary?.es[name] ?? key;
  return value.replace(/\{(\w+)\}/g, (placeholder, name: string) => String(params?.[name] ?? placeholder));
}
let currentLanguage: Language = "es";
// For non-component utilities. Components use useLanguage().t to react to changes.
export const t: Translate = (key, params) => translate(currentLanguage, key, params);
type LanguageValue = { language: Language; setLanguage: (language: Language) => Promise<void>; t: Translate; error: string };
const LanguageContext = createContext<LanguageValue>({ language: "es", setLanguage: async () => {}, t, error: "" });
export function LanguageProvider({ children, user = null }: { children: React.ReactNode; user?: User | null }) {
  const [language, setLanguageState] = useState<Language>("es");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const account = useRef<number | null>(null);
  useEffect(() => {
    let mounted = true;
    void storage.get("voybus-language").then((stored) => {
      if (!mounted) return;
      const value = stored === "en" ? "en" : "es";
      currentLanguage = value; setLanguageState(value);
    }).catch(() => { if (mounted) setError(translate("es", "common.storageError")); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!ready || !user) { if (!user) account.current = null; return; }
    if (account.current === user.id) return;
    account.current = user.id;
    if (user.idioma === "es" || user.idioma === "en") {
      currentLanguage = user.idioma; setLanguageState(user.idioma);
      void storage.set("voybus-language", user.idioma).catch(() => setError(translate(currentLanguage, "common.storageError")));
    }
  }, [ready, user]);
  async function setLanguage(value: Language) {
    try {
      await storage.set("voybus-language", value);
      currentLanguage = value; setLanguageState(value); setError("");
      if (user) await apiJson("/auth/me/preferencias", "PATCH", { idioma: value });
    } catch (reason) { setError(translate(value, "common.storageError")); throw reason; }
  }
  const value: LanguageValue = { language, setLanguage, t: (key, params) => translate(language, key, params), error };
  return React.createElement(LanguageContext.Provider, { value }, ready ? children : null);
}
export function useLanguage() { return useContext(LanguageContext); }
