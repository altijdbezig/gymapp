/**
 * The six hard rules, checked automatically.
 *
 * These are the promises the app makes about safety and tone. They are easy to
 * break by accident months from now -- one well-meaning "je zit te ver boven je
 * doel" in a notification and rule 6 is gone -- so they are a test rather than
 * a note in a README.
 *
 * Two of the checks read the source files themselves. That is unusual, and it
 * is deliberate: rules 4 and 6 are about what the app *says*, and the only way
 * to check every sentence is to look at every sentence.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  calculateDailyTargets,
  MAX_DEFICIT_KCAL,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@/features/nutrition/calculateDailyTargets';
import { applyManualTargets } from '@/features/nutrition/manualTargets';
import {
  COMEBACK_EXPLANATION,
  COMEBACK_STREAK_NOTE,
  describeBreak,
} from '@/features/training/comeback';
import { describeLogStreak, describeTrainingStreak } from '@/features/training/streak';
import {
  comebackReminder,
  eveningReminder,
  logReminder,
  trainingDayReminder,
} from '@/features/notifications/reminders';
import { MEDICAL_DISCLAIMER } from '@/features/medication/medicationSchedule';

const ROOT = path.resolve(__dirname, '..', '..');

/** Every combination worth checking, rather than a handful of examples. */
const SEXES: Sex[] = ['male', 'female'];
const GOALS: Goal[] = ['cut', 'maintenance', 'bulk'];
const ACTIVITY: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function everyProfile(): { weightKg: number; heightCm: number; age: number; sex: Sex; activityLevel: ActivityLevel; goal: Goal }[] {
  const profiles = [];
  for (const weightKg of [45, 60, 80, 110, 160]) {
    for (const heightCm of [150, 170, 190]) {
      for (const age of [16, 30, 55, 80]) {
        for (const sex of SEXES) {
          for (const activityLevel of ACTIVITY) {
            for (const goal of GOALS) {
              profiles.push({ weightKg, heightCm, age, sex, activityLevel, goal });
            }
          }
        }
      }
    }
  }
  return profiles;
}

describe('rule 1: the deficit is never more than 500 kcal', () => {
  it('holds for every profile the app accepts', () => {
    for (const profile of everyProfile()) {
      const targets = calculateDailyTargets(profile);
      expect(targets.kcal).toBeGreaterThanOrEqual(targets.tdeeKcal - MAX_DEFICIT_KCAL);
    }
  });

  it('holds after a manual override, however low it is', () => {
    for (const profile of everyProfile().slice(0, 60)) {
      const calculated = calculateDailyTargets(profile);

      for (const kcal of [0, 500, 1200]) {
        const result = applyManualTargets(calculated, {
          kcal,
          proteinG: null,
          fatG: null,
          carbsG: null,
        });
        expect(result.kcal).toBeGreaterThanOrEqual(result.tdeeKcal - MAX_DEFICIT_KCAL);
      }
    }
  });
});

describe('rule 2: the target is never below the BMR', () => {
  it('holds for every profile the app accepts', () => {
    for (const profile of everyProfile()) {
      const targets = calculateDailyTargets(profile);
      expect(targets.kcal).toBeGreaterThanOrEqual(targets.bmrKcal);
    }
  });

  it('holds after a manual override', () => {
    for (const profile of everyProfile().slice(0, 60)) {
      const calculated = calculateDailyTargets(profile);
      const result = applyManualTargets(calculated, {
        kcal: 200,
        proteinG: null,
        fatG: null,
        carbsG: null,
      });

      expect(result.kcal).toBeGreaterThanOrEqual(result.bmrKcal);
    }
  });
});

describe('rule 3: carbohydrates are never negative', () => {
  it('holds for every profile', () => {
    for (const profile of everyProfile()) {
      const targets = calculateDailyTargets(profile);
      expect(targets.carbsG).toBeGreaterThanOrEqual(0);
      expect(targets.proteinG).toBeGreaterThanOrEqual(0);
      expect(targets.fatG).toBeGreaterThanOrEqual(0);
    }
  });

  it('holds when the manual macros do not fit in the calories', () => {
    const calculated = calculateDailyTargets({
      weightKg: 80,
      heightCm: 180,
      age: 30,
      sex: 'male',
      activityLevel: 'sedentary',
      goal: 'cut',
    });

    const result = applyManualTargets(calculated, {
      kcal: 1000,
      proteinG: 300,
      fatG: 150,
      carbsG: null,
    });

    expect(result.carbsG).toBe(0);
  });
});

