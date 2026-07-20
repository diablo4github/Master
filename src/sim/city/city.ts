/**
 * City economy: yields, growth, construction, and founding.
 *
 * Pure, deterministic, headless. Reads content injected via GameContent; never
 * imports src/data. `computeCityYields` is a pure read; the tick/found helpers
 * mutate a city or the game state that is passed in (the turn/command layer
 * passes a fresh clone, never the caller's live state).
 */

import type { CityState, UnitState, YieldBundle, YieldKey, BuildOrder, RaceDef, PlaneId } from '../types';
import type { GameState, GameContent } from '../core/state';
import type { TerrainId } from '../map/tiles';
import { getTile, neighbors } from '../map/tiles';
import { isPassable } from '../units/units';

// ---------------------------------------------------------------------------
// Economy constants
// ---------------------------------------------------------------------------

/** Yield each population point produces before race multipliers and bonuses. */
export const BASE_YIELD_PER_POP: YieldBundle = {
  food: 2,
  production: 2,
  gold: 2,
  research: 1,
  mana: 0.5,
};

/** Food consumed per population point per turn. */
export const FOOD_PER_POP = 1;

/** Base population a city can hold before housing from buildings/studies. */
export const BASE_HOUSING = 10;

/** Growth threshold to reach the next population point = BASE + PER_POP * pop. */
export const GROWTH_THRESHOLD_BASE = 10;
export const GROWTH_THRESHOLD_PER_POP = 2;

/** Population a freshly founded capital starts at. */
export const CAPITAL_START_POP = 3;

/** Minimum spacing (Chebyshev, same plane) between city centers. */
export const MIN_CITY_SPACING = 3;

export const YIELD_KEYS: readonly YieldKey[] = ['food', 'production', 'gold', 'research', 'mana'];

/**
 * Terrain yield contributions. Each of the 8 tiles around a city adds these
 * small per-turn bonuses. Every one of the 30 terrain ids appears exactly
 * once. Themes: grasslands feed, forests/hills/volcanic terrain build,
 * arcane/luminous terrain leans mana/research.
 */
