/**
 * Turning your history into the numbers behind the charts.
 *
 * Everything here takes plain rows and returns plain arrays, so the drawing
 * never has to do arithmetic and the arithmetic can be tested without a screen.
 *
 * One principle runs through all of it: only completed working sets count.
 * Warm-ups and rows you typed but never ticked are not results, and letting
 * them into a progress chart would make you look stronger than you are.
 */
import { startOfWeek } from '@/features/nutrition/weekSummary';
import { estimateOneRepMax } from './oneRepMax';
import {
  isScoringSet,
  setVolume,
  volumeByMuscle,
  type MuscleGroup,
  type ScorableSet,
} from './volume';

/** A set as it comes out of the database, with the session it belonged to. */
export type StatSet = ScorableSet & {
  exerciseId: string;
  sessionId: string;
  performedOn: string;
};

// ---------------------------------------------------------------------------
// Per exercise, over time
// ---------------------------------------------------------------------------

export type ExercisePoint = {
  /** YYYY-MM-DD of the session. */
  date: string;
  /** Best Epley estimate of that session. */
  estimated1rmKg: number;
  /** Heaviest completed set of that session. */
  heaviestKg: number;
  /** Total volume for this exercise in that session. */
  volumeKg: number;
  sets: number;
};

/**
 * One point per session in which the exercise appeared, oldest first.
 *
 * Sessions where you only warmed up produce no point at all rather than a zero:
 * a chart that dips to zero would suggest you got weaker, when in fact you did
 * not do the exercise.
 */
