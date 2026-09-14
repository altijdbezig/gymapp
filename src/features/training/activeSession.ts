/**
 * The workout that is running right now.
 *
 * This is the heart of phase 3, and it is deliberately a plain reducer over a
 * plain object with no database and no React in it. Three reasons:
 *
 *   1. It has to survive a bad connection. The whole session is one JSON blob,
 *      so it can be written to AsyncStorage after every keystroke and read back
 *      unchanged after the app is killed. Nothing is lost because a request
 *      failed -- the upload happens once, at the end, and may be retried.
 *   2. It has to be testable. Ticking off a set, adding a drop set, swapping
 *      two exercises -- all of that is one function call in a test.
 *   3. The ids are made on the device (see lib/id), so the rows that eventually
 *      go to Postgres are already complete and sending them twice is harmless.
 *
 * Numbers are kept as the raw text the user typed and only parsed when they are
 * needed. Storing a number would fight the keyboard: "8," is not a number yet,
 * but it is a perfectly reasonable thing to have half-typed.
 */
import { createId } from '@/lib/id';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { DEFAULT_REST_SECONDS } from './restTimer';
import type { ExerciseCategory, MuscleGroup, ScorableSet, SetType } from './volume';

/** Matches the set_logs check constraints, so a bad value never reaches the API. */
export const SET_LIMITS = {
  maxSetsPerExercise: 50,
  maxReps: 1000,
  maxWeightKg: 1000,
  minRpe: 1,
  maxRpe: 10,
} as const;

export type ActiveSet = {
  /** Local key. Stable across renders and across a save/restore cycle. */
  key: string;
  setType: SetType;
  /** Raw input text, exactly as typed. Parsed by toNumber when it is needed. */
  reps: string;
  weightKg: string;
  rpe: string;
  /** Cardio only. */
  durationSeconds: string;
  distanceM: string;
  isCompleted: boolean;
};

export type ActiveExercise = {
  key: string;
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  restSeconds: number;
  /** 1-26, or null when this exercise is not part of a superset. */
  supersetGroup: number | null;
  note: string;
  sets: ActiveSet[];
};

export type ActiveSession = {
  /** Becomes workout_sessions.id, so it is a real uuid from the start. */
  id: string;
  userId: string;
  workoutDayId: string | null;
  name: string;
  performedOn: string;
  startedAtMs: number;
  isComeback: boolean;
  notes: string;
  exercises: ActiveExercise[];
};

/** What the picker hands over when you add an exercise. */
export type ExercisePick = {
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  restSeconds?: number;
  supersetGroup?: number | null;
  note?: string;
  /** How many empty sets to start with. */
  targetSets?: number;
};

// ---------------------------------------------------------------------------
// Building a session
// ---------------------------------------------------------------------------

export function createEmptySet(previous?: ActiveSet): ActiveSet {
  return {
    key: createId(),
    setType: 'normal',
    // Carrying the last set's numbers over saves a lot of typing: most people
    // do the same weight again, and changing a prefilled number is one tap.
    reps: previous?.reps ?? '',
    weightKg: previous?.weightKg ?? '',
    rpe: '',
    durationSeconds: '',
    distanceM: '',
    isCompleted: false,
  };
}

export function createActiveExercise(pick: ExercisePick): ActiveExercise {
  const targetSets = clamp(pick.targetSets ?? 3, 1, SET_LIMITS.maxSetsPerExercise);

  return {
    key: createId(),
    exerciseId: pick.exerciseId,
    name: pick.name,
    category: pick.category,
    primaryMuscle: pick.primaryMuscle,
    secondaryMuscles: pick.secondaryMuscles,
    restSeconds: pick.restSeconds ?? DEFAULT_REST_SECONDS,
    supersetGroup: pick.supersetGroup ?? null,
    note: pick.note ?? '',
    sets: Array.from({ length: targetSets }, () => createEmptySet()),
  };
}

export type CreateSessionInput = {
  userId: string;
  name: string;
  workoutDayId?: string | null;
  exercises?: ExercisePick[];
  isComeback?: boolean;
  now?: Date;
};

