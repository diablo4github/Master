/**
 * Battle/lair state spec + type-guarded accessors.
 *
 * INTEGRATION SEAM. The sim agent is adding two fields to GameState:
 *
 *   lairs:   LairState[]     — monster lairs seeded at worldgen
 *   battles: BattleRecord[]  — appended when a stack moves onto a lair
 *
 * Those fields are NOT yet part of the `GameState` interface in
 * `src/sim/core/state.ts`. So the presentation layer never touches
 * `game.lairs` / `game.battles` directly; it goes through `gameLairs(game)` /
 * `gameBattles(game)` below, which read the fields if present and return `[]`
 * otherwise. Once the sim merges the fields, these accessors keep working with
 * zero changes — nothing else in the UI needs flipping.
 *
 * The shapes here mirror the agreed spec exactly; if the sim's published types
 * differ, re-point these two interfaces at the sim's exports and the accessors
 * stay valid.
 */

import type { GameState } from '@sim/core/state';
import type { PlaneId } from '@sim/types';
import type { BattleReport } from '@sim/combat/events';

export interface LairState {
  id: string;
  plane: PlaneId;
  x: number;
  y: number;
  /** Def ids of the garrison monsters. */
  monsterIds: string[];
  /** Current hp pool per monster (parallel to monsterIds). */
  monsterHp: number[];
  loot: { gold: number; mana: number };
  cleared: boolean;
}

export interface BattleRecord {
  id: string;
  turn: number;
  plane: PlaneId;
  x: number;
  y: number;
  attackerPlayer: string;
  /** Defending player id, or a neutral sentinel for lair monsters. */
  defenderPlayer: string;
  report: BattleReport;
  lairId?: string;
}

interface WithLairs {
  lairs?: unknown;
}
interface WithBattles {
  battles?: unknown;
}

/** Lairs on the given plane state, or [] until the sim provides them. */
export function gameLairs(game: GameState): LairState[] {
  const l = (game as unknown as WithLairs).lairs;
  return Array.isArray(l) ? (l as LairState[]) : [];
}

/** Battle records, or [] until the sim provides them. */
export function gameBattles(game: GameState): BattleRecord[] {
  const b = (game as unknown as WithBattles).battles;
  return Array.isArray(b) ? (b as BattleRecord[]) : [];
}

/** True if the human player was on either side of this battle. */
export function battleInvolves(rec: BattleRecord, playerId: string): boolean {
  return rec.attackerPlayer === playerId || rec.defenderPlayer === playerId;
}
