import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { biggestContributors, macroSplit, perMealShare } from '@/features/nutrition/dayDetail';
import { sumEntries } from '@/features/nutrition/foodLog';
import { formatMicro, MICRO_LABELS, sumMicros, type MicroKey } from '@/features/nutrition/micros';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { formatDutchDate } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';

const MACRO_COLORS = {
  protein: colors.protein,
  fat: colors.fat,
  carbs: colors.carbs,
} as const;

/**
 * The day, broken down.
 *
 * Describes rather than judges: where the calories came from, how they were
 * spread over the meals, and what the four micronutrients added up to. No
 * colour coding of "good" and "bad" food, and no advice.
 */
export default function DayDetailScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day = date ?? todayIsoDate();

  const { session } = useAuth();
  const logQuery = useFoodLog(session?.user.id ?? null, day);

  const entries = logQuery.data ?? [];
  const totals = sumEntries(entries);
  const slices = macroSplit(totals);
  const meals = perMealShare(entries);
  const contributors = biggestContributors(entries);
  const micros = sumMicros(entries);

  return (
    <Screen>
      <ScreenHeader title="Dagdetail" subtitle={formatDutchDate(day)} />

      {logQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title="Niets gelogd op deze dag"
          description="Zodra je iets logt, laat dit scherm zien waar je calorieën vandaan kwamen."
        />
      ) : (
        <>
          <Card style={styles.card}>
            <Text variant="heading">Verdeling</Text>
            <DonutChart
              centerValue={String(totals.kcal)}
              centerLabel="kcal"
              slices={slices.map((slice) => ({
                key: slice.key,
                label: slice.label,
                value: slice.kcal,
                color: MACRO_COLORS[slice.key],
                detail: `${slice.grams} g · ${slice.percent}%`,
              }))}
            />
            <Text variant="caption" muted>
              De verdeling is op calorieën, niet op grammen: een gram vet levert ruim twee keer zo
              veel energie als een gram eiwit.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Per maaltijd</Text>
            <BarChart
              bars={meals.map((meal) => ({
                key: meal.mealType,
                label: meal.label,
                value: meal.totals.kcal,
                detail: `${meal.totals.kcal} kcal · ${meal.percent}%`,
              }))}
              emptyMessage="Nog niets gelogd vandaag."
            />
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Grootste bijdragers</Text>
            {contributors.map((contributor) => (
              <View key={contributor.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="label">{contributor.name}</Text>
                  {contributor.brand ? (
                    <Text variant="caption" muted>
                      {contributor.brand}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowValue}>
                  <Text variant="label">{contributor.kcal} kcal</Text>
                  <Text variant="caption" muted>
                    {contributor.percent}% van je dag
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Micronutriënten</Text>
            {(Object.keys(MICRO_LABELS) as MicroKey[]).map((key) => (
              <View key={key} style={styles.row}>
                <Text muted style={styles.flex}>
                  {MICRO_LABELS[key]}
                </Text>
                <Text variant="label">{formatMicro(key, micros[key])}</Text>
              </View>
            ))}
            <Text variant="caption" muted>
              &quot;Minstens&quot; betekent dat van een of meer producten deze waarde niet bekend
              is bij Open Food Facts. Het echte getal ligt dus hoger.
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowValue: { alignItems: 'flex-end' },
  flex: { flex: 1 },
});
