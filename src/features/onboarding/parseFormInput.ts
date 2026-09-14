/**
 * Parsing and validating what the user types in onboarding.
 *
 * Kept pure and separate from the screen for two reasons: it is the part that
 * is easy to get wrong (Dutch dates, comma decimals), and the limits here have
 * to match the check constraints in migration 0001 exactly. If they drift, the
 * database rejects the insert and the user sees a failure they cannot fix.
 */
import { ageFromBirthDate } from '@/features/nutrition/calculateDailyTargets';

export type ParseResult<T> =
  | { value: T; error?: undefined }
  | { value?: undefined; error: string };

/** Matches the daily_targets / body_weights check constraints. */
export const WEIGHT_RANGE_KG = { min: 20, max: 400 } as const;
/** Matches the profiles.height_cm check constraint. */
export const HEIGHT_RANGE_CM = { min: 100, max: 250 } as const;
/** Matches the guard in calculateDailyTargets. */
export const AGE_RANGE_YEARS = { min: 14, max: 120 } as const;

/**
 * Dutch keyboards produce a comma for decimals, iOS numeric keypads a dot.
 * Accept both, and refuse anything else rather than letting parseFloat
 * silently read "8kg" as 8.
 */
function toNumber(input: string): number | undefined {
  const normalised = input.trim().replace(',', '.');
  if (normalised.length === 0) return undefined;
  if (!/^\d+(\.\d+)?$/.test(normalised)) return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseWeight(input: string): ParseResult<number> {
  if (input.trim().length === 0) {
    return { error: 'Vul je gewicht in.' };
  }
  const value = toNumber(input);
  if (value === undefined) {
    return { error: 'Vul alleen cijfers in, bijvoorbeeld 82,5.' };
  }
  if (value < WEIGHT_RANGE_KG.min || value > WEIGHT_RANGE_KG.max) {
    return {
      error: `Vul een gewicht tussen ${WEIGHT_RANGE_KG.min} en ${WEIGHT_RANGE_KG.max} kg in.`,
    };
  }
  // Two decimals: that is what body_weights.weight_kg stores.
  return { value: Math.round(value * 100) / 100 };
}

export function parseHeight(input: string): ParseResult<number> {
  if (input.trim().length === 0) {
    return { error: 'Vul je lengte in.' };
  }
  const value = toNumber(input);
  if (value === undefined) {
    return { error: 'Vul alleen cijfers in, bijvoorbeeld 180.' };
  }
  if (value < HEIGHT_RANGE_CM.min || value > HEIGHT_RANGE_CM.max) {
    return {
      error: `Vul een lengte tussen ${HEIGHT_RANGE_CM.min} en ${HEIGHT_RANGE_CM.max} cm in.`,
    };
  }
  return { value: Math.round(value * 10) / 10 };
}

/** Zero-padded YYYY-MM-DD, the format Postgres wants for a date column. */
export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as YYYY-MM-DD in the device's own timezone, not UTC. */
export function todayIsoDate(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Reads dd-mm-jjjj, the way a Dutch person writes a date. Returns the ISO
 * string that goes into profiles.birth_date.
 */
export function parseBirthDate(input: string, today: Date): ParseResult<string> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { error: 'Vul je geboortedatum in.' };
  }

  const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (!match) {
    return { error: 'Schrijf je geboortedatum als dd-mm-jjjj, bijvoorbeeld 14-09-1998.' };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(year, month - 1, day);
  // new Date(2025, 1, 31) rolls over to 3 March instead of failing, so compare
  // the parts back to catch a day that does not exist in that month.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { error: 'Deze datum bestaat niet.' };
  }

  if (date > today) {
    return { error: 'Je geboortedatum kan niet in de toekomst liggen.' };
  }

  const age = ageFromBirthDate(date, today);
  if (age < AGE_RANGE_YEARS.min) {
    return { error: `Je moet minstens ${AGE_RANGE_YEARS.min} jaar zijn om GymApp te gebruiken.` };
  }
  if (age > AGE_RANGE_YEARS.max) {
    return { error: 'Controleer je geboortejaar.' };
  }

  return { value: toIsoDate(date) };
}
