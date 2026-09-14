import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExercisePicker } from '@/features/training/ExercisePicker';
import { PlateCalculatorSheet } from '@/features/training/PlateCalculatorSheet';
import {
  formatPreviousSet,
  hasAnyCompletedSet,
  previousSetFor,
  toNumber,
  type ActiveExercise,
  type ActiveSet,
  type ExercisePick,
} from '@/features/training/activeSession';
import { isCardio, usesBarbell, type Exercise } from '@/features/training/exerciseLibrary';
import {
  elapsedSeconds,
  formatDuration,
  formatRest,
  remainingSeconds,
  REST_PRESETS_SECONDS,
} from '@/features/training/restTimer';
import {
  cancelRestNotification,
  ensureNotificationPermission,
  scheduleRestFinished,
} from '@/features/notifications/localNotifications';
import { useActiveSession, useTicker } from '@/features/training/useActiveSession';
import { useExerciseMap } from '@/features/training/useExercises';
import { useRoutines } from '@/features/training/useRoutines';
import {
  useFinishSession,
  usePreviousPerformance,
  useSessionDetail,
  useSessionHistory,
} from '@/features/training/useSessions';
import { buildComebackExercises, type PreviousExercise } from '@/features/training/comeback';
import { isScoringSet } from '@/features/training/volume';
import { setFinishedSession } from '@/features/training/sessionSummary';
import { summariseSession, type SetType } from '@/features/training/volume';
import { colors, radius, spacing, supersetColor, supersetLabel, typography } from '@/theme/theme';

const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'Normaal',
  warmup: 'Warming-up',
  drop: 'Drop set',
  failure: 'Tot falen',
};

/** Warm-ups get a W, drop sets a D, failure an F; a normal set keeps its number. */
function setBadge(set: ActiveSet, index: number): string {
  if (set.setType === 'warmup') return 'W';
  if (set.setType === 'drop') return 'D';
  if (set.setType === 'failure') return 'F';
  return String(index + 1);
}

