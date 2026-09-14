import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import {
  GOAL_LABELS,
  TARGET_WARNING_MESSAGES,
  warningsForRow,
} from '@/features/nutrition/dailyTargets';
import { buildProgress, EMPTY_TOTALS, sumEntries } from '@/features/nutrition/foodLog';
import { useTodaysTargets, type DailyTarget } from '@/features/nutrition/useDailyTargets';
import { useFoodLog } from '@/features/nutrition/useFoodLog';
import { colors, spacing } from '@/theme/theme';

/** The bar colour per macro, in the same order as buildProgress returns them. */
const BAR_COLORS = [colors.primary, colors.protein, colors.fat, colors.carbs];

export default function TodayScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const targetsQuery = useTodaysTargets(userId);
  const logQuery = useFoodLog(userId);

  const firstName = profileQuery.data?.display_name?.split(' ')[0];
  const target = targetsQuery.data;
  const eaten = logQuery.data ? sumEntries(logQuery.data) : EMPTY_TOTALS;

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{firstName ? `Hoi ${firstName}` : 'Vandaag'}</Text>
        <Text muted>
          {target
            ? `${GOAL_LABELS[target.goal]} · ${eaten.kcal} van ${target.kcal} kcal gegeten`
            : 'Dit is je doel voor vandaag.'}
        </Text>
      </View>

      {targetsQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : null}

      {targetsQuery.isError ? (
        <Card style={styles.card}>
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

      {target ? <DayOverview target={target} eaten={eaten} isLoadingLog={logQuery.isLoading} /> : null}

      <Card style={styles.card}>
        <Text variant="heading">Snel loggen</Text>
        <Text muted>Voeg toe wat je hebt gegeten.</Text>
        <Link href="/(tabs)/food" asChild>
          <Button title="Naar je dagboek" variant="secondary" onPress={() => {}} />
        </Link>
      </Card>
    </Screen>
  );
}

function DayOverview({
  target,
  eaten,
  isLoadingLog,
}: {
  target: DailyTarget;
  eaten: { kcal: number; proteinG: number; fatG: number; carbsG: number };
  isLoadingLog: boolean;
}) {
  const bars = buildProgress(eaten, {
    kcal: target.kcal,
    proteinG: target.protein_g,
    fatG: target.fat_g,
    carbsG: target.carbs_g,
  });

  const [kcalBar] = bars;
  const warnings = warningsForRow(target);

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.kcalBlock}>
          <Text variant="caption" muted>
            {kcalBar.isOver ? 'Over je doel' : 'Nog te eten'}
          </Text>
          <Text style={styles.kcalValue}>
            {kcalBar.isOver ? eaten.kcal - target.kcal : kcalBar.remaining}
          </Text>
          <Text variant="caption" muted>
            kcal · gegeten {eaten.kcal} van {target.kcal}
          </Text>
        </View>

        {isLoadingLog ? <ActivityIndicator color={colors.primary} /> : null}

        <View style={styles.bars}>
          {bars.map((bar, index) => (
            <ProgressBar
              key={bar.label}
              label={bar.label}
              eaten={bar.eaten}
              target={bar.target}
              ratio={bar.ratio}
              isOver={bar.isOver}
              unit={bar.unit}
              color={BAR_COLORS[index]}
            />
          ))}
        </View>
      </Card>

      {warnings.length > 0 ? (
        <Card style={styles.card}>
          {warnings.map((warning) => (
            <Text key={warning} variant="caption" style={styles.warning}>
              {TARGET_WARNING_MESSAGES[warning]}
            </Text>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.lg },
  card: { gap: spacing.md, marginBottom: spacing.md },
  kcalBlock: { gap: 2 },
  kcalValue: { fontSize: 44, fontWeight: '700', color: colors.text },
  bars: { gap: spacing.md },
  warning: { color: colors.warning },
});