export const TERRAIN_YIELDS: Record<TerrainId, Partial<YieldBundle>> = {
  // Universal water
  ocean: { food: 1 },
  shore: { food: 1, gold: 1 },
  // Meridia
  grassland: { food: 1 },
  forest: { production: 1 },
  hills: { production: 1 },
  mountains: { production: 1, mana: 0.5 },
  desert: { gold: 1 },
  swamp: { mana: 1 },
  tundra: { production: 0.5 },
  // Umbra
  'ashen-waste': { production: 0.5, mana: 0.5 },
  bonefield: { mana: 1 },
  'gloom-forest': { production: 1, mana: 0.5 },
  // Lumina
  'radiant-plain': { food: 1, research: 0.5 },
  'crystal-forest': { research: 1, mana: 0.5 },
  'aurora-peaks': { mana: 1, research: 0.5 },
  // Empyrean (Life)
  'cloud-shoal': { food: 1, mana: 0.5 },
  'gilded-reef': { gold: 1, mana: 0.5 },
  'sanctum-spire': { mana: 1, research: 1 },
  // Charnel Deep (Death)
  'bone-marsh': { mana: 1 },
  'blood-fen': { mana: 1, food: 0.5 },
  blackspire: { mana: 1, production: 0.5 },
  // Maelstrom (Chaos)
  'cinder-flat': { production: 1 },
  'magma-field': { production: 1, mana: 0.5 },
  'brimstone-spire': { production: 1, mana: 1 },
  // Wildroot (Nature)
  'vine-tangle': { food: 1, production: 0.5 },
  mossmire: { food: 1, mana: 0.5 },
  'canopy-spire': { production: 1, mana: 0.5 },
  // Aether (Sorcery)
  'mirror-flat': { research: 1 },
  'prism-shard': { research: 1, mana: 0.5 },
  'starlit-void': { mana: 1, research: 1 },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyBundle(): YieldBundle {
  return { food: 0, production: 0, gold: 0, research: 0, mana: 0 };
}

function requireRace(content: GameContent, raceId: string): RaceDef {
  const race = content.races[raceId];
  if (!race) throw new Error(`Unknown race '${raceId}'`);
  return race;
}

/** The completed studies of a city's owning player. */
function ownerCompletedStudies(state: GameState, ownerId: string): readonly string[] {
  const player = state.players.find((p) => p.id === ownerId);
  return player ? player.completedStudies : [];
}

function addPartial(target: YieldBundle, partial: Partial<YieldBundle> | undefined): void {
  if (!partial) return;
  for (const key of YIELD_KEYS) {
    const v = partial[key];
    if (typeof v === 'number') target[key] += v;
  }
}

function multiplyPartial(target: YieldBundle, partial: Partial<YieldBundle> | undefined): void {
  if (!partial) return;
  for (const key of YIELD_KEYS) {
    const v = partial[key];
    if (typeof v === 'number') target[key] *= v;
  }
}

// ---------------------------------------------------------------------------
// Yields
// ---------------------------------------------------------------------------

/**
 * The per-turn yields a city produces. Model, in order:
 *   1. base: population * BASE_YIELD_PER_POP, each axis scaled by the race's
 *      yield multiplier.
 *   2. terrain: small bonuses from the 8 tiles around the city.
 *   3. flats: building flat yields + empire-wide completed-study flat yields.
 *   4. multipliers: building yieldMultipliers * study yieldMultipliers.
 * Flats are fully summed before any multiplier is applied. Each axis is
 * floored once at the very end.
 */
export function computeCityYields(state: GameState, content: GameContent, city: CityState): YieldBundle {
  const race = requireRace(content, city.raceId);
  const map = state.maps[city.plane];
  if (!map) throw new Error(`No map for plane '${city.plane}'`);

  const flat = emptyBundle();

  // 1. Base from population, scaled by race yield multipliers.
  for (const key of YIELD_KEYS) {
    flat[key] += city.population * BASE_YIELD_PER_POP[key] * race.yields[key];
  }

  // 2. Terrain contribution from the 8 surrounding tiles.
  for (const n of neighbors(city.x, city.y, map.width, map.height)) {
    const tile = getTile(map, n.x, n.y);
    if (tile) addPartial(flat, TERRAIN_YIELDS[tile.terrain]);
  }

  // Prepare multipliers (start at identity).
  const mult: YieldBundle = { food: 1, production: 1, gold: 1, research: 1, mana: 1 };

  // 3a. Building flat yields.
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b) addPartial(flat, b.effects.yields);
  }

  // 3b. Empire-wide completed-study flat yields.
  const completed = ownerCompletedStudies(state, city.owner);
  for (const sId of completed) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects) addPartial(flat, s.effects.cityEffects.yields);
  }

  // 4a. Building multipliers.
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b) multiplyPartial(mult, b.effects.yieldMultipliers);
  }

  // 4b. Study multipliers.
  for (const sId of completed) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects) multiplyPartial(mult, s.effects.cityEffects.yieldMultipliers);
  }

  const out = emptyBundle();
  for (const key of YIELD_KEYS) {
    out[key] = Math.floor(flat[key] * mult[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Housing, growth bonus
// ---------------------------------------------------------------------------

/** Total extra housing this city has from buildings + completed studies. */
export function cityHousing(state: GameState, content: GameContent, city: CityState): number {
  let housing = 0;
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b?.effects.housing) housing += b.effects.housing;
  }
  for (const sId of ownerCompletedStudies(state, city.owner)) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects?.housing) housing += s.effects.cityEffects.housing;
  }
  return housing;
}

/** Maximum population this city may grow to. */
export function cityPopulationCap(state: GameState, content: GameContent, city: CityState): number {
  return BASE_HOUSING + cityHousing(state, content, city);
}

/** Additive growth-rate bonus from buildings + completed studies (0.1 = +10%). */
function cityGrowthBonus(state: GameState, content: GameContent, city: CityState): number {
  let bonus = 0;
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b?.effects.growthBonus) bonus += b.effects.growthBonus;
  }
  for (const sId of ownerCompletedStudies(state, city.owner)) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects?.growthBonus) bonus += s.effects.cityEffects.growthBonus;
  }
  return bonus;
}

export function growthThreshold(population: number): number {
  return GROWTH_THRESHOLD_BASE + GROWTH_THRESHOLD_PER_POP * population;
}

// ---------------------------------------------------------------------------
// Growth / starvation tick
// ---------------------------------------------------------------------------

