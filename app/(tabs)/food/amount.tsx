import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { ChoiceGroup, type Choice } from '@/components/ChoiceGroup';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import {
  macrosForAmount,
  MEAL_LABELS,
  MEAL_TYPES,
  suggestMealType,
  type MealType,
} from '@/features/nutrition/foodLog';
import { MICRO_LABELS } from '@/features/nutrition/micros';
import {
  countFor,
  defaultPortion,
  formatAmount,
  gramsFor,
  portionsForFood,
  SUGGESTED_PORTION_LABELS,
  type Portion,
} from '@/features/nutrition/portions';
import {
  useFavorites,
  useFoodPortions,
  useSavePortion,
  useToggleFavorite,
} from '@/features/nutrition/useFoodExtras';
import { useLogFood } from '@/features/nutrition/useFoodLog';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/theme';

const MEAL_OPTIONS: readonly Choice<MealType>[] = MEAL_TYPES.map((mealType) => ({
  value: mealType,
  label: MEAL_LABELS[mealType],
}));

/**
 * How much of a product you ate, in whatever unit suits it.
 *
 * Grams are always available, and on top of that the serving size Open Food
 * Facts published plus any portion you saved yourself ("1 plakje is 35 g").
 * Whatever you pick, grams are what gets stored -- the portion travels along
 * only so the diary can read it back as "2 plakjes".
 */
