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
import { isPassable } from '../units/units';
import { foundCity, spawnUnit, CAPITAL_START_POP } from '../city/city';

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

export interface GameState {
  settings: GameSettings;
  turn: number;
  /** Snapshot of the master Rng's state, so saves resume the exact same sequence. */
  rngState: RngState;
  maps: Record<PlaneId, PlaneMap>;
  players: PlayerState[];
  cities: CityState[];
  units: UnitState[];
  /**
   * Monotonic counter for minting entity ids ('city-N' / 'unit-N'). Never
   * reused, so ids are stable and deterministic across a game's lifetime.
   */
  nextEntityId: number;
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
    nextEntityId: 1,
  };

  const starts = chooseStartLocations(rng, maps, settings.players);

  settings.players.forEach((setup, i) => {
    const player = players[i];
    if (!player) return;
    const { plane, x, y } = starts[i] as { plane: PlaneId; x: number; y: number };
    const race = content.races[setup.raceId];
    const capitalName = `${race ? race.name : setup.raceId} Capital`;

    // Found the capital immediately.
    foundCity(state, content, player.id, setup.raceId, plane, x, y, capitalName, CAPITAL_START_POP);

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

  return state;
}
