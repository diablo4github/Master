/**
 * Root game state and construction.
 *
 * GameState is the entire save file: plain, JSON-serializable data. Nothing
 * in here may hold a class instance, a function, or non-deterministic data.
 */

import type {
  BuildingDef,
  CityState,
  GameSettings,
  PlaneDef,
  PlaneId,
  PlayerSetup,
  RaceDef,
  StudyDef,
  UnitDef,
  UnitState,
} from '../types';
import { createRng, type Rng, type RngState } from './rng';
import { generateAllPlanes } from '../map/mapgen';
import type { PlaneMap } from '../map/tiles';
import { getTile, neighbors } from '../map/tiles';
import { isPassable, chebyshev } from '../units/units';
import { foundCity, spawnUnit, CAPITAL_START_POP } from '../city/city';
import type { BattleReport } from '../combat/events';

/** Per-player research progress toward the active magical study. */
export interface ResearchState {
  /** Study currently being researched, or null if none selected. */
  activeStudyId: string | null;
  /** Research points accumulated toward the active study. */
  progress: number;
}

/** Per-player runtime state. Grows as systems land. */
export interface PlayerState {
  id: string;
  setup: PlayerSetup;
  /** Mana pool (starts at 20). */
  mana: number;
  /** Gold treasury (starts at 100; may go negative — disbanding comes later). */
  gold: number;
  knownSpells: string[];
  research: ResearchState;
  /** Ids of magical studies this player has completed. */
  completedStudies: string[];
}

/**
 * A neutral monster lair seeded at worldgen (a Master of Magic institution).
 * `monsterIds` are unit-def ids from the injected content; `monsterHp` is a
 * parallel array of remaining hit-point pools (index-aligned), kept as flat
 * arrays so the whole state stays trivially JSON-serializable. A cleared lair
 * never triggers a battle again and has credited its loot exactly once.
 */
export interface LairState {
  id: string;
  plane: PlaneId;
  x: number;
  y: number;
  /** Def ids of the garrison monsters (origin generic, role 'monster'). */
  monsterIds: string[];
  /** Remaining hp pool per monster, parallel to monsterIds. */
  monsterHp: number[];
  loot: { gold: number; mana: number };
  cleared: boolean;
}

/**
 * A resolved battle, appended when a stack moves onto a hostile tile. Carries
 * the full replayable BattleReport so the viewer can play it back without
 * re-running the sim. `defenderPlayer` is 'neutral' for lair monsters.
 */
export interface BattleRecord {
  id: string;
  turn: number;
  plane: PlaneId;
  x: number;
  y: number;
  attackerPlayer: string | 'neutral';
  defenderPlayer: string | 'neutral';
  report: BattleReport;
  lairId?: string;
}

export interface GameState {
  settings: GameSettings;
  turn: number;
  /** Snapshot of the master Rng's state, so saves resume the exact same sequence. */
  rngState: RngState;
  maps: Record<PlaneId, PlaneMap>;
  players: PlayerState[];
  cities: CityState[];
  units: UnitState[];
  /** Neutral monster lairs seeded at worldgen. */
  lairs: LairState[];
  /** Append-only log of resolved battles (replayable reports). */
  battles: BattleRecord[];
  /**
   * Monotonic counter for minting entity ids ('city-N' / 'unit-N'). Never
   * reused, so ids are stable and deterministic across a game's lifetime.
   */
  nextEntityId: number;
  /** Monotonic counter for minting battle ids ('battle-N'). */
  nextBattleId: number;
}

/**
 * Content required to construct and run a game. Other packages (src/data)
 * supply this; the sim never imports src/data directly. Registries are keyed
 * by id; Object.keys order is treated as the authored order where it matters
 * (e.g. picking a race's default garrison unit).
 */
export interface GameContent {
  planes: PlaneDef[];
  races: Record<string, RaceDef>;
  buildings: Record<string, BuildingDef>;
  units: Record<string, UnitDef>;
  studies: Record<string, StudyDef>;
}

const START_MIN_SEPARATION = 8;

