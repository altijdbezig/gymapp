/**
 * Design tokens: the single source of truth for colours, spacing and type.
 *
 * Components never hardcode a colour or a pixel value — they read it from here.
 * That way a restyle is one file, not fifty.
 *
 * Since phase 9 there are two palettes. They have exactly the same keys, so a
 * component picks one up from useTheme() and nothing else about it changes.
 * `colors` is still exported as the light palette: it is what a StyleSheet at
 * module level gets, which is fine for everything that is the same in both
 * themes (accents, the danger red) and is the fallback before the provider has
 * read the stored preference.
 */

/** Every colour the app uses. Both palettes implement all of it. */
export type Palette = {
  background: string;
  surface: string;
  border: string;

  text: string;
  textMuted: string;
  textInverse: string;

  primary: string;
  primaryPressed: string;
  primaryMuted: string;

  success: string;
  warning: string;
  danger: string;

  protein: string;
  carbs: string;
  fat: string;

  /** Tint behind a completed set row. */
  successMuted: string;
};

export const lightColors: Palette = {
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

  successMuted: '#F0FDF4',
};

/**
 * The dark palette.
 *
 * Not an inversion: a pure black background with pure white text is harsh to
 * read for long, so the surfaces are dark grey and the text is slightly off
 * white. Every accent was lightened until it clears 4.5:1 against the surface
 * it sits on -- the blue that reads well on white is too dark on charcoal.
 */
export const darkColors: Palette = {
  background: '#0F1115',
  surface: '#181B21',
  border: '#2A2F38',

  text: '#F3F4F6',
  textMuted: '#9BA3AF',
  textInverse: '#0F1115',

  primary: '#60A5FA',
  primaryPressed: '#93C5FD',
  primaryMuted: '#1E293B',

  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',

  protein: '#60A5FA',
  carbs: '#FBBF24',
  fat: '#A78BFA',

  successMuted: '#14251A',
};

/** The light palette, and the default for anything outside the provider. */
export const colors = lightColors;

export const palettes = { light: lightColors, dark: darkColors } as const;

export type ColorScheme = keyof typeof palettes;

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

/**
 * Superset markers. Exercises tied together get the same colour, so you can
 * see the pairing at a glance without reading a label. Six is plenty: nobody
 * runs seven supersets in one workout, and the list wraps around if they do.
 *
 * These are the same in both themes: they sit on their own coloured badge with
 * white text, so they do not have to contrast with the page.
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
