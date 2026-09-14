import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { LineChart } from '@/components/charts/LineChart';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { exerciseSubtitle } from '@/features/training/exerciseLibrary';
import { exerciseProgress } from '@/features/training/stats';
import { useStats } from '@/features/training/useStats';
import { formatDutchDate, formatDutchDateShort } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';

type Metric = 'oneRm' | 'heaviest' | 'volume';

const METRICS: readonly Segment<Metric>[] = [
  { value: 'oneRm', label: 'Geschatte 1RM' },
  { value: 'heaviest', label: 'Zwaarste set' },
  { value: 'volume', label: 'Volume' },
];

/** How many sessions the chart shows. */
const POINTS_SHOWN = 40;

/**
 * One exercise over time.
 *
 * Three lines, one at a time: your estimated one-rep max, the heaviest set you
 * actually did, and the volume per session. The estimate is the one to watch --
 * it is what makes a heavy triple and a set of ten comparable.
 */
export default function ExerciseStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const { sets, exerciseMap, isLoading } = useStats(userId);
  const [metric, setMetric] = useState<Metric>('oneRm');

  const exercise = id ? exerciseMap.get(id) : undefined;
  const points = id ? exerciseProgress(sets, id).slice(-POINTS_SHOWN) : [];

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Oefening" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (points.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={exercise?.name ?? 'Oefening'} />
        <EmptyState
          icon="stats-chart-outline"
          title="Nog geen sessies met deze oefening"
          description="Zodra je hem een keer hebt gedaan, verschijnt hier je verloop."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const newest = points[points.length - 1];
  const oldest = points[0];

  const values: Record<Metric, number[]> = {
    oneRm: points.map((point) => point.estimated1rmKg),
    heaviest: points.map((point) => point.heaviestKg),
    volume: points.map((point) => point.volumeKg),
  };

  const unit = metric === 'volume' ? 'kg volume' : 'kg';
  const change = values[metric][values[metric].length - 1] - values[metric][0];

  return (
    <Screen>
      <ScreenHeader
        title={exercise?.name ?? 'Oefening'}
        subtitle={exercise ? exerciseSubtitle(exercise) : undefined}
      />

      <Card style={styles.card}>
        <SegmentedControl segments={METRICS} value={metric} onChange={setMetric} label="Wat wil je zien?" />

        <LineChart
          labels={points.map((point) => formatDutchDateShort(point.date))}
          series={[
            {
              label: METRICS.find((entry) => entry.value === metric)!.label,
              values: values[metric],
              color: colors.primary,
            },
          ]}
          formatValue={(value) => `${Math.round(value)}`}
        />

        <Text variant="caption" muted>
          {points.length === 1
            ? 'Eén sessie tot nu toe. Na een tweede kan de app een verloop laten zien.'
            : `${formatChange(change)} ${unit} sinds ${formatDutchDate(oldest.date)}.`}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Laatste sessie</Text>
        <Text variant="caption" muted>
          {formatDutchDate(newest.date)}
        </Text>

        <View style={styles.stats}>
          <Stat label="Geschatte 1RM" value={`${newest.estimated1rmKg} kg`} />
          <Stat label="Zwaarste set" value={`${newest.heaviestKg} kg`} />
          <Stat label="Volume" value={`${newest.volumeKg.toLocaleString('nl-NL')} kg`} />
          <Stat label="Sets" value={String(newest.sets)} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Alle sessies</Text>
        {[...points].reverse().map((point) => (
          <View key={point.date + point.volumeKg} style={styles.row}>
            <Text muted style={styles.flex}>
              {formatDutchDate(point.date)}
            </Text>
            <Text variant="caption" muted>
              {point.sets} sets · {point.heaviestKg} kg · ~{point.estimated1rmKg} kg 1RM
            </Text>
          </View>
        ))}
      </Card>

      <Text variant="caption" muted style={styles.footnote}>
        De geschatte 1RM komt uit de formule van Epley: gewicht × (1 + herhalingen / 30). Boven de
        twaalf herhalingen wordt die schatting optimistisch.
      </Text>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

/** "+12" or "-3", with a Dutch decimal comma. */
function formatChange(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = String(Math.abs(rounded)).replace('.', ',');
  if (rounded === 0) return '0';
  return rounded > 0 ? `+${text}` : `−${text}`;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footnote: { marginBottom: spacing.xl },
});
