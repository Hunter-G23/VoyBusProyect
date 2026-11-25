import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Easing, Image, Platform, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { light, useTheme } from "./theme";
import { useLanguage } from "./i18n";
import { focusRing, motion, ScalePressable, useDelayedLoading, useFadeSlideEntrance, useNativeDriver, useReducedMotion, type PressState } from "./motion";
import type { Line, LineStatus } from "./types";

// Compatibility for screens restyled by later units. New screens use useTheme().
export const colors = {
  ...light, green: light.action, greenPressed: light.actionPressed,
  line: light.edge, yellow: light.signal, onDark: light.plateMuted,
};
export const styles = StyleSheet.create({
  page: { gap: 16, padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 16, lineHeight: 24, color: colors.muted },
  section: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  small: { fontSize: 14, lineHeight: 20, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  grow: { flex: 1 },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  listRow: { minHeight: 60, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 },
  panel: { backgroundColor: colors.paper, borderRadius: 12, padding: 16, gap: 12 },
  label: { fontSize: 16, fontWeight: "600", color: colors.ink },
  code: { backgroundColor: colors.ink, color: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, fontWeight: "700", fontSize: 24, overflow: "hidden" },
});
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function useStyles() {
  const theme = useTheme();
  return {
    ...styles,
    page: { ...styles.page, minWidth: 0, paddingHorizontal: 16 },
    title: { ...styles.title, color: theme.ink, fontFamily: theme.fonts.bold, fontWeight: theme.fonts.bold ? undefined : styles.title.fontWeight },
    section: { ...styles.section, color: theme.ink, fontFamily: theme.fonts.bold, fontWeight: theme.fonts.bold ? undefined : styles.section.fontWeight, flexShrink: 1 },
    body: { ...styles.body, color: theme.ink, fontFamily: theme.fonts.body },
    subtitle: { ...styles.subtitle, color: theme.muted, fontFamily: theme.fonts.body },
    small: { ...styles.small, color: theme.muted, fontFamily: theme.fonts.body },
    label: { ...styles.label, color: theme.ink, fontFamily: theme.fonts.semibold },
    row: { ...styles.row, flexWrap: "wrap" as const },
    grow: { flex: 1, minWidth: 0 },
    list: { ...styles.list, borderTopColor: theme.edge },
    listRow: { ...styles.listRow, minWidth: 48, borderBottomColor: theme.edge },
    panel: { ...styles.panel, padding: 16, backgroundColor: theme.paper },
  };
}
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled = false, compact = false }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; disabled?: boolean; compact?: boolean;
}) {
  const theme = useTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map((option) => <ScalePressable key={option.value} accessibilityRole="radio"
      accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value, disabled }}
      disabled={disabled} onPress={() => onChange(option.value)}
      style={({ focused, pressed }: PressState) => [{ minHeight: 48, minWidth: 48, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
        borderWidth: 1, borderColor: option.value === value ? theme.action : theme.border,
        backgroundColor: option.value === value ? theme.action : pressed ? theme.surface : theme.paper,
        flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" }, focusRing(focused, theme.action)]}>
      {!compact && <Icon name={option.value === value ? "radio-button-on" : "radio-button-off"} size={18} color={option.value === value ? theme.onAction : theme.ink} />}
      <Text style={{ color: option.value === value ? theme.onAction : theme.ink, fontFamily: theme.fonts.semibold, fontSize: compact ? 14 : 16, flexShrink: 1 }}>{option.label}</Text>
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
  expanded?: boolean; leading?: React.ReactNode;
};
export function Button({ title, onPress, busy = false, disabled = false, secondary = false, accessibilityLabel, style, expanded, leading }: ButtonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const label = <Text style={{ fontFamily: theme.fonts.semibold, fontSize: 16, fontWeight: theme.fonts.semibold ? undefined : "600",
    color: secondary ? theme.ink : theme.onAction, textAlign: "center", opacity: busy ? 0 : 1, flexShrink: leading ? 1 : undefined }}>{title}</Text>;
  return <ScalePressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled: disabled || busy, busy, expanded }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed, focused, hovered }: PressState) => [{
      minHeight: 48, minWidth: 48, paddingHorizontal: 16, paddingVertical: 10,
      borderRadius: 8, borderWidth: 1,
      borderColor: secondary ? theme.border : (pressed ? theme.actionPressed : theme.action),
      backgroundColor: secondary ? theme.surface : pressed ? theme.actionPressed : theme.action,
      alignItems: "center", justifyContent: "center", opacity: disabled ? 0.65 : 1,
    }, hovered && !disabled && !busy ? { borderColor: theme.ink } : {}, focusRing(focused, theme.action), style]}>
    {leading ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%", opacity: busy ? 0 : 1 }}>
      {leading}{label}
    </View> : label}
    {busy && <View style={local.busy} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <ActivityIndicator animating={!reduced} hidesWhenStopped={false} color={secondary ? theme.ink : theme.onAction} />
    </View>}
  </ScalePressable>;
}

