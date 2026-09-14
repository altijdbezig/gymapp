import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { toWeightPoints, useBodyWeights, useLogWeight } from '@/features/nutrition/useWeight';
import {
  formatKg,
  formatTrendChange,
  summariseTrend,
  withMovingAverage,
  TREND_EXPLANATION,
} from '@/features/nutrition/weightTrend';
import { parseWeight } from '@/features/onboarding/parseFormInput';
import { formatDutchDate, formatDutchDateShort } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** How many weigh-ins the chart shows. */
const CHART_POINTS = 60;

/**
 * Weighing yourself, and what it means.
 *
 * The chart draws both lines: your actual weigh-ins and the 7-day average. The
 * raw line jumps around and the average does not, which is the point -- the
 * explanation under the chart says so in one sentence.
 *
 * A new weight recalculates today's targets and nothing before it.
 */
export default function WeightScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const weightsQuery = useBodyWeights(userId);
  const targetsQuery = useTodaysTargets(userId);
  const logWeight = useLogWeight();

  const [weight, setWeight] = useState('');
  const [weightError, setWeightError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const points = toWeightPoints(weightsQuery.data ?? []);
  const trend = withMovingAverage(points).slice(-CHART_POINTS);
  const summary = summariseTrend(points);

  async function handleSave() {
    if (!userId || logWeight.isPending) return;

    const parsed = parseWeight(weight);
    if (parsed.value === undefined) {
      setWeightError(parsed.error);
      return;
    }

    setWeightError(undefined);
    setFormError(undefined);

    try {
      await logWeight.mutateAsync({ userId, weightKg: parsed.value });
      setWeight('');
      setSaved(true);
    } catch {
      setFormError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Gewicht" subtitle="Wegen en je trend volgen." />

      <Card style={styles.card}>
        <Input
          label="Gewicht vandaag in kg"
          value={weight}
          onChangeText={(value) => {
            setWeight(value);
            setSaved(false);
          }}
          error={weightError}
          hint="Een komma mag: 82,5."
          placeholder="82,5"
          keyboardType="decimal-pad"
          editable={!logWeight.isPending}
        />

        <Button title="Opslaan" onPress={handleSave} loading={logWeight.isPending} />

        {saved ? (
          <Text variant="caption" style={styles.success}>
            Opgeslagen. Je dagdoelen zijn vanaf vandaag opnieuw berekend; eerdere dagen blijven
            zoals ze waren.
          </Text>
        ) : null}

        {formError ? (
          <Text variant="caption" style={styles.error}>
            {formError}
          </Text>
        ) : null}
      </Card>

      {weightsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : points.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Nog geen wegingen"
          description="Weeg jezelf een paar keer per week, het liefst op hetzelfde moment van de dag. Na een week kan de app een trend laten zien."
        />
      ) : (
        <>
          <Card style={styles.card}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryValue}>
                <Text variant="caption" muted>
                  Laatste weging
                </Text>
                <Text variant="heading">
                  {summary.latestKg === null ? '—' : `${formatKg(summary.latestKg)} kg`}
                </Text>
              </View>
              <View style={styles.summaryValue}>
                <Text variant="caption" muted>
                  Gemiddelde over 7 dagen
                </Text>
                <Text variant="heading">
                  {summary.averageKg === null ? '—' : `${formatKg(summary.averageKg)} kg`}
                </Text>
              </View>
            </View>

            <Text muted>{formatTrendChange(summary)}</Text>
          </Card>

          <Card style={styles.card}>
            <Text variant="heading">Verloop</Text>
            <LineChart
              labels={trend.map((point) => formatDutchDateShort(point.date))}
              series={[
                {
                  label: 'Weging',
                  values: trend.map((point) => point.weightKg),
                  color: palette.border,
                },
                {
                  label: 'Gemiddelde over 7 dagen',
                  values: trend.map((point) => point.averageKg),
                  color: palette.primary,
                  dashed: true,
                },
              ]}
              formatValue={(value) => `${formatKg(value)}`}
              caption={TREND_EXPLANATION}
            />
          </Card>

          {targetsQuery.data ? (
            <Card style={styles.card}>
              <Text variant="heading">Je doel vandaag</Text>
              <Text muted>
                {targetsQuery.data.kcal} kcal en {targetsQuery.data.protein_g} g eiwit, berekend met
                een gewicht van {formatKg(Number(targetsQuery.data.weight_kg))} kg.
              </Text>
            </Card>
          ) : null}

          <Card style={styles.card}>
            <Text variant="heading">Laatste wegingen</Text>
            {[...points]
              .reverse()
              .slice(0, 10)
              .map((point) => (
                <View key={point.date} style={styles.row}>
                  <Text muted style={styles.flex}>
                    {formatDutchDate(point.date)}
                  </Text>
                  <Text variant="label">{formatKg(point.weightKg)} kg</Text>
                </View>
              ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryValue: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  success: { color: colors.success },
  error: { color: colors.danger },
});
