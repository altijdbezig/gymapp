import {
  buildLogRowsForMeal,
  describeMeal,
  itemTotals,
  perServing,
  sumMealItems,
  MEAL_KIND_LABELS,
  type Meal,
  type MealItem,
} from '../meals';

function item(overrides: Partial<MealItem> = {}): MealItem {
  return {
    id: 'item-1',
    meal_id: 'meal-1',
    food_id: 'food-1',
    order_index: 0,
    amount_g: 100,
    name: 'Magere kwark',
    brand: 'Albert Heijn',
    kcal_per_100g: 55,
    protein_per_100g: 10,
    fat_per_100g: 0.2,
    carbs_per_100g: 3.6,
    fiber_per_100g: 0,
    sugars_per_100g: 3.6,
    saturated_fat_per_100g: 0.1,
    salt_per_100g: 0.05,
    created_at: '2026-09-14T08:00:00Z',
    ...overrides,
  };
}

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    user_id: 'user-1',
    kind: 'meal',
    name: 'Mijn ontbijt',
    notes: null,
    servings: 1,
    created_at: '2026-09-14T08:00:00Z',
    updated_at: '2026-09-14T08:00:00Z',
    ...overrides,
  };
}

describe('itemTotals', () => {
  it('scales the per-100 g values by the amount', () => {
    const totals = itemTotals(item({ amount_g: 250 }));

    expect(totals.kcal).toBeCloseTo(137.5);
    expect(totals.proteinG).toBeCloseTo(25);
    expect(totals.saltG).toBeCloseTo(0.125);
  });

  it('accepts numerics that arrive as strings', () => {
    const totals = itemTotals(item({ amount_g: '200' as unknown as number }));
    expect(totals.kcal).toBeCloseTo(110);
  });

  it('keeps a missing micronutrient missing instead of calling it zero', () => {
    expect(itemTotals(item({ fiber_per_100g: null })).fiberG).toBeNull();
  });
});

describe('sumMealItems', () => {
  it('adds the items up', () => {
    const totals = sumMealItems([item(), item({ id: 'item-2', amount_g: 50 })]);

    expect(totals.amountG).toBe(150);
    expect(totals.kcal).toBe(83);
    expect(totals.proteinG).toBe(15);
  });

  it('drops a micronutrient as soon as one item is missing it', () => {
    const totals = sumMealItems([item(), item({ id: 'item-2', sugars_per_100g: null })]);

    expect(totals.sugarsG).toBeNull();
    // Everything else was known for both, so it survives.
    expect(totals.saltG).not.toBeNull();
  });

  it('is all zeroes for an empty meal', () => {
    expect(sumMealItems([])).toMatchObject({ amountG: 0, kcal: 0, proteinG: 0 });
  });
});

describe('perServing', () => {
  it('divides everything by the number of servings', () => {
    const totals = sumMealItems([item({ amount_g: 400 })]);
    const serving = perServing(totals, 4);

    expect(serving.amountG).toBe(100);
    expect(serving.kcal).toBe(55);
    expect(serving.proteinG).toBe(10);
  });

  it('treats zero servings as one instead of dividing by zero', () => {
    const totals = sumMealItems([item()]);
    expect(perServing(totals, 0)).toEqual(totals);
  });
});

describe('buildLogRowsForMeal', () => {
  const items = [
    item({ id: 'a', name: 'Kwark', amount_g: 250 }),
    item({ id: 'b', name: 'Havermout', amount_g: 60, kcal_per_100g: 370, protein_per_100g: 13 }),
  ];

  it('logs a meal as one row per product', () => {
    const rows = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal(),
      items,
      mealType: 'breakfast',
      loggedOn: '2026-09-14',
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.name)).toEqual(['Kwark', 'Havermout']);
    expect(rows[0].amount_g).toBe(250);
    expect(rows.every((row) => row.user_id === 'user-1')).toBe(true);
    expect(rows.every((row) => row.logged_on === '2026-09-14')).toBe(true);
  });

  it('logs a recipe as a single row for one serving', () => {
    const rows = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal({ kind: 'recipe', name: 'Overnight oats', servings: 2 }),
      items,
      mealType: 'breakfast',
      loggedOn: '2026-09-14',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Overnight oats');
    expect(rows[0].food_id).toBeNull();
    // Half of 310 g of ingredients.
    expect(rows[0].amount_g).toBe(155);
    expect(rows[0].portion_label).toBe('portie');
  });

  it('gives a recipe serving the right calories', () => {
    const totals = sumMealItems(items);
    const rows = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal({ kind: 'recipe', servings: 2 }),
      items,
      mealType: 'lunch',
      loggedOn: '2026-09-14',
    });

    const [row] = rows;
    // The database multiplies per-100 g by amount_g, so check that product.
    const loggedKcal = (row.kcal_per_100g * row.amount_g) / 100;
    expect(loggedKcal).toBeCloseTo(totals.kcal / 2, 0);
  });

  it('scales a recipe when you eat two servings', () => {
    const one = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal({ kind: 'recipe', servings: 2 }),
      items,
      mealType: 'dinner',
      loggedOn: '2026-09-14',
    })[0];

    const two = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal({ kind: 'recipe', servings: 2 }),
      items,
      mealType: 'dinner',
      loggedOn: '2026-09-14',
      servingsEaten: 2,
    })[0];

    expect(two.amount_g).toBeCloseTo(one.amount_g * 2);
    expect(two.portion_count).toBe(2);
  });

  it('never sends an amount of zero, which the check constraint refuses', () => {
    const rows = buildLogRowsForMeal({
      userId: 'user-1',
      meal: meal({ kind: 'recipe', servings: 100 }),
      items: [item({ amount_g: 1 })],
      mealType: 'snack',
      loggedOn: '2026-09-14',
    });

    expect(rows[0].amount_g).toBeGreaterThan(0);
  });
});

describe('describeMeal', () => {
  it('describes a meal by its total', () => {
    expect(describeMeal(meal(), [item(), item({ id: 'b' })])).toBe('2 producten · 110 kcal');
  });

  it('describes a recipe per serving', () => {
    expect(describeMeal(meal({ kind: 'recipe', servings: 2 }), [item(), item({ id: 'b' })])).toBe(
      '2 producten · 55 kcal per portie',
    );
  });

  it('uses the singular for one product', () => {
    expect(describeMeal(meal(), [item()])).toContain('1 product ·');
  });
});

describe('MEAL_KIND_LABELS', () => {
  it('has Dutch copy for both kinds', () => {
    expect(MEAL_KIND_LABELS.meal).toBe('Maaltijd');
    expect(MEAL_KIND_LABELS.recipe).toBe('Recept');
  });
});
