import { useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import { kgToDisplay } from '@/features/settings/units';
import { toDayTotals, useFoodHistory } from '@/features/nutrition/useFoodExtras';
import { toWeightPoints, useBodyWeights } from '@/features/nutrition/useWeight';
import { withMovingAverage } from '@/features/nutrition/weightTrend';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { addDays, formatDutchDateShort } from '@/lib/date';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

type Range = 30 | 60 | 90;

const RANGES: readonly Segment<string>[] = [
  { value: '30', label: '30 dagen' },
  { value: '60', label: '60 dagen' },
  { value: '90', label: '90 dagen' },
];

/**
 * Calories, macros and weight on the same time axis.
 *
 * The two belong together: what the scale does over a month is the result of
 * what you ate over that month. Both are drawn as the 7-day average, because
 * the day-to-day numbers of either are mostly noise.
 *
 * The screen describes; it does not tell you what to change.
 */
export default function TrendsScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const unit = profileQuery.data?.unit_weight ?? 'kg';
  const historyQuery = useFoodHistory(userId);
  const weightsQuery = useBodyWeights(userId);
  const targetsQuery = useTodaysTargets(userId);

  const [range, setRange] = useState<Range>(30);

  const today = todayIsoDate();
  const from = addDays(today, -(range - 1));

  // One label per day in the range, so the food line and the weight line line
  // up even though they are logged on different days.
  const days = Array.from({ length: range }, (_unused, index) => addDays(from, index));

  const totalsByDate = new Map(
    toDayTotals(historyQuery.data ?? []).map((day) => [day.date, day]),
  );
  const weightByDate = new Map(
    withMovingAverage(toWeightPoints(weightsQuery.data ?? [])).map((point) => [
      point.date,
      point,
    ]),
  );

  const kcal = days.map((date) => totalsByDate.get(date)?.kcal ?? null);
  const protein = days.map((date) => totalsByDate.get(date)?.proteinG ?? null);
  const weightAverage = days.map((date) => weightByDate.get(date)?.averageKg ?? null);

  const hasFood = kcal.some((value) => value !== null);
  const hasWeight = weightAverage.some((value) => value !== null);
  const target = targetsQuery.data;

  const isLoading = historyQuery.isLoading || weightsQuery.isLoading;

  return (
    <Screen>
      <ScreenHeader
        title="Trends"
        subtitle="Wat je eet en wat de weegschaal doet, op dezelfde tijdlijn."
      />

      <SegmentedControl
        segments={RANGES}
        value={String(range)}
        onChange={(value) => setRange(Number(value) as Range)}
        label="Periode"
      />

      {isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : !hasFood && !hasWeight ? (
        <EmptyState
          icon="analytics-outline"
          title="Nog niets om te tonen"
          description="Log een paar dagen en weeg jezelf een paar keer, dan verschijnt hier het verband tussen die twee."
        />
      ) : (
        <>
          <Card style={styles.card}>
            <Text variant="heading">Calorieën</Text>
            <LineChart
              labels={days.map(formatDutchDateShort)}
              series={[
                { label: 'Per dag', values: kcal, color: palette.primary },
                ...(target
                  ? [
                      {
                        label: 'Je doel',
                        values: days.map(() => target.kcal),
                        color: palette.textMuted,
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              formatValue={(value) => String(Math.round(value))}
              emptyMessage="Nog geen dagen gelogd in deze periode."
            />
            <Text variant="caption" muted>
              Een gat in de lijn is een dag die je niet hebt gelogd. Die dagen worden niet als nul
              geteld.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Eiwit</Text>
            <LineChart
              labels={days.map(formatDutchDateShort)}
              series={[
                { label: 'Per dag', values: protein, color: palette.protein },
                ...(target
                  ? [
                      {
                        label: 'Je doel',
                        values: days.map(() => target.protein_g),
                        color: palette.textMuted,
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              formatValue={(value) => `${Math.round(value)} g`}
              emptyMessage="Nog geen dagen gelogd in deze periode."
            />
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Gewicht</Text>
            <LineChart
              labels={days.map(formatDutchDateShort)}
              series={[
                {
                  label: `Gemiddelde over 7 dagen (${unit})`,
                  values: weightAverage.map((value) =>
                    value === null ? null : kgToDisplay(value, unit),
                  ),
                  color: palette.fat,
                },
              ]}
              formatValue={(value) => `${(Math.round(value * 10) / 10).toString().replace('.', ',')}`}
              emptyMessage="Nog niet genoeg wegingen voor een trend."
            />
            <Text variant="caption" muted>
              Dit is het voortschrijdend gemiddelde, niet je losse wegingen. Wat de weegschaal van
              dag tot dag doet is vooral vocht.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
});
