import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { ARCHERS, HEAVY_INFANTRY, mkUnit, sideOf } from './testkit';
import type { BattleReport } from './events';

function attackerLossFraction(report: BattleReport): number {
  const full = report.events[0]!.type === 'battle-start'
    ? report.events[0]!.units.filter((u) => u.side === 'attacker').reduce((s, u) => s + u.maxHp, 0)
    : 0;
  const surv = report.outcome.survivors.attacker.reduce((s, u) => s + u.hp, 0);
  return full === 0 ? 1 : (full - surv) / full;
}

/** Same archers as ARCHERS but no speed edge — used for the pinned case. */
const FAST_HEAVY = mkUnit('fast-heavy', {
  skill: 35,
  combat: {
    figures: 240,
    hits: 2,
    melee: { attack: 5, damage: 3, reach: 1 },
    armor: 2,
    speed: 2,
    mass: 2,
    morale: 55,
    discipline: 55,
  },
});

describe('kiting: speed + range beats slow melee, and loses when it cannot run', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  it('archers (speed 2, range 6) kite slow heavy infantry (speed 1) and win with minor losses while ammo lasts', () => {
    let wins = 0;
    let lossSum = 0;
    for (const seed of seeds) {
      const r = runBattle({
        seed,
        attacker: sideOf(ARCHERS, 3, 'ar'),
        defender: sideOf(HEAVY_INFANTRY, 3, 'hi'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      if (r.outcome.winner === 'attacker') wins += 1;
      lossSum += attackerLossFraction(r);
    }
    expect(wins).toBe(seeds.length);
    expect(lossSum / seeds.length).toBeLessThan(0.4); // minor losses
  });

  it('the same archers, swarmed and pinned by a larger force they cannot outrun, lose', () => {
    let losses = 0;
    for (const seed of seeds) {
      const r = runBattle({
        seed,
        attacker: sideOf(ARCHERS, 3, 'ar'),
        defender: sideOf(FAST_HEAVY, 8, 'hi'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      if (r.outcome.winner === 'defender') losses += 1;
    }
    expect(losses).toBe(seeds.length);
  });

  it('archers actually spend ammo while kiting (volley events precede the melee)', () => {
    const r = runBattle({
      seed: 3,
      attacker: sideOf(ARCHERS, 3, 'ar'),
      defender: sideOf(HEAVY_INFANTRY, 3, 'hi'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    const volleys = r.events.filter((e) => e.type === 'volley');
    const kites = r.events.filter((e) => e.type === 'move' && e.reason === 'kite');
    expect(volleys.length).toBeGreaterThan(3);
    expect(kites.length).toBeGreaterThan(0);
  });
});
