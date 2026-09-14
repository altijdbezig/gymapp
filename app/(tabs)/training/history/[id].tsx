import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { estimateOneRepMax } from '@/features/training/oneRepMax';
import { formatDurationLong } from '@/features/training/restTimer';
import { useExerciseMap } from '@/features/training/useExercises';
import {
  useDeleteSession,
  useSessionDetail,
  type SetLog,
} from '@/features/training/useSessions';
import { isScoringSet, totalReps } from '@/features/training/volume';
import { formatDutchDate } from '@/lib/date';
import { colors, spacing } from '@/theme/theme';

const SET_TYPE_SUFFIX: Record<SetLog['set_type'], string> = {
  normal: '',
  warmup: ' · warming-up',
  drop: ' · drop set',
  failure: ' · tot falen',
};

/** One session from your history, set by set, with a way to repeat it. */
export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session: authSession } = useAuth();
  const userId = authSession?.user.id ?? null;

  const detailQuery = useSessionDetail(id ?? null);
  const { map: exerciseMap } = useExerciseMap(userId);
  const deleteSession = useDeleteSession(userId);

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Sessie" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const session = detailQuery.data;

  if (!session) {
    return (
      <Screen>
        <ScreenHeader title="Sessie" />
        <EmptyState
          icon="alert-circle-outline"
          title="Sessie niet gevonden"
          description="Deze sessie bestaat niet meer."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  // The sets come back ordered by exercise_order, so grouping keeps the order
  // the workout actually had.
  const groups: { exerciseId: string; order: number; sets: SetLog[] }[] = [];
  for (const set of session.sets) {
    const last = groups[groups.length - 1];
    if (last && last.order === set.exercise_order && last.exerciseId === set.exercise_id) {
      last.sets.push(set);
    } else {
      groups.push({ exerciseId: set.exercise_id, order: set.exercise_order, sets: [set] });
    }
  }

  return (
    <Screen>
      <ScreenHeader title={session.name} subtitle={formatDutchDate(session.performed_on)} />

      <Card style={styles.card}>
        <View style={styles.stats}>
          <Stat label="Duur" value={formatDurationLong(session.duration_seconds ?? 0)} />
          <Stat label="Sets" value={String(session.scoringSets)} />
          <Stat
            label="Herhalingen"
            value={String(
              totalReps(
                session.sets.map((set) => ({
                  setType: set.set_type,
                  reps: set.reps,
                  weightKg: set.weight_kg,
                  isCompleted: set.is_completed,
                })),
              ),
            )}
          />
          <Stat label="Volume" value={`${session.volumeKg.toLocaleString('nl-NL')} kg`} />
        </View>
      </Card>

      {session.notes ? (
        <Card style={styles.card}>
          <Text variant="heading">Notitie</Text>
          <Text muted>{session.notes}</Text>
        </Card>
      ) : null}

      {groups.map((group) => (
        <Card key={`${group.exerciseId}-${group.order}`} style={styles.card}>
          <Text variant="heading">
            {exerciseMap.get(group.exerciseId)?.name ?? 'Onbekende oefening'}
          </Text>

          {group.sets.map((set) => {
            const scoring = isScoringSet({
              setType: set.set_type,
              reps: set.reps,
              weightKg: set.weight_kg,
              isCompleted: set.is_completed,
            });
            const oneRm = scoring ? estimateOneRepMax(set.weight_kg ?? 0, set.reps ?? 0) : 0;

            return (
              <View key={set.id} style={styles.setRow}>
                <Text variant="label" style={styles.setIndex}>
                  {set.set_index}
                </Text>
                <Text style={styles.flex}>
                  {describeSet(set)}
                  <Text muted>{SET_TYPE_SUFFIX[set.set_type]}</Text>
                </Text>
                {oneRm > 0 ? (
                  <Text variant="caption" muted>
                    ~{formatNumber(oneRm)} kg 1RM
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Card>
      ))}

      <View style={styles.actions}>
        <Button
          title="Nog een keer doen"
          onPress={() => router.push(`/(tabs)/training/session?repeat=${session.id}`)}
        />
        <Button
          title="Sessie verwijderen"
          variant="secondary"
          onPress={() => setConfirmDelete(true)}
        />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Sessie verwijderen?"
        message="Deze sessie en alle sets erin worden verwijderd. Dit kan niet ongedaan worden gemaakt."
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteSession.mutateAsync(session.id);
          router.replace('/(tabs)/training/history');
        }}
      />
    </Screen>
  );
}

function describeSet(set: SetLog): string {
  if (set.duration_seconds !== null || set.distance_m !== null) {
    const parts: string[] = [];
    if (set.duration_seconds !== null) parts.push(formatDurationLong(set.duration_seconds));
    if (set.distance_m !== null) parts.push(`${formatNumber(set.distance_m)} km`);
    return parts.join(' · ');
  }

  const reps = set.reps ?? 0;
  if (set.weight_kg === null || set.weight_kg === 0) return `${reps} herhalingen`;
  return `${reps} × ${formatNumber(set.weight_kg)} kg`;
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

function formatNumber(value: number): string {
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setIndex: { width: 24, color: colors.textMuted },
  flex: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
