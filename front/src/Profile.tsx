import React, { useState } from "react";
import { Text, View } from "react-native";
import type { User } from "./types";
import { Avatar, Back, Button, Empty, Notice, styles } from "./ui";
import { useTheme } from "./theme";
import { useLanguage } from "./i18n";

export type ProfileProps = {
  user: User; onUserChange: (user: User) => void; onLogout: () => Promise<void>;
  onBack: () => void; onFavorites?: () => void;
};
export function Profile({ user, onLogout, onBack, onFavorites }: ProfileProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try { await onLogout(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("common.error")); }
    finally { setBusy(false); }
  }
  return <View style={styles.page}>
    <Back onPress={onBack} />
    <Avatar label={user.nombre} size={72} />
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: theme.fonts.heading, color: theme.ink, fontSize: 32 }}>{user.nombre}</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.muted, fontSize: 16 }}>{user.correo}</Text>
      <Text style={{ fontFamily: theme.fonts.body, color: theme.muted, fontSize: 16 }}>{t(`common.${user.rol === "conductor" ? "driver" : user.rol === "administrador" ? "administrator" : "passenger"}`)}</Text>
    </View>
    <Empty title={t("common.profileSoon")} text={t("common.profileHelp")} />
    {onFavorites && <Button title={t("common.tabs.favorites")} onPress={onFavorites} secondary />}
    {!!error && <Notice message={error} />}
    <Button title={t("common.logout")} onPress={() => void logout()} busy={busy} secondary />
  </View>;
}
