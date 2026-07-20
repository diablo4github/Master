/**
 * Command-pattern skeleton for mutating GameState.
 *
 * Updates are immutable from the caller's point of view: `applyCommand` and
 * `advanceTurn` never mutate the GameState passed in — they return a new
 * one. Internally we do this via `structuredClone`, which is cheap enough
 * for a turn-based game and keeps the update code free of hand-written deep
 * copies. (structuredClone supports more than plain JSON, e.g. Map/Set/Date
 * — the project's determinism rules forbid putting those in GameState
 * regardless, so this is safe in practice and cheaper than a JSON
 * round-trip. `state.test.ts` separately verifies the JSON round-trip
 * invariant holds.)
 */

import type { GameState } from './state';

/** Commands a player (human or AI) can issue against the sim. Grows over time. */
export type Command = { type: 'end-turn' } | { type: 'noop' };

/** Applies a single player's command to the state, returning a new GameState. */
export function applyCommand(state: GameState, playerId: string, cmd: Command): GameState {
  switch (cmd.type) {
    case 'end-turn':
      return advanceTurn(state);
    case 'noop':
      return state;
    default: {
      // Exhaustiveness check: if this errors at compile time, a Command
      // variant is unhandled above.
      const exhaustive: never = cmd;
      throw new Error(`applyCommand: unknown command ${JSON.stringify(exhaustive)} from ${playerId}`);
    }
  }
}

/**
 * Advances the game by one turn. Increments `turn` and will eventually run
 * the full end-of-turn phase pipeline; phases are stubbed below in the
 * order they'll run, so later work has an obvious place to land.
 */
export function advanceTurn(state: GameState): GameState {
  const next = structuredClone(state);
  next.turn += 1;

  // PHASE: production — apply city production queues, complete builds.
  // PHASE: growth — apply population growth/starvation per city.
  // PHASE: upkeep — pay unit/building gold & mana upkeep, handle shortfalls.
  // PHASE: research — apply research point accumulation toward studies.
  // PHASE: events — resolve random world events via a forked rng stream.

  return next;
}
