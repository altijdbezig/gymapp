/**
 * The rest timer and the session timer.
 *
 * Both are the same idea: a start time and a clock. Nothing counts down in
 * state, because a phone that locks its screen stops re-rendering and a timer
 * built on "subtract one every second" would drift or freeze. Storing the
 * moment it started and subtracting from `now` survives a locked screen, a
 * backgrounded app and even a restart.
 *
 * `now` is always a parameter, so the tests never depend on the real clock.
 */

/** Fallback when an exercise has no rest time of its own. */
export const DEFAULT_REST_SECONDS = 90;

/** The choices offered in the UI, in seconds. */
export const REST_PRESETS_SECONDS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300] as const;

export type RestTimer = {
  /** Epoch milliseconds at which the timer was started. */
  startedAtMs: number;
  durationSeconds: number;
  /** Which exercise it belongs to, so the UI can show it in the right place. */
  exerciseKey: string;
};

/** Seconds left, never below zero. */
export function remainingSeconds(timer: RestTimer, nowMs: number): number {
  const elapsed = (nowMs - timer.startedAtMs) / 1000;
  return Math.max(0, Math.ceil(timer.durationSeconds - elapsed));
}

export function isFinished(timer: RestTimer, nowMs: number): boolean {
  return remainingSeconds(timer, nowMs) === 0;
}

/** 0 to 1, for a progress ring. Counts up, so 1 means the rest is over. */
export function restProgress(timer: RestTimer, nowMs: number): number {
  if (timer.durationSeconds <= 0) return 1;
  const elapsed = (nowMs - timer.startedAtMs) / 1000;
  return Math.min(1, Math.max(0, elapsed / timer.durationSeconds));
}

/** Seconds elapsed since a session started. */
export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}

/**
 * "0:45", "12:30", "1:05:20".
 *
 * Minutes and seconds for anything under an hour, because that is how rest is
 * read; hours appear only once a session passes sixty minutes.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** "1 uur 12 min", "45 min", "40 sec" -- for lists, where a colon reads oddly. */
export function formatDurationLong(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  if (safe < 60) return `${safe} sec`;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} uur`;
  return `${hours} uur ${minutes} min`;
}

/** "1 min 30" for a rest length shown next to an exercise. */
export function formatRest(seconds: number): string {
  if (seconds <= 0) return 'Geen rust';
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