/**
 * Deterministically chooses start tiles: passable, non-peak land, at least
 * START_MIN_SEPARATION tiles from other starts on the same plane when
 * possible. Uses the forked 'start-locations' stream so map generation is
 * unaffected. Players are placed in index order.
 */
function chooseStartLocations(
  rng: Rng,
  maps: Record<PlaneId, PlaneMap>,
  setups: readonly PlayerSetup[],
): { plane: PlaneId; x: number; y: number }[] {
  const startRng = rng.fork('start-locations');
  const placed: { plane: PlaneId; x: number; y: number }[] = [];

  for (const setup of setups) {
    const plane = setup.startWorld;
    const map = maps[plane];
    if (!map) throw new Error(`No map for start world '${plane}'`);

    // Gather candidate tiles in row-major order, then shuffle deterministically.
    const candidates: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = getTile(map, x, y);
        if (!tile || tile.elevation === 3) continue;
        if (!isPassable(map, x, y)) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) throw new Error(`No valid start tile on '${plane}'`);
    const shuffled = startRng.shuffle(candidates);

    const samePlane = placed.filter((p) => p.plane === plane);
    const minDistTo = (c: { x: number; y: number }): number => {
      let best = Infinity;
      for (const p of samePlane) {
        const d = Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y));
        if (d < best) best = d;
      }
      return best;
    };

    let chosen = shuffled[0] as { x: number; y: number };
    if (samePlane.length > 0) {
      // Prefer the first (in shuffled order) tile meeting the separation goal;
      // otherwise the tile that maximizes the minimum distance to existing starts.
      let found = false;
      let bestFallback = chosen;
      let bestFallbackDist = -Infinity;
      for (const c of shuffled) {
        const d = minDistTo(c);
        if (d >= START_MIN_SEPARATION) {
          chosen = c;
          found = true;
          break;
        }
        if (d > bestFallbackDist) {
          bestFallbackDist = d;
          bestFallback = c;
        }
      }
      if (!found) chosen = bestFallback;
    }

    placed.push({ plane, x: chosen.x, y: chosen.y });
  }

  return placed;
}

/**
 * Picks a player's starting garrison unit: the first unit in content.units
 * (authored / Object.keys order) whose origin race matches the player's race,
 * else the generic 'militia'.
 */
function pickGarrisonUnitId(content: GameContent, raceId: string): string {
  for (const unitId of Object.keys(content.units)) {
    const def = content.units[unitId];
    if (def && 'race' in def.origin && def.origin.race === raceId) return unitId;
  }
  return 'militia';
}

/** Builds a fresh GameState from settings + injected content. Deterministic in `settings.seed`. */
export function createGame(settings: GameSettings, content: GameContent): GameState {
  const rng = createRng(settings.seed);

  const maps = generateAllPlanes(rng, content.planes, settings.mapSize);

  const players: PlayerState[] = settings.players.map((setup, i) => ({
    id: `player-${i}`,
    setup,
    mana: 20,
    gold: 100,
    knownSpells: [],
    research: { activeStudyId: null, progress: 0 },
    completedStudies: [],
  }));

  const state: GameState = {
    settings,
    turn: 1,
    rngState: rng.getState(),
    maps,
    players,
    cities: [],
    units: [],
    lairs: [],
    battles: [],
    nextEntityId: 1,
    nextBattleId: 1,
  };

  const starts = chooseStartLocations(rng, maps, settings.players);

  settings.players.forEach((setup, i) => {
    const player = players[i];
    if (!player) return;
    const { plane, x, y } = starts[i] as { plane: PlaneId; x: number; y: number };

    // Found the capital immediately. Passing no name auto-draws the first free
    // themed city name for the player's race (deterministic across the game).
    foundCity(state, content, player.id, setup.raceId, plane, x, y, undefined, CAPITAL_START_POP);

    // Spawn a settler on an adjacent passable, non-peak land tile (falling
    // back to the capital tile itself if the city is entirely hemmed in).
    const map = maps[plane] as PlaneMap;
    let settlerX = x;
    let settlerY = y;
    for (const n of neighbors(x, y, map.width, map.height)) {
      const tile = getTile(map, n.x, n.y);
      if (tile && tile.elevation !== 3 && isPassable(map, n.x, n.y)) {
        settlerX = n.x;
        settlerY = n.y;
        break;
      }
    }
    if (content.units['settler']) {
      spawnUnit(state, content, player.id, 'settler', plane, settlerX, settlerY);
    }

    // Spawn one garrison unit on the capital tile.
    const garrisonId = pickGarrisonUnitId(content, setup.raceId);
    if (content.units[garrisonId]) {
      spawnUnit(state, content, player.id, garrisonId, plane, x, y);
    }
  });

  seedLairs(state, content, rng, starts);

  return state;
}

