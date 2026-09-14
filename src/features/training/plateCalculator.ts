/**
 * Plate calculator: which discs go on the bar for a given total weight.
 *
 * Standing in front of a rack doing "100 minus 20 is 80, divided by 2 is 40,
 * so 20 and 15 and 5" is exactly the kind of arithmetic a phone should do.
 *
 * The bar is symmetrical, so everything here works on one side and the screen
 * says "per kant". Greedy from heavy to light is optimal for a normal gym set
 * (every plate is a multiple of the next smaller one), and when it is not --
 * an odd collection of plates -- it still lands on a sensible combination and
 * reports what is left over rather than pretending.
 */

/** An Olympic bar. Adjustable, because women's bars are 15 and trap bars vary. */
export const DEFAULT_BAR_KG = 20;

/** What a typical Dutch gym has, heaviest first. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export type PlateCount = { plateKg: number; count: number };

export type PlateResult = {
  /** Plates for one side of the bar, heaviest first. */
  perSide: PlateCount[];
  /** What the bar actually weighs with those plates on both sides. */
  achievedKg: number;
  /** Target minus achieved. Above zero when the plates cannot make it exactly. */
  leftoverKg: number;
  /** True when the target is below the bar, or the bar alone is the answer. */
  barOnly: boolean;
};

/**
 * Works in grams internally. 2.5 + 1.25 in floating point does not land exactly
 * on 3.75, and "0.7500000000000002 kg over" on screen would look broken.
 */
const PER_KG = 1000;

export function calculatePlates(
  targetKg: number,
  barKg: number = DEFAULT_BAR_KG,
  availablePlatesKg: readonly number[] = DEFAULT_PLATES_KG,
): PlateResult {
  const target = toGrams(targetKg);
  const bar = toGrams(barKg);

  if (!Number.isFinite(target) || !Number.isFinite(bar) || target <= bar) {
    return {
      perSide: [],
      achievedKg: barKg,
      leftoverKg: target < bar ? round2((bar - target) / PER_KG) * -1 : 0,
      barOnly: true,
    };
  }

  // Half the load, because whatever we work out goes on both ends.
  let remainingPerSide = Math.floor((target - bar) / 2);

  const plates = [...availablePlatesKg]
    .map(toGrams)
    .filter((plate) => plate > 0)
    .sort((a, b) => b - a);

  const perSide: PlateCount[] = [];

  for (const plate of plates) {
    const count = Math.floor(remainingPerSide / plate);
    if (count === 0) continue;
    perSide.push({ plateKg: plate / PER_KG, count });
    remainingPerSide -= count * plate;
  }

  const loadedPerSide = perSide.reduce(
    (running, entry) => running + toGrams(entry.plateKg) * entry.count,
    0,
  );
  const achieved = bar + loadedPerSide * 2;

  return {
    perSide,
    achievedKg: round2(achieved / PER_KG),
    leftoverKg: round2((target - achieved) / PER_KG),
    barOnly: perSide.length === 0,
  };
}

/**
 * "20 + 15 + 2,5" -- the one-line version for a compact spot in the UI.
 * Dutch decimal comma, because this string is read by a person.
 */
export function formatPlates(result: PlateResult): string {
  if (result.perSide.length === 0) return 'Alleen de stang';

  return result.perSide
    .flatMap((entry) => Array.from({ length: entry.count }, () => formatKg(entry.plateKg)))
    .join(' + ');
}

/** 2.5 -> "2,5" and 20 -> "20". */
export function formatKg(value: number): string {
  const rounded = round2(value);
  return String(rounded).replace('.', ',');
}

function toGrams(kg: number): number {
  return Math.round(kg * PER_KG);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
