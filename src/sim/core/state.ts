/**
 * Root game state and construction.
 *
 * GameState is the entire save file: plain, JSON-serializable data. Nothing
 * in here may hold a class instance, a function, or non-deterministic data.
 */

import type { GameSettings, PlaneDef, PlaneId, PlayerSetup } from '../types';
import { createRng, type RngState } from './rng';
import { generateAllPlanes } from '../map/mapgen';
import type { PlaneMap } from '../map/tiles';

/** Per-player runtime state. Intentionally lean — will grow as systems land. */
export interface PlayerState {
  id: string;
  setup: PlayerSetup;
  mana: number;
  gold: number;
  knownSpells: string[];
}

export interface GameState {
  settings: GameSettings;
  turn: number;
  /** Snapshot of the master Rng's state, so saves resume the exact same sequence. */
  rngState: RngState;
  maps: Record<PlaneId, PlaneMap>;
  players: PlayerState[];
}

/** Content required to construct a game. Other packages (src/data) supply this; sim never imports src/data directly. */
export interface GameContent {
  planes: PlaneDef[];
}

/** Builds a fresh GameState from settings + injected content. Deterministic in `settings.seed`. */
export function createGame(settings: GameSettings, content: GameContent): GameState {
  const rng = createRng(settings.seed);

  const maps = generateAllPlanes(rng, content.planes, settings.mapSize);

  const players: PlayerState[] = settings.players.map((setup, i) => ({
    id: `player-${i}`,
    setup,
    mana: 0,
    gold: 0,
    knownSpells: [],
  }));

  return {
    settings,
    turn: 1,
    rngState: rng.getState(),
    maps,
    players,
  };
}
