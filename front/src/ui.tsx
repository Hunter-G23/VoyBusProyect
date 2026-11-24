import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Image, Platform, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { light, useTheme } from "./theme";
import { useLanguage } from "./i18n";
import { focusRing, motion, ScalePressable, useDelayedLoading, useNativeDriver, useReducedMotion, type PressState } from "./motion";
import type { Line, LineStatus } from "./types";

// Compatibility for screens restyled by later units. New screens use useTheme().
export const colors = {
  ...light, green: light.action, greenPressed: light.actionPressed,
  line: "#D6DFD9", yellow: light.signal, onDark: "#D6E8DE",
};
export const styles = StyleSheet.create({
  page: { gap: 22, padding: 20, paddingBottom: 40 },
  title: { fontSize: 42, fontWeight: "700", color: colors.ink, letterSpacing: -0.7 },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.muted },
  section: { fontSize: 28, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  grow: { flex: 1 },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  listRow: { minHeight: 78, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", gap: 14 },
  panel: { backgroundColor: colors.paper, borderRadius: 12, padding: 22, gap: 14 },
  label: { fontSize: 16, fontWeight: "600", color: colors.ink },
  code: { backgroundColor: colors.ink, color: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, fontWeight: "700", fontSize: 24, overflow: "hidden" },
});
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function useStyles() {
  const theme = useTheme();
  return {
    ...styles,
    page: { ...styles.page, minWidth: 0, paddingHorizontal: 16 },
    title: { ...styles.title, color: theme.ink, fontFamily: theme.fonts.display },
    section: { ...styles.section, color: theme.ink, fontFamily: theme.fonts.heading, flexShrink: 1 },
    body: { ...styles.body, color: theme.ink, fontFamily: theme.fonts.body },
    subtitle: { ...styles.subtitle, color: theme.muted, fontFamily: theme.fonts.body },
    small: { ...styles.small, color: theme.muted, fontFamily: theme.fonts.body },
    label: { ...styles.label, color: theme.ink, fontFamily: theme.fonts.semibold },
    row: { ...styles.row, flexWrap: "wrap" as const },
    grow: { flex: 1, minWidth: 0 },
    list: { ...styles.list, borderTopColor: theme.border },
    listRow: { ...styles.listRow, minWidth: 48, borderBottomColor: theme.border },
    panel: { ...styles.panel, padding: 16, backgroundColor: theme.paper },
  };
}
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled = false }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map((option) => <ScalePressable key={option.value} accessibilityRole="radio"
      accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value, disabled }}
      disabled={disabled} onPress={() => onChange(option.value)}
      style={({ focused, pressed }: PressState) => [{ minHeight: 48, minWidth: 48, padding: 10, borderRadius: 6,
        borderWidth: 2, borderColor: option.value === value ? theme.action : theme.border,
        backgroundColor: option.value === value ? theme.action : pressed ? theme.surface : theme.paper,
        flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" }, focusRing(focused, theme.action)]}>
      <Icon name={option.value === value ? "radio-button-on" : "radio-button-off"} size={18} color={option.value === value ? theme.onAction : theme.ink} />
      <Text style={{ color: option.value === value ? theme.onAction : theme.ink, fontFamily: theme.fonts.semibold, fontSize: 16, flexShrink: 1 }}>{option.label}</Text>
    </ScalePressable>)}
  </View>;
}
export function Icon({ name, size = 23, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.ink}
    accessibilityElementsHidden importantForAccessibility="no" accessible={false} aria-hidden />;
}

export type ButtonProps = {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
  accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
  expanded?: boolean;
};
export function Button({ title, onPress, busy = false, disabled = false, secondary = false, accessibilityLabel, style, expanded }: ButtonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  return <ScalePressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled: disabled || busy, busy, expanded }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed, focused, hovered }: PressState) => [{
      minHeight: secondary ? 56 : 66, minWidth: 48, paddingHorizontal: 20, paddingVertical: 12,
      borderRadius: 12, borderWidth: 2,
      borderColor: secondary ? theme.border : (pressed ? theme.actionPressed : theme.action),
      backgroundColor: secondary ? theme.surface : pressed ? theme.actionPressed : theme.action,
      alignItems: "center", justifyContent: "center", opacity: disabled ? 0.65 : 1,
    }, hovered && !disabled && !busy ? { borderColor: theme.ink } : {}, focusRing(focused, theme.action), style]}>
    <Text style={{ fontFamily: theme.fonts.heading, fontSize: 24, fontWeight: theme.fonts.heading ? undefined : "700",
      color: secondary ? theme.ink : theme.onAction, textAlign: "center", opacity: busy ? 0 : 1 }}>{title}</Text>
    {busy && <View style={local.busy} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <ActivityIndicator animating={!reduced} hidesWhenStopped={false} color={secondary ? theme.ink : theme.onAction} />
    </View>}
  </ScalePressable>;
}