export function FavoriteButton({ saved, onPress, ...props }: Omit<ButtonProps, "onPress" | "secondary" | "leading"> & {
  saved: boolean; onPress: (pulse: () => Promise<void>) => void;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const reducePulse = useRef(reduced);
  useLayoutEffect(() => { reducePulse.current = reduced; }, [reduced]);
  useLayoutEffect(() => () => { scale.stopAnimation(); scale.setValue(1); }, [scale, reduced]);
  async function pulse() {
    if (reducePulse.current) return;
    scale.setValue(1);
    const timing = (toValue: number) => Animated.timing(scale, {
      toValue, duration: motion.press, easing: motion.pressEasing, useNativeDriver,
    });
    await new Promise<void>((resolve) => Animated.sequence([timing(1.15), timing(1)]).start(() => resolve()));
  }
  return <Button {...props} secondary onPress={() => onPress(pulse)} leading={
    <Animated.View style={{ transform: [{ scale: reduced ? 1 : scale }] }}>
      <Icon name={saved ? "heart" : "heart-outline"} size={20} />
    </Animated.View>
  } />;
}

export function MenuRow({ title, icon, onPress, expanded }: {
  title: string; icon: IconName; onPress: () => void; expanded?: boolean;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  useLayoutEffect(() => {
    if (expanded === undefined) return;
    const target = expanded ? 1 : 0;
    if (reduced) { rotation.setValue(target); return; }
    const animation = Animated.timing(rotation, { toValue: target, duration: motion.fast, easing: motion.easing, useNativeDriver });
    animation.start();
    return () => animation.stop();
  }, [expanded, reduced, rotation]);
  return <ScalePressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ expanded }} onPress={onPress}
    style={({ focused, pressed }: PressState) => [{
      minHeight: 48, minWidth: 48, paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.paper,
      flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.9 : 1,
    }, focusRing(focused, theme.action)]}>
    <Icon name={icon} />
    <Text style={{ flex: 1, minWidth: 0, fontFamily: theme.fonts.semibold, fontWeight: theme.fonts.semibold ? undefined : "600",
      fontSize: 18, color: theme.ink }}>{title}</Text>
    {expanded === undefined || reduced
      ? <Icon name={expanded === undefined ? "chevron-forward" : expanded ? "chevron-up" : "chevron-down"} size={20} />
      : <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
        <Icon name="chevron-down" size={20} />
      </Animated.View>}
  </ScalePressable>;
}

export function HeaderButton({ title, onPress, disabled = false, accessibilityLabel, icon }: {
  title: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; icon?: IconName;
}) {
  const theme = useTheme();
  // 48 pt touch target around a softer 40 pt pill that matches the Costa/Pulso header.
  return <ScalePressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ focused }: PressState) => [{ minHeight: 48, minWidth: 48, justifyContent: "center", borderRadius: 24,
      opacity: disabled ? 0.65 : 1 }, focusRing(focused, theme.action)]}>
    {({ pressed, hovered }: PressState) => <View style={{ minHeight: 40, minWidth: 40, paddingHorizontal: title ? 14 : 10, borderRadius: 20,
      flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
      backgroundColor: pressed || hovered ? theme.edge : theme.surface }}>
      {icon && <Icon name={icon} size={20} color={theme.action} />}
      {!!title && <Text style={{ fontFamily: theme.fonts.semibold, fontWeight: theme.fonts.semibold ? undefined : "600", fontSize: 15,
        color: theme.ink, flexShrink: 1 }}>{title}</Text>}
    </View>}
  </ScalePressable>;
}

const logoMark = require("../assets/logo-mark.png");
/** VoyBus mark (Costa "V") tinted with the theme action colour, plus the lowercase wordmark. */
export function Brand({ size = 26 }: { size?: number }) {
  const theme = useTheme();
  return <View accessibilityRole="header" accessibilityLabel="VoyBus" style={{ flexDirection: "row", alignItems: "center", gap: size * 0.22 }}>
    <Image source={logoMark} accessibilityIgnoresInvertColors
      style={{ width: size * 1.17, height: size, tintColor: theme.action }} />
    <Text style={{ fontFamily: theme.fonts.bold, fontWeight: theme.fonts.bold ? undefined : "800", fontStyle: "italic",
      fontSize: size * 0.92, letterSpacing: -size * 0.06, color: theme.ink }}>voybus</Text>
  </View>;
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
        minHeight: 48, minWidth: 48, borderWidth: 1, borderColor: error ? theme.error : theme.border,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: theme.fonts.body,
        fontSize: 16, color: theme.ink, backgroundColor: theme.paper,
      }, focusRing(focused, theme.action), props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: theme.error, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
  </View>;
}

