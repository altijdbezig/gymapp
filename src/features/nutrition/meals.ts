/**
 * Your own meals and recipes.
 *
 * The same table holds both, and the difference is only what happens when you
 * log one:
 *
 *   meal    "mijn ontbijt" -- three products you always eat together. Logging
 *           it writes three diary entries, so you can still change the amount
 *           of one of them afterwards.
 *   recipe  "chili con carne voor 4" -- ingredients plus a number of servings.
 *           Logging it writes one entry for one serving, with the macros
 *           divided by the servings.
 *
 * Everything here is pure arithmetic over the items. The database rows already
 * carry their own copy of the macros, exactly like the food log, so a recipe
 * does not change under you when Open Food Facts corrects a product.
 */
import type { Tables, TablesInsert } from '@/types/database';
import type { MealType } from './foodLog';

export type Meal = Tables<'meals'>;
export type MealItem = Tables<'meal_items'>;
export type MealKind = Meal['kind'];

export const MEAL_KIND_LABELS: Record<MealKind, string> = {
  meal: 'Maaltijd',
  recipe: 'Recept',
};

/** What one item contributes, in absolute grams and kilocalories. */
export type ItemTotals = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  sugarsG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
};

/** PostgREST can hand a numeric back as a string; both are accepted. */
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

/** What this item adds, given its amount in grams. */
export function itemTotals(item: {
  amount_g: number | string;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  fat_per_100g: number | string;
  carbs_per_100g: number | string;
  fiber_per_100g?: number | string | null;
  sugars_per_100g?: number | string | null;
  saturated_fat_per_100g?: number | string | null;
  salt_per_100g?: number | string | null;
}): ItemTotals {
  const factor = num(item.amount_g) / 100;
  const scale = (value: number | string | null | undefined) => {
    const per100 = optional(value);
    return per100 === null ? null : per100 * factor;
  };

  return {
    kcal: num(item.kcal_per_100g) * factor,
    proteinG: num(item.protein_per_100g) * factor,
    fatG: num(item.fat_per_100g) * factor,
    carbsG: num(item.carbs_per_100g) * factor,
    fiberG: scale(item.fiber_per_100g),
    sugarsG: scale(item.sugars_per_100g),
    saturatedFatG: scale(item.saturated_fat_per_100g),
    saltG: scale(item.salt_per_100g),
  };
}

export type MealTotals = ItemTotals & {
  /** Total weight of everything in it, which is what a serving is divided from. */
  amountG: number;
};

/**
 * Everything in the meal, added up.
 *
 * A micronutrient stays null as soon as one item is missing it, for the same
 * reason as in micros.ts: a total built partly from nothing is not a total.
 */
export function sumMealItems(
  items: readonly Parameters<typeof itemTotals>[0][],
): MealTotals {
  const totals: MealTotals = {
    amountG: 0,
    kcal: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    fiberG: 0,
    sugarsG: 0,
    saturatedFatG: 0,
    saltG: 0,
  };

  for (const item of items) {
    const itemValues = itemTotals(item);

    totals.amountG += num(item.amount_g);
    totals.kcal += itemValues.kcal;
    totals.proteinG += itemValues.proteinG;
    totals.fatG += itemValues.fatG;
    totals.carbsG += itemValues.carbsG;

    totals.fiberG = addOptional(totals.fiberG, itemValues.fiberG);
    totals.sugarsG = addOptional(totals.sugarsG, itemValues.sugarsG);
    totals.saturatedFatG = addOptional(totals.saturatedFatG, itemValues.saturatedFatG);
    totals.saltG = addOptional(totals.saltG, itemValues.saltG);
  }

  return roundTotals(totals);
}

function addOptional(running: number | null, value: number | null): number | null {
  if (running === null || value === null) return null;
  return running + value;
}

function roundTotals(totals: MealTotals): MealTotals {
  const round = (value: number | null, decimals = 1) =>
    value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals;

  return {
    amountG: Math.round(totals.amountG * 100) / 100,
    kcal: Math.round(totals.kcal),
    proteinG: round(totals.proteinG) as number,
    fatG: round(totals.fatG) as number,
    carbsG: round(totals.carbsG) as number,
    fiberG: round(totals.fiberG),
    sugarsG: round(totals.sugarsG),
    saturatedFatG: round(totals.saturatedFatG, 2),
    saltG: round(totals.saltG, 2),
  };
}

