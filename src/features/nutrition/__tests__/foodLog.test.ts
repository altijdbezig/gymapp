import {
  buildProgress,
  EMPTY_TOTALS,
  groupByMeal,
  macrosForAmount,
  MEAL_LABELS,
  MEAL_TYPES,
  suggestMealType,
  sumEntries,
  type FoodLogEntry,
  type MealType,
} from '../foodLog';

function entry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    food_id: 'food-1',
    logged_on: '2026-09-14',
    meal_type: 'breakfast',
    amount_g: 100,
    name: 'Magere kwark',
    brand: 'Albert Heijn',
    kcal_per_100g: 55,
    protein_per_100g: 10,
    fat_per_100g: 0.2,
    carbs_per_100g: 3.6,
    kcal: 55,
    protein_g: 10,
    fat_g: 0.2,
    carbs_g: 3.6,
    fiber_per_100g: null,
    sugars_per_100g: null,
    saturated_fat_per_100g: null,
    salt_per_100g: null,
    fiber_g: null,
    sugars_g: null,
    saturated_fat_g: null,
    salt_g: null,
    portion_label: null,
    portion_count: null,
    created_at: '2026-09-14T08:00:00Z',
    ...overrides,
  };
}

describe('sumEntries', () => {
  it('returns zeroes for an empty day', () => {
    expect(sumEntries([])).toEqual(EMPTY_TOTALS);
  });

  it('adds up several entries', () => {
    const totals = sumEntries([
      entry({ kcal: 200, protein_g: 20, fat_g: 5, carbs_g: 15 }),
      entry({ kcal: 300, protein_g: 10, fat_g: 12, carbs_g: 30 }),
    ]);
    expect(totals).toEqual({ kcal: 500, proteinG: 30, fatG: 17, carbsG: 45 });
  });

  it('rounds once at the end instead of per entry', () => {
    // Three entries of 0.4 kcal are 1.2 together. Rounding each first gives 0.
    const totals = sumEntries([
      entry({ kcal: 0.4, protein_g: 0.4, fat_g: 0.4, carbs_g: 0.4 }),
      entry({ kcal: 0.4, protein_g: 0.4, fat_g: 0.4, carbs_g: 0.4 }),
      entry({ kcal: 0.4, protein_g: 0.4, fat_g: 0.4, carbs_g: 0.4 }),
    ]);
    expect(totals.kcal).toBe(1);
  });

  it('reads numerics that arrive as strings from PostgREST', () => {
    const totals = sumEntries([
      entry({ kcal: '82.50' as unknown as number, protein_g: '15.25' as unknown as number }),
    ]);
    expect(totals.kcal).toBe(83);
    expect(totals.proteinG).toBe(15);
  });

  it('treats a null generated column as zero instead of NaN', () => {
    const totals = sumEntries([entry({ kcal: null, protein_g: null, fat_g: null, carbs_g: null })]);
    expect(totals).toEqual(EMPTY_TOTALS);
  });

  it('never produces NaN, whatever the entry holds', () => {
    const totals = sumEntries([
      entry({ kcal: Number.NaN, protein_g: 'onzin' as unknown as number }),
    ]);
    expect(Number.isNaN(totals.kcal)).toBe(false);
    expect(Number.isNaN(totals.proteinG)).toBe(false);
  });
});

