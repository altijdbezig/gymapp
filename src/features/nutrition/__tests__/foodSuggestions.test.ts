import {
  describeSuggestion,
  filterSuggestions,
  frequentFoods,
  recentFoods,
} from '../foodSuggestions';
import type { FoodLogEntry } from '../foodLog';

function entry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  return {
    id: `entry-${Math.random()}`,
    user_id: 'user-1',
    food_id: 'food-1',
    logged_on: '2026-09-14',
    meal_type: 'breakfast',
    amount_g: 200,
    name: 'Magere kwark',
    brand: 'Albert Heijn',
    kcal_per_100g: 55,
    protein_per_100g: 10,
    fat_per_100g: 0.2,
    carbs_per_100g: 3.6,
    kcal: 110,
    protein_g: 20,
    fat_g: 0.4,
    carbs_g: 7.2,
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

describe('recentFoods', () => {
  it('lists each product once, newest first', () => {
    const suggestions = recentFoods([
      entry({ food_id: 'a', name: 'Kwark', logged_on: '2026-09-10' }),
      entry({ food_id: 'b', name: 'Havermout', logged_on: '2026-09-14' }),
      entry({ food_id: 'a', name: 'Kwark', logged_on: '2026-09-12' }),
    ]);

    expect(suggestions.map((item) => item.name)).toEqual(['Havermout', 'Kwark']);
  });

  it('takes the numbers from the newest entry for that product', () => {
    const [suggestion] = recentFoods([
      entry({ food_id: 'a', logged_on: '2026-09-10', amount_g: 100 }),
      entry({ food_id: 'a', logged_on: '2026-09-14', amount_g: 250 }),
    ]);

    expect(suggestion.lastAmountG).toBe(250);
    expect(suggestion.lastLoggedOn).toBe('2026-09-14');
  });

  it('breaks a same-day tie on the time it was logged', () => {
    const [suggestion] = recentFoods([
      entry({ food_id: 'a', amount_g: 100, created_at: '2026-09-14T08:00:00Z' }),
      entry({ food_id: 'a', amount_g: 300, created_at: '2026-09-14T20:00:00Z' }),
    ]);

    expect(suggestion.lastAmountG).toBe(300);
  });

  it('keeps quick entries, which have no product behind them', () => {
    const suggestions = recentFoods([
      entry({ food_id: null, name: 'Snackbar' }),
      entry({ food_id: null, name: 'Snackbar' }),
      entry({ food_id: null, name: 'Bij oma gegeten' }),
    ]);

    expect(suggestions).toHaveLength(2);
    expect(suggestions.find((item) => item.name === 'Snackbar')?.count).toBe(2);
  });

  it('treats the same name in different cases as one thing', () => {
    const suggestions = recentFoods([
      entry({ food_id: null, name: 'Snackbar' }),
      entry({ food_id: null, name: 'snackbar' }),
    ]);

    expect(suggestions).toHaveLength(1);
  });

  it('honours the limit', () => {
    const entries = Array.from({ length: 50 }, (_unused, index) =>
      entry({ food_id: `food-${index}` }),
    );

    expect(recentFoods(entries, 10)).toHaveLength(10);
  });

  it('copes with an empty history', () => {
    expect(recentFoods([])).toEqual([]);
  });
});

describe('frequentFoods', () => {
  it('sorts by how often you ate it', () => {
    const suggestions = frequentFoods([
      entry({ food_id: 'a', name: 'Kwark' }),
      entry({ food_id: 'a', name: 'Kwark' }),
      entry({ food_id: 'a', name: 'Kwark' }),
      entry({ food_id: 'b', name: 'Havermout' }),
      entry({ food_id: 'b', name: 'Havermout' }),
    ]);

    expect(suggestions.map((item) => item.name)).toEqual(['Kwark', 'Havermout']);
    expect(suggestions[0].count).toBe(3);
  });

  it('leaves out something eaten only once', () => {
    const suggestions = frequentFoods([
      entry({ food_id: 'a', name: 'Kwark' }),
      entry({ food_id: 'a', name: 'Kwark' }),
      entry({ food_id: 'b', name: 'Eenmalig' }),
    ]);

    expect(suggestions.map((item) => item.name)).toEqual(['Kwark']);
  });

  it('breaks a tie with the most recent', () => {
    const suggestions = frequentFoods([
      entry({ food_id: 'a', name: 'Oud', logged_on: '2026-09-01' }),
      entry({ food_id: 'a', name: 'Oud', logged_on: '2026-09-02' }),
      entry({ food_id: 'b', name: 'Nieuw', logged_on: '2026-09-13' }),
      entry({ food_id: 'b', name: 'Nieuw', logged_on: '2026-09-14' }),
    ]);

    expect(suggestions[0].name).toBe('Nieuw');
  });
});

describe('filterSuggestions', () => {
  const suggestions = recentFoods([
    entry({ food_id: 'a', name: 'Magere kwark', brand: 'Albert Heijn' }),
    entry({ food_id: 'b', name: 'Havermout', brand: 'Quaker' }),
  ]);

  it('returns everything for an empty query', () => {
    expect(filterSuggestions(suggestions, '')).toHaveLength(2);
  });

  it('matches the name and the brand', () => {
    expect(filterSuggestions(suggestions, 'kwark')).toHaveLength(1);
    expect(filterSuggestions(suggestions, 'quaker')).toHaveLength(1);
  });

  it('ignores case', () => {
    expect(filterSuggestions(suggestions, 'HAVER')).toHaveLength(1);
  });
});

describe('describeSuggestion', () => {
  it('reads as brand, calories and protein per 100 g', () => {
    const [suggestion] = recentFoods([entry()]);
    expect(describeSuggestion(suggestion)).toBe('Albert Heijn · 55 kcal · 10 g eiwit per 100 g');
  });

  it('leaves the brand out when there is none', () => {
    const [suggestion] = recentFoods([entry({ brand: null })]);
    expect(describeSuggestion(suggestion)).toBe('55 kcal · 10 g eiwit per 100 g');
  });
});
