/**
 * Sessions: uploading a finished workout, and reading your history back.
 *
 * The upload is built to be safe on a bad connection:
 *   - every id is made on the device, so an upsert writes the same rows twice
 *     instead of duplicating them;
 *   - a failed upload leaves the session in the queue in AsyncStorage and is
 *     retried the next time the training tab opens;
 *   - the session row goes first, then the sets, then the records, so a
 *     half-finished upload never leaves sets pointing at a session that is not
 *     there.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';
import {
  buildSessionInsert,
  buildSetLogInserts,
  sessionScorableSets,
  type ActiveSession,
  type PreviousPerformance,
  type PreviousSet,
} from './activeSession';
import {
  bestsPerExercise,
  buildRecordUpserts,
  detectBrokenRecords,
  type BrokenRecord,
  type StoredRecord,
} from './personalRecords';
import {
  enqueuePendingSession,
  loadPendingSessions,
  markAttempt,
  removePendingSession,
} from './sessionStorage';
import { countScoringSets, totalVolume, type ScorableSet } from './volume';

export type WorkoutSession = Tables<'workout_sessions'>;
export type SetLog = Tables<'set_logs'>;
export type PersonalRecord = Tables<'personal_records'>;

export const sessionHistoryQueryKey = (userId: string) => ['sessions', userId] as const;
export const sessionDetailQueryKey = (sessionId: string) => ['session', sessionId] as const;
export const personalRecordsQueryKey = (userId: string) => ['personal-records', userId] as const;
export const previousPerformanceQueryKey = (userId: string) =>
  ['previous-performance', userId] as const;

/** A session plus the numbers the history list shows next to it. */
export type SessionWithSets = WorkoutSession & {
  sets: SetLog[];
  volumeKg: number;
  scoringSets: number;
};

function toScorable(set: SetLog): ScorableSet {
  return {
    setType: set.set_type,
    reps: set.reps,
    weightKg: set.weight_kg,
    isCompleted: set.is_completed,
  };
}

function withTotals(session: WorkoutSession & { set_logs?: SetLog[] | null }): SessionWithSets {
  const sets = [...(session.set_logs ?? [])].sort(
    (a, b) => a.exercise_order - b.exercise_order || a.set_index - b.set_index,
  );
  const scorable = sets.map(toScorable);

  const { set_logs: _ignored, ...rest } = session;

  return {
    ...rest,
    sets,
    volumeKg: totalVolume(scorable),
    scoringSets: countScoringSets(scorable),
  };
}

/** The history list. Newest first, sets included so the totals are free. */
export function useSessionHistory(userId: string | null, limit = 100) {
  return useQuery({
    queryKey: sessionHistoryQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<SessionWithSets[]> => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*, set_logs(*)')
        .eq('user_id', userId!)
        .not('ended_at', 'is', null)
        .order('performed_on', { ascending: false })
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(withTotals);
    },
  });
}

export function useSessionDetail(sessionId: string | null) {
  return useQuery({
    queryKey: sessionDetailQueryKey(sessionId ?? 'none'),
    enabled: !!sessionId,
    queryFn: async (): Promise<SessionWithSets | null> => {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*, set_logs(*)')
        .eq('id', sessionId!)
        .maybeSingle();

      if (error) throw error;
      return data ? withTotals(data) : null;
    },
  });
}

