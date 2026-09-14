import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/theme';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** Optional colour for the dot in front of the label (superset markers). */
  dotColor?: string;
};

/** A small tappable pill. Used for filters and for short single choices. */
export function Chip({ label, selected = false, onPress, dotColor }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.chipPressed,
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A horizontally scrolling row of chips.
 *
 * Horizontal rather than wrapping, because there are eighteen muscle groups and
 * a wrapping row of those would push the search results off the screen.
 */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipPressed: { backgroundColor: colors.background },
  label: { ...typography.label, color: colors.text },
  labelSelected: { color: colors.primary },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
});
