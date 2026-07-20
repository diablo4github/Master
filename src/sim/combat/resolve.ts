/**
 * Strategic ↔ tactical bridge.
 *
 * `resolveStacks` takes two co-located stacks of strategic UnitState (plus each
 * unit's UnitDef), fights the battle, and maps the outcome back to per-unit hp
 * updates and deaths. It is PURE: it never mutates the input UnitStates — it
 * returns the new hp for each survivor and flags the dead, so the caller
 * (turn.ts, wired up later by the strategic-integration agent) decides how to
 * apply them.
 *
 * A unit's battle identity is its strategic UnitState.id, so casualties map back
 * one-to-one.
 */

import type { UnitDef, UnitState } from '../types';
import type { PlaneId } from '../types';
import type { TerrainId } from '../map/tiles';
import { runBattle } from './battle';
import type { BattleReport, BattleWinner } from './events';

export interface StackUnit {
  state: UnitState;
  def: UnitDef;
}

export interface ResolveInput {
  seed: number;
  attacker: StackUnit[];
  defender: StackUnit[];
  terrain: { plane: PlaneId; terrain: TerrainId };
}

/** Per-unit result: dead units are removed; survivors take their new hp. */
export interface UnitOutcome {
  id: string;
  survived: boolean;
  /** New hp pool (0 when dead). */
  hp: number;
}

export interface ResolveResult {
  winner: BattleWinner;
  ticks: number;
  attacker: UnitOutcome[];
  defender: UnitOutcome[];
  /** The full event log, for the viewer / replay. */
  report: BattleReport;
}

function mapSide(
  units: StackUnit[],
  survivors: { id: string; hp: number }[],
): UnitOutcome[] {
  const byId = new Map<string, number>();
  for (const s of survivors) byId.set(s.id, s.hp);
  return units.map((u) => {
    const hp = byId.get(u.state.id);
    if (hp === undefined || hp <= 0) return { id: u.state.id, survived: false, hp: 0 };
    return { id: u.state.id, survived: true, hp };
  });
}

/** Fights the two stacks and returns per-unit casualty mapping (pure). */
export function resolveStacks(input: ResolveInput): ResolveResult {
  const report = runBattle({
    seed: input.seed,
    attacker: { units: input.attacker.map((u) => ({ id: u.state.id, def: u.def, hp: u.state.hp })) },
    defender: { units: input.defender.map((u) => ({ id: u.state.id, def: u.def, hp: u.state.hp })) },
    terrain: input.terrain,
  });

  return {
    winner: report.outcome.winner,
    ticks: report.outcome.ticks,
    attacker: mapSide(input.attacker, report.outcome.survivors.attacker),
    defender: mapSide(input.defender, report.outcome.survivors.defender),
    report,
  };
}
