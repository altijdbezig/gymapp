import { calculateDailyTargets, MAX_DEFICIT_KCAL } from '../calculateDailyTargets';
import { applyManualTargets, hasOverride, MANUAL_TARGET_NOTE } from '../manualTargets';

/** A calculated starting point to override: 80 kg, 180 cm, 30, male, cut. */
const calculated = calculateDailyTargets({
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'cut',
});

/**
 * The same person but sedentary. That matters for the BMR floor: with a low
 * activity factor, maintenance minus 500 lands *below* the BMR, so the BMR is
 * the rule that actually binds. With a moderate factor the 500 kcal cap binds
 * first and the BMR floor is never reached.
 */
const sedentary = calculateDailyTargets({
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activityLevel: 'sedentary',
  goal: 'cut',
});

const EMPTY = { kcal: null, proteinG: null, fatG: null, carbsG: null };

describe('hasOverride', () => {
  it('is false when nothing is filled in', () => {
    expect(hasOverride(EMPTY)).toBe(false);
  });

  it('is true as soon as one field is set', () => {
    expect(hasOverride({ ...EMPTY, kcal: 2000 })).toBe(true);
    expect(hasOverride({ ...EMPTY, proteinG: 180 })).toBe(true);
  });
});

describe('applyManualTargets', () => {
  it('changes nothing when there is no override', () => {
    expect(applyManualTargets(calculated, EMPTY)).toEqual(calculated);
  });

  it('uses the number you typed when it is safe', () => {
    const safe = calculated.tdeeKcal - 100;
    const result = applyManualTargets(calculated, { ...EMPTY, kcal: safe });

    expect(result.kcal).toBe(Math.round(safe));
  });

  it('rebuilds the macros when only the calories are overridden', () => {
    const result = applyManualTargets(calculated, { ...EMPTY, kcal: calculated.tdeeKcal });

    // The numbers still add up to the new calorie figure.
    const fromMacros = result.proteinG * 4 + result.fatG * 9 + result.carbsG * 4;
    expect(Math.abs(fromMacros - result.kcal)).toBeLessThanOrEqual(4);
  });

  it('keeps a macro you typed yourself', () => {
    const result = applyManualTargets(calculated, { ...EMPTY, proteinG: 200 });
    expect(result.proteinG).toBe(200);
  });

  // --- The hard safety rules ----------------------------------------------

  it('never lets the deficit exceed 500 kcal, however low you type', () => {
    const result = applyManualTargets(calculated, { ...EMPTY, kcal: 800 });

    expect(result.kcal).toBeGreaterThanOrEqual(calculated.tdeeKcal - MAX_DEFICIT_KCAL);
    expect(result.warnings).toContain('deficit_capped');
  });

  it('never goes below the BMR, however low you type', () => {
    expect(sedentary.tdeeKcal - MAX_DEFICIT_KCAL).toBeLessThan(sedentary.bmrKcal);

    const result = applyManualTargets(sedentary, { ...EMPTY, kcal: 500 });

    expect(result.kcal).toBe(result.bmrKcal);
    expect(result.warnings).toContain('clamped_to_bmr');
    expect(result.clampedToBmr).toBe(true);
  });

  it('holds both floors at every low value, whichever one binds', () => {
    for (const base of [calculated, sedentary]) {
      for (const kcal of [0, 100, 500, 1000, 1500]) {
        const result = applyManualTargets(base, { ...EMPTY, kcal });

        expect(result.kcal).toBeGreaterThanOrEqual(result.bmrKcal);
        expect(result.kcal).toBeGreaterThanOrEqual(result.tdeeKcal - MAX_DEFICIT_KCAL);
      }
    }
  });

  it('never lets carbohydrates go negative', () => {
    // Protein and fat alone already exceed the calorie target, even after the
    // floor has raised it: 250 g protein plus 100 g fat is 1900 kcal.
    const result = applyManualTargets(sedentary, {
      kcal: 1000,
      proteinG: 250,
      fatG: 100,
      carbsG: null,
    });

    expect(result.carbsG).toBe(0);
    expect(result.warnings).toContain('carbs_clamped_to_zero');
  });

  it('never produces a negative macro at all', () => {
    const result = applyManualTargets(sedentary, {
      kcal: 1500,
      proteinG: -50 as number,
      fatG: -20 as number,
      carbsG: null,
    });

    expect(result.proteinG).toBeGreaterThanOrEqual(0);
    expect(result.fatG).toBeGreaterThanOrEqual(0);
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('lets you go above maintenance without complaint', () => {
    const result = applyManualTargets(calculated, {
      ...EMPTY,
      kcal: calculated.tdeeKcal + 800,
    });

    expect(result.kcal).toBe(calculated.tdeeKcal + 800);
    expect(result.warnings).not.toContain('deficit_capped');
  });
});

describe('MANUAL_TARGET_NOTE', () => {
  it('explains both floors and why they are there', () => {
    expect(MANUAL_TARGET_NOTE).toContain('BMR');
    expect(MANUAL_TARGET_NOTE).toContain('500 kcal');
    expect(MANUAL_TARGET_NOTE).toContain('tegenwerkt');
  });
});
