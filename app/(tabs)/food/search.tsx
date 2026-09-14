import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import type { FoodInsert } from '@/features/nutrition/offMapping';
import { cacheOffFood, useMyFoods, useOffSearch } from '@/features/nutrition/useFoodLog';
import { OpenFoodFactsError } from '@/lib/openFoodFacts';
import { colors, radius, spacing } from '@/theme/theme';

/** Typing pauses for this long before a request goes out. */
const DEBOUNCE_MS = 600;

/**
 * Search: your own products first, then Open Food Facts.
 *
 * The debounce matters as much as the rate limiter in the wrapper: without it
 * every keystroke would queue a request and the limiter would just make you
 * wait for all of them.
 */
export default function FoodSearchScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectingKey, setSelectingKey] = useState<string>();
  const [selectError, setSelectError] = useState<string>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const myFoodsQuery = useMyFoods(userId);
  const offQuery = useOffSearch(debouncedQuery, true);

  const needle = query.trim().toLowerCase();
  const myMatches =
    needle.length === 0
      ? []
      : (myFoodsQuery.data ?? []).filter((food) =>
          `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(needle),
        );

  /** A cached-or-new food gets an id first, then we go to the amount screen. */
  async function handlePickOff(item: { food: FoodInsert; key: string }) {
    if (selectingKey) return;

    setSelectingKey(item.key);
    setSelectError(undefined);
    try {
      const food = await cacheOffFood(item.food);
      router.push({ pathname: '/(tabs)/food/amount', params: { foodId: food.id } });
    } catch {
      setSelectError('Opslaan van dit product mislukte. Probeer het opnieuw.');
    } finally {
      setSelectingKey(undefined);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Product zoeken</Text>
        <Text muted>Zoek in je eigen producten en in Open Food Facts.</Text>
      </View>

      <Input
        label="Zoeken"
        value={query}
        onChangeText={setQuery}
        placeholder="magere kwark"
        hint="Vanaf 3 letters wordt er gezocht."
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
      />

      {myMatches.length > 0 ? (
        <Card style={styles.section}>
          <Text variant="heading">Je eigen producten</Text>
          {myMatches.map((food) => (
            <ResultRow
              key={food.id}
              name={food.name}
              brand={food.brand}
              kcal={food.kcal_per_100g}
              protein={food.protein_per_100g}
              onPress={() =>
                router.push({ pathname: '/(tabs)/food/amount', params: { foodId: food.id } })
              }
            />
          ))}
        </Card>
      ) : null}

      {query.trim().length > 0 && query.trim().length < 3 ? (
        <Text variant="caption" muted style={styles.notice}>
          Typ nog even door — vanaf 3 letters zoeken we bij Open Food Facts.
        </Text>
      ) : null}

      {offQuery.isFetching ? (
        <Card style={styles.section}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption" muted style={styles.centered}>
            Zoeken bij Open Food Facts…
          </Text>
        </Card>
      ) : null}

      {offQuery.isError ? (
        <Card style={styles.section}>
          <Text variant="heading">Zoeken mislukt</Text>
          <Text muted>{searchErrorMessage(offQuery.error)}</Text>
          <Button title="Opnieuw proberen" variant="secondary" onPress={() => offQuery.refetch()} />
        </Card>
      ) : null}

      {offQuery.data && !offQuery.isFetching ? (
        offQuery.data.length === 0 ? (
          <Card style={styles.section}>
            <Text variant="heading">Niets gevonden</Text>
            <Text muted>
              Open Food Facts kent dit product niet, of het heeft geen voedingswaarden. Je kunt het
              zelf invoeren.
            </Text>
            <Button
              title="Zelf invoeren"
              variant="secondary"
              onPress={() => router.push('/(tabs)/food/manual')}
            />
          </Card>
        ) : (
          <Card style={styles.section}>
            <Text variant="heading">Open Food Facts</Text>
            {offQuery.data.map((item) => (
              <ResultRow
                key={item.key}
                name={item.food.name}
                brand={item.food.brand}
                kcal={item.food.kcal_per_100g}
                protein={item.food.protein_per_100g}
                isBusy={selectingKey === item.key}
                onPress={() => handlePickOff(item)}
              />
            ))}
          </Card>
        )
      ) : null}

      {selectError ? (
        <Text variant="caption" style={styles.error}>
          {selectError}
        </Text>
      ) : null}
    </Screen>
  );
}

function ResultRow({
  name,
  brand,
  kcal,
  protein,
  onPress,
  isBusy = false,
}: {
  name: string;
  brand: string | null | undefined;
  kcal: number;
  protein: number;
  onPress: () => void;
  isBusy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} toevoegen`}
      accessibilityState={{ busy: isBusy }}
      onPress={onPress}
      disabled={isBusy}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, isBusy && styles.rowBusy]}
    >
      <View style={styles.rowText}>
        <Text variant="label">{name}</Text>
        <Text variant="caption" muted>
          {brand ? `${brand} · ` : ''}
          {Math.round(kcal)} kcal · {Math.round(protein)} g eiwit per 100 g
        </Text>
      </View>
      {isBusy ? <ActivityIndicator color={colors.primary} /> : null}
    </Pressable>
  );
}

/** Open Food Facts failures get their own Dutch sentence, like auth errors do. */
function searchErrorMessage(error: unknown): string {
  if (error instanceof OpenFoodFactsError) {
    switch (error.kind) {
      case 'offline':
        return 'Geen internetverbinding. Controleer je verbinding en probeer het opnieuw.';
      case 'timeout':
        return 'Open Food Facts reageert traag. Probeer het zo nog eens.';
      case 'server':
        return 'Open Food Facts is even niet bereikbaar. Probeer het later opnieuw.';
      default:
        return 'Zoeken lukte niet. Probeer het opnieuw.';
    }
  }
  return 'Zoeken lukte niet. Probeer het opnieuw.';
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.md },
  section: { gap: spacing.sm, marginTop: spacing.md },
  notice: { marginTop: spacing.md },
  centered: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.background },
  rowBusy: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  error: { color: colors.danger, marginTop: spacing.md },
});
