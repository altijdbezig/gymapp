import {
  formatMl,
  totalMl,
  waterPresetLabel,
  waterProgress,
  DEFAULT_WATER_GOAL_ML,
  WATER_PRESETS_ML,
  type WaterEntry,
} from '../water';

function entry(ml: number): WaterEntry {
  return {
    id: `water-${ml}-${Math.random()}`,
    user_id: 'user-1',
    logged_on: '2026-09-14',
    ml,
    created_at: '2026-09-14T10:00:00Z',
  };
}

describe('totalMl', () => {
  it('adds the glasses up', () => {
    expect(totalMl([entry(200), entry(330), entry(500)])).toBe(1030);
  });

  it('is zero for an empty day', () => {
    expect(totalMl([])).toBe(0);
  });
});

describe('waterProgress', () => {
  it('fills the bar towards the goal', () => {
    const progress = waterProgress([entry(500), entry(500)], 2000);

    expect(progress.totalMl).toBe(1000);
    expect(progress.ratio).toBe(0.5);
    expect(progress.remainingMl).toBe(1000);
    expect(progress.isGoalReached).toBe(false);
  });

  it('stops the bar at full instead of going over', () => {
    const progress = waterProgress([entry(3000)], 2000);

    expect(progress.ratio).toBe(1);
    expect(progress.remainingMl).toBe(0);
    expect(progress.isGoalReached).toBe(true);
  });

  it('falls back to the default goal rather than dividing by zero', () => {
    expect(waterProgress([entry(1000)], 0).goalMl).toBe(DEFAULT_WATER_GOAL_ML);
  });
});

describe('formatMl', () => {
  it('uses litres above a litre', () => {
    expect(formatMl(750)).toBe('750 ml');
    expect(formatMl(1000)).toBe('1 L');
    expect(formatMl(1500)).toBe('1,5 L');
  });
});

describe('waterPresetLabel', () => {
  it('names every preset', () => {
    for (const ml of WATER_PRESETS_ML) {
      expect(waterPresetLabel(ml)).toBeTruthy();
    }
    expect(waterPresetLabel(200)).toBe('Glas');
    expect(waterPresetLabel(500)).toBe('Fles');
  });
});
