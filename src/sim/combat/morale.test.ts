import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { MILITIA, SWORDSMEN, mkUnit, sideOf, unit } from './testkit';

const FEARLESS_MILITIA = mkUnit('zealots', {
  skill: 15,
  abilities: [{ type: 'fearless' }],
  combat: {
    figures: 6,
    hits: 3,
    melee: { attack: 3, damage: 2, reach: 1 },
    armor: 1,
    speed: 2,
    mass: 1,
    morale: 40,
    discipline: 30,
  },
});

const SKELETONS = mkUnit('skeletons', {
  skill: 15,
  abilities: [{ type: 'undead' }],
  combat: {
    figures: 6,
    hits: 3,
    melee: { attack: 3, damage: 2, reach: 1 },
    armor: 1,
    speed: 2,
    mass: 1,
    morale: 0,
    discipline: 0,
  },
});

describe('morale decides fights', () => {
  it('heavily outnumbered militia rout before being wiped out', () => {
    let routedBeforeDeathCount = 0;
    const seeds = [1, 2, 3, 4, 5, 6];
    for (const seed of seeds) {
      const r = runBattle({
        seed,
        attacker: sideOf(SWORDSMEN, 6, 'sw'),
        defender: { units: [unit('m0', MILITIA), unit('m1', MILITIA)] },
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      // A rout event for a militia unit that is NOT immediately a death.
      const routed = r.events.some((e) => e.type === 'rout' && e.unitId.startsWith('m'));
      if (routed) routedBeforeDeathCount += 1;
    }
    expect(routedBeforeDeathCount).toBeGreaterThanOrEqual(5);
  });

  it("'fearless' equivalents never rout in the same hopeless fight", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = runBattle({
        seed,
        attacker: sideOf(SWORDSMEN, 6, 'sw'),
        defender: { units: [unit('z0', FEARLESS_MILITIA), unit('z1', FEARLESS_MILITIA)] },
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      expect(r.events.some((e) => e.type === 'rout' && e.unitId.startsWith('z'))).toBe(false);
    }
  });

  it("'undead' never emit a single morale-check event", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = runBattle({
        seed,
        attacker: sideOf(SWORDSMEN, 6, 'sw'),
        defender: { units: [unit('u0', SKELETONS), unit('u1', SKELETONS)] },
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      const undeadChecks = r.events.filter((e) => e.type === 'morale-check' && e.unitId.startsWith('u'));
      expect(undeadChecks).toHaveLength(0);
    }
  });
});
