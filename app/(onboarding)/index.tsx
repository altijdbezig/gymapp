import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceGroup, type Choice } from '@/components/ChoiceGroup';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import { profileQueryKey } from '@/features/auth/useProfile';
import {
  ACTIVITY_LABELS,
  buildDailyTargetRow,
  GOAL_LABELS,
  SEX_LABELS,
  TARGET_WARNING_MESSAGES,
  type CompleteProfile,
} from '@/features/nutrition/dailyTargets';
import {
  ageFromBirthDate,
  calculateDailyTargets,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@/features/nutrition/calculateDailyTargets';
import { upsertDailyTargets } from '@/features/nutrition/useDailyTargets';
import {
  parseBirthDate,
  parseHeight,
  parseWeight,
  todayIsoDate,
} from '@/features/onboarding/parseFormInput';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

const SEX_OPTIONS: readonly Choice<Sex>[] = [
  { value: 'male', label: SEX_LABELS.male },
  { value: 'female', label: SEX_LABELS.female },
];

const ACTIVITY_OPTIONS: readonly Choice<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Weinig actief', description: ACTIVITY_LABELS.sedentary },
  { value: 'light', label: 'Licht actief', description: ACTIVITY_LABELS.light },
  { value: 'moderate', label: 'Actief', description: ACTIVITY_LABELS.moderate },
  { value: 'active', label: 'Zeer actief', description: ACTIVITY_LABELS.active },
  { value: 'very_active', label: 'Extreem actief', description: ACTIVITY_LABELS.very_active },
];

