import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useColorScheme } from "react-native";
import { storage } from "./storage";
import { motion, useNativeDriver, useReducedMotion } from "./motion";

export type ThemePreference = "system" | "light" | "dark";
export type ThemeScheme = "light" | "dark";
export const light = {
  background: "#F7F7F0", paper: "#FFFFFF", ink: "#132F35", muted: "#526769",
  action: "#12634D", onAction: "#FFFFFF", actionPressed: "#0D4B3B", border: "#71867C",
  signal: "#F6CE55", error: "#9B2C2C", surface: "#E8EEE9",
} as const;
export type ThemeTokens = { [K in keyof typeof light]: string };
export const dark: ThemeTokens = {
  background: "#0C1C20", paper: "#132F35", ink: "#F7F7F0", muted: "#A9BDB8",
  action: "#6FD3AE", onAction: "#0C1C20", actionPressed: "#4FB892", border: "#8FA79D",
  signal: "#F6CE55", error: "#F2A0A0", surface: "#1E3A40",
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
  setPreference: (preference: ThemePreference) => Promise<void>; error: string;
};
const ThemeContext = createContext<ThemeValue>({
  ...light, colors: light, scheme: "light", preference: "system", fonts: systemFonts,
  setPreference: async () => {}, error: "",
});
export function ThemeProvider({ children, fontsLoaded = false }: { children: React.ReactNode; fontsLoaded?: boolean }) {
  const system = useColorScheme() === "dark" ? "dark" : "light";
  const reduced = useReducedMotion();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [scheme, setScheme] = useState<ThemeScheme>(system);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
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
    }).catch((reason: unknown) => { if (mounted) setError(String(reason)); })
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
      setError(""); setPreferenceState(value);
    } catch (reason) { setError(String(reason)); throw reason; }
  }
  const colors = themes[scheme];
  return <ThemeContext.Provider value={{ ...colors, colors, scheme, preference, setPreference, fonts: fontsLoaded ? fontNames : systemFonts, error }}>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {ready ? children : null}
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
        style={[StyleSheet.absoluteFill, { zIndex: 100, backgroundColor: overlayColor, opacity }]} />
    </View>
  </ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