// ---------------------------------------------------------------------------
// Lair seeding
// ---------------------------------------------------------------------------

/** Land tiles per lair on a full world — sparse wilderness. */
const LAIR_TILES_PER_WORLD = 180;
/** Land tiles per lair in a school dimension — denser challenge space. */
const LAIR_TILES_PER_DIMENSION = 60;
/** A lair must sit at least this far (Chebyshev) from any player start. */
const LAIR_MIN_FROM_START = 5;
/** Lairs must sit at least this far (Chebyshev) from each other. */
const LAIR_MIN_SPACING = 4;
/**
 * Garrison-tier target below which "strong" monsters (breath-weapon / fear
 * carriers) are barred from a world lair. The nearest lairs to a start have
 * tier 0, so they can never hold a dragon; dimensions ignore this (tier 1).
 */
const STRONG_TIER_FLOOR = 0.5;
/** Gaussian spread when matching a monster's power-rank to a lair's target tier. */
const TIER_SIGMA = 0.35;

/** Monster-role, generic-origin unit defs — the lair garrison pool. */
function monsterDefs(content: GameContent): UnitDef[] {
  const out: UnitDef[] = [];
  for (const id of Object.keys(content.units)) {
    const def = content.units[id];
    if (def && def.role === 'monster' && 'generic' in def.origin) out.push(def);
  }
  return out;
}

/** Rough combat strength of one monster: figures × hits × melee damage. */
function monsterPower(def: UnitDef): number {
  const c = def.combat;
  return c.figures * c.hits * c.melee.damage;
}

/** Carriers of the battle-warping abilities gate the strong tiers. */
function isStrongMonster(def: UnitDef): boolean {
  return def.abilities.some((a) => a.type === 'breath-weapon' || a.type === 'fear');
}

/**
 * Weighted monster pick: favours defs whose normalized power-rank sits near the
 * lair's target tier `t` (a Gaussian on the rank difference). Deterministic in
 * the supplied rng.
 */