export type NoticeKind = "error" | "stale" | "info" | "simulated";
export function Notice({ message, retry, stale = false, kind }: { message: string; retry?: () => unknown; stale?: boolean; kind?: NoticeKind }) {
  const theme = useTheme();
  const [retrying, setRetrying] = useState(false);
  async function runRetry() {
    setRetrying(true);
    try { await retry?.(); } finally { setRetrying(false); }
  }
  const { t } = useLanguage();
  const type = kind ?? (stale ? "stale" : "error");
  const entrance = useFadeSlideEntrance(type, -4);
  const color = type === "error" ? theme.error : type === "simulated" ? theme.signalInk : theme.ink;
  const icons: Record<NoticeKind, IconName> = { error: "alert-circle-outline", stale: "time-outline", info: "information-circle-outline", simulated: "navigate-outline" };
  return <Animated.View accessibilityRole={type === "error" ? "alert" : undefined} accessibilityLiveRegion="polite"
    style={[{ gap: 10, padding: 12, borderRadius: 8, backgroundColor: type === "simulated" ? theme.signal : theme.surface }, entrance]}>
    <View style={[styles.row, { alignItems: "flex-start" }]}>
      <Icon name={icons[type]} color={color} />
      <Text style={{ color, flex: 1, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24 }}>
        {type === "stale" ? `${t("common.stale")} ` : ""}{message}
      </Text>
    </View>
    {retry && <Button title={t("common.retry")} onPress={() => void runRetry()} busy={retrying} secondary />}
  </Animated.View>;
}

/** Placeholder rows for lists while their data loads; same 300 ms delay as Loading so fast loads never flash. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const { visible, slow } = useDelayedLoading(true);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible || reduced) { pulse.setValue(1); return; }
    const half = { duration: 800, easing: motion.themeEasing, useNativeDriver };
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, ...half }),
      Animated.timing(pulse, { toValue: 1, ...half }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, reduced, pulse]);
  if (!visible) return null;
  const block = (width: number | `${number}%`, height: number, radius = 6) =>
    <View style={{ width, height, borderRadius: radius, backgroundColor: theme.edge }} />;
  const label = slow ? t("common.stillLoading") : t("common.loading");
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} aria-busy
    accessibilityLiveRegion="polite" style={{ gap: 14, paddingVertical: 8 }}>
    <Animated.View style={{ gap: 14, opacity: pulse }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {block(36, 36, 8)}
        <View style={{ flex: 1, gap: 8 }}>{block(`${72 - (index % 3) * 12}%`, 14)}{block("40%", 12)}</View>
      </View>)}
    </Animated.View>
    {slow && <Text style={{ color: theme.muted, fontFamily: theme.fonts.body, fontSize: 14 }}>{t("common.stillLoading")}</Text>}
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
    <Text accessibilityRole="header" style={{ fontFamily: theme.fonts.bold, fontSize: 22, color: theme.ink }}>{title}</Text>
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
function statusLabelKey(status: LineStatus) {
  return `common.${status === "activa" ? "active" : status === "inactiva" ? "inactive" : "temporary"}`;
}
function hexLuminance(hex: string) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function hexContrast(a: string, b: string) {
  const [hi = 0, lo = 0] = [hexLuminance(a), hexLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Status dot; an active line gets a soft "live" ring that keeps expanding and fading. */
export function StatusDot({ color, live }: { color: string; live: boolean }) {
  const reduced = useReducedMotion();
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live || reduced) { ring.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver }));
    loop.start();
    return () => loop.stop();
  }, [live, reduced, ring]);
  return <View style={{ width: 7, height: 7, alignItems: "center", justifyContent: "center" }}>
    {live && !reduced && <Animated.View style={{ position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: color,
      opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
      transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] }} />}
    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
  </View>;
}

