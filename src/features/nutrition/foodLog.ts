/**
 * The pure half of food logging: adding up a day, grouping it per meal, and
 * working out how far along the four bars on Vandaag should be.
 *
 * No database and no React here, so the arithmetic that decides what the user
 * sees is covered by tests.
 */
import type { Tables } from '@/types/database';

export type FoodLogEntry = Tables<'food_log_entries'>;
export type MealType = Tables<'food_log_entries'>['meal_type'];

/** Meal order is fixed: it is the order of a day, not of the alphabet. */
export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Ontbijt',
  lunch: 'Lunch',
  dinner: 'Diner',
  snack: 'Snacks',
};

/**
 * Which meal to preselect, based on the time of day. Only a starting guess --
 * the user can always pick another one -- but it saves a tap on almost every
 * entry. `now` is a parameter so the tests do not depend on the clock.
 */
export function suggestMealType(now: Date): MealType {
  const hour = now.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export type MacroTotals = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export const EMPTY_TOTALS: MacroTotals = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

/**
 * The generated columns come back as numbers, but Postgres numerics can arrive
 * as strings through PostgREST depending on the value, and a generated column
 * is nullable in the generated types. Both get normalised to a number here.
 */
function readNumeric(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Adds up everything eaten. Rounds once, at the end, to whole units. */
export function sumEntries(entries: readonly FoodLogEntry[]): MacroTotals {
  const totals = entries.reduce(
    (running, entry) => ({
      kcal: running.kcal + readNumeric(entry.kcal),
      proteinG: running.proteinG + readNumeric(entry.protein_g),
      fatG: running.fatG + readNumeric(entry.fat_g),
      carbsG: running.carbsG + readNumeric(entry.carbs_g),
    }),
    EMPTY_TOTALS,
  );

  return {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.proteinG),
    fatG: Math.round(totals.fatG),
    carbsG: Math.round(totals.carbsG),
  };
}

export type MealGroup = {
  mealType: MealType;
  label: string;
  entries: FoodLogEntry[];
  totals: MacroTotals;
};

/**
 * Groups a day into the four meals, always all four and always in order, so
 * the screen can render empty meals without special-casing them.
 */
export function groupByMeal(entries: readonly FoodLogEntry[]): MealGroup[] {
  return MEAL_TYPES.map((mealType) => {
    const mealEntries = entries.filter((entry) => entry.meal_type === mealType);
    return {
      mealType,
      label: MEAL_LABELS[mealType],
      entries: mealEntries,
      totals: sumEntries(mealEntries),
    };
  });
}

export type MacroProgress = {
  label: string;
  eaten: number;
  target: number;
  /** Left to eat. Never negative -- "over target" is what `isOver` is for. */
  remaining: number;
  /** 0 to 1, clamped, so a progress bar can use it directly. */
  ratio: number;
  isOver: boolean;
  unit: 'kcal' | 'g';
};

function progress(
  label: string,
  eaten: number,
  target: number,
  unit: 'kcal' | 'g',
): MacroProgress {
  // A target of zero would divide by zero. Treat it as "nothing to fill":
  // full when you have eaten something, empty when you have not.
  const ratio = target > 0 ? Math.min(1, Math.max(0, eaten / target)) : eaten > 0 ? 1 : 0;

  return {
    label,
    eaten,
    target,
    remaining: Math.max(0, target - eaten),
    ratio,
    isOver: eaten > target,
    unit,
  };
}

/** The four bars on Vandaag, in a fixed order. */
export function buildProgress(eaten: MacroTotals, target: MacroTotals): MacroProgress[] {
  return [
    progress('Calorieën', eaten.kcal, target.kcal, 'kcal'),
    progress('Eiwit', eaten.proteinG, target.proteinG, 'g'),
    progress('Vet', eaten.fatG, target.fatG, 'g'),
    progress('Koolhydraten', eaten.carbsG, target.carbsG, 'g'),
  ];
}

/**
 * What one portion of a food adds up to. Used for the live preview while the
 * user is still typing an amount, before anything is written.
 */
export function macrosForAmount(
  food: {
    kcal_per_100g: number;
    protein_per_100g: number;
    fat_per_100g: number;
    carbs_per_100g: number;
  },
  amountG: number,
): MacroTotals {
  const factor = amountG / 100;
  return {
    kcal: Math.round(food.kcal_per_100g * factor),
    proteinG: Math.round(food.protein_per_100g * factor),
    fatG: Math.round(food.fat_per_100g * factor),
    carbsG: Math.round(food.carbs_per_100g * factor),
  };
}