/** One serving of a recipe: the whole thing divided by the number of servings. */
export function perServing(totals: MealTotals, servings: number): MealTotals {
  const divisor = servings > 0 ? servings : 1;
  const divide = (value: number | null) => (value === null ? null : value / divisor);

  return roundTotals({
    amountG: totals.amountG / divisor,
    kcal: totals.kcal / divisor,
    proteinG: totals.proteinG / divisor,
    fatG: totals.fatG / divisor,
    carbsG: totals.carbsG / divisor,
    fiberG: divide(totals.fiberG),
    sugarsG: divide(totals.sugarsG),
    saturatedFatG: divide(totals.saturatedFatG),
    saltG: divide(totals.saltG),
  });
}

export type FoodLogInsert = TablesInsert<'food_log_entries'>;

/**
 * The diary rows for logging a saved meal.
 *
 * A meal becomes one row per item, so each product stays editable afterwards.
 * A recipe becomes a single row for one serving: its ingredients are not things
 * you ate separately, and splitting them would clutter the day.
 */
export function buildLogRowsForMeal(input: {
  userId: string;
  meal: Pick<Meal, 'name' | 'kind' | 'servings'>;
  items: readonly MealItem[];
  mealType: MealType;
  loggedOn: string;
  /** For a recipe: how many servings you are eating. Defaults to one. */
  servingsEaten?: number;
}): FoodLogInsert[] {
  const { userId, meal, items, mealType, loggedOn, servingsEaten = 1 } = input;

  if (meal.kind === 'meal') {
    return items.map((item) => ({
      user_id: userId,
      food_id: item.food_id,
      logged_on: loggedOn,
      meal_type: mealType,
      amount_g: num(item.amount_g),
      name: item.name,
      brand: item.brand,
      kcal_per_100g: num(item.kcal_per_100g),
      protein_per_100g: num(item.protein_per_100g),
      fat_per_100g: num(item.fat_per_100g),
      carbs_per_100g: num(item.carbs_per_100g),
      fiber_per_100g: optional(item.fiber_per_100g),
      sugars_per_100g: optional(item.sugars_per_100g),
      saturated_fat_per_100g: optional(item.saturated_fat_per_100g),
      salt_per_100g: optional(item.salt_per_100g),
    }));
  }

  // A recipe: one row, with the per-100 g values of the finished dish.
  const totals = sumMealItems(items);
  const serving = perServing(totals, num(meal.servings));
  const amountG = Math.max(1, Math.round(serving.amountG * servingsEaten * 100) / 100);

  // The row stores per-100 g values and the database multiplies by amount_g, so
  // the per-100 g numbers have to come from the whole dish, not from a serving.
  const per100 = (value: number | null) =>
    value === null || totals.amountG <= 0
      ? null
      : Math.round((value / totals.amountG) * 100 * 100) / 100;

  return [
    {
      user_id: userId,
      food_id: null,
      logged_on: loggedOn,
      meal_type: mealType,
      amount_g: amountG,
      name: meal.name,
      brand: null,
      kcal_per_100g: per100(totals.kcal) ?? 0,
      protein_per_100g: per100(totals.proteinG) ?? 0,
      fat_per_100g: per100(totals.fatG) ?? 0,
      carbs_per_100g: per100(totals.carbsG) ?? 0,
      fiber_per_100g: per100(totals.fiberG),
      sugars_per_100g: per100(totals.sugarsG),
      saturated_fat_per_100g: per100(totals.saturatedFatG),
      salt_per_100g: per100(totals.saltG),
      portion_label: 'portie',
      portion_count: servingsEaten,
    },
  ];
}

/** "3 producten · 520 kcal" -- the second line of a meal in the list. */
export function describeMeal(meal: Meal, items: readonly MealItem[]): string {
  const totals = sumMealItems(items);
  const count = items.length;
  const products = `${count} ${count === 1 ? 'product' : 'producten'}`;

  if (meal.kind === 'recipe') {
    const serving = perServing(totals, num(meal.servings));
    return `${products} · ${serving.kcal} kcal per portie`;
  }

  return `${products} · ${totals.kcal} kcal`;
}
