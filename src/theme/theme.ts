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