describe('rule 4: eating is never a punishment for missed training', () => {
  const foodWords =
    /kcal|calorie|caloriee|eten|eet\b|voeding|dieet|macro|eiwit|koolhydra|vet\b/i;

  it('keeps food out of every training reminder', () => {
    const trainingCopy = [
      trainingDayReminder('Push A'),
      comebackReminder(9),
      { title: COMEBACK_EXPLANATION, body: COMEBACK_STREAK_NOTE },
      { title: describeBreak(14), body: describeTrainingStreak(0) },
    ];

    for (const entry of trainingCopy) {
      expect(`${entry.title} ${entry.body}`).not.toMatch(foodWords);
    }
  });

  it('never lets a training signal reach the calorie calculation', () => {
    // The calculation takes six inputs and none of them is about training.
    // If somebody ever adds one, this list stops matching and the test fails.
    const inputKeys = ['weightKg', 'heightCm', 'age', 'sex', 'activityLevel', 'goal'];
    const source = fs.readFileSync(
      path.join(ROOT, 'src/features/nutrition/calculateDailyTargets.ts'),
      'utf8',
    );

    const typeBlock = source.slice(
      source.indexOf('export type TargetInput'),
      source.indexOf('export type TargetWarning'),
    );

    for (const forbidden of ['session', 'workout', 'training', 'streak', 'missed']) {
      expect(typeBlock.toLowerCase()).not.toContain(forbidden);
    }
    for (const key of inputKeys) {
      expect(typeBlock).toContain(key);
    }
  });
});

describe('rule 5: no medical advice', () => {
  it('states it plainly, including the lack of interaction checking', () => {
    expect(MEDICAL_DISCLAIMER).toContain('geen medisch advies');
    expect(MEDICAL_DISCLAIMER).toContain('wisselwerkingen');
    expect(MEDICAL_DISCLAIMER).toMatch(/arts|apotheker/);
  });

  it('has no interaction checking anywhere in the codebase', () => {
    // There is no such feature, and there should not be one: getting it subtly
    // wrong is worse than not having it. Comments may of course say so, which
    // is why this looks for code rather than for the word.
    const files = collectSourceFiles(path.join(ROOT, 'src/features/medication')).filter(
      (file) => !file.includes('__tests__'),
    );
    const offenders: string[] = [];

    for (const file of files) {
      const contents = stripComments(fs.readFileSync(file, 'utf8'));
      if (/interaction|contraindication|dosageAdvice|checkInteractions/i.test(contents)) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('rule 6: nothing shames the reader', () => {
  const shamingWords =
    /\bhelaas\b|\bjammer\b|gefaald|\bfout gegaan van jou\b|schaam|te veel gegeten|\bzondig|cheat ?meal|verpest|slecht gedaan|je bent lui/i;

  it('keeps it out of every streak and reminder sentence', () => {
    const sentences = [
      describeLogStreak(0),
      describeLogStreak(5),
      describeTrainingStreak(0),
      describeTrainingStreak(3),
      logReminder().body,
      trainingDayReminder('Push A').body,
      comebackReminder(12).body,
      eveningReminder({ kcal: 3200, proteinG: 200, fatG: 120, carbsG: 300 }, {
        kcal: 2400,
        proteinG: 160,
      }).body,
      COMEBACK_EXPLANATION,
      COMEBACK_STREAK_NOTE,
    ];

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(shamingWords);
    }
  });

  it('keeps it out of the Dutch copy in the source as well', () => {
    // Tests are excluded: they quote the forbidden words on purpose, to assert
    // that the app's own copy does not.
    const files = collectSourceFiles(path.join(ROOT, 'src'))
      .concat(collectSourceFiles(path.join(ROOT, 'app')))
      .filter((file) => !file.includes('__tests__'));

    const offenders: string[] = [];
    for (const file of files) {
      const contents = fs.readFileSync(file, 'utf8');
      if (shamingWords.test(contents)) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});

/** Strips // and block comments, so a comment about a rule is not a breach. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [full];
    return [];
  });
}