export function HeaderButton({ title, onPress, disabled = false, accessibilityLabel, icon }: {
  title: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; icon?: IconName;
}) {
  const theme = useTheme();
  return <ScalePressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed, focused, hovered }: PressState) => [{
      minHeight: 48, minWidth: 48, paddingVertical: 10, paddingHorizontal: 16,
      borderWidth: 2, borderColor: theme.ink, borderRadius: 6, flexDirection: "row", gap: 8,
      alignItems: "center", justifyContent: "center",
      backgroundColor: pressed || hovered ? theme.surface : "transparent", opacity: disabled ? 0.65 : 1,
    }, focusRing(focused, theme.action)]}>
    {icon && <Icon name={icon} />}
    <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 16, color: theme.ink, flexShrink: 1 }}>{title}</Text>
  </ScalePressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 7 }}>
    <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 16, color: theme.ink }}>{label}</Text>
    <TextInput {...props} accessibilityRole={props.accessibilityRole ?? (Platform.OS === "web" ? "textbox" : undefined)}
      accessibilityLabel={props.accessibilityLabel ?? (error ? `${label}. ${error}` : label)}
      accessibilityState={{ ...props.accessibilityState, disabled: props.editable === false }}
      placeholderTextColor={theme.muted}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[{
        minHeight: 52, minWidth: 48, borderWidth: 2, borderColor: error ? theme.error : theme.border,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: theme.fonts.body,
        fontSize: 16, color: theme.ink, backgroundColor: theme.paper,
      }, focusRing(focused, theme.action), props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: theme.error, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
  </View>;
}

export type NoticeKind = "error" | "stale" | "info" | "simulated";
export function Notice({ message, retry, stale = false, kind }: { message: string; retry?: () => void; stale?: boolean; kind?: NoticeKind }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const type = kind ?? (stale ? "stale" : "error");
  const color = type === "error" ? theme.error : type === "simulated" ? theme.signalInk : theme.ink;
  const icons: Record<NoticeKind, IconName> = { error: "alert-circle-outline", stale: "time-outline", info: "information-circle-outline", simulated: "navigate-outline" };
  return <View accessibilityRole={type === "error" ? "alert" : undefined} accessibilityLiveRegion="polite"
    style={{ gap: 10, padding: 12, borderRadius: 8, backgroundColor: type === "simulated" ? theme.signal : theme.surface }}>
    <View style={[styles.row, { alignItems: "flex-start" }]}>
      <Icon name={icons[type]} color={color} />
      <Text style={{ color, flex: 1, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24 }}>
        {type === "stale" ? `${t("common.stale")} ` : ""}{message}
      </Text>
    </View>
    {retry && <Button title={t("common.retry")} onPress={retry} secondary />}
  </View>;
}

export function Loading({ message, active = true }: { message?: string; active?: boolean }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const { visible, slow } = useDelayedLoading(active);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: motion.reduced, useNativeDriver });
    animation.start(); return () => animation.stop();
  }, [visible, opacity]);
  if (!visible) return null;
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel={slow ? t("common.stillLoading") : message ?? t("common.loading")}
    accessibilityState={{ busy: true }} aria-busy accessibilityLiveRegion="polite" style={[styles.row, { paddingVertical: 20, opacity }]}>
    <ActivityIndicator animating={!reduced} hidesWhenStopped={false} color={theme.action} />
    <Text style={{ flex: 1, color: theme.ink, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24 }}>{slow ? t("common.stillLoading") : message ?? t("common.loading")}</Text>
  </Animated.View>;
}
export function Empty({ title, text }: { title: string; text: string }) {
  const theme = useTheme();
  return <View style={{ gap: 10, paddingVertical: 24 }}>
    <Text accessibilityRole="header" style={{ fontFamily: theme.fonts.heading, fontSize: 32, color: theme.ink }}>{title}</Text>
    <Text style={{ fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24, color: theme.muted }}>{text}</Text>
  </View>;
}
export function Back({ onPress, label }: { onPress: () => void; label?: string }) {
  const { t } = useLanguage();
  return <View style={{ alignSelf: "flex-start" }}><HeaderButton title={label ?? t("common.back")} onPress={onPress} icon="arrow-back" /></View>;
}

