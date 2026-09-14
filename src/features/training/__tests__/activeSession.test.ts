import {
  buildSessionInsert,
  buildSetLogInserts,
  createSession,
  formatPreviousSet,
  hasAnyCompletedSet,
  previousSetFor,
  sessionMuscleSets,
  sessionReducer,
  sessionScorableSets,
  toNumber,
  SET_LIMITS,
  type ActiveSession,
  type ExercisePick,
} from '../activeSession';
import { DEFAULT_REST_SECONDS } from '../restTimer';
import { totalVolume } from '../volume';

const NOW = new Date('2026-09-14T18:30:00.000Z');

const BENCH: ExercisePick = {
  exerciseId: 'bench',
  name: 'Bankdrukken',
  category: 'barbell',
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
};

const SQUAT: ExercisePick = {
  exerciseId: 'squat',
  name: 'Squat',
  category: 'barbell',
  primaryMuscle: 'quads',
  secondaryMuscles: ['glutes'],
};

function newSession(exercises: ExercisePick[] = [BENCH]): ActiveSession {
  return createSession({ userId: 'user-1', name: 'Push', exercises, now: NOW });
}

describe('createSession', () => {
  it('starts on today with a real uuid', () => {
    const session = newSession();

    expect(session.performedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(session.startedAtMs).toBe(NOW.getTime());
  });

  it('gives every exercise its target number of empty sets', () => {
    const session = createSession({
      userId: 'user-1',
      name: 'Push',
      exercises: [{ ...BENCH, targetSets: 4 }],
      now: NOW,
    });

    expect(session.exercises[0].sets).toHaveLength(4);
    expect(session.exercises[0].sets.every((set) => set.reps === '')).toBe(true);
    expect(session.exercises[0].restSeconds).toBe(DEFAULT_REST_SECONDS);
  });

  it('can start completely empty', () => {
    const session = createSession({ userId: 'user-1', name: 'Losse training', now: NOW });
    expect(session.exercises).toEqual([]);
  });
});

describe('sessionReducer', () => {
  it('adds exercises to the end', () => {
    const session = sessionReducer(newSession(), { type: 'add-exercises', picks: [SQUAT] });
    expect(session.exercises.map((entry) => entry.exerciseId)).toEqual(['bench', 'squat']);
  });

  it('removes an exercise', () => {
    const start = newSession([BENCH, SQUAT]);
    const session = sessionReducer(start, {
      type: 'remove-exercise',
      exerciseKey: start.exercises[0].key,
    });

    expect(session.exercises.map((entry) => entry.exerciseId)).toEqual(['squat']);
  });

  it('moves an exercise up and down without falling off the ends', () => {
    const start = newSession([BENCH, SQUAT]);
    const squatKey = start.exercises[1].key;

    const movedUp = sessionReducer(start, {
      type: 'move-exercise',
      exerciseKey: squatKey,
      direction: 'up',
    });
    expect(movedUp.exercises.map((entry) => entry.exerciseId)).toEqual(['squat', 'bench']);

    const stillThere = sessionReducer(movedUp, {
      type: 'move-exercise',
      exerciseKey: squatKey,
      direction: 'up',
    });
    expect(stillThere.exercises.map((entry) => entry.exerciseId)).toEqual(['squat', 'bench']);
  });

  it('adds a set that inherits the numbers of the one before it', () => {
    let session = newSession([{ ...BENCH, targetSets: 1 }]);
    const exerciseKey = session.exercises[0].key;
    const setKey = session.exercises[0].sets[0].key;

    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey,
      setKey,
      patch: { reps: '8', weightKg: '60' },
    });
    session = sessionReducer(session, { type: 'add-set', exerciseKey });

    expect(session.exercises[0].sets).toHaveLength(2);
    expect(session.exercises[0].sets[1]).toMatchObject({
      reps: '8',
      weightKg: '60',
      isCompleted: false,
    });
  });

  it('refuses to add more sets than the database allows', () => {
    let session = newSession([{ ...BENCH, targetSets: SET_LIMITS.maxSetsPerExercise }]);
    const exerciseKey = session.exercises[0].key;

    session = sessionReducer(session, { type: 'add-set', exerciseKey });
    expect(session.exercises[0].sets).toHaveLength(SET_LIMITS.maxSetsPerExercise);
  });

  it('removes a single set', () => {
    let session = newSession([{ ...BENCH, targetSets: 3 }]);
    const exerciseKey = session.exercises[0].key;
    const setKey = session.exercises[0].sets[1].key;

    session = sessionReducer(session, { type: 'remove-set', exerciseKey, setKey });
    expect(session.exercises[0].sets).toHaveLength(2);
    expect(session.exercises[0].sets.some((set) => set.key === setKey)).toBe(false);
  });

  it('ticks a set off and back on', () => {
    let session = newSession([{ ...BENCH, targetSets: 1 }]);
    const exerciseKey = session.exercises[0].key;
    const setKey = session.exercises[0].sets[0].key;

    session = sessionReducer(session, { type: 'toggle-set', exerciseKey, setKey });
    expect(session.exercises[0].sets[0].isCompleted).toBe(true);

    session = sessionReducer(session, { type: 'toggle-set', exerciseKey, setKey });
    expect(session.exercises[0].sets[0].isCompleted).toBe(false);
  });

  it('clamps a rest time and a superset group to what the database accepts', () => {
    let session = newSession();
    const exerciseKey = session.exercises[0].key;

    session = sessionReducer(session, { type: 'set-rest', exerciseKey, restSeconds: 5000 });
    expect(session.exercises[0].restSeconds).toBe(900);

    session = sessionReducer(session, { type: 'set-superset', exerciseKey, group: 99 });
    expect(session.exercises[0].supersetGroup).toBe(26);

    session = sessionReducer(session, { type: 'set-superset', exerciseKey, group: null });
    expect(session.exercises[0].supersetGroup).toBeNull();
  });

  it('never mutates the session it was given', () => {
    const start = newSession();
    const snapshot = JSON.stringify(start);

    sessionReducer(start, { type: 'add-exercises', picks: [SQUAT] });
    sessionReducer(start, { type: 'set-notes', notes: 'zwaar' });

    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it('ignores an action for an exercise that is not there', () => {
    const start = newSession();
    expect(sessionReducer(start, { type: 'remove-exercise', exerciseKey: 'nope' })).toEqual(start);
  });
});

describe('toNumber', () => {
  it('accepts both a comma and a dot', () => {
    expect(toNumber('62,5')).toBe(62.5);
    expect(toNumber('62.5')).toBe(62.5);
    expect(toNumber(' 8 ')).toBe(8);
  });

  it('refuses anything that is not a plain number', () => {
    expect(toNumber('')).toBeNull();
    expect(toNumber('8,')).toBeNull();
    expect(toNumber('8kg')).toBeNull();
    expect(toNumber('-5')).toBeNull();
  });
});

describe('reading a session back out', () => {
  function loggedSession(): ActiveSession {
    let session = newSession([{ ...BENCH, targetSets: 2 }, { ...SQUAT, targetSets: 1 }]);

    const bench = session.exercises[0];
    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey: bench.key,
      setKey: bench.sets[0].key,
      patch: { reps: '10', weightKg: '60', isCompleted: true },
    });
    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey: bench.key,
      setKey: bench.sets[1].key,
      patch: { reps: '8', weightKg: '65', setType: 'warmup', isCompleted: true },
    });

    const squat = session.exercises[1];
    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey: squat.key,
      setKey: squat.sets[0].key,
      patch: { reps: '5', weightKg: '100' },
    });

    return session;
  }

  it('knows whether anything was ticked off', () => {
    expect(hasAnyCompletedSet(newSession())).toBe(false);
    expect(hasAnyCompletedSet(loggedSession())).toBe(true);
  });

  it('turns typed text into scorable sets', () => {
    const sets = sessionScorableSets(loggedSession());

    expect(sets).toHaveLength(3);
    // Only the first bench set scores: the second is a warm-up and the squat
    // set was never ticked off.
    expect(totalVolume(sets)).toBe(600);
  });

  it('carries the muscles along for the per-muscle breakdown', () => {
    const sets = sessionMuscleSets(loggedSession());
    expect(sets[0].primaryMuscle).toBe('chest');
    expect(sets[0].secondaryMuscles).toEqual(['triceps']);
  });
});

