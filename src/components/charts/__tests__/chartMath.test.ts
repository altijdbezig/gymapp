import {
  arcPath,
  axisTicks,
  buildScale,
  linePath,
  pointOnCircle,
  type Series,
} from '../chartMath';

function series(values: (number | null)[], dashed = false): Series {
  return { label: 'test', values, color: '#000', dashed };
}

describe('buildScale', () => {
  it('puts the biggest value near the top and the smallest near the bottom', () => {
    const scale = buildScale([series([10, 20, 30])], 3, 100, 100);

    expect(scale.y(30)).toBeLessThan(scale.y(10));
    expect(scale.y(30)).toBeGreaterThanOrEqual(0);
    expect(scale.y(10)).toBeLessThanOrEqual(100);
  });

  it('spreads the x positions over the full width', () => {
    const scale = buildScale([series([1, 2, 3])], 3, 100, 100);

    expect(scale.x(0)).toBe(0);
    expect(scale.x(2)).toBe(100);
    expect(scale.x(1)).toBe(50);
  });

  it('gives a flat line a band instead of dividing by zero', () => {
    const scale = buildScale([series([80, 80, 80])], 3, 100, 100);

    expect(Number.isFinite(scale.y(80))).toBe(true);
    expect(scale.min).toBeLessThan(80);
    expect(scale.max).toBeGreaterThan(80);
  });

  it('scales two series together so they can be compared', () => {
    const scale = buildScale([series([10, 20]), series([100, 200])], 2, 100, 100);

    expect(scale.max).toBeGreaterThan(200);
    expect(scale.min).toBeLessThan(10);
  });

  it('ignores gaps', () => {
    const scale = buildScale([series([null, 50, null])], 3, 100, 100);
    expect(Number.isFinite(scale.y(50))).toBe(true);
  });

  it('survives a series with nothing in it', () => {
    const scale = buildScale([series([null, null])], 2, 100, 100);
    expect(Number.isFinite(scale.y(0))).toBe(true);
  });

  it('never draws outside the plot area', () => {
    const scale = buildScale([series([10, 20, 30])], 3, 100, 100);

    expect(scale.y(1000)).toBeGreaterThanOrEqual(0);
    expect(scale.y(-1000)).toBeLessThanOrEqual(100);
  });
});

describe('linePath', () => {
  it('moves to the first point and draws to the rest', () => {
    const scale = buildScale([series([0, 1])], 2, 100, 100);
    const path = linePath([0, 1], scale);

    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('L');
  });

  it('breaks the line at a gap instead of drawing through it', () => {
    const scale = buildScale([series([1, null, 3])], 3, 100, 100);
    const path = linePath([1, null, 3], scale);

    // Two M commands: the line stops and starts again.
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it('is empty when there is nothing to draw', () => {
    const scale = buildScale([series([null])], 1, 100, 100);
    expect(linePath([null], scale)).toBe('');
  });
});

describe('pointOnCircle', () => {
  it('starts at twelve o clock and runs clockwise', () => {
    const top = pointOnCircle(50, 50, 40, 0);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(10);

    const quarter = pointOnCircle(50, 50, 40, 0.25);
    expect(quarter.x).toBeCloseTo(90);
    expect(quarter.y).toBeCloseTo(50);
  });
});

describe('arcPath', () => {
  it('draws an arc between two fractions', () => {
    const path = arcPath(50, 50, 40, 0, 0.25);
    expect(path.startsWith('M')).toBe(true);
    expect(path).toContain('A');
  });

  it('sets the large-arc flag past half a circle', () => {
    expect(arcPath(50, 50, 40, 0, 0.6)).toContain('0 1 1');
    expect(arcPath(50, 50, 40, 0, 0.4)).toContain('0 0 1');
  });

  it('draws a full circle as two arcs, which one arc cannot do', () => {
    const path = arcPath(50, 50, 40, 0, 1);
    expect(path.match(/A/g)).toHaveLength(2);
  });
});

describe('axisTicks', () => {
  it('labels everything when there is little', () => {
    expect(axisTicks(3)).toEqual([0, 1, 2]);
  });

  it('thins a long axis out but keeps the ends', () => {
    const ticks = axisTicks(60, 4);

    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(59);
    expect(ticks.length).toBeLessThanOrEqual(4);
  });

  it('has no duplicates', () => {
    const ticks = axisTicks(5, 4);
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it('copes with nothing to label', () => {
    expect(axisTicks(0)).toEqual([]);
  });
});