export function usePersonalRecords(userId: string | null) {
  return useQuery({
    queryKey: personalRecordsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<PersonalRecord[]> => {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId!);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * What you did the last time you trained each exercise.
 *
 * One request for the recent sets, then grouped on the device: for every
 * exercise, keep the sets of the newest session it appears in. Doing that in
 * SQL would need a window function and a view; this is a couple of hundred
 * rows and a Map.
 */
export function usePreviousPerformance(userId: string | null) {
  return useQuery({
    queryKey: previousPerformanceQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PreviousPerformance> => {
      const { data, error } = await supabase
        .from('set_logs')
        .select('*, workout_sessions!inner(id, user_id, performed_on, started_at)')
        .eq('workout_sessions.user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      return groupPreviousPerformance(data ?? []);
    },
  });
}

type SetWithSession = SetLog & {
  workout_sessions: { id: string; started_at: string } | null;
};

/**
 * Keeps, per exercise, only the sets of the most recent session it appeared in.
 * Exported because the grouping is worth a test of its own.
 */
export function groupPreviousPerformance(rows: readonly SetWithSession[]): PreviousPerformance {
  const newestSession = new Map<string, { sessionId: string; startedAt: string }>();

  for (const row of rows) {
    const session = row.workout_sessions;
    if (!session) continue;

    const current = newestSession.get(row.exercise_id);
    if (!current || session.started_at > current.startedAt) {
      newestSession.set(row.exercise_id, {
        sessionId: session.id,
        startedAt: session.started_at,
      });
    }
  }

  const result: PreviousPerformance = {};

  for (const row of rows) {
    const newest = newestSession.get(row.exercise_id);
    if (!newest || row.workout_sessions?.id !== newest.sessionId) continue;
    // A warm-up is not what you are trying to beat.
    if (row.set_type === 'warmup') continue;

    const sets = result[row.exercise_id] ?? [];
    sets.push({ setIndex: row.set_index, reps: row.reps, weightKg: row.weight_kg });
    result[row.exercise_id] = sets;
  }

  for (const sets of Object.values(result)) {
    sets.sort((a: PreviousSet, b: PreviousSet) => a.setIndex - b.setIndex);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Uploading a finished session
// ---------------------------------------------------------------------------

export type FinishResult = {
  brokenRecords: BrokenRecord[];
  /** False when the session is queued because the upload failed. */
  uploaded: boolean;
};

async function fetchStoredRecords(
  userId: string,
  exerciseIds: readonly string[],
): Promise<StoredRecord[]> {
  if (exerciseIds.length === 0) return [];

  const { data, error } = await supabase
    .from('personal_records')
    .select(
      'exercise_id, best_weight_kg, best_weight_reps, best_weight_on, best_1rm_kg, best_1rm_on, best_volume_kg, best_volume_on',
    )
    .eq('user_id', userId)
    .in('exercise_id', [...exerciseIds]);

  if (error) throw error;
  return data ?? [];
}

/**
 * Writes one finished session to Postgres.
 *
 * Everything is an upsert on an id the device already chose, so running this
 * twice for the same session is a no-op rather than a duplicate.
 */
export async function uploadSession(session: ActiveSession, endedAtMs: number): Promise<void> {
  const sessionRow = buildSessionInsert(session, endedAtMs);
  const setRows = buildSetLogInserts(session);

  const sessionResult = await supabase.from('workout_sessions').upsert(sessionRow);
  if (sessionResult.error) throw sessionResult.error;

  if (setRows.length > 0) {
    const setsResult = await supabase.from('set_logs').upsert(setRows);
    if (setsResult.error) throw setsResult.error;
  }
}

/** Recomputes and stores the personal records this session touched. */
export async function syncPersonalRecords(session: ActiveSession): Promise<BrokenRecord[]> {
  const bests = bestsPerExercise(sessionScorableSets(session));
  if (bests.length === 0) return [];

  const stored = await fetchStoredRecords(
    session.userId,
    bests.map((best) => best.exerciseId),
  );

  const broken = detectBrokenRecords(bests, stored);
  const upserts = buildRecordUpserts(bests, stored, session.performedOn);

  if (upserts.length > 0) {
    const { error } = await supabase.from('personal_records').upsert(
      upserts.map((upsert) => ({ ...upsert, user_id: session.userId })),
      { onConflict: 'user_id,exercise_id' },
    );

    if (error) throw error;
  }

  return broken;
}

/**
 * Finishes a session: upload if we can, queue it if we cannot.
 *
 * The records are worked out before the upload is attempted, so the summary
 * screen can show "je verbrak 2 records" even when the phone has no signal.
 * They are stored on the next successful sync.
 */
export function useFinishSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      session,
      endedAtMs,
    }: {
      session: ActiveSession;
      endedAtMs: number;
    }): Promise<FinishResult> => {
      try {
        await uploadSession(session, endedAtMs);
        const brokenRecords = await syncPersonalRecords(session);
        return { brokenRecords, uploaded: true };
      } catch {
        // No connection, or the API refused. Either way the workout is kept.
        await enqueuePendingSession(AsyncStorage, { session, endedAtMs, attempts: 1 });
        return { brokenRecords: [], uploaded: false };
      }
    },
    onSuccess: (_result, { session }) => {
      queryClient.invalidateQueries({ queryKey: sessionHistoryQueryKey(session.userId) });
      queryClient.invalidateQueries({ queryKey: personalRecordsQueryKey(session.userId) });
      queryClient.invalidateQueries({ queryKey: previousPerformanceQueryKey(session.userId) });
    },
  });
}

export type SyncOutcome = { uploaded: number; remaining: number };

/**
 * Empties the queue. Called when the training tab opens, which is the moment
 * you are most likely to be back on wifi.
 */
export async function syncPendingSessions(): Promise<SyncOutcome> {
  const queue = await loadPendingSessions(AsyncStorage);
  let uploaded = 0;

  for (const pending of queue) {
    try {
      await uploadSession(pending.session, pending.endedAtMs);
      await syncPersonalRecords(pending.session);
      await removePendingSession(AsyncStorage, pending.session.id);
      uploaded += 1;
    } catch {
      await markAttempt(AsyncStorage, pending.session.id);
    }
  }

  const remaining = (await loadPendingSessions(AsyncStorage)).length;
  return { uploaded, remaining };
}

/** How many finished sessions are still waiting, for a banner in the UI. */
export function usePendingSessionCount(userId: string | null) {
  return useQuery({
    queryKey: ['pending-sessions', userId ?? 'anonymous'] as const,
    enabled: !!userId,
    refetchOnMount: 'always',
    queryFn: async (): Promise<number> => {
      const { remaining } = await syncPendingSessions();
      return remaining;
    },
  });
}

export function useDeleteSession(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // set_logs go with it through ON DELETE CASCADE. Personal records are
      // deliberately left alone: recomputing every record from the remaining
      // history would be the correct thing, and it is a phase 6 job.
      const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: sessionHistoryQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: previousPerformanceQueryKey(userId) });
    },
  });
}

/** The date of the last finished session, which the streak maths reads. */
export function lastPerformedOn(sessions: readonly WorkoutSession[]): string | null {
  let newest: string | null = null;

  for (const session of sessions) {
    if (!session.ended_at) continue;
    if (newest === null || session.performed_on > newest) {
      newest = session.performed_on;
    }
  }

  return newest;
}
