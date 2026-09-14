import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_ORDER,
  exerciseSubtitle,
  filterExercises,
  isCardio,
  matchesQuery,
  normaliseTerm,
  sortExercises,
  usesBarbell,
  type Exercise,
} from '../exerciseLibrary';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench',
    name: 'Bankdrukken',
    aliases: ['bench press', 'barbell bench press'],
    primary_muscle: 'chest',
    secondary_muscles: ['triceps', 'shoulders'],
    category: 'barbell',
    instructions: null,
    is_custom: false,
    created_by: null,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

describe('normaliseTerm', () => {
  it('lowercases and strips accents', () => {
    expect(normaliseTerm('Één')).toBe('een');
    expect(normaliseTerm('  Café  ')).toBe('cafe');
  });
});

describe('matchesQuery', () => {
  it('matches the Dutch name', () => {
    expect(matchesQuery(exercise(), 'bankdruk')).toBe(true);
  });

  it('matches an English alias', () => {
    expect(matchesQuery(exercise(), 'bench')).toBe(true);
    expect(matchesQuery(exercise(), 'bench press')).toBe(true);
  });

  it('ignores case and accents', () => {
    expect(matchesQuery(exercise({ name: 'Één been Roemeense deadlift' }), 'een been')).toBe(true);
  });

  it('needs every word to appear somewhere', () => {
    expect(matchesQuery(exercise(), 'bench squat')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(exercise(), '')).toBe(true);
    expect(matchesQuery(exercise(), '   ')).toBe(true);
  });
});

describe('filterExercises', () => {
  const library = [
    exercise(),
    exercise({
      id: 'squat',
      name: 'Squat',
      aliases: ['back squat'],
      primary_muscle: 'quads',
      secondary_muscles: ['glutes'],
      category: 'barbell',
    }),
    exercise({
      id: 'pushdown',
      name: 'Triceps pushdown',
      aliases: ['pushdown'],
      primary_muscle: 'triceps',
      secondary_muscles: [],
      category: 'cable',
    }),
    exercise({
      id: 'mine',
      name: 'Mijn eigen oefening',
      aliases: [],
      primary_muscle: 'abs',
      secondary_muscles: [],
      category: 'other',
      is_custom: true,
      created_by: 'user-1',
    }),
  ];

  it('filters on category', () => {
    const result = filterExercises(library, { category: 'cable' });
    expect(result.map((entry) => entry.id)).toEqual(['pushdown']);
  });

  it('filters on muscle group, secondary muscles included', () => {
    const result = filterExercises(library, { muscle: 'triceps' });
    // Bankdrukken has triceps as a secondary muscle, so it belongs here.
    expect(result.map((entry) => entry.id).sort()).toEqual(['bench', 'pushdown']);
  });

  it('can show only your own exercises', () => {
    const result = filterExercises(library, { ownership: 'custom' });
    expect(result.map((entry) => entry.id)).toEqual(['mine']);
  });

  it('combines a query with a filter', () => {
    const result = filterExercises(library, { query: 'squat', muscle: 'quads' });
    expect(result.map((entry) => entry.id)).toEqual(['squat']);
  });

  it('returns everything when nothing is filtered', () => {
    expect(filterExercises(library, {})).toHaveLength(library.length);
  });
});

describe('sortExercises', () => {
  it('puts your own exercises first, then sorts by name', () => {
    const sorted = sortExercises([
      exercise({ id: 'b', name: 'Bankdrukken' }),
      exercise({ id: 'a', name: 'Arnold press' }),
      exercise({ id: 'mine', name: 'Zelfbedachte curl', is_custom: true, created_by: 'user-1' }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['mine', 'a', 'b']);
  });
});

describe('labels', () => {
  it('has a Dutch label for every muscle group and category in the order list', () => {
    for (const muscle of MUSCLE_GROUP_ORDER) {
      expect(MUSCLE_GROUP_LABELS[muscle]).toBeTruthy();
    }
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it('lists every muscle group and category exactly once', () => {
    expect(new Set(MUSCLE_GROUP_ORDER).size).toBe(MUSCLE_GROUP_ORDER.length);
    expect(MUSCLE_GROUP_ORDER.length).toBe(Object.keys(MUSCLE_GROUP_LABELS).length);
    expect(CATEGORY_ORDER.length).toBe(Object.keys(CATEGORY_LABELS).length);
  });

  it('builds a subtitle from the muscle and the equipment', () => {
    expect(exerciseSubtitle(exercise())).toBe('Borst · Halter');
  });
});

describe('isCardio and usesBarbell', () => {
  it('recognises cardio', () => {
    expect(isCardio(exercise({ category: 'cardio' }))).toBe(true);
    expect(isCardio(exercise({ category: 'barbell' }))).toBe(false);
  });

  it('only offers the plate calculator for a straight bar', () => {
    expect(usesBarbell(exercise({ category: 'barbell' }))).toBe(true);
    expect(usesBarbell(exercise({ category: 'machine' }))).toBe(false);
  });
});
