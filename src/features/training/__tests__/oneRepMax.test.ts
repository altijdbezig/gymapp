import {
  estimateOneRepMax,
  isRoughEstimate,
  weightForReps,
  HIGH_REP_ESTIMATE_LIMIT,
} from '../oneRepMax';

describe('estimateOneRepMax (Epley)', () => {
  it('returns the weight itself for a single rep', () => {
    // 1 x (1 + 1/30) would claim 3% more than what was actually lifted.
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(62.5, 1)).toBe(62.5);
  });

  it('follows weight x (1 + reps / 30)', () => {
    // 100 x (1 + 5/30) = 116.666..., rounded to one decimal.
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    // 60 x (1 + 8/30) = 76
    expect(estimateOneRepMax(60, 8)).toBe(76);
    // 80 x (1 + 10/30) = 106.666...
    expect(estimateOneRepMax(80, 10)).toBe(106.7);
  });

  it('lets a heavy triple beat a lighter set of ten', () => {
    const heavyTriple = estimateOneRepMax(120, 3);
    const lightTen = estimateOneRepMax(90, 10);
    expect(heavyTriple).toBeGreaterThan(lightTen);
  });

  it('is zero when there is nothing to estimate from', () => {
    expect(estimateOneRepMax(0, 10)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-50, 5)).toBe(0);
    expect(estimateOneRepMax(100, -3)).toBe(0);
    expect(estimateOneRepMax(Number.NaN, 5)).toBe(0);
    expect(estimateOneRepMax(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('rises with reps at the same weight', () => {
    const values = [1, 3, 5, 8, 12].map((reps) => estimateOneRepMax(100, reps));
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });
});

describe('isRoughEstimate', () => {
  it('flags anything past the high rep limit', () => {
    expect(isRoughEstimate(HIGH_REP_ESTIMATE_LIMIT)).toBe(false);
    expect(isRoughEstimate(HIGH_REP_ESTIMATE_LIMIT + 1)).toBe(true);
    expect(isRoughEstimate(30)).toBe(true);
  });
});

describe('weightForReps', () => {
  it('is the inverse of the estimate', () => {
    const oneRm = estimateOneRepMax(100, 5);
    expect(weightForReps(oneRm, 5)).toBeCloseTo(100, 1);
  });

  it('returns zero for nonsense input', () => {
    expect(weightForReps(0, 5)).toBe(0);
    expect(weightForReps(100, 0)).toBe(0);
    expect(weightForReps(Number.NaN, 5)).toBe(0);
  });

  it('suggests less weight for more reps', () => {
    expect(weightForReps(100, 10)).toBeLessThan(weightForReps(100, 5));
  });
});
