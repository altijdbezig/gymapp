import {
  describeGap,
  describeRecipe,
  distanceFromTarget,
  findMatches,
  fitsDiet,
  isAllergySafe,
  isCloseEnough,
  matchesFilters,
  readIngredients,
  DIET_LABELS,
  DIFFICULTY_LABELS,
  MATCH_TOLERANCE,
  type Recipe,
  type RecipeFilters,
} from '../recipeMatching';

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: `recipe-${Math.random()}`,
    created_by: 'user-1',
    title: 'Kip met rijst',
    description: 'Simpel en snel.',
    servings: 1,
    kcal_per_serving: 600,
    protein_per_serving: 50,
    fat_per_serving: 15,
    carbs_per_serving: 60,
    prep_minutes: 25,
    difficulty: 'easy',
    cuisine: 'Hollands',
    diet: 'none',
    allergens: [],
    ingredients: [{ name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' }],
    steps: ['Bak de kip.', 'Kook de rijst.'],
    model: 'claude-opus-5',
    is_public: true,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

const FILTERS: RecipeFilters = {
  diet: 'none',
  allergies: [],
  maxPrepMinutes: 60,
  maxDifficulty: 'hard',
};

describe('fitsDiet', () => {
  it('lets anything through when there is no restriction', () => {
    expect(fitsDiet('none', 'none')).toBe(true);
    expect(fitsDiet('vegan', 'none')).toBe(true);
  });

  it('treats diets as a hierarchy', () => {
    // Vegan suits everyone with a restriction.
    expect(fitsDiet('vegan', 'vegetarian')).toBe(true);
    expect(fitsDiet('vegan', 'pescatarian')).toBe(true);
    expect(fitsDiet('vegan', 'vegan')).toBe(true);

    // Vegetarian suits a vegetarian and a pescatarian, but not a vegan.
    expect(fitsDiet('vegetarian', 'vegetarian')).toBe(true);
    expect(fitsDiet('vegetarian', 'pescatarian')).toBe(true);
    expect(fitsDiet('vegetarian', 'vegan')).toBe(false);

    // Fish suits a pescatarian only.
    expect(fitsDiet('pescatarian', 'pescatarian')).toBe(true);
    expect(fitsDiet('pescatarian', 'vegetarian')).toBe(false);

    // A recipe with meat suits nobody with a restriction.
    expect(fitsDiet('none', 'vegetarian')).toBe(false);
    expect(fitsDiet('none', 'pescatarian')).toBe(false);
  });
});

describe('isAllergySafe', () => {
  it('is safe when there are no allergies', () => {
    expect(isAllergySafe(recipe({ allergens: ['noten'] }), [])).toBe(true);
  });

  it('rejects a recipe listing something you react to', () => {
    expect(isAllergySafe(recipe({ allergens: ['Noten', 'Gluten'] }), ['noten'])).toBe(false);
  });

  it('ignores case and matches partial words in both directions', () => {
    expect(isAllergySafe(recipe({ allergens: ['Pinda'] }), ['PINDAKAAS'])).toBe(false);
    expect(isAllergySafe(recipe({ allergens: ['Pindakaas'] }), ['pinda'])).toBe(false);
  });

  it('lets an unrelated allergy through', () => {
    expect(isAllergySafe(recipe({ allergens: ['gluten'] }), ['schaaldieren'])).toBe(true);
  });

  it('ignores an empty entry in the allergy list', () => {
    expect(isAllergySafe(recipe({ allergens: ['gluten'] }), ['  '])).toBe(true);
  });
});

describe('matchesFilters', () => {
  it('rejects a recipe that takes too long', () => {
    expect(matchesFilters(recipe({ prep_minutes: 90 }), { ...FILTERS, maxPrepMinutes: 30 })).toBe(
      false,
    );
  });

  it('rejects a recipe above your difficulty', () => {
    expect(matchesFilters(recipe({ difficulty: 'hard' }), { ...FILTERS, maxDifficulty: 'easy' })).toBe(
      false,
    );
    expect(matchesFilters(recipe({ difficulty: 'easy' }), { ...FILTERS, maxDifficulty: 'hard' })).toBe(
      true,
    );
  });
});

describe('distanceFromTarget and isCloseEnough', () => {
  const target = { kcal: 600, proteinG: 50 };

  it('is zero for an exact match', () => {
    expect(distanceFromTarget(recipe(), target)).toBe(0);
  });

  it('weighs protein more heavily than calories', () => {
    const offByProtein = distanceFromTarget(recipe({ protein_per_serving: 40 }), target);
    const offByKcal = distanceFromTarget(recipe({ kcal_per_serving: 610 }), target);

    expect(offByProtein).toBeGreaterThan(offByKcal);
  });

  it('accepts a recipe inside the tolerance', () => {
    expect(
      isCloseEnough(recipe({ kcal_per_serving: 600 + MATCH_TOLERANCE.kcal }), target),
    ).toBe(true);
    expect(
      isCloseEnough(recipe({ kcal_per_serving: 600 + MATCH_TOLERANCE.kcal + 1 }), target),
    ).toBe(false);
    expect(
      isCloseEnough(recipe({ protein_per_serving: 50 - MATCH_TOLERANCE.proteinG - 1 }), target),
    ).toBe(false);
  });
});

describe('findMatches', () => {
  const target = { kcal: 600, proteinG: 50 };

  it('returns the closest recipe first', () => {
    const matches = findMatches(
      [
        recipe({ id: 'far', kcal_per_serving: 700, protein_per_serving: 45 }),
        recipe({ id: 'near', kcal_per_serving: 610, protein_per_serving: 50 }),
      ],
      target,
      FILTERS,
    );

    expect(matches[0].id).toBe('near');
  });

  it('leaves out anything outside the tolerance', () => {
    const matches = findMatches([recipe({ kcal_per_serving: 1200 })], target, FILTERS);
    expect(matches).toEqual([]);
  });

  it('respects the diet and the allergies', () => {
    const matches = findMatches(
      [
        recipe({ id: 'meat', diet: 'none' }),
        recipe({ id: 'veg', diet: 'vegetarian' }),
        recipe({ id: 'nuts', diet: 'vegan', allergens: ['noten'] }),
      ],
      target,
      { ...FILTERS, diet: 'vegetarian', allergies: ['noten'] },
    );

    expect(matches.map((match) => match.id)).toEqual(['veg']);
  });

  it('honours the limit', () => {
    const recipes = Array.from({ length: 10 }, (_unused, index) =>
      recipe({ id: `r${index}`, kcal_per_serving: 600 + index }),
    );

    expect(findMatches(recipes, target, FILTERS, 3)).toHaveLength(3);
  });

  it('copes with an empty cache', () => {
    expect(findMatches([], target, FILTERS)).toEqual([]);
  });
});

describe('describeRecipe and describeGap', () => {
  it('summarises a recipe in one line', () => {
    expect(describeRecipe(recipe())).toBe('600 kcal · 50 g eiwit · 25 min');
  });

  it('says when a recipe fits almost exactly', () => {
    expect(describeGap(recipe({ kcal_per_serving: 610 }), { kcal: 600, proteinG: 50 })).toBe(
      'Past vrijwel precies.',
    );
  });

  it('is honest about the gap', () => {
    expect(
      describeGap(recipe({ kcal_per_serving: 700, protein_per_serving: 40 }), {
        kcal: 600,
        proteinG: 50,
      }),
    ).toBe('100 kcal meer en 10 g eiwit minder dan je doel.');
  });
});

describe('readIngredients', () => {
  it('reads a well-formed list', () => {
    const ingredients = readIngredients(
      recipe({
        ingredients: [
          { name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' },
          { name: 'Rijst', quantity: '75 g', aisle: 'droogwaren' },
        ],
      }),
    );

    expect(ingredients).toHaveLength(2);
    expect(ingredients[0]).toEqual({ name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' });
  });

  it('drops entries that are not usable instead of crashing', () => {
    const ingredients = readIngredients(
      recipe({
        ingredients: [
          { name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' },
          { quantity: '1 stuk' },
          'gewoon tekst',
          null,
          42,
        ] as never,
      }),
    );

    expect(ingredients).toHaveLength(1);
  });

  it('copes with a column that is not a list at all', () => {
    expect(readIngredients({ ingredients: null as never })).toEqual([]);
    expect(readIngredients({ ingredients: 'kip' as never })).toEqual([]);
  });

  it('falls back to overig for an unknown aisle', () => {
    const [ingredient] = readIngredients(
      recipe({ ingredients: [{ name: 'Iets', quantity: '1', aisle: 'verzonnen' }] as never }),
    );

    expect(ingredient.aisle).toBe('verzonnen');
  });
});

describe('labels', () => {
  it('has Dutch copy for every diet and difficulty', () => {
    expect(Object.values(DIET_LABELS).every(Boolean)).toBe(true);
    expect(Object.values(DIFFICULTY_LABELS).every(Boolean)).toBe(true);
  });
});
