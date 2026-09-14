/**
 * Validating the manual-entry form.
 *
 * Same idea as parseFormInput for onboarding: every limit here mirrors a check
 * constraint from migration 0004, so anything this file accepts will insert,
 * and anything the database would refuse is caught while the user can still
 * fix it.
 */
import type { ParseResult } from '@/features/onboarding/parseFormInput';

export type { ParseResult };

/** foods.name allows 1 to 200 characters. */
export const NAME_MAX_LENGTH = 200;

/** The foods_macros_fit_in_100g constraint. */
export const MACRO_SUM_MAX = 100;

/**
 * Accepts both a comma and a dot decimal, and refuses anything that is not
 * purely a number -- parseFloat would happily read "10 gram" as 10.
 */
function toNumber(input: string): number | undefined {
  const normalised = input.trim().replace(',', '.');
  if (normalised.length === 0) return undefined;
  if (!/^\d+(\.\d+)?$/.test(normalised)) return undefined;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseProductName(input: string): ParseResult<string> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { error: 'Vul een naam in.' };
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return { error: `Houd de naam bij maximaal ${NAME_MAX_LENGTH} tekens.` };
  }
  return { value: trimmed };
}

/**
 * One nutrition value per 100 g. `label` goes into the error message so the
 * user is told which field is wrong, and `max` mirrors that column's own
 * upper bound (1000 for kcal, 100 for a macro).
 */
export function parseMacroPer100g(
  input: string,
  label: string,
  max: number,
): ParseResult<number> {
  if (input.trim().length === 0) {
    return { error: `Vul de ${label} per 100 g in.` };
  }

  const value = toNumber(input);
  if (value === undefined) {
    return { error: `Vul bij ${label} alleen cijfers in, bijvoorbeeld 10,5.` };
  }
  if (value < 0 || value > max) {
    return { error: `Vul bij ${label} een waarde tussen 0 en ${max} in.` };
  }

  return { value: round2(value) };
}

/** Empty is fine here: not every product has a meaningful portion. */
export function parseOptionalServing(input: string): ParseResult<number | undefined> {
  if (input.trim().length === 0) {
    return { value: undefined };
  }

  const value = toNumber(input);
  if (value === undefined) {
    return { error: 'Vul bij portiegrootte alleen cijfers in, bijvoorbeeld 150.' };
  }
  if (value <= 0 || value > 2000) {
    return { error: 'Vul een portiegrootte tussen 1 en 2000 gram in.' };
  }

  return { value: round2(value) };
}

/**
 * 100 grams of product cannot hold more than 100 grams of macros. Checked as
 * its own step because it is about the three fields together, not one of them.
 */
export function validateMacroSum(
  proteinG: number,
  fatG: number,
  carbsG: number,
): string | undefined {
  const total = round2(proteinG + fatG + carbsG);
  if (total > MACRO_SUM_MAX) {
    return `Eiwit, vet en koolhydraten zijn samen ${formatDutch(total)} g per 100 g. Dat kan niet meer dan 100 zijn — controleer de verpakking.`;
  }
  return undefined;
}

/** 82.5 becomes "82,5" and 82.0 becomes "82". */
function formatDutch(value: number): string {
  return String(Number(value)).replace('.', ',');
}
