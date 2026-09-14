import {
  calculatePlates,
  formatKg,
  formatPlates,
  DEFAULT_BAR_KG,
  DEFAULT_PLATES_KG,
} from '../plateCalculator';

describe('calculatePlates', () => {
  it('splits the load over both sides of the bar', () => {
    const result = calculatePlates(100);

    // 100 - 20 = 80, so 40 per side: 25 + 15.
    expect(result.perSide).toEqual([
      { plateKg: 25, count: 1 },
      { plateKg: 15, count: 1 },
    ]);
    expect(result.achievedKg).toBe(100);
    expect(result.leftoverKg).toBe(0);
  });

  it('uses the heaviest plates first', () => {
    const result = calculatePlates(160);

    // 70 per side: 25 + 25 + 20.
    expect(result.perSide).toEqual([
      { plateKg: 25, count: 2 },
      { plateKg: 20, count: 1 },
    ]);
  });

  it('handles the small plates without floating point noise', () => {
    const result = calculatePlates(27.5);

    // 3.75 per side: 2.5 + 1.25.
    expect(result.perSide).toEqual([
      { plateKg: 2.5, count: 1 },
      { plateKg: 1.25, count: 1 },
    ]);
    expect(result.achievedKg).toBe(27.5);
    expect(result.leftoverKg).toBe(0);
  });

  it('reports what it cannot make exactly instead of guessing', () => {
    // 21 kg: 0.5 per side, which no plate can do.
    const result = calculatePlates(21);

    expect(result.perSide).toEqual([]);
    expect(result.achievedKg).toBe(20);
    expect(result.leftoverKg).toBe(1);
    expect(result.barOnly).toBe(true);
  });

  it('treats the bare bar as the answer', () => {
    const result = calculatePlates(DEFAULT_BAR_KG);

    expect(result.barOnly).toBe(true);
    expect(result.perSide).toEqual([]);
    expect(result.achievedKg).toBe(DEFAULT_BAR_KG);
  });

  it('does not invent plates for a target below the bar', () => {
    const result = calculatePlates(10);

    expect(result.perSide).toEqual([]);
    expect(result.achievedKg).toBe(20);
    expect(result.leftoverKg).toBe(-10);
  });

  it('accepts another bar weight', () => {
    const result = calculatePlates(55, 15);

    // 40 kg of plates, 20 per side.
    expect(result.perSide).toEqual([{ plateKg: 20, count: 1 }]);
    expect(result.achievedKg).toBe(55);
  });

  it('accepts a shorter plate set', () => {
    const result = calculatePlates(100, 20, [20, 10]);

    // 40 per side with only 20s and 10s.
    expect(result.perSide).toEqual([{ plateKg: 20, count: 2 }]);
    expect(result.achievedKg).toBe(100);
  });

  it('ignores nonsense plates', () => {
    const result = calculatePlates(60, 20, [0, -5, 20]);

    expect(result.perSide).toEqual([{ plateKg: 20, count: 1 }]);
  });

  it('always lands on or below the target', () => {
    for (let target = 20; target <= 300; target += 1.25) {
      const result = calculatePlates(target, DEFAULT_BAR_KG, DEFAULT_PLATES_KG);
      expect(result.achievedKg).toBeLessThanOrEqual(target + 0.001);
      expect(result.leftoverKg).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('formatPlates', () => {
  it('lists every plate with a Dutch decimal comma', () => {
    expect(formatPlates(calculatePlates(27.5))).toBe('2,5 + 1,25');
    expect(formatPlates(calculatePlates(160))).toBe('25 + 25 + 20');
  });

  it('says so when only the bar is needed', () => {
    expect(formatPlates(calculatePlates(20))).toBe('Alleen de stang');
  });
});

describe('formatKg', () => {
  it('drops a trailing zero and uses a comma', () => {
    expect(formatKg(20)).toBe('20');
    expect(formatKg(2.5)).toBe('2,5');
    expect(formatKg(1.25)).toBe('1,25');
  });
});
