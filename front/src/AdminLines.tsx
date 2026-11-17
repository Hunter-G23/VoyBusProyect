import React from "react";
import { View } from "react-native";
import { Back, Empty, styles } from "./ui";
import { useLanguage } from "./i18n";

export type AdminLinesProps = { onBack: () => void };
export function AdminLines({ onBack }: AdminLinesProps) {
  const { t } = useLanguage();
  return <View style={styles.page}>
    <Back onPress={onBack} />
    <Empty title={t("common.adminSoon")} text={t("common.adminHelp")} />
  </View>;
}
