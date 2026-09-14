/**
 * The week planner: which routine belongs to which weekday.
 *
 * Weekdays are ISO 8601 numbers -- 1 is Monday, 7 is Sunday. That is what
 * Postgres's isodow gives and what a Dutch week looks like on paper, and it
 * avoids the usual Sunday-is-zero confusion that JavaScript's getDay() causes.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: 'Maandag',
  2: 'Dinsdag',
  3: 'Woensdag',
  4: 'Donderdag',
  5: 'Vrijdag',
  6: 'Zaterdag',
  7: 'Zondag',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: 'ma',
  2: 'di',
  3: 'wo',
  4: 'do',
  5: 'vr',
  6: 'za',
  7: 'zo',
};

/** JavaScript's Sunday-is-0 turned into ISO's Sunday-is-7. */
export function isoWeekday(date: Date): Weekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** The week starting today, so "vandaag" is always the first row. */
export function weekFrom(startDay: Weekday): Weekday[] {
  return WEEKDAYS.map((_, index) => (((startDay - 1 + index) % 7) + 1) as Weekday);
}

/** "vandaag", "morgen", or the day's name. */
export function relativeWeekdayLabel(weekday: Weekday, today: Weekday): string {
  if (weekday === today) return 'Vandaag';
  if (weekday === ((today % 7) + 1)) return 'Morgen';
  return WEEKDAY_LABELS[weekday];
}
