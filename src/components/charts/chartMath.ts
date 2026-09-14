/**
 * The arithmetic behind the charts, kept away from the drawing.
 *
 * Every chart in the app is drawn with react-native-svg -- one library for
 * native and for web, so a graph looks the same on your phone and in the
 * browser. The maths that turns numbers into coordinates lives here so it can
 * be tested without rendering anything.
 */

/** A point on a line chart, before it is turned into pixels. */
export type Series = {
  label: string;
  values: (number | null)[];
  color: string;
  /** A dashed line reads as "this is a derived value", e.g. an average. */
  dashed?: boolean;
};

export type Scale = {
  min: number;
  max: number;
  /** Turns a value into a y coordinate inside `height`. */
  y: (value: number) => number;
  /** Turns an index into an x coordinate inside `width`. */
  x: (index: number) => number;
};

/**
 * Builds a scale over every series at once, so two lines on the same chart are
 * directly comparable.
 *
 * The range gets a small margin so the highest point does not sit exactly on
 * the top edge, and a completely flat line still gets a sensible band around it
 * instead of dividing by zero.
 */
export function buildScale(
  series: readonly Series[],
  count: number,
  width: number,
  height: number,
  padding = 0.08,
): Scale {
  const values = series.flatMap((entry) =>
    entry.values.filter((value): value is number => value !== null && Number.isFinite(value)),
  );

  let min = values.length > 0 ? Math.min(...values) : 0;
  let max = values.length > 0 ? Math.max(...values) : 1;

  if (min === max) {
    // A flat line: give it a band of one unit either side so it draws in the
    // middle instead of collapsing.
    min -= 1;
    max += 1;
  }

  const margin = (max - min) * padding;
  min -= margin;
  max += margin;

  const span = max - min;
  const steps = Math.max(1, count - 1);

  return {
    min,
    max,
    y: (value) => {
      const clamped = Math.min(max, Math.max(min, value));
      // SVG y grows downwards, so the biggest value sits at y = 0.
      return height - ((clamped - min) / span) * height;
    },
    x: (index) => (index / steps) * width,
  };
}

/**
 * An SVG path through the points, skipping gaps.
 *
 * A null value is a day you did not log, and drawing straight through it would
 * invent data. The line breaks and picks up again instead.
 */
export function linePath(values: readonly (number | null)[], scale: Scale): string {
  let path = '';
  let penDown = false;

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      penDown = false;
      return;
    }

    const x = scale.x(index);
    const y = scale.y(value);
    path += `${penDown ? 'L' : 'M'}${round(x)} ${round(y)} `;
    penDown = true;
  });

  return path.trim();
}

/** One slice of a donut, as an SVG arc. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startFraction: number,
  endFraction: number,
): string {
  // A full circle cannot be drawn as a single arc -- start and end would be the
  // same point -- so it is drawn as two halves.
  if (endFraction - startFraction >= 1) {
    return (
      `M${round(cx)} ${round(cy - radius)} ` +
      `A${radius} ${radius} 0 1 1 ${round(cx)} ${round(cy + radius)} ` +
      `A${radius} ${radius} 0 1 1 ${round(cx)} ${round(cy - radius)}`
    );
  }

  const start = pointOnCircle(cx, cy, radius, startFraction);
  const end = pointOnCircle(cx, cy, radius, endFraction);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;

  return `M${round(start.x)} ${round(start.y)} A${radius} ${radius} 0 ${largeArc} 1 ${round(end.x)} ${round(end.y)}`;
}

/** Fraction 0 is twelve o'clock, and it runs clockwise from there. */
export function pointOnCircle(
  cx: number,
  cy: number,
  radius: number,
  fraction: number,
): { x: number; y: number } {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/**
 * Picks a handful of indices to label, so an axis with sixty days does not turn
 * into a smear. Always includes the first and the last.
 */
export function axisTicks(count: number, maxTicks = 4): number[] {
  if (count <= 0) return [];
  if (count <= maxTicks) return Array.from({ length: count }, (_unused, index) => index);

  const step = (count - 1) / (maxTicks - 1);
  const ticks = Array.from({ length: maxTicks }, (_unused, index) => Math.round(index * step));
  return [...new Set(ticks)];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
