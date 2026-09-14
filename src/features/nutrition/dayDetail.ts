/**
 * The day detail screen: where the calories actually went.
 *
 * Three questions, three functions:
 *   - how do my macros split up?        macroSplit
 *   - which meal was the big one?       perMealShare
 *   - what did most of it come from?    biggestContributors
 *
 * All pure, all rounded once at the end, so the percentages on screen add up to
 * a hundred instead of to ninety-nine.
 */
import type { FoodLogEntry, MealType } from './foodLog';
import { MEAL_LABELS, MEAL_TYPES, sumEntries, type MacroTotals } from './foodLog';

/** Grams of macro per kilocalorie, the standard Atwater factors. */
export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const;

export type MacroSlice = {
  key: 'protein' | 'fat' | 'carbs';
  label: string;
  grams: number;
  kcal: number;
  /** 0 to 100, and the three slices always add up to exactly 100. */
  percent: number;
};

/**
 * The pie chart on the day detail.
 *
 * The split is by calories, not by grams: 50 g of fat is nearly twice the
 * energy of 50 g of protein, and a chart by grams would suggest otherwise.
 *
 * The percentages are worked out with the largest-remainder method, so they
 * always total 100 and the chart has no sliver of empty space in it.
 */
export function macroSplit(totals: MacroTotals): MacroSlice[] {
  const raw = [
    { key: 'protein' as const, label: 'Eiwit', grams: totals.proteinG },
    { key: 'fat' as const, label: 'Vet', grams: totals.fatG },
    { key: 'carbs' as const, label: 'Koolhydraten', grams: totals.carbsG },
  ].map((slice) => ({ ...slice, kcal: slice.grams * KCAL_PER_GRAM[slice.key] }));

  const totalKcal = raw.reduce((running, slice) => running + slice.kcal, 0);

  if (totalKcal <= 0) {
    return raw.map((slice) => ({ ...slice, percent: 0 }));
  }

  const exact = raw.map((slice) => ({ ...slice, exact: (slice.kcal / totalKcal) * 100 }));
  const floored = exact.map((slice) => ({ ...slice, percent: Math.floor(slice.exact) }));

  // Hand the leftover whole percents to the slices with the biggest remainder.
  let remainder = 100 - floored.reduce((running, slice) => running + slice.percent, 0);
  const byRemainder = [...floored].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
  );

  for (const slice of byRemainder) {
    if (remainder <= 0) break;
    slice.percent += 1;
    remainder -= 1;
  }

  return floored.map(({ key, label, grams, kcal, percent }) => ({
    key,
    label,
    grams,
    kcal: Math.round(kcal),
    percent,
  }));
}

export type MealShare = {
  mealType: MealType;
  label: string;
  totals: MacroTotals;
  entries: number;
  /** Share of the day's calories, 0 to 100. */
  percent: number;
};

/** How the day's calories are spread over breakfast, lunch, dinner and snacks. */
export function perMealShare(entries: readonly FoodLogEntry[]): MealShare[] {
  const dayKcal = sumEntries(entries).kcal;

  return MEAL_TYPES.map((mealType) => {
    const mealEntries = entries.filter((entry) => entry.meal_type === mealType);
    const totals = sumEntries(mealEntries);

    return {
      mealType,
      label: MEAL_LABELS[mealType],
      totals,
      entries: mealEntries.length,
      percent: dayKcal > 0 ? Math.round((totals.kcal / dayKcal) * 100) : 0,
    };
  });
}

export type Contributor = {
  id: string;
  name: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  /** Share of the day's calories, 0 to 100. */
  percent: number;
};

/**
 * The handful of things that made up most of the day.
 *
 * Sorted by calories, because "waar zaten mijn calorieën?" is the question this
 * answers. It is descriptive, not a verdict: there is no colouring, no warning
 * and no suggestion to eat less of anything.
 */
export function biggestContributors(
  entries: readonly FoodLogEntry[],
  limit = 5,
): Contributor[] {
  const dayKcal = sumEntries(entries).kcal;

  return [...entries]
    .map((entry) => {
      const totals = sumEntries([entry]);
      return {
        id: entry.id,
        name: entry.name,
        brand: entry.brand,
        kcal: totals.kcal,
        proteinG: totals.proteinG,
        percent: dayKcal > 0 ? Math.round((totals.kcal / dayKcal) * 100) : 0,
      };
    })
    .filter((contributor) => contributor.kcal > 0)
    .sort((a, b) => b.kcal - a.kcal)
    .slice(0, limit);
}
