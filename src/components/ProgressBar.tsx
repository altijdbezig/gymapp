import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme/theme';
import { Text } from './Text';

type ProgressBarProps = {
  label: string;
  eaten: number;
  target: number;
  /** 0 to 1, already clamped by buildProgress. */
  ratio: number;
  isOver: boolean;
  unit: 'kcal' | 'g';
  color: string;
};

/**
 * One "eaten of target" bar. Going over turns the bar amber rather than red:
 * eating more than planned is worth noticing, not a failure.
 */
export function ProgressBar({
  label,
  eaten,
  target,
  ratio,
  isOver,
  unit,
  color,
}: ProgressBarProps) {
  const remaining = Math.max(0, target - eaten);

  return (
    <View
      style={styles.wrapper}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: target, now: eaten }}
      accessibilityLabel={`${label}: ${eaten} van ${target} ${unit}`}
    >
      <View style={styles.header}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" muted>
          {eaten} / {target} {unit}
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            // Percentages keep the bar correct at any screen width.
            { width: `${ratio * 100}%`, backgroundColor: isOver ? colors.warning : color },
          ]}
        />
      </View>

      <Text variant="caption" muted>
        {isOver
          ? `${eaten - target} ${unit} over je doel`
          : remaining === 0
            ? 'Precies op je doel'
            : `Nog ${remaining} ${unit}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
