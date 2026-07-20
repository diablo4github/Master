/**
 * Compact inline GameContent fixture for sim tests. src/data is off-limits to
 * the sim (written concurrently by other agents), so tests build their own
 * tiny content. Also provides small helpers to hand-construct controlled maps
 * and game states for deterministic, hand-computable assertions.
 *
 * NOT a test file (no `.test.ts`), so vitest never runs it; tsc still
 * typechecks it. It imports only from ../types and sibling sim modules — never
 * from src/data, render, or ui.
 */

import type {
  BuildingDef,
  PlaneDef,
  RaceDef,
  StudyDef,
  UnitDef,
  CityState,
  UnitState,
} from '../types';
import type { GameContent, GameState, PlayerState } from '../core/state';
import type { PlaneMap, Tile, TerrainId } from '../map/tiles';
import { xyToIndex } from '../map/tiles';

// --- Planes ---------------------------------------------------------------

export const MERIDIA: PlaneDef = {
  id: 'meridia',
  name: 'Meridia',
  kind: 'world',
  thrivingSchools: ['chaos', 'nature', 'sorcery'],
  description: 'The normal world.',
};

export const UMBRA: PlaneDef = {
  id: 'umbra',
  name: 'Umbra',
  kind: 'world',
  thrivingSchools: ['death'],
  description: 'The dark world.',
};

export const FIXTURE_PLANES: PlaneDef[] = [MERIDIA, UMBRA];

// --- Races ----------------------------------------------------------------

const ORC: RaceDef = {
  id: 'orc',
  name: 'Orc',
  homeWorld: 'meridia',
  generic: true,
  growthRate: 1.0,
  yields: { food: 1, production: 1, gold: 1, research: 1, mana: 1 },
  buildings: ['granary', 'workshop', 'foundry', 'barracks', 'wizard-tower'],
  studies: ['arcane-arts', 'war-drums', 'fertility-rites', 'gold-magic'],
  cityNames: ['Grimfang', 'Bloodrock', 'Skullcleft', 'Ironmaw', 'Ashgut'],
  description: 'The generic baseline race.',
};

const HUMAN: RaceDef = {
  id: 'human',
  name: 'Human',
  homeWorld: 'meridia',
  growthRate: 1.2,
  yields: { food: 1, production: 1, gold: 1, research: 1.5, mana: 1.5 },
  schoolAffinity: 'life',
  buildings: ['granary', 'workshop', 'foundry', 'barracks', 'wizard-tower', 'grand-cathedral'],
  studies: ['arcane-arts', 'fertility-rites', 'gold-magic'],
  cityNames: ['Dawnholt', 'Silverford', 'Highmarch', 'Kingsreach', 'Elmvale'],
  description: 'Life-leaning temple builders.',
};

// --- Buildings (incl. a requires-chain and a study-gated one) --------------

const BUILDINGS: BuildingDef[] = [
  {
    id: 'granary',
    name: 'Granary',
    tier: 1,
    cost: 20,
    upkeep: 1,
    effects: { yields: { food: 2 }, housing: 4 },
    description: 'Stores food; raises housing.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    tier: 1,
    cost: 20,
    upkeep: 1,
    effects: { yields: { production: 2 } },
    description: 'Basic production.',
  },
  {
    id: 'foundry',
    name: 'Foundry',
    tier: 2,
    requires: 'workshop',
    cost: 40,
    upkeep: 2,
    effects: { yieldMultipliers: { production: 1.5 } },
    description: 'Multiplies production. Requires a workshop.',
  },
  {
    id: 'barracks',
    name: 'Barracks',
    tier: 1,
    cost: 30,
    upkeep: 1,
    effects: { defenseBonus: 2 },
    description: 'Trains and defends troops.',
  },
  {
    id: 'wizard-tower',
    name: 'Wizard Tower',
    tier: 2,
    cost: 50,
    upkeep: 2,
    effects: { yields: { research: 3, mana: 2 } },
    description: 'Arcane research. Unlocked by the Arcane Arts study.',
  },
  {
    id: 'grand-cathedral',
    name: 'Grand Cathedral',
    tier: 3,
    cost: 80,
    upkeep: 3,
    effects: { yields: { mana: 4 }, unrestReduction: 2 },
    description: 'A monumental human temple.',
  },
];

// --- Units (generic + racial + a summon; incl. a study-gated racial unit) --

const UNITS: UnitDef[] = [
  {
    id: 'settler',
    name: 'Settler',
    role: 'settler',
    origin: { generic: true },
    cost: 15,
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
    skill: 10,
    upkeep: { food: 1 },
    abilities: [],
    description: 'Founds new cities.',
  },
  {
    id: 'militia',
    name: 'Militia',
    role: 'infantry',
    origin: { generic: true },
    cost: 10,
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
    skill: 20,
    upkeep: { gold: 1 },
    abilities: [],
    description: 'Generic town guard.',
  },
  {
    id: 'orc-warrior',
    name: 'Orc Warrior',
    role: 'infantry',
    origin: { race: 'orc' },
    cost: 20,
    combat: {
      figures: 6,
      hits: 3,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 1,
      morale: 55,
      discipline: 45,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 1 },
    abilities: [],
    description: 'Orc line infantry. Unlocked by War Drums.',
  },
  {
    id: 'fire-elemental',
    name: 'Fire Elemental',
    role: 'summon',
    origin: { school: 'chaos' },
    combat: {
      figures: 1,
      hits: 8,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 3,
      speed: 2,
      mass: 3,
      morale: 100,
      discipline: 100,
    },
    moves: 2,
    skill: 0,
    upkeep: { mana: 2 },
    summonCost: 40,
    abilities: [{ type: 'fearless' }],
    description: 'A Chaos summon — not trainable in a city.',
  },
];