describe('groupByMeal', () => {
  it('always returns all four meals, in the order of a day', () => {
    const groups = groupByMeal([]);
    expect(groups.map((group) => group.mealType)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it('gives every meal its Dutch label', () => {
    const groups = groupByMeal([]);
    expect(groups.map((group) => group.label)).toEqual([
      'Ontbijt',
      'Lunch',
      'Diner',
      'Snacks',
    ]);
  });

  it('puts each entry in its own meal', () => {
    const groups = groupByMeal([
      entry({ id: 'a', meal_type: 'breakfast' }),
      entry({ id: 'b', meal_type: 'dinner' }),
      entry({ id: 'c', meal_type: 'dinner' }),
    ]);

    const byMeal = Object.fromEntries(groups.map((group) => [group.mealType, group.entries.length]));
    expect(byMeal).toEqual({ breakfast: 1, lunch: 0, dinner: 2, snack: 0 });
  });

  it('totals each meal separately', () => {
    const groups = groupByMeal([
      entry({ meal_type: 'lunch', kcal: 400, protein_g: 30, fat_g: 10, carbs_g: 40 }),
      entry({ meal_type: 'lunch', kcal: 100, protein_g: 5, fat_g: 2, carbs_g: 12 }),
      entry({ meal_type: 'snack', kcal: 200, protein_g: 2, fat_g: 10, carbs_g: 25 }),
    ]);

    const lunch = groups.find((group) => group.mealType === 'lunch')!;
    expect(lunch.totals).toEqual({ kcal: 500, proteinG: 35, fatG: 12, carbsG: 52 });

    const breakfast = groups.find((group) => group.mealType === 'breakfast')!;
    expect(breakfast.totals).toEqual(EMPTY_TOTALS);
  });

  it('keeps every entry: the meal totals add up to the day total', () => {
    const entries = [
      entry({ meal_type: 'breakfast', kcal: 300 }),
      entry({ meal_type: 'lunch', kcal: 600 }),
      entry({ meal_type: 'dinner', kcal: 800 }),
      entry({ meal_type: 'snack', kcal: 250 }),
    ];

    const fromGroups = groupByMeal(entries).reduce((sum, group) => sum + group.totals.kcal, 0);
    expect(fromGroups).toBe(sumEntries(entries).kcal);
  });

  it('covers every meal type the database allows', () => {
    // If a meal type is ever added to the enum, this fails until the labels and
    // the order are updated too.
    const labelled = Object.keys(MEAL_LABELS).sort();
    expect([...MEAL_TYPES].sort()).toEqual(labelled);
  });
});

describe('buildProgress', () => {
  const target = { kcal: 2500, proteinG: 150, fatG: 70, carbsG: 300 };

  it('returns the four bars in a fixed order', () => {
    const bars = buildProgress(EMPTY_TOTALS, target);
    expect(bars.map((bar) => bar.label)).toEqual([
      'Calorieën',
      'Eiwit',
      'Vet',
      'Koolhydraten',
    ]);
  });

  it('is empty when nothing has been eaten', () => {
    const bars = buildProgress(EMPTY_TOTALS, target);
    for (const bar of bars) {
      expect(bar.ratio).toBe(0);
      expect(bar.isOver).toBe(false);
      expect(bar.remaining).toBe(bar.target);
    }
  });

  it('fills halfway at half the target', () => {
    const bars = buildProgress({ kcal: 1250, proteinG: 75, fatG: 35, carbsG: 150 }, target);
    for (const bar of bars) {
      expect(bar.ratio).toBeCloseTo(0.5);
    }
  });

  it('counts down what is left', () => {
    const [kcalBar] = buildProgress({ ...EMPTY_TOTALS, kcal: 2000 }, target);
    expect(kcalBar.remaining).toBe(500);
  });

  it('clamps the bar at full when you go over, and flags it', () => {
    const [kcalBar] = buildProgress({ ...EMPTY_TOTALS, kcal: 3200 }, target);
    expect(kcalBar.ratio).toBe(1);
    expect(kcalBar.isOver).toBe(true);
    // Never negative: "nog 0" reads better than "nog -700".
    expect(kcalBar.remaining).toBe(0);
  });

  it('does not flag hitting the target exactly as going over', () => {
    const [kcalBar] = buildProgress({ ...EMPTY_TOTALS, kcal: 2500 }, target);
    expect(kcalBar.ratio).toBe(1);
    expect(kcalBar.isOver).toBe(false);
    expect(kcalBar.remaining).toBe(0);
  });

  it('survives a target of zero without dividing by zero', () => {
    const zeroTarget = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };

    const empty = buildProgress(EMPTY_TOTALS, zeroTarget);
    for (const bar of empty) {
      expect(bar.ratio).toBe(0);
      expect(Number.isNaN(bar.ratio)).toBe(false);
    }

    const eaten = buildProgress({ kcal: 100, proteinG: 5, fatG: 2, carbsG: 10 }, zeroTarget);
    for (const bar of eaten) {
      expect(bar.ratio).toBe(1);
      expect(bar.isOver).toBe(true);
    }
  });

  it('keeps the ratio between 0 and 1 for any input', () => {
    const cases = [-500, 0, 1, 2499, 2500, 2501, 99999];
    for (const kcal of cases) {
      const [bar] = buildProgress({ ...EMPTY_TOTALS, kcal }, target);
      expect(bar.ratio).toBeGreaterThanOrEqual(0);
      expect(bar.ratio).toBeLessThanOrEqual(1);
    }
  });

  it('labels calories in kcal and the macros in grams', () => {
    const [kcalBar, ...macroBars] = buildProgress(EMPTY_TOTALS, target);
    expect(kcalBar.unit).toBe('kcal');
    for (const bar of macroBars) {
      expect(bar.unit).toBe('g');
    }
  });
});

describe('macrosForAmount', () => {
  const food = {
    kcal_per_100g: 55,
    protein_per_100g: 10,
    fat_per_100g: 0.2,
    carbs_per_100g: 3.6,
  };

  it('returns the per-100g values for exactly 100 g', () => {
    expect(macrosForAmount(food, 100)).toEqual({ kcal: 55, proteinG: 10, fatG: 0, carbsG: 4 });
  });

  it('scales up', () => {
    expect(macrosForAmount(food, 250)).toEqual({ kcal: 138, proteinG: 25, fatG: 1, carbsG: 9 });
  });

  it('scales down', () => {
    expect(macrosForAmount(food, 50)).toEqual({ kcal: 28, proteinG: 5, fatG: 0, carbsG: 2 });
  });

  it('is zero for an amount of zero', () => {
    expect(macrosForAmount(food, 0)).toEqual(EMPTY_TOTALS);
  });

  it('returns whole numbers', () => {
    const macros = macrosForAmount(food, 137);
    for (const value of Object.values(macros)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('matches what the database generates for the same amount', () => {
    // food_log_entries computes kcal as kcal_per_100g * amount_g / 100. Ours
    // must agree, or the preview would not match the logged entry.
    const amountG = 175;
    const fromDatabase = Math.round((food.kcal_per_100g * amountG) / 100);
    expect(macrosForAmount(food, amountG).kcal).toBe(fromDatabase);
  });
});

describe('suggestMealType', () => {
  function at(hour: number): Date {
    return new Date(2026, 8, 14, hour, 30);
  }

  it.each([
    [0, 'breakfast'],
    [7, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [13, 'lunch'],
    [14, 'lunch'],
    [15, 'dinner'],
    [18, 'dinner'],
    [20, 'dinner'],
    [21, 'snack'],
    [23, 'snack'],
  ])('suggests %s:30 as %s', (hour, expected) => {
    expect(suggestMealType(at(hour))).toBe(expected);
  });

  it('only ever suggests a meal the database accepts', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(MEAL_TYPES).toContain(suggestMealType(at(hour)));
    }
  });
});

describe('MEAL_TYPES', () => {
  it('has no duplicates', () => {
    expect(new Set(MEAL_TYPES).size).toBe(MEAL_TYPES.length);
  });

  it.each(MEAL_TYPES)('has a Dutch label for %s', (mealType: MealType) => {
    expect(MEAL_LABELS[mealType]).toBeTruthy();
  });
});
