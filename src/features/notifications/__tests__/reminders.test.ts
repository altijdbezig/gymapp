import {
  comebackReminder,
  eveningReminder,
  formatTimeOfDay,
  logReminder,
  medicationReminder,
  parseTimeOfDay,
  restReminder,
  trainingDayReminder,
  REMINDER_DESCRIPTIONS,
  REMINDER_LABELS,
  type ReminderKind,
} from '../reminders';

const TARGET = { kcal: 2400, proteinG: 160 };

describe('eveningReminder', () => {
  it('says how much room is left', () => {
    const reminder = eveningReminder(
      { kcal: 1800, proteinG: 120, fatG: 60, carbsG: 180 },
      TARGET,
    );

    expect(reminder.body).toContain('600 kcal');
    expect(reminder.body).toContain('40 g eiwit');
  });

  it('mentions the target when nothing was logged', () => {
    const reminder = eveningReminder({ kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }, TARGET);

    expect(reminder.title).toBe('Nog niets gelogd vandaag');
    expect(reminder.body).toContain('2400 kcal');
  });

  it('states going over the target without making it a problem', () => {
    const reminder = eveningReminder(
      { kcal: 2700, proteinG: 180, fatG: 90, carbsG: 250 },
      TARGET,
    );

    expect(reminder.body).toContain('300 kcal over je doel');
    expect(reminder.body).not.toMatch(/te veel|slecht|helaas|pas op|minder eten/i);
  });

  it('recognises landing exactly on the target', () => {
    const reminder = eveningReminder(
      { kcal: 2400, proteinG: 160, fatG: 70, carbsG: 260 },
      TARGET,
    );

    expect(reminder.body).toContain('precies op je doel');
  });

  it('never scolds, whatever the numbers are', () => {
    const cases = [0, 500, 2400, 4000];
    for (const kcal of cases) {
      const reminder = eveningReminder({ kcal, proteinG: 0, fatG: 0, carbsG: 0 }, TARGET);
      expect(`${reminder.title} ${reminder.body}`).not.toMatch(
        /helaas|jammer|gefaald|te veel gegeten|schaam/i,
      );
    }
  });
});

describe('the other reminders', () => {
  it('states the facts and offers the next step', () => {
    expect(logReminder().title).toBe('Nog niets gelogd vandaag');
    expect(trainingDayReminder('Push A').body).toContain('Push A');
    expect(comebackReminder(12).body).toContain('12 dagen');
    expect(restReminder('Bankdrukken').body).toContain('bankdrukken');
  });

  it('never ties a missed workout to food', () => {
    // Hard rule 2: nothing may connect training to eating as a punishment.
    const foodWords = /kcal|calorie|eten|eet|voeding|dieet/i;
    const training = [
      trainingDayReminder('Push A'),
      comebackReminder(9),
      restReminder('Squat'),
    ];

    for (const reminder of training) {
      expect(`${reminder.title} ${reminder.body}`).not.toMatch(foodWords);
    }
  });

  it('keeps medication to a reminder, with no advice in it', () => {
    const withDose = medicationReminder('Vitamine D', '1 tablet');
    const withoutDose = medicationReminder('Vitamine D', null);

    expect(withDose.title).toBe('Vitamine D');
    expect(withDose.body).toContain('1 tablet');
    expect(withoutDose.body).toBe('Tijd voor je herinnering.');

    for (const reminder of [withDose, withoutDose]) {
      expect(`${reminder.title} ${reminder.body}`).not.toMatch(
        /moet je|neem|dosering verhogen|advies|arts raadt/i,
      );
    }
  });
});

describe('labels', () => {
  it('has Dutch copy for every reminder kind', () => {
    const kinds: ReminderKind[] = [
      'evening',
      'log',
      'trainingDay',
      'comeback',
      'rest',
      'medication',
    ];

    for (const kind of kinds) {
      expect(REMINDER_LABELS[kind]).toBeTruthy();
      expect(REMINDER_DESCRIPTIONS[kind]).toBeTruthy();
    }
  });
});

describe('parseTimeOfDay', () => {
  it('reads both what Postgres and what a picker produce', () => {
    expect(parseTimeOfDay('20:00')).toEqual({ hour: 20, minute: 0 });
    expect(parseTimeOfDay('20:00:00')).toEqual({ hour: 20, minute: 0 });
    expect(parseTimeOfDay('7:30')).toEqual({ hour: 7, minute: 30 });
  });

  it('falls back to eight in the evening rather than throwing', () => {
    expect(parseTimeOfDay('')).toEqual({ hour: 20, minute: 0 });
    expect(parseTimeOfDay('nonsense')).toEqual({ hour: 20, minute: 0 });
    expect(parseTimeOfDay('25:00')).toEqual({ hour: 20, minute: 0 });
    expect(parseTimeOfDay('12:99')).toEqual({ hour: 20, minute: 0 });
  });
});

describe('formatTimeOfDay', () => {
  it('zero-pads both halves', () => {
    expect(formatTimeOfDay(7, 5)).toBe('07:05');
    expect(formatTimeOfDay(20, 0)).toBe('20:00');
  });

  it('clamps nonsense into a real time', () => {
    expect(formatTimeOfDay(30, 90)).toBe('23:59');
    expect(formatTimeOfDay(-1, -1)).toBe('00:00');
  });

  it('round-trips with parseTimeOfDay', () => {
    const { hour, minute } = parseTimeOfDay('19:45');
    expect(formatTimeOfDay(hour, minute)).toBe('19:45');
  });
});