const GOAL_OPTIONS: readonly Choice<Goal>[] = [
  { value: 'cut', label: GOAL_LABELS.cut, description: '400 kcal onder je onderhoud.' },
  { value: 'maintenance', label: GOAL_LABELS.maintenance, description: 'Precies je onderhoud.' },
  { value: 'bulk', label: GOAL_LABELS.bulk, description: '400 kcal boven je onderhoud.' },
];

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  const [step, setStep] = useState(1);

  // Step 1
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');

  // Step 2
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);

  // Step 3
  const [goal, setGoal] = useState<Goal | null>(null);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date();

  function validateStepOne() {
    const next: Record<string, string | undefined> = {};
    if (displayName.trim().length === 0) {
      next.displayName = 'Vul je naam in.';
    } else if (displayName.trim().length > 60) {
      next.displayName = 'Houd het bij maximaal 60 tekens.';
    }
    next.birthDate = parseBirthDate(birthDate, today).error;
    if (!sex) next.sex = 'Kies een optie.';
    next.height = parseHeight(height).error;
    setErrors(next);
    return Object.values(next).every((error) => error === undefined);
  }

  function validateStepTwo() {
    const next: Record<string, string | undefined> = {};
    next.weight = parseWeight(weight).error;
    if (!activityLevel) next.activityLevel = 'Kies hoe actief je bent.';
    setErrors(next);
    return Object.values(next).every((error) => error === undefined);
  }

  function handleNext() {
    setFormError(undefined);
    if (step === 1 && validateStepOne()) setStep(2);
    else if (step === 2 && validateStepTwo()) setStep(3);
  }

  /** The live preview on step 3, so you see the effect of your goal before saving. */
  function previewTargets() {
    const parsedBirthDate = parseBirthDate(birthDate, today);
    const parsedHeight = parseHeight(height);
    const parsedWeight = parseWeight(weight);
    if (!parsedBirthDate.value || !parsedHeight.value || !parsedWeight.value) return null;
    if (!sex || !activityLevel || !goal) return null;

    return calculateDailyTargets({
      weightKg: parsedWeight.value,
      heightCm: parsedHeight.value,
      age: ageFromBirthDate(new Date(parsedBirthDate.value), today),
      sex,
      activityLevel,
      goal,
    });
  }

  async function handleSave() {
    if (isSaving || !userId) return;

    if (!goal) {
      setErrors({ goal: 'Kies je doel.' });
      return;
    }
    // Re-check the earlier steps: someone can walk back and empty a field.
    if (!validateStepOne()) {
      setStep(1);
      return;
    }
    if (!validateStepTwo()) {
      setStep(2);
      return;
    }

    const parsedBirthDate = parseBirthDate(birthDate, today);
    const parsedHeight = parseHeight(height);
    const parsedWeight = parseWeight(weight);
    if (!parsedBirthDate.value || !parsedHeight.value || !parsedWeight.value || !sex || !activityLevel) {
      return;
    }

    setIsSaving(true);
    setFormError(undefined);
    try {
      const profileUpdate = {
        display_name: displayName.trim(),
        birth_date: parsedBirthDate.value,
        sex,
        height_cm: parsedHeight.value,
        activity_level: activityLevel,
        goal,
        onboarding_completed: true,
      };

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', userId)
        .select()
        .single();
      if (profileError) throw profileError;

      const date = todayIsoDate();

      // Upsert, not insert: stepping back into onboarding on the same day
      // should overwrite today's weigh-in, not hit the unique constraint.
      const { error: weightError } = await supabase
        .from('body_weights')
        .upsert(
          { user_id: userId, measured_on: date, weight_kg: parsedWeight.value },
          { onConflict: 'user_id,measured_on' },
        );
      if (weightError) throw weightError;

      await upsertDailyTargets(
        buildDailyTargetRow({
          userId,
          profile: profile as CompleteProfile,
          weightKg: parsedWeight.value,
          date,
          today,
        }),
      );

      // Refreshing the profile flips the guard in the root layout, which moves
      // us to Vandaag. No manual navigation needed.
      await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  const preview = step === 3 ? previewTargets() : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="caption" muted>
          Stap {step} van {TOTAL_STEPS}
        </Text>
        <Text variant="title">
          {step === 1 ? 'Over jou' : step === 2 ? 'Je gewicht en activiteit' : 'Je doel'}
        </Text>
        <Text muted>
          {step === 1
            ? 'Deze gegevens hebben we nodig om je caloriebehoefte te berekenen.'
            : step === 2
              ? 'Je gewicht bepaalt je eiwitdoel. Je kunt het later elke dag bijwerken.'
              : 'Kies wat je wilt bereiken. Je ziet meteen wat dat voor je dag betekent.'}
        </Text>
      </View>

      {step === 1 ? (
        <Card style={styles.form}>
          <Input
            label="Je naam"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.displayName}
            autoCapitalize="words"
            placeholder="Benjamin"
            editable={!isSaving}
          />
          <Input
            label="Geboortedatum"
            value={birthDate}
            onChangeText={setBirthDate}
            error={errors.birthDate}
            hint="Schrijf het als dd-mm-jjjj."
            placeholder="14-09-1998"
            keyboardType="numbers-and-punctuation"
            editable={!isSaving}
          />
          <ChoiceGroup
            label="Geslacht"
            options={SEX_OPTIONS}
            value={sex}
            onChange={setSex}
            error={errors.sex}
            disabled={isSaving}
          />
          <Input
            label="Lengte in cm"
            value={height}
            onChangeText={setHeight}
            error={errors.height}
            placeholder="180"
            keyboardType="numeric"
            editable={!isSaving}
          />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card style={styles.form}>
          <Input
            label="Huidig gewicht in kg"
            value={weight}
            onChangeText={setWeight}
            error={errors.weight}
            hint="Een komma mag: 82,5."
            placeholder="82,5"
            keyboardType="decimal-pad"
            editable={!isSaving}
          />
          <ChoiceGroup
            label="Hoe actief ben je?"
            options={ACTIVITY_OPTIONS}
            value={activityLevel}
            onChange={setActivityLevel}
            error={errors.activityLevel}
            disabled={isSaving}
          />
        </Card>
      ) : null}

      {step === 3 ? (
        <View style={styles.form}>
          <Card>
            <ChoiceGroup
              label="Wat wil je bereiken?"
              options={GOAL_OPTIONS}
              value={goal}
              onChange={setGoal}
              error={errors.goal}
              disabled={isSaving}
            />
          </Card>

          {preview ? (
            <Card>
              <Text variant="heading">Je dagdoel</Text>
              <View style={styles.previewRow}>
                <PreviewValue label="Calorieën" value={`${preview.kcal}`} unit="kcal" />
                <PreviewValue label="Eiwit" value={`${preview.proteinG}`} unit="g" />
              </View>
              <View style={styles.previewRow}>
                <PreviewValue label="Vet" value={`${preview.fatG}`} unit="g" />
                <PreviewValue label="Koolhydraten" value={`${preview.carbsG}`} unit="g" />
              </View>
              <Text variant="caption" muted>
                Je onderhoud is ongeveer {preview.tdeeKcal} kcal, je ruststofwisseling{' '}
                {preview.bmrKcal} kcal.
              </Text>

              {preview.warnings.map((warning) => (
                <Text key={warning} variant="caption" style={styles.warning}>
                  {TARGET_WARNING_MESSAGES[warning]}
                </Text>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      {formError ? (
        <Text variant="caption" style={styles.formError}>
          {formError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {step < TOTAL_STEPS ? (
          <Button title="Volgende" onPress={handleNext} disabled={isSaving} />
        ) : (
          <Button title="Opslaan en beginnen" onPress={handleSave} loading={isSaving} />
        )}

        {step > 1 ? (
          <Button
            title="Terug"
            variant="secondary"
            onPress={() => setStep((current) => current - 1)}
            disabled={isSaving}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function PreviewValue({ label, value, unit }: { label: string; value: string; unit: string }) {
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.lg },
  form: { gap: spacing.md },
  previewRow: { flexDirection: 'row', gap: spacing.md },
  previewValue: { flex: 1 },
  warning: { color: colors.warning },
  formError: { color: colors.danger, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
