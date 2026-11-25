import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from './theme';
import { motion, useNativeDriver, useReducedMotion } from './motion';

const logoMark = require('../assets/logo-mark.png');
const word = 'voybus'.split('');
const MARK = 64;
// Strong ease-out for entrances (Emil Kowalski's --ease-out); back-out gives the letters a small landing bounce.
const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
const landing = Easing.out(Easing.back(1.7));
// The launch is a once-per-open brand moment, so it is deliberately longer than UI motion (~2.4 s).
const INTRO_MS = 2000;

/**
 * Launch sequence: the Costa "V" springs in from a slight tilt while speed lines sweep behind it,
 * the "voybus" letters drop in one by one with a small landing bounce, the brand gives one soft pulse,
 * then zooms through and fades as the app takes over. If loading outlasts the intro the mark breathes
 * gently until ready. Reduced motion: a plain fade.
 */
export function Launch({ ready, onExit, onDone }: { ready: boolean; onExit: () => void; onDone: () => void }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const mark = useRef(new Animated.Value(0)).current;
  const speed = useRef(new Animated.Value(0)).current;
  const letters = useRef(word.map(() => new Animated.Value(0))).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const brandOut = useRef(new Animated.Value(0)).current;
  const backdropOut = useRef(new Animated.Value(0)).current;
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (reduced) {
      Animated.timing(mark, { toValue: 1, duration: motion.reduced, useNativeDriver }).start();
      letters.forEach((letter) => letter.setValue(1));
      const hold = setTimeout(() => setIntroDone(true), 600);
      return () => clearTimeout(hold);
    }
    const intro = Animated.parallel([
      Animated.spring(mark, { toValue: 1, friction: 5, tension: 70, useNativeDriver }),
      Animated.timing(speed, { toValue: 1, duration: 650, delay: 80, easing: easeOut, useNativeDriver }),
      Animated.stagger(70, letters.map((letter) =>
        Animated.timing(letter, { toValue: 1, duration: 460, delay: 420, easing: landing, useNativeDriver }))),
      Animated.sequence([
        Animated.delay(1350),
        Animated.timing(pulse, { toValue: 1.05, duration: 220, easing: easeOut, useNativeDriver }),
        Animated.timing(pulse, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      ]),
    ]);
    intro.start();
    const hold = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => { intro.stop(); clearTimeout(hold); };
    // Runs once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Still loading after the intro: the mark breathes instead of showing a progress bar.
  useEffect(() => {
    if (!introDone || ready || reduced) return;
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.94, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
    ]));
    breathe.start();
    return () => { breathe.stop(); pulse.setValue(1); };
  }, [introDone, ready, reduced, pulse]);

  // Soft hand-off in two overlapping beats: the brand settles back and fades, then the backdrop
  // dissolves while the app rises in underneath (onExit starts the app entrance at that moment).
  useEffect(() => {
    if (!ready || !introDone) return;
    if (reduced) {
      onExit();
      const fade = Animated.timing(backdropOut, { toValue: 1, duration: motion.reduced, useNativeDriver });
      fade.start(({ finished }) => { if (finished) onDone(); });
      return () => fade.stop();
    }
    const handoff = setTimeout(onExit, 90);
    const exit = Animated.parallel([
      Animated.timing(brandOut, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      Animated.timing(backdropOut, { toValue: 1, duration: 480, delay: 90, easing: Easing.inOut(Easing.quad), useNativeDriver }),
    ]);
    exit.start(({ finished }) => { if (finished) onDone(); });
    return () => { exit.stop(); clearTimeout(handoff); };
    // onExit/onDone are stable callbacks from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, introDone, reduced]);

  const backdrop = backdropOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const brandOpacity = brandOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const settleBack = brandOut.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const speedLine = (index: number) => ({
    position: 'absolute' as const, right: MARK * 0.55, height: 4, borderRadius: 2,
    width: 54 - index * 12, top: MARK * (0.3 + index * 0.18), backgroundColor: theme.action,
    opacity: speed.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55 - index * 0.12, 0] }),
    transform: [{ translateX: speed.interpolate({ inputRange: [0, 1], outputRange: [60, -50 - index * 14] }) }],
  });

  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel="VoyBus" accessibilityState={{ busy: !ready }}
      style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: theme.background, alignItems: 'center',
        justifyContent: 'center', opacity: backdrop }]}>
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: brandOpacity,
        transform: [{ scale: Animated.multiply(pulse, settleBack) }] }}>
        <View style={{ width: MARK * 1.17, height: MARK }}>
          {!reduced && [0, 1, 2].map((index) => <Animated.View key={index} style={speedLine(index)} />)}
          <Animated.Image source={logoMark} accessibilityIgnoresInvertColors style={{
            width: MARK * 1.17, height: MARK, tintColor: theme.action, opacity: mark.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
            transform: reduced ? [] : [
              { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              { rotate: mark.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) },
            ],
          }} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {word.map((letter, index) => (
            <Animated.Text key={index} style={{
              fontFamily: theme.fonts.bold, fontWeight: theme.fonts.bold ? undefined : '800', fontStyle: 'italic',
              fontSize: 50, letterSpacing: -2.5, color: theme.ink,
              opacity: letters[index]!.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
              transform: reduced ? [] : [
                { translateY: letters[index]!.interpolate({ inputRange: [0, 1], outputRange: [-36, 0] }) },
                { rotate: letters[index]!.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
              ],
            }}>{letter}</Animated.Text>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
