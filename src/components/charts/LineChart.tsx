import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';
import { Text } from '../Text';
import { axisTicks, buildScale, linePath, type Series } from './chartMath';

type LineChartProps = {
  /** One label per x position, e.g. a date. */
  labels: readonly string[];
  series: readonly Series[];
  height?: number;
  /** Shown under the chart; the place for "dit is een gemiddelde" notes. */
  caption?: string;
  /** Formats the value in the y-axis labels. */
  formatValue?: (value: number) => string;
  emptyMessage?: string;
};

/**
 * A line chart that measures itself.
 *
 * React Native gives no width until layout has happened, so the SVG is only
 * drawn once onLayout has reported one. That is also what makes the chart fit
 * both a phone and a wide browser window without a hardcoded width.
 */
export function LineChart({
  labels,
  series,
  height = 180,
  caption,
  formatValue = (value) => String(Math.round(value)),
  emptyMessage = 'Nog niet genoeg gegevens voor een grafiek.',
}: LineChartProps) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const hasData = series.some((entry) =>
    entry.values.some((value) => value !== null && Number.isFinite(value)),
  );

  function handleLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  if (!hasData) {
    return (
      <View style={styles.empty}>
        <Text variant="caption" muted>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  // Room on the left for the y labels and underneath for the x labels.
  const paddingLeft = 44;
  const paddingBottom = 20;
  const plotWidth = Math.max(0, width - paddingLeft - spacing.sm);
  const plotHeight = height - paddingBottom;

  const scale = buildScale(series, labels.length, plotWidth, plotHeight);
  const ticks = axisTicks(labels.length);

  return (
    <View style={styles.wrapper} onLayout={handleLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* Three horizontal guides: bottom, middle, top. */}
          {[0, 0.5, 1].map((fraction) => {
            const value = scale.min + (scale.max - scale.min) * fraction;
            const y = scale.y(value);
            return (
              <Line
                key={fraction}
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + plotWidth}
                y2={y}
                stroke={palette.border}
                strokeWidth={1}
              />
            );
          })}

          {series.map((entry) => (
            <Path
              key={entry.label}
              d={shift(linePath(entry.values, scale), paddingLeft)}
              stroke={entry.color}
              strokeWidth={entry.dashed ? 2 : 2.5}
              strokeDasharray={entry.dashed ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          ))}

          {/* A dot on the newest point of every solid line. */}
          {series
            .filter((entry) => !entry.dashed)
            .map((entry) => {
              const lastIndex = lastFilledIndex(entry.values);
              if (lastIndex === -1) return null;

              return (
                <Circle
                  key={`dot-${entry.label}`}
                  cx={paddingLeft + scale.x(lastIndex)}
                  cy={scale.y(entry.values[lastIndex] as number)}
                  r={4}
                  fill={entry.color}
                />
              );
            })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      {/* The axis labels are Text, not SVG text: they inherit the app font and
          respect the system text size, which SVG text does not. */}
      {width > 0 ? (
        <>
          <View style={[styles.yLabels, { height: plotHeight }]} pointerEvents="none">
            <Text variant="caption" muted>
              {formatValue(scale.max)}
            </Text>
            <Text variant="caption" muted>
              {formatValue(scale.min)}
            </Text>
          </View>

          <View style={styles.xLabels}>
            {ticks.map((index) => (
              <Text key={index} variant="caption" muted>
                {labels[index]}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.legend}>
        {series.map((entry) => (
          <View key={entry.label} style={styles.legendRow}>
            <View
              style={[
                styles.legendDash,
                { backgroundColor: entry.color },
                entry.dashed && styles.legendDashed,
              ]}
            />
            <Text variant="caption" muted>
              {entry.label}
            </Text>
          </View>
        ))}
      </View>

      {caption ? (
        <Text variant="caption" muted style={styles.caption}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Moves a path right by the width of the y-axis labels. */
function shift(path: string, dx: number): string {
  return path.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_match, command, x, y) => {
    return `${command}${Number(x) + dx} ${y}`;
  });
}

function lastFilledIndex(values: readonly (number | null)[]): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && Number.isFinite(value)) return index;
  }
  return -1;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: { gap: spacing.xs },
  empty: { paddingVertical: spacing.lg, alignItems: 'center' },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    justifyContent: 'space-between',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 44,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDash: { width: 16, height: 3, borderRadius: radius.pill },
  legendDashed: { opacity: 0.6 },
  caption: { marginTop: spacing.xs },
});
