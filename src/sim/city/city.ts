/**
 * City economy: yields, growth, construction, and founding.
 *
 * Pure, deterministic, headless. Reads content injected via GameContent; never
 * imports src/data. `computeCityYields` is a pure read; the tick/found helpers
 * mutate a city or the game state that is passed in (the turn/command layer
 * passes a fresh clone, never the caller's live state).
 */

import type { CityState, UnitState, UnitDef, YieldBundle, YieldKey, BuildOrder, RaceDef, PlaneId } from '../types';
import type { GameState, GameContent } from '../core/state';
import type { TerrainId } from '../map/tiles';
import { getTile, inBounds, xyToIndex } from '../map/tiles';
import { isPassable, chebyshev } from '../units/units';

// ---------------------------------------------------------------------------
// Economy constants
// ---------------------------------------------------------------------------

/**
 * Civic yield every population point contributes REGARDLESS of terrain — taxes
 * and scholars. This is why research is never terrain-bound: a city on barren
 * rock still researches through its people. Terrain drives food/production/
 * gold/mana; population drives research (and a little gold).
 */
export const CIVIC_YIELD_PER_POP: Readonly<Pick<YieldBundle, 'research' | 'gold'>> = {
  research: 1,
  gold: 0.5,
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

/**
 * Catchment reach: a city works tiles within this Chebyshev radius of its
 * center — the 5x5 block (radius 2). Each tile belongs to at most ONE city.
 */
export const CATCHMENT_RADIUS = 2;

export const YIELD_KEYS: readonly YieldKey[] = ['food', 'production', 'gold', 'research', 'mana'];

/**
 * The primary economy: what one worked tile of each terrain yields per turn.
 * Every one of the 30 terrain ids appears exactly once. These are consumed by
 * the worked-tile model (see `workedTiles`) — a city's population works the
 * best tiles of its catchment, so terrain is now the dominant lever on a
 * city's ceiling (a grassland basin out-eats a tundra site roughly 2:1+).
 *
 * Themes:
 *  - Meridia (normal world): grassland feeds, forest/hills/mountains build,
 *    desert trades, swamp/mountains trickle mana, tundra is sparse.
 *  - Umbra (dark world): mana-rich, food-poor.
 *  - Lumina (light world): food-and-mana, some research.
 *  - Water: `shore` is workable (fishing) even though land units can't stand on
 *    it; `ocean` is workable but yields nothing.
 *  - School dimensions: exotic and rich, but no city can be founded there yet.
 */
export const TERRAIN_YIELDS: Record<TerrainId, Partial<YieldBundle>> = {
  // Universal water — shore fishes, open ocean gives nothing.
  ocean: {},
  shore: { food: 1.5, gold: 0.5 },
  // Meridia (normal world)
  grassland: { food: 2 },
  forest: { food: 1, production: 1 },
  hills: { production: 2 },
  mountains: { production: 2, mana: 0.5 },
  desert: { gold: 1.5 },
  swamp: { food: 1, mana: 0.5 },
  tundra: { food: 0.5, production: 0.5 },
  // Umbra (dark world) — mana-rich, food-poor.
  'ashen-waste': { production: 1, mana: 0.5 },
  bonefield: { gold: 0.5, mana: 1.5 },
  'gloom-forest': { production: 1, mana: 1 },
  // Lumina (light world) — food and mana, a little research.
  'radiant-plain': { food: 2, mana: 0.5 },
  'crystal-forest': { food: 1, research: 1, mana: 0.5 },
  'aurora-peaks': { research: 1, mana: 1.5 },
  // Empyrean (Life dimension) — rich.
  'cloud-shoal': { food: 2, mana: 1 },
  'gilded-reef': { food: 1, gold: 2, mana: 1 },
  'sanctum-spire': { research: 2, mana: 2 },
  // Charnel Deep (Death dimension) — rich, mana-leaning.
  'bone-marsh': { food: 0.5, mana: 2 },
  'blood-fen': { food: 1, mana: 2 },
  blackspire: { production: 1, mana: 2 },
  // Maelstrom (Chaos dimension) — rich production.
  'cinder-flat': { production: 2 },
  'magma-field': { production: 2, mana: 1 },
  'brimstone-spire': { production: 2, mana: 2 },
  // Wildroot (Nature dimension) — rich food.
  'vine-tangle': { food: 2, production: 1 },
  mossmire: { food: 2, mana: 1 },
  'canopy-spire': { food: 1, production: 2, mana: 1 },
  // Aether (Sorcery dimension) — rich research/mana.
  'mirror-flat': { research: 2 },
  'prism-shard': { research: 2, mana: 1 },
  'starlit-void': { research: 2, mana: 2 },
};

/**
 * Weights turning a tile's yield bundle into a single desirability score, used
 * to rank which tiles a city's population works first (best-first). Food is
 * prized highest — it feeds the very workers doing the working and drives
 * growth — then production (builds the empire), then the softer axes. Because
 * food dominates, a city naturally assigns its people to eat first, then spill
 * onto production/gold/mana tiles once its food tiles are taken. Ties are
 * broken by tile index for full determinism (see `workedTiles`).
 */
export const DESIRABILITY_WEIGHTS: YieldBundle = {
  food: 4,
  production: 3,
  gold: 2,
  research: 2,
  mana: 2,
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

/** A tile in a city's catchment, with its precomputed yields and ranking keys. */
interface WorkTile {
  x: number;
  y: number;
  terrain: TerrainId;
  /** Raw terrain food (pre-multiplier) — the growth-relevant axis. */
  food: number;
  /** Desirability score (see DESIRABILITY_WEIGHTS) for best-first assignment. */
  desirability: number;
  /** Row-major tile index — the final, total tie-breaker. */
  index: number;
}

/** Weighted desirability of a raw terrain yield bundle. */
function tileDesirability(y: Partial<YieldBundle>): number {
  let score = 0;
  for (const key of YIELD_KEYS) score += (y[key] ?? 0) * DESIRABILITY_WEIGHTS[key];
  return score;
}

/**
 * Which city (id) owns the tile (x, y) on a plane, or null if unclaimed.
 * Ownership is deterministic:
 *   1. A city standing exactly on the tile always owns it (its own center).
 *   2. Otherwise the EARLIEST city in `state.cities` whose catchment (Chebyshev
 *      radius CATCHMENT_RADIUS) reaches the tile claims it — earlier-founded
 *      cities win overlap disputes.
 */
function tileOwner(state: GameState, plane: PlaneId, x: number, y: number): string | null {
  for (const c of state.cities) {
    if (c.plane === plane && c.x === x && c.y === y) return c.id;
  }
  for (const c of state.cities) {
    if (c.plane !== plane) continue;
    if (chebyshev(c.x, c.y, x, y) <= CATCHMENT_RADIUS) return c.id;
  }
  return null;
}

/**
 * The tiles a city actually owns and may work: the in-bounds tiles of its 5x5
 * catchment (Chebyshev radius CATCHMENT_RADIUS) that no earlier city has
 * claimed. A city always owns its own center. Exported for the UI to
 * visualize a city's reach. Pure read of `state`.
 */
export function catchmentTiles(state: GameState, city: CityState): { x: number; y: number }[] {
  const map = state.maps[city.plane];
  if (!map) return [];
  const out: { x: number; y: number }[] = [];
  for (let dy = -CATCHMENT_RADIUS; dy <= CATCHMENT_RADIUS; dy++) {
    for (let dx = -CATCHMENT_RADIUS; dx <= CATCHMENT_RADIUS; dx++) {
      const x = city.x + dx;
      const y = city.y + dy;
      if (!inBounds(x, y, map.width, map.height)) continue;
      if (tileOwner(state, city.plane, x, y) === city.id) out.push({ x, y });
    }
  }
  return out;
}

/** The owned catchment split into the (free) center tile and the rest. */
function catchmentInfo(state: GameState, city: CityState): { center: WorkTile | null; others: WorkTile[] } {
  const map = state.maps[city.plane];
  if (!map) return { center: null, others: [] };
  let center: WorkTile | null = null;
  const others: WorkTile[] = [];
  for (const { x, y } of catchmentTiles(state, city)) {
    const tile = getTile(map, x, y);
    if (!tile) continue;
    const yld = TERRAIN_YIELDS[tile.terrain] ?? {};
    const wt: WorkTile = {
      x,
      y,
      terrain: tile.terrain,
      food: yld.food ?? 0,
      desirability: tileDesirability(yld),
      index: xyToIndex(x, y, map.width),
    };
    if (x === city.x && y === city.y) center = wt;
    else others.push(wt);
  }
  return { center, others };
}

/** Owned catchment tiles ranked best-first by desirability, ties by tile index. */
function rankedByDesirability(others: readonly WorkTile[]): WorkTile[] {
  return others.slice().sort((a, b) => b.desirability - a.desirability || a.index - b.index);
}

/**
 * The tiles a city is currently working: its free center plus the best
 * `population` tiles of its catchment, chosen best-first by desirability with
 * ties broken by tile index (fully deterministic). Each population point works
 * exactly one tile; if the catchment has fewer tiles than population, the
 * surplus population works nothing (it still yields civic research/gold).
 * Exported for the UI. The `content` parameter is accepted for signature
 * stability with the rest of the city API.
 */
export function workedTiles(
  _state: GameState,
  _content: GameContent,
  city: CityState,
): { x: number; y: number }[] {
  const { center, others } = catchmentInfo(_state, city);
  const ranked = rankedByDesirability(others);
  const out: { x: number; y: number }[] = [];
  if (center) out.push({ x: center.x, y: center.y });
  const n = Math.min(city.population, ranked.length);
  for (let i = 0; i < n; i++) {
    const t = ranked[i] as WorkTile;
    out.push({ x: t.x, y: t.y });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Yields
// ---------------------------------------------------------------------------

/**
 * Applies the yield pipeline to a raw (worked-tile + civic) bundle:
 *   1. race yield multipliers scale the raw worked-tile + civic total;
 *   2. building flat yields, then completed-study flat yields, are added;
 *   3. building yieldMultipliers, then study yieldMultipliers, apply;
 *   4. each axis is floored once at the very end.
 * Flats are fully summed before any multiplier. Building/study flats are NOT
 * race-scaled (only the population's own output is).
 */
function applyYieldPipeline(
  state: GameState,
  content: GameContent,
  city: CityState,
  raw: YieldBundle,
): YieldBundle {
  const race = requireRace(content, city.raceId);
  const flat = emptyBundle();

  // 1. Race multipliers scale the population's worked-tile + civic output.
  for (const key of YIELD_KEYS) flat[key] = raw[key] * race.yields[key];

  // 2. Building then completed-study flat yields.
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b) addPartial(flat, b.effects.yields);
  }
  const completed = ownerCompletedStudies(state, city.owner);
  for (const sId of completed) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects) addPartial(flat, s.effects.cityEffects.yields);
  }

  // 3. Building then study multipliers.
  const mult: YieldBundle = { food: 1, production: 1, gold: 1, research: 1, mana: 1 };
  for (const bId of city.buildings) {
    const b = content.buildings[bId];
    if (b) multiplyPartial(mult, b.effects.yieldMultipliers);
  }
  for (const sId of completed) {
    const s = content.studies[sId];
    if (s?.effects.cityEffects) multiplyPartial(mult, s.effects.cityEffects.yieldMultipliers);
  }

  // 4. Floor each axis once.
  const out = emptyBundle();
  for (const key of YIELD_KEYS) out[key] = Math.floor(flat[key] * mult[key]);
  return out;
}

