/**
 * Units — the shared unit/summon pool.
 *
 * Content-as-data: no logic beyond the plain constant below. `origin`
 * determines who can train (or cast) a unit: `{ generic: true }` units are
 * trainable by any race, `{ race: <id> }` units are exclusive to that race,
 * and `{ school: <id> }` units are summons cast by wizards of that school
 * (see src/sim/types.ts UnitDef and docs/DESIGN.md's per-school summoning
 * philosophy).
 *
 * This is a deliberately small starter roster — one settler, one
 * any-race garrison unit, one race-flavored infantry unit apiece for orcs
 * and humans, and one summon apiece for Life and Death illustrating the two
 * extremes of the summoning spectrum: Death is cheap and plentiful, Life is
 * rare and devastating.
 */

import type { UnitDef } from '@sim/types';

export const UNITS: Record<string, UnitDef> = {
  settler: {
    id: 'settler',
    name: 'Settler',
    role: 'settler',
    origin: { generic: true },
    cost: 60,
    attack: 0,
    defense: 1,
    hits: 3,
    moves: 2,
    skill: 5,
    upkeep: { gold: 1, food: 1 },
    abilities: ['found-city', 'non-combatant'],
    description:
      'A wagon-load of settlers, tools, and seed grain. Marches out from an existing city and is ' +
      'consumed to found a new one; it cannot fight and should never be caught in the open.',
  },
  militia: {
    id: 'militia',
    name: 'Militia',
    role: 'infantry',
    origin: { generic: true },
    cost: 30,
    attack: 3,
    defense: 3,
    hits: 4,
    moves: 1,
    skill: 20,
    upkeep: { gold: 1 },
    abilities: ['garrison-drilled'],
    description:
      'Farmers and shopkeepers handed a spear and a shield. The cheapest unit any race can train — ' +
      'poor on the offensive, but enough to hold a garrison against raiders.',
  },
  'orc-warrior': {
    id: 'orc-warrior',
    name: 'Orc Warrior',
    role: 'infantry',
    origin: { race: 'orcs' },
    cost: 45,
    attack: 5,
    defense: 5,
    hits: 6,
    moves: 1,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: ['brute-charge'],
    description:
      'A heavyset orc levy in scavenged plate, trained to close distance fast and fight through pain ' +
      'that would rout a softer people. Sturdier and harder-hitting than any generic militia.',
  },
  'human-spearman': {
    id: 'human-spearman',
    name: 'Human Spearman',
    role: 'infantry',
    origin: { race: 'humans' },
    cost: 40,
    attack: 4,
    defense: 6,
    hits: 5,
    moves: 1,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: ['braced-spear', 'anti-cavalry'],
    description:
      'Disciplined levy infantry drilled to plant their spears and hold formation. The braced hedge ' +
      'of steel makes them brutal to charge — cavalry that tries pays dearly for it.',
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    role: 'summon',
    origin: { school: 'death' },
    summonCost: 25,
    attack: 3,
    defense: 2,
    hits: 3,
    moves: 1,
    skill: 15,
    upkeep: { mana: 1 },
    abilities: ['undead', 'fearless', 'no-food-upkeep'],
    description:
      'A conscripted corpse, animated and pointed at the enemy. Cheap and disposable in true Death ' +
      'fashion — individually weak, but a wizard can raise a great many of them.',
  },
  angel: {
    id: 'angel',
    name: 'Angel',
    role: 'summon',
    origin: { school: 'life' },
    summonCost: 350,
    attack: 12,
    defense: 12,
    hits: 15,
    moves: 3,
    skill: 80,
    upkeep: { mana: 8 },
    abilities: ['flying', 'holy-smite', 'healing-aura', 'fearless'],
    description:
      'A radiant, sword-bearing herald summoned directly from the Empyrean. Ruinously expensive and ' +
      'rare to field, but among the single most devastating units in the game once it arrives.',
  },
};