export default function SessionScreen() {
  const { dayId, mode, repeat } = useLocalSearchParams<{
    dayId?: string;
    mode?: string;
    repeat?: string;
  }>();

  const { session: authSession } = useAuth();
  const userId = authSession?.user.id ?? null;

  const {
    session,
    isRestoring,
    dispatch,
    start,
    clear,
    restTimer,
    startRest,
    stopRest,
  } = useActiveSession();

  const routinesQuery = useRoutines(userId);
  const { map: exerciseMap } = useExerciseMap(userId);
  const previousQuery = usePreviousPerformance(userId);
  // Only fetched when you asked to repeat an old session.
  const repeatQuery = useSessionDetail(repeat ?? null);
  // The comeback session is built from your most recent finished workout.
  const lastSessionQuery = useSessionHistory(mode === 'comeback' ? userId : null, 1);
  const finishSession = useFinishSession();
  const picker = useExercisePicker();

  const [setTypeTarget, setSetTypeTarget] = useState<{ exerciseKey: string; set: ActiveSet } | null>(
    null,
  );
  const [restTarget, setRestTarget] = useState<ActiveExercise | null>(null);
  const [plateTarget, setPlateTarget] = useState<{ name: string; weightKg: number | null } | null>(
    null,
  );
  const [noteTarget, setNoteTarget] = useState<ActiveExercise | null>(null);
  const [isFinishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const now = useTicker(!!session);
  const hasStarted = useRef(false);

  // Starting a session from a routine, or empty. Only once, and only when
  // nothing was already running -- resuming must never overwrite your workout.
  useEffect(() => {
    if (isRestoring || session || hasStarted.current || !userId) return;

    if (mode === 'empty') {
      hasStarted.current = true;
      start({ userId, name: 'Losse training' });
      return;
    }

    // The comeback: the same exercises as last time at about 60% of the sets.
    // Nothing about eating is touched here, in either direction.
    if (mode === 'comeback') {
      const last = (lastSessionQuery.data ?? [])[0];
      if (!last) return;

      const perExercise = new Map<string, PreviousExercise>();
      for (const set of last.sets) {
        if (
          !isScoringSet({
            setType: set.set_type,
            reps: set.reps,
            weightKg: set.weight_kg,
            isCompleted: set.is_completed,
          })
        ) {
          continue;
        }

        const exercise = exerciseMap.get(set.exercise_id);
        const current = perExercise.get(set.exercise_id);

        perExercise.set(set.exercise_id, {
          exerciseId: set.exercise_id,
          name: exercise?.name ?? 'Oefening',
          category: exercise?.category ?? 'other',
          primaryMuscle: exercise?.primary_muscle ?? 'full_body',
          secondaryMuscles: exercise?.secondary_muscles ?? [],
          sets: (current?.sets ?? 0) + 1,
        });
      }

      hasStarted.current = true;
      start({
        userId,
        name: `${last.name} (comeback)`.slice(0, 80),
        workoutDayId: last.workout_day_id,
        isComeback: true,
        exercises: buildComebackExercises([...perExercise.values()]),
      });
      return;
    }

    // "Nog een keer doen": rebuild the workout from an old session, with the
    // same exercises and the same number of sets, but empty fields. The old
    // numbers show up as the "vorige" placeholder anyway.
    if (repeat) {
      const old = repeatQuery.data;
      if (!old) return;

      const byExercise = new Map<string, number>();
      for (const set of old.sets) {
        const key = `${set.exercise_order}:${set.exercise_id}`;
        byExercise.set(key, (byExercise.get(key) ?? 0) + 1);
      }

      hasStarted.current = true;
      start({
        userId,
        name: old.name,
        workoutDayId: old.workout_day_id,
        exercises: [...byExercise.entries()].map(([key, count]) => {
          const exerciseId = key.slice(key.indexOf(':') + 1);
          const exercise = exerciseMap.get(exerciseId);
          return {
            exerciseId,
            name: exercise?.name ?? 'Oefening',
            category: exercise?.category ?? 'other',
            primaryMuscle: exercise?.primary_muscle ?? 'full_body',
            secondaryMuscles: exercise?.secondary_muscles ?? [],
            targetSets: count,
          };
        }),
      });
      return;
    }

    if (!dayId) return;
    if (routinesQuery.isLoading) return;

    const found = (routinesQuery.data ?? [])
      .flatMap((routine) => routine.days.map((day) => ({ routine, day })))
      .find((entry) => entry.day.id === dayId);

    if (!found) return;

    hasStarted.current = true;
    start({
      userId,
      name: found.routine.name,
      workoutDayId: found.day.id,
      exercises: found.day.exercises.map<ExercisePick>((entry) => ({
        exerciseId: entry.exercise_id,
        name: entry.exercise?.name ?? 'Oefening',
        category: entry.exercise?.category ?? 'other',
        primaryMuscle: entry.exercise?.primary_muscle ?? 'full_body',
        secondaryMuscles: entry.exercise?.secondary_muscles ?? [],
        restSeconds: entry.rest_seconds,
        supersetGroup: entry.superset_group,
        note: entry.note ?? '',
        targetSets: entry.target_sets,
      })),
    });
  }, [
    dayId,
    mode,
    repeat,
    repeatQuery.data,
    lastSessionQuery.data,
    isRestoring,
    session,
    userId,
    exerciseMap,
    routinesQuery.data,
    routinesQuery.isLoading,
    start,
  ]);

  // Ask for notification permission once a workout is actually running, so the
  // rest timer can reach you with the app in your pocket. Asking here rather
  // than at sign-up means the prompt arrives when the reason for it is obvious.
  useEffect(() => {
    if (!session) return;
    void ensureNotificationPermission();
  }, [session]);

  // A finished rest timer clears itself, so the bar disappears on its own.
  useEffect(() => {
    if (restTimer && remainingSeconds(restTimer, now) === 0) {
      stopRest();
    }
  }, [restTimer, now, stopRest]);

  function addExercises(picked: Exercise[]) {
    dispatch({
      type: 'add-exercises',
      picks: picked.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        primaryMuscle: exercise.primary_muscle,
        secondaryMuscles: exercise.secondary_muscles,
      })),
    });
  }

  function toggleSet(exercise: ActiveExercise, set: ActiveSet) {
    dispatch({ type: 'toggle-set', exerciseKey: exercise.key, setKey: set.key });

    // Ticking a set off starts the rest; unticking it stops it again.
    if (!set.isCompleted) {
      if (exercise.restSeconds > 0 && set.setType !== 'warmup') {
        startRest(exercise.key, exercise.restSeconds);
        void scheduleRestFinished(exercise.restSeconds, exercise.name);
      }
    } else {
      stopRest();
      void cancelRestNotification();
    }
  }

  async function handleFinish() {
    if (!session) return;

    setFinishing(true);
    const endedAtMs = Date.now();

    const result = await finishSession.mutateAsync({ session, endedAtMs });

    setFinishedSession({
      session,
      endedAtMs,
      brokenRecords: result.brokenRecords,
      uploaded: result.uploaded,
    });

    await clear();
    void cancelRestNotification();
    setFinishing(false);
    router.replace('/(tabs)/training/summary');
  }

  if (isRestoring) {
    return (
      <Screen>
        <Text muted>Je training wordt geladen…</Text>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <EmptyState
          icon="barbell-outline"
          title="Geen training bezig"
          description="Start een routine of een lege workout vanaf het trainingsscherm."
          actionLabel="Terug naar training"
          onAction={() => router.replace('/(tabs)/training')}
        />
      </Screen>
    );
  }

  const summary = summariseSession(
    session.exercises.map((exercise) => ({
      sets: exercise.sets.map((set) => ({
        setType: set.setType,
        reps: toNumber(set.reps),
        weightKg: toNumber(set.weightKg),
        isCompleted: set.isCompleted,
      })),
    })),
  );

  const previous = previousQuery.data ?? {};

  return (
    <Screen>
      {/* Sessietimer */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Terug naar training"
          onPress={() => router.push('/(tabs)/training')}
          hitSlop={spacing.sm}
        >
          <Ionicons name="chevron-down" size={26} color={colors.primary} />
        </Pressable>

        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1}>
            {session.name}
          </Text>
          <Text variant="caption" muted>
            {formatDuration(elapsedSeconds(session.startedAtMs, now))} · {summary.sets} sets ·{' '}
            {summary.volumeKg.toLocaleString('nl-NL')} kg
          </Text>
        </View>

        <Button
          title="Klaar"
          loading={isFinishing}
          disabled={!hasAnyCompletedSet(session)}
          onPress={handleFinish}
        />
      </View>

      {/* Rusttimer */}
      {restTimer ? (
        <Card style={styles.restCard}>
          <View style={styles.flex}>
            <Text variant="label" style={styles.restLabel}>
              Rust
            </Text>
            <Text variant="caption" muted>
              Nog {formatDuration(remainingSeconds(restTimer, now))}
            </Text>
          </View>
          <Button
            title="Overslaan"
            variant="secondary"
            onPress={() => {
              stopRest();
              void cancelRestNotification();
            }}
          />
        </Card>
      ) : null}

      {session.exercises.length === 0 ? (
        <EmptyState
          icon="add-circle-outline"
          title="Nog geen oefeningen"
          description="Voeg toe wat je gaat doen. Je kan onderweg altijd meer toevoegen."
          actionLabel="Oefening toevoegen"
          onAction={() => picker.open({ subtitle: session.name, onPick: addExercises })}
        />
      ) : (
        session.exercises.map((exercise) => (
          <ExerciseBlock
            key={exercise.key}
            exercise={exercise}
            previous={previous}
            now={now}
            onToggleSet={(set) => toggleSet(exercise, set)}
            onChangeSet={(set, patch) =>
              dispatch({ type: 'update-set', exerciseKey: exercise.key, setKey: set.key, patch })
            }
            onAddSet={() => dispatch({ type: 'add-set', exerciseKey: exercise.key })}
            onRemoveSet={(set) =>
              dispatch({ type: 'remove-set', exerciseKey: exercise.key, setKey: set.key })
            }
            onRemove={() => dispatch({ type: 'remove-exercise', exerciseKey: exercise.key })}
            onMove={(direction) =>
              dispatch({ type: 'move-exercise', exerciseKey: exercise.key, direction })
            }
            onEditSetType={(set) => setSetTypeTarget({ exerciseKey: exercise.key, set })}
            onEditRest={() => setRestTarget(exercise)}
            onEditNote={() => setNoteTarget(exercise)}
            onOpenPlates={(weightKg) => setPlateTarget({ name: exercise.name, weightKg })}
            instructions={exerciseMap.get(exercise.exerciseId)?.instructions ?? null}
          />
        ))
      )}

      <View style={styles.actions}>
        <Button
          title="Oefening toevoegen"
          variant="secondary"
          onPress={() => picker.open({ subtitle: session.name, onPick: addExercises })}
        />

        <Input
          label="Notitie bij deze training"
          value={session.notes}
          onChangeText={(value) => dispatch({ type: 'set-notes', notes: value })}
          placeholder="Optioneel"
          multiline
        />

        <Button
          title="Training weggooien"
          variant="secondary"
          onPress={() => setConfirmDiscard(true)}
        />
      </View>

      {/* Set-type */}
      <Sheet
        visible={!!setTypeTarget}
        title="Soort set"
        onClose={() => setSetTypeTarget(null)}
      >
        <Text muted>
          Een warming-up telt niet mee voor je volume en kan geen record worden.
        </Text>
        {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((type) => (
          <Button
            key={type}
            title={SET_TYPE_LABELS[type]}
            variant={setTypeTarget?.set.setType === type ? 'primary' : 'secondary'}
            onPress={() => {
              if (setTypeTarget) {
                dispatch({
                  type: 'update-set',
                  exerciseKey: setTypeTarget.exerciseKey,
                  setKey: setTypeTarget.set.key,
                  patch: { setType: type },
                });
              }
              setSetTypeTarget(null);
            }}
          />
        ))}
      </Sheet>

      {/* Rusttijd */}
      <Sheet visible={!!restTarget} title="Rusttijd" onClose={() => setRestTarget(null)}>
        <Text muted>Geldt voor {restTarget?.name} in deze training.</Text>
        <ChipRow>
          {REST_PRESETS_SECONDS.map((seconds) => (
            <Chip
              key={seconds}
              label={formatRest(seconds)}
              selected={restTarget?.restSeconds === seconds}
              onPress={() => {
                if (restTarget) {
                  dispatch({
                    type: 'set-rest',
                    exerciseKey: restTarget.key,
                    restSeconds: seconds,
                  });
                }
                setRestTarget(null);
              }}
            />
          ))}
        </ChipRow>
      </Sheet>

      {/* Notitie per oefening */}
      <Sheet visible={!!noteTarget} title="Notitie" onClose={() => setNoteTarget(null)}>
        <Input
          label={noteTarget?.name ?? 'Notitie'}
          value={noteTarget?.note ?? ''}
          onChangeText={(value) => {
            if (!noteTarget) return;
            dispatch({ type: 'set-exercise-note', exerciseKey: noteTarget.key, note: value });
            setNoteTarget({ ...noteTarget, note: value });
          }}
          placeholder="Bijvoorbeeld: volgende keer 2,5 kg erbij"
          multiline
        />
        <Button title="Klaar" onPress={() => setNoteTarget(null)} />
      </Sheet>

      <PlateCalculatorSheet
        visible={!!plateTarget}
        targetKg={plateTarget?.weightKg ?? null}
        exerciseName={plateTarget?.name ?? ''}
        onClose={() => setPlateTarget(null)}
      />

      <ConfirmDialog
        visible={confirmDiscard}
        title="Training weggooien?"
        message="Alles wat je hebt ingevuld gaat verloren. Dit kan niet ongedaan worden gemaakt."
        confirmLabel="Weggooien"
        destructive
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={async () => {
          setConfirmDiscard(false);
          await clear();
          void cancelRestNotification();
          router.replace('/(tabs)/training');
        }}
      />
    </Screen>
  );
}

