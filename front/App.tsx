import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { api, setSessionExpired } from "./src/api";
import { session } from "./src/storage";
import type { User } from "./src/types";
import { Auth } from "./src/Auth";
import { Catalog } from "./src/Catalog";
import { Trip } from "./src/Trip";
import { Driver } from "./src/Driver";
import { colors, Icon, Loading, Notice, styles } from "./src/ui";
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<"catalog" | "trip">("catalog");
  const [auth, setAuth] = useState(false);
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setSessionExpired(() => {
      void session.remove();
      setUser(null);
      setError("Tu sesión venció. Ingresa nuevamente para continuar.");
    });
    api<{ usuario: User }>("/auth/me")
      .then((data) => {
        setUser(data.usuario);
      })
      .catch(() => {
        /* Public catalog remains available when offline or signed out. */
      })
      .finally(() => setBoot(false));
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", {});
      await session.remove();
      setUser(null);
      setAuth(false);
      setTab("catalog");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="dark" />
      <View
        style={{ flex: 1, width: "100%", maxWidth: 860, alignSelf: "center" }}
      >
        <View
          style={{
            paddingHorizontal: 24,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.line,
          }}
        >
          <View
            style={{
              width: 43,
              height: 43,
              borderRadius: 13,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bus-outline" color="white" size={27} />
          </View>
          <Text
            style={{
              fontSize: 27,
              fontWeight: "800",
              color: colors.ink,
              letterSpacing: -0.8,
              flex: 1,
            }}
          >
            VoyBus
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => (user ? void logout() : setAuth(true))}
            style={{ minHeight: 48, justifyContent: "center", paddingLeft: 10 }}
          >
            <Text
              style={{ fontSize: 15, fontWeight: "600", color: colors.green }}
            >
              {user ? "Salir" : "Ingresar"}
            </Text>
          </Pressable>
        </View>
        {user && (
          <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
            <Text style={styles.small}>
              {user.nombre} ·{" "}
              {user.rol === "conductor"
                ? "Conductor"
                : user.rol === "administrador"
                  ? "Administrador"
                  : "Pasajero"}
            </Text>
          </View>
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            key={`${auth ? "auth" : tab}-${user?.id ?? "public"}`}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {!!error && (
              <View style={{ paddingHorizontal: 24 }}>
                <Notice message={error} />
              </View>
            )}
            {boot ? (
              <View style={styles.page}>
                <Loading />
              </View>
            ) : auth ? (
              <Auth
                onDone={(value) => {
                  setUser(value);
                  setAuth(false);
                  setError("");
                }}
                onBack={() => setAuth(false)}
              />
            ) : user?.rol === "conductor" ? (
              <Driver />
            ) : tab === "catalog" ? (
              <Catalog onTrip={() => setTab("trip")} />
            ) : (
              <Trip user={user} onLogin={() => setAuth(true)} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        {!auth && user?.rol !== "conductor" && (
          <View
            style={{
              flexDirection: "row",
              borderTopWidth: 1,
              borderTopColor: colors.line,
              backgroundColor: colors.paper,
              paddingBottom: Platform.OS === "ios" ? 8 : 0,
            }}
          >
            {(
              [
                { key: "catalog", label: "Recorridos", icon: "map-outline" },
                { key: "trip", label: "Mi viaje", icon: "ticket-outline" },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === item.key }}
                onPress={() => setTab(item.key)}
                style={{
                  flex: 1,
                  minHeight: 72,
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon
                  name={item.icon}
                  color={tab === item.key ? colors.green : colors.muted}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: tab === item.key ? "700" : "500",
                    color: tab === item.key ? colors.green : colors.muted,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
