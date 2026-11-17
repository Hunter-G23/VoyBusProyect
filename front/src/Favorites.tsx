import React from "react";
import { View } from "react-native";
import type { User } from "./types";
import { Button, Empty, styles } from "./ui";
import { useLanguage } from "./i18n";

export type FavoritesProps = { user: User | null; onLogin: () => void; onLines: () => void };
export function Favorites({ user, onLogin, onLines }: FavoritesProps) {
  const { t } = useLanguage();
  return <View style={styles.page}>
    <Empty title={t("common.favoritesSoon")} text={t("common.favoritesHelp")} />
    <Button title={t("common.tabs.lines")} onPress={onLines} secondary />
    {!user && <Button title={t("common.login")} onPress={onLogin} />}
  </View>;
}
