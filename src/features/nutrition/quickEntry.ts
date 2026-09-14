/**
 * Snelle invoer: logging calories without a product.
 *
 * For eating out. You know it was roughly 800 kcal and maybe 40 g protein, and
 * you are not going to find "friet speciaal van de snackbar op de hoek" in Open
 * Food Facts. Guessing beats not logging at all, and it keeps the day's total
 * honest rather than flattering.
 *
 * There is no extra table behind it: a quick entry is an ordinary
 * food_log_entries row with food_id null and amount_g exactly 100, so the
 * per-100 g values are the numbers you typed and the generated columns work out
 * the same totals. That also means a quick entry counts everywhere a normal
 * entry counts, without a single special case anywhere else in the app.
 */
import type { ParseResult } from '@/features/onboarding/parseFormInput';
import type { TablesInsert } from '@/types/database';
import type { MealType } from './foodLog';

/** food_log_entries.kcal_per_100g has no upper bound, but a day does. */
export const QUICK_KCAL_MAX = 10_000;
export const QUICK_PROTEIN_MAX = 1_000;

/** The amount that makes "per 100 g" and "in total" the same number. */
export const QUICK_ENTRY_AMOUNT_G = 100;

export const QUICK_ENTRY_DEFAULT_NAME = 'Snelle invoer';

function toNumber(input: string): number | undefined {
  const normalised = input.trim().replace(',', '.');
  if (normalised.length === 0) return undefined;
  if (!/^\d+(\.\d+)?$/.test(normalised)) return undefined;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseQuickKcal(input: string): ParseResult<number> {
  if (input.trim().length === 0) {
    return { error: 'Vul een aantal calorieën in.' };
  }

  const value = toNumber(input);
  if (value === undefined) {
    return { error: 'Vul alleen cijfers in, bijvoorbeeld 650.' };
  }
  if (value <= 0) {
    return { error: 'Vul meer dan 0 kcal in.' };
  }
  if (value > QUICK_KCAL_MAX) {
    return { error: `Vul minder dan ${QUICK_KCAL_MAX} kcal in.` };
  }

  return { value: Math.round(value * 100) / 100 };
}

/** Protein is optional: leaving it empty stores zero, not a guess. */
export function parseQuickProtein(input: string): ParseResult<number> {
  if (input.trim().length === 0) return { value: 0 };

  const value = toNumber(input);
  if (value === undefined) {
    return { error: 'Vul alleen cijfers in, bijvoorbeeld 35.' };
  }
  if (value > QUICK_PROTEIN_MAX) {
    return { error: `Vul minder dan ${QUICK_PROTEIN_MAX} gram eiwit in.` };
  }

  return { value: Math.round(value * 100) / 100 };
}

export type QuickEntryInput = {
  userId: string;
  name: string;
  kcal: number;
  proteinG: number;
  mealType: MealType;
  loggedOn: string;
};

/**
 * The diary row for a quick entry.
 *
 * Fat and carbohydrates are stored as zero rather than null, because the column
 * is not nullable and because zero is the honest answer here: you did not say
 * anything about them, so the app does not claim you ate any. The day's fat and
 * carbohydrate bars will read low, which is the correct consequence of only
 * having entered two numbers.
 */
export function buildQuickEntry(input: QuickEntryInput): TablesInsert<'food_log_entries'> {
  return {
    user_id: input.userId,
    food_id: null,
    logged_on: input.loggedOn,
    meal_type: input.mealType,
    amount_g: QUICK_ENTRY_AMOUNT_G,
    name: input.name.trim().slice(0, 200) || QUICK_ENTRY_DEFAULT_NAME,
    brand: null,
    kcal_per_100g: input.kcal,
    protein_per_100g: input.proteinG,
    fat_per_100g: 0,
    carbs_per_100g: 0,
  };
}
