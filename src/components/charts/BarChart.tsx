import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from '../Text';

export type Bar = {
  key: string;
  label: string;
  value: number;
  /** Shown on the right of the row, e.g. "12 sets". */
  detail?: string;
  color?: string;
};

type BarChartProps = {
  bars: readonly Bar[];
  /** Overrides the scale; by default the biggest bar is full width. */
  max?: number;
  emptyMessage?: string;
};

/**
 * Horizontal bars, drawn with plain Views.
 *
 * No SVG here on purpose: a horizontal bar is a rectangle with a percentage
 * width, and doing it in layout rather than in a canvas means the labels wrap,
 * scale with the system font size and are readable by a screen reader.
 */
export function BarChart({ bars, max, emptyMessage = 'Nog geen gegevens.' }: BarChartProps) {
  const top = max ?? Math.max(0, ...bars.map((bar) => bar.value));

  if (bars.length === 0 || top <= 0) {
    return (
      <Text variant="caption" muted>
        {emptyMessage}
      </Text>
    );
  }

  return (
    <View style={styles.wrapper}>
      {bars.map((bar) => {
        const ratio = Math.min(1, Math.max(0, bar.value / top));

        return (
          <View
            key={bar.key}
            style={styles.row}
            accessibilityRole="progressbar"
            accessibilityLabel={`${bar.label}: ${bar.detail ?? bar.value}`}
            accessibilityValue={{ min: 0, max: top, now: bar.value }}
          >
            <View style={styles.labels}>
              <Text variant="label" style={styles.label} numberOfLines={1}>
                {bar.label}
              </Text>
              {bar.detail ? (
                <Text variant="caption" muted>
                  {bar.detail}
                </Text>
              ) : null}
            </View>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${ratio * 100}%`, backgroundColor: bar.color ?? colors.primary },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  row: { gap: spacing.xs },
  labels: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  label: { flex: 1 },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
