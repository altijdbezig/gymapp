import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import {
  GOAL_LABELS,
  TARGET_WARNING_MESSAGES,
  warningsForRow,
} from '@/features/nutrition/dailyTargets';
import { useTodaysTargets } from '@/features/nutrition/useDailyTargets';
import { colors, radius, spacing } from '@/theme/theme';

export default function TodayScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const targetsQuery = useTodaysTargets(userId);

  const firstName = profileQuery.data?.display_name?.split(' ')[0];

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{firstName ? `Hoi ${firstName}` : 'Vandaag'}</Text>
        <Text muted>Dit is je doel voor vandaag.</Text>
      </View>

      {targetsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : null}

      {targetsQuery.isError ? (
        <Card>
          <Text variant="heading">Doelen niet geladen</Text>
          <Text muted>
            We konden je dagdoel niet ophalen. Controleer je internetverbinding en probeer het
            opnieuw.
          </Text>
          <Button
            title="Opnieuw proberen"
            variant="secondary"
            onPress={() => targetsQuery.refetch()}
          />
        </Card>
      ) : null}

      {targetsQuery.data ? <TargetsCard target={targetsQuery.data} /> : null}

      <Card style={styles.nextCard}>
        <Text variant="heading">Eten loggen</Text>
        <Text muted>
          Barcode scannen, zoeken en handmatig invoeren komen in fase 2. Je dagdoel staat er al
          klaar voor.
        </Text>
      </Card>
    </Screen>
  );
}

function TargetsCard({
  target,
}: {
  target: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    bmr_kcal: number;
    tdee_kcal: number;
    weight_kg: number;
    goal: keyof typeof GOAL_LABELS;
    clamped_to_bmr: boolean;
  };
}) {
  const warnings = warningsForRow(target);

  return (
    <Card style={styles.targetsCard}>
      <View style={styles.kcalBlock}>
        <Text variant="caption" muted>
          Calorieën
        </Text>
        <Text style={styles.kcalValue}>{target.kcal}</Text>
        <Text variant="caption" muted>
          kcal · {GOAL_LABELS[target.goal].toLowerCase()} bij {formatWeight(target.weight_kg)} kg
        </Text>
      </View>

      <View style={styles.macros}>
        <MacroBar label="Eiwit" grams={target.protein_g} color={colors.protein} />
        <MacroBar label="Vet" grams={target.fat_g} color={colors.fat} />
        <MacroBar label="Koolhydraten" grams={target.carbs_g} color={colors.carbs} />
      </View>

      <Text variant="caption" muted>
        Onderhoud ongeveer {target.tdee_kcal} kcal · ruststofwisseling {target.bmr_kcal} kcal
      </Text>

      {warnings.map((warning) => (
        <Text key={warning} variant="caption" style={styles.warning}>
          {TARGET_WARNING_MESSAGES[warning]}
        </Text>
      ))}
    </Card>
  );
}

/** One macro with a coloured bar underneath, so the split is readable at a glance. */
function MacroBar({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <View style={styles.macro}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <Text variant="heading">
        {grams} <Text variant="caption" muted>g</Text>
      </Text>
      <View style={[styles.macroBar, { backgroundColor: color }]} />
    </View>
  );
}

/** 82.5 stays 82,5 but 82.00 becomes 82 — no pointless decimals. */
function formatWeight(weightKg: number): string {
  return String(Number(weightKg)).replace('.', ',');
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  targetsCard: { gap: spacing.md },
  kcalBlock: { gap: 2 },
  kcalValue: { fontSize: 44, fontWeight: '700', color: colors.text },
  macros: { flexDirection: 'row', gap: spacing.md },
  macro: { flex: 1, gap: 2 },
  macroBar: { height: 4, borderRadius: radius.pill, marginTop: spacing.xs },
  warning: { color: colors.warning },
  nextCard: { marginTop: spacing.md },
});
