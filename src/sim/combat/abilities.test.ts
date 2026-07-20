import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { MILITIA, SWORDSMEN, mkUnit, sideOf, unit } from './testkit';

const DRAGON_BASE = {
  figures: 1,
  hits: 60,
  melee: { attack: 9, damage: 7, reach: 1 as const },
  armor: 4,
  speed: 2,
  mass: 8,
  morale: 100,
  discipline: 90,
};
const DRAGON = mkUnit('dragon', {
  role: 'monster',
  skill: 60,
  abilities: [{ type: 'breath-weapon', damage: 12, range: 6, cooldown: 1 }],
  combat: DRAGON_BASE,
});
const WINGLESS_WYRM = mkUnit('wyrm', { role: 'monster', skill: 60, abilities: [], combat: DRAGON_BASE });

const FEAR_KNIGHT = mkUnit('dread-knight', {
  skill: 50,
  abilities: [{ type: 'fear', radius: 4 }],
  combat: { figures: 4, hits: 5, melee: { attack: 6, damage: 4, reach: 1 }, armor: 3, speed: 2, mass: 3, morale: 80, discipline: 70 },
});
const UNDEAD_FOE = mkUnit('wights', {
  skill: 30,
  abilities: [{ type: 'undead' }],
  combat: { figures: 6, hits: 3, melee: { attack: 4, damage: 2, reach: 1 }, armor: 1, speed: 2, mass: 1, morale: 0, discipline: 0 },
});

const INSPIRER = mkUnit('captain', {
  skill: 60,
  abilities: [{ type: 'inspire', radius: 8, bonus: 30 }],
  combat: { figures: 4, hits: 5, melee: { attack: 5, damage: 3, reach: 1 }, armor: 3, speed: 2, mass: 2, morale: 85, discipline: 85 },
});

const PRIEST = mkUnit('priest', {
  skill: 55,
  abilities: [{ type: 'holy-aura', radius: 6, healPerTick: 4 }],
  combat: { figures: 4, hits: 4, melee: { attack: 3, damage: 2, reach: 1 }, armor: 2, speed: 2, mass: 1, morale: 80, discipline: 80 },
});

const WOLF = mkUnit('wolf', {
  role: 'monster',
  skill: 45,
  abilities: [{ type: 'pack-hunter' }],
  combat: { figures: 4, hits: 3, melee: { attack: 4, damage: 3, reach: 1 }, armor: 0, speed: 3, mass: 2, morale: 45, discipline: 40 },
});

describe('breath-weapon rewrites a battle', () => {
  it('a breathing monster beats 6 militia where the identical monster without breath loses', () => {
    const seeds = [0, 1, 2, 3, 4, 5, 6, 7];
    let withWins = 0;
    let withoutWins = 0;
    for (const seed of seeds) {
      const w = runBattle({ seed, attacker: { units: [unit('drg', DRAGON)] }, defender: sideOf(MILITIA, 6, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
      const n = runBattle({ seed, attacker: { units: [unit('wyr', WINGLESS_WYRM)] }, defender: sideOf(MILITIA, 6, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
      if (w.outcome.winner === 'attacker') withWins += 1;
      if (n.outcome.winner === 'attacker') withoutWins += 1;
    }
    expect(withWins).toBe(seeds.length);
    expect(withoutWins).toBe(0);
  });

  it('breath fires visibly as an ability-proc hitting multiple foes', () => {
    const r = runBattle({ seed: 0, attacker: { units: [unit('drg', DRAGON)] }, defender: sideOf(MILITIA, 6, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
    const procs = r.events.filter((e) => e.type === 'ability-proc' && e.ability === 'breath-weapon');
    expect(procs.length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'damage' && e.kind === 'breath')).toBe(true);
  });
});

describe('fear vs undead immunity, inspire counter-pressure', () => {
  it('living foes take fear morale-checks; undead foes take none', () => {
    const living = runBattle({ seed: 5, attacker: { units: [unit('dk', FEAR_KNIGHT)] }, defender: sideOf(MILITIA, 4, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
    const undead = runBattle({ seed: 5, attacker: { units: [unit('dk', FEAR_KNIGHT)] }, defender: sideOf(UNDEAD_FOE, 4, 'u'), terrain: { plane: 'meridia', terrain: 'grassland' } });
    expect(living.events.some((e) => e.type === 'morale-check' && e.trigger === 'fear')).toBe(true);
    // The undead defenders never check (the living attacker's own checks don't count).
    expect(undead.events.filter((e) => e.type === 'morale-check' && e.unitId.startsWith('u'))).toHaveLength(0);
  });

  it('an inspire aura measurably reduces friendly routs', () => {
    const seeds = [5, 6, 7, 8, 9, 10];
    const routs = (withCaptain: boolean): number => {
      let total = 0;
      for (const seed of seeds) {
        const defenders = withCaptain
          ? { units: [unit('m0', MILITIA), unit('m1', MILITIA), unit('cap', INSPIRER)] }
          : { units: [unit('m0', MILITIA), unit('m1', MILITIA)] };
        const r = runBattle({ seed, attacker: sideOf(SWORDSMEN, 5, 's'), defender: defenders, terrain: { plane: 'meridia', terrain: 'grassland' } });
        total += r.events.filter((e) => e.type === 'rout' && (e.unitId === 'm0' || e.unitId === 'm1')).length;
      }
      return total;
    };
    expect(routs(true)).toBeLessThan(routs(false));
  });
});

describe('holy-aura healing', () => {
  it('heals wounded allies and shows in the event log', () => {
    // Start the ally already wounded so the aura has work to do.
    const woundedAlly = unit('ally', SWORDSMEN, 6);
    const r = runBattle({
      seed: 3,
      attacker: { units: [woundedAlly, unit('pr', PRIEST)] },
      defender: sideOf(MILITIA, 3, 'm'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    const heals = r.events.filter((e) => e.type === 'heal' && e.kind === 'holy-aura');
    expect(heals.length).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === 'ability-proc' && e.ability === 'holy-aura')).toBe(true);
  });
});

describe('pack-hunter', () => {
  it('two pack-hunters flanking a target proc the bonus; a lone pack-hunter does not', () => {
    const pair = runBattle({
      seed: 4,
      attacker: { units: [unit('w0', WOLF), unit('w1', WOLF)] },
      defender: sideOf(MILITIA, 1, 'prey'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    const lone = runBattle({
      seed: 4,
      attacker: { units: [unit('w0', WOLF)] },
      defender: sideOf(MILITIA, 1, 'prey'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    expect(pair.events.some((e) => e.type === 'ability-proc' && e.ability === 'pack-hunter')).toBe(true);
    expect(lone.events.some((e) => e.type === 'ability-proc' && e.ability === 'pack-hunter')).toBe(false);
  });
});
