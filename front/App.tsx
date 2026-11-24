import React, { useEffect, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from "@expo-google-fonts/barlow";
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";
import { API_URL, api, setSessionExpired } from "./src/api";
import { session } from "./src/storage";
import type { Line, User } from "./src/types";
import { Auth } from "./src/Auth";
import { Lines } from "./src/Lines";
import { Favorites } from "./src/FavoritesScreen";
import { Profile } from "./src/Profile";
import { AdminLines } from "./src/AdminLines";
import { VehicleMap } from "./src/VehicleMap";
import { Trip } from "./src/Trip";
import { Driver } from "./src/Driver";
import { Avatar, HeaderButton, Icon, Loading, Notice, styles } from "./src/ui";
import { ThemeProvider, light, useTheme } from "./src/theme";
import { LanguageProvider, t, useLanguage } from "./src/i18n";
import { NotificationProvider, useInAppNotice, useNotificationPreferences } from "./src/notify";
import { focusRing, motion, ScreenFade, useNativeDriver, useReducedMotion, type PressState } from "./src/motion";

export default function App() {
  const [loaded, fontError] = useFonts({
    Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold,
    BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold,
  });
  // An explicit font failure releases the gate and selects system font families.
  if (!loaded && !fontError) return null;
  return <ThemeProvider fontsLoaded={loaded}><SessionApp /></ThemeProvider>;
}

type Tab = "lines" | "map" | "favorites" | "trip";
type Screen = "main" | "profile" | "admin";
function SessionApp() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("lines");
  const [screen, setScreen] = useState<Screen>("main");
  const [auth, setAuth] = useState(false);
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setSessionExpired(() => {
      void session.remove().catch(() => setError(t("common.storageError")));
      setUser(null); setScreen("main");
      setError(t("common.sessionExpired"));
    });
    let mounted = true;
    api<{ usuario: User }>("/auth/me")
      .then((data) => { if (mounted) setUser(data.usuario); })
      .catch(() => {
        /* Public catalog remains available when offline or signed out. */
      })
      .finally(() => { if (mounted) setBoot(false); });
    return () => { mounted = false; setSessionExpired(() => {}); };
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", {});
      await session.remove();
      setUser(null); setAuth(false); setScreen("main"); setTab("lines"); setError("");
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  return <LanguageProvider user={user}><NotificationProvider user={user}>
    <Shell user={user} setUser={setUser} tab={tab} setTab={setTab} screen={screen} setScreen={setScreen}
      auth={auth} setAuth={setAuth} boot={boot} error={error} clearError={() => setError("")} logout={logout} />
  </NotificationProvider></LanguageProvider>;
}

