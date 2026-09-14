import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import { useCreateCustomFood } from '@/features/nutrition/useFoodLog';
import {
  parseMacroPer100g,
  parseOptionalServing,
  parseProductName,
  validateMacroSum,
} from '@/features/nutrition/parseFoodInput';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Enter a product by hand. This is the fallback whenever Open Food Facts does
 * not know something, and on web it is the only way to add a product that is
 * not in the database -- so it has to work on its own.
 */
export default function ManualFoodScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { session } = useAuth();
  const createFood = useCreateCustomFood();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [serving, setServing] = useState('');

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();

  async function handleSave() {
    if (createFood.isPending || !session) return;

    const parsedName = parseProductName(name);
    const parsedKcal = parseMacroPer100g(kcal, 'calorieën', 1000);
    const parsedProtein = parseMacroPer100g(protein, 'eiwit', 100);
    const parsedFat = parseMacroPer100g(fat, 'vet', 100);
    const parsedCarbs = parseMacroPer100g(carbs, 'koolhydraten', 100);
    const parsedServing = parseOptionalServing(serving);

    const next: Record<string, string | undefined> = {
      name: parsedName.error,
      kcal: parsedKcal.error,
      protein: parsedProtein.error,
      fat: parsedFat.error,
      carbs: parsedCarbs.error,
      serving: parsedServing.error,
    };

    // The macro sum is a constraint on the table, so catch it here rather than
    // letting Postgres reject the insert with something unreadable.
    if (
      parsedProtein.value !== undefined &&
      parsedFat.value !== undefined &&
      parsedCarbs.value !== undefined
    ) {
      next.macroSum = validateMacroSum(parsedProtein.value, parsedFat.value, parsedCarbs.value);
    }

    setErrors(next);
    setFormError(undefined);
    if (Object.values(next).some((error) => error !== undefined)) return;

    try {
      const food = await createFood.mutateAsync({
        userId: session.user.id,
        name: parsedName.value!,
        brand: brand.trim() ? brand.trim().slice(0, 120) : null,
        kcalPer100g: parsedKcal.value!,
        proteinPer100g: parsedProtein.value!,
        fatPer100g: parsedFat.value!,
        carbsPer100g: parsedCarbs.value!,
        servingSizeG: parsedServing.value ?? null,
      });

      // Straight on to "how much did you eat", because that is why you came.
      router.replace({
        pathname: '/(tabs)/food/amount',
        params: { foodId: food.id, ...(date ? { date } : {}) },
      });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Zelf invoeren</Text>
        <Text muted>
          Voedingswaarden per 100 gram, zoals op de verpakking. Je hoeft dit maar één keer te doen.
        </Text>
      </View>

      <Card style={styles.form}>
        <Input
          label="Naam"
          value={name}
          onChangeText={setName}
          error={errors.name}
          placeholder="Magere kwark"
          autoCapitalize="sentences"
          editable={!createFood.isPending}
        />
        <Input
          label="Merk (optioneel)"
          value={brand}
          onChangeText={setBrand}
          placeholder="Albert Heijn"
          autoCapitalize="words"
          editable={!createFood.isPending}
        />
      </Card>

      <Card style={styles.form}>
        <Text variant="heading">Per 100 gram</Text>
        <Input
          label="Calorieën (kcal)"
          value={kcal}
          onChangeText={setKcal}
          error={errors.kcal}
          placeholder="55"
          keyboardType="decimal-pad"
          editable={!createFood.isPending}
        />
        <Input
          label="Eiwit (g)"
          value={protein}
          onChangeText={setProtein}
          error={errors.protein}
          placeholder="10"
          keyboardType="decimal-pad"
          editable={!createFood.isPending}
        />
        <Input
          label="Vet (g)"
          value={fat}
          onChangeText={setFat}
          error={errors.fat}
          placeholder="0,2"
          keyboardType="decimal-pad"
          editable={!createFood.isPending}
        />
        <Input
          label="Koolhydraten (g)"
          value={carbs}
          onChangeText={setCarbs}
          error={errors.carbs}
          placeholder="3,6"
          keyboardType="decimal-pad"
          editable={!createFood.isPending}
        />

        {errors.macroSum ? (
          <Text variant="caption" style={styles.error}>
            {errors.macroSum}
          </Text>
        ) : null}

        <Input
          label="Portiegrootte in gram (optioneel)"
          value={serving}
          onChangeText={setServing}
          error={errors.serving}
          hint="Handig als je vaak dezelfde portie eet."
          placeholder="150"
          keyboardType="decimal-pad"
          editable={!createFood.isPending}
        />
      </Card>

      {formError ? (
        <Text variant="caption" style={styles.error}>
          {formError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Opslaan en loggen" onPress={handleSave} loading={createFood.isPending} />
        <Button
          title="Annuleren"
          variant="secondary"
          onPress={() => router.back()}
          disabled={createFood.isPending}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.md },
  form: { gap: spacing.md, marginBottom: spacing.md },
  error: { color: colors.danger },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
