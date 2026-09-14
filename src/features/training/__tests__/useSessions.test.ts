import { groupPreviousPerformance, lastPerformedOn } from '../useSessions';
import type { SetLog, WorkoutSession } from '../useSessions';

type Row = SetLog & { workout_sessions: { id: string; started_at: string } | null };

function setLog(overrides: Partial<Row> = {}): Row {
  return {
    id: 'set-1',
    session_id: 'session-1',
    exercise_id: 'bench',
    exercise_order: 0,
    set_index: 1,
    set_type: 'normal',
    reps: 10,
    weight_kg: 60,
    rpe: null,
    is_completed: true,
    duration_seconds: null,
    distance_m: null,
    superset_group: null,
    created_at: '2026-09-14T10:00:00Z',
    workout_sessions: { id: 'session-1', started_at: '2026-09-14T10:00:00Z' },
    ...overrides,
  };
}

describe('groupPreviousPerformance', () => {
  it('keeps only the most recent session per exercise', () => {
    const older = { id: 'session-old', started_at: '2026-09-01T10:00:00Z' };
    const newer = { id: 'session-new', started_at: '2026-09-10T10:00:00Z' };

    const result = groupPreviousPerformance([
      setLog({ id: 'a', set_index: 1, reps: 8, weight_kg: 70, workout_sessions: newer }),
      setLog({ id: 'b', set_index: 1, reps: 10, weight_kg: 60, workout_sessions: older }),
    ]);

    expect(result.bench).toEqual([{ setIndex: 1, reps: 8, weightKg: 70 }]);
  });

  it('sorts the sets by their index', () => {
    const session = { id: 'session-1', started_at: '2026-09-10T10:00:00Z' };

    const result = groupPreviousPerformance([
      setLog({ id: 'b', set_index: 2, reps: 8, workout_sessions: session }),
      setLog({ id: 'a', set_index: 1, reps: 10, workout_sessions: session }),
    ]);

    expect(result.bench.map((set) => set.setIndex)).toEqual([1, 2]);
  });

  it('leaves warm-ups out, because they are not what you want to beat', () => {
    const session = { id: 'session-1', started_at: '2026-09-10T10:00:00Z' };

    const result = groupPreviousPerformance([
      setLog({ id: 'a', set_index: 1, set_type: 'warmup', workout_sessions: session }),
      setLog({ id: 'b', set_index: 2, set_type: 'normal', workout_sessions: session }),
    ]);

    expect(result.bench).toHaveLength(1);
    expect(result.bench[0].setIndex).toBe(2);
  });

  it('keeps exercises apart', () => {
    const result = groupPreviousPerformance([
      setLog({ id: 'a', exercise_id: 'bench' }),
      setLog({ id: 'b', exercise_id: 'squat', reps: 5, weight_kg: 120 }),
    ]);

    expect(Object.keys(result).sort()).toEqual(['bench', 'squat']);
    expect(result.squat[0].weightKg).toBe(120);
  });

  it('ignores rows whose session did not come along', () => {
    expect(groupPreviousPerformance([setLog({ workout_sessions: null })])).toEqual({});
  });

  it('returns an empty map for an empty history', () => {
    expect(groupPreviousPerformance([])).toEqual({});
  });
});

describe('lastPerformedOn', () => {
  function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
    return {
      id: 'session-1',
      user_id: 'user-1',
      workout_day_id: null,
      name: 'Push',
      performed_on: '2026-09-10',
      started_at: '2026-09-10T10:00:00Z',
      ended_at: '2026-09-10T11:00:00Z',
      duration_seconds: 3600,
      notes: null,
      is_comeback: false,
      created_at: '2026-09-10T10:00:00Z',
      ...overrides,
    };
  }

  it('finds the newest finished session', () => {
    expect(
      lastPerformedOn([
        session({ performed_on: '2026-09-01' }),
        session({ performed_on: '2026-09-12' }),
        session({ performed_on: '2026-09-05' }),
      ]),
    ).toBe('2026-09-12');
  });

  it('ignores a session that was never finished', () => {
    expect(
      lastPerformedOn([
        session({ performed_on: '2026-09-01' }),
        session({ performed_on: '2026-09-20', ended_at: null }),
      ]),
    ).toBe('2026-09-01');
  });

  it('is null when there is no history at all', () => {
    expect(lastPerformedOn([])).toBeNull();
  });
});
