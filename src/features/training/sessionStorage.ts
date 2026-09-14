/**
 * Keeping a workout alive on the device.
 *
 * A gym is the worst place on earth for a phone signal. Two things follow:
 *
 *   1. The session you are doing right now lives in AsyncStorage, rewritten
 *      after every change. Kill the app, run out of battery, walk into the
 *      basement -- it is still there when you come back.
 *   2. A finished session that could not be uploaded goes into a queue and is
 *      retried later. A session is never lost because a request failed.
 *
 * Everything here takes its storage as an argument so the tests can hand it a
 * plain object instead of AsyncStorage, and so nothing in this file imports
 * React or the network.
 */
import type { ActiveSession } from './activeSession';

/** The slice of AsyncStorage this module needs. Easy to fake in a test. */
export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** The v1 suffix means a future format change can simply use a new key. */
export const ACTIVE_SESSION_KEY = 'gymapp.activeSession.v1';
export const PENDING_SESSIONS_KEY = 'gymapp.pendingSessions.v1';

/** A finished session waiting for a connection. */
export type PendingSession = {
  session: ActiveSession;
  endedAtMs: number;
  /** How often the upload has been tried, for a "kon niet opslaan" message. */
  attempts: number;
};

// ---------------------------------------------------------------------------
// The running session
// ---------------------------------------------------------------------------

export async function saveActiveSession(
  store: KeyValueStore,
  session: ActiveSession,
): Promise<void> {
  await store.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

/**
 * Reads the running session back.
 *
 * Anything that does not look like a session is thrown away rather than
 * returned: a half-written or outdated blob crashing the training tab would be
 * a far worse outcome than losing one workout, and this is the only place that
 * can happen.
 */
export async function loadActiveSession(store: KeyValueStore): Promise<ActiveSession | null> {
  const raw = await store.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;

  const parsed = parseJson(raw);
  return isActiveSession(parsed) ? parsed : null;
}

export async function clearActiveSession(store: KeyValueStore): Promise<void> {
  await store.removeItem(ACTIVE_SESSION_KEY);
}

// ---------------------------------------------------------------------------
// The upload queue
// ---------------------------------------------------------------------------

export async function loadPendingSessions(store: KeyValueStore): Promise<PendingSession[]> {
  const raw = await store.getItem(PENDING_SESSIONS_KEY);
  if (!raw) return [];

  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isPendingSession);
}

/**
 * Adds a finished session to the queue, replacing an earlier attempt with the
 * same id. Queueing the same workout twice would upload it twice.
 */
export async function enqueuePendingSession(
  store: KeyValueStore,
  pending: PendingSession,
): Promise<PendingSession[]> {
  const queue = await loadPendingSessions(store);
  const next = [...queue.filter((entry) => entry.session.id !== pending.session.id), pending];

  await store.setItem(PENDING_SESSIONS_KEY, JSON.stringify(next));
  return next;
}

export async function removePendingSession(
  store: KeyValueStore,
  sessionId: string,
): Promise<PendingSession[]> {
  const queue = await loadPendingSessions(store);
  const next = queue.filter((entry) => entry.session.id !== sessionId);

  await store.setItem(PENDING_SESSIONS_KEY, JSON.stringify(next));
  return next;
}

/** Bumps the attempt counter after a failed upload. */
export async function markAttempt(
  store: KeyValueStore,
  sessionId: string,
): Promise<PendingSession[]> {
  const queue = await loadPendingSessions(store);
  const next = queue.map((entry) =>
    entry.session.id === sessionId ? { ...entry, attempts: entry.attempts + 1 } : entry,
  );

  await store.setItem(PENDING_SESSIONS_KEY, JSON.stringify(next));
  return next;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * A shape check rather than a full schema validation: it has to be cheap
 * enough to run on every app start, and the only thing it has to prevent is a
 * crash further down.
 */
export function isActiveSession(value: unknown): value is ActiveSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.userId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.performedOn === 'string' &&
    typeof candidate.startedAtMs === 'number' &&
    Number.isFinite(candidate.startedAtMs) &&
    typeof candidate.notes === 'string' &&
    typeof candidate.isComeback === 'boolean' &&
    Array.isArray(candidate.exercises) &&
    candidate.exercises.every(isActiveExercise)
  );
}

function isActiveExercise(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.key === 'string' &&
    typeof candidate.exerciseId === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.sets) &&
    candidate.sets.every(isActiveSet)
  );
}

function isActiveSet(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.key === 'string' &&
    typeof candidate.reps === 'string' &&
    typeof candidate.weightKg === 'string' &&
    typeof candidate.isCompleted === 'boolean'
  );
}

function isPendingSession(value: unknown): value is PendingSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  return (
    isActiveSession(candidate.session) &&
    typeof candidate.endedAtMs === 'number' &&
    typeof candidate.attempts === 'number'
  );
}
