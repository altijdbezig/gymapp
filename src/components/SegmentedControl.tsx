import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, typography, type Palette } from '@/theme/theme';
import { Text } from './Text';

export type Segment<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Screen-reader name for the whole group. */
  label: string;
};

/**
 * A row of tabs inside a screen.
 *
 * Not a navigator: these switch what one screen shows, so making them routes
 * would put four almost identical URLs in the history and a back button that
 * walks through tabs. It scrolls horizontally, so four Dutch labels still fit
 * on a narrow phone.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={label}>
        {segments.map((segment) => {
          const isSelected = segment.value === value;

          return (
            <Pressable
              key={segment.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(segment.value)}
              style={({ pressed }) => [
                styles.segment,
                isSelected && styles.segmentSelected,
                pressed && !isSelected && styles.segmentPressed,
              ]}
            >
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {segment.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  scroll: { paddingVertical: spacing.xs },
  track: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.surface },
  segmentPressed: { opacity: 0.6 },
  label: { ...typography.label, color: colors.textMuted },
  labelSelected: { color: colors.primary },
});
