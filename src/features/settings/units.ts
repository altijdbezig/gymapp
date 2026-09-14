/**
 * Units.
 *
 * Everything in the database is metric -- kilograms and centimetres -- and
 * always will be: a stored number that means different things depending on a
 * setting is a bug waiting to happen. This file converts at the edges only,
 * when a number is shown or when one is typed in.
 */
import type { Database } from '@/types/database';

export type WeightUnit = Database['public']['Enums']['unit_weight'];
export type LengthUnit = Database['public']['Enums']['unit_length'];

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  kg: 'Kilogram (kg)',
  lb: 'Pound (lb)',
};

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  cm: 'Centimeter (cm)',
  in: 'Inch (in)',
};

/** The international pound, exactly 0.45359237 kg. */
export const KG_PER_LB = 0.45359237;
/** An inch is exactly 2.54 cm. */
export const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function cmToDisplay(cm: number, unit: LengthUnit): number {
  return unit === 'cm' ? cm : cm / CM_PER_IN;
}

export function displayToCm(value: number, unit: LengthUnit): number {
  return unit === 'cm' ? value : value * CM_PER_IN;
}

/** "82,5 kg" or "181,9 lb", with a Dutch decimal comma. */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  const value = kgToDisplay(kg, unit);
  return `${value.toFixed(decimals).replace('.', ',')} ${unit}`;
}

/** "180 cm" or "5'11\"" -- inches are read as feet and inches by the people who use them. */
export function formatLength(cm: number, unit: LengthUnit): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`;

  const totalInches = cmToDisplay(cm, 'in');
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);

  // 11.6 inches rounds to 12, which is another foot.
  if (inches === 12) return `${feet + 1}'0"`;
  return `${feet}'${inches}"`;
}

/** The unit suffix on its own, for a field label. */
export function weightSuffix(unit: WeightUnit): string {
  return unit;
}

/**
 * Volume totals -- the "12.400 kg getild" kind of number -- stay in whole
 * units and get thousand separators, because a decimal there is meaningless.
 */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const value = Math.round(kgToDisplay(kg, unit));
  return `${value.toLocaleString('nl-NL')} ${unit}`;
}
