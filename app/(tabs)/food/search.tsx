import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { pickedFromFood, useFoodPicker, type PickedFood } from '@/features/nutrition/FoodPicker';
import {
  describeSuggestion,
  filterSuggestions,
  frequentFoods,
  recentFoods,
  type Suggestion,
} from '@/features/nutrition/foodSuggestions';
import type { FoodInsert } from '@/features/nutrition/offMapping';
import {
  useFavorites,
  useFoodHistory,
  useToggleFavorite,
} from '@/features/nutrition/useFoodExtras';
import { cacheOffFood, useMyFoods, useOffSearch } from '@/features/nutrition/useFoodLog';
import { OpenFoodFactsError } from '@/lib/openFoodFacts';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';

/** Typing pauses for this long before a request goes out. */
const DEBOUNCE_MS = 600;

type Tab = 'search' | 'favorites' | 'recent' | 'frequent';

const TABS: readonly Segment<Tab>[] = [
  { value: 'search', label: 'Zoeken' },
  { value: 'favorites', label: 'Favorieten' },
  { value: 'recent', label: 'Recent' },
  { value: 'frequent', label: 'Vaak' },
];

/**
 * Finding something to log.
 *
 * Four tabs, and the last three are the ones that get used: almost everything
 * you eat you have eaten before, so favourites, recent and frequent put your
 * daily products one tap away and searching Open Food Facts is the exception
 * rather than the rule.
 *
 * The debounce on the search tab matters as much as the rate limiter in the
 * wrapper: without it every keystroke would queue a request and the limiter
 * would just make you wait for all of them.
 */
