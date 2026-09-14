import {
  buildDraftItems,
  describeTotals,
  formatEuro,
  groupByAisle,
  listTotals,
  parsePrice,
  toAisle,
  AISLE_LABELS,
  AISLE_ORDER,
  type ShoppingItem,
} from '../shoppingList';
import type { Recipe } from '../recipeMatching';

function item(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: `item-${Math.random()}`,
    list_id: 'list-1',
    recipe_id: null,
    name: 'Kipfilet',
    quantity: '300 g',
    aisle: 'vlees_vis',
    is_checked: false,
    order_index: 0,
    price_cents: null,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: `recipe-${Math.random()}`,
    created_by: 'user-1',
    title: 'Kip met rijst',
    description: null,
    servings: 1,
    kcal_per_serving: 600,
    protein_per_serving: 50,
    fat_per_serving: 15,
    carbs_per_serving: 60,
    prep_minutes: 25,
    difficulty: 'easy',
    cuisine: null,
    diet: 'none',
    allergens: [],
    ingredients: [],
    steps: [],
    model: 'claude-opus-5',
    is_public: true,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

describe('toAisle', () => {
  it('accepts a real aisle and falls back for anything else', () => {
    expect(toAisle('zuivel')).toBe('zuivel');
    expect(toAisle('verzonnen schap')).toBe('overig');
    expect(toAisle('')).toBe('overig');
  });
});

describe('groupByAisle', () => {
  it('returns the aisles in walking order', () => {
    const groups = groupByAisle([
      item({ aisle: 'dranken' }),
      item({ aisle: 'groente_fruit' }),
      item({ aisle: 'zuivel' }),
    ]);

    expect(groups.map((group) => group.aisle)).toEqual(['groente_fruit', 'zuivel', 'dranken']);
  });

  it('leaves out aisles with nothing in them', () => {
    const groups = groupByAisle([item({ aisle: 'zuivel' })]);
    expect(groups).toHaveLength(1);
  });

  it('sorts within an aisle by position, then by name', () => {
    const groups = groupByAisle([
      item({ name: 'Yoghurt', aisle: 'zuivel', order_index: 1 }),
      item({ name: 'Kaas', aisle: 'zuivel', order_index: 0 }),
      item({ name: 'Boter', aisle: 'zuivel', order_index: 1 }),
    ]);

    expect(groups[0].items.map((entry) => entry.name)).toEqual(['Kaas', 'Boter', 'Yoghurt']);
  });

  it('copes with an empty list', () => {
    expect(groupByAisle([])).toEqual([]);
  });

  it('has a Dutch label for every aisle', () => {
    for (const aisle of AISLE_ORDER) {
      expect(AISLE_LABELS[aisle]).toBeTruthy();
    }
  });
});

describe('buildDraftItems', () => {
  it('turns a recipe into a list', () => {
    const drafts = buildDraftItems([
      recipe({
        ingredients: [
          { name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' },
          { name: 'Rijst', quantity: '75 g', aisle: 'droogwaren' },
        ],
      }),
    ]);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ name: 'Kipfilet', quantity: '150 g', aisle: 'vlees_vis' });
  });

  it('merges the same ingredient from two recipes into one line', () => {
    const drafts = buildDraftItems([
      recipe({ ingredients: [{ name: 'Ui', quantity: '1 stuk', aisle: 'groente_fruit' }] }),
      recipe({ ingredients: [{ name: 'ui', quantity: '2 stuks', aisle: 'groente_fruit' }] }),
    ]);

    expect(drafts).toHaveLength(1);
    // Quantities are listed, never added: "1 stuk" and "2 el" cannot be summed.
    expect(drafts[0].quantity).toBe('1 stuk + 2 stuks');
  });

  it('sends an unknown aisle to overig', () => {
    const drafts = buildDraftItems([
      recipe({ ingredients: [{ name: 'Iets', quantity: '1', aisle: 'nergens' }] as never }),
    ]);

    expect(drafts[0].aisle).toBe('overig');
  });

  it('copes with no recipes', () => {
    expect(buildDraftItems([])).toEqual([]);
  });
});

describe('listTotals', () => {
  it('counts items, ticks and prices', () => {
    const totals = listTotals([
      item({ price_cents: 350, is_checked: true }),
      item({ price_cents: 120 }),
      item({ price_cents: null }),
    ]);

    expect(totals).toEqual({ items: 3, checked: 1, knownPriceCents: 470, withoutPrice: 1 });
  });

  it('is empty for an empty list', () => {
    expect(listTotals([])).toEqual({
      items: 0,
      checked: 0,
      knownPriceCents: 0,
      withoutPrice: 0,
    });
  });
});

describe('formatEuro', () => {
  it('writes money the Dutch way', () => {
    expect(formatEuro(0)).toBe('€ 0,00');
    expect(formatEuro(350)).toBe('€ 3,50');
    expect(formatEuro(1240)).toBe('€ 12,40');
  });
});

describe('parsePrice', () => {
  it('accepts the ways people type a price', () => {
    expect(parsePrice('3')).toBe(300);
    expect(parsePrice('3,50')).toBe(350);
    expect(parsePrice('3.50')).toBe(350);
    expect(parsePrice('€ 3,50')).toBe(350);
    expect(parsePrice(' 12,4 ')).toBe(1240);
  });

  it('refuses anything that is not a price', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('gratis')).toBeNull();
    expect(parsePrice('3,555')).toBeNull();
    expect(parsePrice('-3')).toBeNull();
  });
});

describe('describeTotals', () => {
  it('says the list is empty', () => {
    expect(describeTotals(listTotals([]))).toBe('Deze lijst is nog leeg.');
  });

  it('never claims a total when no price is filled in', () => {
    const text = describeTotals(listTotals([item(), item()]));

    expect(text).toContain('0 van de 2 afgevinkt');
    expect(text).toContain('Vul prijzen in');
    expect(text).not.toContain('€');
  });

  it('says how much is still without a price', () => {
    const text = describeTotals(listTotals([item({ price_cents: 350 }), item()]));

    expect(text).toContain('€ 3,50 ingevuld');
    expect(text).toContain('1 product nog zonder prijs');
  });

  it('gives a real total only when every price is known', () => {
    const text = describeTotals(
      listTotals([item({ price_cents: 350 }), item({ price_cents: 150 })]),
    );

    expect(text).toContain('€ 5,00 in totaal');
    expect(text).not.toContain('zonder prijs');
  });
});
