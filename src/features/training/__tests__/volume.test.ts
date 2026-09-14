import {
  countScoringSets,
  isScoringSet,
  setVolume,
  summariseSession,
  totalReps,
  totalVolume,
  volumeByMuscle,
  SECONDARY_MUSCLE_SHARE,
  type ScorableSet,
} from '../volume';

function set(overrides: Partial<ScorableSet> = {}): ScorableSet {
  return {
    setType: 'normal',
    reps: 10,
    weightKg: 50,
    isCompleted: true,
    ...overrides,
  };
}

describe('isScoringSet', () => {
  it('counts a completed working set', () => {
    expect(isScoringSet(set())).toBe(true);
  });

  it('never counts a warm-up', () => {
    expect(isScoringSet(set({ setType: 'warmup' }))).toBe(false);
  });

  it('counts drop sets and sets taken to failure', () => {
    expect(isScoringSet(set({ setType: 'drop' }))).toBe(true);
    expect(isScoringSet(set({ setType: 'failure' }))).toBe(true);
  });

  it('never counts a set that was not ticked off', () => {
    expect(isScoringSet(set({ isCompleted: false }))).toBe(false);
  });

  it('never counts a set without reps', () => {
    expect(isScoringSet(set({ reps: 0 }))).toBe(false);
    expect(isScoringSet(set({ reps: null }))).toBe(false);
  });

  it('does count a bodyweight set at zero kilos', () => {
    expect(isScoringSet(set({ weightKg: 0 }))).toBe(true);
    expect(isScoringSet(set({ weightKg: null }))).toBe(true);
  });
});

describe('setVolume', () => {
  it('is reps times weight', () => {
    expect(setVolume(set({ reps: 8, weightKg: 60 }))).toBe(480);
  });

  it('is zero for a set that does not score', () => {
    expect(setVolume(set({ setType: 'warmup', reps: 10, weightKg: 100 }))).toBe(0);
    expect(setVolume(set({ isCompleted: false }))).toBe(0);
  });

  it('is zero for bodyweight work, which has no external load', () => {
    expect(setVolume(set({ reps: 12, weightKg: 0 }))).toBe(0);
  });
});

describe('totalVolume, countScoringSets and totalReps', () => {
  const sets = [
    set({ setType: 'warmup', reps: 10, weightKg: 40 }),
    set({ reps: 10, weightKg: 60 }),
    set({ reps: 8, weightKg: 60 }),
    set({ reps: 6, weightKg: 60, isCompleted: false }),
  ];

  it('leaves out warm-ups and unticked sets', () => {
    expect(totalVolume(sets)).toBe(10 * 60 + 8 * 60);
    expect(countScoringSets(sets)).toBe(2);
    expect(totalReps(sets)).toBe(18);
  });

  it('handles an empty session', () => {
    expect(totalVolume([])).toBe(0);
    expect(countScoringSets([])).toBe(0);
    expect(totalReps([])).toBe(0);
  });
});

describe('volumeByMuscle', () => {
  it('gives the primary muscle the whole set and secondaries a share', () => {
    const result = volumeByMuscle([
      {
        ...set({ reps: 10, weightKg: 100 }),
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
      },
    ]);

    expect(result).toEqual([
      { muscle: 'chest', volumeKg: 1000, sets: 1 },
      { muscle: 'triceps', volumeKg: 1000 * SECONDARY_MUSCLE_SHARE, sets: SECONDARY_MUSCLE_SHARE },
    ]);
  });

  it('never counts a muscle twice when it is both primary and secondary', () => {
    const result = volumeByMuscle([
      {
        ...set({ reps: 10, weightKg: 100 }),
        primaryMuscle: 'chest',
        secondaryMuscles: ['chest', 'triceps'],
      },
    ]);

    expect(result.find((entry) => entry.muscle === 'chest')).toEqual({
      muscle: 'chest',
      volumeKg: 1000,
      sets: 1,
    });
  });

  it('sorts the heaviest muscle first', () => {
    const result = volumeByMuscle([
      { ...set({ reps: 10, weightKg: 20 }), primaryMuscle: 'biceps', secondaryMuscles: [] },
      { ...set({ reps: 10, weightKg: 200 }), primaryMuscle: 'quads', secondaryMuscles: [] },
    ]);

    expect(result.map((entry) => entry.muscle)).toEqual(['quads', 'biceps']);
  });

  it('ignores warm-ups here too', () => {
    const result = volumeByMuscle([
      {
        ...set({ setType: 'warmup', reps: 10, weightKg: 100 }),
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps'],
      },
    ]);

    expect(result).toEqual([]);
  });
});

describe('summariseSession', () => {
  it('adds up the whole session', () => {
    const summary = summariseSession([
      { sets: [set({ reps: 10, weightKg: 60 }), set({ reps: 10, weightKg: 60 })] },
      { sets: [set({ reps: 12, weightKg: 20 })] },
    ]);

    expect(summary).toEqual({ volumeKg: 1440, sets: 3, reps: 32, exercises: 2 });
  });

  it('does not count an exercise whose sets were all left unticked', () => {
    const summary = summariseSession([
      { sets: [set({ reps: 10, weightKg: 60 })] },
      { sets: [set({ isCompleted: false }), set({ setType: 'warmup' })] },
    ]);

    expect(summary.exercises).toBe(1);
  });
});
