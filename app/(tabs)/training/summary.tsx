import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { sessionMuscleSets, sessionScorableSets } from '@/features/training/activeSession';
import { MUSCLE_GROUP_LABELS } from '@/features/training/exerciseLibrary';
import { RECORD_LABELS } from '@/features/training/personalRecords';
import { formatDurationLong } from '@/features/training/restTimer';
import {
  clearFinishedSession,
  getFinishedSession,
  type FinishedSession,
} from '@/features/training/sessionSummary';
import { useExerciseMap } from '@/features/training/useExercises';
import { summariseSession, volumeByMuscle } from '@/features/training/volume';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * What you just did.
 *
 * Read once from the hand-off store and then kept in local state, so going
 * back and forth does not make the screen forget itself. The copy is factual:
 * numbers and records, no praise and no scolding.
 */
export default function SummaryScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session: authSession } = useAuth();
  const { map: exerciseMap } = useExerciseMap(authSession?.user.id ?? null);
  const [finished, setFinished] = useState<FinishedSession | null>(null);

  useEffect(() => {
    const value = getFinishedSession();
    if (value) {
      setFinished(value);
      clearFinishedSession();
    }
  }, []);

  if (!finished) {
    return (
      <Screen>
        <EmptyState
          icon="checkmark-done-outline"
          title="Niets om te tonen"
          description="Deze samenvatting is al gesloten."
          actionLabel="Naar training"
          onAction={() => router.replace('/(tabs)/training')}
        />
      </Screen>
    );
  }

  const { session, endedAtMs, brokenRecords, uploaded } = finished;

  const summary = summariseSession(
    session.exercises.map((exercise) => ({
      sets: sessionScorableSets({ ...session, exercises: [exercise] }),
    })),
  );
  const muscles = volumeByMuscle(sessionMuscleSets(session)).slice(0, 5);
  const durationSeconds = Math.max(0, Math.round((endedAtMs - session.startedAtMs) / 1000));

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={32} color={palette.textInverse} />
        </View>
        <Text variant="title">Sessie afgerond</Text>
        <Text muted>{session.name}</Text>
      </View>

      {!uploaded ? (
        <Card style={styles.card}>
          <Text variant="heading">Nog niet verstuurd</Text>
          <Text muted>
            Je training staat veilig op je telefoon en wordt vanzelf opgeslagen zodra je weer
            verbinding hebt.
          </Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.stats}>
          <Stat label="Duur" value={formatDurationLong(durationSeconds)} />
          <Stat label="Sets" value={String(summary.sets)} />
          <Stat label="Herhalingen" value={String(summary.reps)} />
          <Stat label="Volume" value={`${summary.volumeKg.toLocaleString('nl-NL')} kg`} />
        </View>
      </Card>

      {brokenRecords.length > 0 ? (
        <Card style={styles.card}>
          <Text variant="heading">
            {brokenRecords.length === 1 ? 'Je verbrak 1 record' : `Je verbrak ${brokenRecords.length} records`}
          </Text>
          {brokenRecords.map((record) => (
            <View key={`${record.exerciseId}-${record.kind}`} style={styles.record}>
              <Ionicons name="trophy-outline" size={18} color={palette.warning} />
              <View style={styles.flex}>
                <Text variant="label">
                  {exerciseMap.get(record.exerciseId)?.name ?? 'Oefening'}
                </Text>
                <Text variant="caption" muted>
                  {RECORD_LABELS[record.kind]}:{' '}
                  {record.kind === 'weight'
                    ? `${formatNumber(record.value)} kg × ${record.reps}`
                    : record.kind === 'volume'
                      ? `${record.value.toLocaleString('nl-NL')} kg`
                      : `${formatNumber(record.value)} kg`}
                  {record.previous === null
                    ? ' · eerste keer'
                    : ` · was ${formatNumber(record.previous)}`}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {muscles.length > 0 ? (
        <Card style={styles.card}>
          <Text variant="heading">Verdeling per spiergroep</Text>
          {muscles.map((entry) => (
            <View key={entry.muscle} style={styles.muscleRow}>
              <Text style={styles.flex}>{MUSCLE_GROUP_LABELS[entry.muscle]}</Text>
              <Text variant="caption" muted>
                {entry.sets} sets · {entry.volumeKg.toLocaleString('nl-NL')} kg
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {session.notes.trim() ? (
        <Card style={styles.card}>
          <Text variant="heading">Je notitie</Text>
          <Text muted>{session.notes.trim()}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button title="Klaar" onPress={() => router.replace('/(tabs)/training')} />
        <Button
          title="Naar je geschiedenis"
          variant="secondary"
          onPress={() => router.replace('/(tabs)/training/history')}
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

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.lg },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    marginBottom: spacing.sm,
  },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
  record: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
