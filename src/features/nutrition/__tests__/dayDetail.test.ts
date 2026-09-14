import { biggestContributors, macroSplit, perMealShare } from '../dayDetail';
import type { FoodLogEntry } from '../foodLog';

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

describe('macroSplit', () => {
  it('splits by calories, not by grams', () => {
    // 50 g protein = 200 kcal, 50 g fat = 450 kcal, 50 g carbs = 200 kcal.
    const slices = macroSplit({ kcal: 850, proteinG: 50, fatG: 50, carbsG: 50 });

    expect(slices.map((slice) => slice.kcal)).toEqual([200, 450, 200]);
    expect(slices.find((slice) => slice.key === 'fat')?.percent).toBeGreaterThan(
      slices.find((slice) => slice.key === 'protein')!.percent,
    );
  });

  it('always adds up to exactly 100 percent', () => {
    const cases = [
      { kcal: 100, proteinG: 1, fatG: 1, carbsG: 1 },
      { kcal: 2000, proteinG: 150, fatG: 60, carbsG: 200 },
      { kcal: 33, proteinG: 3, fatG: 3, carbsG: 3 },
      { kcal: 7, proteinG: 7, fatG: 0, carbsG: 0 },
    ];

    for (const totals of cases) {
      const sum = macroSplit(totals).reduce((running, slice) => running + slice.percent, 0);
      expect(sum).toBe(100);
    }
  });

  it('is all zeroes on an empty day instead of dividing by zero', () => {
    const slices = macroSplit({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
    expect(slices.every((slice) => slice.percent === 0)).toBe(true);
  });

  it('keeps the fixed order eiwit, vet, koolhydraten', () => {
    const slices = macroSplit({ kcal: 500, proteinG: 10, fatG: 20, carbsG: 30 });
    expect(slices.map((slice) => slice.key)).toEqual(['protein', 'fat', 'carbs']);
  });
});

describe('perMealShare', () => {
  it('always returns all four meals in order', () => {
    const shares = perMealShare([]);
    expect(shares.map((share) => share.mealType)).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
    ]);
  });

  it('works out each meal share of the day', () => {
    const shares = perMealShare([
      entry({ id: 'a', meal_type: 'breakfast', kcal: 250 }),
      entry({ id: 'b', meal_type: 'dinner', kcal: 750 }),
    ]);

    expect(shares.find((share) => share.mealType === 'breakfast')?.percent).toBe(25);
    expect(shares.find((share) => share.mealType === 'dinner')?.percent).toBe(75);
    expect(shares.find((share) => share.mealType === 'lunch')?.percent).toBe(0);
  });

  it('counts the entries per meal', () => {
    const shares = perMealShare([
      entry({ id: 'a', meal_type: 'snack' }),
      entry({ id: 'b', meal_type: 'snack' }),
    ]);

    expect(shares.find((share) => share.mealType === 'snack')?.entries).toBe(2);
  });
});

describe('biggestContributors', () => {
  it('sorts by calories, biggest first', () => {
    const contributors = biggestContributors([
      entry({ id: 'a', name: 'Kwark', kcal: 150 }),
      entry({ id: 'b', name: 'Pindakaas', kcal: 600 }),
      entry({ id: 'c', name: 'Appel', kcal: 80 }),
    ]);

    expect(contributors.map((item) => item.name)).toEqual(['Pindakaas', 'Kwark', 'Appel']);
  });

  it('works out the share of the day', () => {
    const contributors = biggestContributors([
      entry({ id: 'a', kcal: 750 }),
      entry({ id: 'b', kcal: 250 }),
    ]);

    expect(contributors[0].percent).toBe(75);
  });

  it('honours the limit', () => {
    const entries = Array.from({ length: 10 }, (_unused, index) =>
      entry({ id: `e${index}`, kcal: 100 + index }),
    );

    expect(biggestContributors(entries, 3)).toHaveLength(3);
  });

  it('leaves out anything with no calories', () => {
    const contributors = biggestContributors([
      entry({ id: 'a', kcal: 100 }),
      entry({ id: 'b', name: 'Water', kcal: 0 }),
    ]);

    expect(contributors).toHaveLength(1);
  });

  it('copes with an empty day', () => {
    expect(biggestContributors([])).toEqual([]);
  });
});
