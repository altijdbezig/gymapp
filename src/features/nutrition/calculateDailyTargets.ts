/**
 * The calorie and macro calculation. One pure function: same input in, same
 * numbers out, no database, no clock, no randomness. That is what makes it
 * testable, and this file is the reason the safety rules can be guaranteed.
 *
 * The four safety rules from CLAUDE.md are enforced here and covered by tests:
 *   1. The deficit is never larger than 500 kcal.
 *   2. The target is never below the BMR — it is clamped and a warning is returned.
 *   3. Carbohydrates can never go negative.
 *   4. Calories are never reduced as a punishment for missed workouts. Enforced
 *      by construction: this function has no input for training, streaks or
 *      missed days, so there is nothing to punish you with.
 */
import type { Database } from '@/types/database';

export type Sex = Database['public']['Enums']['sex'];
export type ActivityLevel = Database['public']['Enums']['activity_level'];
export type Goal = Database['public']['Enums']['goal'];

/** Mifflin-St Jeor multipliers, from desk job to twice-a-day training. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Cutting eats 400 below maintenance, bulking 400 above it. */
export const GOAL_KCAL_ADJUSTMENT: Record<Goal, number> = {
  cut: -400,
  maintenance: 0,
  bulk: 400,
};

/**
 * Protein per kilo of body weight. Cutting gets the most: eating less makes it
 * easier to lose muscle along with fat, and protein is what protects it.
 */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  cut: 2.0,
  maintenance: 1.8,
  bulk: 1.6,
};

/** Safety rule 1: the hard floor under any deficit. */
export const MAX_DEFICIT_KCAL = 500;

/** A quarter of the calories comes from fat; the rest of the room is carbs. */
export const FAT_SHARE_OF_KCAL = 0.25;

/** Energy per gram. Protein and carbs 4, fat 9. */
export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const;

export type TargetInput = {
  weightKg: number;
  heightCm: number;
  /** Years. Use ageFromBirthDate() so this stays a plain number here. */
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
};

/**
 * Machine-readable warning codes. The Dutch text the user reads lives in the
 * UI layer, so this file stays free of copy.
 */
export type TargetWarning = 'clamped_to_bmr' | 'deficit_capped' | 'carbs_clamped_to_zero';

export type DailyTargets = {
  /** Basal metabolic rate: what you burn lying still all day. */
  bmrKcal: number;
  /** BMR x activity factor: maintenance. */
  tdeeKcal: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** True when safety rule 2 kicked in and pushed the target back up. */
  clampedToBmr: boolean;
  warnings: TargetWarning[];
};

function assertUsable(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a number between ${min} and ${max}, got ${value}`);
  }
}

/**
 * Mifflin-St Jeor. The only difference between the sexes is the constant at
 * the end: +5 or -161.
 */
export function calculateBmr(input: Pick<TargetInput, 'weightKg' | 'heightCm' | 'age' | 'sex'>) {
  const { weightKg, heightCm, age, sex } = input;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return base + (sex === 'male' ? 5 : -161);
}

export function calculateDailyTargets(input: TargetInput): DailyTargets {
  assertUsable('weightKg', input.weightKg, 20, 400);
  assertUsable('heightCm', input.heightCm, 100, 250);
  assertUsable('age', input.age, 14, 120);

  const warnings: TargetWarning[] = [];

  const bmrKcal = Math.round(calculateBmr(input));
  const tdeeKcal = Math.round(bmrKcal * ACTIVITY_FACTORS[input.activityLevel]);

  // Safety rule 1: whatever the goal asks for, never eat more than 500 kcal
  // below maintenance. Today's -400 is inside that, but the cap stays so a
  // future tweak to GOAL_KCAL_ADJUSTMENT cannot quietly break the rule.
  const requested = tdeeKcal + GOAL_KCAL_ADJUSTMENT[input.goal];
  const deficitFloor = tdeeKcal - MAX_DEFICIT_KCAL;
  let kcal = Math.max(requested, deficitFloor);
  if (requested < deficitFloor) {
    warnings.push('deficit_capped');
  }

  // Safety rule 2: never below the BMR. For a small, sedentary person the
  // -400 of a cut can land under it, and eating below your BMR is how you
  // lose muscle and stall.
  let clampedToBmr = false;
  if (kcal < bmrKcal) {
    kcal = bmrKcal;
    clampedToBmr = true;
    warnings.push('clamped_to_bmr');
  }

  const proteinG = Math.round(input.weightKg * PROTEIN_G_PER_KG[input.goal]);
  const fatG = Math.round((kcal * FAT_SHARE_OF_KCAL) / KCAL_PER_GRAM.fat);

  // Carbs get whatever is left. Rounded grams are used here on purpose, so the
  // macros the user sees actually add up to roughly the calories they see.
  const remainingKcal =
    kcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;

  // Safety rule 3: at a very high body weight the protein target alone can eat
  // the whole budget. Carbs then go to zero, never below.
  let carbsG = Math.round(remainingKcal / KCAL_PER_GRAM.carbs);
  if (carbsG < 0) {
    carbsG = 0;
    warnings.push('carbs_clamped_to_zero');
  }

  return { bmrKcal, tdeeKcal, kcal, proteinG, fatG, carbsG, clampedToBmr, warnings };
}

/**
 * Age in whole years on a given day. `today` is a parameter instead of a call
 * to new Date() so the function stays pure and the tests never break on a
 * birthday.
 */
export function ageFromBirthDate(birthDate: Date, today: Date): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
