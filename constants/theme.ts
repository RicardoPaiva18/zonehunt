/**
 * Design tokens for ZoneHunt.
 * Colors, spacing, typography and game configuration in one place.
 */

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