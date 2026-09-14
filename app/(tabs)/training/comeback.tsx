import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  describeBreak,
  describeComeback,
  COMEBACK_EXPLANATION,
  COMEBACK_STREAK_NOTE,
  type PreviousExercise,
} from '@/features/training/comeback';
import { daysSinceLastWorkout } from '@/features/training/streak';
import { useExerciseMap } from '@/features/training/useExercises';
import { useSessionHistory } from '@/features/training/useSessions';
import { isScoringSet } from '@/features/training/volume';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { formatDutchDate } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Coming back after a week or more off.
 *
 * The whole screen is one offer: here is your last session, here it is again at
 * about 60%, shall we. It states the gap as a fact, says the streak restarts,
 * and does not mention food anywhere -- a missed week of training never changes
 * a calorie target.
 */
export default function ComebackScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const historyQuery = useSessionHistory(userId, 1);
  const { map: exerciseMap } = useExerciseMap(userId);

  const last = (historyQuery.data ?? [])[0];
  const days = daysSinceLastWorkout(
    (historyQuery.data ?? []).map((entry) => entry.performed_on),
    todayIsoDate(),
  );

  const previous: PreviousExercise[] = [];
  if (last) {
    const perExercise = new Map<string, PreviousExercise>();

    for (const set of last.sets) {
      const scoring = isScoringSet({
        setType: set.set_type,
        reps: set.reps,
        weightKg: set.weight_kg,
        isCompleted: set.is_completed,
      });
      if (!scoring) continue;

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

    previous.push(...perExercise.values());
  }

  if (historyQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Welkom terug" />
        <ActivityIndicator color={palette.primary} />
      </Screen>
    );
  }

  if (!last || previous.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Welkom terug" />
        <EmptyState
          icon="barbell-outline"
          title="Nog geen sessie om op te bouwen"
          description="Zodra je één training hebt afgerond, kan de app daar een lichtere versie van maken."
          actionLabel="Naar training"
          onAction={() => router.replace('/(tabs)/training')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Welkom terug" />

      <Card style={styles.card}>
        <View style={styles.iconRow}>
          <Ionicons name="hand-left-outline" size={24} color={palette.primary} />
          <Text variant="heading" style={styles.flex}>
            {days === null ? 'Fijn dat je er weer bent' : describeBreak(days)}
          </Text>
        </View>
        <Text muted>{COMEBACK_EXPLANATION}</Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Wat je gaat doen</Text>
        <Text muted>{describeComeback(previous)}</Text>

        {previous.map((exercise) => (
          <View key={exercise.exerciseId} style={styles.row}>
            <Text style={styles.flex}>{exercise.name}</Text>
            <Text variant="caption" muted>
              {Math.max(1, Math.round(exercise.sets * 0.6))} van {exercise.sets} sets
            </Text>
          </View>
        ))}

        <Text variant="caption" muted>
          Gebaseerd op {last.name} van {formatDutchDate(last.performed_on)}.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Je streak</Text>
        <Text muted>{COMEBACK_STREAK_NOTE}</Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Comeback-sessie starten"
          onPress={() => router.replace('/(tabs)/training/session?mode=comeback')}
        />
        <Button
          title="Liever mijn gewone routine"
          variant="secondary"
          onPress={() => router.replace('/(tabs)/training')}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
