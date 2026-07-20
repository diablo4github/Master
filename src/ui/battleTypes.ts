/**
 * Battle/lair accessors — the integration seam between the presentation layer
 * and the sim's lair/battle state.
 *
 * The sim now defines `lairs: LairState[]` and `battles: BattleRecord[]` on
 * GameState (src/sim/core/state.ts); we re-export those types so the UI has a
 * single source of truth. The presentation layer still reads them through
 * `gameLairs(game)` / `gameBattles(game)` rather than touching the fields
 * directly — the guarded reads tolerate an older save or a partially-populated
 * state and simply return [] in that case, so nothing here can throw.
 */

import type { GameState, LairState, BattleRecord } from '@sim/core/state';

export type { LairState, BattleRecord };

/** Lairs in the current state (empty if a save predates the field). */
export function gameLairs(game: GameState): LairState[] {
  const l = (game as { lairs?: LairState[] }).lairs;
  return Array.isArray(l) ? l : [];
}

/** Battle records in the current state (empty if a save predates the field). */
export function gameBattles(game: GameState): BattleRecord[] {
  const b = (game as { battles?: BattleRecord[] }).battles;
  return Array.isArray(b) ? b : [];
}

/** True if the given player was on either side of this battle. */
export function battleInvolves(rec: BattleRecord, playerId: string): boolean {
  return rec.attackerPlayer === playerId || rec.defenderPlayer === playerId;
}
