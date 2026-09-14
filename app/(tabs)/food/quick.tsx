import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceGroup, type Choice } from '@/components/ChoiceGroup';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  suggestMealType,
  type MealType,
} from '@/features/nutrition/foodLog';
import {
  parseQuickKcal,
  parseQuickProtein,
  QUICK_ENTRY_DEFAULT_NAME,
} from '@/features/nutrition/quickEntry';
import { useLogQuickEntry } from '@/features/nutrition/useFoodExtras';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, spacing } from '@/theme/theme';

const MEAL_OPTIONS: readonly Choice<MealType>[] = MEAL_TYPES.map((mealType) => ({
  value: mealType,
  label: MEAL_LABELS[mealType],
}));

/**
 * Snelle invoer: calories and protein, no product.
 *
 * For eating out, where you will not find the dish in any database. A rough
 * guess in your diary is worth more than an empty day, and the app says so
 * rather than pretending the number is exact.
 */
export default function QuickEntryScreen() {
  const params = useLocalSearchParams<{
    meal?: string;
    date?: string;
    name?: string;
    kcal?: string;
    protein?: string;
  }>();

  const { session } = useAuth();
  const logQuickEntry = useLogQuickEntry();

  const [name, setName] = useState(params.name ?? '');
  const [kcal, setKcal] = useState(params.kcal ?? '');
  const [protein, setProtein] = useState(params.protein ?? '');
  const [mealType, setMealType] = useState<MealType>(() =>
    isMealType(params.meal) ? params.meal : suggestMealType(new Date()),
  );

  const [kcalError, setKcalError] = useState<string>();
  const [proteinError, setProteinError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  async function handleSave() {
    if (!session || logQuickEntry.isPending) return;

    const parsedKcal = parseQuickKcal(kcal);
    const parsedProtein = parseQuickProtein(protein);

    setKcalError(parsedKcal.error);
    setProteinError(parsedProtein.error);
    if (parsedKcal.value === undefined || parsedProtein.value === undefined) return;

    setFormError(undefined);

    try {
      await logQuickEntry.mutateAsync({
        userId: session.user.id,
        name: name.trim() || QUICK_ENTRY_DEFAULT_NAME,
        kcal: parsedKcal.value,
        proteinG: parsedProtein.value,
        mealType,
        loggedOn: params.date ?? todayIsoDate(),
      });

      router.dismissTo('/(tabs)/food');
    } catch {
      setFormError('Opslaan is niet gelukt. Controleer je internetverbinding.');
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Snelle invoer"
        subtitle="Voor als je buiten de deur eet en geen product kunt vinden."
      />

      <Card style={styles.form}>
        <Input
          label="Wat was het?"
          value={name}
          onChangeText={setName}
          placeholder="Bijvoorbeeld: friet bij de snackbar"
          autoFocus
        />

        <Input
          label="Calorieën"
          value={kcal}
          onChangeText={setKcal}
          error={kcalError}
          hint="Een schatting is prima."
          placeholder="650"
          keyboardType="number-pad"
        />

        <Input
          label="Eiwit in gram"
          value={protein}
          onChangeText={setProtein}
          error={proteinError}
          hint="Optioneel. Laat leeg als je het niet weet."
          placeholder="25"
          keyboardType="number-pad"
        />

        <ChoiceGroup
          label="Bij welke maaltijd?"
          options={MEAL_OPTIONS}
          value={mealType}
          onChange={setMealType}
          disabled={logQuickEntry.isPending}
        />
      </Card>

      <Text variant="caption" muted style={styles.note}>
        Vet en koolhydraten blijven op nul staan, omdat je ze niet hebt ingevuld. Je calorieën en
        eiwit kloppen dus wel, en die twee bepalen je dag het meest.
      </Text>

      {formError ? (
        <Text variant="caption" style={styles.error}>
          {formError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Toevoegen" onPress={handleSave} loading={logQuickEntry.isPending} />
        <Button
          title="Annuleren"
          variant="secondary"
          onPress={() => router.back()}
          disabled={logQuickEntry.isPending}
        />
      </View>
    </Screen>
  );
}

function isMealType(value: string | undefined): value is MealType {
  return !!value && (MEAL_TYPES as readonly string[]).includes(value);
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  note: { marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
});
