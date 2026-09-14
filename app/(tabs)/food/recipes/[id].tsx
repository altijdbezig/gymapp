import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  suggestMealType,
  type MealType,
} from '@/features/nutrition/foodLog';
import {
  DIET_LABELS,
  DIFFICULTY_LABELS,
  readIngredients,
} from '@/features/recipes/recipeMatching';
import { AISLE_LABELS, toAisle } from '@/features/recipes/shoppingList';
import { useDeleteRecipe, useLogRecipe, useRecipes } from '@/features/recipes/useRecipes';
import {
  useAddListItems,
  useCreateShoppingList,
  useShoppingLists,
} from '@/features/recipes/useShoppingLists';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, spacing } from '@/theme/theme';

/**
 * One recipe: what is in it, how to make it, and the two things you want to do
 * with it -- log a portion, or put the ingredients on a shopping list.
 */
export default function RecipeDetailScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const day = date ?? todayIsoDate();

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const recipesQuery = useRecipes(userId);
  const listsQuery = useShoppingLists(userId);
  const logRecipe = useLogRecipe();
  const deleteRecipe = useDeleteRecipe(userId);
  const createList = useCreateShoppingList();
  const addItems = useAddListItems(userId);

  const [isLogSheetOpen, setLogSheetOpen] = useState(false);
  const [isListSheetOpen, setListSheetOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string>();

  const recipe = (recipesQuery.data ?? []).find((entry) => entry.id === id);

  if (recipesQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Recept" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!recipe) {
    return (
      <Screen>
        <ScreenHeader title="Recept" />
        <EmptyState
          icon="alert-circle-outline"
          title="Recept niet gevonden"
          description="Dit recept bestaat niet meer."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const ingredients = readIngredients(recipe);
  const isMine = recipe.created_by === userId;

  async function handleLog(mealType: MealType) {
    if (!userId || !recipe) return;

    await logRecipe.mutateAsync({ userId, recipe, mealType, date: day });
    setLogSheetOpen(false);
    router.dismissTo('/(tabs)/food');
  }

  async function addToList(listId: string) {
    if (!recipe) return;

    await addItems.mutateAsync({
      listId,
      drafts: ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        aisle: toAisle(ingredient.aisle),
        recipeId: recipe.id,
      })),
    });

    setListSheetOpen(false);
    setMessage('Op je boodschappenlijstje gezet.');
  }

  return (
    <Screen>
      <ScreenHeader title={recipe.title} subtitle={recipe.description ?? undefined} />

      <Card style={styles.card}>
        <View style={styles.stats}>
          <Stat label="Per portie" value={`${recipe.kcal_per_serving} kcal`} />
          <Stat label="Eiwit" value={`${Math.round(Number(recipe.protein_per_serving))} g`} />
          <Stat label="Vet" value={`${Math.round(Number(recipe.fat_per_serving))} g`} />
          <Stat label="Koolhydraten" value={`${Math.round(Number(recipe.carbs_per_serving))} g`} />
        </View>

        <Text variant="caption" muted>
          {recipe.prep_minutes} minuten · {DIFFICULTY_LABELS[recipe.difficulty]}
          {recipe.cuisine ? ` · ${recipe.cuisine}` : ''} ·{' '}
          {Number(recipe.servings)} {Number(recipe.servings) === 1 ? 'portie' : 'porties'}
        </Text>

        {recipe.diet !== 'none' ? (
          <Text variant="caption" muted>
            {DIET_LABELS[recipe.diet]}
          </Text>
        ) : null}

        {recipe.allergens.length > 0 ? (
          <Text variant="caption" style={styles.allergens}>
            Bevat: {recipe.allergens.join(', ')}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Ingrediënten</Text>
        {ingredients.map((ingredient) => (
          <View key={`${ingredient.name}-${ingredient.quantity}`} style={styles.row}>
            <Text style={styles.flex}>{ingredient.name}</Text>
            <Text variant="caption" muted>
              {ingredient.quantity}
            </Text>
          </View>
        ))}
        <Text variant="caption" muted>
          Schap: {[...new Set(ingredients.map((entry) => AISLE_LABELS[toAisle(entry.aisle)]))].join(', ')}
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Zo maak je het</Text>
        {recipe.steps.map((step, index) => (
          <View key={`${index}-${step.slice(0, 12)}`} style={styles.step}>
            <Text variant="label" style={styles.stepNumber}>
              {index + 1}
            </Text>
            <Text style={styles.flex}>{step}</Text>
          </View>
        ))}
      </Card>

      <Text variant="caption" muted style={styles.disclaimer}>
        Dit recept en de voedingswaarden zijn door een AI gemaakt en zijn een schatting. Het is
        geen voedingsadvies.
      </Text>

      {message ? (
        <Text variant="caption" style={styles.success}>
          {message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Loggen in je dagboek" onPress={() => setLogSheetOpen(true)} />
        <Button
          title="Op je boodschappenlijstje"
          variant="secondary"
          onPress={() => setListSheetOpen(true)}
        />
        {isMine ? (
          <Button title="Verwijderen" variant="secondary" onPress={() => setConfirmDelete(true)} />
        ) : null}
      </View>

      <Sheet visible={isLogSheetOpen} title="Bij welke maaltijd?" onClose={() => setLogSheetOpen(false)}>
        <Text muted>Je logt één portie.</Text>
        {MEAL_TYPES.map((mealType) => (
          <Button
            key={mealType}
            title={MEAL_LABELS[mealType]}
            variant={mealType === suggestMealType(new Date()) ? 'primary' : 'secondary'}
            loading={logRecipe.isPending}
            onPress={() => handleLog(mealType)}
          />
        ))}
      </Sheet>

      <Sheet
        visible={isListSheetOpen}
        title="Naar welk lijstje?"
        onClose={() => setListSheetOpen(false)}
      >
        {(listsQuery.data ?? []).map((list) => (
          <Button
            key={list.id}
            title={list.name}
            variant="secondary"
            loading={addItems.isPending}
            onPress={() => addToList(list.id)}
          />
        ))}

        <Input
          label="Nieuw lijstje"
          value={newListName}
          onChangeText={setNewListName}
          placeholder="Boodschappen deze week"
        />
        <Button
          title="Nieuw lijstje maken"
          loading={createList.isPending}
          onPress={async () => {
            if (!userId) return;
            const listId = await createList.mutateAsync({
              userId,
              name: newListName || 'Boodschappen',
              recipes: [recipe],
            });
            setNewListName('');
            setListSheetOpen(false);
            router.push(`/(tabs)/food/shopping/${listId}`);
          }}
        />
      </Sheet>

      <ConfirmDialog
        visible={confirmDelete}
        title="Recept verwijderen?"
        message="Dit recept wordt verwijderd. Wat je ervan hebt gelogd blijft in je dagboek staan."
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteRecipe.mutateAsync(recipe.id);
          router.dismissTo('/(tabs)/food/recipes');
        }}
      />
    </Screen>
  );
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

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.sm },
  stepNumber: { width: 20, color: colors.primary },
  flex: { flex: 1 },
  allergens: { color: colors.warning },
  disclaimer: { marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginBottom: spacing.xl },
});
