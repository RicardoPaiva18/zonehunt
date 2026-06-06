/**
 * Design tokens for ZoneHunt.
 * Colors, spacing, typography and game configuration in one place.
 */

export const Colors = {
  background: "#0a0a0a",
  surface: "#1a1a1a",
  surfaceElevated: "#2a2a2a",

  primary: "#4ade80",
  primaryDark: "#22c55e",

  text: "#ffffff",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",

  border: "#27272a",
  error: "#ef4444",
  warning: "#f59e0b",

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

export const LightColors = {
  background: "#ffffff",
  surface: "#f4f4f5",
  surfaceElevated: "#e4e4e7",

  primary: "#16a34a",
  primaryDark: "#15803d",

  text: "#09090b",
  textSecondary: "#52525b",
  textMuted: "#a1a1aa",

  border: "#e4e4e7",
  error: "#dc2626",
  warning: "#d97706",

  playerColors: {
    green: "#16a34a",
    orange: "#ea580c",
    blue: "#2563eb",
    purple: "#9333ea",
    red: "#dc2626",
    yellow: "#ca8a04",
    pink: "#db2777",
    cyan: "#0891b2",
  },
} as const;

// Tipo partilhado — garante que ambos os temas têm as mesmas chaves
export type AppColors = typeof Colors;

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
  CAPTURE_RADIUS_METERS: 10,
  PROXIMITY_ALERT_METERS: 20,
} as const;

export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0a' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#27272a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
];

export const lightMapStyle = [
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
];