describe('buildSessionInsert', () => {
  it('fills in the duration and the timestamps', () => {
    const session = newSession();
    const row = buildSessionInsert(session, session.startedAtMs + 3_600_000);

    expect(row.id).toBe(session.id);
    expect(row.user_id).toBe('user-1');
    expect(row.duration_seconds).toBe(3600);
    expect(row.started_at).toBe(new Date(session.startedAtMs).toISOString());
    expect(row.notes).toBeNull();
  });

  it('falls back to a name rather than sending an empty one', () => {
    const session = { ...newSession(), name: '   ' };
    expect(buildSessionInsert(session, session.startedAtMs).name).toBe('Training');
  });

  it('never sends a negative duration when the clock jumped', () => {
    const session = newSession();
    expect(buildSessionInsert(session, session.startedAtMs - 60_000).duration_seconds).toBe(0);
  });
});

describe('buildSetLogInserts', () => {
  it('writes only the sets that were ticked off', () => {
    let session = newSession([{ ...BENCH, targetSets: 3 }]);
    const exerciseKey = session.exercises[0].key;

    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey,
      setKey: session.exercises[0].sets[0].key,
      patch: { reps: '10', weightKg: '60', isCompleted: true },
    });
    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey,
      setKey: session.exercises[0].sets[2].key,
      patch: { reps: '8', weightKg: '60', isCompleted: true },
    });

    const rows = buildSetLogInserts(session);

    expect(rows).toHaveLength(2);
    // Renumbered: the untouched middle set does not leave a gap.
    expect(rows.map((row) => row.set_index)).toEqual([1, 2]);
    expect(rows.every((row) => row.session_id === session.id)).toBe(true);
  });

  it('numbers the exercises in the order they appear', () => {
    let session = newSession([BENCH, SQUAT]);

    for (const exercise of session.exercises) {
      session = sessionReducer(session, {
        type: 'update-set',
        exerciseKey: exercise.key,
        setKey: exercise.sets[0].key,
        patch: { reps: '5', weightKg: '80', isCompleted: true },
      });
    }

    const rows = buildSetLogInserts(session);
    expect(rows.map((row) => row.exercise_order)).toEqual([0, 1]);
  });

  it('clamps values to what the check constraints allow', () => {
    let session = newSession([{ ...BENCH, targetSets: 1 }]);
    const exerciseKey = session.exercises[0].key;

    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey,
      setKey: session.exercises[0].sets[0].key,
      patch: { reps: '99999', weightKg: '5000', rpe: '20', isCompleted: true },
    });

    const [row] = buildSetLogInserts(session);
    expect(row.reps).toBe(SET_LIMITS.maxReps);
    expect(row.weight_kg).toBe(SET_LIMITS.maxWeightKg);
    expect(row.rpe).toBe(SET_LIMITS.maxRpe);
  });

  it('leaves half-typed numbers out instead of guessing', () => {
    let session = newSession([{ ...BENCH, targetSets: 1 }]);
    const exerciseKey = session.exercises[0].key;

    session = sessionReducer(session, {
      type: 'update-set',
      exerciseKey,
      setKey: session.exercises[0].sets[0].key,
      patch: { reps: '10', weightKg: '', isCompleted: true },
    });

    const [row] = buildSetLogInserts(session);
    expect(row.reps).toBe(10);
    expect(row.weight_kg).toBeNull();
  });

  it('reuses the local set key as the row id, so a retry cannot duplicate', () => {
    let session = newSession([{ ...BENCH, targetSets: 3 }]);
    const exerciseKey = session.exercises[0].key;

    for (const set of session.exercises[0].sets) {
      session = sessionReducer(session, {
        type: 'update-set',
        exerciseKey,
        setKey: set.key,
        patch: { reps: '10', weightKg: '60', isCompleted: true },
      });
    }

    const rows = buildSetLogInserts(session);
    expect(rows.map((row) => row.id)).toEqual(session.exercises[0].sets.map((set) => set.key));
    // Building the rows again gives exactly the same ids.
    expect(buildSetLogInserts(session).map((row) => row.id)).toEqual(rows.map((row) => row.id));
  });
});

describe('previous performance', () => {
  it('formats what you did last time', () => {
    expect(formatPreviousSet({ setIndex: 1, reps: 8, weightKg: 60 })).toBe('8 × 60 kg');
    expect(formatPreviousSet({ setIndex: 1, reps: 8, weightKg: 62.5 })).toBe('8 × 62,5 kg');
    expect(formatPreviousSet({ setIndex: 1, reps: 12, weightKg: 0 })).toBe('12 herhalingen');
    expect(formatPreviousSet(undefined)).toBeNull();
    expect(formatPreviousSet({ setIndex: 1, reps: null, weightKg: null })).toBeNull();
  });

  it('looks a set up by its index', () => {
    const previous = {
      bench: [
        { setIndex: 1, reps: 10, weightKg: 60 },
        { setIndex: 2, reps: 8, weightKg: 60 },
      ],
    };

    expect(previousSetFor(previous, 'bench', 2)?.reps).toBe(8);
    expect(previousSetFor(previous, 'bench', 5)).toBeUndefined();
    expect(previousSetFor(previous, 'squat', 1)).toBeUndefined();
  });
});
