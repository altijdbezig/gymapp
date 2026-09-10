import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';

type CardProps = ViewProps & { children: ReactNode };

/** A white surface with a border — the standard container for grouped content. */
export function Card({ children, style, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
