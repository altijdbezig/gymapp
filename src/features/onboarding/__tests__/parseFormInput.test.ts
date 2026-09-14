import {
  AGE_RANGE_YEARS,
  HEIGHT_RANGE_CM,
  parseBirthDate,
  parseHeight,
  parseWeight,
  toIsoDate,
  WEIGHT_RANGE_KG,
} from '../parseFormInput';

const today = new Date(2026, 8, 14); // 14 September 2026

describe('parseWeight', () => {
  it('reads a whole number', () => {
    expect(parseWeight('82')).toEqual({ value: 82 });
  });

  it('reads a Dutch comma decimal', () => {
    expect(parseWeight('82,5')).toEqual({ value: 82.5 });
  });

  it('reads a dot decimal, which is what the iOS keypad gives', () => {
    expect(parseWeight('82.5')).toEqual({ value: 82.5 });
  });

  it('ignores surrounding spaces', () => {
    expect(parseWeight('  82,5 ')).toEqual({ value: 82.5 });
  });

  it('rounds to the two decimals the database stores', () => {
    expect(parseWeight('82,456')).toEqual({ value: 82.46 });
  });

  it('asks for a value when empty', () => {
    expect(parseWeight('').error).toBe('Vul je gewicht in.');
  });

  it.each(['82kg', 'tachtig', '8,2,5', '-82', ''])('rejects %p', (input) => {
    expect(parseWeight(input).error).toBeDefined();
  });

  it('rejects a weight outside the database range', () => {
    expect(parseWeight(String(WEIGHT_RANGE_KG.min - 1)).error).toBeDefined();
    expect(parseWeight(String(WEIGHT_RANGE_KG.max + 1)).error).toBeDefined();
  });

  it('accepts both ends of the range', () => {
    expect(parseWeight(String(WEIGHT_RANGE_KG.min)).value).toBe(WEIGHT_RANGE_KG.min);
    expect(parseWeight(String(WEIGHT_RANGE_KG.max)).value).toBe(WEIGHT_RANGE_KG.max);
  });
});

describe('parseHeight', () => {
  it('reads a normal height', () => {
    expect(parseHeight('180')).toEqual({ value: 180 });
  });

  it('rejects a height outside the database range', () => {
    expect(parseHeight(String(HEIGHT_RANGE_CM.min - 1)).error).toBeDefined();
    expect(parseHeight(String(HEIGHT_RANGE_CM.max + 1)).error).toBeDefined();
  });

  it('accepts both ends of the range', () => {
    expect(parseHeight(String(HEIGHT_RANGE_CM.min)).value).toBe(HEIGHT_RANGE_CM.min);
    expect(parseHeight(String(HEIGHT_RANGE_CM.max)).value).toBe(HEIGHT_RANGE_CM.max);
  });

  it('mentions centimetres in the error, so the unit is never a guess', () => {
    expect(parseHeight('1,80').error).toContain('cm');
  });
});

describe('toIsoDate', () => {
  it('zero-pads the month and the day', () => {
    expect(toIsoDate(new Date(1998, 0, 5))).toBe('1998-01-05');
  });

  it('uses the local date, not UTC', () => {
    // A late-evening local date must not slide into the next day.
    expect(toIsoDate(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14');
  });
});

describe('parseBirthDate', () => {
  it('reads dd-mm-jjjj', () => {
    expect(parseBirthDate('14-09-1998', today)).toEqual({ value: '1998-09-14' });
  });

  it('reads a single-digit day and month', () => {
    expect(parseBirthDate('5-1-1998', today)).toEqual({ value: '1998-01-05' });
  });

  it('also accepts slashes', () => {
    expect(parseBirthDate('14/09/1998', today)).toEqual({ value: '1998-09-14' });
  });

  it('asks for a date when empty', () => {
    expect(parseBirthDate('   ', today).error).toBe('Vul je geboortedatum in.');
  });

  it.each(['1998-09-14', '14 september 1998', '14-09-98', 'vandaag'])(
    'explains the format for %p',
    (input) => {
      expect(parseBirthDate(input, today).error).toContain('dd-mm-jjjj');
    },
  );

  it('rejects a day that does not exist', () => {
    // Without the round-trip check, JavaScript would silently make this 3 March.
    expect(parseBirthDate('31-02-1998', today).error).toBe('Deze datum bestaat niet.');
  });

  it('accepts 29 February in a leap year', () => {
    expect(parseBirthDate('29-02-1996', today)).toEqual({ value: '1996-02-29' });
  });

  it('rejects 29 February in a normal year', () => {
    expect(parseBirthDate('29-02-1997', today).error).toBe('Deze datum bestaat niet.');
  });

  it('rejects a date in the future', () => {
    expect(parseBirthDate('15-09-2026', today).error).toContain('toekomst');
  });

  it(`rejects someone under ${AGE_RANGE_YEARS.min}`, () => {
    const tooYoung = new Date(today.getFullYear() - AGE_RANGE_YEARS.min + 1, 0, 1);
    expect(parseBirthDate(`1-1-${tooYoung.getFullYear()}`, today).error).toContain(
      String(AGE_RANGE_YEARS.min),
    );
  });

  it(`accepts someone who turns ${AGE_RANGE_YEARS.min} today`, () => {
    expect(parseBirthDate(`14-09-${today.getFullYear() - AGE_RANGE_YEARS.min}`, today).value).toBe(
      `${today.getFullYear() - AGE_RANGE_YEARS.min}-09-14`,
    );
  });

  it('rejects an implausible birth year', () => {
    expect(parseBirthDate('1-1-1850', today).error).toBeDefined();
  });

  it('only ever returns a value the database will accept', () => {
    const result = parseBirthDate('14-09-1998', today);
    expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