export default function AmountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { foodId, meal, date } = useLocalSearchParams<{
    foodId: string;
    meal?: string;
    date?: string;
  }>();

  const userId = session?.user.id ?? null;
  const loggedOn = date ?? todayIsoDate();

  const logFood = useLogFood();
  const portionsQuery = useFoodPortions(userId, foodId ?? null);
  const favoritesQuery = useFavorites(userId);
  const toggleFavorite = useToggleFavorite(userId);
  const savePortion = useSavePortion();

  const [count, setCount] = useState('');
  const [portionId, setPortionId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>(() =>
    isMealType(meal) ? meal : suggestMealType(new Date()),
  );
  const [amountError, setAmountError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  const [isPortionSheetOpen, setPortionSheetOpen] = useState(false);
  const [newPortionLabel, setNewPortionLabel] = useState('');
  const [newPortionGrams, setNewPortionGrams] = useState('');

  const foodQuery = useQuery({
    queryKey: ['food', foodId] as const,
    enabled: !!foodId,
    queryFn: async () => {
      const { data, error } = await supabase.from('foods').select('*').eq('id', foodId).single();
      if (error) throw error;
      return data;
    },
  });

  const food = foodQuery.data;

  const portions = useMemo(
    () => portionsForFood(food ?? null, portionsQuery.data ?? []),
    [food, portionsQuery.data],
  );
  const portion: Portion =
    portions.find((entry) => entry.id === portionId) ?? defaultPortion(portions);

  const parsedCount = parseCount(count);
  const amountG = parsedCount === null ? null : gramsFor(portion, parsedCount);
  const preview = food && amountG !== null ? macrosForAmount(food, amountG) : null;

  const isFavorite = (favoritesQuery.data ?? []).some(
    (favorite) => favorite.food_id === foodId,
  );

  async function handleLog() {
    if (logFood.isPending || !food || !session) return;

    if (parsedCount === null || amountG === null || amountG <= 0) {
      setAmountError('Vul een hoeveelheid in, bijvoorbeeld 150.');
      return;
    }
    if (amountG > 10000) {
      setAmountError('Dat is meer dan 10 kilo. Klopt de eenheid?');
      return;
    }

    setAmountError(undefined);
    setFormError(undefined);

    try {
      await logFood.mutateAsync({
        userId: session.user.id,
        food,
        amountG,
        mealType,
        date: loggedOn,
        portionLabel: portion.id === 'grams' ? null : portion.label,
        portionCount: portion.id === 'grams' ? null : parsedCount,
      });
      router.dismissTo('/(tabs)/food');
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  async function handleSavePortion() {
    if (!userId || !foodId) return;

    const grams = parseCount(newPortionGrams);
    if (!newPortionLabel.trim() || grams === null || grams <= 0) return;

    const saved = await savePortion.mutateAsync({
      userId,
      foodId,
      label: newPortionLabel.trim(),
      grams,
      isDefault: false,
    });

    setPortionId(saved.id);
    setNewPortionLabel('');
    setNewPortionGrams('');
    setPortionSheetOpen(false);
  }

  if (foodQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      </Screen>
    );
  }

  if (!food) {
    return (
      <Screen>
        <ScreenHeader title="Product niet gevonden" />
        <Text muted style={styles.spaced}>
          Dit product staat niet meer in de database.
        </Text>
        <Button title="Terug" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={food.name}
        subtitle={`${food.brand ? `${food.brand} · ` : ''}${formatNumber(
          food.kcal_per_100g,
        )} kcal per 100 g`}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Uit favorieten halen' : 'Als favoriet markeren'}
            onPress={() => foodId && toggleFavorite.mutate({ foodId, isFavorite })}
            hitSlop={spacing.sm}
          >
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={24}
              color={isFavorite ? colors.warning : colors.textMuted}
            />
          </Pressable>
        }
      />

      <Card style={styles.form}>
        <View style={styles.field}>
          <Text variant="label">Eenheid</Text>
          <ChipRow>
            {portions.map((entry) => (
              <Chip
                key={entry.id}
                label={
                  entry.id === 'grams'
                    ? 'gram'
                    : `${entry.label} (${formatAmount(entry.grams)} g)`
                }
                selected={entry.id === portion.id}
                onPress={() => {
                  // Keep the same real amount when switching units, so
                  // switching from grams to plakjes does not silently change
                  // how much you are logging.
                  if (amountG !== null) {
                    const next = portions.find((item) => item.id === entry.id) ?? entry;
                    setCount(formatAmount(countFor(next, amountG)));
                  }
                  setPortionId(entry.id);
                }}
              />
            ))}
            <Chip label="+ eenheid" onPress={() => setPortionSheetOpen(true)} />
          </ChipRow>
        </View>

        <Input
          label={portion.id === 'grams' ? 'Hoeveelheid in gram' : `Aantal ${portion.label}`}
          value={count}
          onChangeText={setCount}
          error={amountError}
          hint={
            portion.id === 'grams'
              ? 'Een komma mag: 82,5.'
              : `1 ${portion.label} is ${formatAmount(portion.grams)} g.`
          }
          placeholder={portion.id === 'grams' ? '100' : '1'}
          keyboardType="decimal-pad"
          editable={!logFood.isPending}
          autoFocus
        />

        {amountG !== null && portion.id !== 'grams' ? (
          <Text variant="caption" muted>
            Dat is {formatAmount(amountG)} gram.
          </Text>
        ) : null}

        <ChoiceGroup
          label="Bij welke maaltijd?"
          options={MEAL_OPTIONS}
          value={mealType}
          onChange={setMealType}
          disabled={logFood.isPending}
        />
      </Card>

      {preview ? (
        <Card style={styles.preview}>
          <Text variant="heading">Dit voeg je toe</Text>
          <View style={styles.previewRow}>
            <PreviewValue label="Calorieën" value={preview.kcal} unit="kcal" />
            <PreviewValue label="Eiwit" value={preview.proteinG} unit="g" />
          </View>
          <View style={styles.previewRow}>
            <PreviewValue label="Vet" value={preview.fatG} unit="g" />
            <PreviewValue label="Koolhydraten" value={preview.carbsG} unit="g" />
          </View>

          {hasMicros(food) && amountG !== null ? (
            <View style={styles.micros}>
              <Text variant="caption" muted>
                {MICRO_LABELS.fiber} {microFor(food.fiber_per_100g, amountG)} ·{' '}
                {MICRO_LABELS.sugars} {microFor(food.sugars_per_100g, amountG)} ·{' '}
                {MICRO_LABELS.saturatedFat} {microFor(food.saturated_fat_per_100g, amountG)} ·{' '}
                {MICRO_LABELS.salt} {microFor(food.salt_per_100g, amountG, 2)}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {formError ? (
        <Text variant="caption" style={styles.error}>
          {formError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Toevoegen" onPress={handleLog} loading={logFood.isPending} />
        <Button
          title="Annuleren"
          variant="secondary"
          onPress={() => router.back()}
          disabled={logFood.isPending}
        />
      </View>

      <Sheet
        visible={isPortionSheetOpen}
        title="Eigen eenheid"
        onClose={() => setPortionSheetOpen(false)}
      >
        <Text muted>
          Sla op hoeveel gram één plakje, stuk of eetlepel van dit product is. Dat hoef je maar
          één keer te doen.
        </Text>

        <ChipRow>
          {SUGGESTED_PORTION_LABELS.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={newPortionLabel === label}
              onPress={() => setNewPortionLabel(label)}
            />
          ))}
        </ChipRow>

        <Input
          label="Naam"
          value={newPortionLabel}
          onChangeText={setNewPortionLabel}
          placeholder="plakje"
        />
        <Input
          label="Gram per stuk"
          value={newPortionGrams}
          onChangeText={setNewPortionGrams}
          placeholder="35"
          keyboardType="decimal-pad"
        />
        <Button
          title="Eenheid opslaan"
          loading={savePortion.isPending}
          onPress={handleSavePortion}
        />
      </Sheet>
    </Screen>
  );
}

function PreviewValue({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.previewValue}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">
        {value}{' '}
        <Text variant="caption" muted>
          {unit}
        </Text>
      </Text>
    </View>
  );
}

function isMealType(value: string | undefined): value is MealType {
  return !!value && (MEAL_TYPES as readonly string[]).includes(value);
}

/** Accepts both a comma and a dot, and refuses anything that is not a number. */
function parseCount(input: string): number | null {
  const normalised = input.trim().replace(',', '.');
  if (normalised.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasMicros(food: {
  fiber_per_100g: number | null;
  sugars_per_100g: number | null;
  saturated_fat_per_100g: number | null;
  salt_per_100g: number | null;
}): boolean {
  return (
    food.fiber_per_100g !== null ||
    food.sugars_per_100g !== null ||
    food.saturated_fat_per_100g !== null ||
    food.salt_per_100g !== null
  );
}

/** A micronutrient stays a dash when the product does not have it recorded. */
function microFor(per100g: number | null, amountG: number, decimals = 1): string {
  if (per100g === null) return '—';
  const value = (per100g * amountG) / 100;
  return `${value.toFixed(decimals).replace('.', ',')} g`;
}

function formatNumber(value: number): string {
  return String(Number(value)).replace('.', ',');
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  spaced: { marginBottom: spacing.md },
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  preview: { gap: spacing.sm, marginTop: spacing.md },
  previewRow: { flexDirection: 'row', gap: spacing.md },
  previewValue: { flex: 1 },
  micros: { paddingTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
});
