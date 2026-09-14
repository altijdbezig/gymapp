import {
  ACTIVITY_FACTORS,
  ageFromBirthDate,
  calculateBmr,
  calculateDailyTargets,
  GOAL_KCAL_ADJUSTMENT,
  MAX_DEFICIT_KCAL,
  PROTEIN_G_PER_KG,
  type TargetInput,
} from '../calculateDailyTargets';

/** A 28-year-old man of 80 kg and 180 cm, training a few times a week. */
const man: TargetInput = {
  weightKg: 80,
  heightCm: 180,
  age: 28,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'maintenance',
};

/** A 30-year-old woman of 65 kg and 168 cm with a desk job. */
const woman: TargetInput = {
  weightKg: 65,
  heightCm: 168,
  age: 30,
  sex: 'female',
  activityLevel: 'sedentary',
  goal: 'maintenance',
};

describe('calculateBmr (Mifflin-St Jeor)', () => {
  it('uses +5 for men', () => {
    // 10*80 + 6.25*180 - 5*28 + 5 = 800 + 1125 - 140 + 5
    expect(calculateBmr(man)).toBe(1790);
  });

  it('uses -161 for women', () => {
    // 10*65 + 6.25*168 - 5*30 - 161 = 650 + 1050 - 150 - 161
    expect(calculateBmr(woman)).toBe(1389);
  });

  it('differs by exactly 166 between the sexes for the same body', () => {
    expect(calculateBmr({ ...man, sex: 'male' }) - calculateBmr({ ...man, sex: 'female' })).toBe(
      166,
    );
  });
});

describe('maintenance (TDEE)', () => {
  it('multiplies the BMR by the activity factor', () => {
    const result = calculateDailyTargets(man);
    expect(result.bmrKcal).toBe(1790);
    expect(result.tdeeKcal).toBe(Math.round(1790 * 1.55));
  });

  it.each(Object.entries(ACTIVITY_FACTORS))(
    'applies factor %s = %s',
    (activityLevel, factor) => {
      const result = calculateDailyTargets({
        ...man,
        activityLevel: activityLevel as TargetInput['activityLevel'],
      });
      expect(result.tdeeKcal).toBe(Math.round(result.bmrKcal * factor));
    },
  );

  it('eats maintenance on the maintenance goal', () => {
    const result = calculateDailyTargets({ ...man, goal: 'maintenance' });
    expect(result.kcal).toBe(result.tdeeKcal);
    expect(result.warnings).toEqual([]);
  });
});

describe('goal adjustments', () => {
  it('adds 400 kcal on a bulk', () => {
    const result = calculateDailyTargets({ ...man, goal: 'bulk' });
    expect(result.kcal).toBe(result.tdeeKcal + 400);
  });

  it('removes 400 kcal on a cut', () => {
    const result = calculateDailyTargets({ ...man, goal: 'cut' });
    expect(result.kcal).toBe(result.tdeeKcal - 400);
  });

  it('keeps every configured adjustment within the 500 kcal deficit limit', () => {
    // Guards the constants themselves: nobody can set cut to -600 unnoticed.
    for (const adjustment of Object.values(GOAL_KCAL_ADJUSTMENT)) {
      expect(adjustment).toBeGreaterThanOrEqual(-MAX_DEFICIT_KCAL);
    }
  });
});

describe('safety rule 1 — the deficit is never larger than 500 kcal', () => {
  const everyone: TargetInput[] = [man, woman];

  it.each(everyone)('never drops more than 500 below maintenance (%#)', (person) => {
    for (const goal of ['cut', 'maintenance', 'bulk'] as const) {
      const result = calculateDailyTargets({ ...person, goal });
      expect(result.tdeeKcal - result.kcal).toBeLessThanOrEqual(MAX_DEFICIT_KCAL);
    }
  });

  it('holds across a wide sweep of bodies', () => {
    for (let weightKg = 40; weightKg <= 200; weightKg += 10) {
      for (let heightCm = 140; heightCm <= 210; heightCm += 10) {
        for (let age = 16; age <= 80; age += 8) {
          for (const sex of ['male', 'female'] as const) {
            for (const activityLevel of Object.keys(ACTIVITY_FACTORS) as Array<
              TargetInput['activityLevel']
            >) {
              const result = calculateDailyTargets({
                weightKg,
                heightCm,
                age,
                sex,
                activityLevel,
                goal: 'cut',
              });
              expect(result.tdeeKcal - result.kcal).toBeLessThanOrEqual(MAX_DEFICIT_KCAL);
            }
          }
        }
      }
    }
  });
});