export const lineColors: Record<string, { background: string; text: string }> = {
  "102": { background: "#005BAA", text: "#FFFFFF" }, "103": { background: "#005BAA", text: "#FFFFFF" },
  "104": { background: "#007DBD", text: "#FFFFFF" }, "107": { background: "#A92023", text: "#FFFFFF" },
  "112": { background: "#A92023", text: "#FFFFFF" }, "108": { background: "#066A40", text: "#FFFFFF" },
  "110": { background: "#5A8400", text: "#FFFFFF" }, "111": { background: "#C9500E", text: "#FFFFFF" },
  "114": { background: "#CC9B00", text: "#132F35" }, "119": { background: "#CC9B00", text: "#132F35" },
  "121": { background: "#AD0101", text: "#FFFFFF" }, "129": { background: "#4E0963", text: "#FFFFFF" },
  E01: { background: "#598200", text: "#FFFFFF" },
};
export function LinePlate({ line, onPress, subtitle }: { line: Line; onPress?: () => void; subtitle?: string }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const base = line.codigo.replace(/(?:N|Y\d+)$/, "");
  const official = lineColors[base];
  const background = line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : official?.background ?? light.ink;
  const numberColor = line.color_texto && /^#[0-9a-f]{6}$/i.test(line.color_texto) ? line.color_texto : official?.text ?? light.paper;
  const electric = !!line.electrica || base === "E01";
  const content = <>
    <View style={{ minWidth: 78, minHeight: 64, borderRadius: 6, backgroundColor: background,
      borderWidth: theme.scheme === "dark" ? 2 : 0, borderColor: theme.border, justifyContent: "center", alignItems: "center", paddingHorizontal: 8 }}>
      <Text style={{ fontFamily: theme.fonts.display, fontSize: 36, fontWeight: theme.fonts.display ? undefined : "800", color: numberColor }}>{line.codigo}</Text>
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <Text style={{ fontFamily: theme.fonts.heading, fontSize: 28, color: theme.onPlate }}>{line.nombre}</Text>
      {!!subtitle && <Text style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.plateMuted }}>{subtitle}</Text>}
      {electric && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Icon name="flash" size={18} color={theme.signal} />
        <Text style={{ color: theme.onPlate, fontFamily: theme.fonts.semibold, fontSize: 15 }}>{t("common.electric")}</Text>
      </View>}
    </View>
    {!!onPress && <Icon name="chevron-forward" color={theme.onPlate} />}
  </>;
  const plate: ViewStyle = { minHeight: 100, minWidth: 48, padding: 14, gap: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    backgroundColor: theme.plate, borderRadius: 10, borderWidth: 2, borderColor: theme.scheme === "dark" ? theme.border : theme.plate };
  return onPress ? <ScalePressable accessibilityRole="button" accessibilityLabel={`${line.codigo}, ${line.nombre}${electric ? `, ${t("common.electric")}` : ""}`}
    accessibilityState={{ disabled: false }} onPress={onPress}
    style={({ focused, pressed }: PressState) => [plate, { opacity: pressed ? 0.9 : 1 }, focusRing(focused, theme.action)]}>{content}</ScalePressable>
    : <View style={plate}>{content}</View>;
}

