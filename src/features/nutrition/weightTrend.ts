/**
 * Reading a weight graph without panicking.
 *
 * Your weight moves a kilo or two from day to day and almost none of that is
 * fat: it is water, food still in your stomach, salt, and how long ago you last
 * went to the toilet. A single weigh-in therefore says very little, and a graph
 * of single weigh-ins looks alarming for no reason.
 *
 * The 7-day moving average is the answer. It smooths the noise out and shows
 * the direction, which is the only part you can actually act on. The screen puts
 * that sentence next to the chart, and TREND_EXPLANATION is that sentence.
 */
import { addDays, daysBetween } from '@/lib/date';

export const TREND_EXPLANATION =
  'Schommelingen van dag tot dag zijn vooral vocht, geen vet. De lijn is het gemiddelde ' +
  'over 7 dagen; die laat zien welke kant het op gaat.';

export const TREND_WINDOW_DAYS = 7;

export type WeightPoint = {
  /** YYYY-MM-DD. */
  date: string;
  weightKg: number;
};

export type TrendPoint = WeightPoint & {
  /** The average over this day and the six before it, or null too early on. */
  averageKg: number | null;
};

/**
 * A trailing average over calendar days, not over the last seven measurements.
 *
 * The difference matters: if you skip four days, "the last seven weigh-ins"
 * reaches back two weeks and the line lags behind reality. A window in days
 * keeps the average honest about when you actually stood on the scale.
 *
 * The average only appears once the window is genuinely covered -- that is,
 * once there is a measurement at least six days older. Before that it would be
 * an average of one or two points dressed up as a trend.
 */
export function withMovingAverage(
  points: readonly WeightPoint[],
  windowDays = TREND_WINDOW_DAYS,
): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((point, index) => {
    const windowStart = addDays(point.date, -(windowDays - 1));

    const inWindow = sorted
      .slice(0, index + 1)
      .filter((candidate) => candidate.date >= windowStart);

    const oldest = sorted[0];
    const covered = daysBetween(oldest.date, point.date) >= windowDays - 1;

    if (!covered || inWindow.length === 0) {
      return { ...point, averageKg: null };
    }

    const sum = inWindow.reduce((running, candidate) => running + candidate.weightKg, 0);
    return { ...point, averageKg: Math.round((sum / inWindow.length) * 100) / 100 };
  });
}

export type TrendSummary = {
  /** The newest weigh-in. */
  latestKg: number | null;
  /** The newest 7-day average, which is the number to actually look at. */
  averageKg: number | null;
  /**
   * Change in the average over the period, in kilograms. Negative is down.
   * Null when there is not enough history to say anything.
   */
  changeKg: number | null;
  /** How many days the change covers. */
  overDays: number;
};

/**
 * The change in the trend over a period, for the line under the chart.
 *
 * Compares averages, never single weigh-ins: comparing today's number with the
 * one from four weeks ago is comparing two pieces of noise.
 */
export function summariseTrend(
  points: readonly WeightPoint[],
  overDays = 28,
): TrendSummary {
  const trend = withMovingAverage(points);
  const latest = trend[trend.length - 1] ?? null;

  const summary: TrendSummary = {
    latestKg: latest?.weightKg ?? null,
    averageKg: latest?.averageKg ?? null,
    changeKg: null,
    overDays,
  };

  if (!latest || latest.averageKg === null) return summary;

  const targetDate = addDays(latest.date, -overDays);
  // The newest point that is at or before the start of the window.
  const earlier = [...trend]
    .reverse()
    .find((point) => point.date <= targetDate && point.averageKg !== null);

  if (!earlier || earlier.averageKg === null) return summary;

  summary.changeKg = Math.round((latest.averageKg - earlier.averageKg) * 100) / 100;
  summary.overDays = daysBetween(earlier.date, latest.date);
  return summary;
}

/**
 * "0,8 kg omlaag in 28 dagen", or a neutral sentence when it barely moved.
 *
 * Never phrased as good or bad. Somebody bulking wants the number to go up and
 * somebody cutting wants it to go down; the app does not get to have an opinion
 * about which of those you are doing today.
 */
export function formatTrendChange(summary: TrendSummary): string {
  if (summary.changeKg === null) {
    return 'Weeg je een week lang regelmatig, dan kan de app een trend laten zien.';
  }

  const size = Math.abs(summary.changeKg);
  if (size < 0.1) {
    return `Je gemiddelde is de afgelopen ${summary.overDays} dagen vrijwel gelijk gebleven.`;
  }

  const direction = summary.changeKg > 0 ? 'omhoog' : 'omlaag';
  return `${formatKg(size)} kg ${direction} in ${summary.overDays} dagen, op basis van het gemiddelde.`;
}

export function formatKg(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
}
