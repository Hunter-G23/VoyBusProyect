import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, Text, useWindowDimensions, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, Barlow_700Bold } from "@expo-google-fonts/barlow";
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed";
import { API_URL, api, setSessionExpired } from "./src/api";
import { session } from "./src/storage";
import type { Line, Route, Stop, User } from "./src/types";
import type { MapFocusTarget } from "./src/mapTypes";
import { Auth } from "./src/Auth";
import { Lines } from "./src/Lines";
import { Favorites } from "./src/FavoritesScreen";
import { GuestSettings, Profile } from "./src/Profile";
import { AdminLines } from "./src/AdminLines";
import { VehicleMap } from "./src/VehicleMap";
import { Trip } from "./src/Trip";
import { Driver } from "./src/Driver";
import { Avatar, Brand, HeaderButton, Icon, Loading, Notice, styles } from "./src/ui";
import { ThemeProvider, light, useTheme } from "./src/theme";
import { LanguageProvider, t, useLanguage } from "./src/i18n";
import { NotificationProvider, useInAppNotice, useNotificationPreferences } from "./src/notify";
import { focusRing, motion, ScreenFade, ScrollContext, useNativeDriver, useReducedMotion, type PressState } from "./src/motion";
import { Launch } from "./src/Launch";

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
type Screen = "main" | "profile" | "admin" | "settings";
function SessionApp() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("lines");
  const [screen, setScreen] = useState<Screen>("main");
  const [auth, setAuth] = useState(false);
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState("");
  const [launched, setLaunched] = useState(false);
  const reduced = useReducedMotion();
  const appIn = useRef(new Animated.Value(0)).current;
  function reveal() {
    Animated.timing(appIn, {
      toValue: 1, duration: reduced ? motion.reduced : motion.appIn, easing: motion.easing, useNativeDriver,
    }).start();
  }
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
    <View style={{ flex: 1 }}>
      <Animated.View style={{ flex: 1, opacity: appIn,
        transform: reduced ? [] : [{ translateY: appIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Shell user={user} setUser={setUser} tab={tab} setTab={setTab} screen={screen} setScreen={setScreen}
          auth={auth} setAuth={setAuth} boot={boot} error={error} clearError={() => setError("")} logout={logout} />
      </Animated.View>
      {!launched && <Launch ready={!boot} onExit={reveal} onDone={() => setLaunched(true)} />}
    </View>
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
  const { width } = useWindowDimensions();
  const notifications = useNotificationPreferences();
  const { notification, dismiss } = useInAppNotice();
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>();
  const [photoReady, setPhotoReady] = useState(false);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);
  const [mapTarget, setMapTarget] = useState<MapFocusTarget>();
  const mapRequestId = useRef(0);
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
  const reduced = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof Animated.ScrollView>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollContent = useRef<React.ComponentRef<typeof View>>(null);
  const scrollOffset = useRef(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scrollState = React.useMemo(() => ({ y: scrollY, viewport: viewportHeight, offset: scrollOffset, content: scrollContent }), [scrollY, viewportHeight]);
  const maxScroll = contentHeight - viewportHeight;
  const divider = useRef(new Animated.Value(0)).current;
  const dividerVisible = useRef(false);
  const onScroll = React.useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver },
  ), [scrollY]);
  useLayoutEffect(() => {
    dividerVisible.current = false;
    scrollOffset.current = 0;
    scrollY.setValue(0);
    divider.setValue(0);
    return () => divider.stopAnimation();
  }, [viewKey, scrollY, divider]);
  useLayoutEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      scrollOffset.current = value;
      const visible = value > 8;
      if (visible === dividerVisible.current) return;
      dividerVisible.current = visible;
      Animated.timing(divider, {
        toValue: visible ? 1 : 0, duration: reduced ? motion.reduced : motion.fast,
        easing: motion.easing, useNativeDriver,
      }).start();
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY, divider, reduced]);
  function resetLineScroll() {
    scroll.current?.scrollTo({ y: 0, animated: false });
    scrollOffset.current = 0;
    scrollY.setValue(0);
  }
  const login = () => { setScreen("main"); setAuth(true); };
  const goTab = (value: Tab) => {
    if (value !== "map") setMapTarget(undefined);
    setScreen("main"); setTab(value);
  };
  function openStop(stop: Stop, route: Route) {
    setMapTarget({ stopId: stop.paradero_id, routeId: route.id, requestId: ++mapRequestId.current });
    goTab("map");
  }
  const preferenceError = language.error || notifications.error || (theme.storageError ? t("common.storageError") : "");
  const isMap = !boot && !auth && screen === "main" && user?.rol !== "conductor" && tab === "map";
  const notices = (!!error || !!preferenceError || !!notification) ? (
    <View style={{ padding: 16, paddingBottom: 0, gap: 12 }}>
      {!!error && <Notice message={error} />}
      {!!preferenceError && <Notice message={preferenceError} />}
      {notification && <View style={{ gap: 8 }}>
        <Notice kind="info" message={t("common.notification", notification)} />
        <HeaderButton title={t("common.close")} onPress={dismiss} />
      </View>}
    </View>
  ) : null;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
    <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: theme.paper }}>
        <View style={{ width: "100%", maxWidth: 960, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 4,
          flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minWidth: 85 }}>
            <Brand size={22} />
          </View>
          {width >= (user ? 300 : 440) && <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Icon name="location-outline" size={14} color={theme.muted} />
            <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 12, color: theme.muted }}>{t("common.city")}</Text>
          </View>}
          {user ? <Avatar photoUrl={photoReady && user.tiene_foto ? `${API_URL}/auth/me/foto` : null} headers={photoHeaders}
            label={`${t("common.profile")}: ${user.nombre}`} onPress={() => { setAuth(false); setScreen("profile"); }} />
            : <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <HeaderButton title="" accessibilityLabel={t("common.settings")} icon="settings-outline"
                onPress={() => { setAuth(false); setScreen("settings"); }} />
              <HeaderButton title={t("common.login")} icon="person-circle-outline" onPress={login} />
            </View>}
        </View>
        <View pointerEvents="none" style={{ height: 1, backgroundColor: theme.edge }} />
        <Animated.View pointerEvents="none" style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1, backgroundColor: theme.border,
          opacity: divider.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
        }} />
        {/* Scroll progress as a route: a bus dot travels the line while the screen scrolls. */}
        {!isMap && maxScroll > 80 && <Animated.View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 9,
            justifyContent: "center", opacity: divider }}>
          <Animated.View style={{ height: 2, width: width, backgroundColor: theme.action, transformOrigin: "left",
            transform: [{ scaleX: scrollY.interpolate({ inputRange: [0, maxScroll], outputRange: [0, 1], extrapolate: "clamp" }) }] }} />
          <Animated.View style={{ position: "absolute", left: 0, width: 9, height: 9, borderRadius: 5,
            backgroundColor: theme.action, borderWidth: 2, borderColor: theme.paper,
            transform: [{ translateX: scrollY.interpolate({ inputRange: [0, maxScroll], outputRange: [0, width - 9], extrapolate: "clamp" }) }] }} />
        </Animated.View>}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isMap ? <ScreenFade transitionKey={viewKey} style={{ flex: 1, width: "100%", maxWidth: 960, alignSelf: "center" }}>
          {notices}
          {user?.rol === "administrador" && <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <HeaderButton title={t("common.adminLines")} onPress={() => setScreen("admin")} />
          </View>}
          <View style={{ flex: 1, minHeight: 0 }}>
            <VehicleMap focusTarget={mapTarget} />
          </View>
        </ScreenFade>
          : <Animated.ScrollView key={viewKey} ref={scroll} onScroll={onScroll} scrollEventThrottle={16}
            onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
            onContentSizeChange={(_width, height) => setContentHeight(height)}
            contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <ScrollContext.Provider value={scrollState}>
            <ScreenFade transitionKey={viewKey} style={{ flex: 1, width: "100%", maxWidth: 960, alignSelf: "center" }}>
              <View collapsable={false} ref={scrollContent} style={{ flex: 1 }}>
              {notices}
              {boot ? <View style={styles.page}><Loading /></View> : auth ? <Auth onDone={(value) => {
                setUser(value); setAuth(false); setScreen("main"); clearError();
              }} onBack={() => setAuth(false)} />
                : screen === "profile" && user ? <Profile user={user} onUserChange={setUser} onLogout={logout}
                  onBack={() => setScreen("main")} onFavorites={user.rol === "conductor" ? undefined : () => goTab("favorites")} />
                : screen === "admin" && user?.rol === "administrador" ? <AdminLines onBack={() => setScreen("main")} />
                : screen === "settings" && !user ? <GuestSettings onBack={() => setScreen("main")} onLogin={login} />
                : user?.rol === "conductor" ? <Driver />
                : <>
                  {user?.rol === "administrador" && <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                    <HeaderButton title={t("common.adminLines")} onPress={() => setScreen("admin")} />
                  </View>}
                  {tab === "lines" ? <Lines selectedLine={selectedLine} user={user} onLogin={login} onTrip={() => goTab("trip")} onOpenStop={openStop}
                    onLineNavigation={resetLineScroll} />
                    : tab === "favorites" ? <Favorites user={user} onLogin={login} onLines={() => { setSelectedLine(null); goTab("lines"); }} onOpenLine={(line) => { setSelectedLine(line); goTab("lines"); }} />
                      : <Trip user={user} onLogin={login} />}
                </>}
              </View>
            </ScreenFade>
            </ScrollContext.Provider>
          </Animated.ScrollView>}
      </KeyboardAvoidingView>
      {!auth && user?.rol !== "conductor" && <View style={{ backgroundColor: theme.paper, borderTopWidth: 1, borderTopColor: theme.edge }}>
        <TabBar tab={tab} onChange={goTab} />
      </View>}
    </View>
  </SafeAreaView>;
}

