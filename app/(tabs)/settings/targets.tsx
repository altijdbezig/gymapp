import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import {
  TARGET_WARNING_MESSAGES,
  warningsForRow,
} from '@/features/nutrition/dailyTargets';
import { MANUAL_TARGET_NOTE } from '@/features/nutrition/manualTargets';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Setting your own targets.
 *
 * Leaving a field empty keeps the calculated value, so you can override only
 * the calories and let the macros follow. What you cannot do is go below your
 * BMR or more than 500 kcal under maintenance -- those two floors hold for a
 * typed-in number exactly as they do for a calculated one, and the screen says
 * so before you save rather than silently changing what you wrote.
 */
export default function TargetSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const targetsQuery = useTodaysTargets(userId);
  const updateProfile = useUpdateProfile(userId);

  const profile = profileQuery.data;

  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isLoaded || !profile) return;

    setKcal(profile.manual_kcal === null ? '' : String(profile.manual_kcal));
    setProtein(profile.manual_protein_g === null ? '' : String(profile.manual_protein_g));
    setFat(profile.manual_fat_g === null ? '' : String(profile.manual_fat_g));
    setCarbs(profile.manual_carbs_g === null ? '' : String(profile.manual_carbs_g));
    setIsLoaded(true);
  }, [profile, isLoaded]);

  const target = targetsQuery.data;
  const warnings = target ? warningsForRow(target) : [];

  async function handleSave() {
    await updateProfile.mutateAsync({
      manual_kcal: toNumber(kcal),
      manual_protein_g: toNumber(protein),
      manual_fat_g: toNumber(fat),
      manual_carbs_g: toNumber(carbs),
    });

    setSaved(true);
    // The stored target for today was built from the old numbers, so it has to
    // be rebuilt before the new ones show up on Vandaag.
    await targetsQuery.refetch();
  }

  async function handleReset() {
    setKcal('');
    setProtein('');
    setFat('');
    setCarbs('');

    await updateProfile.mutateAsync({
      manual_kcal: null,
      manual_protein_g: null,
      manual_fat_g: null,
      manual_carbs_g: null,
    });

    setSaved(true);
    await targetsQuery.refetch();
  }

  if (profileQuery.isLoading || !profile) {
    return (
      <Screen>
        <ScreenHeader title="Doelen" />
        <ActivityIndicator />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Doelen"
        subtitle="Zelf invullen, of laten uitrekenen uit je profiel."
      />

      {target ? (
        <Card style={styles.card}>
          <Text variant="heading">Je doel vandaag</Text>
          <View style={styles.stats}>
            <Stat label="Calorieën" value={`${target.kcal} kcal`} />
            <Stat label="Eiwit" value={`${target.protein_g} g`} />
            <Stat label="Vet" value={`${target.fat_g} g`} />
            <Stat label="Koolhydraten" value={`${target.carbs_g} g`} />
          </View>
          <Text variant="caption" muted>
            Rustverbruik {target.bmr_kcal} kcal · onderhoud {target.tdee_kcal} kcal
          </Text>

          {warnings.map((warning) => (
            <Text key={warning} variant="caption" style={styles.warning}>
              {TARGET_WARNING_MESSAGES[warning]}
            </Text>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text variant="heading">Zelf invullen</Text>
        <Text variant="caption" muted>
          Laat een veld leeg om het te laten uitrekenen.
        </Text>

        <Input
          label="Calorieën"
          value={kcal}
          onChangeText={(value) => {
            setKcal(value);
            setSaved(false);
          }}
          placeholder={String(target?.kcal ?? 2400)}
          keyboardType="number-pad"
        />
        <Input
          label="Eiwit in gram"
          value={protein}
          onChangeText={(value) => {
            setProtein(value);
            setSaved(false);
          }}
          placeholder={String(target?.protein_g ?? 160)}
          keyboardType="number-pad"
        />
        <Input
          label="Vet in gram"
          value={fat}
          onChangeText={(value) => {
            setFat(value);
            setSaved(false);
          }}
          placeholder={String(target?.fat_g ?? 70)}
          keyboardType="number-pad"
        />
        <Input
          label="Koolhydraten in gram"
          value={carbs}
          onChangeText={(value) => {
            setCarbs(value);
            setSaved(false);
          }}
          placeholder={String(target?.carbs_g ?? 250)}
          keyboardType="number-pad"
        />

        <Text variant="caption" muted>
          {MANUAL_TARGET_NOTE}
        </Text>

        {saved ? (
          <Text variant="caption" style={styles.success}>
            Opgeslagen. Je doel voor vandaag is opnieuw berekend; eerdere dagen blijven zoals ze
            waren.
          </Text>
        ) : null}

        <Button title="Opslaan" loading={updateProfile.isPending} onPress={handleSave} />
        <Button
          title="Terug naar de berekening"
          variant="secondary"
          onPress={handleReset}
          disabled={updateProfile.isPending}
        />
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">{value}</Text>
    </View>
  );
}

/** An empty field means "use the calculation", not "zero". */
function toNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  const parsed = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { gap: spacing.md, marginBottom: spacing.md },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    stat: { flexGrow: 1, flexBasis: '40%', gap: 2 },
    warning: { color: colors.warning },
    success: { color: colors.success },
  });
