import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { MUSCLE_GROUP_LABELS } from '@/features/training/exerciseLibrary';
import { formatDurationLong } from '@/features/training/restTimer';
import {
  sessionsPerMonth,
  sessionsPerWeek,
  summariseTraining,
  totalMuscleVolume,
  trainedExercises,
  weeklyMuscleVolume,
} from '@/features/training/stats';
import { useStats } from '@/features/training/useStats';
import { formatDutchDate, formatDutchDateShort } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

type Period = 'week' | 'month';

const PERIODS: readonly Segment<Period>[] = [
  { value: 'week', label: 'Per week' },
  { value: 'month', label: 'Per maand' },
];

/** How many periods the frequency chart shows. */
const PERIODS_SHOWN = 12;

/**
 * Your training in numbers.
 *
 * Three questions: how often do I train, which muscles am I actually working,
 * and how is each exercise going. The third one lives one tap away, per
 * exercise, because a chart of everything at once says nothing.
 */
export default function TrainingStatsScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const { sets, sessions, exerciseMap, isLoading, isError, refetch } = useStats(userId);
  const [period, setPeriod] = useState<Period>('week');

  const summary = summariseTraining(sessions, sets);
  const frequency = (period === 'week' ? sessionsPerWeek(sessions) : sessionsPerMonth(sessions))
    .slice(0, PERIODS_SHOWN)
    .reverse();

  const muscles = totalMuscleVolume(sets);
  const thisWeek = weeklyMuscleVolume(sets)[0];
  const exercises = trainedExercises(sets).slice(0, 20);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Statistieken" />
        <ActivityIndicator color={palette.primary} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <ScreenHeader title="Statistieken" />
        <Card style={styles.card}>
          <Text variant="heading">Niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button title="Opnieuw proberen" variant="secondary" onPress={() => refetch()} />
        </Card>
      </Screen>
    );
  }

  if (sessions.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Statistieken" />
        <EmptyState
          icon="stats-chart-outline"
          title="Nog geen sessies"
          description="Na een paar trainingen staan hier je grafieken: hoe vaak je traint, welke spiergroepen je raakt en hoe elke oefening loopt."
          actionLabel="Naar training"
          onAction={() => router.replace('/(tabs)/training')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Statistieken" subtitle="Alles uitgerekend uit je eigen sessies." />

      <Card style={styles.card}>
        <View style={styles.stats}>
          <Stat label="Sessies" value={String(summary.sessions)} />
          <Stat label="Per week" value={String(summary.averagePerWeek)} />
          <Stat
            label="Gemiddelde duur"
            value={
              summary.averageDurationSeconds === null
                ? '—'
                : formatDurationLong(summary.averageDurationSeconds)
            }
          />
          <Stat label="Totaal volume" value={`${summary.totalVolumeKg.toLocaleString('nl-NL')} kg`} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Hoe vaak je traint</Text>
        <SegmentedControl
          segments={PERIODS}
          value={period}
          onChange={setPeriod}
          label="Periode"
        />
        <LineChart
          labels={frequency.map((point) => formatDutchDateShort(point.periodStart))}
          series={[
            {
              label: period === 'week' ? 'Sessies per week' : 'Sessies per maand',
              values: frequency.map((point) => point.sessions),
              color: palette.primary,
            },
          ]}
          formatValue={(value) => String(Math.round(value))}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Volume per spiergroep</Text>
        <Text variant="caption" muted>
          Over je hele geschiedenis. Een spiergroep die een oefening als tweede spier raakt telt
          voor de helft mee.
        </Text>
        <BarChart
          bars={muscles.slice(0, 10).map((entry) => ({
            key: entry.muscle,
            label: MUSCLE_GROUP_LABELS[entry.muscle],
            value: entry.volumeKg,
            detail: `${entry.sets} sets · ${entry.volumeKg.toLocaleString('nl-NL')} kg`,
          }))}
        />
      </Card>

      {thisWeek ? (
        <Card style={styles.card}>
          <Text variant="heading">Deze week</Text>
          <Text variant="caption" muted>
            Week van {formatDutchDate(thisWeek.weekStart)}
          </Text>
          <BarChart
            bars={thisWeek.muscles.map((entry) => ({
              key: entry.muscle,
              label: MUSCLE_GROUP_LABELS[entry.muscle],
              value: entry.volumeKg,
              detail: `${entry.sets} sets`,
            }))}
            emptyMessage="Deze week nog niet getraind."
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="heading">Per oefening</Text>
        <Text variant="caption" muted>
          Tik op een oefening voor je geschatte 1RM, je zwaarste set en je volume over tijd.
        </Text>

        {exercises.map((entry) => (
          <Pressable
            key={entry.exerciseId}
            accessibilityRole="button"
            accessibilityLabel={`Statistieken van ${exerciseMap.get(entry.exerciseId)?.name ?? 'oefening'}`}
            onPress={() => router.push(`/(tabs)/training/exercise/${entry.exerciseId}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <Text variant="label">
                {exerciseMap.get(entry.exerciseId)?.name ?? 'Onbekende oefening'}
              </Text>
              <Text variant="caption" muted>
                {entry.sets} sets · laatst op {formatDutchDate(entry.lastPerformedOn)}
              </Text>
            </View>
          </Pressable>
        ))}
      </Card>

      <View style={styles.footer}>
        <Button
          title="Je records"
          variant="secondary"
          onPress={() => router.push('/(tabs)/training/records')}
        />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  footer: { marginBottom: spacing.xl },
});