export function exerciseProgress(
  sets: readonly StatSet[],
  exerciseId: string,
): ExercisePoint[] {
  const bySession = new Map<string, ExercisePoint>();

  for (const set of sets) {
    if (set.exerciseId !== exerciseId) continue;
    if (!isScoringSet(set)) continue;

    const current = bySession.get(set.sessionId) ?? {
      date: set.performedOn,
      estimated1rmKg: 0,
      heaviestKg: 0,
      volumeKg: 0,
      sets: 0,
    };

    const weightKg = set.weightKg ?? 0;

    bySession.set(set.sessionId, {
      date: set.performedOn,
      estimated1rmKg: Math.max(
        current.estimated1rmKg,
        estimateOneRepMax(weightKg, set.reps ?? 0),
      ),
      heaviestKg: Math.max(current.heaviestKg, weightKg),
      volumeKg: current.volumeKg + setVolume(set),
      sets: current.sets + 1,
    });
  }

  return [...bySession.values()]
    .map((point) => ({ ...point, volumeKg: Math.round(point.volumeKg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Which exercises you have actually done, most sets first. */
export function trainedExercises(
  sets: readonly StatSet[],
): { exerciseId: string; sets: number; lastPerformedOn: string }[] {
  const byExercise = new Map<string, { sets: number; lastPerformedOn: string }>();

  for (const set of sets) {
    if (!isScoringSet(set)) continue;

    const current = byExercise.get(set.exerciseId);
    byExercise.set(set.exerciseId, {
      sets: (current?.sets ?? 0) + 1,
      lastPerformedOn:
        current && current.lastPerformedOn > set.performedOn
          ? current.lastPerformedOn
          : set.performedOn,
    });
  }

  return [...byExercise.entries()]
    .map(([exerciseId, value]) => ({ exerciseId, ...value }))
    .sort((a, b) => b.sets - a.sets || b.lastPerformedOn.localeCompare(a.lastPerformedOn));
}

// ---------------------------------------------------------------------------
// Volume per muscle group per week
// ---------------------------------------------------------------------------

export type WeeklyMuscleVolume = {
  /** The Monday of the week. */
  weekStart: string;
  muscles: { muscle: MuscleGroup; volumeKg: number; sets: number }[];
};

/**
 * The "which muscle am I neglecting?" chart.
 *
 * Weeks are the right unit: a programme spreads muscles over several days, so
 * looking at a single day says nothing. A week with no training at all is left
 * out rather than shown as a row of zeroes.
 */
export function weeklyMuscleVolume(
  sets: readonly (StatSet & {
    primaryMuscle: MuscleGroup;
    secondaryMuscles: readonly MuscleGroup[];
  })[],
): WeeklyMuscleVolume[] {
  const byWeek = new Map<string, typeof sets>();

  for (const set of sets) {
    if (!isScoringSet(set)) continue;

    const week = startOfWeek(set.performedOn);
    byWeek.set(week, [...(byWeek.get(week) ?? []), set] as typeof sets);
  }

  return [...byWeek.entries()]
    .map(([weekStart, weekSets]) => ({ weekStart, muscles: volumeByMuscle(weekSets) }))
    .filter((week) => week.muscles.length > 0)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** The same thing rolled up over a whole period, for a single bar chart. */
export function totalMuscleVolume(
  sets: readonly (StatSet & {
    primaryMuscle: MuscleGroup;
    secondaryMuscles: readonly MuscleGroup[];
  })[],
) {
  return volumeByMuscle(sets);
}

// ---------------------------------------------------------------------------
// How often, and how long
// ---------------------------------------------------------------------------

export type SessionStat = {
  performedOn: string;
  durationSeconds: number | null;
};

export type FrequencyPoint = {
  /** The Monday of the week, or the first of the month. */
  periodStart: string;
  sessions: number;
  /** Average duration in seconds over the sessions that recorded one. */
  averageDurationSeconds: number | null;
};

export function sessionsPerWeek(sessions: readonly SessionStat[]): FrequencyPoint[] {
  return groupSessions(sessions, (date) => startOfWeek(date));
}

export function sessionsPerMonth(sessions: readonly SessionStat[]): FrequencyPoint[] {
  return groupSessions(sessions, (date) => `${date.slice(0, 7)}-01`);
}

function groupSessions(
  sessions: readonly SessionStat[],
  periodOf: (date: string) => string,
): FrequencyPoint[] {
  const byPeriod = new Map<string, { sessions: number; durations: number[] }>();

  for (const session of sessions) {
    const period = periodOf(session.performedOn);
    const current = byPeriod.get(period) ?? { sessions: 0, durations: [] };

    byPeriod.set(period, {
      sessions: current.sessions + 1,
      durations:
        session.durationSeconds && session.durationSeconds > 0
          ? [...current.durations, session.durationSeconds]
          : current.durations,
    });
  }

  return [...byPeriod.entries()]
    .map(([periodStart, value]) => ({
      periodStart,
      sessions: value.sessions,
      averageDurationSeconds:
        value.durations.length > 0
          ? Math.round(
              value.durations.reduce((running, duration) => running + duration, 0) /
                value.durations.length,
            )
          : null,
    }))
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

/** The headline numbers above the charts. */
export type TrainingSummary = {
  sessions: number;
  averagePerWeek: number;
  averageDurationSeconds: number | null;
  totalVolumeKg: number;
};

export function summariseTraining(
  sessions: readonly SessionStat[],
  sets: readonly StatSet[],
): TrainingSummary {
  const weeks = new Set(sessions.map((session) => startOfWeek(session.performedOn)));
  const durations = sessions
    .map((session) => session.durationSeconds)
    .filter((duration): duration is number => !!duration && duration > 0);

  return {
    sessions: sessions.length,
    // Over the weeks you actually trained, not over the calendar: a month off
    // should not make the number look like you train half as often as you do.
    averagePerWeek:
      weeks.size > 0 ? Math.round((sessions.length / weeks.size) * 10) / 10 : 0,
    averageDurationSeconds:
      durations.length > 0
        ? Math.round(durations.reduce((running, value) => running + value, 0) / durations.length)
        : null,
    totalVolumeKg: Math.round(
      sets.reduce((running, set) => running + setVolume(set), 0),
    ),
  };
}