type ShellProps = {
  user: User | null; setUser: (user: User) => void; tab: Tab; setTab: (tab: Tab) => void;
  screen: Screen; setScreen: (screen: Screen) => void; auth: boolean; setAuth: (auth: boolean) => void;
  boot: boolean; error: string; clearError: () => void; logout: () => Promise<void>;
};
function Shell({ user, setUser, tab, setTab, screen, setScreen, auth, setAuth, boot, error, clearError, logout }: ShellProps) {
  const theme = useTheme();
  const language = useLanguage();
  const { t } = language;
  const notifications = useNotificationPreferences();
  const { notification, dismiss } = useInAppNotice();
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();
  const [photoReady, setPhotoReady] = useState(false);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  useEffect(() => {
    let mounted = true;
    setPhotoReady(false);
    if (!user) { setPhotoHeaders(undefined); return; }
    void session.get().then((token) => {
      if (!mounted) return;
      setPhotoHeaders(token && Platform.OS !== "web" ? { Authorization: `Bearer ${token}` } : undefined);
      setPhotoReady(true);
    }).catch(() => { if (mounted) setPhotoReady(false); });
    return () => { mounted = false; };
  }, [user]);
  const viewKey = `${auth ? "auth" : screen !== "main" ? screen : user?.rol === "conductor" ? "driver" : tab}-${user?.id ?? "public"}`;
  const login = () => { setScreen("main"); setAuth(true); };
  const goTab = (value: Tab) => { setScreen("main"); setTab(value); };
  const preferenceError = language.error || notifications.error || (theme.storageError ? t("common.storageError") : "");
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
    <View style={{ flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 9, minWidth: 120 }}>
          <View style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: theme.plate, alignItems: "center", justifyContent: "center",
            borderWidth: theme.scheme === "dark" ? 2 : 0, borderColor: theme.border }}>
            <Icon name="bus-outline" color={theme.signal} size={23} />
          </View>
          <Text style={{ fontFamily: theme.fonts.display, fontSize: 30, fontWeight: theme.fonts.display ? undefined : "800", color: theme.ink, letterSpacing: -0.4 }}>VoyBus</Text>
        </View>
        {user ? <Avatar photoUrl={photoReady && user.tiene_foto ? `${API_URL}/auth/me/foto` : null} headers={photoHeaders}
          label={`${t("common.profile")}: ${user.nombre}`} onPress={() => { setAuth(false); setScreen("profile"); }} />
          : <HeaderButton title={t("common.login")} onPress={login} />}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView key={viewKey} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <ScreenFade transitionKey={viewKey} style={{ flex: 1 }}>
            {(!!error || !!preferenceError || !!notification) && <View style={{ paddingHorizontal: 20, gap: 12 }}>
              {!!error && <Notice message={error} />}
              {!!preferenceError && <Notice message={preferenceError} />}
              {notification && <View style={{ gap: 8 }}>
                <Notice kind="info" message={t("common.notification", notification)} />
                <HeaderButton title={t("common.close")} onPress={dismiss} />
              </View>}
            </View>}
            {boot ? <View style={styles.page}><Loading /></View> : auth ? <Auth onDone={(value) => {
              setUser(value); setAuth(false); setScreen("main"); clearError();
            }} onBack={() => setAuth(false)} />
              : screen === "profile" && user ? <Profile user={user} onUserChange={setUser} onLogout={logout}
                onBack={() => setScreen("main")} onFavorites={user.rol === "conductor" ? undefined : () => goTab("favorites")} />
              : screen === "admin" && user?.rol === "administrador" ? <AdminLines onBack={() => setScreen("main")} />
              : user?.rol === "conductor" ? <Driver />
              : <>
                {user?.rol === "administrador" && <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                  <HeaderButton title={t("common.adminLines")} onPress={() => setScreen("admin")} />
                </View>}
                {tab === "lines" ? <Lines selectedLine={selectedLine} user={user} onLogin={login} onTrip={() => goTab("trip")} /> : tab === "map" ? <VehicleMap />
                  : tab === "favorites" ? <Favorites user={user} onLogin={login} onLines={() => { setSelectedLine(null); goTab("lines"); }} onOpenLine={(line) => { setSelectedLine(line); goTab("lines"); }} />
                    : <Trip user={user} onLogin={login} />}
              </>}
          </ScreenFade>
        </ScrollView>
      </KeyboardAvoidingView>
      {!auth && user?.rol !== "conductor" && <TabBar tab={tab} onChange={goTab} />}
    </View>
  </SafeAreaView>;
}

const tabs = [
  { key: "lines", icon: "list-outline" }, { key: "map", icon: "navigate-outline" },
  { key: "favorites", icon: "heart-outline" }, { key: "trip", icon: "ticket-outline" },
] as const;
function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const target = tabs.findIndex((item) => item.key === tab) * width / tabs.length;
    x.stopAnimation();
    if (reduced) x.setValue(target);
    opacity.setValue(reduced ? 0 : 1);
    const animation = Animated.parallel([
      Animated.timing(x, { toValue: target, duration: reduced ? 0 : motion.base, easing: motion.easing, useNativeDriver }),
      Animated.timing(opacity, { toValue: 1, duration: motion.reduced, useNativeDriver }),
    ]);
    animation.start(); return () => animation.stop();
  }, [tab, width, reduced, x, opacity]);
  return <View accessibilityRole="tablist" accessibilityLabel={t("common.sections")}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    style={{ flexDirection: "row", backgroundColor: theme.paper, borderTopWidth: 1, borderTopColor: theme.border }}>
    {width > 0 && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      style={{ position: "absolute", top: 4, bottom: 4, left: 0, width: width / 4, borderRadius: 10,
        backgroundColor: theme.plate, borderWidth: theme.scheme === "dark" ? 2 : 0, borderColor: theme.border, transform: [{ translateX: x }], opacity }}>
      <View style={{ position: "absolute", bottom: 5, width: 22, height: 4, borderRadius: 2, backgroundColor: theme.signal, alignSelf: "center" }} />
    </Animated.View>}
    {tabs.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={t(`common.tabs.${item.key}`)}
      accessibilityState={{ selected: tab === item.key }} aria-selected={tab === item.key} onPress={() => onChange(item.key)}
      style={({ focused, pressed }: PressState) => [{ flex: 1, minWidth: 48, minHeight: 76, paddingHorizontal: 2, paddingTop: 12, paddingBottom: 18,
        alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 10, opacity: pressed ? 0.8 : 1 }, focusRing(focused, theme.action)]}>
      <Icon name={item.icon} color={tab === item.key ? theme.onPlate : theme.muted} size={22} />
      <Text style={{ fontFamily: tab === item.key ? theme.fonts.bold : theme.fonts.semibold, fontSize: 14, textAlign: "center", alignSelf: "stretch",
        color: tab === item.key ? theme.onPlate : theme.muted }}>{t(`common.tabs.${item.key}`)}</Text>
    </Pressable>)}
  </View>;
}
