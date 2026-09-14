import {
  buildQuickEntry,
  parseQuickKcal,
  parseQuickProtein,
  QUICK_ENTRY_AMOUNT_G,
  QUICK_ENTRY_DEFAULT_NAME,
  QUICK_KCAL_MAX,
} from '../quickEntry';

describe('parseQuickKcal', () => {
  it('accepts a plain number', () => {
    expect(parseQuickKcal('650')).toEqual({ value: 650 });
    expect(parseQuickKcal(' 650 ')).toEqual({ value: 650 });
  });

  it('asks for something when the field is empty', () => {
    expect(parseQuickKcal('').error).toBe('Vul een aantal calorieën in.');
  });

  it('refuses anything that is not a number', () => {
    expect(parseQuickKcal('650 kcal').error).toBeDefined();
    expect(parseQuickKcal('-100').error).toBeDefined();
  });

  it('refuses zero and anything absurd', () => {
    expect(parseQuickKcal('0').error).toBeDefined();
    expect(parseQuickKcal(String(QUICK_KCAL_MAX + 1)).error).toBeDefined();
  });
});

describe('parseQuickProtein', () => {
  it('treats an empty field as zero rather than as an error', () => {
    expect(parseQuickProtein('')).toEqual({ value: 0 });
  });

  it('accepts a comma decimal', () => {
    expect(parseQuickProtein('35,5')).toEqual({ value: 35.5 });
  });

  it('refuses nonsense', () => {
    expect(parseQuickProtein('veel').error).toBeDefined();
  });
});

describe('buildQuickEntry', () => {
  const input = {
    userId: 'user-1',
    name: 'Snackbar',
    kcal: 800,
    proteinG: 30,
    mealType: 'dinner' as const,
    loggedOn: '2026-09-14',
  };

  it('stores the typed numbers as the per-100 g values at 100 g', () => {
    const row = buildQuickEntry(input);

    expect(row.amount_g).toBe(QUICK_ENTRY_AMOUNT_G);
    expect(row.kcal_per_100g).toBe(800);
    expect(row.protein_per_100g).toBe(30);
    // Which means the generated total is exactly what was typed.
    expect((row.kcal_per_100g * row.amount_g) / 100).toBe(800);
  });

  it('has no product behind it', () => {
    expect(buildQuickEntry(input).food_id).toBeNull();
    expect(buildQuickEntry(input).brand).toBeNull();
  });

  it('claims no fat and no carbohydrates', () => {
    const row = buildQuickEntry(input);
    expect(row.fat_per_100g).toBe(0);
    expect(row.carbs_per_100g).toBe(0);
  });

  it('falls back to a name rather than sending an empty one', () => {
    expect(buildQuickEntry({ ...input, name: '   ' }).name).toBe(QUICK_ENTRY_DEFAULT_NAME);
  });
});
