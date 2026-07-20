import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { MILITIA, SWORDSMEN, mkUnit, sideOf, unit } from './testkit';

// A SINGULAR great monster: one dragon, 1 figure, a deep pool and high armor —
// so frontage-limited chip damage takes many ticks to bleed it dry, long enough
// for its breath to matter.
const DRAGON_BASE = {
  figures: 1,
  hits: 95,
  melee: { attack: 9, damage: 7, reach: 1 as const },
  armor: 5,
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

// Elite dread-knight company (~120, 2 hits each) — fewer, better.
const FEAR_KNIGHT = mkUnit('dread-knight', {
  skill: 50,
  abilities: [{ type: 'fear', radius: 4 }],
  combat: { figures: 120, hits: 2, melee: { attack: 6, damage: 4, reach: 1 }, armor: 3, speed: 2, mass: 3, morale: 80, discipline: 70 },
});
const UNDEAD_FOE = mkUnit('wights', {
  skill: 30,
  abilities: [{ type: 'undead' }],
  combat: { figures: 300, hits: 1, melee: { attack: 4, damage: 2, reach: 1 }, armor: 1, speed: 2, mass: 1, morale: 0, discipline: 0 },
});

const INSPIRER_COMBAT = { figures: 120, hits: 2, melee: { attack: 5, damage: 3, reach: 1 as const }, armor: 3, speed: 2, mass: 2, morale: 85, discipline: 85 };
const INSPIRER = mkUnit('captain', {
  skill: 60,
  abilities: [{ type: 'inspire', radius: 8, bonus: 30 }],
  combat: INSPIRER_COMBAT,
});
/** Identical captain WITHOUT the aura — the control, so the test isolates inspire. */
const PLAIN_CAPTAIN = mkUnit('sergeant', { skill: 60, abilities: [], combat: INSPIRER_COMBAT });

const PRIEST = mkUnit('priest', {
  skill: 55,
  abilities: [{ type: 'holy-aura', radius: 6, healPerTick: 4 }],
  combat: { figures: 120, hits: 1, melee: { attack: 3, damage: 2, reach: 1 }, armor: 2, speed: 2, mass: 1, morale: 80, discipline: 80 },
});

const WOLF = mkUnit('wolf', {
  role: 'monster',
  skill: 45,
  abilities: [{ type: 'pack-hunter' }],
  combat: { figures: 90, hits: 1, melee: { attack: 4, damage: 3, reach: 1 }, armor: 0, speed: 3, mass: 2, morale: 45, discipline: 40 },
});

/** Total defender figures cut down across the whole battle (killed, not fled). */
function defenderFiguresLost(report: import('./events').BattleReport): number {
  return report.events.reduce(
    (s, e) => (e.type === 'damage' && e.targetId.startsWith('m') ? s + e.figuresLost : s),
    0,
  );
}

describe('breath-weapon rewrites a battle at regiment scale', () => {
  // Three militia regiments ≈ 1050 levies against one dragon. WITH breath the
  // dragon sweeps hundreds aside and wins; the identical WINGLESS wyrm, all
  // melee, is dragged down and loses. "A dragon sweeping hundreds of peasants
  // aside is a powerful image" — this test is that image, in numbers.
  it('a breathing dragon sweeps ~1000 levies (hundreds fall); the wingless wyrm loses', () => {
    const seeds = [0, 1, 2, 3, 4, 5, 6, 7];
    let withWins = 0;
    let withoutWins = 0;
    let sweptSum = 0;
    for (const seed of seeds) {
      const w = runBattle({ seed, attacker: { units: [unit('drg', DRAGON)] }, defender: sideOf(MILITIA, 3, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
      const n = runBattle({ seed, attacker: { units: [unit('wyr', WINGLESS_WYRM)] }, defender: sideOf(MILITIA, 3, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
      if (w.outcome.winner === 'attacker') withWins += 1;
      if (n.outcome.winner === 'attacker') withoutWins += 1;
      sweptSum += defenderFiguresLost(w);
    }
    expect(withWins).toBe(seeds.length);
    expect(withoutWins).toBe(0);
    // Hundreds of levies cut down, on average, by the breath.
    expect(sweptSum / seeds.length).toBeGreaterThan(300);
  });

  it('breath fires visibly as an ability-proc and reaps a swath (dozens+) in one blast', () => {
    const r = runBattle({ seed: 0, attacker: { units: [unit('drg', DRAGON)] }, defender: sideOf(MILITIA, 3, 'm'), terrain: { plane: 'meridia', terrain: 'grassland' } });
    const procs = r.events.filter((e) => e.type === 'ability-proc' && e.ability === 'breath-weapon');
    expect(procs.length).toBeGreaterThan(0);
    const breathHits = r.events.filter((e) => e.type === 'damage' && e.kind === 'breath');
    expect(breathHits.length).toBeGreaterThan(0);
    // A single blast carves dozens out of a dense regiment, not a lone figure.
    expect(Math.max(...breathHits.map((e) => (e as { figuresLost: number }).figuresLost))).toBeGreaterThan(20);
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

  it('an inspire aura measurably steadies allies (higher morale-check pass rate than an identical captain without it)', () => {
    const seeds = [5, 6, 7, 8, 9, 10];
    // Same army both times — the ONLY difference is whether the captain inspires.
    // Inspire raises the pass THRESHOLD of every nearby check, so the faithful
    // measure is the fraction of the militia's nerve checks that hold. (Counting
    // rout *events* is misleading: steadier troops live longer and so accumulate
    // more checks — and more rally-then-rebreak cycles — over a longer fight.)
    const passRate = (captain: typeof INSPIRER): number => {
      let passed = 0;
      let total = 0;
      for (const seed of seeds) {
        const defenders = { units: [unit('m0', MILITIA), unit('m1', MILITIA), unit('cap', captain)] };
        const r = runBattle({ seed, attacker: sideOf(SWORDSMEN, 5, 's'), defender: defenders, terrain: { plane: 'meridia', terrain: 'grassland' } });
        for (const e of r.events) {
          if (e.type === 'morale-check' && (e.unitId === 'm0' || e.unitId === 'm1')) {
            total += 1;
            if (e.passed) passed += 1;
          }
        }
      }
      return total === 0 ? 1 : passed / total;
    };
    expect(passRate(INSPIRER)).toBeGreaterThan(passRate(PLAIN_CAPTAIN));
  });
});

describe('holy-aura healing', () => {
  it('heals wounded allies and shows in the event log', () => {
    // Start the ally already wounded (half strength) so the aura has work to do.
    const woundedAlly = unit('ally', SWORDSMEN, 200);
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
