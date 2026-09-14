import {
  EMPTY_MICRO_TOTALS,
  formatMicro,
  MICRO_LABELS,
  sumMicros,
  type MicroKey,
  type MicroSource,
} from '../micros';

function source(overrides: Partial<MicroSource> = {}): MicroSource {
  return {
    fiber_g: 3,
    sugars_g: 10,
    saturated_fat_g: 2,
    salt_g: 0.5,
    ...overrides,
  };
}

describe('sumMicros', () => {
  it('is empty for an empty day', () => {
    expect(sumMicros([])).toEqual(EMPTY_MICRO_TOTALS);
  });

  it('adds everything up and calls it complete', () => {
    const totals = sumMicros([source(), source()]);

    expect(totals.fiber).toEqual({ grams: 6, isComplete: true });
    expect(totals.sugars).toEqual({ grams: 20, isComplete: true });
    expect(totals.saturatedFat).toEqual({ grams: 4, isComplete: true });
    expect(totals.salt).toEqual({ grams: 1, isComplete: true });
  });

  it('marks a total incomplete when one entry has no value', () => {
    const totals = sumMicros([source(), source({ fiber_g: null })]);

    expect(totals.fiber).toEqual({ grams: 3, isComplete: false });
    // The others were known for both entries, so they stay complete.
    expect(totals.sugars.isComplete).toBe(true);
  });

  it('accepts numerics that arrive as strings', () => {
    const totals = sumMicros([source({ fiber_g: '2.5' })]);
    expect(totals.fiber.grams).toBe(3);
  });

  it('treats an unparseable value as missing rather than as zero', () => {
    const totals = sumMicros([source({ fiber_g: 'onbekend' })]);
    expect(totals.fiber).toEqual({ grams: 0, isComplete: false });
  });

  it('keeps one decimal for salt and none for the rest', () => {
    const totals = sumMicros([source({ fiber_g: 3.44, salt_g: 0.44 })]);
    expect(totals.fiber.grams).toBe(3);
    expect(totals.salt.grams).toBe(0.4);
  });
});

describe('formatMicro', () => {
  it('says "minstens" when something was missing', () => {
    expect(formatMicro('fiber', { grams: 12, isComplete: true })).toBe('12 g');
    expect(formatMicro('fiber', { grams: 12, isComplete: false })).toBe('minstens 12 g');
  });

  it('gives salt a decimal with a Dutch comma', () => {
    expect(formatMicro('salt', { grams: 4.2, isComplete: true })).toBe('4,2 g');
  });
});

describe('labels', () => {
  it('has Dutch copy for every micronutrient', () => {
    for (const key of Object.keys(MICRO_LABELS) as MicroKey[]) {
      expect(MICRO_LABELS[key]).toBeTruthy();
    }
  });
});
