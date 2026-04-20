/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

export const Colors = {
  background: "#0a0a0a",
  surface: "#1a1a1a",
  surfaceElevated: "#2a2a2a",

  primary: "#4ade80", // verde principal (como no Figma)
  primaryDark: "#22c55e",

  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",

  border: "#27272a",
  error: "#ef4444",
  warning: "#f59e0b",

  // Cores dos jogadores
  playerColors: {
    green: "#4ade80",
    orange: "#fb923c",
    blue: "#60a5fa",
    purple: "#c084fc",
    red: "#f87171",
    yellow: "#fbbf24",
    pink: "#f472b6",
    cyan: "#22d3ee",
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Typography = {
  title: { fontSize: 32, fontWeight: "bold" as const },
  heading: { fontSize: 24, fontWeight: "bold" as const },
  body: { fontSize: 16, fontWeight: "normal" as const },
  label: { fontSize: 14, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "normal" as const },
};

export const GameConfig = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  DEFAULT_DOLLS_PER_PLAYER: 2,
  CAPTURE_RADIUS_METERS: 10, // distância a que o boneco fica capturável
  PROXIMITY_ALERT_METERS: 20, // distância a que vibra
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
