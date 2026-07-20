/**
 * Inline combat fixtures for the behavioural tests. Balanced off the canonical
 * exemplars in the header of src/data/units/core.ts (which the sim must not
 * import). NOT a .test.ts file, so vitest never runs it; tsc still checks it.
 */

import type { UnitDef, UnitCombatStats, AbilityDef, UnitRole } from '../types';
import type { BattleUnitInput, BattleSide } from './events';

type CombatOverride = Partial<Omit<UnitCombatStats, 'melee' | 'ranged'>> & {
  melee?: Partial<UnitCombatStats['melee']>;
  ranged?: UnitCombatStats['ranged'];
};

const BASE_COMBAT: UnitCombatStats = {
  figures: 6,
  hits: 3,
  melee: { attack: 4, damage: 2, reach: 1 },
  armor: 1,
  speed: 2,
  mass: 1,
  morale: 50,
  discipline: 50,
};

export function mkUnit(
  id: string,
  opts: {
    role?: UnitRole;
    skill?: number;
    abilities?: AbilityDef[];
    combat?: CombatOverride;
    name?: string;
  } = {},
): UnitDef {
  const c = opts.combat ?? {};
  const combat: UnitCombatStats = {
    ...BASE_COMBAT,
    ...c,
    melee: { ...BASE_COMBAT.melee, ...(c.melee ?? {}) },
    ...(c.ranged ? { ranged: c.ranged } : {}),
  };
  return {
    id,
    name: opts.name ?? id,
    role: opts.role ?? 'infantry',
    origin: { generic: true },
    cost: 30,
    combat,
    moves: 1,
    skill: opts.skill ?? 30,
    upkeep: {},
    abilities: opts.abilities ?? [],
    description: `test unit ${id}`,
  };
}

// --- Archetype exemplars ---------------------------------------------------

export const SPEARMEN = mkUnit('spearmen', {
  combat: { figures: 6, hits: 3, melee: { attack: 4, damage: 2, reach: 2 }, armor: 1, speed: 2 },
});

export const SWORDSMEN = mkUnit('swordsmen', {
  combat: { figures: 6, hits: 3, melee: { attack: 5, damage: 3, reach: 1 }, armor: 2, speed: 2 },
});

export const ARCHERS = mkUnit('archers', {
  role: 'ranged',
  skill: 50,
  combat: {
    figures: 6,
    hits: 2,
    melee: { attack: 2, damage: 1, reach: 1 },
    ranged: { attack: 5, damage: 2, range: 6, ammo: 10 },
    armor: 0,
    speed: 2,
  },
});

export const CAVALRY = mkUnit('cavalry', {
  role: 'cavalry',
  skill: 40,
  abilities: [{ type: 'charge', bonus: 4 }],
  combat: {
    figures: 4,
    hits: 4,
    melee: { attack: 5, damage: 3, reach: 1 },
    armor: 2,
    speed: 4,
    mass: 4,
    morale: 55,
    discipline: 55,
  },
});

export const MILITIA = mkUnit('militia', {
  skill: 15,
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

/** Braced pikes: reach-2, high discipline + morale — the anvil for a charge. */
export const PIKES = mkUnit('pikes', {
  skill: 55,
  combat: {
    figures: 6,
    hits: 3,
    melee: { attack: 4, damage: 2, reach: 2 },
    armor: 2,
    speed: 1,
    mass: 1,
    morale: 65,
    discipline: 75,
  },
});

export const HEAVY_INFANTRY = mkUnit('heavy-infantry', {
  skill: 35,
  combat: {
    figures: 6,
    hits: 4,
    melee: { attack: 5, damage: 3, reach: 1 },
    armor: 2,
    speed: 1,
    mass: 2,
    morale: 55,
    discipline: 55,
  },
});

// --- Builders --------------------------------------------------------------

/** A BattleUnitInput at full hp (or an explicit hp). */
export function unit(id: string, def: UnitDef, hp?: number): BattleUnitInput {
  const full = def.combat.figures * def.combat.hits;
  return { id, def, hp: hp ?? full };
}

/** N copies of a def as a battle side, ids suffixed -0.. */
export function sideOf(def: UnitDef, n: number, prefix = def.id): BattleSide {
  const units: BattleUnitInput[] = [];
  for (let i = 0; i < n; i++) units.push(unit(`${prefix}-${i}`, def));
  return { units };
}

/** Total surviving hp across a side's survivor list. */
export function totalSurviving(survivors: { id: string; hp: number }[]): number {
  return survivors.reduce((s, u) => s + u.hp, 0);
}
