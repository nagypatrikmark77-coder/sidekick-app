import { Platform } from 'react-native';

// ── Brand Colors ──────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  background: '#0A0A0F',
  card: '#1A1A2E',
  border: '#2A2A4A',
  inputBg: '#1A1A2E',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',

  // Primary
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  secondary: '#1E3A5F',

  // Text
  textWhite: '#FFFFFF',
  textMuted: '#9CA3AF',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',

  // Accent
  purple: '#A855F7',
  pink: '#EC4899',
  cyan: '#06B6D4',
  orange: '#F97316',
} as const;

// ── Priority colors ───────────────────────────────────────────────────────────
export const PriorityColors = {
  high: Colors.error,
  medium: Colors.warning,
  low: Colors.success,
} as const;

// ── Preset color palette (habits, projects, tags) ─────────────────────────────
export const PresetColors = [
  Colors.primary,
  Colors.error,
  Colors.success,
  Colors.warning,
  Colors.purple,
  Colors.pink,
  Colors.cyan,
  Colors.orange,
] as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ── Border radii ──────────────────────────────────────────────────────────────
export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// ── Font sizes ────────────────────────────────────────────────────────────────
export const FontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  hero: 32,
} as const;

// ── Font weights (as literal strings for RN) ─────────────────────────────────
export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ── Platform fonts ────────────────────────────────────────────────────────────
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ── Common shadow (card elevation) ───────────────────────────────────────────
export const CardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 4,
} as const;

// ── Screen header safe-area padding ──────────────────────────────────────────
export const HEADER_PADDING_TOP = 60;