export function createSession({
  userId,
  name,
  workoutDayId = null,
  exercises = [],
  isComeback = false,
  now = new Date(),
}: CreateSessionInput): ActiveSession {
  return {
    id: createId(),
    userId,
    workoutDayId,
    name,
    performedOn: todayIsoDate(now),
    startedAtMs: now.getTime(),
    isComeback,
    notes: '',
    exercises: exercises.map(createActiveExercise),
  };
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export type SessionAction =
  | { type: 'add-exercises'; picks: ExercisePick[] }
  | { type: 'remove-exercise'; exerciseKey: string }
  | { type: 'move-exercise'; exerciseKey: string; direction: 'up' | 'down' }
  | { type: 'set-exercise-note'; exerciseKey: string; note: string }
  | { type: 'set-rest'; exerciseKey: string; restSeconds: number }
  | { type: 'set-superset'; exerciseKey: string; group: number | null }
  | { type: 'add-set'; exerciseKey: string }
  | { type: 'remove-set'; exerciseKey: string; setKey: string }
  | { type: 'update-set'; exerciseKey: string; setKey: string; patch: Partial<ActiveSet> }
  | { type: 'toggle-set'; exerciseKey: string; setKey: string }
  | { type: 'set-notes'; notes: string }
  | { type: 'set-name'; name: string };

export function sessionReducer(state: ActiveSession, action: SessionAction): ActiveSession {
  switch (action.type) {
    case 'add-exercises': {
      if (action.picks.length === 0) return state;
      return {
        ...state,
        exercises: [...state.exercises, ...action.picks.map(createActiveExercise)],
      };
    }

    case 'remove-exercise':
      return {
        ...state,
        exercises: state.exercises.filter((exercise) => exercise.key !== action.exerciseKey),
      };

    case 'move-exercise': {
      const index = state.exercises.findIndex((exercise) => exercise.key === action.exerciseKey);
      if (index === -1) return state;

      const target = action.direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= state.exercises.length) return state;

      const exercises = [...state.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...state, exercises };
    }

    case 'set-exercise-note':
      return mapExercise(state, action.exerciseKey, (exercise) => ({
        ...exercise,
        note: action.note,
      }));

    case 'set-rest':
      return mapExercise(state, action.exerciseKey, (exercise) => ({
        ...exercise,
        restSeconds: clamp(Math.round(action.restSeconds), 0, 900),
      }));

    case 'set-superset':
      return mapExercise(state, action.exerciseKey, (exercise) => ({
        ...exercise,
        supersetGroup: action.group === null ? null : clamp(Math.round(action.group), 1, 26),
      }));

    case 'add-set':
      return mapExercise(state, action.exerciseKey, (exercise) => {
        if (exercise.sets.length >= SET_LIMITS.maxSetsPerExercise) return exercise;
        const last = exercise.sets[exercise.sets.length - 1];
        return { ...exercise, sets: [...exercise.sets, createEmptySet(last)] };
      });

    case 'remove-set':
      return mapExercise(state, action.exerciseKey, (exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => set.key !== action.setKey),
      }));

    case 'update-set':
      return mapSet(state, action.exerciseKey, action.setKey, (set) => ({
        ...set,
        ...action.patch,
      }));

    case 'toggle-set':
      return mapSet(state, action.exerciseKey, action.setKey, (set) => ({
        ...set,
        isCompleted: !set.isCompleted,
      }));

    case 'set-notes':
      return { ...state, notes: action.notes };

    case 'set-name':
      return { ...state, name: action.name };

    default:
      return state;
  }
}

function mapExercise(
  state: ActiveSession,
  exerciseKey: string,
  update: (exercise: ActiveExercise) => ActiveExercise,
): ActiveSession {
  return {
    ...state,
    exercises: state.exercises.map((exercise) =>
      exercise.key === exerciseKey ? update(exercise) : exercise,
    ),
  };
}

function mapSet(
  state: ActiveSession,
  exerciseKey: string,
  setKey: string,
  update: (set: ActiveSet) => ActiveSet,
): ActiveSession {
  return mapExercise(state, exerciseKey, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => (set.key === setKey ? update(set) : set)),
  }));
}

// ---------------------------------------------------------------------------
// Reading the numbers back out
// ---------------------------------------------------------------------------

/**
 * Parses a typed number, accepting both the Dutch comma and the dot an iOS
 * numeric keypad produces. Anything that is not a plain number -- including a
 * half-typed "8," -- comes back as null rather than as a wrong guess.
 */
export function toNumber(input: string): number | null {
  const normalised = input.trim().replace(',', '.');
  if (normalised.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The view of a set that volume and record maths need. */
export function toScorableSet(set: ActiveSet): ScorableSet {
  return {
    setType: set.setType,
    reps: toNumber(set.reps),
    weightKg: toNumber(set.weightKg),
    isCompleted: set.isCompleted,
  };
}

export function sessionScorableSets(
  session: ActiveSession,
): (ScorableSet & { exerciseId: string })[] {
  return session.exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({ ...toScorableSet(set), exerciseId: exercise.exerciseId })),
  );
}

