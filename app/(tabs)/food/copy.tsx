import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DateStepper } from '@/components/DateStepper';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupByMeal, sumEntries, type MealType } from '@/features/nutrition/foodLog';
import { useCopyEntries } from '@/features/nutrition/useFoodExtras';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { addDays, formatDutchDate } from '@/lib/date';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Copying what you ate on another day.
 *
 * Copy, never move: the day you copy from keeps everything. You pick the day
 * on the left and tick the meals you want; everything lands on the day you came
 * from, in the same meal it was in.
 */
export default function CopyDayScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const targetDate = date ?? todayIsoDate();

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [sourceDate, setSourceDate] = useState(() => addDays(targetDate, -1));
  const [selected, setSelected] = useState<MealType[]>([]);
  const [error, setError] = useState<string>();

  const sourceQuery = useFoodLog(userId, sourceDate);
  const copyEntries = useCopyEntries();

  const entries = sourceQuery.data ?? [];
  const meals = groupByMeal(entries).filter((meal) => meal.entries.length > 0);
  const chosen = entries.filter((entry) => selected.includes(entry.meal_type));
  const chosenTotals = sumEntries(chosen);

  function toggle(mealType: MealType) {
    setSelected((current) =>
      current.includes(mealType)
        ? current.filter((entry) => entry !== mealType)
        : [...current, mealType],
    );
  }

  async function handleCopy() {
    if (!userId || chosen.length === 0) return;

    setError(undefined);
    try {
      await copyEntries.mutateAsync({ userId, entries: chosen, toDate: targetDate });
      router.dismissTo('/(tabs)/food');
    } catch {
      setError('Kopiëren is niet gelukt. Controleer je internetverbinding.');
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Dag kopiëren"
        subtitle={`Naar ${formatDutchDate(targetDate)}`}
      />

      <Card style={styles.card}>
        <Text variant="label">Kopiëren van</Text>
        <DateStepper value={sourceDate} onChange={setSourceDate} today={todayIsoDate()} />
      </Card>

      {sourceQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={palette.primary} />
        </Card>
      ) : meals.length === 0 ? (
        <EmptyState
          icon="copy-outline"
          title="Niets gelogd op die dag"
          description="Kies een andere dag met de pijlen hierboven."
        />
      ) : (
        <>
          {meals.map((meal) => {
            const isSelected = selected.includes(meal.mealType);

            return (
              <Pressable
                key={meal.mealType}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${meal.label} kopiëren`}
                onPress={() => toggle(meal.mealType)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Card style={[styles.mealCard, isSelected && styles.mealCardSelected]}>
                  <View style={styles.rowBetween}>
                    <Text variant="heading">{meal.label}</Text>
                    <Text variant="caption" muted>
                      {meal.totals.kcal} kcal
                    </Text>
                  </View>
                  {meal.entries.map((entry) => (
                    <Text key={entry.id} variant="caption" muted>
                      {entry.name}
                    </Text>
                  ))}
                </Card>
              </Pressable>
            );
          })}

          {error ? (
            <Text variant="caption" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              title={
                chosen.length === 0
                  ? 'Kies wat je wil kopiëren'
                  : `${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} kopiëren · ${
                      chosenTotals.kcal
                    } kcal`
              }
              disabled={chosen.length === 0}
              loading={copyEntries.isPending}
              onPress={handleCopy}
            />
            <Button title="Annuleren" variant="secondary" onPress={() => router.back()} />
          </View>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  mealCard: { gap: spacing.xs, marginBottom: spacing.sm },
  mealCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger, marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
