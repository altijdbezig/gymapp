import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  suggestMealType,
  type MealType,
} from '@/features/nutrition/foodLog';
import { describeMeal, type MealKind } from '@/features/nutrition/meals';
import { useLogMeal, useMeals, type MealWithItems } from '@/features/nutrition/useMeals';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, spacing } from '@/theme/theme';

const TABS: readonly Segment<MealKind>[] = [
  { value: 'meal', label: 'Maaltijden' },
  { value: 'recipe', label: 'Recepten' },
];

/**
 * Your own meals and recipes.
 *
 * A meal is a set of products you eat together; logging it writes them all as
 * separate entries so you can still adjust one. A recipe has servings and logs
 * as a single item for one serving.
 */
export default function MealsScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const loggedOn = date ?? todayIsoDate();

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const mealsQuery = useMeals(userId);
  const logMeal = useLogMeal();

  const [kind, setKind] = useState<MealKind>('meal');
  const [logTarget, setLogTarget] = useState<MealWithItems | null>(null);
  const [error, setError] = useState<string>();

  const meals = (mealsQuery.data ?? []).filter((meal) => meal.kind === kind);

  async function handleLog(mealType: MealType, servingsEaten: number) {
    if (!userId || !logTarget) return;

    setError(undefined);
    try {
      await logMeal.mutateAsync({
        userId,
        meal: logTarget,
        mealType,
        date: loggedOn,
        servingsEaten,
      });
      setLogTarget(null);
      router.dismissTo('/(tabs)/food');
    } catch {
      setError('Loggen is niet gelukt. Controleer je internetverbinding.');
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Mijn maaltijden"
        subtitle="Producten die je vaker samen eet, in één tik."
      />

      <SegmentedControl segments={TABS} value={kind} onChange={setKind} label="Wat wil je zien?" />

      {mealsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : meals.length === 0 ? (
        <EmptyState
          icon="restaurant-outline"
          title={kind === 'meal' ? 'Nog geen maaltijden' : 'Nog geen recepten'}
          description={
            kind === 'meal'
              ? 'Sla je vaste ontbijt of lunch één keer op, dan log je hem daarna met één tik.'
              : 'Voer de ingrediënten en het aantal porties in; de macro’s per portie rekent de app uit.'
          }
          actionLabel={kind === 'meal' ? 'Maaltijd maken' : 'Recept maken'}
          onAction={() => router.push(`/(tabs)/food/meals/new?kind=${kind}`)}
        />
      ) : (
        <>
          {meals.map((meal) => (
            <Card key={meal.id} style={styles.mealCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${meal.name} bewerken`}
                onPress={() => router.push(`/(tabs)/food/meals/${meal.id}`)}
                style={styles.flex}
              >
                <Text variant="label">{meal.name}</Text>
                <Text variant="caption" muted>
                  {describeMeal(meal, meal.items)}
                  {meal.kind === 'recipe' ? ` · ${Number(meal.servings)} porties` : ''}
                </Text>
              </Pressable>

              <Button
                title="Loggen"
                variant="secondary"
                onPress={() => setLogTarget(meal)}
              />
            </Card>
          ))}

          <View style={styles.actions}>
            <Button
              title={kind === 'meal' ? 'Nieuwe maaltijd' : 'Nieuw recept'}
              onPress={() => router.push(`/(tabs)/food/meals/new?kind=${kind}`)}
            />
          </View>
        </>
      )}

      <Sheet
        visible={!!logTarget}
        title={logTarget?.name ?? ''}
        onClose={() => setLogTarget(null)}
      >
        <Text muted>
          {logTarget?.kind === 'recipe'
            ? 'Bij welke maaltijd log je één portie?'
            : 'Bij welke maaltijd hoort dit?'}
        </Text>

        {MEAL_TYPES.map((mealType) => (
          <Button
            key={mealType}
            title={MEAL_LABELS[mealType]}
            variant={mealType === suggestMealType(new Date()) ? 'primary' : 'secondary'}
            loading={logMeal.isPending}
            onPress={() => handleLog(mealType, 1)}
          />
        ))}

        {logTarget?.kind === 'recipe' ? (
          <Button
            title="Twee porties"
            variant="secondary"
            loading={logMeal.isPending}
            onPress={() => handleLog(suggestMealType(new Date()), 2)}
          />
        ) : null}

        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  flex: { flex: 1 },
  actions: { marginTop: spacing.md, marginBottom: spacing.xl },
  error: { color: colors.danger },
});