describe('safety rule 2 — never below the BMR', () => {
  it('clamps to the BMR and warns for a small sedentary person on a cut', () => {
    // A light, sedentary woman: TDEE is only ~1.2x BMR, so -400 lands under it.
    const result = calculateDailyTargets({
      weightKg: 50,
      heightCm: 158,
      age: 45,
      sex: 'female',
      activityLevel: 'sedentary',
      goal: 'cut',
    });

    expect(result.kcal).toBe(result.bmrKcal);
    expect(result.clampedToBmr).toBe(true);
    expect(result.warnings).toContain('clamped_to_bmr');
  });

  it('does not warn when the target sits above the BMR anyway', () => {
    const result = calculateDailyTargets({ ...man, goal: 'cut' });
    expect(result.clampedToBmr).toBe(false);
    expect(result.warnings).not.toContain('clamped_to_bmr');
  });

  it('holds across a wide sweep of bodies and goals', () => {
    for (let weightKg = 40; weightKg <= 200; weightKg += 10) {
      for (let heightCm = 140; heightCm <= 210; heightCm += 10) {
        for (let age = 16; age <= 80; age += 8) {
          for (const sex of ['male', 'female'] as const) {
            for (const activityLevel of Object.keys(ACTIVITY_FACTORS) as Array<
              TargetInput['activityLevel']
            >) {
              for (const goal of ['cut', 'maintenance', 'bulk'] as const) {
                const result = calculateDailyTargets({
                  weightKg,
                  heightCm,
                  age,
                  sex,
                  activityLevel,
                  goal,
                });
                expect(result.kcal).toBeGreaterThanOrEqual(result.bmrKcal);
              }
            }
          }
        }
      }
    }
  });
});