/**
 * The per-turn yields a city produces under the worked-land model:
 *   raw = sum of TERRAIN_YIELDS over the city's worked tiles (center + the best
 *         `population` catchment tiles) + civic yield (CIVIC_YIELD_PER_POP ×
 *         population — taxes/scholars, so research is never terrain-bound);
 *   then the yield pipeline (race multipliers, building/study flats, building/
 *   study multipliers, floor) is applied. See `applyYieldPipeline`.
 */
export function computeCityYields(state: GameState, content: GameContent, city: CityState): YieldBundle {
  const map = state.maps[city.plane];
  if (!map) throw new Error(`No map for plane '${city.plane}'`);
  requireRace(content, city.raceId); // validate race up front

  const raw = emptyBundle();
  for (const { x, y } of workedTiles(state, content, city)) {
    const tile = getTile(map, x, y);
    if (tile) addPartial(raw, TERRAIN_YIELDS[tile.terrain]);
  }
  // Civic yields: research and a little gold from the people themselves.
  raw.research += city.population * CIVIC_YIELD_PER_POP.research;
  raw.gold += city.population * CIVIC_YIELD_PER_POP.gold;

  return applyYieldPipeline(state, content, city, raw);
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

/**
 * The population ceiling imposed by food: the largest population whose food the
 * city's worked tiles can actually cover at current multipliers.
 *
 * Math: a city of population P works its free center plus its best P catchment
 * tiles (best-first by desirability — see `workedTiles` — which, because food
 * is the top-weighted axis, assigns people to eat first). Let food(P) be the
 * floored food that arrangement produces after the full pipeline (race
 * multiplier, building/study food flats and multipliers). Since each pop eats
 * FOOD_PER_POP (=1), P is self-feeding when food(P) >= P. The cap is the
 * largest P for which food(P') >= P' holds for every P' from 1..P (the first
 * crossover), so a city AT its cap is exactly break-even — surplus 0, no
 * growth, and no starvation thrash. Because food(P) here is computed from the
 * SAME worked-tile selection that `computeCityYields` uses, the cap and the
 * live food yield can never disagree.
 *
 * Poor land (few high-food tiles, or per-tile food below the 1/pop upkeep)
 * crosses over almost immediately and caps low and permanently; a grassland
 * basin (many food-2 tiles) caps at or above the housing limit.
 */
export function cityFoodPotentialCap(state: GameState, content: GameContent, city: CityState): number {
  const { center, others } = catchmentInfo(state, city);
  const ranked = rankedByDesirability(others);
  const centerFood = center ? center.food : 0;

  const foodAt = (p: number): number => {
    const raw = emptyBundle();
    raw.food = centerFood;
    const n = Math.min(p, ranked.length);
    for (let i = 0; i < n; i++) raw.food += (ranked[i] as WorkTile).food;
    return applyYieldPipeline(state, content, city, raw).food;
  };

  // Walk P upward from 1; stop at the first population the land can't feed.
  const hardMax = BASE_HOUSING + cityHousing(state, content, city) + ranked.length + 1;
  let cap = 1;
  for (let p = 1; p <= hardMax; p++) {
    if (foodAt(p) >= p) cap = p;
    else break;
  }
  return Math.max(1, cap);
}

/**
 * Maximum population this city may grow to: the tighter of its housing cap
 * (BASE_HOUSING + building/study housing) and its food-potential cap. Housing
 * lets a city hold people; food decides whether the land can feed them.
 */
export function cityPopulationCap(state: GameState, content: GameContent, city: CityState): number {
  const housingCap = BASE_HOUSING + cityHousing(state, content, city);
  return Math.min(housingCap, cityFoodPotentialCap(state, content, city));
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
 *
 * `opts.availableBuildings` overrides the set of building ids treated as
 * "present" when checking a building's `requires` prerequisite. The queue layer
 * passes `city.buildings` plus the building orders EARLIER in the queue, so a
 * building whose prerequisite is queued ahead of it validates at queue time.
 * Defaults to `city.buildings` (the strict, at-build-time check).
 */
export function buildBlockReason(
  state: GameState,
  content: GameContent,
  city: CityState,
  kind: 'building' | 'unit',
  id: string,
  opts?: { availableBuildings?: readonly string[] },
): string | null {
  const race = requireRace(content, city.raceId);
  const completed = ownerCompletedStudies(state, city.owner);
  const available = opts?.availableBuildings ?? city.buildings;

  if (kind === 'building') {
    const def = content.buildings[id];
    if (!def) return `Unknown building '${id}'`;
    if (!race.buildings.includes(id)) return `${race.name} cannot build '${def.name}'`;
    if (city.buildings.includes(id)) return `'${def.name}' is already built in ${city.name}`;
    if (def.requires && !available.includes(def.requires)) {
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
  // Summons and wild monsters are conjured through the (future) casting
  // interface, never queued in a city's production. School-origin units are
  // summons by construction.
  if (def.role === 'summon' || def.role === 'monster' || 'school' in def.origin) {
    return `'${def.name}' is summoned, not trained`;
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
// Production queue
// ---------------------------------------------------------------------------

/** Maximum number of orders a city may hold in its build queue. */
export const QUEUE_CAP = 7;

function orderCost(content: GameContent, order: BuildOrder): number {
  if (order.kind === 'building') return content.buildings[order.id]?.cost ?? Infinity;
  return content.units[order.id]?.cost ?? Infinity;
}

/**
 * Applies one turn of production to the front of a city's build queue,
 * mutating the city (and, on unit completion, spawning a unit into `state`).
 * `productionYield` is the city's already-computed production for the turn.
 *
 * The head is ticked; on completion a building is appended to city.buildings or
 * a unit is spawned on the city tile with full moves/hp, the order is removed,
 * and any overflow production carries to the next order (rollover). If the head
 * has become illegal since it was queued (e.g. a building whose prerequisite
 * was reordered away, or one already completed elsewhere), it is skipped with
 * no production lost — the carry rolls straight to the next order.
 */
export function tickProduction(
  state: GameState,
  content: GameContent,
  city: CityState,
  productionYield: number,
): void {
  if (city.buildQueue.length === 0) return;
  let carry = productionYield;

  while (city.buildQueue.length > 0) {
    const order = city.buildQueue[0] as BuildOrder;

    // Skip a head that can no longer legally be built (no carry consumed).
    if (buildBlockReason(state, content, city, order.kind, order.id) !== null) {
      city.buildQueue.shift();
      continue;
    }

    if (carry <= 0) return; // nothing left to invest into a legal head

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
        // Regiments have provenance: name the muster by home city and order of
        // raising ("1st Grokhaz Orc Warriors"). Record first so the ordinal
        // reflects this regiment's number.
        recordRaised(city, order.id);
        const unit = spawnUnit(state, content, city.owner, order.id, city.plane, city.x, city.y);
        unit.name = provenanceName(city, def);
      }
    }
    // Loop: any overflow may progress the next order.
  }
}

// ---------------------------------------------------------------------------
// Unit spawning & city founding
// ---------------------------------------------------------------------------

/** Mints the next entity id from the deterministic, never-reused counter. */
export function mintEntityId(state: GameState, prefix: 'city' | 'unit' | 'army'): string {
  const id = `${prefix}-${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}

// ---------------------------------------------------------------------------
// Regiment provenance ("1st Grokhaz Orc Warriors")
// ---------------------------------------------------------------------------

/**
 * English ordinal for n >= 1: 1st, 2nd, 3rd, 4th, ... with the 11th/12th/13th
 * exception ("th" despite ending in 1/2/3) and the 21st/22nd/23rd resumption.
 */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  const rem10 = n % 10;
  let suffix = 'th';
  if (rem100 < 11 || rem100 > 13) {
    if (rem10 === 1) suffix = 'st';
    else if (rem10 === 2) suffix = 'nd';
    else if (rem10 === 3) suffix = 'rd';
  }
  return `${n}${suffix}`;
}

/**
 * Records that a city has raised one more regiment of unit def `defId`,
 * lazily initializing `city.raised`, and returns the new running count (1 for
 * the first regiment of that def). The state-construction layer can call this
 * for starting units so their provenance shares the same counter.
 */
export function recordRaised(city: CityState, defId: string): number {
  if (!city.raised) city.raised = {};
  const next = (city.raised[defId] ?? 0) + 1;
  city.raised[defId] = next;
  return next;
}

/**
 * The provenance name for a regiment of `def` raised in `city`, e.g.
 * "1st Grokhaz Orc Warriors". Reads the CURRENT `raised` count for the def
 * (call `recordRaised` first), defaulting to a 1st muster if none is recorded.
 */
export function provenanceName(city: CityState, def: UnitDef): string {
  const count = city.raised?.[def.id] ?? 1;
  return `${ordinal(count)} ${city.name} ${def.name}`;
}

// ---------------------------------------------------------------------------
// City naming
// ---------------------------------------------------------------------------

const ROMAN: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Deterministic Roman numeral for n >= 1 (used for exhausted-list suffixes). */
function toRoman(n: number): string {
  let out = '';
  let rem = n;
  for (const [value, sym] of ROMAN) {
    while (rem >= value) {
      out += sym;
      rem -= value;
    }
  }
  return out;
}

/**
 * Deterministically picks the next unused city name for a race. Draws the first
 * entry of the race's themed `cityNames` list that no existing city (anywhere in
 * the game state) already carries. When the whole list is in use, falls back to
 * numbered variants of the FIRST list name — '<first> II', '<first> III', ... —
 * taking the first such variant not yet in use. Pure read of `state.cities`.
 */
export function pickCityName(state: GameState, race: RaceDef): string {
  const used = new Set(state.cities.map((c) => c.name));
  for (const name of race.cityNames) {
    if (!used.has(name)) return name;
  }
  const base = race.cityNames[0] ?? `${race.name} City`;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${toRoman(n)}`;
    if (!used.has(candidate)) return candidate;
  }
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
    hp: def.combat.figures * def.combat.hits,
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
 *
 * `name` is optional: an absent or blank name draws the next unused themed
 * name for the founding race via `pickCityName`; a supplied name is used as-is.
 */
export function foundCity(
  state: GameState,
  content: GameContent,
  ownerId: string,
  raceId: string,
  plane: PlaneId,
  x: number,
  y: number,
  name?: string,
  population = 1,
): CityState {
  const race = requireRace(content, raceId);
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

  const cityName = name && name.trim().length > 0 ? name : pickCityName(state, race);

  const city: CityState = {
    id: mintEntityId(state, 'city'),
    owner: ownerId,
    name: cityName,
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
