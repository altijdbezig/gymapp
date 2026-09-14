import {
  groupByWeek,
  relativeWeekLabel,
  startOfWeek,
  weekLabel,
  type DayTotals,
} from '../weekSummary';

function day(date: string, kcal: number, proteinG: number, entries = 3): DayTotals {
  return { date, kcal, proteinG, entries };
}

describe('startOfWeek', () => {
  it('returns the Monday of that week', () => {
    // 2026-09-14 is a Monday, 2026-09-20 the Sunday after it.
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14');
    expect(startOfWeek('2026-09-17')).toBe('2026-09-14');
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
  });

  it('does not jump a week on a Sunday', () => {
    expect(startOfWeek('2026-09-13')).toBe('2026-09-07');
  });
});

describe('groupByWeek', () => {
  it('averages over the days you logged, not over seven', () => {
    const [week] = groupByWeek([
      day('2026-09-14', 2000, 150),
      day('2026-09-15', 2400, 170),
      day('2026-09-16', 2200, 160),
    ]);

    expect(week.daysLogged).toBe(3);
    expect(week.averageKcal).toBe(2200);
    expect(week.averageProteinG).toBe(160);
    expect(week.totalKcal).toBe(6600);
  });

  it('leaves out days with nothing logged', () => {
    const [week] = groupByWeek([
      day('2026-09-14', 2000, 150),
      day('2026-09-15', 0, 0, 0),
    ]);

    expect(week.daysLogged).toBe(1);
    expect(week.averageKcal).toBe(2000);
  });

  it('leaves out a week that was not logged at all', () => {
    expect(groupByWeek([day('2026-09-14', 0, 0, 0)])).toEqual([]);
  });

  it('splits days over their own weeks', () => {
    const weeks = groupByWeek([
      day('2026-09-13', 1800, 120),
      day('2026-09-14', 2200, 160),
    ]);

    expect(weeks).toHaveLength(2);
    expect(weeks.map((week) => week.weekStart)).toEqual(['2026-09-14', '2026-09-07']);
  });

  it('puts the newest week first', () => {
    const weeks = groupByWeek([
      day('2026-08-03', 2000, 150),
      day('2026-09-14', 2000, 150),
      day('2026-08-31', 2000, 150),
    ]);

    expect(weeks.map((week) => week.weekStart)).toEqual([
      '2026-09-14',
      '2026-08-31',
      '2026-08-03',
    ]);
  });

  it('gives every week its end date', () => {
    const [week] = groupByWeek([day('2026-09-14', 2000, 150)]);
    expect(week.weekEnd).toBe('2026-09-20');
  });
});

describe('weekLabel', () => {
  it('reads as a date range', () => {
    expect(weekLabel('2026-09-14')).toBe('14 t/m 20 september');
  });

  it('names both months when the week straddles one', () => {
    expect(weekLabel('2026-08-31')).toBe('31 augustus t/m 6 september');
  });
});

describe('relativeWeekLabel', () => {
  it('says deze week and vorige week', () => {
    expect(relativeWeekLabel('2026-09-14', '2026-09-16')).toBe('Deze week');
    expect(relativeWeekLabel('2026-09-07', '2026-09-16')).toBe('Vorige week');
    expect(relativeWeekLabel('2026-08-31', '2026-09-16')).toBe('31 augustus t/m 6 september');
  });
});
