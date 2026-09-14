/**
 * Design tokens: the single source of truth for colours, spacing and type.
 *
 * Components never hardcode a colour or a pixel value — they read it from here.
 * That way a restyle is one file, not fifty.
 */
export const colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E3E6EB',

  text: '#111827',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',

  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primaryMuted: '#DBEAFE',

  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',

  // Macro colours, reused by charts and rings later on.
  protein: '#2563EB',
  carbs: '#D97706',
  fat: '#7C3AED',
} as const;

/**
 * Superset markers. Exercises tied together get the same colour, so you can
 * see the pairing at a glance without reading a label. Six is plenty: nobody
 * runs seven supersets in one workout, and the list wraps around if they do.
 */
export const supersetColors = [
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#65A30D',
  '#EA580C',
  '#4F46E5',
] as const;

/** The colour for superset group 1..26, wrapping around. */
export function supersetColor(group: number): string {
  return supersetColors[(Math.max(1, group) - 1) % supersetColors.length];
}

/** A, B, C ... for superset group 1, 2, 3. */
export function supersetLabel(group: number): string {
  return String.fromCharCode(64 + Math.max(1, Math.min(26, group)));
}

/** 4-point scale: every gap in the app is one of these. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const theme = { colors, spacing, radius, typography } as const;
