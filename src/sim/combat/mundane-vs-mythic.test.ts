import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { mkUnit, unit } from './testkit';
import type { BattleReport, BattleUnitInput } from './events';

/**
 * MUNDANE VS MYTHIC — the design law (DESIGN.md "Mundane vs mythic"): great
 * monsters are terror weapons, and massed archery alone must NOT cheaply delete
 * them. Volleys SATURATE against a single great beast (only a mass-scaled arc of
 * the arrows can even aim at one body) and armor SOAKS the rest (an arrow that
 * can't beat the hide glances off — no melee-style min-1). Bringing a great
 * beast down costs blood, elites, or magic.
 *
 * The fixture is the lead designer's field report, statted from src/data/units:
 * a mundane orc warband (warrior + spearman + 2 archers, ~1,480 figures, no
 * elites and no magic) storming a strong-tier lair guarded by a wyvern, a giant
 * spider nest, and TWO hill giants. Before the frontage/saturation rework the
 * two archer regiments feathered the whole menagerie to death without a single
 * orc lost. That is the bug this suite exists to keep dead.
 */

// --- Orc warband (mundane line troops) — mirrors src/data/units/meridia.ts ---
const ORC_WARRIOR = mkUnit('orc-warrior', {
  role: 'infantry',
  skill: 20,
  combat: { figures: 400, hits: 1, melee: { attack: 4, damage: 3, reach: 1 }, armor: 1, speed: 2, mass: 1, morale: 45, discipline: 35 },
});
const ORC_SPEARMAN = mkUnit('orc-spearman', {
  role: 'infantry',
  skill: 20,
  combat: { figures: 400, hits: 1, melee: { attack: 4, damage: 2, reach: 2 }, armor: 1, speed: 2, mass: 1, morale: 45, discipline: 35 },
});
const ORC_ARCHER = mkUnit('orc-archer', {
  role: 'ranged',
  skill: 22,
  combat: { figures: 340, hits: 1, melee: { attack: 2, damage: 1, reach: 1 }, ranged: { attack: 4, damage: 2, range: 6, ammo: 8 }, armor: 0, speed: 2, mass: 1, morale: 40, discipline: 30 },
});

// --- Lair guardians (great beasts) — mirrors src/data/units/creatures.ts ------
const WYVERN = mkUnit('wyvern', {
  role: 'monster',
  skill: 28,
  abilities: [{ type: 'flying' }, { type: 'poison', strength: 2 }],
  combat: { figures: 1, hits: 35, melee: { attack: 6, damage: 4, reach: 1 }, armor: 2, speed: 4, mass: 2, morale: 60, discipline: 35 },
});
const GIANT_SPIDERS = mkUnit('giant-spiders', {
  role: 'monster',
  skill: 20,
  abilities: [{ type: 'poison', strength: 1 }],
  combat: { figures: 70, hits: 1, melee: { attack: 4, damage: 2, reach: 1 }, armor: 0, speed: 3, mass: 1, morale: 50, discipline: 30 },
});
const HILL_GIANT = mkUnit('hill-giant', {
  role: 'monster',
  skill: 30,
  abilities: [{ type: 'trample' }],
  combat: { figures: 1, hits: 50, melee: { attack: 8, damage: 7, reach: 1 }, armor: 3, speed: 2, mass: 5, morale: 65, discipline: 35 },
});

const ORC_TOTAL_FIGURES = 400 + 400 + 340 + 340;

function orcWarband(): { units: BattleUnitInput[] } {
  return {
    units: [unit('orc-warrior', ORC_WARRIOR), unit('orc-spearman', ORC_SPEARMAN), unit('orc-archer-0', ORC_ARCHER), unit('orc-archer-1', ORC_ARCHER)],
  };
}
function lairGuardians(): { units: BattleUnitInput[] } {
  return {
    units: [unit('wyvern', WYVERN), unit('giant-spiders', GIANT_SPIDERS), unit('hill-giant-0', HILL_GIANT), unit('hill-giant-1', HILL_GIANT)],
  };
}

