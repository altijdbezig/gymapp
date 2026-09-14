/**
 * Micronutrients: fibre, sugars, saturated fat and salt.
 *
 * These are the four a Dutch food label prints next to the macros, and the four
 * Open Food Facts fills in most often. They are all optional -- plenty of
 * products simply do not have them recorded.
 *
 * That optionality is the whole reason this file exists. Adding a day up by
 * treating a missing value as zero would produce a number that looks exact and
 * is not. Every total therefore carries an `isComplete` flag, and the screen
 * says "minstens 12 g" instead of "12 g" when something was missing.
 */

export type MicroKey = 'fiber' | 'sugars' | 'saturatedFat' | 'salt';

export const MICRO_LABELS: Record<MicroKey, string> = {
  fiber: 'Vezels',
  sugars: 'Suikers',
  saturatedFat: 'Verzadigd vet',
  salt: 'Zout',
};

/** Salt is printed in much smaller amounts than the rest, so it gets a decimal. */
export const MICRO_DECIMALS: Record<MicroKey, number> = {
  fiber: 0,
  sugars: 0,
  saturatedFat: 0,
  salt: 1,
};

export type MicroTotal = {
  grams: number;
  /** False when at least one thing you ate had no value recorded. */
  isComplete: boolean;
};

export type MicroTotals = Record<MicroKey, MicroTotal>;

export const EMPTY_MICRO_TOTALS: MicroTotals = {
  fiber: { grams: 0, isComplete: true },
  sugars: { grams: 0, isComplete: true },
  saturatedFat: { grams: 0, isComplete: true },
  salt: { grams: 0, isComplete: true },
};

/** The four generated columns, as they come back from food_log_entries. */
export type MicroSource = {
  fiber_g: number | string | null;
  sugars_g: number | string | null;
  saturated_fat_g: number | string | null;
  salt_g: number | string | null;
};

const COLUMNS: Record<MicroKey, keyof MicroSource> = {
  fiber: 'fiber_g',
  sugars: 'sugars_g',
  saturatedFat: 'saturated_fat_g',
  salt: 'salt_g',
};

/**
 * Postgres numerics can arrive as strings through PostgREST. Anything that is
 * not a usable number counts as "not recorded", which is what null means here.
 */
function readNumeric(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Adds up a day, remembering whether anything was missing. */
export function sumMicros(entries: readonly MicroSource[]): MicroTotals {
  const totals: MicroTotals = {
    fiber: { grams: 0, isComplete: true },
    sugars: { grams: 0, isComplete: true },
    saturatedFat: { grams: 0, isComplete: true },
    salt: { grams: 0, isComplete: true },
  };

  for (const entry of entries) {
    for (const key of Object.keys(COLUMNS) as MicroKey[]) {
      const value = readNumeric(entry[COLUMNS[key]]);
      if (value === null) {
        totals[key].isComplete = false;
      } else {
        totals[key].grams += value;
      }
    }
  }

  for (const key of Object.keys(totals) as MicroKey[]) {
    const decimals = MICRO_DECIMALS[key];
    const factor = 10 ** decimals;
    totals[key].grams = Math.round(totals[key].grams * factor) / factor;
  }

  return totals;
}

/** "12 g" when everything was known, "minstens 12 g" when something was not. */
export function formatMicro(key: MicroKey, total: MicroTotal): string {
  const value = total.grams.toFixed(MICRO_DECIMALS[key]).replace('.', ',');
  return total.isComplete ? `${value} g` : `minstens ${value} g`;
}
