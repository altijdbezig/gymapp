/**
 * The week overview: how the last few weeks actually went.
 *
 * Averages over the days you logged, not over seven. Dividing by seven would
 * punish you for forgetting to log on Sunday by pretending you ate nothing that
 * day, which is both wrong and unpleasant. The number of days logged is shown
 * next to the average so you can judge it yourself.
 */
import { addDays, fromIsoDate } from '@/lib/date';

export type DayTotals = {
  /** YYYY-MM-DD. */
  date: string;
  kcal: number;
  proteinG: number;
  /** How many things were logged. Zero means the day was not logged at all. */
  entries: number;
};

export type WeekSummary = {
  /** The Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  weekEnd: string;
  label: string;
  /** Average over the days that were logged; 0 when none were. */
  averageKcal: number;
  averageProteinG: number;
  daysLogged: number;
  totalKcal: number;
};

/** The Monday of the week `isoDate` falls in. */
export function startOfWeek(isoDate: string): string {
  const date = fromIsoDate(isoDate);
  // getDay() is Sunday-is-0; ISO weeks start on Monday.
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(isoDate, offset);
}

/**
 * Groups logged days into weeks, newest week first.
 *
 * Weeks with nothing logged at all are left out entirely: an empty row that
 * says "0 kcal" reads like a judgement about a week you were simply not using
 * the app.
 */
export function groupByWeek(days: readonly DayTotals[]): WeekSummary[] {
  const byWeek = new Map<string, DayTotals[]>();

  for (const day of days) {
    if (day.entries === 0) continue;

    const key = startOfWeek(day.date);
    byWeek.set(key, [...(byWeek.get(key) ?? []), day]);
  }

  return [...byWeek.entries()]
    .map(([weekStart, weekDays]) => {
      const daysLogged = weekDays.length;
      const totalKcal = weekDays.reduce((running, day) => running + day.kcal, 0);
      const totalProtein = weekDays.reduce((running, day) => running + day.proteinG, 0);

      return {
        weekStart,
        weekEnd: addDays(weekStart, 6),
        label: weekLabel(weekStart),
        averageKcal: daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0,
        averageProteinG: daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0,
        daysLogged,
        totalKcal: Math.round(totalKcal),
      };
    })
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** "14 t/m 20 september" -- a week reads better as a range than as a number. */
export function weekLabel(weekStart: string): string {
  const start = fromIsoDate(weekStart);
  const end = fromIsoDate(addDays(weekStart, 6));

  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: sameMonth ? undefined : 'long',
  });
  const endText = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });

  return `${startText} t/m ${endText}`;
}

/** "deze week", "vorige week", or the date range. */
export function relativeWeekLabel(weekStart: string, todayIso: string): string {
  const thisWeek = startOfWeek(todayIso);
  if (weekStart === thisWeek) return 'Deze week';
  if (weekStart === addDays(thisWeek, -7)) return 'Vorige week';
  return weekLabel(weekStart);
}
