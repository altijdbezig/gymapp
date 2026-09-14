/**
 * Water.
 *
 * The simplest thing in the app: add up the millilitres you logged today and
 * compare them with your goal. Going over the goal is fine and is never
 * flagged -- the bar just stops at full.
 */
import type { Tables } from '@/types/database';

export type WaterEntry = Tables<'water_entries'>;

/** The default when nothing is set; also what the profiles column defaults to. */
export const DEFAULT_WATER_GOAL_ML = 2000;

/** The quick buttons: a glass, a mug, a small bottle, a big bottle. */
export const WATER_PRESETS_ML = [200, 250, 330, 500] as const;

export function waterPresetLabel(ml: number): string {
  if (ml <= 200) return 'Glas';
  if (ml <= 250) return 'Beker';
  if (ml <= 330) return 'Blikje';
  return 'Fles';
}

export function totalMl(entries: readonly WaterEntry[]): number {
  return entries.reduce((running, entry) => running + (entry.ml ?? 0), 0);
}

export type WaterProgress = {
  totalMl: number;
  goalMl: number;
  /** 0 to 1, clamped, so a bar can use it directly. */
  ratio: number;
  remainingMl: number;
  isGoalReached: boolean;
};

export function waterProgress(
  entries: readonly WaterEntry[],
  goalMl: number = DEFAULT_WATER_GOAL_ML,
): WaterProgress {
  const total = totalMl(entries);
  const goal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;

  return {
    totalMl: total,
    goalMl: goal,
    ratio: Math.min(1, Math.max(0, total / goal)),
    remainingMl: Math.max(0, goal - total),
    isGoalReached: total >= goal,
  };
}

/** "1,5 L" above a litre, "750 ml" below it. */
export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const litres = Math.round((ml / 1000) * 10) / 10;
    return `${String(litres).replace('.', ',')} L`;
  }
  return `${Math.round(ml)} ml`;
}