export default function FoodSearchScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { meal, date, mode } = useLocalSearchParams<{
    meal?: string;
    date?: string;
    /** 'pick' means: hand the product back instead of logging it. */
    mode?: string;
  }>();
  const isPicking = mode === 'pick';

  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [tab, setTab] = useState<Tab>('recent');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectingKey, setSelectingKey] = useState<string>();
  const [selectError, setSelectError] = useState<string>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const myFoodsQuery = useMyFoods(userId);
  const offQuery = useOffSearch(debouncedQuery, tab === 'search');
  const historyQuery = useFoodHistory(userId);
  const favoritesQuery = useFavorites(userId);
  const toggleFavorite = useToggleFavorite(userId);
  const picker = useFoodPicker();

  const favoriteIds = new Set(
    (favoritesQuery.data ?? []).map((favorite) => favorite.food_id),
  );

  const recent = useMemo(
    () => filterSuggestions(recentFoods(historyQuery.data ?? []), query),
    [historyQuery.data, query],
  );
  const frequent = useMemo(
    () => filterSuggestions(frequentFoods(historyQuery.data ?? []), query),
    [historyQuery.data, query],
  );

  const needle = query.trim().toLowerCase();
  const myMatches =
    needle.length === 0
      ? []
      : (myFoodsQuery.data ?? []).filter((food) =>
          `${food.name} ${food.brand ?? ''}`.toLowerCase().includes(needle),
        );

  /**
   * Every route into the amount screen carries the meal and the day along.
   * In picking mode there is no amount screen: the product goes straight back
   * to whoever asked for it.
   */
  async function openAmount(params: Record<string, string>) {
    if (isPicking && params.foodId) {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('id', params.foodId)
        .single();

      if (error || !data) {
        setSelectError('Dit product kon niet worden opgehaald.');
        return;
      }

      picker.resolve(pickedFromFood(data));
      return;
    }

    const search = new URLSearchParams({
      ...(meal ? { meal } : {}),
      ...(date ? { date } : {}),
      ...params,
    });
    router.push(`/(tabs)/food/amount?${search.toString()}`);
  }

  /** A cached-or-new food gets an id first, then we go to the amount screen. */
  async function handlePickOff(item: { food: FoodInsert; key: string }) {
    if (selectingKey) return;

    setSelectingKey(item.key);
    setSelectError(undefined);
    try {
      const food = await cacheOffFood(item.food);
      await openAmount({ foodId: food.id });
    } catch {
      setSelectError('Opslaan van dit product mislukte. Probeer het opnieuw.');
    } finally {
      setSelectingKey(undefined);
    }
  }

  function openSuggestion(suggestion: Suggestion) {
    if (suggestion.foodId) {
      void openAmount({ foodId: suggestion.foodId });
      return;
    }

    // A quick entry has no product row. In picking mode its numbers are still
    // perfectly usable as a meal item, so they go back as-is.
    if (isPicking) {
      const picked: PickedFood = {
        foodId: null,
        name: suggestion.name,
        brand: suggestion.brand,
        kcalPer100g: suggestion.kcalPer100g,
        proteinPer100g: suggestion.proteinPer100g,
        fatPer100g: suggestion.fatPer100g,
        carbsPer100g: suggestion.carbsPer100g,
        fiberPer100g: suggestion.fiberPer100g,
        sugarsPer100g: suggestion.sugarsPer100g,
        saturatedFatPer100g: suggestion.saturatedFatPer100g,
        saltPer100g: suggestion.saltPer100g,
        servingSizeG: null,
      };
      picker.resolve(picked);
      return;
    }
    router.push(
      `/(tabs)/food/quick?${new URLSearchParams({
        ...(meal ? { meal } : {}),
        ...(date ? { date } : {}),
        name: suggestion.name,
        kcal: String(Math.round(suggestion.kcalPer100g * (suggestion.lastAmountG / 100))),
        protein: String(Math.round(suggestion.proteinPer100g * (suggestion.lastAmountG / 100))),
      }).toString()}`,
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={isPicking ? 'Product kiezen' : 'Toevoegen'}
        subtitle={picker.subtitle() ?? 'Je favorieten en wat je vaker eet staan hier klaar.'}
      />

      <SegmentedControl segments={TABS} value={tab} onChange={setTab} label="Wat wil je zien?" />

      <Input
        label="Zoeken"
        value={query}
        onChangeText={setQuery}
        placeholder="magere kwark"
        hint={tab === 'search' ? 'Vanaf 3 letters wordt er gezocht.' : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {tab === 'search' ? (
        <SearchTab
          query={query}
          myMatches={myMatches}
          offQuery={offQuery}
          selectingKey={selectingKey}
          onPickOwn={(foodId) => void openAmount({ foodId })}
          onPickOff={handlePickOff}
          date={date}
        />
      ) : null}

      {tab === 'favorites' ? (
        favoritesQuery.isLoading ? (
          <Card>
            <ActivityIndicator color={palette.primary} />
          </Card>
        ) : (favoritesQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon="star-outline"
            title="Nog geen favorieten"
            description="Tik op het sterretje bij een product dat je vaak eet, dan staat het hier klaar."
            actionLabel="Product zoeken"
            onAction={() => setTab('search')}
          />
        ) : (
          <Card style={styles.section}>
            {(favoritesQuery.data ?? [])
              .filter(
                (favorite) =>
                  favorite.food &&
                  `${favorite.food.name} ${favorite.food.brand ?? ''}`
                    .toLowerCase()
                    .includes(needle),
              )
              .map((favorite) => (
                <ResultRow
                  key={favorite.id}
                  name={favorite.food!.name}
                  brand={favorite.food!.brand}
                  kcal={favorite.food!.kcal_per_100g}
                  protein={favorite.food!.protein_per_100g}
                  isFavorite
                  onToggleFavorite={() =>
                    toggleFavorite.mutate({ foodId: favorite.food_id, isFavorite: true })
                  }
                  onPress={() => void openAmount({ foodId: favorite.food_id })}
                />
              ))}
          </Card>
        )
      ) : null}

      {tab === 'recent' || tab === 'frequent' ? (
        historyQuery.isLoading ? (
          <Card>
            <ActivityIndicator color={palette.primary} />
          </Card>
        ) : (tab === 'recent' ? recent : frequent).length === 0 ? (
          <EmptyState
            icon="time-outline"
            title={tab === 'recent' ? 'Nog niets gelogd' : 'Nog niets vaak gegeten'}
            description={
              tab === 'recent'
                ? 'Zodra je iets logt, staat het hier klaar om zo weer toe te voegen.'
                : 'Producten die je vaker dan één keer logt, verschijnen hier.'
            }
            actionLabel="Product zoeken"
            onAction={() => setTab('search')}
          />
        ) : (
          <Card style={styles.section}>
            {(tab === 'recent' ? recent : frequent).map((suggestion) => (
              <ResultRow
                key={suggestion.key}
                name={suggestion.name}
                brand={suggestion.brand}
                subtitle={describeSuggestion(suggestion)}
                detail={tab === 'frequent' ? `${suggestion.count}×` : undefined}
                isFavorite={suggestion.foodId ? favoriteIds.has(suggestion.foodId) : false}
                onToggleFavorite={
                  suggestion.foodId
                    ? () =>
                        toggleFavorite.mutate({
                          foodId: suggestion.foodId!,
                          isFavorite: favoriteIds.has(suggestion.foodId!),
                        })
                    : undefined
                }
                onPress={() => openSuggestion(suggestion)}
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

function SearchTab({
  query,
  myMatches,
  offQuery,
  selectingKey,
  onPickOwn,
  onPickOff,
  date,
}: {
  query: string;
  myMatches: { id: string; name: string; brand: string | null; kcal_per_100g: number; protein_per_100g: number }[];
  offQuery: ReturnType<typeof useOffSearch>;
  selectingKey: string | undefined;
  onPickOwn: (foodId: string) => void;
  onPickOff: (item: { food: FoodInsert; key: string }) => void;
  date?: string;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <>
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
              onPress={() => onPickOwn(food.id)}
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
          <ActivityIndicator color={palette.primary} />
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
              onPress={() =>
                router.push(`/(tabs)/food/manual${date ? `?date=${date}` : ''}`)
              }
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
                onPress={() => onPickOff(item)}
              />
            ))}
          </Card>
        )
      ) : null}
    </>
  );
}

function ResultRow({
  name,
  brand,
  kcal,
  protein,
  subtitle,
  detail,
  onPress,
  isBusy = false,
  isFavorite,
  onToggleFavorite,
}: {
  name: string;
  brand?: string | null;
  kcal?: number;
  protein?: number;
  subtitle?: string;
  detail?: string;
  onPress: () => void;
  isBusy?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const line =
    subtitle ??
    `${brand ? `${brand} · ` : ''}${Math.round(kcal ?? 0)} kcal · ${Math.round(
      protein ?? 0,
    )} g eiwit per 100 g`;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} toevoegen`}
        accessibilityState={{ busy: isBusy }}
        onPress={onPress}
        disabled={isBusy}
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed, isBusy && styles.rowBusy]}
      >
        <View style={styles.rowText}>
          <Text variant="label">{name}</Text>
          <Text variant="caption" muted>
            {line}
          </Text>
        </View>
        {detail ? (
          <Text variant="caption" muted>
            {detail}
          </Text>
        ) : null}
        {isBusy ? <ActivityIndicator color={palette.primary} /> : null}
      </Pressable>

      {onToggleFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? `${name} uit favorieten` : `${name} als favoriet`}
          onPress={onToggleFavorite}
          hitSlop={spacing.sm}
          style={({ pressed }) => pressed && styles.rowBusy}
        >
          <Ionicons
            name={isFavorite ? 'star' : 'star-outline'}
            size={20}
            color={isFavorite ? palette.warning : palette.textMuted}
          />
        </Pressable>
      ) : null}
    </View>
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.md },
  notice: { marginTop: spacing.md },
  centered: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  rowPressed: { backgroundColor: colors.background },
  rowBusy: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  error: { color: colors.danger, marginTop: spacing.md },
});
