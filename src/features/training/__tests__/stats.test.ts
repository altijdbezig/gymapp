import {
  exerciseProgress,
  sessionsPerMonth,
  sessionsPerWeek,
  summariseTraining,
  totalMuscleVolume,
  trainedExercises,
  weeklyMuscleVolume,
  type StatSet,
} from '../stats';
import type { MuscleGroup } from '../volume';

function statSet(overrides: Partial<StatSet> = {}): StatSet {
  return {
    exerciseId: 'bench',
    sessionId: 'session-1',
    performedOn: '2026-09-14',
    setType: 'normal',
    reps: 10,
    weightKg: 60,
    isCompleted: true,
    ...overrides,
  };
}

function muscleSet(
  overrides: Partial<StatSet & { primaryMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[] }> = {},
) {
  return {
    ...statSet(),
    primaryMuscle: 'chest' as MuscleGroup,
    secondaryMuscles: ['triceps'] as MuscleGroup[],
    ...overrides,
  };
}

describe('exerciseProgress', () => {
  it('gives one point per session, oldest first', () => {
    const points = exerciseProgress(
      [
        statSet({ sessionId: 'b', performedOn: '2026-09-14' }),
        statSet({ sessionId: 'a', performedOn: '2026-09-07' }),
      ],
      'bench',
    );

    expect(points.map((point) => point.date)).toEqual(['2026-09-07', '2026-09-14']);
  });

  it('takes the best estimate and the heaviest set of each session', () => {
    const [point] = exerciseProgress(
      [
        statSet({ reps: 10, weightKg: 60 }),
        statSet({ reps: 5, weightKg: 80 }),
        statSet({ reps: 8, weightKg: 70 }),
      ],
      'bench',
    );

    expect(point.heaviestKg).toBe(80);
    // 80 x (1 + 5/30) = 93.3, the best of the three.
    expect(point.estimated1rmKg).toBe(93.3);
    expect(point.volumeKg).toBe(600 + 400 + 560);
    expect(point.sets).toBe(3);
  });

  it('leaves warm-ups and unticked sets out', () => {
    const [point] = exerciseProgress(
      [
        statSet({ setType: 'warmup', weightKg: 200 }),
        statSet({ isCompleted: false, weightKg: 300 }),
        statSet({ weightKg: 60 }),
      ],
      'bench',
    );

    expect(point.heaviestKg).toBe(60);
    expect(point.sets).toBe(1);
  });

  it('has no point at all for a session you only warmed up in', () => {
    const points = exerciseProgress([statSet({ setType: 'warmup' })], 'bench');
    expect(points).toEqual([]);
  });

  it('ignores other exercises', () => {
    const points = exerciseProgress(
      [statSet({ exerciseId: 'squat', weightKg: 200 }), statSet({ weightKg: 60 })],
      'bench',
    );

    expect(points).toHaveLength(1);
    expect(points[0].heaviestKg).toBe(60);
  });
});

describe('trainedExercises', () => {
  it('lists the exercises you have done, most sets first', () => {
    const result = trainedExercises([
      statSet({ exerciseId: 'bench' }),
      statSet({ exerciseId: 'bench' }),
      statSet({ exerciseId: 'squat' }),
    ]);

    expect(result.map((entry) => entry.exerciseId)).toEqual(['bench', 'squat']);
    expect(result[0].sets).toBe(2);
  });

  it('remembers when you last did each one', () => {
    const result = trainedExercises([
      statSet({ performedOn: '2026-09-01' }),
      statSet({ performedOn: '2026-09-14' }),
    ]);

    expect(result[0].lastPerformedOn).toBe('2026-09-14');
  });

  it('leaves out exercises you only warmed up with', () => {
    expect(trainedExercises([statSet({ setType: 'warmup' })])).toEqual([]);
  });
});

describe('weeklyMuscleVolume', () => {
  it('groups by week, newest first', () => {
    const result = weeklyMuscleVolume([
      muscleSet({ performedOn: '2026-09-14' }),
      muscleSet({ performedOn: '2026-09-07' }),
    ]);

    expect(result.map((week) => week.weekStart)).toEqual(['2026-09-14', '2026-09-07']);
  });

  it('credits the secondary muscle for half a set', () => {
    const [week] = weeklyMuscleVolume([muscleSet({ reps: 10, weightKg: 100 })]);

    expect(week.muscles.find((entry) => entry.muscle === 'chest')).toEqual({
      muscle: 'chest',
      volumeKg: 1000,
      sets: 1,
    });
    expect(week.muscles.find((entry) => entry.muscle === 'triceps')).toEqual({
      muscle: 'triceps',
      volumeKg: 500,
      sets: 0.5,
    });
  });

  it('leaves out a week with nothing that scores', () => {
    expect(weeklyMuscleVolume([muscleSet({ setType: 'warmup' })])).toEqual([]);
  });
});

describe('totalMuscleVolume', () => {
  it('rolls everything up into one list', () => {
    const result = totalMuscleVolume([
      muscleSet({ performedOn: '2026-09-01' }),
      muscleSet({ performedOn: '2026-09-14' }),
    ]);

    expect(result.find((entry) => entry.muscle === 'chest')?.sets).toBe(2);
  });
});

describe('sessionsPerWeek and sessionsPerMonth', () => {
  const sessions = [
    { performedOn: '2026-09-14', durationSeconds: 3600 },
    { performedOn: '2026-09-16', durationSeconds: 5400 },
    { performedOn: '2026-09-07', durationSeconds: null },
  ];

  it('counts the sessions per week', () => {
    const weeks = sessionsPerWeek(sessions);

    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ periodStart: '2026-09-14', sessions: 2 });
  });

  it('averages only the sessions that recorded a duration', () => {
    const [week] = sessionsPerWeek(sessions);
    expect(week.averageDurationSeconds).toBe(4500);

    const withoutDuration = sessionsPerWeek([{ performedOn: '2026-09-07', durationSeconds: null }]);
    expect(withoutDuration[0].averageDurationSeconds).toBeNull();
  });

  it('counts the sessions per month', () => {
    const months = sessionsPerMonth([
      ...sessions,
      { performedOn: '2026-08-20', durationSeconds: 3000 },
    ]);

    expect(months.map((month) => month.periodStart)).toEqual(['2026-09-01', '2026-08-01']);
    expect(months[0].sessions).toBe(3);
  });

  it('copes with no history', () => {
    expect(sessionsPerWeek([])).toEqual([]);
    expect(sessionsPerMonth([])).toEqual([]);
  });
});

describe('summariseTraining', () => {
  it('averages over the weeks you trained, not over the calendar', () => {
    const summary = summariseTraining(
      [
        { performedOn: '2026-09-14', durationSeconds: 3600 },
        { performedOn: '2026-09-16', durationSeconds: 3600 },
        // A month earlier, after a long break.
        { performedOn: '2026-08-10', durationSeconds: 3600 },
      ],
      [statSet({ reps: 10, weightKg: 60 })],
    );

    // Three sessions across two weeks that had training: 1.5 per week.
    expect(summary.sessions).toBe(3);
    expect(summary.averagePerWeek).toBe(1.5);
    expect(summary.averageDurationSeconds).toBe(3600);
    expect(summary.totalVolumeKg).toBe(600);
  });

  it('is all zeroes for an empty history', () => {
    const summary = summariseTraining([], []);

    expect(summary).toEqual({
      sessions: 0,
      averagePerWeek: 0,
      averageDurationSeconds: null,
      totalVolumeKg: 0,
    });
  });
});
