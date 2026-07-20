/**
 * Creatures: school summons (skeleton, angel, ...) and the neutral monsters
 * that garrison lairs. Owned by the dark/light content pass.
 *
 * Summons (role: 'summon', origin: { school }) follow each school's
 * philosophy from docs/DESIGN.md: Death is cheapest and most numerous
 * (conversion-flavored, weaker unit for unit); Life is fewest and dearest,
 * the strongest units in the game; Chaos/Nature/Sorcery sit in a distinct
 * mid-range between them.
 *
 * Monsters (role: 'monster', origin: { generic: true }) are neutral lair
 * garrisons with no production cost and no summon cost — they are never
 * trained or cast, only fought. They span from a small nuisance to an
 * endgame threat that can rewrite a battle on its own.
 */
import type { UnitDef } from '../../sim/types';

export const CREATURE_UNITS: Record<string, UnitDef> = {
  // ---------------------------------------------------------------------
  // Death summons — cheapest, most numerous, generally weaker.
  // ---------------------------------------------------------------------
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    role: 'summon',
    origin: { school: 'death' },
    combat: {
      figures: 300,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 100,
      discipline: 50,
    },
    moves: 1,
    skill: 10,
    upkeep: {},
    summonCost: 25,
    abilities: [{ type: 'undead' }],
    description:
      'Reanimated bones bound by death-magic: mindless, tireless, and immune to fear ' +
      'or fatigue. Death\'s cheapest and most plentiful servant.',
  },
  zombie: {
    id: 'zombie',
    name: 'Zombie',
    role: 'summon',
    origin: { school: 'death' },
    combat: {
      figures: 250,
      hits: 1,
      melee: { attack: 2, damage: 2, reach: 1 },
      armor: 0,
      speed: 1,
      mass: 1,
      morale: 100,
      discipline: 40,
    },
    moves: 1,
    skill: 8,
    upkeep: {},
    summonCost: 30,
    abilities: [{ type: 'undead' }],
    description:
      'Shambling risen corpses, slow but relentless, converted wholesale from the ' +
      'dead of a battlefield or a town\'s own graveyard.',
  },
  wraith: {
    id: 'wraith',
    name: 'Wraith',
    role: 'summon',
    origin: { school: 'death' },
    combat: {
      figures: 40,
      hits: 2,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 100,
      discipline: 50,
    },
    moves: 2,
    skill: 18,
    upkeep: {},
    summonCost: 40,
    abilities: [{ type: 'undead' }, { type: 'fear', radius: 2 }],
    description:
      'A howling remnant of the slain, faster and fouler than the skeletons it ' +
      'commands, radiating dread ahead of every step.',
  },

  // ---------------------------------------------------------------------
  // Life summons — fewest, strongest, hardest to cast.
  // ---------------------------------------------------------------------
  angel: {
    id: 'angel',
    name: 'Angel',
    role: 'summon',
    origin: { school: 'life' },
    combat: {
      figures: 1,
      hits: 70,
      melee: { attack: 10, damage: 8, reach: 1 },
      armor: 6,
      speed: 4,
      mass: 3,
      morale: 100,
      discipline: 100,
    },
    moves: 3,
    skill: 70,
    upkeep: { mana: 5 },
    summonCost: 350,
    abilities: [
      { type: 'flying' },
      { type: 'holy-aura', radius: 3, healPerTick: 4 },
      { type: 'inspire', radius: 4, bonus: 15 },
    ],
    description:
      'A being of pure celestial light, the mightiest thing Life magic can call to ' +
      'the field — its radiance alone can turn a losing battle.',
  },
  'guardian-spirit': {
    id: 'guardian-spirit',
    name: 'Guardian Spirit',
    role: 'summon',
    origin: { school: 'life' },
    combat: {
      figures: 1,
      hits: 40,
      melee: { attack: 7, damage: 5, reach: 1 },
      armor: 4,
      speed: 2,
      mass: 2,
      morale: 90,
      discipline: 90,
    },
    moves: 2,
    skill: 50,
    upkeep: { mana: 3 },
    summonCost: 180,
    abilities: [{ type: 'holy-aura', radius: 2, healPerTick: 2 }],
    description:
      'A protective ancestor-spirit bound to shield the wizard\'s chosen, mending ' +
      'wounds as it wards them.',
  },
  archon: {
    id: 'archon',
    name: 'Archon',
    role: 'summon',
    origin: { school: 'life' },
    combat: {
      figures: 1,
      hits: 45,
      melee: { attack: 8, damage: 6, reach: 1 },
      armor: 5,
      speed: 3,
      mass: 2,
      morale: 95,
      discipline: 90,
    },
    moves: 2,
    skill: 55,
    upkeep: { mana: 4 },
    summonCost: 220,
    abilities: [{ type: 'flying' }],
    description:
      'A warrior-judge of the Empyrean, descending on wings of light to execute the ' +
      'wizard\'s will.',
  },

  // ---------------------------------------------------------------------
  // Chaos summons — destruction and raw force, mid-range cost.
  // ---------------------------------------------------------------------
  'fire-drake': {
    id: 'fire-drake',
    name: 'Fire Drake',
    role: 'summon',
    origin: { school: 'chaos' },
    combat: {
      figures: 1,
      hits: 45,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 3,
      speed: 3,
      mass: 3,
      morale: 70,
      discipline: 60,
    },
    moves: 2,
    skill: 40,
    upkeep: { mana: 3 },
    summonCost: 140,
    abilities: [{ type: 'breath-weapon', damage: 8, range: 3, cooldown: 3 }],
    description:
      'A young fire-drake whose breath scorches a line of enemies clean off the ' +
      'field.',
  },
  hellhound: {
    id: 'hellhound',
    name: 'Hellhound',
    role: 'summon',
    origin: { school: 'chaos' },
    combat: {
      figures: 80,
      hits: 1,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 5,
      mass: 1,
      morale: 60,
      discipline: 40,
    },
    moves: 3,
    skill: 30,
    upkeep: { mana: 2 },
    summonCost: 70,
    abilities: [{ type: 'charge', bonus: 3 }],
    description:
      'A pack of burning hounds loosed from the Maelstrom, fast enough to run down ' +
      'fleeing archers.',
  },
  'flame-elemental': {
    id: 'flame-elemental',
    name: 'Flame Elemental',
    role: 'summon',
    origin: { school: 'chaos' },
    combat: {
      figures: 1,
      hits: 35,
      melee: { attack: 5, damage: 4, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 70,
      discipline: 50,
    },
    moves: 2,
    skill: 35,
    upkeep: { mana: 2 },
    summonCost: 90,
    abilities: [],
    description:
      'A living column of fire given crude shape, burning anything it touches.',
  },

  // ---------------------------------------------------------------------
  // Nature summons — beasts and terrain, mid-range cost.
  // ---------------------------------------------------------------------
  'great-boar': {
    id: 'great-boar',
    name: 'Great Boar',
    role: 'summon',
    origin: { school: 'nature' },
    combat: {
      figures: 1,
      hits: 35,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 3,
      mass: 4,
      morale: 60,
      discipline: 40,
    },
    moves: 2,
    skill: 28,
    upkeep: { mana: 2 },
    summonCost: 75,
    abilities: [{ type: 'trample' }],
    description:
      'A monstrous tusked boar summoned from the Wildroot, barreling clean through ' +
      'infantry lines.',
  },
  'forest-troll': {
    id: 'forest-troll',
    name: 'Forest Troll',
    role: 'summon',
    origin: { school: 'nature' },
    combat: {
      figures: 45,
      hits: 13,
      melee: { attack: 6, damage: 5, reach: 1 },
      armor: 3,
      speed: 2,
      mass: 3,
      morale: 65,
      discipline: 40,
    },
    moves: 1,
    skill: 32,
    upkeep: { mana: 3 },
    summonCost: 130,
    abilities: [{ type: 'regeneration', perTick: 3 }],
    description:
      'A hulking troll whose wounds close almost as fast as they are dealt.',
  },
  'dire-wolf': {
    id: 'dire-wolf',
    name: 'Dire Wolf',
    role: 'summon',
    origin: { school: 'nature' },
    combat: {
      figures: 90,
      hits: 1,
      melee: { attack: 5, damage: 2, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 55,
      discipline: 35,
    },
    moves: 3,
    skill: 26,
    upkeep: { mana: 2 },
    summonCost: 65,
    abilities: [{ type: 'pack-hunter' }],
    description:
      'A summoned wolf-pack that hunts as one, each flanking pair tearing deeper ' +
      'than a lone wolf ever could.',
  },

  // ---------------------------------------------------------------------
  // Sorcery summons — illusion and captured spirits, mid-range cost.
  // ---------------------------------------------------------------------
  'phantom-warrior': {
    id: 'phantom-warrior',
    name: 'Phantom Warrior',
    role: 'summon',
    origin: { school: 'sorcery' },
    combat: {
      figures: 70,
      hits: 2,
      melee: { attack: 6, damage: 3, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 1,
      morale: 70,
      discipline: 55,
    },
    moves: 2,
    skill: 38,
    upkeep: { mana: 2 },
    summonCost: 85,
    abilities: [{ type: 'first-strike' }],
    description:
      'An illusion-warrior that seems to strike before it has even moved, sorcery ' +
      'outrunning sight.',
  },
  'storm-djinn': {
    id: 'storm-djinn',
    name: 'Storm Djinn',
    role: 'summon',
    origin: { school: 'sorcery' },
    combat: {
      figures: 1,
      hits: 40,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 4,
      mass: 2,
      morale: 70,
      discipline: 55,
    },
    moves: 3,
    skill: 40,
    upkeep: { mana: 3 },
    summonCost: 150,
    abilities: [{ type: 'flying' }],
    description:
      'A captured wind-spirit that rides its own thunderhead across the battlefield.',
  },
  'arcane-sentinel': {
    id: 'arcane-sentinel',
    name: 'Arcane Sentinel',
    role: 'summon',
    origin: { school: 'sorcery' },
    combat: {
      figures: 1,
      hits: 32,
      melee: { attack: 5, damage: 4, reach: 1 },
      armor: 4,
      speed: 2,
      mass: 2,
      morale: 80,
      discipline: 70,
    },
    moves: 1,
    skill: 35,
    upkeep: { mana: 2 },
    summonCost: 95,
    abilities: [{ type: 'regeneration', perTick: 2 }],
    description:
      'A construct of woven mana and stone that stitches its own cracks shut ' +
      'mid-battle.',
  },

  // ---------------------------------------------------------------------
  // Neutral lair monsters — no cost, no summon cost, never trained or cast.
  // ---------------------------------------------------------------------
  'giant-spiders': {
    id: 'giant-spiders',
    name: 'Giant Spiders',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 70,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 50,
      discipline: 30,
    },
    moves: 2,
    skill: 20,
    upkeep: {},
    abilities: [{ type: 'poison', strength: 1 }],
    description:
      'A nest-cluster of oversized spiders whose bite weakens anything it does not ' +
      'kill outright. A small, early threat to unwary scouts.',
  },
  'wolf-pack': {
    id: 'wolf-pack',
    name: 'Wolf Pack',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 90,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 45,
      discipline: 30,
    },
    moves: 3,
    skill: 22,
    upkeep: {},
    abilities: [{ type: 'pack-hunter' }],
    description:
      'A lean wild wolf-pack that circles and flanks with unnerving coordination.',
  },
  'ogre-brute': {
    id: 'ogre-brute',
    name: 'Ogre Brute',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 55,
      hits: 10,
      melee: { attack: 6, damage: 5, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 3,
      morale: 55,
      discipline: 30,
    },
    moves: 1,
    skill: 24,
    upkeep: {},
    abilities: [],
    description:
      'A solitary ogre swinging a tree-trunk club, brute force with no tactics to ' +
      'speak of. A mid-tier lair threat that punishes a thin line.',
  },
  wyvern: {
    id: 'wyvern',
    name: 'Wyvern',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 1,
      hits: 35,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 4,
      mass: 2,
      morale: 60,
      discipline: 35,
    },
    moves: 3,
    skill: 28,
    upkeep: {},
    abilities: [{ type: 'flying' }, { type: 'poison', strength: 2 }],
    description:
      'A venomous-tailed wyvern that strikes from the air and lets its poison ' +
      'finish the job.',
  },
  'hill-giant': {
    id: 'hill-giant',
    name: 'Hill Giant',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 1,
      hits: 50,
      melee: { attack: 8, damage: 7, reach: 1 },
      armor: 3,
      speed: 2,
      mass: 5,
      morale: 65,
      discipline: 35,
    },
    moves: 1,
    skill: 30,
    upkeep: {},
    abilities: [{ type: 'trample' }],
    description:
      'A lumbering hill giant that flattens shield walls simply by walking through ' +
      'them. A strong-tier lair guardian.',
  },
  'elder-dragon': {
    id: 'elder-dragon',
    name: 'Elder Dragon',
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures: 1,
      hits: 90,
      melee: { attack: 12, damage: 10, reach: 1 },
      armor: 7,
      speed: 3,
      mass: 6,
      morale: 90,
      discipline: 80,
    },
    moves: 2,
    skill: 60,
    upkeep: {},
    abilities: [
      { type: 'breath-weapon', damage: 15, range: 4, cooldown: 3 },
      { type: 'fear', radius: 4 },
    ],
    description:
      'An ancient dragon squatting atop its hoard — the endgame lair guardian. A ' +
      'single breath ends formations, and its roar alone can break an army before ' +
      'the fight even begins.',
  },
};