function pickMonster(
  rng: Rng,
  pool: readonly UnitDef[],
  tierNorm: Map<string, number>,
  t: number,
): UnitDef {
  const weights = pool.map((d) => {
    const diff = (tierNorm.get(d.id) ?? 0) - t;
    return Math.exp(-(diff * diff) / (2 * TIER_SIGMA * TIER_SIGMA));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    if (r < (weights[i] as number)) return pool[i] as UnitDef;
    r -= weights[i] as number;
  }
  return pool[pool.length - 1] as UnitDef;
}

/**
 * Scatters monster lairs across every plane. Worlds get ~1 lair per 180 land
 * tiles; school dimensions ~1 per 60 (denser challenge spaces). Each lair sits
 * on passable, non-peak land, ≥5 Chebyshev from any player start and ≥4 from
 * any other lair. Garrisons are drawn by tier: lairs nearest a start pull from
 * the weak end of the roster and can never hold a "strong" (breath/fear)
 * monster; distant lairs and every dimension lair may. Loot scales with the
 * garrison's summed strength (gold ≈ 3–8×, mana ≈ half the gold).
 *
 * Uses the forked 'lairs' rng stream, so it never perturbs map generation or
 * start placement. No-op when the content ships no monster-role units.
 */
function seedLairs(
  state: GameState,
  content: GameContent,
  rng: Rng,
  starts: readonly { plane: PlaneId; x: number; y: number }[],
): void {
  const monsters = monsterDefs(content);
  if (monsters.length === 0) return;

  // Rank monsters weakest→strongest; ties broken by id for determinism.
  const ranked = monsters
    .slice()
    .sort((a, b) => monsterPower(a) - monsterPower(b) || (a.id < b.id ? -1 : 1));
  const tierNorm = new Map<string, number>();
  ranked.forEach((d, i) => tierNorm.set(d.id, ranked.length > 1 ? i / (ranked.length - 1) : 0));

  const lairRng = rng.fork('lairs');
  let lairCounter = 0;

  for (const planeDef of content.planes) {
    const map = state.maps[planeDef.id];
    if (!map) continue;

    const perTiles = planeDef.kind === 'dimension' ? LAIR_TILES_PER_DIMENSION : LAIR_TILES_PER_WORLD;
    const target = Math.round((map.width * map.height) / perTiles);
    if (target <= 0) continue;

    const planeStarts = starts.filter((s) => s.plane === planeDef.id);

    // Candidate tiles: passable, non-peak land far enough from every start.
    const candidates: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = getTile(map, x, y);
        if (!tile || tile.elevation === 3) continue;
        if (!isPassable(map, x, y)) continue;
        let farEnough = true;
        for (const s of planeStarts) {
          if (chebyshev(x, y, s.x, s.y) < LAIR_MIN_FROM_START) {
            farEnough = false;
            break;
          }
        }
        if (farEnough) candidates.push({ x, y });
      }
    }

    // Greedily place, honouring lair-to-lair spacing.
    const placed: { x: number; y: number }[] = [];
    for (const c of lairRng.shuffle(candidates)) {
      if (placed.length >= target) break;
      let ok = true;
      for (const p of placed) {
        if (chebyshev(c.x, c.y, p.x, p.y) < LAIR_MIN_SPACING) {
          ok = false;
          break;
        }
      }
      if (ok) placed.push(c);
    }

    // Rank placed lairs by distance to the nearest start; the closest gets
    // tier 0 (weakest), the farthest tier 1. Dimensions (no starts) are all
    // treated as the far end.
    const withDist = placed.map((p) => {
      let best = Infinity;
      for (const s of planeStarts) best = Math.min(best, chebyshev(p.x, p.y, s.x, s.y));
      return { p, dist: best };
    });
    const byDist = withDist.slice().sort((a, b) => a.dist - b.dist);
    const tierFrac = new Map<{ x: number; y: number }, number>();
    byDist.forEach((e, i) =>
      tierFrac.set(e.p, byDist.length > 1 ? i / (byDist.length - 1) : 0),
    );

    for (const { p } of withDist) {
      const t = planeDef.kind === 'dimension' ? 1 : tierFrac.get(p) ?? 0;
      const eligible =
        planeDef.kind === 'dimension'
          ? ranked
          : ranked.filter((d) => !(isStrongMonster(d) && t < STRONG_TIER_FLOOR));
      const pool = eligible.length > 0 ? eligible : ranked;

      const size = lairRng.int(1, 5); // 1..4 units
      const monsterIds: string[] = [];
      const monsterHp: number[] = [];
      let strength = 0;
      for (let k = 0; k < size; k++) {
        const def = pickMonster(lairRng, pool, tierNorm, t);
        monsterIds.push(def.id);
        monsterHp.push(def.combat.figures * def.combat.hits);
        strength += monsterPower(def);
      }

      const gold = Math.round(strength * (3 + lairRng.next() * 5)); // 3–8× strength
      const mana = Math.round(gold / 2);

      state.lairs.push({
        id: `lair-${lairCounter++}`,
        plane: planeDef.id,
        x: p.x,
        y: p.y,
        monsterIds,
        monsterHp,
        loot: { gold, mana },
        cleared: false,
      });
    }
  }
}
