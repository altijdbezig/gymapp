/**
 * "Recent" and "vaak gegeten".
 *
 * Both are derived from the diary rather than stored anywhere: the history
 * already knows what you eat, and a second table that could drift out of step
 * with it would be worse than a Map.
 *
 * The key is the product where there is one, and the name where there is not --
 * a quick entry called "Snackbar" has no food_id but is still worth offering
 * again next Friday.
 */
import type { FoodLogEntry } from './foodLog';

export type Suggestion = {
  /** Stable key for a list, and what the amount screen is opened with. */
  key: string;
  foodId: string | null;
  name: string;
  brand: string | null;

  kcalPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  saturatedFatPer100g: number | null;
  saltPer100g: number | null;

  /** The amount you logged last time, so the button can offer it again. */
  lastAmountG: number;
  lastPortionLabel: string | null;
  lastPortionCount: number | null;
  lastLoggedOn: string;
  /** How often it appears in the history that was looked at. */
  count: number;
};

function num(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optional(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function keyFor(entry: FoodLogEntry): string {
  return entry.food_id ?? `name:${entry.name.trim().toLowerCase()}`;
}

function toSuggestion(entry: FoodLogEntry, count: number): Suggestion {
  return {
    key: keyFor(entry),
    foodId: entry.food_id,
    name: entry.name,
    brand: entry.brand,
    kcalPer100g: num(entry.kcal_per_100g),
    proteinPer100g: num(entry.protein_per_100g),
    fatPer100g: num(entry.fat_per_100g),
    carbsPer100g: num(entry.carbs_per_100g),
    fiberPer100g: optional(entry.fiber_per_100g),
    sugarsPer100g: optional(entry.sugars_per_100g),
    saturatedFatPer100g: optional(entry.saturated_fat_per_100g),
    saltPer100g: optional(entry.salt_per_100g),
    lastAmountG: num(entry.amount_g),
    lastPortionLabel: entry.portion_label,
    lastPortionCount: optional(entry.portion_count),
    lastLoggedOn: entry.logged_on,
    count,
  };
}

/**
 * Groups the history by product, newest occurrence first.
 *
 * The numbers come from the newest entry, so a product whose macros were
 * corrected is offered with the values you logged most recently.
 */
function group(entries: readonly FoodLogEntry[]): Suggestion[] {
  const newest = new Map<string, { entry: FoodLogEntry; count: number }>();

  for (const entry of entries) {
    const key = keyFor(entry);
    const current = newest.get(key);

    if (!current) {
      newest.set(key, { entry, count: 1 });
      continue;
    }

    const isNewer =
      entry.logged_on > current.entry.logged_on ||
      (entry.logged_on === current.entry.logged_on && entry.created_at > current.entry.created_at);

    newest.set(key, {
      entry: isNewer ? entry : current.entry,
      count: current.count + 1,
    });
  }

  return [...newest.values()].map(({ entry, count }) => toSuggestion(entry, count));
}

/** Most recently eaten first. */
export function recentFoods(entries: readonly FoodLogEntry[], limit = 30): Suggestion[] {
  return group(entries)
    .sort((a, b) => b.lastLoggedOn.localeCompare(a.lastLoggedOn))
    .slice(0, limit);
}

/**
 * Most often eaten first, with the most recent winning a tie.
 *
 * Something you ate once does not belong in a "vaak gegeten" list, so a
 * minimum of two appearances is required; the recent tab already covers those.
 */
export function frequentFoods(
  entries: readonly FoodLogEntry[],
  limit = 30,
  minimumCount = 2,
): Suggestion[] {
  return group(entries)
    .filter((suggestion) => suggestion.count >= minimumCount)
    .sort((a, b) => b.count - a.count || b.lastLoggedOn.localeCompare(a.lastLoggedOn))
    .slice(0, limit);
}

/** Filters a list of suggestions by what is typed in the search box. */
export function filterSuggestions(
  suggestions: readonly Suggestion[],
  query: string,
): Suggestion[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...suggestions];

  return suggestions.filter((suggestion) =>
    `${suggestion.name} ${suggestion.brand ?? ''}`.toLowerCase().includes(needle),
  );
}

/** "125 kcal · 12 g eiwit per 100 g" -- the second line of a suggestion row. */
export function describeSuggestion(suggestion: Suggestion): string {
  const kcal = Math.round(suggestion.kcalPer100g);
  const protein = Math.round(suggestion.proteinPer100g);
  const brand = suggestion.brand ? `${suggestion.brand} · ` : '';

  return `${brand}${kcal} kcal · ${protein} g eiwit per 100 g`;
}
