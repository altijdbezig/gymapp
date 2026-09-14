import {
  bestsPerExercise,
  buildRecordUpserts,
  detectBrokenRecords,
  RECORD_LABELS,
  type SessionSet,
  type StoredRecord,
} from '../personalRecords';

function sessionSet(overrides: Partial<SessionSet> = {}): SessionSet {
  return {
    exerciseId: 'bench',
    setType: 'normal',
    reps: 10,
    weightKg: 60,
    isCompleted: true,
    ...overrides,
  };
}

function stored(overrides: Partial<StoredRecord> = {}): StoredRecord {
  return {
    exercise_id: 'bench',
    best_weight_kg: null,
    best_weight_reps: null,
    best_weight_on: null,
    best_1rm_kg: null,
    best_1rm_on: null,
    best_volume_kg: null,
    best_volume_on: null,
    ...overrides,
  };
}

describe('bestsPerExercise', () => {
  it('finds the heaviest set, the best estimate and the total volume', () => {
    const [bests] = bestsPerExercise([
      sessionSet({ reps: 10, weightKg: 60 }),
      sessionSet({ reps: 5, weightKg: 80 }),
      sessionSet({ reps: 8, weightKg: 70 }),
    ]);

    expect(bests.heaviestKg).toBe(80);
    expect(bests.heaviestReps).toBe(5);
    // 80 x (1 + 5/30) = 93.3 vs 70 x (1 + 8/30) = 88.7 vs 60 x (1 + 10/30) = 80.
    expect(bests.best1rmKg).toBe(93.3);
    expect(bests.volumeKg).toBe(600 + 400 + 560);
  });

  it('breaks a tie on the same weight by reps', () => {
    const [bests] = bestsPerExercise([
      sessionSet({ reps: 3, weightKg: 100 }),
      sessionSet({ reps: 5, weightKg: 100 }),
    ]);

    expect(bests.heaviestReps).toBe(5);
  });

  it('leaves warm-ups out of every record', () => {
    const [bests] = bestsPerExercise([
      sessionSet({ setType: 'warmup', reps: 5, weightKg: 200 }),
      sessionSet({ reps: 10, weightKg: 60 }),
    ]);

    expect(bests.heaviestKg).toBe(60);
    expect(bests.volumeKg).toBe(600);
  });

  it('keeps exercises apart', () => {
    const results = bestsPerExercise([
      sessionSet({ exerciseId: 'bench', reps: 10, weightKg: 60 }),
      sessionSet({ exerciseId: 'squat', reps: 5, weightKg: 120 }),
    ]);

    expect(results).toHaveLength(2);
    expect(results.find((entry) => entry.exerciseId === 'squat')?.heaviestKg).toBe(120);
  });

  it('returns nothing when no set was ticked off', () => {
    expect(bestsPerExercise([sessionSet({ isCompleted: false })])).toEqual([]);
  });
});

describe('detectBrokenRecords', () => {
  it('reports every first attempt as a record without a previous value', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 10, weightKg: 60 })]);
    const broken = detectBrokenRecords(bests, []);

    expect(broken.map((record) => record.kind)).toEqual(['weight', 'one_rm', 'volume']);
    expect(broken.every((record) => record.previous === null)).toBe(true);
  });

  it('reports only what actually improved', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 10, weightKg: 60 })]);

    const broken = detectBrokenRecords(bests, [
      stored({ best_weight_kg: 80, best_1rm_kg: 120, best_volume_kg: 500 }),
    ]);

    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({ kind: 'volume', value: 600, previous: 500 });
  });

  it('does not call matching a record beating it', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 10, weightKg: 60 })]);

    const broken = detectBrokenRecords(bests, [
      stored({ best_weight_kg: 60, best_1rm_kg: 80, best_volume_kg: 600 }),
    ]);

    expect(broken).toEqual([]);
  });

  it('has Dutch copy for every kind', () => {
    expect(RECORD_LABELS.weight).toBe('Zwaarste set');
    expect(RECORD_LABELS.one_rm).toBe('Beste geschatte 1RM');
    expect(RECORD_LABELS.volume).toBe('Meeste volume in één sessie');
  });
});

describe('buildRecordUpserts', () => {
  it('writes nothing for an exercise that did not improve', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 10, weightKg: 60 })]);

    const upserts = buildRecordUpserts(
      bests,
      [stored({ best_weight_kg: 100, best_1rm_kg: 150, best_volume_kg: 900 })],
      '2026-09-14',
    );

    expect(upserts).toEqual([]);
  });

  it('only dates the fields that improved and keeps the old dates', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 10, weightKg: 60 })]);

    const [upsert] = buildRecordUpserts(
      bests,
      [
        stored({
          best_weight_kg: 100,
          best_weight_reps: 3,
          best_weight_on: '2026-03-01',
          best_1rm_kg: 150,
          best_1rm_on: '2026-03-01',
          best_volume_kg: 500,
          best_volume_on: '2026-03-01',
        }),
      ],
      '2026-09-14',
    );

    // Only volume improved: 600 > 500.
    expect(upsert.best_volume_kg).toBe(600);
    expect(upsert.best_volume_on).toBe('2026-09-14');

    expect(upsert.best_weight_kg).toBe(100);
    expect(upsert.best_weight_reps).toBe(3);
    expect(upsert.best_weight_on).toBe('2026-03-01');
    expect(upsert.best_1rm_on).toBe('2026-03-01');
  });

  it('writes a complete row the first time an exercise is done', () => {
    const bests = bestsPerExercise([sessionSet({ reps: 5, weightKg: 100 })]);
    const [upsert] = buildRecordUpserts(bests, [], '2026-09-14');

    expect(upsert).toEqual({
      exercise_id: 'bench',
      best_weight_kg: 100,
      best_weight_reps: 5,
      best_weight_on: '2026-09-14',
      best_1rm_kg: 116.7,
      best_1rm_on: '2026-09-14',
      best_volume_kg: 500,
      best_volume_on: '2026-09-14',
    });
  });
});
