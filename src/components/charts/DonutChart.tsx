import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { colors, radius as themeRadius, spacing } from '@/theme/theme';
import { Text } from '../Text';
import { arcPath } from './chartMath';

export type DonutSlice = {
  key: string;
  label: string;
  /** Any positive number; the slices are sized relative to each other. */
  value: number;
  color: string;
  /** Optional text under the label in the legend. */
  detail?: string;
};

type DonutChartProps = {
  slices: readonly DonutSlice[];
  size?: number;
  thickness?: number;
  /** Big number in the middle. */
  centerValue?: string;
  centerLabel?: string;
};

/**
 * A ring, not a pie: the hole in the middle is where the number that matters
 * goes, and a ring is easier to read than a pie at phone size.
 *
 * Drawn as stroked arcs rather than filled wedges -- one path per slice, no
 * seams between them, and the thickness is one property instead of maths.
 */
export function DonutChart({
  slices,
  size = 160,
  thickness = 22,
  centerValue,
  centerLabel,
}: DonutChartProps) {
  const total = slices.reduce((running, slice) => running + Math.max(0, slice.value), 0);
  const center = size / 2;
  const ringRadius = center - thickness / 2;

  let cursor = 0;

  return (
    <View style={styles.wrapper}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* The track, so an empty day still shows a ring instead of nothing. */}
          <Circle
            cx={center}
            cy={center}
            r={ringRadius}
            stroke={colors.background}
            strokeWidth={thickness}
            fill="none"
          />

          <G>
            {total > 0
              ? slices.map((slice) => {
                  const fraction = Math.max(0, slice.value) / total;
                  const path = arcPath(center, center, ringRadius, cursor, cursor + fraction);
                  cursor += fraction;

                  if (fraction <= 0) return null;
                  return (
                    <Path
                      key={slice.key}
                      d={path}
                      stroke={slice.color}
                      strokeWidth={thickness}
                      strokeLinecap="butt"
                      fill="none"
                    />
                  );
                })
              : null}
          </G>
        </Svg>

        {centerValue ? (
          <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
            <Text variant="heading">{centerValue}</Text>
            {centerLabel ? (
              <Text variant="caption" muted>
                {centerLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <View style={styles.legendText}>
              <Text variant="label">{slice.label}</Text>
              {slice.detail ? (
                <Text variant="caption" muted>
                  {slice.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: themeRadius.pill },
});