/** Surviving attacker figures (1 hp == 1 figure for these 1-hit orc units). */
function orcSurvivors(r: BattleReport): number {
  return r.outcome.survivors.attacker.reduce((s, u) => s + u.hp, 0);
}

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('mundane vs mythic: a lair of great beasts is not archery-fodder', () => {
  it("the designer's exact fight — monsters win most seeds, and any orc win is a bloodbath (never a zero-loss walkover)", () => {
    let monsterWins = 0;
    let orcWins = 0;
    let zeroLossOrcWins = 0;
    const orcWinLossFractions: number[] = [];

    for (const seed of SEEDS) {
      const r = runBattle({ seed, attacker: orcWarband(), defender: lairGuardians(), terrain: { plane: 'meridia', terrain: 'grassland' } });
      const lossFrac = (ORC_TOTAL_FIGURES - orcSurvivors(r)) / ORC_TOTAL_FIGURES;
      if (r.outcome.winner === 'defender') {
        monsterWins += 1;
      } else if (r.outcome.winner === 'attacker') {
        orcWins += 1;
        orcWinLossFractions.push(lossFrac);
        if (lossFrac <= 0) zeroLossOrcWins += 1;
      }
    }

    // The beasts are terror weapons: they take the field on the clear majority
    // of seeds against mundane line troops with no elites and no magic.
    expect(monsterWins).toBeGreaterThanOrEqual(6);
    // The exact bug: an orc army wiping the lair "without a single loss". Dead.
    expect(zeroLossOrcWins).toBe(0);
    // Any orc victory is pyrrhic — a quarter of the warband or more is left in
    // the dirt. (Vacuously true if the orcs never win, which is also acceptable.)
    for (const frac of orcWinLossFractions) expect(frac).toBeGreaterThanOrEqual(0.25);
  });

  it('massed archery cannot cheaply delete a lone wyvern or a lone hill giant (saturation + armor soak)', () => {
    // Two orc-archer regiments (~680 bows, 8 volleys each) against ONE great
    // beast. Before the rework this was a free kill; now the volley saturates
    // (only its mass-scaled bulk can be aimed at) and armor soaks the arrows.
    for (const [beast, def] of [
      ['wyvern', WYVERN],
      ['hill-giant', HILL_GIANT],
    ] as const) {
      let archerWins = 0;
      for (const seed of SEEDS) {
        const r = runBattle({
          seed,
          attacker: { units: [unit('orc-archer-0', ORC_ARCHER), unit('orc-archer-1', ORC_ARCHER)] },
          defender: { units: [unit(beast, def)] },
          terrain: { plane: 'meridia', terrain: 'grassland' },
        });
        if (r.outcome.winner === 'attacker') archerWins += 1;
      }
      // The beast wins nearly every time — bows alone do not fell it.
      expect(archerWins, `${beast} felled by 2 archer regiments`).toBeLessThanOrEqual(1);
    }
  });

  it('a hill giant reaping a shield wall carves a SWATH per swing (trample), not one figure at a time', () => {
    const r = runBattle({ seed: 4, attacker: orcWarband(), defender: lairGuardians(), terrain: { plane: 'meridia', terrain: 'grassland' } });
    // The single bloodiest hill-giant swing kills many orcs at once — the melee
    // analog of a breath sweep, and what makes a lone giant genuinely frightening.
    const giantSwings = r.events.filter(
      (e) => e.type === 'damage' && (e.sourceId === 'hill-giant-0' || e.sourceId === 'hill-giant-1') && (e.kind === 'melee' || e.kind === 'charge'),
    ) as Array<{ figuresLost: number }>;
    expect(giantSwings.length).toBeGreaterThan(0);
    expect(Math.max(...giantSwings.map((e) => e.figuresLost))).toBeGreaterThan(12);
  });

  it('an arrow that cannot beat a hill giant\'s hide is soaked — no melee-style min-1 chip damage', () => {
    // Orc arrows (damage 2) vs a hill giant (armor 3): every volley that lands
    // must be almost entirely soaked. No single volley may gut the 50-hp giant.
    const r = runBattle({
      seed: 2,
      attacker: { units: [unit('orc-archer-0', ORC_ARCHER), unit('orc-archer-1', ORC_ARCHER)] },
      defender: { units: [unit('hill-giant', HILL_GIANT)] },
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    const arrowDamageOnGiant = r.events.filter(
      (e) => e.type === 'damage' && e.kind === 'ranged' && e.targetId === 'hill-giant',
    ) as Array<{ amount: number }>;
    expect(arrowDamageOnGiant.length).toBeGreaterThan(0);
    // A hide that shrugs off militia bows "almost entirely": no volley dents it
    // for anything like the ~40+ a min-1 model would have inflicted.
    expect(Math.max(...arrowDamageOnGiant.map((e) => e.amount))).toBeLessThanOrEqual(8);
  });
});
