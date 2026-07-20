import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { mkUnit, unit } from './testkit';

/**
 * Two identical armies. The ONLY difference is tactical skill — same figures,
 * hits, attack, armor, morale, discipline. Skill drives behaviour (formation,
 * focus fire, composure), never a hidden +to-hit. The veterans must win the
 * clear majority of seeds on that behavioural edge alone.
 */
const GREEN = mkUnit('greens', {
  skill: 20,
  combat: { figures: 400, hits: 1, melee: { attack: 5, damage: 3, reach: 1 }, armor: 2, speed: 2, mass: 1, morale: 50, discipline: 50 },
});
const VETERAN = mkUnit('veterans', {
  skill: 70,
  combat: { figures: 400, hits: 1, melee: { attack: 5, damage: 3, reach: 1 }, armor: 2, speed: 2, mass: 1, morale: 50, discipline: 50 },
});

describe('skill is a behavioural edge, not a stat edge', () => {
  it('veterans (skill 70) beat identical greens (skill 20) on at least 8 of 10 seeds', () => {
    let vetWins = 0;
    for (let seed = 0; seed < 10; seed++) {
      const r = runBattle({
        seed,
        attacker: { units: [0, 1, 2, 3].map((i) => unit(`v${i}`, VETERAN)) },
        defender: { units: [0, 1, 2, 3].map((i) => unit(`g${i}`, GREEN)) },
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      if (r.outcome.winner === 'attacker') vetWins += 1;
    }
    expect(vetWins).toBeGreaterThanOrEqual(8);
  });

  it('the two unit definitions are identical except for the skill field', () => {
    const norm = { id: 'x', name: 'x', description: 'x' };
    const { skill: _vs, ...vetRest } = VETERAN;
    const { skill: _gs, ...greenRest } = GREEN;
    expect({ ...vetRest, ...norm }).toEqual({ ...greenRest, ...norm });
    expect(VETERAN.skill).not.toBe(GREEN.skill);
  });
});
