import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';

type CardProps = ViewProps & { children: ReactNode };

/** A white surface with a border — the standard container for grouped content. */
export function Card({ children, style, ...rest }: CardProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
