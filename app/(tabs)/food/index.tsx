import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DateStepper } from '@/components/DateStepper';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/auth/useProfile';
import { groupByMeal, sumEntries, type FoodLogEntry, type MealType } from '@/features/nutrition/foodLog';
import { formatPortion } from '@/features/nutrition/portions';
import {
  useAddWater,
  useRemoveLastWater,
  useWater,
} from '@/features/nutrition/useFoodExtras';
import { useDeleteLogEntry, useFoodLog } from '@/features/nutrition/useFoodLog';
import {
  formatMl,
  waterPresetLabel,
  waterProgress,
  DEFAULT_WATER_GOAL_ML,
  WATER_PRESETS_ML,
} from '@/features/nutrition/water';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { colors, radius, spacing } from '@/theme/theme';

/** The day's diary: what you ate, per meal, with a way to add more. */
export default function FoodLogScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const today = todayIsoDate();
  const [date, setDate] = useState(today);

  const profileQuery = useProfile(userId);
  const logQuery = useFoodLog(userId, date);
  const waterQuery = useWater(userId, date);
  const deleteEntry = useDeleteLogEntry();
  const addWater = useAddWater();
  const removeWater = useRemoveLastWater();

  const entries = logQuery.data ?? [];
  const dayTotals = sumEntries(entries);
  const meals = groupByMeal(entries);
  const water = waterProgress(
    waterQuery.data ?? [],
    profileQuery.data?.water_goal_ml ?? DEFAULT_WATER_GOAL_ML,
  );

  /** Adding to a specific meal keeps the search screen from having to guess. */
  function addTo(mealType: MealType) {
    router.push(`/(tabs)/food/search?meal=${mealType}&date=${date}`);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Eten</Text>
        <DateStepper value={date} onChange={setDate} today={today} />
        <Text muted>
          {entries.length === 0
            ? date === today
              ? 'Je hebt vandaag nog niets gelogd.'
              : 'Op deze dag is niets gelogd.'
            : `${dayTotals.kcal} kcal · ${dayTotals.proteinG} g eiwit`}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* Barcode scanning is native only -- a browser has no camera API we
            can use here, so on web the search and manual routes take over. */}
        {Platform.OS !== 'web' ? (
          <Button
            title="Barcode scannen"
            onPress={() => router.push(`/(tabs)/food/scan?date=${date}`)}
          />
        ) : null}

        <Button
          title="Product zoeken"
          variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
          onPress={() => router.push(`/(tabs)/food/search?date=${date}`)}
        />

        <View style={styles.actionRow}>
          <View style={styles.flex}>
            <Button
              title="Snelle invoer"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/food/quick?date=${date}`)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Mijn maaltijden"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/food/meals?date=${date}`)}
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.flex}>
            <Button
              title="Dag kopiëren"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/food/copy?date=${date}`)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Zelf invoeren"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/food/manual?date=${date}`)}
            />
          </View>
        </View>
      </View>

      {logQuery.isLoading ? (
        <Card>
          <ActivityIndicator color={colors.primary} />
        </Card>
      ) : null}

      {logQuery.isError ? (
        <Card style={styles.card}>
          <Text variant="heading">Dagboek niet geladen</Text>
          <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          <Button title="Opnieuw proberen" variant="secondary" onPress={() => logQuery.refetch()} />
        </Card>
      ) : null}

      {/* Water */}
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text variant="heading">Water</Text>
          <Text variant="caption" muted>
            {formatMl(water.totalMl)} van {formatMl(water.goalMl)}
          </Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${water.ratio * 100}%` }]} />
        </View>

        <View style={styles.waterButtons}>
          {WATER_PRESETS_ML.map((ml) => (
            <Pressable
              key={ml}
              accessibilityRole="button"
              accessibilityLabel={`${waterPresetLabel(ml)} van ${ml} milliliter toevoegen`}
              onPress={() => userId && addWater.mutate({ userId, ml, date })}
              style={({ pressed }) => [styles.waterButton, pressed && styles.pressed]}
            >
              <Ionicons name="water-outline" size={16} color={colors.primary} />
              <Text variant="caption" style={styles.waterLabel}>
                {ml} ml
              </Text>
            </Pressable>
          ))}

          {(waterQuery.data ?? []).length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Laatste glas verwijderen"
              onPress={() =>
                userId &&
                removeWater.mutate({ userId, date, entries: waterQuery.data ?? [] })
              }
              style={({ pressed }) => [styles.waterButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-undo-outline" size={16} color={colors.textMuted} />
              <Text variant="caption" muted>
                Ongedaan
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      {logQuery.data
        ? meals.map((meal) => (
            <Card key={meal.mealType} style={styles.meal}>
              <View style={styles.mealHeader}>
                <Text variant="heading" style={styles.flex}>
                  {meal.label}
                </Text>
                <Text variant="caption" muted>
                  {meal.totals.kcal} kcal
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Toevoegen aan ${meal.label}`}
                  onPress={() => addTo(meal.mealType)}
                  hitSlop={spacing.sm}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </Pressable>
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

      <View style={styles.footer}>
        <Button
          title="Dagdetail"
          variant="secondary"
          onPress={() => router.push(`/(tabs)/food/day?date=${date}`)}
        />
        <View style={styles.actionRow}>
          <View style={styles.flex}>
            <Button
              title="Gewicht"
              variant="secondary"
              onPress={() => router.push('/(tabs)/food/weight')}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Weekoverzicht"
              variant="secondary"
              onPress={() => router.push('/(tabs)/food/week')}
            />
          </View>
        </View>
        <Button
          title="Trends"
          variant="secondary"
          onPress={() => router.push('/(tabs)/food/trends')}
        />
      </View>
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
          {formatPortion(
            entry.portion_count === null ? null : Number(entry.portion_count),
            entry.portion_label,
            Number(entry.amount_g),
          )}{' '}
          · {kcal} kcal · {protein} g eiwit
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

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.md },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  waterButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  waterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterLabel: { color: colors.primary },
  meal: { gap: spacing.sm, marginBottom: spacing.md },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  pressed: { opacity: 0.6 },
  footer: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
});