function ExerciseBlock({
  exercise,
  previous,
  now,
  instructions,
  onToggleSet,
  onChangeSet,
  onAddSet,
  onRemoveSet,
  onRemove,
  onMove,
  onEditSetType,
  onEditRest,
  onEditNote,
  onOpenPlates,
}: {
  exercise: ActiveExercise;
  previous: Record<string, { setIndex: number; reps: number | null; weightKg: number | null }[]>;
  now: number;
  instructions: string | null;
  onToggleSet: (set: ActiveSet) => void;
  onChangeSet: (set: ActiveSet, patch: Partial<ActiveSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (set: ActiveSet) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onEditSetType: (set: ActiveSet) => void;
  onEditRest: () => void;
  onEditNote: () => void;
  onOpenPlates: (weightKg: number | null) => void;
}) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const cardio = isCardio(exercise);

  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        {exercise.supersetGroup !== null ? (
          <View
            style={[styles.supersetTag, { backgroundColor: supersetColor(exercise.supersetGroup) }]}
          >
            <Text style={styles.supersetTagLabel}>{supersetLabel(exercise.supersetGroup)}</Text>
          </View>
        ) : null}

        <View style={styles.flex}>
          <Text variant="label">{exercise.name}</Text>
          <Text variant="caption" muted>
            Rust {formatRest(exercise.restSeconds)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Opties voor ${exercise.name}`}
          onPress={() => setMenuOpen(true)}
          hitSlop={spacing.sm}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {exercise.note ? (
        <Text variant="caption" style={styles.note}>
          {exercise.note}
        </Text>
      ) : null}

      {instructions ? (
        <Text variant="caption" muted>
          {instructions}
        </Text>
      ) : null}

      <View style={styles.setsHeader}>
        <Text variant="caption" muted style={styles.colSet}>
          Set
        </Text>
        <Text variant="caption" muted style={styles.colPrevious}>
          Vorige
        </Text>
        <Text variant="caption" muted style={styles.colInput}>
          {cardio ? 'Min' : 'Kg'}
        </Text>
        <Text variant="caption" muted style={styles.colInput}>
          {cardio ? 'Km' : 'Reps'}
        </Text>
        <View style={styles.colCheck} />
      </View>

      {exercise.sets.map((set, index) => (
        <SetRow
          key={set.key}
          set={set}
          badge={setBadge(set, index)}
          cardio={cardio}
          previousLabel={formatPreviousSet(
            previousSetFor(previous, exercise.exerciseId, index + 1),
          )}
          onToggle={() => onToggleSet(set)}
          onChange={(patch) => onChangeSet(set, patch)}
          onEditType={() => onEditSetType(set)}
          onLongPressRemove={() => onRemoveSet(set)}
        />
      ))}

      <View style={styles.setActions}>
        <Button title="Set toevoegen" variant="secondary" onPress={onAddSet} />
        {usesBarbell(exercise) ? (
          <Button
            title="Schijven"
            variant="secondary"
            onPress={() => {
              const lastWeight = [...exercise.sets]
                .reverse()
                .map((set) => toNumber(set.weightKg))
                .find((value) => value !== null);
              onOpenPlates(lastWeight ?? null);
            }}
          />
        ) : null}
      </View>

      <Sheet visible={isMenuOpen} title={exercise.name} onClose={() => setMenuOpen(false)}>
        <Button
          title="Rusttijd aanpassen"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            onEditRest();
          }}
        />
        <Button
          title="Notitie"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            onEditNote();
          }}
        />
        <Button
          title="Naar boven"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            onMove('up');
          }}
        />
        <Button
          title="Naar beneden"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            onMove('down');
          }}
        />
        <Button
          title="Oefening verwijderen"
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            onRemove();
          }}
        />
      </Sheet>
    </Card>
  );
}

function SetRow({
  set,
  badge,
  cardio,
  previousLabel,
  onToggle,
  onChange,
  onEditType,
  onLongPressRemove,
}: {
  set: ActiveSet;
  badge: string;
  cardio: boolean;
  previousLabel: string | null;
  onToggle: () => void;
  onChange: (patch: Partial<ActiveSet>) => void;
  onEditType: () => void;
  onLongPressRemove: () => void;
}) {
  return (
    <View style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Soort set aanpassen, nu ${badge}`}
        onPress={onEditType}
        onLongPress={onLongPressRemove}
        style={styles.colSet}
      >
        <View style={[styles.badge, set.setType !== 'normal' && styles.badgeSpecial]}>
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      </Pressable>

      <Text variant="caption" muted style={styles.colPrevious} numberOfLines={1}>
        {previousLabel ?? '—'}
      </Text>

      <TextInput
        style={[styles.input, styles.colInput]}
        value={cardio ? set.durationSeconds : set.weightKg}
        onChangeText={(value) =>
          onChange(cardio ? { durationSeconds: value } : { weightKg: value })
        }
        keyboardType="decimal-pad"
        placeholder={cardio ? 'min' : 'kg'}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={cardio ? 'Minuten' : 'Gewicht in kilo'}
      />

      <TextInput
        style={[styles.input, styles.colInput]}
        value={cardio ? set.distanceM : set.reps}
        onChangeText={(value) => onChange(cardio ? { distanceM: value } : { reps: value })}
        keyboardType={cardio ? 'decimal-pad' : 'number-pad'}
        placeholder={cardio ? 'km' : 'reps'}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={cardio ? 'Afstand in kilometer' : 'Herhalingen'}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.isCompleted }}
        accessibilityLabel="Set afvinken"
        onPress={onToggle}
        style={styles.colCheck}
      >
        <Ionicons
          name={set.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={set.isCompleted ? colors.success : colors.border}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  flex: { flex: 1 },
  restCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  restLabel: { color: colors.primary },
  exerciseCard: { gap: spacing.sm, marginBottom: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  supersetTag: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  supersetTagLabel: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
  note: { color: colors.primary },
  setsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  setRowDone: { backgroundColor: '#F0FDF4' },
  colSet: { width: 40, alignItems: 'center' },
  colPrevious: { flex: 1 },
  colInput: { width: 64 },
  colCheck: { width: 40, alignItems: 'center' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  badgeSpecial: { backgroundColor: colors.primaryMuted },
  badgeLabel: { ...typography.label, color: colors.text },
  input: {
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    ...typography.body,
    color: colors.text,
  },
  setActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actions: { gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.xl },
});
