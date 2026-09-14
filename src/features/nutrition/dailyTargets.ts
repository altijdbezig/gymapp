/**
 * Everything around storing the daily targets: the Dutch copy for the warning
 * codes, and the pure function that turns a profile plus a weight into the row
 * that goes into daily_targets.
 */
import {
  ageFromBirthDate,
  calculateDailyTargets,
  type TargetWarning,
} from './calculateDailyTargets';
import { applyManualTargets } from './manualTargets';
import type { Profile } from '@/features/auth/useProfile';
import type { TablesInsert } from '@/types/database';

/**
 * The user-facing half of the warning codes. The calculation itself stays free
 * of copy, so this is the only place that has to change if the wording does.
 */
export const TARGET_WARNING_MESSAGES: Record<TargetWarning, string> = {
  clamped_to_bmr:
    'Je doel is verhoogd naar je ruststofwisseling. Minder eten dan dat is niet gezond en kost je spiermassa.',
  deficit_capped: 'Je tekort is begrensd op 500 kcal. Sneller afvallen gaat ten koste van spieren.',
  carbs_clamped_to_zero:
    'Er blijft geen ruimte over voor koolhydraten. Overleg met een diëtist voor je dit volhoudt.',
};

export type DailyTargetInsert = TablesInsert<'daily_targets'>;

/**
 * A profile only counts once onboarding filled in every field the maths needs.
 * Narrowing the type here means the caller cannot forget a null check.
 */
export type CompleteProfile = Profile & {
  birth_date: string;
  sex: NonNullable<Profile['sex']>;
  height_cm: number;
  activity_level: NonNullable<Profile['activity_level']>;
  goal: NonNullable<Profile['goal']>;
};

export function asCompleteProfile(profile: Profile | null | undefined): CompleteProfile | null {
  if (
    !profile ||
    profile.birth_date === null ||
    profile.sex === null ||
    profile.height_cm === null ||
    profile.activity_level === null ||
    profile.goal === null
  ) {
    return null;
  }
  return profile as CompleteProfile;
}

/**
 * Builds the daily_targets row for one day. Pure: the date and "today" are
 * parameters, so a test never depends on the clock.
 */
export function buildDailyTargetRow(params: {
  userId: string;
  profile: CompleteProfile;
  weightKg: number;
  date: string;
  today: Date;
}): DailyTargetInsert {
  const { userId, profile, weightKg, date, today } = params;

  const calculated = calculateDailyTargets({
    weightKg,
    heightCm: profile.height_cm,
    age: ageFromBirthDate(new Date(profile.birth_date), today),
    sex: profile.sex,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });

  // Manually set targets replace the calculation, but never the safety rules:
  // applyManualTargets still holds the BMR floor and the 500 kcal cap, which
  // are also the two check constraints on this table.
  const targets = applyManualTargets(calculated, {
    kcal: profile.manual_kcal,
    proteinG: profile.manual_protein_g,
    fatG: profile.manual_fat_g,
    carbsG: profile.manual_carbs_g,
  });

  return {
    user_id: userId,
    date,
    kcal: targets.kcal,
    protein_g: targets.proteinG,
    fat_g: targets.fatG,
    carbs_g: targets.carbsG,
    bmr_kcal: targets.bmrKcal,
    tdee_kcal: targets.tdeeKcal,
    weight_kg: weightKg,
    goal: profile.goal,
    activity_level: profile.activity_level,
    clamped_to_bmr: targets.clampedToBmr,
  };
}

/** Reads the warnings back off a stored row, so old days explain themselves too. */
export function warningsForRow(row: {
  kcal: number;
  bmr_kcal: number;
  tdee_kcal: number;
  carbs_g: number;
  clamped_to_bmr: boolean;
}): TargetWarning[] {
  const warnings: TargetWarning[] = [];
  if (row.clamped_to_bmr) warnings.push('clamped_to_bmr');
  if (row.carbs_g === 0) warnings.push('carbs_clamped_to_zero');
  return warnings;
}

/** Dutch labels for the enum values, used on Vandaag and in Instellingen. */
export const GOAL_LABELS = {
  cut: 'Afvallen',
  maintenance: 'Onderhouden',
  bulk: 'Aankomen',
} as const;

export const ACTIVITY_LABELS = {
  sedentary: 'Zittend werk, weinig beweging',
  light: 'Licht actief, 1-3x per week sporten',
  moderate: 'Actief, 3-5x per week sporten',
  active: 'Zeer actief, 6-7x per week sporten',
  very_active: 'Topsport of zwaar fysiek werk',
} as const;

export const SEX_LABELS = {
  male: 'Man',
  female: 'Vrouw',
} as const;
