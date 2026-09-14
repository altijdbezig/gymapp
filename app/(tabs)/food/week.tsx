import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupByWeek, relativeWeekLabel } from '@/features/nutrition/weekSummary';
import { toDayTotals, useFoodHistory } from '@/features/nutrition/useFoodExtras';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { formatDutchDateShort } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** How many weeks the list shows. Three months is what the history query holds. */
const WEEKS_SHOWN = 12;

/**
 * Calories and protein per week.
 *
 * Averages are over the days you actually logged, and the number of those days
 * is shown next to every week so you can see for yourself how much the average
 * is worth. A week with three logged days is not a week of eating 1400 kcal.
 */
export default function WeekOverviewScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const historyQuery = useFoodHistory(userId);
  const targetsQuery = useTodaysTargets(userId);

  const days = toDayTotals(historyQuery.data ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const weeks = groupByWeek(days).slice(0, WEEKS_SHOWN);

  // The chart runs left to right in time, so it needs the oldest week first.
  const chartWeeks = [...weeks].reverse();
  const target = targetsQuery.data;

  return (
    <Screen>
      <ScreenHeader
        title="Weekoverzicht"
        subtitle="Gemiddelden per week, over de dagen die je hebt gelogd."
      />

      {historyQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : weeks.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Nog geen weken om te tonen"
          description="Log een paar dagen, dan verschijnt hier vanzelf een overzicht per week."
        />
      ) : (
        <>
          <Card style={styles.card}>
            <Text variant="heading">Calorieën per week</Text>
            <LineChart
              labels={chartWeeks.map((week) => formatDutchDateShort(week.weekStart))}
              series={[
                {
                  label: 'Gemiddeld per dag',
                  values: chartWeeks.map((week) => week.averageKcal),
                  color: palette.primary,
                },
                ...(target
                  ? [
                      {
                        label: 'Je huidige doel',
                        values: chartWeeks.map(() => target.kcal),
                        color: palette.textMuted,
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              formatValue={(value) => `${Math.round(value)}`}
            />
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Eiwit per week</Text>
            <LineChart
              labels={chartWeeks.map((week) => formatDutchDateShort(week.weekStart))}
              series={[
                {
                  label: 'Gemiddeld per dag',
                  values: chartWeeks.map((week) => week.averageProteinG),
                  color: palette.protein,
                },
                ...(target
                  ? [
                      {
                        label: 'Je huidige doel',
                        values: chartWeeks.map(() => target.protein_g),
                        color: palette.textMuted,
                        dashed: true,
                      },
                    ]
                  : []),
              ]}
              formatValue={(value) => `${Math.round(value)} g`}
            />
          </Card>

          {weeks.map((week) => (
            <Card key={week.weekStart} style={styles.weekCard}>
              <View style={styles.rowBetween}>
                <Text variant="label">{relativeWeekLabel(week.weekStart, todayIsoDate())}</Text>
                <Text variant="caption" muted>
                  {week.daysLogged} {week.daysLogged === 1 ? 'dag' : 'dagen'} gelogd
                </Text>
              </View>
              <Text variant="caption" muted>
                Gemiddeld {week.averageKcal} kcal en {week.averageProteinG} g eiwit per gelogde dag
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  weekCard: { gap: spacing.xs, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
