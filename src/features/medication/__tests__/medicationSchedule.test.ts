import {
  countTaken,
  describeDay,
  describeSchedule,
  dosesForDay,
  minutesOfDay,
  nextDose,
  normaliseTime,
  runsOnWeekday,
  stockRemaining,
  MEDICAL_DISCLAIMER,
  MEDICATION_PRIVACY_NOTE,
  type Medication,
  type MedicationIntake,
} from '../medicationSchedule';

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: 'med-1',
    user_id: 'user-1',
    name: 'Vitamine D',
    dose: '1 tablet',
    times: ['08:00:00'],
    weekdays: [],
    stock_count: null,
    stock_unit: null,
    notes: null,
    is_active: true,
    created_at: '2026-09-14T10:00:00Z',
    updated_at: '2026-09-14T10:00:00Z',
    ...overrides,
  };
}

function intake(overrides: Partial<MedicationIntake> = {}): MedicationIntake {
  return {
    id: `intake-${Math.random()}`,
    user_id: 'user-1',
    medication_id: 'med-1',
    taken_on: '2026-09-16',
    scheduled_time: '08:00:00',
    taken_at: '2026-09-16T08:05:00Z',
    created_at: '2026-09-16T08:05:00Z',
    ...overrides,
  };
}

describe('normaliseTime and minutesOfDay', () => {
  it('reads what Postgres returns', () => {
    expect(normaliseTime('08:00:00')).toBe('08:00');
    expect(normaliseTime('8:00')).toBe('08:00');
    expect(minutesOfDay('08:30:00')).toBe(510);
  });
});

describe('runsOnWeekday', () => {
  it('treats an empty weekday list as every day', () => {
    expect(runsOnWeekday(medication({ weekdays: [] }), 3)).toBe(true);
  });

  it('honours a list of days', () => {
    const onlyMonWedFri = medication({ weekdays: [1, 3, 5] });

    expect(runsOnWeekday(onlyMonWedFri, 1)).toBe(true);
    expect(runsOnWeekday(onlyMonWedFri, 2)).toBe(false);
  });
});

describe('dosesForDay', () => {
  it('gives one dose per time, earliest first', () => {
    const doses = dosesForDay(
      [medication({ times: ['20:00:00', '08:00:00'] })],
      [],
      3,
      '2026-09-16',
    );

    expect(doses.map((dose) => dose.time)).toEqual(['08:00', '20:00']);
  });

  it('marks the doses you ticked off', () => {
    const doses = dosesForDay(
      [medication({ times: ['08:00:00', '20:00:00'] })],
      [intake({ scheduled_time: '08:00:00' })],
      3,
      '2026-09-16',
    );

    expect(doses[0].isTaken).toBe(true);
    expect(doses[1].isTaken).toBe(false);
  });

  it('ignores a tick from another day', () => {
    const doses = dosesForDay(
      [medication()],
      [intake({ taken_on: '2026-09-15' })],
      3,
      '2026-09-16',
    );

    expect(doses[0].isTaken).toBe(false);
  });

  it('leaves out a medication that is switched off', () => {
    expect(dosesForDay([medication({ is_active: false })], [], 3, '2026-09-16')).toEqual([]);
  });

  it('leaves out a medication that is not due today', () => {
    expect(dosesForDay([medication({ weekdays: [1] })], [], 3, '2026-09-16')).toEqual([]);
  });

  it('keeps two medications at the same time apart', () => {
    const doses = dosesForDay(
      [
        medication({ id: 'a', name: 'Aspirine' }),
        medication({ id: 'b', name: 'Bisoprolol' }),
      ],
      [intake({ medication_id: 'a' })],
      3,
      '2026-09-16',
    );

    expect(doses).toHaveLength(2);
    expect(doses.find((dose) => dose.medication.id === 'a')?.isTaken).toBe(true);
    expect(doses.find((dose) => dose.medication.id === 'b')?.isTaken).toBe(false);
  });

  it('copes with a medication that has no times set yet', () => {
    expect(dosesForDay([medication({ times: [] })], [], 3, '2026-09-16')).toEqual([]);
  });
});

describe('nextDose', () => {
  const doses = dosesForDay(
    [medication({ times: ['08:00:00', '13:00:00', '20:00:00'] })],
    [intake({ scheduled_time: '08:00:00' })],
    3,
    '2026-09-16',
  );

  it('finds the next one still to come', () => {
    expect(nextDose(doses, 9 * 60)?.time).toBe('13:00');
  });

  it('skips the ones already ticked off', () => {
    expect(nextDose(doses, 0)?.time).toBe('13:00');
  });

  it('is null once the day is done', () => {
    expect(nextDose(doses, 23 * 60)).toBeNull();
  });
});

describe('countTaken and describeDay', () => {
  it('counts without judging', () => {
    const doses = dosesForDay(
      [medication({ times: ['08:00:00', '20:00:00'] })],
      [intake({ scheduled_time: '08:00:00' })],
      3,
      '2026-09-16',
    );

    expect(countTaken(doses)).toEqual({ taken: 1, total: 2 });
    expect(describeDay(doses)).toBe('1 van de 2 afgevinkt vandaag.');
  });

  it('says so plainly when there is nothing planned', () => {
    expect(describeDay([])).toBe('Niets gepland voor vandaag.');
  });

  it('never scolds about a missed dose', () => {
    const doses = dosesForDay([medication({ times: ['08:00:00'] })], [], 3, '2026-09-16');
    expect(describeDay(doses)).not.toMatch(/vergeten|gemist|let op|helaas/i);
  });
});

describe('stockRemaining', () => {
  it('is null when no stock was filled in', () => {
    expect(stockRemaining(medication(), [intake()])).toBeNull();
  });

  it('counts one tick as one unit', () => {
    expect(stockRemaining(medication({ stock_count: 30 }), [intake(), intake()])).toBe(28);
  });

  it('never goes below zero', () => {
    const many = Array.from({ length: 10 }, () => intake());
    expect(stockRemaining(medication({ stock_count: 3 }), many)).toBe(0);
  });

  it('only counts ticks of that medication', () => {
    expect(
      stockRemaining(medication({ stock_count: 10 }), [intake({ medication_id: 'other' })]),
    ).toBe(10);
  });
});

describe('describeSchedule', () => {
  it('reads as times and days', () => {
    expect(describeSchedule(medication({ times: ['08:00:00', '20:00:00'] }))).toBe(
      '08:00, 20:00 · elke dag',
    );
    expect(describeSchedule(medication({ weekdays: [1, 3, 5] }))).toBe('08:00 · ma, wo, vr');
  });

  it('says when no time is set yet', () => {
    expect(describeSchedule(medication({ times: [] }))).toBe(
      'Elke dag, nog geen tijd ingesteld',
    );
  });
});

describe('the disclaimers', () => {
  it('says there is no medical advice and no interaction checking', () => {
    expect(MEDICAL_DISCLAIMER).toContain('geen medisch advies');
    expect(MEDICAL_DISCLAIMER).toContain('wisselwerkingen');
    expect(MEDICAL_DISCLAIMER).toContain('apotheker');
  });

  it('says where this data goes, which is nowhere', () => {
    expect(MEDICATION_PRIVACY_NOTE).toContain('gezondheidsinformatie');
    expect(MEDICATION_PRIVACY_NOTE).toContain('derden');
  });
});
