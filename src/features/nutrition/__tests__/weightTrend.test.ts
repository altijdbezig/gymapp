import {
  formatKg,
  formatTrendChange,
  summariseTrend,
  withMovingAverage,
  TREND_EXPLANATION,
  TREND_WINDOW_DAYS,
  type WeightPoint,
} from '../weightTrend';
import { addDays } from '@/lib/date';

/** A run of daily weigh-ins starting on `start`. */
function series(start: string, weights: number[]): WeightPoint[] {
  return weights.map((weightKg, index) => ({ date: addDays(start, index), weightKg }));
}

describe('withMovingAverage', () => {
  it('has no average before the window is covered', () => {
    const trend = withMovingAverage(series('2026-09-01', [80, 81, 80.5]));
    expect(trend.every((point) => point.averageKg === null)).toBe(true);
  });

  it('averages the last seven days once there are seven', () => {
    const trend = withMovingAverage(series('2026-09-01', [80, 80, 80, 80, 80, 80, 80]));

    expect(trend[6].averageKg).toBe(80);
    expect(trend[5].averageKg).toBeNull();
  });

  it('smooths a single odd day out', () => {
    const trend = withMovingAverage(series('2026-09-01', [80, 80, 80, 80, 80, 80, 87]));

    // The raw number jumps 7 kg, the average moves one.
    expect(trend[6].weightKg).toBe(87);
    expect(trend[6].averageKg).toBe(81);
  });

  it('uses a window of days, not of the last seven weigh-ins', () => {
    // Weighed on the 1st, then not again until the 20th.
    const points: WeightPoint[] = [
      { date: '2026-09-01', weightKg: 90 },
      { date: '2026-09-20', weightKg: 80 },
      { date: '2026-09-21', weightKg: 80 },
    ];

    const trend = withMovingAverage(points);
    const last = trend[trend.length - 1];

    // The 1st is nineteen days ago, so it is outside the window and does not
    // drag the average up to 83.
    expect(last.averageKg).toBe(80);
  });

  it('sorts the points before averaging', () => {
    const points = [...series('2026-09-01', [80, 81, 82, 83, 84, 85, 86])].reverse();
    const trend = withMovingAverage(points);

    expect(trend.map((point) => point.date)).toEqual(
      series('2026-09-01', [80, 81, 82, 83, 84, 85, 86]).map((point) => point.date),
    );
  });

  it('copes with no measurements at all', () => {
    expect(withMovingAverage([])).toEqual([]);
  });

  it('uses a seven-day window by default', () => {
    expect(TREND_WINDOW_DAYS).toBe(7);
  });
});

describe('summariseTrend', () => {
  it('has nothing to say without enough history', () => {
    const summary = summariseTrend(series('2026-09-01', [80, 80, 80]));

    expect(summary.latestKg).toBe(80);
    expect(summary.averageKg).toBeNull();
    expect(summary.changeKg).toBeNull();
  });

  it('compares averages, not single weigh-ins', () => {
    // Six weeks of dropping half a kilo a week, with one noisy last day.
    const weights = Array.from({ length: 42 }, (_unused, index) => 90 - index * 0.07);
    weights[41] = 95; // one bad day right at the end

    const summary = summariseTrend(series('2026-08-01', weights), 28);

    expect(summary.changeKg).not.toBeNull();
    // The 5 kg spike must not turn a downward trend into an upward one.
    expect(summary.changeKg!).toBeLessThan(0);
  });

  it('reports the period it actually compared', () => {
    const summary = summariseTrend(
      series('2026-08-01', Array.from({ length: 40 }, () => 80)),
      28,
    );

    expect(summary.overDays).toBeGreaterThan(0);
    expect(summary.changeKg).toBe(0);
  });
});

describe('formatTrendChange', () => {
  it('asks for more data when there is none', () => {
    expect(formatTrendChange({ latestKg: 80, averageKg: null, changeKg: null, overDays: 28 })).toContain(
      'regelmatig',
    );
  });

  it('calls a tiny change unchanged', () => {
    const text = formatTrendChange({ latestKg: 80, averageKg: 80, changeKg: 0.05, overDays: 28 });
    expect(text).toContain('vrijwel gelijk');
  });

  it('says up or down without judging it', () => {
    const down = formatTrendChange({ latestKg: 79, averageKg: 79, changeKg: -0.8, overDays: 28 });
    const up = formatTrendChange({ latestKg: 81, averageKg: 81, changeKg: 0.8, overDays: 28 });

    expect(down).toBe('0,8 kg omlaag in 28 dagen, op basis van het gemiddelde.');
    expect(up).toBe('0,8 kg omhoog in 28 dagen, op basis van het gemiddelde.');
    // Neither direction is described as good or bad.
    for (const text of [down, up]) {
      expect(text).not.toMatch(/goed|slecht|helaas|mooi/i);
    }
  });
});

describe('formatKg', () => {
  it('always shows one decimal with a comma', () => {
    expect(formatKg(80)).toBe('80,0');
    expect(formatKg(80.25)).toBe('80,3');
  });
});

describe('TREND_EXPLANATION', () => {
  it('explains that daily swings are water, not fat', () => {
    expect(TREND_EXPLANATION).toContain('vocht');
    expect(TREND_EXPLANATION).toContain('7 dagen');
  });
});