const tabs = [
  { key: "map", icon: "map-outline" }, { key: "lines", icon: "list-outline" },
  { key: "favorites", icon: "star-outline" }, { key: "trip", icon: "navigate-outline" },
] as const;
/** Tab icon that pops (small spring) when its tab becomes active. */
function TabIcon({ name, active }: { name: React.ComponentProps<typeof Icon>["name"]; active: boolean }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!active || reduced) return;
    scale.setValue(0.7);
    const pop = Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver });
    pop.start();
    return () => pop.stop();
  }, [active, reduced, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}>
    <Icon name={name} color={active ? theme.action : theme.muted} size={20} />
  </Animated.View>;
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const target = tabs.findIndex((item) => item.key === tab) * width / tabs.length;
  const previousWidth = useRef(0);
  const x = useRef(new Animated.Value(target)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    const resized = previousWidth.current !== width;
    previousWidth.current = width;
    if (reduced || resized) x.setValue(target);
    if (resized || width === 0) return;
    if (reduced) opacity.setValue(0);
    const animation = Animated.timing(reduced ? opacity : x, {
      toValue: reduced ? 1 : target, duration: reduced ? motion.reduced : motion.base,
      easing: motion.easing, useNativeDriver,
    });
    animation.start();
    return () => { animation.stop(); opacity.setValue(1); };
  }, [target, width, reduced, x, opacity]);
  return <View accessibilityRole="tablist" accessibilityLabel={t("common.sections")}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    style={{ flexDirection: "row", width: "100%", maxWidth: 640, alignSelf: "center" }}>
    {width > 0 && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden
      style={{ position: "absolute", top: 0, bottom: 3, left: 0, width: width / tabs.length, paddingHorizontal: 3,
        transform: [{ translateX: x }], opacity }}>
      <View style={{ flex: 1, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, backgroundColor: theme.scheme === "dark" ? "transparent" : theme.surface }} />
      <View style={{ position: "absolute", top: 0, width: 28, height: 3, borderRadius: 2, backgroundColor: theme.action, alignSelf: "center" }} />
    </Animated.View>}
    {tabs.map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={t(`common.tabs.${item.key}`)}
      accessibilityState={{ selected: tab === item.key }} aria-selected={tab === item.key} onPress={() => onChange(item.key)}
      style={({ focused, pressed }: PressState) => [{ flex: 1, minWidth: 48, minHeight: 58, paddingHorizontal: 2, paddingVertical: 6,
        alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 8, opacity: pressed ? 0.8 : 1 }, focusRing(focused, theme.action)]}>
      <TabIcon name={item.icon} active={tab === item.key} />
      <Text style={{ fontFamily: tab === item.key ? theme.fonts.bold : theme.fonts.semibold, fontSize: 13, textAlign: "center", alignSelf: "stretch",
        color: tab === item.key ? theme.action : theme.muted }}>{t(`common.tabs.${item.key}`)}</Text>
    </Pressable>)}
  </View>;
}
