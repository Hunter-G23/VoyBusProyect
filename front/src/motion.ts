import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo, Animated, Easing, Platform, Pressable,
  type PressableProps, type StyleProp, type ViewStyle,
} from "react-native";

export const motion = {
  press: 120, fast: 160, base: 200, theme: 220, stagger: 40,
  spinnerDelay: 300, screen: 180, reduced: 120,
  pressEasing: Easing.out(Easing.quad),
  easing: Easing.bezier(0.2, 0, 0, 1),
  themeEasing: Easing.inOut(Easing.quad),
} as const;
export const useNativeDriver = Platform.OS !== "web";

let reducedMotion = true;
const motionListeners = new Set<() => void>();
let motionSubscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
let motionVersion = 0;
function updateReducedMotion(value: boolean) {
  motionVersion += 1;
  reducedMotion = value;
  motionListeners.forEach((notify) => notify());
}
function subscribeMotion(listener: () => void) {
  motionListeners.add(listener);
  if (motionListeners.size === 1) {
    // RN Web 0.21 implements this with the prefers-reduced-motion media query.
    const version = motionVersion;
    motionSubscription = AccessibilityInfo.addEventListener("reduceMotionChanged", updateReducedMotion);
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (motionListeners.size && motionVersion === version) updateReducedMotion(value);
    }, () => {
      if (motionListeners.size && motionVersion === version) updateReducedMotion(true);
    });
  }
  return () => {
    motionListeners.delete(listener);
    if (!motionListeners.size) { motionSubscription?.remove(); motionSubscription = undefined; }
  };
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => reducedMotion, () => true);
}

export function usePressScale() {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => { value.stopAnimation(); value.setValue(1); }, [reduced, value]);
  useEffect(() => () => value.stopAnimation(), [value]);
  function animate(pressed: boolean) {
    value.stopAnimation();
    Animated.timing(value, {
      toValue: pressed ? (reduced ? 0.8 : 0.97) : 1,
      duration: motion.press, easing: motion.pressEasing, useNativeDriver,
    }).start();
  }
  return {
    style: reduced ? { opacity: value } : { transform: [{ scale: value }] },
    onPressIn: () => animate(true), onPressOut: () => animate(false),
  };
}

export type PressState = { pressed: boolean; focused?: boolean; hovered?: boolean };
export function focusRing(focused: boolean | undefined, color: string): ViewStyle {
  return Platform.OS === "web" && focused
    ? { outlineColor: color, outlineStyle: "solid", outlineWidth: 3, outlineOffset: 2 }
    : {};
}

export function ScalePressable({ style, onPressIn, onPressOut, ...props }: PressableProps) {
  const press = usePressScale();
  const state = props.accessibilityState;
  // RN Web 0.21 forwards ARIA aliases, not the native accessibilityState object.
  const webState = Platform.OS === "web" ? {
    "aria-busy": state?.busy, "aria-disabled": state?.disabled, "aria-selected": state?.selected,
    "aria-checked": state?.checked, "aria-expanded": state?.expanded,
  } : {};
  return React.createElement(Animated.View, { style: [{ minWidth: 0, maxWidth: "100%" }, press.style] },
    React.createElement(Pressable, {
      ...props, ...webState, style,
      onPressIn: (event) => { press.onPressIn(); onPressIn?.(event); },
      onPressOut: (event) => { press.onPressOut(); onPressOut?.(event); },
    }));
}

// Entrances identify the new screen without moving content during ordinary updates.
export function useScreenEntrance(key: string | number) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduced ? motion.reduced : motion.screen,
      easing: motion.easing, useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [key, reduced, progress]);
  return {
    opacity: progress,
    transform: [{ translateY: reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };
}
export function ScreenFade({ transitionKey, children, style }: {
  transitionKey: string | number; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const entrance = useScreenEntrance(transitionKey);
  return React.createElement(Animated.View, { style: [style, entrance] }, children);
}

const enteredLists = new Set<string>();
export function useListEntrance(listKey: string, count: number, ready = true) {
  const reduced = useReducedMotion();
  const values = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  useEffect(() => {
    if (!ready || count === 0 || enteredLists.has(listKey)) return;
    enteredLists.add(listKey);
    const items = values.slice(0, Math.min(count, 6));
    items.forEach((value) => value.setValue(0));
    const animations = items.map((value) => Animated.timing(value, {
      toValue: 1, duration: reduced ? motion.reduced : motion.screen,
      easing: motion.easing, useNativeDriver,
    }));
    const animation = reduced ? Animated.parallel(animations) : Animated.stagger(motion.stagger, animations);
    animation.start();
    return () => { animation.stop(); items.forEach((value) => value.setValue(1)); };
  }, [listKey, count, ready, reduced, values]);
  return (index: number) => {
    const value = values[index];
    return !value ? {} : {
      opacity: value,
      transform: [{ translateY: reduced ? 0 : value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
    };
  };
}

export function useDelayedLoading(active = true) {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setVisible(false); setSlow(false);
    if (!active) return;
    const show = setTimeout(() => setVisible(true), motion.spinnerDelay);
    const wait = setTimeout(() => setSlow(true), 3000);
    return () => { clearTimeout(show); clearTimeout(wait); };
  }, [active]);
  return { visible: active && visible, slow: active && slow };
}

export function StepTransition({ stepKey, children }: { stepKey: string | number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState({ key: stepKey, children });
  const latest = useRef({ key: stepKey, children });
  latest.current = { key: stepKey, children };
  const opacity = useRef(new Animated.Value(1)).current;
  const entry = useRef(new Animated.Value(1)).current;
  const previous = useRef(children);
  if (stepKey === shown.key) previous.current = children;
  useEffect(() => {
    if (stepKey === shown.key) return;
    const exit = Animated.timing(opacity, { toValue: 0, duration: motion.reduced, useNativeDriver });
    exit.start(({ finished }) => {
      if (!finished) return;
      entry.setValue(0);
      setShown(latest.current);
    });
    return () => exit.stop();
  }, [stepKey, shown.key, opacity, entry]);
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: reduced ? motion.reduced : motion.screen, easing: motion.easing, useNativeDriver }),
      Animated.timing(entry, { toValue: 1, duration: reduced ? motion.reduced : motion.screen, easing: motion.easing, useNativeDriver }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [shown.key, reduced, opacity, entry]);
  return React.createElement(Animated.View, { pointerEvents: stepKey === shown.key ? "auto" : "none", style: {
    opacity, transform: [{ translateX: reduced ? 0 : entry.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  } }, stepKey === shown.key ? children : previous.current);
}
