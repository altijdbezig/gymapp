import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import { sumEntries } from '@/features/nutrition/foodLog';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import {
  describeGap,
  describeRecipe,
  findMatches,
  type RecipeFilters,
} from '@/features/recipes/recipeMatching';
import {
  RecipeGenerationError,
  useGenerateRecipe,
  useGenerationsToday,
  useRecipes,
} from '@/features/recipes/useRecipes';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, spacing } from '@/theme/theme';

/**
 * Recipes that fit what you still have room for today.
 *
 * The screen opens on your remaining calories and protein and immediately shows
 * what already exists that fits. Generating a new one is the button underneath,
 * not the first thing you see -- a recipe somebody already made is free and
 * instant, and a generated one costs money.
 */
export default function RecipesScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day = date ?? todayIsoDate();

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const targetsQuery = useTodaysTargets(userId);
  const logQuery = useFoodLog(userId, day);
  const recipesQuery = useRecipes(userId);
  const generationsQuery = useGenerationsToday(userId);
  const generateRecipe = useGenerateRecipe(userId);

  const target = targetsQuery.data;
  const eaten = sumEntries(logQuery.data ?? []);

  const remainingKcal = Math.max(0, (target?.kcal ?? 0) - eaten.kcal);
  const remainingProtein = Math.max(0, (target?.protein_g ?? 0) - eaten.proteinG);

  const [kcal, setKcal] = useState(String(remainingKcal || 600));
  const [protein, setProtein] = useState(String(remainingProtein || 40));
  const [wishes, setWishes] = useState('');
  const [error, setError] = useState<string>();
  const [hasEdited, setHasEdited] = useState(false);

  // Until you touch the fields, they follow your remaining macros as the day
  // fills up. After that they are yours.
  const wantedKcal = hasEdited ? Number(kcal) || 0 : remainingKcal;
  const wantedProtein = hasEdited ? Number(protein) || 0 : remainingProtein;

  const profile = profileQuery.data;
  const filters: RecipeFilters = useMemo(
    () => ({
      diet: profile?.diet ?? 'none',
      allergies: profile?.allergies ?? [],
      maxPrepMinutes: profile?.max_prep_minutes ?? 30,
      maxDifficulty: profile?.max_difficulty ?? 'medium',
    }),
    [profile],
  );

  const matches = useMemo(
    () =>
      findMatches(
        recipesQuery.data ?? [],
        { kcal: wantedKcal, proteinG: wantedProtein },
        filters,
      ),
    [recipesQuery.data, wantedKcal, wantedProtein, filters],
  );

  const limit = profile?.ai_recipe_limit_per_day ?? 5;
  const used = generationsQuery.data ?? 0;
  const remainingGenerations = Math.max(0, limit - used);

  async function handleGenerate() {
    if (!userId || generateRecipe.isPending) return;

    setError(undefined);
    try {
      const result = await generateRecipe.mutateAsync({
        kcal: wantedKcal,
        proteinG: wantedProtein,
        fatG: target?.fat_g,
        carbsG: target?.carbs_g,
        extraWishes: wishes,
      });

      router.push(`/(tabs)/food/recipes/${result.recipe.id}?date=${day}`);
    } catch (caught) {
      setError(
        caught instanceof RecipeGenerationError
          ? caught.message
          : 'Het recept kon niet worden gemaakt. Probeer het later opnieuw.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Recepten"
        subtitle="Wat past er nog binnen je dag?"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voorkeuren"
            onPress={() => router.push('/(tabs)/settings/recipes')}
            hitSlop={spacing.sm}
          >
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </Pressable>
        }
      />

      <Card style={styles.card}>
        <Text variant="heading">Waar zoek je op?</Text>
        {target ? (
          <Text variant="caption" muted>
            Je hebt vandaag nog ruimte voor {remainingKcal} kcal en {remainingProtein} g eiwit.
          </Text>
        ) : null}

        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Calorieën"
              value={hasEdited ? kcal : String(remainingKcal)}
              onChangeText={(value) => {
                setHasEdited(true);
                setKcal(value);
              }}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <Input
              label="Eiwit in gram"
              value={hasEdited ? protein : String(remainingProtein)}
              onChangeText={(value) => {
                setHasEdited(true);
                setProtein(value);
              }}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text variant="heading">Past bij je doel</Text>
        <Text variant="caption" muted>
          {matches.length}
        </Text>
      </View>

      {recipesQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : matches.length === 0 ? (
        <Card style={styles.card}>
          <Text muted>
            Er staat nog geen recept dat hier dichtbij komt. Hieronder kan je er een laten maken.
          </Text>
        </Card>
      ) : (
        matches.map((recipe) => (
          <Pressable
            key={recipe.id}
            accessibilityRole="button"
            accessibilityLabel={`${recipe.title} openen`}
            onPress={() => router.push(`/(tabs)/food/recipes/${recipe.id}?date=${day}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Card style={styles.recipeCard}>
              <Text variant="label">{recipe.title}</Text>
              <Text variant="caption" muted>
                {describeRecipe(recipe)}
              </Text>
              <Text variant="caption" muted>
                {describeGap(recipe, { kcal: wantedKcal, proteinG: wantedProtein })}
              </Text>
            </Card>
          </Pressable>
        ))
      )}

      <Card style={styles.card}>
        <Text variant="heading">Nieuw recept laten maken</Text>
        <Text variant="caption" muted>
          Dit kost een aanvraag. Je hebt er vandaag nog {remainingGenerations} van je {limit} over.
          Recepten die er al staan zijn gratis.
        </Text>

        <Input
          label="Extra wens"
          value={wishes}
          onChangeText={setWishes}
          placeholder="Optioneel: iets met kip, geen oven"
        />

        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          title={remainingGenerations === 0 ? 'Je limiet voor vandaag is bereikt' : 'Recept maken'}
          disabled={remainingGenerations === 0}
          loading={generateRecipe.isPending}
          onPress={handleGenerate}
        />
      </Card>

      <View style={styles.footer}>
        <Button
          title="Boodschappenlijstjes"
          variant="secondary"
          onPress={() => router.push('/(tabs)/food/shopping')}
        />
        <Button
          title="Voorkeuren aanpassen"
          variant="secondary"
          onPress={() => router.push('/(tabs)/settings/recipes')}
        />
      </View>

      {(recipesQuery.data ?? []).length === 0 && !recipesQuery.isLoading ? (
        <EmptyState
          icon="restaurant-outline"
          title="Nog geen recepten"
          description="Het eerste recept dat je laat maken komt hier te staan, en blijft daarna gratis beschikbaar."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  recipeCard: { gap: spacing.xs, marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  error: { color: colors.danger },
  footer: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
