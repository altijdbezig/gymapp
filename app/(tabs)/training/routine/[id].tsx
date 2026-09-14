import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExercisePicker } from '@/features/training/ExercisePicker';
import { exerciseSubtitle, type Exercise } from '@/features/training/exerciseLibrary';
import { formatRest, REST_PRESETS_SECONDS } from '@/features/training/restTimer';
import { useExerciseMap } from '@/features/training/useExercises';
import {
  useRoutineFolders,
  useRoutines,
  useSaveRoutine,
  type RoutineExerciseDraft,
} from '@/features/training/useRoutines';
import { createId } from '@/lib/id';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, supersetColor, supersetLabel, type Palette } from '@/theme/theme';

/**
 * The routine editor.
 *
 * `id` is "new" for a routine that does not exist yet, which keeps creating and
 * editing one screen instead of two nearly identical ones.
 */
export default function RoutineEditorScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const routinesQuery = useRoutines(userId);
  const foldersQuery = useRoutineFolders(userId);
  const { map: exerciseMap } = useExerciseMap(userId);
  const saveRoutine = useSaveRoutine();
  const picker = useExercisePicker();

  const existing = useMemo(
    () => (isNew ? null : (routinesQuery.data ?? []).find((routine) => routine.id === id) ?? null),
    [routinesQuery.data, id, isNew],
  );

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<RoutineExerciseDraft[]>([]);
  const [isLoaded, setIsLoaded] = useState(isNew);
  const [error, setError] = useState<string>();
  const [restSheetFor, setRestSheetFor] = useState<string | null>(null);
  const [supersetSheetFor, setSupersetSheetFor] = useState<string | null>(null);

  // Fill the form once the routine arrives. Guarded by isLoaded so a background
  // refetch never throws away what the user is typing.
  useEffect(() => {
    if (isLoaded || !existing) return;

    setName(existing.name);
    setNotes(existing.notes ?? '');
    setFolderId(existing.folder_id);
    setExercises(
      (existing.days[0]?.exercises ?? []).map((entry) => ({
        id: entry.id,
        exerciseId: entry.exercise_id,
        targetSets: entry.target_sets,
        repMin: entry.rep_min,
        repMax: entry.rep_max,
        restSeconds: entry.rest_seconds,
        supersetGroup: entry.superset_group,
        note: entry.note ?? '',
      })),
    );
    setIsLoaded(true);
  }, [existing, isLoaded]);

  function addExercises(picked: Exercise[]) {
    setExercises((current) => [
      ...current,
      ...picked.map((exercise) => ({
        id: createId(),
        exerciseId: exercise.id,
        targetSets: 3,
        repMin: 8,
        repMax: 12,
        restSeconds: 90,
        supersetGroup: null,
        note: '',
      })),
    ]);
  }

  function update(draftId: string, patch: Partial<RoutineExerciseDraft>) {
    setExercises((current) =>
      current.map((entry) => (entry.id === draftId ? { ...entry, ...patch } : entry)),
    );
  }

  function move(draftId: string, direction: -1 | 1) {
    setExercises((current) => {
      const index = current.findIndex((entry) => entry.id === draftId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) {
      setError('Geef je routine een naam.');
      return;
    }

    setError(undefined);

    try {
      await saveRoutine.mutateAsync({
        userId,
        planId: existing?.id ?? null,
        dayId: existing?.days[0]?.id ?? null,
        name,
        folderId,
        notes,
        exercises,
      });

      if (router.canGoBack()) router.back();
    } catch {
      setError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  if (!isNew && routinesQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Routine" />
        <ActivityIndicator color={palette.primary} />
      </Screen>
    );
  }

  if (!isNew && !existing && !routinesQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Routine" />
        <EmptyState
          icon="alert-circle-outline"
          title="Routine niet gevonden"
          description="Deze routine bestaat niet meer."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const restTarget = exercises.find((entry) => entry.id === restSheetFor);
  const supersetTarget = exercises.find((entry) => entry.id === supersetSheetFor);
  const usedGroups = [...new Set(exercises.map((entry) => entry.supersetGroup))].filter(
    (group): group is number => group !== null,
  );

  return (
    <Screen>
      <ScreenHeader
        title={isNew ? 'Nieuwe routine' : 'Routine bewerken'}
        subtitle="De volgorde hier is de volgorde tijdens je training."
      />

      <View style={styles.form}>
        <Input
          label="Naam"
          value={name}
          onChangeText={setName}
          placeholder="Bijvoorbeeld: Push A"
        />

        <View style={styles.field}>
          <Text variant="label">Map</Text>
          <ChipRow>
            <Chip label="Zonder map" selected={folderId === null} onPress={() => setFolderId(null)} />
            {(foldersQuery.data ?? []).map((folder) => (
              <Chip
                key={folder.id}
                label={folder.name}
                selected={folderId === folder.id}
                onPress={() => setFolderId(folder.id)}
              />
            ))}
          </ChipRow>
        </View>

        <Input
          label="Notitie"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optioneel"
          multiline
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text variant="heading">Oefeningen</Text>
        <Text variant="caption" muted>
          {exercises.length}
        </Text>
      </View>

      {exercises.length === 0 ? (
        <EmptyState
          icon="add-circle-outline"
          title="Nog geen oefeningen"
          description="Voeg de oefeningen toe die je in deze training doet."
          actionLabel="Oefening toevoegen"
          onAction={() => picker.open({ subtitle: name || 'Nieuwe routine', onPick: addExercises })}
        />
      ) : (
        exercises.map((draft, index) => (
          <RoutineExerciseCard
            key={draft.id}
            draft={draft}
            name={exerciseMap.get(draft.exerciseId)?.name ?? 'Onbekende oefening'}
            subtitle={(() => {
              const exercise = exerciseMap.get(draft.exerciseId);
              return exercise ? exerciseSubtitle(exercise) : '';
            })()}
            isFirst={index === 0}
            isLast={index === exercises.length - 1}
            onMoveUp={() => move(draft.id, -1)}
            onMoveDown={() => move(draft.id, 1)}
            onRemove={() =>
              setExercises((current) => current.filter((entry) => entry.id !== draft.id))
            }
            onChange={(patch) => update(draft.id, patch)}
            onEditRest={() => setRestSheetFor(draft.id)}
            onEditSuperset={() => setSupersetSheetFor(draft.id)}
          />
        ))
      )}

      {exercises.length > 0 ? (
        <View style={styles.addButton}>
          <Button
            title="Oefening toevoegen"
            variant="secondary"
            onPress={() =>
              picker.open({ subtitle: name || 'Nieuwe routine', onPick: addExercises })
            }
          />
        </View>
      ) : null}

      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.save}>
        <Button title="Routine opslaan" loading={saveRoutine.isPending} onPress={handleSave} />
      </View>

      <Sheet
        visible={!!restTarget}
        title="Rusttijd"
        onClose={() => setRestSheetFor(null)}
      >
        <Text muted>De timer start automatisch zodra je een set afvinkt.</Text>
        <ChipRow>
          {REST_PRESETS_SECONDS.map((seconds) => (
            <Chip
              key={seconds}
              label={formatRest(seconds)}
              selected={restTarget?.restSeconds === seconds}
              onPress={() => {
                if (restTarget) update(restTarget.id, { restSeconds: seconds });
                setRestSheetFor(null);
              }}
            />
          ))}
        </ChipRow>
      </Sheet>

      <Sheet
        visible={!!supersetTarget}
        title="Superset"
        onClose={() => setSupersetSheetFor(null)}
      >
        <Text muted>
          Oefeningen met dezelfde letter doe je direct achter elkaar, zonder rust ertussen.
        </Text>
        <ChipRow>
          <Chip
            label="Geen"
            selected={supersetTarget?.supersetGroup === null}
            onPress={() => {
              if (supersetTarget) update(supersetTarget.id, { supersetGroup: null });
              setSupersetSheetFor(null);
            }}
          />
          {[...new Set([...usedGroups, Math.max(0, ...usedGroups) + 1])]
            .sort((a, b) => a - b)
            .map((group) => (
              <Chip
                key={group}
                label={supersetLabel(group)}
                dotColor={supersetColor(group)}
                selected={supersetTarget?.supersetGroup === group}
                onPress={() => {
                  if (supersetTarget) update(supersetTarget.id, { supersetGroup: group });
                  setSupersetSheetFor(null);
                }}
              />
            ))}
        </ChipRow>
      </Sheet>
    </Screen>
  );
}

function RoutineExerciseCard({
  draft,
  name,
  subtitle,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
  onEditRest,
  onEditSuperset,
}: {
  draft: RoutineExerciseDraft;
  name: string;
  subtitle: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<RoutineExerciseDraft>) => void;
  onEditRest: () => void;
  onEditSuperset: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        {draft.supersetGroup !== null ? (
          <View
            style={[styles.supersetTag, { backgroundColor: supersetColor(draft.supersetGroup) }]}
          >
            <Text style={styles.supersetTagLabel}>{supersetLabel(draft.supersetGroup)}</Text>
          </View>
        ) : null}

        <View style={styles.flex}>
          <Text variant="label">{name}</Text>
          <Text variant="caption" muted>
            {subtitle}
          </Text>
        </View>

        <View style={styles.exerciseActions}>
          <SmallIcon icon="chevron-up" label="Omhoog" onPress={onMoveUp} disabled={isFirst} />
          <SmallIcon icon="chevron-down" label="Omlaag" onPress={onMoveDown} disabled={isLast} />
          <SmallIcon icon="trash-outline" label="Verwijderen" onPress={onRemove} />
        </View>
      </View>

      <View style={styles.stepperRow}>
        <Stepper
          label="Sets"
          value={draft.targetSets}
          min={1}
          max={20}
          onChange={(value) => onChange({ targetSets: value })}
        />
        <Stepper
          label="Reps van"
          value={draft.repMin ?? 0}
          min={0}
          max={100}
          onChange={(value) =>
            onChange({
              repMin: value === 0 ? null : value,
              repMax:
                draft.repMax !== null && value > draft.repMax && value !== 0 ? value : draft.repMax,
            })
          }
        />
        <Stepper
          label="tot"
          value={draft.repMax ?? 0}
          min={0}
          max={100}
          onChange={(value) =>
            onChange({
              repMax: value === 0 ? null : value,
              repMin:
                draft.repMin !== null && value < draft.repMin && value !== 0 ? value : draft.repMin,
            })
          }
        />
      </View>

      <View style={styles.tagRow}>
        <Chip label={`Rust ${formatRest(draft.restSeconds)}`} onPress={onEditRest} />
        <Chip
          label={
            draft.supersetGroup === null
              ? 'Superset'
              : `Superset ${supersetLabel(draft.supersetGroup)}`
          }
          selected={draft.supersetGroup !== null}
          onPress={onEditSuperset}
        />
      </View>

      <Input
        label="Notitie"
        value={draft.note}
        onChangeText={(value) => onChange({ note: value })}
        placeholder="Optioneel, bijvoorbeeld: rustig zakken"
      />
    </Card>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stepper}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <View style={styles.stepperControls}>
        <SmallIcon
          icon="remove"
          label={`${label} verlagen`}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        />
        <Text variant="label" style={styles.stepperValue}>
          {value === 0 ? '–' : value}
        </Text>
        <SmallIcon
          icon="add"
          label={`${label} verhogen`}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        />
      </View>
    </View>
  );
}

function SmallIcon({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.smallIcon,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={18} color={palette.primary} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  form: { gap: spacing.md, marginBottom: spacing.lg },
  field: { gap: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  exerciseCard: { gap: spacing.md, marginBottom: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseActions: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1 },
  supersetTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supersetTagLabel: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', gap: spacing.md },
  stepper: { flex: 1, gap: spacing.xs },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperValue: { minWidth: 28, textAlign: 'center' },
  smallIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tagRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  addButton: { marginBottom: spacing.md },
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
  error: { color: colors.danger, marginBottom: spacing.sm },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
});
