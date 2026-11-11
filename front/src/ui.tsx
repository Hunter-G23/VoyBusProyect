import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
export const colors = {
  ink: "#132F35",
  green: "#12634D",
  background: "#F7F7F0",
  paper: "#FFFFFF",
  muted: "#526769",
  line: "#D6DFD9",
  yellow: "#F6CE55",
  error: "#9B2C2C",
};
export const styles = StyleSheet.create({
  page: { gap: 22, padding: 24, paddingBottom: 40 },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.muted },
  section: { fontSize: 21, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 13, lineHeight: 20, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  grow: { flex: 1 },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  listRow: {
    minHeight: 78,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  panel: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 22,
    gap: 14,
  },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  code: {
    backgroundColor: colors.ink,
    color: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    fontWeight: "700",
    fontSize: 15,
    overflow: "hidden",
  },
});
export function Icon({
  name,
  size = 23,
  color = colors.ink,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: secondary ? "#E8EEE9" : colors.green,
        opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
      })}
    >
      {busy && (
        <ActivityIndicator color={secondary ? colors.green : "#FFFFFF"} />
      )}
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: secondary ? colors.ink : "#FFFFFF",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          {
            minHeight: 52,
            borderWidth: 1,
            borderColor: error ? colors.error : "#A8BAB0",
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 16,
            color: colors.ink,
            backgroundColor: colors.paper,
          },
          props.style,
        ]}
      />
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.error, fontSize: 14, lineHeight: 20 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
export function Notice({
  message,
  retry,
  stale = false,
}: {
  message: string;
  retry?: () => void;
  stale?: boolean;
}) {
  return (
    <View
      style={{ gap: 10, paddingVertical: 12 }}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.row, { alignItems: "flex-start" }]}>
        <Icon name="alert-circle-outline" color={colors.error} />
        <Text style={[styles.body, { color: colors.error, flex: 1 }]}>
          {stale ? "Información sin actualizar. " : ""}
          {message}
        </Text>
      </View>
      {retry && <Button title="Volver a intentar" onPress={retry} secondary />}
    </View>
  );
}
export function Loading() {
  return (
    <View style={[styles.row, { paddingVertical: 20 }]}>
      <ActivityIndicator color={colors.green} />
      <Text style={styles.body}>Cargando información…</Text>
    </View>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={{ gap: 10, paddingVertical: 24 }}>
      <Text style={styles.section}>{title}</Text>
      <Text style={styles.subtitle}>{text}</Text>
    </View>
  );
}
export function Back({
  onPress,
  label = "Volver",
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, { minHeight: 48, alignSelf: "flex-start" }]}
    >
      <Icon name="arrow-back" />
      <Text style={[styles.body, { fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}
