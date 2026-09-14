import { Link } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupByMeal, sumEntries, type FoodLogEntry } from '@/features/nutrition/foodLog';
import { useDeleteLogEntry, useFoodLog } from '@/features/nutrition/useFoodLog';
import { colors, radius, spacing } from '@/theme/theme';

/** The day's diary: what you ate, per meal, with a way to add more. */
export default function FoodLogScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const logQuery = useFoodLog(userId);
  const deleteEntry = useDeleteLogEntry();

  const entries = logQuery.data ?? [];
  const dayTotals = sumEntries(entries);
  const meals = groupByMeal(entries);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Eten</Text>
        <Text muted>
          {entries.length === 0
            ? 'Je hebt vandaag nog niets gelogd.'
            : `${dayTotals.kcal} kcal · ${dayTotals.proteinG} g eiwit vandaag`}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* Barcode scanning is native only -- a browser has no camera API we
            can use here, so on web the search and manual routes take over. */}
        {Platform.OS !== 'web' ? (
          <Link href="/(tabs)/food/scan" asChild>
            <Button title="Barcode scannen" onPress={() => {}} />
          </Link>
        ) : null}

        <Link href="/(tabs)/food/search" asChild>
          <Button
            title="Product zoeken"
            variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
            onPress={() => {}}
          />
        </Link>

        <Link href="/(tabs)/food/manual" asChild>
          <Button title="Zelf invoeren" variant="secondary" onPress={() => {}} />
        </Link>
      </View>

      {logQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : null}

      {logQuery.isError ? (
        <Card>
          <Text variant="heading">Dagboek niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button title="Opnieuw proberen" variant="secondary" onPress={() => logQuery.refetch()} />
        </Card>
      ) : null}

      {logQuery.data
        ? meals.map((meal) => (
            <Card key={meal.mealType} style={styles.meal}>
              <View style={styles.mealHeader}>
                <Text variant="heading">{meal.label}</Text>
                <Text variant="caption" muted>
                  {meal.totals.kcal} kcal
                </Text>
              </View>

              {meal.entries.length === 0 ? (
                <Text variant="caption" muted>
                  Nog niets gelogd.
                </Text>
              ) : (
                meal.entries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onDelete={() => deleteEntry.mutate(entry)}
                    isDeleting={deleteEntry.isPending && deleteEntry.variables?.id === entry.id}
                  />
                ))
              )}
            </Card>
          ))
        : null}
    </Screen>
  );
}

function EntryRow({
  entry,
  onDelete,
  isDeleting,
}: {
  entry: FoodLogEntry;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const kcal = Math.round(Number(entry.kcal ?? 0));
  const protein = Math.round(Number(entry.protein_g ?? 0));

  return (
    <View style={[styles.entry, isDeleting && styles.entryDeleting]}>
      <View style={styles.entryText}>
        <Text variant="label">{entry.name}</Text>
        <Text variant="caption" muted>
          {entry.brand ? `${entry.brand} · ` : ''}
          {formatAmount(entry.amount_g)} g · {kcal} kcal · {protein} g eiwit
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.name} verwijderen`}
        onPress={onDelete}
        disabled={isDeleting}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
      >
        <Text variant="label" style={styles.deleteLabel}>
          Wis
        </Text>
      </Pressable>
    </View>
  );
}

/** 150.00 reads as 150; a real decimal keeps a Dutch comma. */
function formatAmount(amountG: number): string {
  return String(Number(amountG)).replace('.', ',');
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.md },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  meal: { gap: spacing.sm, marginBottom: spacing.md },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  entryDeleting: { opacity: 0.5 },
  entryText: { flex: 1, gap: 2 },
  delete: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm },
  deletePressed: { backgroundColor: colors.background },
  deleteLabel: { color: colors.danger },
});
