import {
  buildComebackExercises,
  describeBreak,
  describeComeback,
  COMEBACK_EXPLANATION,
  COMEBACK_STREAK_NOTE,
  COMEBACK_VOLUME_RATIO,
  type PreviousExercise,
} from '../comeback';

function exercise(overrides: Partial<PreviousExercise> = {}): PreviousExercise {
  return {
    exerciseId: 'bench',
    name: 'Bankdrukken',
    category: 'barbell',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    sets: 4,
    ...overrides,
  };
}

describe('buildComebackExercises', () => {
  it('cuts the sets to about sixty percent', () => {
    const [built] = buildComebackExercises([exercise({ sets: 5 })]);
    expect(built.targetSets).toBe(3);
  });

  it('keeps every exercise, never fewer than one set', () => {
    const built = buildComebackExercises([exercise({ sets: 1 }), exercise({ sets: 2 })]);

    expect(built).toHaveLength(2);
    expect(built.every((entry) => (entry.targetSets ?? 0) >= 1)).toBe(true);
  });

  it('keeps the exercises themselves untouched', () => {
    const [built] = buildComebackExercises([exercise()]);

    expect(built.exerciseId).toBe('bench');
    expect(built.name).toBe('Bankdrukken');
    expect(built.primaryMuscle).toBe('chest');
    expect(built.secondaryMuscles).toEqual(['triceps']);
  });

  it('lands near the target ratio over a whole session', () => {
    const previous = [
      exercise({ exerciseId: 'a', sets: 4 }),
      exercise({ exerciseId: 'b', sets: 4 }),
      exercise({ exerciseId: 'c', sets: 3 }),
      exercise({ exerciseId: 'd', sets: 3 }),
    ];

    const before = previous.reduce((running, entry) => running + entry.sets, 0);
    const after = buildComebackExercises(previous).reduce(
      (running, entry) => running + (entry.targetSets ?? 0),
      0,
    );

    expect(after / before).toBeGreaterThan(COMEBACK_VOLUME_RATIO - 0.15);
    expect(after / before).toBeLessThan(COMEBACK_VOLUME_RATIO + 0.15);
  });

  it('accepts another ratio', () => {
    const [built] = buildComebackExercises([exercise({ sets: 10 })], 0.5);
    expect(built.targetSets).toBe(5);
  });

  it('copes with nothing to scale', () => {
    expect(buildComebackExercises([])).toEqual([]);
  });
});

describe('describeComeback', () => {
  it('says what the session comes to', () => {
    // 4 sets each rounds to 2 each: 4 instead of 8.
    const text = describeComeback([exercise({ sets: 4 }), exercise({ exerciseId: 'b', sets: 4 })]);
    expect(text).toBe('4 sets in plaats van 8, met dezelfde oefeningen en gewichten.');
  });

  it('has something to say for an empty history', () => {
    expect(describeComeback([])).toContain('rustige sessie');
  });
});

describe('describeBreak', () => {
  it('reports the gap factually', () => {
    expect(describeBreak(3)).toBe('Je hebt onlangs nog getraind.');
    expect(describeBreak(9)).toBe('Je laatste training was 9 dagen geleden.');
    expect(describeBreak(21)).toBe('Je laatste training was ongeveer 3 weken geleden.');
    expect(describeBreak(90)).toBe('Je laatste training was ongeveer 3 maanden geleden.');
  });

  it('never blames the reader', () => {
    for (const days of [8, 20, 100]) {
      expect(describeBreak(days)).not.toMatch(/helaas|jammer|verzuimd|gefaald|slecht/i);
    }
  });
});

describe('the comeback copy', () => {
  it('explains why the session is lighter', () => {
    expect(COMEBACK_EXPLANATION).toContain('60%');
    expect(COMEBACK_EXPLANATION).toContain('blesseren');
  });

  it('says the streak restarts without making it a punishment', () => {
    expect(COMEBACK_STREAK_NOTE).toContain('opnieuw');
    expect(COMEBACK_STREAK_NOTE).not.toMatch(/helaas|jammer|kwijt/i);
  });

  it('never mentions food anywhere in the comeback copy', () => {
    // Hard rule: a missed week of training never changes what you eat.
    const foodWords = /kcal|calorie|eten|eet|voeding|dieet|minder eten/i;
    expect(COMEBACK_EXPLANATION).not.toMatch(foodWords);
    expect(COMEBACK_STREAK_NOTE).not.toMatch(foodWords);
    expect(describeComeback([exercise()])).not.toMatch(foodWords);
    expect(describeBreak(14)).not.toMatch(foodWords);
  });
});
