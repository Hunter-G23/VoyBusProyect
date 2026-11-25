import React from "react";
import { Animated, Text, View } from "react-native";
import { useTheme } from "./theme";
import { ScrollContext, useReducedMotion } from "./motion";

const coastHeroImage = require("../assets/coast-hero.png");

export function CoastHero({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = useTheme();
  const isDark = theme.scheme === "dark";
  const scroll = React.useContext(ScrollContext);
  const reduced = useReducedMotion();
  // Parallax: the coast drifts slower than the page, and stretches when an iOS pull-down overscrolls.
  const y = scroll && !reduced ? scroll.y : null;
  const imageMotion = y ? {
    transform: [
      { translateY: y.interpolate({ inputRange: [0, 160], outputRange: [0, 40], extrapolate: "clamp" }) },
      { scale: y.interpolate({ inputRange: [-140, 0], outputRange: [1.55, 1.2], extrapolate: "clamp" }) },
    ],
  } : null;
  const titleMotion = y ? {
    transform: [{ translateY: y.interpolate({ inputRange: [0, 160], outputRange: [0, 18], extrapolate: "clamp" }) }],
    opacity: y.interpolate({ inputRange: [0, 140], outputRange: [1, 0.35], extrapolate: "clamp" }),
  } : null;
  return (
    <View style={{
      position: "relative",
      minHeight: 106,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: isDark ? theme.paper : theme.surface,
      borderWidth: isDark ? 1 : 0,
      borderColor: theme.edge,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    }}>
      <Animated.Image
        source={coastHeroImage}
        resizeMode="cover"
        accessible={false}
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: isDark ? 0.22 : 1,
          ...imageMotion,
        }}
      />
      <Animated.View style={[{ maxWidth: "70%", gap: 3 }, titleMotion]}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: theme.fonts.bold,
            fontWeight: theme.fonts.bold ? undefined : "700",
            fontSize: 34,
            lineHeight: 38,
            letterSpacing: -0.8,
            color: theme.ink,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: theme.fonts.medium,
            fontSize: 13,
            lineHeight: 18,
            color: theme.muted,
          }}
        >
          {subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}
