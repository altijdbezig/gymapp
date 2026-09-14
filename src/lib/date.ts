/**
 * Dutch date formatting.
 *
 * Kept in one place so every screen writes a date the same way, and so the
 * ISO-date-to-Date conversion is done once. `new Date('2026-09-14')` parses as
 * UTC midnight, which in the Netherlands is still the 13th in winter -- these
 * helpers build the date from its parts instead, so it stays local.
 */

/** Parses a YYYY-MM-DD string into a local Date. */
export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** "14 september", or "14 september 2025" when it was not this year. */
export function formatDutchDate(isoDate: string): string {
  const date = fromIsoDate(isoDate);

  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/** "ma 14 sep" -- the compact form for a list or a chart axis. */
export function formatDutchDateShort(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Whole days between two YYYY-MM-DD dates, ignoring the time of day. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = fromIsoDate(fromIso).getTime();
  const to = fromIsoDate(toIso).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** `isoDate` shifted by a number of days, back as YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);

  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
