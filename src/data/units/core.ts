/**
 * Generic units any race can train — and the CANONICAL STAT EXEMPLARS.
 * Every racial roster is balanced against the militia baseline below.
 *
 * Archetype anchors (deviate for racial identity, not for power creep):
 *   line spear   f6 h3  melee 4/2 reach2  armor 1 spd 2 mass 1 mor 50 dis 50 skill 30
 *   line sword   f6 h3  melee 5/3 reach1  armor 2 spd 2 mass 1 mor 50 dis 50 skill 30
 *   archer       f6 h2  melee 2/1 reach1  ranged 4/2 rng6 ammo8  armor 0 spd 2
 *   cavalry      f4 h4  melee 5/3 reach1  armor 2 spd 4 mass 4 + charge
 *   elite        one tier up in 2-3 stats, 1-2 abilities, cost ~2x line
 */
import type { UnitDef } from '../../sim/types';

export const CORE_UNITS: Record<string, UnitDef> = {
  settler: {
    id: 'settler',
    name: 'Settlers',
    role: 'settler',
    origin: { generic: true },
    cost: 60,
    combat: {
      figures: 4,
      hits: 2,
      melee: { attack: 1, damage: 1, reach: 1 },
      armor: 0,
      speed: 1,
      mass: 1,
      morale: 30,
      discipline: 20,
    },
    moves: 2,
    skill: 5,
    upkeep: { gold: 1, food: 1 },
    abilities: [],
    description:
      'Wagons, families, and tools. Settlers found new cities and are all but ' +
      'defenseless — escort them.',
  },
  militia: {
    id: 'militia',
    name: 'Militia',
    role: 'infantry',
    origin: { generic: true },
    cost: 30,
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
    moves: 1,
    skill: 15,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Townsfolk with spears from the guardhouse rack. They hold a wall and ' +
      'little else; green enough to blob, break, and bolt.',
  },
};
