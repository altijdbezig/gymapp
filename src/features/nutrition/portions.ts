/**
 * Logging in something other than grams.
 *
 * Nobody weighs a slice of bread. They log "2 plakjes", and the app works out
 * that a slice is 35 grams. Grams stay the single source of truth everywhere in
 * the database -- a portion is only a way of typing, and it is stored alongside
 * the entry purely so the diary can read it back the way you meant it.
 *
 * Portions are per user: one person's tablespoon of peanut butter is another
 * person's heaped one, and Open Food Facts has no opinion about either.
 */
import type { Tables } from '@/types/database';

export type StoredPortion = Tables<'food_portions'>;

export type Portion = {
  /** 'grams' for the built-in one, otherwise the food_portions row id. */
  id: string;
  label: string;
  /** How many grams one of these is. */
  grams: number;
  isDefault: boolean;
};

/** Always available, always first: plain grams. */
export const GRAM_PORTION: Portion = {
  id: 'grams',
  label: 'gram',
  grams: 1,
  isDefault: false,
};

/** The labels offered when you add a portion, so most people never type one. */
export const SUGGESTED_PORTION_LABELS = [
  'stuk',
  'plakje',
  'snee',
  'eetlepel',
  'theelepel',
  'portie',
  'handje',
  'beker',
  'glas',
  'blikje',
  'ml',
] as const;

/**
 * Every way this food can be logged.
 *
 * Grams first, then the serving size Open Food Facts published (if it has one),
 * then your own portions in the order you made them. A portion you saved with
 * the same label as the Open Food Facts one wins, because you meant it.
 */
export function portionsForFood(
  food: { serving_size_g: number | null } | null,
  stored: readonly StoredPortion[],
): Portion[] {
  const own = stored.map<Portion>((row) => ({
    id: row.id,
    label: row.label,
    grams: Number(row.grams),
    isDefault: row.is_default,
  }));

  const servingSize = food?.serving_size_g ? Number(food.serving_size_g) : null;
  const hasOwnPortion = own.some((portion) => portion.label.toLowerCase() === 'portie');

  const fromProduct: Portion[] =
    servingSize && servingSize > 0 && !hasOwnPortion
      ? [{ id: 'serving', label: 'portie', grams: servingSize, isDefault: false }]
      : [];

  return [GRAM_PORTION, ...fromProduct, ...own];
}

/** The portion the amount screen should open on. */
export function defaultPortion(portions: readonly Portion[]): Portion {
  return portions.find((portion) => portion.isDefault) ?? portions[0] ?? GRAM_PORTION;
}

/** How many grams `count` of this portion is. Rounded to the gram. */
export function gramsFor(portion: Portion, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.round(portion.grams * count * 100) / 100;
}

/** The other way around: how many portions a number of grams is. */
export function countFor(portion: Portion, grams: number): number {
  if (portion.grams <= 0) return 0;
  return Math.round((grams / portion.grams) * 100) / 100;
}

/**
 * "2 plakjes (70 g)" or "150 g".
 *
 * A count of exactly one drops the number: "1 portie" reads better than
 * "1 × portie", and the label is already singular.
 */
export function formatPortion(
  count: number | null,
  label: string | null,
  grams: number,
): string {
  const gramText = `${formatAmount(grams)} g`;
  if (count === null || label === null || label === GRAM_PORTION.label) return gramText;

  const countText = formatAmount(count);
  return `${countText} ${pluralise(label, count)} (${gramText})`;
}

/**
 * Dutch plurals, only for the handful of labels the app suggests. Anything else
 * is left alone -- guessing at a plural is worse than not trying.
 */
const PLURALS: Record<string, string> = {
  stuk: 'stuks',
  plakje: 'plakjes',
  snee: 'sneetjes',
  eetlepel: 'eetlepels',
  theelepel: 'theelepels',
  portie: 'porties',
  handje: 'handjes',
  beker: 'bekers',
  glas: 'glazen',
  blikje: 'blikjes',
};

export function pluralise(label: string, count: number): string {
  if (count === 1) return label;
  return PLURALS[label.toLowerCase()] ?? label;
}

/** 2 stays "2", 2.5 becomes "2,5". */
export function formatAmount(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}
