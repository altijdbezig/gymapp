import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExercisePicker } from '@/features/training/ExercisePicker';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
  exerciseSubtitle,
  filterExercises,
  sortExercises,
  type Exercise,
} from '@/features/training/exerciseLibrary';
import { useExercises } from '@/features/training/useExercises';
import type { ExerciseCategory, MuscleGroup } from '@/features/training/volume';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Pick one or more exercises.
 *
 * Multi-select by default: building a routine means adding five exercises, and
 * walking in and out of this screen five times would be silly. Tapping a row
 * selects it, the button at the bottom confirms.
 */
export default function ExercisePickerScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const { resolve, subtitle } = useExercisePicker();
  const exercisesQuery = useExercises(userId);

  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<Exercise[]>([]);

  const results = useMemo(() => {
    const all = exercisesQuery.data ?? [];
    return sortExercises(
      filterExercises(all, {
        query,
        muscle,
        category,
        ownership: onlyMine ? 'custom' : 'all',
      }),
    );
  }, [exercisesQuery.data, query, muscle, category, onlyMine]);

  function toggle(exercise: Exercise) {
    setSelected((current) =>
      current.some((entry) => entry.id === exercise.id)
        ? current.filter((entry) => entry.id !== exercise.id)
        : [...current, exercise],
    );
  }

  return (
    <Screen scrollable={false}>
      <ScreenHeader
        title="Oefening kiezen"
        subtitle={subtitle() ?? 'Zoek op de Nederlandse of de Engelse naam.'}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eigen oefening maken"
            onPress={() => router.push('/(tabs)/training/new-exercise')}
            hitSlop={spacing.sm}
          >
            <Ionicons name="add" size={24} color={palette.primary} />
          </Pressable>
        }
      />

      <Input
        label="Zoeken"
        value={query}
        onChangeText={setQuery}
        placeholder="Bijvoorbeeld bankdrukken of bench"
        autoCorrect={false}
        autoCapitalize="none"
      />

      <ChipRow>
        <Chip label="Alles" selected={!muscle} onPress={() => setMuscle(null)} />
        {MUSCLE_GROUP_ORDER.map((group) => (
          <Chip
            key={group}
            label={MUSCLE_GROUP_LABELS[group]}
            selected={muscle === group}
            onPress={() => setMuscle(muscle === group ? null : group)}
          />
        ))}
      </ChipRow>

      <ChipRow>
        <Chip label="Alle materialen" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORY_ORDER.map((entry) => (
          <Chip
            key={entry}
            label={CATEGORY_LABELS[entry]}
            selected={category === entry}
            onPress={() => setCategory(category === entry ? null : entry)}
          />
        ))}
        <Chip
          label="Alleen die van mij"
          selected={onlyMine}
          onPress={() => setOnlyMine((value) => !value)}
        />
      </ChipRow>

      {exercisesQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : exercisesQuery.isError ? (
        <Card style={styles.card}>
          <Text variant="heading">Oefeningen niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button
            title="Opnieuw proberen"
            variant="secondary"
            onPress={() => exercisesQuery.refetch()}
          />
        </Card>
      ) : results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Niets gevonden"
          description="Pas je zoekwoord of je filters aan, of maak deze oefening zelf aan."
          actionLabel="Eigen oefening maken"
          onAction={() => router.push('/(tabs)/training/new-exercise')}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              selected={selected.some((entry) => entry.id === item.id)}
              onPress={() => toggle(item)}
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Button
          title={
            selected.length === 0
              ? 'Kies een oefening'
              : selected.length === 1
                ? '1 oefening toevoegen'
                : `${selected.length} oefeningen toevoegen`
          }
          disabled={selected.length === 0}
          onPress={() => resolve(selected)}
        />
      </View>
    </Screen>
  );
}

function ExerciseRow({
  exercise,
  selected,
  onPress,
}: {
  exercise: Exercise;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${exercise.name}, ${exerciseSubtitle(exercise)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text variant="label">{exercise.name}</Text>
        <Text variant="caption" muted>
          {exerciseSubtitle(exercise)}
          {exercise.is_custom ? ' · eigen oefening' : ''}
        </Text>
      </View>

      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? palette.primary : palette.border}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { gap: spacing.md },
  list: { gap: spacing.sm, paddingVertical: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  footer: { paddingTop: spacing.sm },
});