/** The same, with the muscles attached, for the per-muscle-group breakdown. */
export function sessionMuscleSets(session: ActiveSession) {
  return session.exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      ...toScorableSet(set),
      primaryMuscle: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscles,
    })),
  );
}

/** True once at least one set has been ticked off. */
export function hasAnyCompletedSet(session: ActiveSession): boolean {
  return session.exercises.some((exercise) => exercise.sets.some((set) => set.isCompleted));
}

// ---------------------------------------------------------------------------
// Turning the session into database rows
// ---------------------------------------------------------------------------

export type WorkoutSessionInsert = {
  id: string;
  user_id: string;
  workout_day_id: string | null;
  name: string;
  performed_on: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  notes: string | null;
  is_comeback: boolean;
};

export type SetLogInsert = {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_order: number;
  set_index: number;
  set_type: SetType;
  reps: number | null;
  weight_kg: number | null;
  rpe: number | null;
  is_completed: boolean;
  duration_seconds: number | null;
  distance_m: number | null;
  superset_group: number | null;
};

export function buildSessionInsert(
  session: ActiveSession,
  endedAtMs: number,
): WorkoutSessionInsert {
  const durationSeconds = clamp(
    Math.round((endedAtMs - session.startedAtMs) / 1000),
    0,
    86_400,
  );

  return {
    id: session.id,
    user_id: session.userId,
    workout_day_id: session.workoutDayId,
    name: session.name.trim().slice(0, 80) || 'Training',
    performed_on: session.performedOn,
    started_at: new Date(session.startedAtMs).toISOString(),
    ended_at: new Date(endedAtMs).toISOString(),
    duration_seconds: durationSeconds,
    notes: session.notes.trim() ? session.notes.trim().slice(0, 2000) : null,
    is_comeback: session.isComeback,
  };
}

/**
 * Only completed sets are written. A row you typed but never ticked was a plan,
 * and storing it would inflate every count in the history for no reason.
 *
 * set_index is renumbered per exercise so it stays 1, 2, 3 even after deleting
 * a set halfway, which is what the (session, exercise_order, set_index) unique
 * constraint needs.
 */
export function buildSetLogInserts(session: ActiveSession): SetLogInsert[] {
  const rows: SetLogInsert[] = [];

  session.exercises.forEach((exercise, exerciseOrder) => {
    let setIndex = 0;

    for (const set of exercise.sets) {
      if (!set.isCompleted) continue;

      setIndex += 1;
      if (setIndex > SET_LIMITS.maxSetsPerExercise) break;

      rows.push({
        id: createId(),
        session_id: session.id,
        exercise_id: exercise.exerciseId,
        exercise_order: exerciseOrder,
        set_index: setIndex,
        set_type: set.setType,
        reps: clampOrNull(toNumber(set.reps), 0, SET_LIMITS.maxReps),
        weight_kg: clampOrNull(toNumber(set.weightKg), 0, SET_LIMITS.maxWeightKg),
        rpe: clampOrNull(toNumber(set.rpe), SET_LIMITS.minRpe, SET_LIMITS.maxRpe),
        is_completed: true,
        duration_seconds: clampOrNull(toNumber(set.durationSeconds), 0, 86_400),
        distance_m: clampOrNull(toNumber(set.distanceM), 0, 1_000_000),
        superset_group: exercise.supersetGroup,
      });
    }
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Previous performance
// ---------------------------------------------------------------------------

export type PreviousSet = {
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
};

/** exercise_id -> the sets of the last session that contained it. */
export type PreviousPerformance = Record<string, PreviousSet[]>;

/**
 * "8 × 60 kg" -- shown greyed out under a set as a placeholder, so you know
 * what to beat without having to look it up.
 */
export function formatPreviousSet(previous: PreviousSet | undefined): string | null {
  if (!previous) return null;
  if (previous.reps === null && previous.weightKg === null) return null;

  const reps = previous.reps ?? 0;
  if (previous.weightKg === null || previous.weightKg === 0) {
    return `${reps} herhalingen`;
  }
  return `${reps} × ${String(previous.weightKg).replace('.', ',')} kg`;
}

export function previousSetFor(
  previous: PreviousPerformance,
  exerciseId: string,
  setIndex: number,
): PreviousSet | undefined {
  return previous[exerciseId]?.find((set) => set.setIndex === setIndex);
}

// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampOrNull(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  return clamp(value, min, max);
}
