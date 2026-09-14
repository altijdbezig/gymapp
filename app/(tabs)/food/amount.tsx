import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceGroup, type Choice } from '@/components/ChoiceGroup';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
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
import { useLogFood } from '@/features/nutrition/useFoodLog';
import { parseWeight } from '@/features/onboarding/parseFormInput';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/theme';

const MEAL_OPTIONS: readonly Choice<MealType>[] = MEAL_TYPES.map((mealType) => ({
  value: mealType,
  label: MEAL_LABELS[mealType],
}));

/**
 * How much of a product you ate, and at which meal. Reached from the scanner,
 * from search and from a freshly created custom product -- all three cache the
 * food first and then send you here with its id.
 */
export default function AmountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { foodId } = useLocalSearchParams<{ foodId: string }>();

  const logFood = useLogFood();
  const [amount, setAmount] = useState('');
  const [mealType, setMealType] = useState<MealType>(() => suggestMealType(new Date()));
  const [amountError, setAmountError] = useState<string>();
  const [formError, setFormError] = useState<string>();

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

  // The amount field starts empty but shows the serving size as a hint, so a
  // product that knows "1 portie = 30 g" needs one tap instead of a weighing.
  const parsedAmount = parseWeight(amount);
  const preview =
    food && parsedAmount.value !== undefined
      ? macrosForAmount(food, parsedAmount.value)
      : null;

  async function handleLog() {
    if (logFood.isPending || !food || !session) return;

    const parsed = parseWeight(amount);
    // Narrowing on `value` rather than on `error`: an error string could in
    // principle be empty, so TypeScript cannot rule that branch out from a
    // truthiness check on `error` alone.
    if (parsed.value === undefined) {
      // parseWeight talks about body weight; here it is a portion.
      setAmountError(parsed.error.replace('je gewicht', 'een hoeveelheid'));
      return;
    }
    setAmountError(undefined);
    setFormError(undefined);

    try {
      await logFood.mutateAsync({
        userId: session.user.id,
        food,
        amountG: parsed.value,
        mealType,
      });
      router.dismissTo('/(tabs)/food');
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
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
        <Text variant="title">Product niet gevonden</Text>
        <Text muted style={styles.spaced}>
          Dit product staat niet meer in de database.
        </Text>
        <Button title="Terug" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{food.name}</Text>
        <Text muted>
          {food.brand ? `${food.brand} · ` : ''}
          {formatNumber(food.kcal_per_100g)} kcal per 100 g
        </Text>
      </View>

      <Card style={styles.form}>
        <Input
          label="Hoeveelheid in gram"
          value={amount}
          onChangeText={setAmount}
          error={amountError}
          hint={
            food.serving_size_g
              ? `1 portie is ${formatNumber(food.serving_size_g)} g. Een komma mag.`
              : 'Een komma mag: 82,5.'
          }
          placeholder={food.serving_size_g ? formatNumber(food.serving_size_g) : '100'}
          keyboardType="decimal-pad"
          editable={!logFood.isPending}
          autoFocus
        />

        {food.serving_size_g ? (
          <Button
            title={`1 portie (${formatNumber(food.serving_size_g)} g)`}
            variant="secondary"
            onPress={() => setAmount(formatNumber(food.serving_size_g!))}
            disabled={logFood.isPending}
          />
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
        {value} <Text variant="caption" muted>{unit}</Text>
      </Text>
    </View>
  );
}

function formatNumber(value: number): string {
  return String(Number(value)).replace('.', ',');
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  spaced: { marginBottom: spacing.md },
  form: { gap: spacing.md },
  preview: { gap: spacing.sm, marginTop: spacing.md },
  previewRow: { flexDirection: 'row', gap: spacing.md },
  previewValue: { flex: 1 },
  error: { color: colors.danger, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
