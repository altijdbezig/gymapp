/**
 * The React side of the running workout.
 *
 * Holds the session in state, runs every change through the pure reducer, and
 * mirrors the result into AsyncStorage so nothing is lost when the app is
 * killed. The writes are debounced: typing "62,5" should not be four writes to
 * disk, but closing the app a second later should still find the 62,5 there.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createSession,
  sessionReducer,
  type ActiveSession,
  type CreateSessionInput,
  type SessionAction,
} from './activeSession';
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from './sessionStorage';
import { DEFAULT_REST_SECONDS, type RestTimer } from './restTimer';

/** Long enough to swallow a burst of keystrokes, short enough to be safe. */
const SAVE_DEBOUNCE_MS = 400;

export type UseActiveSession = {
  session: ActiveSession | null;
  /** True while the stored session is being read on app start. */
  isRestoring: boolean;
  dispatch: (action: SessionAction) => void;
  start: (input: CreateSessionInput) => ActiveSession;
  discard: () => Promise<void>;
  /** Clears the session from state and storage once it has been finished. */
  clear: () => Promise<void>;

  restTimer: RestTimer | null;
  startRest: (exerciseKey: string, seconds?: number) => void;
  stopRest: () => void;
};

export function useActiveSession(): UseActiveSession {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `session` so the flush on unmount can read the latest value
  // without the effect depending on it.
  const latest = useRef<ActiveSession | null>(null);

  // Read whatever was left behind, once.
  useEffect(() => {
    let cancelled = false;

    loadActiveSession(AsyncStorage)
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setSession(restored);
          latest.current = restored;
        }
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror every change to disk, debounced.
  useEffect(() => {
    latest.current = session;
    if (!session) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      void saveActiveSession(AsyncStorage, session);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [session]);

  // Leaving the screen must not drop the last keystroke.
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (latest.current) {
        void saveActiveSession(AsyncStorage, latest.current);
      }
    };
  }, []);

  const dispatch = useCallback((action: SessionAction) => {
    setSession((current) => (current ? sessionReducer(current, action) : current));
  }, []);

  const start = useCallback((input: CreateSessionInput) => {
    const created = createSession(input);
    setSession(created);
    latest.current = created;
    // Written straight away rather than waiting for the debounce: a session
    // that exists for one second and then crashes should still be there.
    void saveActiveSession(AsyncStorage, created);
    return created;
  }, []);

  const clear = useCallback(async () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setSession(null);
    latest.current = null;
    setRestTimer(null);
    await clearActiveSession(AsyncStorage);
  }, []);

  const startRest = useCallback(
    (exerciseKey: string, seconds: number = DEFAULT_REST_SECONDS) => {
      if (seconds <= 0) {
        setRestTimer(null);
        return;
      }
      setRestTimer({ exerciseKey, durationSeconds: seconds, startedAtMs: Date.now() });
    },
    [],
  );

  const stopRest = useCallback(() => setRestTimer(null), []);

  return {
    session,
    isRestoring,
    dispatch,
    start,
    discard: clear,
    clear,
    restTimer,
    startRest,
    stopRest,
  };
}

/**
 * A clock that re-renders once a second while something is running.
 *
 * Only mounted while a session is open, so the app is not waking up every
 * second for nothing.
 */
export function useTicker(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
