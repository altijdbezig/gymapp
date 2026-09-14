import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chip, ChipRow } from '@/components/Chip';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
} from '@/features/training/exerciseLibrary';
import { useCreateExercise } from '@/features/training/useExercises';
import type { ExerciseCategory, MuscleGroup } from '@/features/training/volume';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** Adding an exercise the standard library does not have. */
export default function NewExerciseScreen() {
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const createExercise = useCreateExercise();

  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [category, setCategory] = useState<ExerciseCategory>('barbell');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string>();

  function toggleSecondary(muscle: MuscleGroup) {
    setSecondaryMuscles((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    );
  }

  async function handleSave() {
    if (!userId) return;

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Vul een naam in.');
      return;
    }
    if (trimmed.length > 120) {
      setError('Houd de naam korter dan 120 tekens.');
      return;
    }

    setError(undefined);

    try {
      await createExercise.mutateAsync({
        userId,
        name: trimmed,
        primaryMuscle,
        // A muscle cannot be primary and secondary at once.
        secondaryMuscles: secondaryMuscles.filter((muscle) => muscle !== primaryMuscle),
        category,
        instructions: instructions.trim() ? instructions.trim() : null,
      });

      if (router.canGoBack()) router.back();
    } catch {
      setError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Eigen oefening"
        subtitle="Hij komt alleen in jouw lijst te staan."
      />

      <View style={styles.form}>
        <Input
          label="Naam"
          value={name}
          onChangeText={setName}
          placeholder="Bijvoorbeeld: Kabelcurl over de bank"
          autoFocus
        />

        <View style={styles.field}>
          <Text variant="label">Primaire spiergroep</Text>
          <ChipRow>
            {MUSCLE_GROUP_ORDER.map((muscle) => (
              <Chip
                key={muscle}
                label={MUSCLE_GROUP_LABELS[muscle]}
                selected={primaryMuscle === muscle}
                onPress={() => setPrimaryMuscle(muscle)}
              />
            ))}
          </ChipRow>
        </View>

        <View style={styles.field}>
          <Text variant="label">Secundaire spiergroepen</Text>
          <Text variant="caption" muted>
            Optioneel. Ze tellen voor de helft mee in je volume per spiergroep.
          </Text>
          <ChipRow>
            {MUSCLE_GROUP_ORDER.filter((muscle) => muscle !== primaryMuscle).map((muscle) => (
              <Chip
                key={muscle}
                label={MUSCLE_GROUP_LABELS[muscle]}
                selected={secondaryMuscles.includes(muscle)}
                onPress={() => toggleSecondary(muscle)}
              />
            ))}
          </ChipRow>
        </View>

        <View style={styles.field}>
          <Text variant="label">Materiaal</Text>
          <ChipRow>
            {CATEGORY_ORDER.map((entry) => (
              <Chip
                key={entry}
                label={CATEGORY_LABELS[entry]}
                selected={category === entry}
                onPress={() => setCategory(entry)}
              />
            ))}
          </ChipRow>
        </View>

        <Input
          label="Uitleg"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Optioneel: een korte aanwijzing voor jezelf"
          multiline
          numberOfLines={3}
        />

        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button title="Oefening opslaan" loading={createExercise.isPending} onPress={handleSave} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  form: { gap: spacing.lg, paddingBottom: spacing.xl },
  field: { gap: spacing.xs },
  error: { color: colors.danger },
});
