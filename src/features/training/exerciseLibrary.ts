/**
 * Searching and filtering the exercise library.
 *
 * The library is 169 rows and grows with your own exercises, so the whole
 * thing is fetched once and filtered on the device. That keeps the picker
 * instant and, more importantly, keeps it working in a basement gym with no
 * signal.
 *
 * Matching is deliberately forgiving: accents are stripped, case is ignored,
 * and the English aliases are searched alongside the Dutch name, so "bench",
 * "bankdruk" and "Bankdrukken" all find the same row.
 */
import type { Tables } from '@/types/database';
import type { ExerciseCategory, MuscleGroup } from './volume';

export type Exercise = Tables<'exercises'>;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Borst',
  back: 'Rug',
  lats: 'Lats',
  traps: 'Trapezius',
  shoulders: 'Schouders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Onderarmen',
  quads: 'Bovenbenen',
  hamstrings: 'Hamstrings',
  glutes: 'Bilspieren',
  calves: 'Kuiten',
  abs: 'Buik',
  obliques: 'Schuine buikspieren',
  lower_back: 'Onderrug',
  neck: 'Nek',
  full_body: 'Hele lichaam',
  cardio: 'Cardio',
};

/** Filter order in the UI: roughly top to bottom of the body, cardio last. */
export const MUSCLE_GROUP_ORDER: readonly MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower_back',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'neck',
  'full_body',
  'cardio',
];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  barbell: 'Halter',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Kabel',
  bodyweight: 'Lichaamsgewicht',
  cardio: 'Cardio',
  other: 'Overig',
};

export const CATEGORY_ORDER: readonly ExerciseCategory[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'cardio',
  'other',
];

/**
 * Lowercases and strips diacritics, so "één" and "een" are the same word to
 * the search box. normalize('NFD') splits a letter from its accent and the
 * regex then throws the accent away.
 */
export function normaliseTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** True when every word of the query appears in the name or in an alias. */
export function matchesQuery(exercise: Exercise, query: string): boolean {
  const words = normaliseTerm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = normaliseTerm([exercise.name, ...exercise.aliases].join(' '));
  return words.every((word) => haystack.includes(word));
}

export type ExerciseFilter = {
  query?: string;
  muscle?: MuscleGroup | null;
  category?: ExerciseCategory | null;
  /** 'all' | 'custom' -- "alleen mijn eigen oefeningen". */
  ownership?: 'all' | 'custom';
};

/**
 * A muscle filter also matches exercises that hit it as a secondary muscle:
 * looking for triceps work and not being shown close-grip bench press would be
 * unhelpful, even though its primary muscle is listed as triceps elsewhere.
 */
export function filterExercises(
  exercises: readonly Exercise[],
  filter: ExerciseFilter,
): Exercise[] {
  const { query = '', muscle = null, category = null, ownership = 'all' } = filter;

  return exercises.filter((exercise) => {
    if (ownership === 'custom' && !exercise.is_custom) return false;
    if (category && exercise.category !== category) return false;
    if (
      muscle &&
      exercise.primary_muscle !== muscle &&
      !exercise.secondary_muscles.includes(muscle)
    ) {
      return false;
    }
    return matchesQuery(exercise, query);
  });
}

/**
 * Sorted for the picker: your own exercises first (you added them for a
 * reason), then alphabetically by Dutch name.
 */
export function sortExercises(exercises: readonly Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => {
    if (a.is_custom !== b.is_custom) return a.is_custom ? -1 : 1;
    return a.name.localeCompare(b.name, 'nl');
  });
}

/** "Borst · Halter" -- the second line of a row in the picker. */
export function exerciseSubtitle(exercise: Exercise): string {
  return `${MUSCLE_GROUP_LABELS[exercise.primary_muscle]} · ${CATEGORY_LABELS[exercise.category]}`;
}

/** Cardio is logged in time and distance, everything else in reps and weight. */
export function isCardio(exercise: Pick<Exercise, 'category'>): boolean {
  return exercise.category === 'cardio';
}

/** Only a straight bar gets the plate calculator offered. */
export function usesBarbell(exercise: Pick<Exercise, 'category'>): boolean {
  return exercise.category === 'barbell';
}