/**
 * Applies one turn of growth or starvation to a city, mutating it in place.
 * `foodYield` is the city's already-computed food yield for the turn.
 *
 * Surplus (food - population upkeep) accumulates into growthProgress, scaled
 * by (race.growthRate + building/study growth bonus). Crossing the threshold
 * (GROWTH_THRESHOLD_BASE + PER_POP*pop) adds a population point and carries
 * the overflow. Growth halts at the population cap. A negative surplus drains
 * progress; draining below zero costs one population point (never below 1).
 */
export function tickGrowth(
  state: GameState,
  content: GameContent,
  city: CityState,
  foodYield: number,
): void {
  const race = requireRace(content, city.raceId);
  const cap = cityPopulationCap(state, content, city);
  const surplus = foodYield - city.population * FOOD_PER_POP;

  if (surplus >= 0) {
    if (city.population >= cap) {
      // At capacity: stockpile nothing, hold steady.
      city.growthProgress = 0;
      return;
    }
    const speed = race.growthRate + cityGrowthBonus(state, content, city);
    city.growthProgress += surplus * speed;
    let threshold = growthThreshold(city.population);
    while (city.growthProgress >= threshold && city.population < cap) {
      city.growthProgress -= threshold;
      city.population += 1;
      threshold = growthThreshold(city.population);
    }
    if (city.population >= cap) city.growthProgress = 0;
  } else {
    // Starvation: drain (unscaled — hunger doesn't care about growth rate).
    city.growthProgress += surplus;
    if (city.growthProgress < 0) {
      if (city.population > 1) city.population -= 1;
      city.growthProgress = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Buildability
// ---------------------------------------------------------------------------

/** Studies in this race's tech tree that unlock the given building id. */
function racialBuildingGates(content: GameContent, race: RaceDef, buildingId: string): string[] {
  return race.studies.filter((sid) => content.studies[sid]?.effects.unlocksBuildings?.includes(buildingId));
}

/** Studies in this race's tech tree that unlock the given unit id. */
function racialUnitGates(content: GameContent, race: RaceDef, unitId: string): string[] {
  return race.studies.filter((sid) => content.studies[sid]?.effects.unlocksUnits?.includes(unitId));
}

/**
 * Returns a human-readable reason the given order cannot be built in this
 * city, or null if it is buildable. Used both for boolean checks and to
 * surface clear error messages to the command layer.
 */
export function buildBlockReason(
  state: GameState,
  content: GameContent,
  city: CityState,
  kind: 'building' | 'unit',
  id: string,
): string | null {
  const race = requireRace(content, city.raceId);
  const completed = ownerCompletedStudies(state, city.owner);

  if (kind === 'building') {
    const def = content.buildings[id];
    if (!def) return `Unknown building '${id}'`;
    if (!race.buildings.includes(id)) return `${race.name} cannot build '${def.name}'`;
    if (city.buildings.includes(id)) return `'${def.name}' is already built in ${city.name}`;
    if (def.requires && !city.buildings.includes(def.requires)) {
      const req = content.buildings[def.requires];
      return `'${def.name}' requires '${req ? req.name : def.requires}' first`;
    }
    const gates = racialBuildingGates(content, race, id);
    if (gates.length > 0 && !gates.some((g) => completed.includes(g))) {
      return `'${def.name}' is locked until its enabling study is researched`;
    }
    return null;
  }

  // kind === 'unit'
  const def = content.units[id];
  if (!def) return `Unknown unit '${id}'`;
  if (def.role === 'summon' || 'school' in def.origin) {
    return `'${def.name}' is a summon and cannot be trained in a city`;
  }
  const originOk = 'generic' in def.origin || ('race' in def.origin && def.origin.race === city.raceId);
  if (!originOk) return `${race.name} cannot train '${def.name}'`;
  const gates = racialUnitGates(content, race, id);
  if (gates.length > 0 && !gates.some((g) => completed.includes(g))) {
    return `'${def.name}' is locked until its enabling study is researched`;
  }
  return null;
}

/**
 * Whether the given id (building or unit) can currently be built in the city.
 * Kind is inferred: an id present in content.buildings is treated as a
 * building, otherwise as a unit.
 */
export function canBuild(state: GameState, content: GameContent, city: CityState, id: string): boolean {
  const kind: 'building' | 'unit' = content.buildings[id] ? 'building' : 'unit';
  return buildBlockReason(state, content, city, kind, id) === null;
}

// ---------------------------------------------------------------------------
// Production tick
// ---------------------------------------------------------------------------

function orderCost(content: GameContent, order: BuildOrder): number {
  if (order.kind === 'building') return content.buildings[order.id]?.cost ?? Infinity;
  return content.units[order.id]?.cost ?? Infinity;
}

/**
 * Applies one turn of production to the front of a city's build queue,
 * mutating the city (and, on unit completion, spawning a unit into `state`).
 * `productionYield` is the city's already-computed production for the turn.
 * On completion a building is appended to city.buildings, a unit is spawned on
 * the city tile with full moves/hp, the order is removed, and any overflow
 * production carries to the next order (queue is length-1 this milestone, so
 * overflow is effectively discarded when the queue empties).
 */
export function tickProduction(
  state: GameState,
  content: GameContent,
  city: CityState,
  productionYield: number,
): void {
  if (city.buildQueue.length === 0) return;
  let carry = productionYield;

  while (city.buildQueue.length > 0 && carry > 0) {
    const order = city.buildQueue[0] as BuildOrder;
    order.progress += carry;
    const cost = orderCost(content, order);
    if (order.progress < cost) return; // still building

    // Completed. Compute overflow, remove order, apply effect.
    carry = order.progress - cost;
    city.buildQueue.shift();

    if (order.kind === 'building') {
      if (!city.buildings.includes(order.id)) city.buildings.push(order.id);
    } else {
      const def = content.units[order.id];
      if (def) {
        spawnUnit(state, content, city.owner, order.id, city.plane, city.x, city.y);
      }
    }
    // Loop: any overflow may progress the next order (none this milestone).
  }
}

// ---------------------------------------------------------------------------
// Unit spawning & city founding
// ---------------------------------------------------------------------------

/** Mints the next entity id from the deterministic, never-reused counter. */
export function mintEntityId(state: GameState, prefix: 'city' | 'unit'): string {
  const id = `${prefix}-${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}

/** Spawns a unit onto the map with full moves and hp, appending it to state. */
export function spawnUnit(
  state: GameState,
  content: GameContent,
  owner: string,
  defId: string,
  plane: PlaneId,
  x: number,
  y: number,
): UnitState {
  const def = content.units[defId];
  if (!def) throw new Error(`Unknown unit '${defId}'`);
  const unit: UnitState = {
    id: mintEntityId(state, 'unit'),
    owner,
    defId,
    plane,
    x,
    y,
    moves: def.moves,
    hp: def.hits,
  };
  state.units.push(unit);
  return unit;
}

/**
 * Founds a city, validating the site: it must be passable land (not ocean,
 * shore, or a peak-tier tile) and no existing city may lie within
 * MIN_CITY_SPACING (Chebyshev) on the same plane. Throws Error with a clear
 * message on any violation. On success a CityState is created (population
 * CAPITAL start unless overridden by the caller — here it starts at 1 for a
 * settled town; the capital path passes its own population) and appended.
 */
export function foundCity(
  state: GameState,
  content: GameContent,
  ownerId: string,
  raceId: string,
  plane: PlaneId,
  x: number,
  y: number,
  name: string,
  population = 1,
): CityState {
  requireRace(content, raceId);
  const map = state.maps[plane];
  if (!map) throw new Error(`No map for plane '${plane}'`);
  const tile = getTile(map, x, y);
  if (!tile) throw new Error(`Cannot found city: (${x}, ${y}) is out of bounds on ${plane}`);
  if (!isPassable(map, x, y)) throw new Error(`Cannot found city on water at (${x}, ${y})`);
  if (tile.elevation === 3) throw new Error(`Cannot found city on peak terrain at (${x}, ${y})`);

  for (const other of state.cities) {
    if (other.plane !== plane) continue;
    if (Math.max(Math.abs(other.x - x), Math.abs(other.y - y)) < MIN_CITY_SPACING) {
      throw new Error(`Too close to ${other.name}: cities must be ${MIN_CITY_SPACING}+ tiles apart`);
    }
  }

  const city: CityState = {
    id: mintEntityId(state, 'city'),
    owner: ownerId,
    name,
    raceId,
    plane,
    x,
    y,
    population,
    growthProgress: 0,
    buildings: [],
    buildQueue: [],
  };
  state.cities.push(city);
  return city;
}