describe('safety rule 3 — carbohydrates never go negative', () => {
  it('clamps carbs to zero and warns when protein and fat fill the budget', () => {
    // Deliberately extreme, because with the current constants nothing
    // realistic gets here: 177 kg at 141 cm, age 120, cutting. The calorie
    // target is clamped to the BMR (1890), while 2.0 g/kg of protein is
    // 354 g = 1416 kcal and fat takes another 477. That overshoots the budget,
    // so carbs would land on -1 and the guard pulls them up to 0.
    const result = calculateDailyTargets({
      weightKg: 177,
      heightCm: 141,
      age: 120,
      sex: 'female',
      activityLevel: 'sedentary',
      goal: 'cut',
    });

    expect(result.carbsG).toBe(0);
    expect(result.warnings).toContain('carbs_clamped_to_zero');
  });

  it('leaves room for carbs for every realistic body', () => {
    // The flip side of the test above: the clamp is a guard, not something a
    // normal user should ever trigger. If a future change to the protein or
    // fat constants makes it reachable for ordinary people, this fails.
    for (let weightKg = 45; weightKg <= 200; weightKg += 5) {
      for (let heightCm = 150; heightCm <= 205; heightCm += 5) {
        for (let age = 16; age <= 90; age += 2) {
          for (const sex of ['male', 'female'] as const) {
            const result = calculateDailyTargets({
              weightKg,
              heightCm,
              age,
              sex,
              activityLevel: 'sedentary',
              goal: 'cut',
            });
            expect(result.carbsG).toBeGreaterThan(0);
            expect(result.warnings).not.toContain('carbs_clamped_to_zero');
          }
        }
      }
    }
  });

  it('holds across a wide sweep of bodies and goals', () => {
    for (let weightKg = 40; weightKg <= 400; weightKg += 20) {
      for (let heightCm = 140; heightCm <= 210; heightCm += 10) {
        for (const sex of ['male', 'female'] as const) {
          for (const goal of ['cut', 'maintenance', 'bulk'] as const) {
            const result = calculateDailyTargets({
              weightKg,
              heightCm,
              age: 40,
              sex,
              activityLevel: 'sedentary',
              goal,
            });
            expect(result.carbsG).toBeGreaterThanOrEqual(0);
            expect(result.proteinG).toBeGreaterThanOrEqual(0);
            expect(result.fatG).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('safety rule 4 — calories are never a punishment for missed workouts', () => {
  it('ignores anything training-related that is passed in', () => {
    const base = calculateDailyTargets(man);

    // The function has no training input by design. Even if a caller smuggles
    // one in, the numbers must not move. If someone ever adds a "missed
    // workouts lowers your calories" feature, this test fails.
    const withTrainingNoise = calculateDailyTargets({
      ...man,
      missedWorkouts: 14,
      streak: 0,
      lastWorkoutDaysAgo: 30,
    } as TargetInput);

    expect(withTrainingNoise).toEqual(base);
  });

  it('depends on nothing but the six declared inputs', () => {
    const keys = Object.keys(man).sort();
    expect(keys).toEqual(
      ['activityLevel', 'age', 'goal', 'heightCm', 'sex', 'weightKg'].sort(),
    );
  });

  it('is deterministic: the same input gives the same numbers every time', () => {
    expect(calculateDailyTargets(man)).toEqual(calculateDailyTargets(man));
  });
});

describe('macros', () => {
  it('scales protein with body weight and goal', () => {
    for (const goal of ['cut', 'maintenance', 'bulk'] as const) {
      const result = calculateDailyTargets({ ...man, goal });
      expect(result.proteinG).toBe(Math.round(80 * PROTEIN_G_PER_KG[goal]));
    }
  });

  it('gives a cut more protein per kilo than a bulk', () => {
    expect(PROTEIN_G_PER_KG.cut).toBeGreaterThan(PROTEIN_G_PER_KG.maintenance);
    expect(PROTEIN_G_PER_KG.maintenance).toBeGreaterThan(PROTEIN_G_PER_KG.bulk);
  });

  it('puts 25% of the calories in fat', () => {
    const result = calculateDailyTargets(man);
    expect(result.fatG).toBe(Math.round((result.kcal * 0.25) / 9));
  });

  it('fills the rest with carbs, so the macros add up to the calorie target', () => {
    const result = calculateDailyTargets(man);
    const fromMacros = result.proteinG * 4 + result.fatG * 9 + result.carbsG * 4;
    // Within a few kcal: grams are whole numbers, so rounding costs a little.
    expect(Math.abs(fromMacros - result.kcal)).toBeLessThanOrEqual(4);
  });

  it('returns whole grams and whole calories', () => {
    const result = calculateDailyTargets(woman);
    for (const value of [result.kcal, result.proteinG, result.fatG, result.carbsG]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('input validation', () => {
  it.each([
    ['weightKg', { ...man, weightKg: 0 }],
    ['weightKg', { ...man, weightKg: 500 }],
    ['heightCm', { ...man, heightCm: 40 }],
    ['age', { ...man, age: 0 }],
    ['age', { ...man, age: 200 }],
    ['weightKg', { ...man, weightKg: Number.NaN }],
  ])('rejects an impossible %s', (_field, input) => {
    expect(() => calculateDailyTargets(input)).toThrow(RangeError);
  });
});

describe('ageFromBirthDate', () => {
  it('counts a birthday that already passed this year', () => {
    expect(ageFromBirthDate(new Date(1998, 0, 15), new Date(2026, 8, 14))).toBe(28);
  });

  it('does not count a birthday later this year', () => {
    expect(ageFromBirthDate(new Date(1998, 11, 15), new Date(2026, 8, 14))).toBe(27);
  });

  it('counts the birthday itself', () => {
    expect(ageFromBirthDate(new Date(1998, 8, 14), new Date(2026, 8, 14))).toBe(28);
  });
});
