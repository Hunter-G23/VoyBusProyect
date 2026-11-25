import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo, Animated, Easing, Platform, Pressable, View,
  type PressableProps, type StyleProp, type ViewStyle,
} from "react-native";

export const motion = {
  press: 120, fast: 160, base: 200, theme: 220, stagger: 40,
  spinnerDelay: 300, screen: 180, reduced: 120,
  pressEasing: Easing.out(Easing.quad),
  easing: Easing.bezier(0.2, 0, 0, 1),
  themeEasing: Easing.inOut(Easing.quad),
  // Bottom sheet settle: iOS-like drawer curve.
  sheet: 320, sheetEasing: Easing.bezier(0.32, 0.72, 0, 1),
  // App content entering after the launch sequence (see Launch.tsx).
  appIn: 450,
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
    return () => { animation.stop(); progress.setValue(1); };
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

export function useFadeSlideEntrance(key: string | null, offsetY: number) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useLayoutEffect(() => {
    if (key === null) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduced ? motion.reduced : motion.fast,
      easing: motion.easing, useNativeDriver,
    });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [key, progress, reduced]);
  return {
    opacity: progress,
    transform: [{ translateY: reduced ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [offsetY, 0] }) }],
  };
}

/**
 * Staggered entrance for the first six rows of a list, each time the list's screen mounts
 * (data refreshes on the same screen do not replay it).
 */
export function useListEntrance(listKey: string, count: number, ready = true) {
  const reduced = useReducedMotion();
  const values = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const entered = useRef(new Set<string>()).current;
  useEffect(() => {
    if (!ready || count === 0 || entered.has(listKey)) return;
    entered.add(listKey);
    const items = values.slice(0, Math.min(count, 6));
    items.forEach((value) => value.setValue(0));
    const animations = items.map((value) => Animated.timing(value, {
      toValue: 1, duration: reduced ? motion.reduced : 360,
      easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver,
    }));
    const animation = reduced ? Animated.parallel(animations) : Animated.stagger(55, animations);
    animation.start();
    return () => { animation.stop(); items.forEach((value) => value.setValue(1)); };
  }, [listKey, count, ready, reduced, values, entered]);
  return (index: number) => {
    const value = values[index];
    return !value ? {} : {
      opacity: value,
      transform: reduced ? [] : [
        { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
        { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
      ],
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
      if (!finished) { opacity.setValue(1); return; }
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

/** Scroll position of the screen's main ScrollView, shared with scroll-driven effects inside it. */
export type ScrollState = {
  y: Animated.Value;
  viewport: number;
  offset: React.RefObject<number>;
  content: React.RefObject<React.ComponentRef<typeof View> | null>;
};
export const ScrollContext = React.createContext<ScrollState | null>(null);

const revealEase = Easing.bezier(0.23, 1, 0.32, 1);
// Items that enter together (one scroll gesture) cascade 60 ms apart instead of popping at once.
let burstAt = 0;
let burstCount = 0;
function burstDelay() {
  const now = Date.now();
  burstCount = now - burstAt < 180 ? burstCount + 1 : 0;
  burstAt = now;
  return Math.min(burstCount, 5) * 60;
}

/**
 * Scroll reveal: content below the fold waits hidden and, when scrolling brings it within the
 * viewport, rises 40 px and fades in (520 ms, strong ease-out). Plays once per mount.
 * Content already on screen renders as is, so list entrances above the fold are untouched.
 */
export function ScrollReveal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scroll = React.useContext(ScrollContext);
  const reduced = useReducedMotion();
  const self = useRef<React.ComponentRef<typeof View>>(null);
  const progress = useRef(new Animated.Value(1)).current;
  const top = useRef<number | undefined>(undefined);
  const state = useRef<'unknown' | 'waiting' | 'shown'>('unknown');
  const viewport = scroll?.viewport ?? 0;
  const reveal = useCallback((offset: number) => {
    if (state.current !== 'waiting' || top.current === undefined || viewport <= 0) return;
    if (top.current > offset + viewport - 40) return;
    state.current = 'shown';
    Animated.timing(progress, {
      toValue: 1, duration: 520, delay: burstDelay(), easing: revealEase, useNativeDriver, isInteraction: false,
    }).start();
  }, [progress, viewport]);
  const measure = useCallback(() => {
    const content = scroll?.content.current;
    if (reduced || !content || !self.current || state.current === 'shown') return;
    self.current.measureLayout(content, (_x, y) => {
      top.current = y;
      if (state.current === 'unknown') {
        const offset = scroll?.offset.current ?? 0;
        if (viewport > 0 && y > offset + viewport - 40) { state.current = 'waiting'; progress.setValue(0); }
        else state.current = 'shown';
      }
      reveal(scroll?.offset.current ?? 0);
    }, () => {});
  }, [scroll, reduced, viewport, progress, reveal]);
  useEffect(() => {
    if (!scroll || reduced) return;
    const listener = scroll.y.addListener(({ value }) => reveal(value));
    return () => scroll.y.removeListener(listener);
  }, [scroll, reduced, reveal]);
  // A reduced-motion change mid-way must never leave content hidden.
  useEffect(() => { if (reduced) { state.current = 'shown'; progress.setValue(1); } }, [reduced, progress]);
  return React.createElement(Animated.View, { ref: self, onLayout: measure, style: [style, {
    opacity: progress,
    // Translate only: scaling would shrink 48 pt touch targets while they wait below the fold.
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
  }] }, children);
}