export function StatusChip({ status }: { status: LineStatus }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const background = status === "activa" ? theme.action : status === "inactiva" ? theme.error : theme.signal;
  const color = status === "temporal" ? theme.signalInk : theme.onAction;
  const label = t(`common.${status === "activa" ? "active" : status === "inactiva" ? "inactive" : "temporary"}`);
  return <View accessible accessibilityRole="text" accessibilityLabel={label}
    style={{ alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: background }}>
    <Icon name={status === "activa" ? "checkmark-circle" : status === "inactiva" ? "close-circle" : "time-outline"} size={18} color={color} />
    <Text style={{ color, fontFamily: theme.fonts.semibold, fontSize: 14, flexShrink: 1 }}>{label}</Text>
  </View>;
}

function StepMark({ state, number }: { state: "completed" | "current" | "pending"; number: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(state);
  useEffect(() => {
    if (state !== "completed" || previous.current === "completed") { previous.current = state; return; }
    previous.current = state; progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? motion.reduced : motion.base, easing: motion.easing, useNativeDriver });
    animation.start(); return () => animation.stop();
  }, [state, progress, reduced]);
  return <Animated.View style={{ minWidth: 28, minHeight: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
    borderWidth: state === "current" ? 3 : 2, borderStyle: state === "pending" ? "dashed" : "solid",
    borderColor: state === "pending" ? theme.muted : theme.action, backgroundColor: state === "completed" ? theme.action : "transparent",
    opacity: reduced ? progress : 1,
    transform: [{ scale: reduced ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  }}>
    <Text style={{ fontFamily: theme.fonts.bold, color: state === "completed" ? theme.onAction : state === "current" ? theme.action : theme.muted, fontSize: 15 }}>{number}</Text>
  </Animated.View>;
}
export function Steps({ current, labels }: { current: number; labels?: readonly [string, string, string] }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const names = labels ?? [t("common.linked"), t("common.destination"), t("common.receipt")];
  const icons: IconName[] = ["link-outline", "location-outline", "ticket-outline"];
  return <View accessibilityLabel={t("common.steps")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {names.map((label, index) => {
      const state = index < current ? "completed" : index === current ? "current" : "pending";
      const color = state === "pending" ? theme.muted : theme.ink;
      return <View key={index} accessible accessibilityRole="text" accessibilityLabel={t("common.step", { number: index + 1, label, state: t(`common.${state}`) })}
        style={{ flex: 1, minWidth: 90, gap: 6, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <StepMark state={state} number={index + 1} />
          <View style={{ flex: 1, borderTopWidth: 2, borderStyle: "dotted", borderColor: theme.muted }} />
          <Icon name={state === "completed" ? "checkmark-circle" : icons[index] ?? "ticket-outline"} size={18} color={color} />
        </View>
        <Text style={{ fontFamily: state === "current" ? theme.fonts.bold : theme.fonts.semibold, color, fontSize: 16 }}>{label}</Text>
        <Text style={{ fontFamily: theme.fonts.body, color: theme.muted, fontSize: 13 }}>{t(`common.${state}`)}</Text>
      </View>;
    })}
  </View>;
}

export function Avatar({ photoUrl, headers, onPress, label, size = 48 }: {
  photoUrl?: string | null; headers?: Record<string, string>; onPress?: () => void; label?: string; size?: number;
}) {
  const theme = useTheme();
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photoUrl, headers]);
  const diameter = Math.max(48, size);
  const shape: ViewStyle = { width: diameter, height: diameter, borderRadius: diameter / 2, alignItems: "center", justifyContent: "center", backgroundColor: theme.plate, borderWidth: 2, borderColor: theme.border };
  const content = photoUrl && !failed
    ? <Image source={{ uri: photoUrl, headers }} onError={() => setFailed(true)} accessible={false} aria-hidden
        style={{ width: diameter - 4, height: diameter - 4, borderRadius: diameter / 2 }} />
    : <Icon name="person" color={theme.onPlate} size={diameter * 0.55} />;
  return onPress ? <ScalePressable accessibilityRole="button" accessibilityLabel={label ?? t("common.profile")}
    accessibilityState={{ disabled: false }} onPress={onPress} style={({ focused, pressed }: PressState) => [shape, { opacity: pressed ? 0.85 : 1 }, focusRing(focused, theme.action)]}>{content}</ScalePressable>
    : <View accessible accessibilityRole="image" accessibilityLabel={label ?? t("common.profile")} style={shape}>{content}</View>;
}
const local = StyleSheet.create({ busy: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" } });
