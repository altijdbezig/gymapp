import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFoodPicker, type PickedFood } from '@/features/nutrition/FoodPicker';
import { MEAL_KIND_LABELS, perServing, sumMealItems, type MealKind } from '@/features/nutrition/meals';
import {
  useDeleteMeal,
  useMeals,
  useSaveMeal,
  type MealItemDraft,
} from '@/features/nutrition/useMeals';
import { createId } from '@/lib/id';
import { colors, spacing } from '@/theme/theme';

/**
 * The meal and recipe editor.
 *
 * `id` is "new" for one that does not exist yet, so creating and editing stay
 * one screen. The totals underneath update while you type, which is the whole
 * point of a recipe: you want to see what a portion comes to before you save.
 */
export default function MealEditorScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = id === 'new';

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const mealsQuery = useMeals(userId);
  const saveMeal = useSaveMeal();
  const deleteMeal = useDeleteMeal(userId);
  const picker = useFoodPicker();

  const existing = useMemo(
    () => (isNew ? null : (mealsQuery.data ?? []).find((meal) => meal.id === id) ?? null),
    [mealsQuery.data, id, isNew],
  );

  const [kind, setKind] = useState<MealKind>(kindParam === 'recipe' ? 'recipe' : 'meal');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [servings, setServings] = useState('4');
  const [items, setItems] = useState<MealItemDraft[]>([]);
  const [isLoaded, setIsLoaded] = useState(isNew);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isLoaded || !existing) return;

    setKind(existing.kind);
    setName(existing.name);
    setNotes(existing.notes ?? '');
    setServings(String(Number(existing.servings)));
    setItems(
      existing.items.map((item) => ({
        id: item.id,
        foodId: item.food_id,
        name: item.name,
        brand: item.brand,
        amountG: Number(item.amount_g),
        kcalPer100g: Number(item.kcal_per_100g),
        proteinPer100g: Number(item.protein_per_100g),
        fatPer100g: Number(item.fat_per_100g),
        carbsPer100g: Number(item.carbs_per_100g),
        fiberPer100g: item.fiber_per_100g === null ? null : Number(item.fiber_per_100g),
        sugarsPer100g: item.sugars_per_100g === null ? null : Number(item.sugars_per_100g),
        saturatedFatPer100g:
          item.saturated_fat_per_100g === null ? null : Number(item.saturated_fat_per_100g),
        saltPer100g: item.salt_per_100g === null ? null : Number(item.salt_per_100g),
      })),
    );
    setIsLoaded(true);
  }, [existing, isLoaded]);

  function addFood(food: PickedFood) {
    setItems((current) => [
      ...current,
      {
        id: createId(),
        foodId: food.foodId,
        name: food.name,
        brand: food.brand,
        amountG: food.servingSizeG ?? 100,
        kcalPer100g: food.kcalPer100g,
        proteinPer100g: food.proteinPer100g,
        fatPer100g: food.fatPer100g,
        carbsPer100g: food.carbsPer100g,
        fiberPer100g: food.fiberPer100g,
        sugarsPer100g: food.sugarsPer100g,
        saturatedFatPer100g: food.saturatedFatPer100g,
        saltPer100g: food.saltPer100g,
      },
    ]);
  }

  const totals = sumMealItems(
    items.map((item) => ({
      amount_g: item.amountG,
      kcal_per_100g: item.kcalPer100g,
      protein_per_100g: item.proteinPer100g,
      fat_per_100g: item.fatPer100g,
      carbs_per_100g: item.carbsPer100g,
      fiber_per_100g: item.fiberPer100g,
      sugars_per_100g: item.sugarsPer100g,
      saturated_fat_per_100g: item.saturatedFatPer100g,
      salt_per_100g: item.saltPer100g,
    })),
  );

  const servingCount = Math.max(1, Number(servings.replace(',', '.')) || 1);
  const shown = kind === 'recipe' ? perServing(totals, servingCount) : totals;

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) {
      setError('Geef je maaltijd een naam.');
      return;
    }
    if (items.length === 0) {
      setError('Voeg minstens één product toe.');
      return;
    }

    setError(undefined);

    try {
      await saveMeal.mutateAsync({
        userId,
        mealId: existing?.id ?? null,
        kind,
        name,
        notes,
        servings: servingCount,
        items,
      });

      if (router.canGoBack()) router.back();
    } catch {
      setError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  if (!isNew && mealsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Maaltijd" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!isNew && !existing) {
    return (
      <Screen>
        <ScreenHeader title="Maaltijd" />
        <EmptyState
          icon="alert-circle-outline"
          title="Niet gevonden"
          description="Deze maaltijd bestaat niet meer."
          actionLabel="Terug"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={isNew ? `Nieuw ${MEAL_KIND_LABELS[kind].toLowerCase()}` : name || 'Bewerken'}
        subtitle={
          kind === 'recipe'
            ? 'Voer alle ingrediënten in en hoeveel porties het oplevert.'
            : 'De producten die je samen eet.'
        }
      />

      <Card style={styles.form}>
        <Input label="Naam" value={name} onChangeText={setName} placeholder="Mijn ontbijt" />

        {kind === 'recipe' ? (
          <Input
            label="Aantal porties"
            value={servings}
            onChangeText={setServings}
            keyboardType="decimal-pad"
            hint="De macro's per portie worden hiermee uitgerekend."
          />
        ) : null}

        <Input
          label="Notitie"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optioneel"
          multiline
        />
      </Card>

      <View style={styles.sectionHeader}>
        <Text variant="heading">{kind === 'recipe' ? 'Ingrediënten' : 'Producten'}</Text>
        <Text variant="caption" muted>
          {items.length}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="add-circle-outline"
          title="Nog niets toegevoegd"
          description="Zoek een product op en stel in hoeveel gram erin gaat."
          actionLabel="Product toevoegen"
          onAction={() => picker.open({ subtitle: name || undefined, onPick: addFood })}
        />
      ) : (
        items.map((item) => (
          <Card key={item.id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.flex}>
                <Text variant="label">{item.name}</Text>
                <Text variant="caption" muted>
                  {item.brand ? `${item.brand} · ` : ''}
                  {Math.round(item.kcalPer100g)} kcal per 100 g
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name} verwijderen`}
                onPress={() =>
                  setItems((current) => current.filter((entry) => entry.id !== item.id))
                }
                hitSlop={spacing.sm}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            <Input
              label="Hoeveelheid in gram"
              value={String(item.amountG)}
              onChangeText={(value) => {
                const parsed = Number(value.replace(',', '.'));
                setItems((current) =>
                  current.map((entry) =>
                    entry.id === item.id
                      ? { ...entry, amountG: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 }
                      : entry,
                  ),
                );
              }}
              keyboardType="decimal-pad"
            />
          </Card>
        ))
      )}

      {items.length > 0 ? (
        <View style={styles.addButton}>
          <Button
            title="Product toevoegen"
            variant="secondary"
            onPress={() => picker.open({ subtitle: name || undefined, onPick: addFood })}
          />
        </View>
      ) : null}

      {items.length > 0 ? (
        <Card style={styles.totals}>
          <Text variant="heading">
            {kind === 'recipe' ? 'Per portie' : 'In totaal'}
          </Text>
          <View style={styles.totalsRow}>
            <Total label="Calorieën" value={`${shown.kcal} kcal`} />
            <Total label="Eiwit" value={`${shown.proteinG} g`} />
          </View>
          <View style={styles.totalsRow}>
            <Total label="Vet" value={`${shown.fatG} g`} />
            <Total label="Koolhydraten" value={`${shown.carbsG} g`} />
          </View>
          <Text variant="caption" muted>
            {kind === 'recipe'
              ? `In totaal ${totals.kcal} kcal uit ${Math.round(totals.amountG)} g ingrediënten.`
              : `In totaal ${Math.round(totals.amountG)} g.`}
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Opslaan" loading={saveMeal.isPending} onPress={handleSave} />
        {!isNew ? (
          <Button title="Verwijderen" variant="secondary" onPress={() => setConfirmDelete(true)} />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title="Verwijderen?"
        message={`"${name}" wordt verwijderd. Wat je eerder hebt gelogd blijft in je dagboek staan.`}
        confirmLabel="Verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (existing) await deleteMeal.mutateAsync(existing.id);
          router.dismissTo('/(tabs)/food/meals');
        }}
      />
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.total}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginBottom: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  itemCard: { gap: spacing.sm, marginBottom: spacing.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  addButton: { marginBottom: spacing.md },
  totals: { gap: spacing.sm, marginBottom: spacing.md },
  totalsRow: { flexDirection: 'row', gap: spacing.md },
  total: { flex: 1, gap: 2 },
  error: { color: colors.danger, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginBottom: spacing.xl },
});
