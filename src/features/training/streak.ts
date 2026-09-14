/**
 * Streaks.
 *
 * Never stored, always computed -- a stored counter can drift out of step with
 * what actually happened, and then the app is lying to you about your own
 * history. Everything here is derived from dates you can see for yourself.
 *
 * Two different streaks, because they are two different habits:
 *
 *   log streak       consecutive days on which you logged something you ate.
 *                    Eating happens every day, so days are the right unit.
 *   training streak  consecutive weeks in which you trained at least once.
 *                    Nobody lifts seven days a week, and a streak that breaks
 *                    on a rest day would be punishing exactly the thing that
 *                    makes you stronger.
 *
 * Tone rule: a streak of zero is never phrased as a failure. It is a number
 * that starts at zero and goes up, and today can always be day one.
 */
import { addDays, daysBetween } from '@/lib/date';
import { startOfWeek } from '@/features/nutrition/weekSummary';

/**
 * Consecutive days with at least one entry, counting back from today.
 *
 * Today not being logged yet does not break it: at nine in the morning you have
 * not eaten anything worth logging, and a streak that resets every midnight
 * would be useless. So the count may start at yesterday.
 */
export function logStreak(loggedDates: readonly string[], todayIso: string): number {
  const days = new Set(loggedDates);
  if (days.size === 0) return 0;

  // Start today if today is logged, otherwise yesterday -- today is still in
  // progress and has not been missed yet.
  let cursor = days.has(todayIso) ? todayIso : addDays(todayIso, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * Consecutive weeks with at least one workout, counting back from this week.
 *
 * Same reasoning as above: this week not having a workout yet does not break
 * the streak, because the week is not over. It only breaks once a whole week
 * has passed without training.
 */
export function trainingStreak(performedDates: readonly string[], todayIso: string): number {
  const weeks = new Set(performedDates.map(startOfWeek));
  if (weeks.size === 0) return 0;

  const thisWeek = startOfWeek(todayIso);
  let cursor = weeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  if (!weeks.has(cursor)) return 0;

  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return streak;
}

/** Whole days since the last workout, or null when there has never been one. */
export function daysSinceLastWorkout(
  performedDates: readonly string[],
  todayIso: string,
): number | null {
  if (performedDates.length === 0) return null;

  const newest = [...performedDates].sort().pop()!;
  return Math.max(0, daysBetween(newest, todayIso));
}

/** After this many days without training, the comeback screen offers itself. */
export const COMEBACK_AFTER_DAYS = 7;

export function needsComeback(
  performedDates: readonly string[],
  todayIso: string,
): boolean {
  const days = daysSinceLastWorkout(performedDates, todayIso);
  // Somebody who has never trained is not "coming back" from anything.
  if (days === null) return false;
  return days >= COMEBACK_AFTER_DAYS;
}

/**
 * The Dutch sentence under a streak.
 *
 * Zero is phrased as an invitation, never as a loss. Nothing here compares you
 * to anyone else, and nothing here mentions food.
 */
export function describeLogStreak(streak: number): string {
  if (streak === 0) return 'Log vandaag iets en je streak begint.';
  if (streak === 1) return '1 dag op rij gelogd.';
  return `${streak} dagen op rij gelogd.`;
}

export function describeTrainingStreak(streak: number): string {
  if (streak === 0) return 'Train deze week en je streak begint.';
  if (streak === 1) return '1 week op rij getraind.';
  return `${streak} weken op rij getraind.`;
}
