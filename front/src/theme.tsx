import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useColorScheme } from "react-native";
import { storage } from "./storage";
import { motion, useNativeDriver, useReducedMotion } from "./motion";

export type ThemePreference = "system" | "light" | "dark";
export type ThemeScheme = "light" | "dark";
export const light = {
  background: "#FFFEFA", paper: "#FFFEFA", ink: "#122B38", muted: "#4E6167",
  action: "#123FC4", onAction: "#FFFFFF", actionPressed: "#0D319A", border: "#738285",
  signal: "#FFD45E", error: "#9B2C2C", surface: "#EDF3EC", edge: "#DCE3DE",
  plate: "#122B38", onPlate: "#FFFEFA", plateMuted: "#D7E7F8", signalInk: "#122B38",
  activeInk: "#135C3F", activeSurface: "#E1F3E9", inactiveSurface: "#FBEAEB",
  temporaryInk: "#664703", temporarySurface: "#FFF1CD",
  sea: "#B2D9D9", coral: "#DE7459",
} as const;
export type ThemeTokens = { [K in keyof typeof light]: string };
export const dark: ThemeTokens = {
  background: "#0D191F", paper: "#19262E", ink: "#F2F5EF", muted: "#B0BDC3",
  action: "#C8F477", onAction: "#0D191F", actionPressed: "#AEDB5D", border: "#778A95",
  signal: "#C8F477", error: "#F2A0A0", surface: "#21323C", edge: "#2B3C46",
  plate: "#19262E", onPlate: "#F2F5EF", plateMuted: "#C9DAF1", signalInk: "#0D191F",
  activeInk: "#A6E8C7", activeSurface: "#1C3A33", inactiveSurface: "#43282E",
  temporaryInk: "#F0C58A", temporarySurface: "#45351E",
  sea: "#152B36", coral: "#E48162",
};
export const themes = { light, dark };
const fontNames = {
  body: "Barlow_400Regular", medium: "Barlow_500Medium", semibold: "Barlow_600SemiBold", bold: "Barlow_700Bold",
  condensed: "BarlowCondensed_600SemiBold", heading: "BarlowCondensed_700Bold", display: "BarlowCondensed_800ExtraBold",
};
type Fonts = { [K in keyof typeof fontNames]: string | undefined };
const systemFonts: Fonts = { body: undefined, medium: undefined, semibold: undefined, bold: undefined, condensed: undefined, heading: undefined, display: undefined };
type ThemeValue = ThemeTokens & {
  colors: ThemeTokens; scheme: ThemeScheme; preference: ThemePreference; fonts: Fonts;
  setPreference: (preference: ThemePreference) => Promise<void>; storageError: string;
};
const ThemeContext = createContext<ThemeValue>({
  ...light, colors: light, scheme: "light", preference: "system", fonts: systemFonts,
  setPreference: async () => {}, storageError: "",
});
export function ThemeProvider({ children, fontsLoaded = false }: { children: React.ReactNode; fontsLoaded?: boolean }) {
  const system = useColorScheme() === "dark" ? "dark" : "light";
  const reduced = useReducedMotion();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [scheme, setScheme] = useState<ThemeScheme>(system);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [overlayColor, setOverlayColor] = useState(themes[system].background);
  const opacity = useRef(new Animated.Value(0)).current;
  const active = useRef(scheme);
  useEffect(() => {
    let mounted = true;
    void storage.get("voybus-theme").then((stored) => {
      if (!mounted) return;
      const value = stored === "light" || stored === "dark" ? stored : "system";
      setPreferenceState(value);
      const initial = value === "system" ? system : value;
      active.current = initial; setScheme(initial);
    }).catch((reason: unknown) => { if (mounted) setStorageError(String(reason)); })
      .finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
    // Read once before mounting the app. System changes below use the live scheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const requested = preference === "system" ? system : preference;
  useEffect(() => {
    if (!ready) return;
    if (requested === active.current) {
      const cancel = Animated.timing(opacity, { toValue: 0, duration: motion.reduced, useNativeDriver });
      cancel.start();
      return () => cancel.stop();
    }
    setOverlayColor(themes[requested].background);
    const cover = Animated.timing(opacity, {
      toValue: 1, duration: reduced ? motion.reduced : motion.theme / 2,
      easing: motion.themeEasing, useNativeDriver,
    });
    cover.start(({ finished }) => {
      if (finished) { active.current = requested; setScheme(requested); }
    });
    return () => cover.stop();
  }, [requested, ready, reduced, opacity]);
  useLayoutEffect(() => {
    const reveal = Animated.timing(opacity, {
      toValue: 0, duration: reduced ? motion.reduced : motion.theme / 2,
      easing: motion.themeEasing, useNativeDriver,
    });
    reveal.start();
    return () => reveal.stop();
  }, [scheme, reduced, opacity]);
  async function setPreference(value: ThemePreference) {
    try {
      await storage.set("voybus-theme", value);
      setStorageError(""); setPreferenceState(value);
    } catch (reason) { setStorageError(String(reason)); throw reason; }
  }
  const colors = themes[scheme];
  return <ThemeContext.Provider value={{ ...colors, colors, scheme, preference, setPreference, fonts: fontsLoaded ? fontNames : systemFonts, storageError }}>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {ready ? children : null}
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
        style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: overlayColor, opacity }]} />
    </View>
  </ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
