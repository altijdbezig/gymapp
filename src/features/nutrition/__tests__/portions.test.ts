import {
  countFor,
  defaultPortion,
  formatAmount,
  formatPortion,
  gramsFor,
  pluralise,
  portionsForFood,
  GRAM_PORTION,
  SUGGESTED_PORTION_LABELS,
  type StoredPortion,
} from '../portions';

function stored(overrides: Partial<StoredPortion> = {}): StoredPortion {
  return {
    id: 'portion-1',
    user_id: 'user-1',
    food_id: 'food-1',
    label: 'plakje',
    grams: 35,
    is_default: false,
    created_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

describe('portionsForFood', () => {
  it('always offers grams first', () => {
    expect(portionsForFood(null, [])[0]).toEqual(GRAM_PORTION);
  });

  it('adds the serving size from Open Food Facts', () => {
    const portions = portionsForFood({ serving_size_g: 30 }, []);
    expect(portions).toHaveLength(2);
    expect(portions[1]).toMatchObject({ label: 'portie', grams: 30 });
  });

  it('ignores a serving size of zero or null', () => {
    expect(portionsForFood({ serving_size_g: null }, [])).toHaveLength(1);
    expect(portionsForFood({ serving_size_g: 0 }, [])).toHaveLength(1);
  });

  it('lets your own "portie" win from the Open Food Facts one', () => {
    const portions = portionsForFood({ serving_size_g: 30 }, [stored({ label: 'portie', grams: 45 })]);

    expect(portions.filter((portion) => portion.label === 'portie')).toHaveLength(1);
    expect(portions.find((portion) => portion.label === 'portie')?.grams).toBe(45);
  });

  it('includes your own portions', () => {
    const portions = portionsForFood(null, [stored(), stored({ id: 'p2', label: 'snee', grams: 40 })]);
    expect(portions.map((portion) => portion.label)).toEqual(['gram', 'plakje', 'snee']);
  });
});

describe('defaultPortion', () => {
  it('picks the one marked as default', () => {
    const portions = portionsForFood(null, [stored({ is_default: true })]);
    expect(defaultPortion(portions).label).toBe('plakje');
  });

  it('falls back to grams', () => {
    expect(defaultPortion(portionsForFood(null, [])).id).toBe('grams');
    expect(defaultPortion([]).id).toBe('grams');
  });
});

describe('gramsFor and countFor', () => {
  const slice = { id: 'p', label: 'plakje', grams: 35, isDefault: false };

  it('converts a count into grams', () => {
    expect(gramsFor(slice, 2)).toBe(70);
    expect(gramsFor(GRAM_PORTION, 150)).toBe(150);
  });

  it('converts grams back into a count', () => {
    expect(countFor(slice, 70)).toBe(2);
    expect(countFor(slice, 35)).toBe(1);
  });

  it('round-trips', () => {
    expect(countFor(slice, gramsFor(slice, 3))).toBe(3);
  });

  it('returns zero for nonsense', () => {
    expect(gramsFor(slice, 0)).toBe(0);
    expect(gramsFor(slice, -2)).toBe(0);
    expect(gramsFor(slice, Number.NaN)).toBe(0);
    expect(countFor({ ...slice, grams: 0 }, 70)).toBe(0);
  });
});

describe('formatPortion', () => {
  it('shows plain grams when no portion was used', () => {
    expect(formatPortion(null, null, 150)).toBe('150 g');
    expect(formatPortion(150, 'gram', 150)).toBe('150 g');
  });

  it('shows the portion with the grams behind it', () => {
    expect(formatPortion(2, 'plakje', 70)).toBe('2 plakjes (70 g)');
    expect(formatPortion(1, 'portie', 30)).toBe('1 portie (30 g)');
  });

  it('uses a Dutch decimal comma', () => {
    expect(formatPortion(1.5, 'eetlepel', 22.5)).toBe('1,5 eetlepels (22,5 g)');
  });
});

describe('pluralise', () => {
  it('leaves a count of one alone', () => {
    expect(pluralise('plakje', 1)).toBe('plakje');
  });

  it('knows the suggested labels', () => {
    expect(pluralise('stuk', 2)).toBe('stuks');
    expect(pluralise('glas', 3)).toBe('glazen');
    expect(pluralise('snee', 2)).toBe('sneetjes');
  });

  it('leaves an unknown label alone rather than guessing', () => {
    expect(pluralise('ml', 2)).toBe('ml');
    expect(pluralise('bakje yoghurt', 2)).toBe('bakje yoghurt');
  });
});

describe('formatAmount', () => {
  it('drops trailing zeroes and uses a comma', () => {
    expect(formatAmount(2)).toBe('2');
    expect(formatAmount(2.5)).toBe('2,5');
    expect(formatAmount(2.25)).toBe('2,25');
    expect(formatAmount(2.2549)).toBe('2,25');
  });
});

describe('SUGGESTED_PORTION_LABELS', () => {
  it('has no duplicates', () => {
    expect(new Set(SUGGESTED_PORTION_LABELS).size).toBe(SUGGESTED_PORTION_LABELS.length);
  });
});
