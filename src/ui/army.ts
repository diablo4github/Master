/**
 * Pure helpers for the ARMY / STACK panels (docs/DESIGN.md "Management
 * Philosophy": units combine into named armies that move and fight as one,
 * slowest member setting the pace; stacks cap at 9).
 *
 * The sim owns army membership (UnitState.armyId; form-army / join-army /
 * leave-army / move-army in src/sim/core/turn.ts). This module derives the
 * read-only views the panels draw and the small selection reducer the stack
 * panel's checkboxes use. No DOM, no Pixi — unit-tested.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { PlaneId, UnitState, UnitDef } from '@sim/types';

/** A unit as the stack/army list shows it: name, figures, hp fraction, army. */
export interface UnitRow {
  id: string;
  defId: string;
  name: string;
  role: string;
  /** Current figures (derived from the hp pool), and the formation's full size. */
  figures: number;
  maxFigures: number;
  hp: number;
  maxHp: number;
  hpFrac: number;
  armyId?: string;
}

function figuresOf(def: UnitDef | undefined, hp: number): { figures: number; max: number; maxHp: number } {
  if (!def) return { figures: 0, max: 0, maxHp: 0 };
  const hits = Math.max(1, def.combat.hits);
  const maxHp = def.combat.figures * def.combat.hits;
  return { figures: Math.max(0, Math.ceil(hp / hits)), max: def.combat.figures, maxHp };
}

export function unitRow(content: GameContent, unit: UnitState): UnitRow {
  const def = content.units[unit.defId];
  const f = figuresOf(def, unit.hp);
  return {
    id: unit.id,
    defId: unit.defId,
    name: def?.name ?? unit.defId,
    role: def?.role ?? 'unit',
    figures: f.figures,
    maxFigures: f.max,
    hp: unit.hp,
    maxHp: f.maxHp,
    hpFrac: f.maxHp > 0 ? unit.hp / f.maxHp : 0,
    armyId: unit.armyId,
  };
}

/** Every unit an owner has co-located on a tile, in stable state order. */
export function unitsOnTile(
  game: GameState,
  owner: string,
  plane: PlaneId,
  x: number,
  y: number,
): UnitState[] {
  return game.units.filter(
    (u) => u.owner === owner && u.plane === plane && u.x === x && u.y === y,
  );
}

/** Rows for every own unit co-located on a tile. */
export function stackRows(
  game: GameState,
  content: GameContent,
  owner: string,
  plane: PlaneId,
  x: number,
  y: number,
): UnitRow[] {
  return unitsOnTile(game, owner, plane, x, y).map((u) => unitRow(content, u));
}

/** Live members of an army (units carrying its armyId), in state order. */
export function armyMembers(game: GameState, armyId: string): UnitState[] {
  return game.units.filter((u) => u.armyId === armyId);
}

export interface ArmyView {
  armyId: string;
  members: UnitRow[];
  /** Slowest member's strategic move rate — the army's pace. */
  pace: number;
  /** Total living figures across the army. */
  totalFigures: number;
  plane: PlaneId | null;
  x: number | null;
  y: number | null;
}

/**
 * The army panel's view: its members, the slowest member's move rate (the pace
 * the army marches at), and its total figures. `pace` uses each unit def's base
 * `moves`, not the remaining points this turn, so it reads as the army's speed.
 */
export function armyView(game: GameState, content: GameContent, armyId: string): ArmyView {
  const units = armyMembers(game, armyId);
  const members = units.map((u) => unitRow(content, u));
  let pace = Infinity;
  let totalFigures = 0;
  for (const u of units) {
    const def = content.units[u.defId];
    if (def) pace = Math.min(pace, def.moves);
    totalFigures += unitRow(content, u).figures;
  }
  const anchor = units[0];
  return {
    armyId,
    members,
    pace: Number.isFinite(pace) ? pace : 0,
    totalFigures,
    plane: anchor ? anchor.plane : null,
    x: anchor ? anchor.x : null,
    y: anchor ? anchor.y : null,
  };
}

/**
 * Whether the selected ids can be grouped into a NEW army: at least two units,
 * every one currently army-free (form-army rejects units already in an army),
 * and within the stack cap of 9. Pure over the stack rows.
 */
export function canFormArmy(rows: readonly UnitRow[], selectedIds: ReadonlySet<string>): boolean {
  const chosen = rows.filter((r) => selectedIds.has(r.id));
  if (chosen.length < 2 || chosen.length > 9) return false;
  return chosen.every((r) => r.armyId === undefined);
}

/** Toggle one id in a selection set, returning a NEW set (immutable helper). */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