// --- Studies (4, incl. a requires-chain, unlocksBuildings, unlocksUnits) ---

const STUDIES: StudyDef[] = [
  {
    id: 'arcane-arts',
    name: 'Arcane Arts',
    cost: 30,
    effects: {
      unlocksBuildings: ['wizard-tower'],
      cityEffects: { yields: { research: 1 } },
    },
    description: 'Opens arcane construction.',
  },
  {
    id: 'war-drums',
    name: 'War Drums',
    cost: 20,
    effects: { unlocksUnits: ['orc-warrior'] },
    description: 'Trains orc line infantry.',
  },
  {
    id: 'fertility-rites',
    name: 'Fertility Rites',
    cost: 25,
    requires: ['arcane-arts'],
    effects: { cityEffects: { growthBonus: 0.5, yieldMultipliers: { food: 1.25 } } },
    description: 'Empire-wide growth. Requires Arcane Arts.',
  },
  {
    id: 'gold-magic',
    name: 'Gold Magic',
    cost: 40,
    effects: { cityEffects: { yieldMultipliers: { gold: 2 } } },
    description: 'Doubles city gold.',
  },
];

function byId<T extends { id: string }>(defs: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const d of defs) out[d.id] = d;
  return out;
}

/** The shared content fixture. */
export const CONTENT: GameContent = {
  planes: FIXTURE_PLANES,
  races: { orc: ORC, human: HUMAN },
  buildings: byId(BUILDINGS),
  units: byId(UNITS),
  studies: byId(STUDIES),
};

// --- Map / state construction helpers -------------------------------------

/** A rectangular map filled with one terrain (elevation 1 land by default). */
export function makeMap(
  plane: PlaneMap['plane'],
  width: number,
  height: number,
  terrain: TerrainId = 'grassland',
): PlaneMap {
  const tiles: Tile[] = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ terrain, elevation: terrain === 'ocean' || terrain === 'shore' ? 0 : 1 });
  }
  return { plane, width, height, tiles };
}

/** Sets a single tile's terrain (and a matching elevation) on a map. */
export function setTerrain(map: PlaneMap, x: number, y: number, terrain: TerrainId): void {
  const t = map.tiles[xyToIndex(x, y, map.width)] as Tile;
  t.terrain = terrain;
  if (terrain === 'ocean' || terrain === 'shore') t.elevation = 0;
  else if (terrain === 'mountains') t.elevation = 3;
  else t.elevation = 1;
}

let playerCounter = 0;

/** A minimal player state with the given race, gold/mana at defaults. */
export function makePlayer(id: string, raceId: string): PlayerState {
  return {
    id,
    setup: {
      wizardId: `wiz-${playerCounter++}`,
      retorts: [],
      startWorld: 'meridia',
      raceId,
      human: true,
    },
    mana: 20,
    gold: 100,
    knownSpells: [],
    research: { activeStudyId: null, progress: 0 },
    completedStudies: [],
  };
}

/** A controlled GameState with the supplied maps, players, cities, and units. */
export function makeState(opts: {
  maps: PlaneMap[];
  players: PlayerState[];
  cities?: CityState[];
  units?: UnitState[];
  armyOrders?: GameState['armyOrders'];
  lairs?: GameState['lairs'];
  battles?: GameState['battles'];
  nextEntityId?: number;
  nextBattleId?: number;
}): GameState {
  const maps: GameState['maps'] = {} as GameState['maps'];
  for (const m of opts.maps) maps[m.plane] = m;
  return {
    settings: {
      seed: 1,
      mapSize: 'small',
      players: opts.players.map((p) => p.setup),
    },
    turn: 1,
    rngState: { a: 1, b: 2, c: 3, d: 4 },
    maps,
    players: opts.players,
    cities: opts.cities ?? [],
    units: opts.units ?? [],
    armyOrders: opts.armyOrders ?? {},
    lairs: opts.lairs ?? [],
    battles: opts.battles ?? [],
    nextEntityId: opts.nextEntityId ?? 1,
    nextBattleId: opts.nextBattleId ?? 1,
  };
}

/** A basic city on a plane. */
export function makeCity(over: Partial<CityState> & Pick<CityState, 'owner' | 'raceId'>): CityState {
  return {
    id: over.id ?? 'city-1',
    owner: over.owner,
    name: over.name ?? 'Testburg',
    raceId: over.raceId,
    plane: over.plane ?? 'meridia',
    x: over.x ?? 5,
    y: over.y ?? 5,
    population: over.population ?? 3,
    growthProgress: over.growthProgress ?? 0,
    buildings: over.buildings ?? [],
    buildQueue: over.buildQueue ?? [],
  };
}
