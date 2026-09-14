import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  formatLength,
  formatVolume,
  formatWeight,
  kgToDisplay,
  CM_PER_IN,
  KG_PER_LB,
  LENGTH_UNIT_LABELS,
  WEIGHT_UNIT_LABELS,
} from '../units';

describe('weight conversion', () => {
  it('leaves kilograms alone', () => {
    expect(kgToDisplay(82.5, 'kg')).toBe(82.5);
    expect(displayToKg(82.5, 'kg')).toBe(82.5);
  });

  it('uses the exact international pound', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(kgToDisplay(1, 'lb')).toBeCloseTo(2.2046, 4);
    expect(displayToKg(220.46, 'lb')).toBeCloseTo(100, 2);
  });

  it('round-trips without drifting', () => {
    for (const kg of [50, 82.5, 120.75]) {
      expect(displayToKg(kgToDisplay(kg, 'lb'), 'lb')).toBeCloseTo(kg, 8);
    }
  });
});

describe('length conversion', () => {
  it('uses the exact inch', () => {
    expect(CM_PER_IN).toBe(2.54);
    expect(cmToDisplay(2.54, 'in')).toBeCloseTo(1, 8);
    expect(displayToCm(12, 'in')).toBeCloseTo(30.48, 8);
  });

  it('round-trips', () => {
    expect(displayToCm(cmToDisplay(180, 'in'), 'in')).toBeCloseTo(180, 8);
  });
});

describe('formatWeight', () => {
  it('uses a Dutch decimal comma and the unit', () => {
    expect(formatWeight(82.5, 'kg')).toBe('82,5 kg');
    expect(formatWeight(100, 'lb')).toBe('220,5 lb');
  });

  it('honours the decimals argument', () => {
    expect(formatWeight(82.54, 'kg', 0)).toBe('83 kg');
  });
});

describe('formatLength', () => {
  it('shows centimetres as a whole number', () => {
    expect(formatLength(180, 'cm')).toBe('180 cm');
    expect(formatLength(180.4, 'cm')).toBe('180 cm');
  });

  it('shows inches as feet and inches', () => {
    expect(formatLength(182.88, 'in')).toBe(`6'0"`);
    expect(formatLength(180, 'in')).toBe(`5'11"`);
  });

  it('carries over when the inches round to twelve', () => {
    // 182.5 cm is 71.85 inches: 5 feet and 11.85, which rounds to 12.
    expect(formatLength(182.5, 'in')).toBe(`6'0"`);
  });
});

describe('formatVolume', () => {
  it('rounds to whole units and groups the thousands', () => {
    expect(formatVolume(12400, 'kg')).toBe('12.400 kg');
  });

  it('converts before rounding', () => {
    expect(formatVolume(1000, 'lb')).toBe('2.205 lb');
  });
});

describe('labels', () => {
  it('has Dutch copy for every unit', () => {
    expect(Object.values(WEIGHT_UNIT_LABELS).every(Boolean)).toBe(true);
    expect(Object.values(LENGTH_UNIT_LABELS).every(Boolean)).toBe(true);
  });
});