export function LinePlate({ line, onPress, subtitle, status }: { line: Line; onPress?: () => void; subtitle?: string; status?: LineStatus }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const base = line.codigo.replace(/(?:N|Y\d+)$/, "");
  const official = lineColors[base];
  const gtfsColor = line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : official?.background ?? theme.ink;
  const numberColor = theme.scheme === "dark"
    ? theme.ink
    : hexContrast(gtfsColor, theme.background) >= 4.5 ? gtfsColor : theme.ink;
  const electric = !!line.electrica || base === "E01";
  const label = [line.codigo, line.nombre];
  if (electric) label.push(t("common.electric"));
  if (status) label.push(t(statusLabelKey(status)));
  const content = <>
    <View style={{
      minWidth: 56, maxWidth: "100%", minHeight: 40,
      borderLeftWidth: 3.5, borderLeftColor: gtfsColor,
      justifyContent: "center", paddingLeft: 9, paddingVertical: 2,
    }}>
      <Text style={{
        fontFamily: theme.fonts.heading, fontSize: 29, lineHeight: 32, letterSpacing: -0.8,
        fontWeight: theme.fonts.heading ? undefined : "700", color: numberColor,
      }}>{line.codigo}</Text>
    </View>
    <View style={{ flexGrow: 1, flexBasis: 100, minWidth: 0, gap: 4 }}>
      <Text style={{ fontFamily: theme.fonts.semibold, fontWeight: theme.fonts.semibold ? undefined : "600", fontSize: 16, lineHeight: 20, color: theme.ink }}>{line.nombre}</Text>
      {!!subtitle && <Text style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.muted }}>{subtitle}</Text>}
      {(electric || !!status) && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {status && <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <StatusDot live={status === "activa"}
            color={status === "activa" ? theme.activeInk : status === "inactiva" ? theme.muted : theme.temporaryInk} />
          <Text style={{
            fontFamily: theme.fonts.medium, fontSize: 13,
            color: status === "temporal" ? theme.temporaryInk : theme.muted,
          }}>{t(statusLabelKey(status))}</Text>
        </View>}
        {electric && <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Icon name="flash" size={13} color={theme.scheme === "dark" ? theme.action : theme.activeInk} />
          <Text style={{
            flexShrink: 1, fontFamily: theme.fonts.semibold, fontSize: 13,
            color: theme.scheme === "dark" ? theme.action : theme.activeInk,
          }}>{t("common.electric")}</Text>
        </View>}
      </View>}
    </View>
    {!!onPress && <Icon name="chevron-forward" color={theme.muted} size={17} />}
  </>;
  const plate: ViewStyle = {
    minHeight: 72, minWidth: 48, paddingVertical: 11, paddingHorizontal: 4, gap: 12,
    flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: theme.edge,
  };
  return onPress ? <ScalePressable accessibilityRole="button" accessibilityLabel={label.join(", ")}
    accessibilityState={{ disabled: false }} onPress={onPress}
    style={({ focused, pressed, hovered }: PressState) => [plate, (pressed || hovered) && { backgroundColor: theme.surface }, focusRing(focused, theme.action)]}>{content}</ScalePressable>
    : <View style={plate}>{content}</View>;
}

export function StatusChip({ status }: { status: LineStatus }) {
  const theme = useTheme();
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const lastStatus = useRef(status);
  const [outgoing, setOutgoing] = useState<LineStatus | null>(null);
  const progress = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    const previous = lastStatus.current;
    lastStatus.current = status;
    if (previous === status) { setOutgoing(null); return; }
    progress.setValue(0);
    setOutgoing(previous);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduced ? motion.reduced : motion.fast, easing: motion.easing, useNativeDriver,
    });
    animation.start(({ finished }) => { if (finished) setOutgoing(null); });
    return () => { animation.stop(); progress.setValue(1); };
  }, [status, reduced, progress]);
  function chip(state: LineStatus, opacity: Animated.Value | Animated.AnimatedInterpolation<number>, overlay = false) {
    const backgroundColor = state === "activa" ? theme.activeSurface : state === "inactiva" ? theme.inactiveSurface : theme.temporarySurface;
    const color = state === "activa" ? theme.activeInk : state === "inactiva" ? theme.error : theme.temporaryInk;
    return <Animated.View pointerEvents="none" accessibilityElementsHidden={overlay}
      importantForAccessibility={overlay ? "no-hide-descendants" : undefined} aria-hidden={overlay || undefined}
      style={[{ borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor, opacity },
        overlay && { position: "absolute", top: 0, left: 0, maxWidth: "100%" }]}>
      <Icon name={state === "activa" ? "checkmark-circle" : state === "inactiva" ? "close-circle" : "time-outline"} size={14} color={color} />
      <Text style={{ color, fontFamily: theme.fonts.semibold, fontSize: 13, flexShrink: 1 }}>{t(statusLabelKey(state))}</Text>
    </Animated.View>;
  }
  return <View accessible accessibilityRole="text" accessibilityLabel={t(statusLabelKey(status))} style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
    {chip(status, progress)}
    {outgoing && chip(outgoing, progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), true)}
  </View>;
}

function StepMark({ state, number }: { state: "completed" | "current" | "pending"; number: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const previous = useRef(state);
  useLayoutEffect(() => {
    const completed = state === "completed" && previous.current !== state;
    previous.current = state;
    if (!completed) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? motion.reduced : motion.base, easing: motion.easing, useNativeDriver });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
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
