import { describe, expect, it } from 'vitest';

import { CONTENT, makeMap, makeState, makePlayer } from '@sim/__fixtures__/content';
import type { UnitState } from '@sim/types';
import {
  stackRows,
  armyView,
  canFormArmy,
  toggleSelection,
  unitsOnTile,
} from './army';

function unit(id: string, over: Partial<UnitState> = {}): UnitState {
  const defId = over.defId ?? 'militia';
  const def = CONTENT.units[defId]!;
  return {
    id,
    owner: 'player-0',
    defId,
    plane: 'meridia',
    x: over.x ?? 5,
    y: over.y ?? 5,
    moves: over.moves ?? 1,
    hp: over.hp ?? def.combat.figures * def.combat.hits,
    ...over,
  };
}

function gameWith(units: UnitState[]) {
  const map = makeMap('meridia', 12, 12, 'grassland');
  const player = makePlayer('player-0', 'orc');
  return makeState({ maps: [map], players: [player], units });
}

describe('stackRows / unitsOnTile', () => {
  it('lists only the owner\'s co-located units with figure + hp data', () => {
    const g = gameWith([
      unit('u1'),
      unit('u2', { defId: 'orc-warrior' }),
      unit('u3', { x: 6 }), // different tile
      { ...unit('e1'), owner: 'enemy' }, // different owner
    ]);
    const rows = stackRows(g, CONTENT, 'player-0', 'meridia', 5, 5);
    expect(rows.map((r) => r.id)).toEqual(['u1', 'u2']);
    expect(rows[0]!.figures).toBe(CONTENT.units['militia']!.combat.figures);
    expect(rows[0]!.maxFigures).toBe(CONTENT.units['militia']!.combat.figures);
    expect(rows[0]!.hpFrac).toBe(1);
    expect(unitsOnTile(g, 'player-0', 'meridia', 5, 5)).toHaveLength(2);
  });

  it('derives current figures from a depleted hp pool', () => {
    // militia: 6 figures × 3 hits = 18 hp. Half hp → ceil(9/3) = 3 figures.
    const g = gameWith([unit('u1', { hp: 9 })]);
    const rows = stackRows(g, CONTENT, 'player-0', 'meridia', 5, 5);
    expect(rows[0]!.figures).toBe(3);
    expect(rows[0]!.hpFrac).toBeCloseTo(0.5);
  });
});

describe('armyView', () => {
  it('reports members, slowest pace, and total figures', () => {
    // militia moves 1; a hypothetical faster unit via settler (moves 2).
    const g = gameWith([
      unit('u1', { armyId: 'army-1', defId: 'militia', moves: 1 }),
      unit('u2', { armyId: 'army-1', defId: 'settler', moves: 2 }),
    ]);
    const view = armyView(g, CONTENT, 'army-1');
    expect(view.members.map((m) => m.id)).toEqual(['u1', 'u2']);
    expect(view.pace).toBe(1); // slowest of moves 1 and 2
    const expected =
      CONTENT.units['militia']!.combat.figures + CONTENT.units['settler']!.combat.figures;
    expect(view.totalFigures).toBe(expected);
    expect(view.x).toBe(5);
  });
});

describe('canFormArmy', () => {
  const rows = (units: UnitState[]) => stackRows(gameWith(units), CONTENT, 'player-0', 'meridia', 5, 5);

  it('needs at least two army-free units', () => {
    const r = rows([unit('u1'), unit('u2'), unit('u3', { armyId: 'army-9' })]);
    expect(canFormArmy(r, new Set(['u1']))).toBe(false); // only one
    expect(canFormArmy(r, new Set(['u1', 'u2']))).toBe(true);
    expect(canFormArmy(r, new Set(['u1', 'u3']))).toBe(false); // u3 already in an army
  });

  it('rejects more than the stack cap of 9', () => {
    const many = Array.from({ length: 10 }, (_, i) => unit(`u${i}`));
    const r = rows(many);
    expect(canFormArmy(r, new Set(many.map((u) => u.id)))).toBe(false);
    expect(canFormArmy(r, new Set(many.slice(0, 9).map((u) => u.id)))).toBe(true);
  });
});

describe('toggleSelection', () => {
  it('adds and removes ids immutably', () => {
    const a = toggleSelection(new Set<string>(), 'x');
    expect([...a]).toEqual(['x']);
    const b = toggleSelection(a, 'y');
    expect([...b].sort()).toEqual(['x', 'y']);
    const c = toggleSelection(b, 'x');
    expect([...c]).toEqual(['y']);
    // original untouched
    expect([...a]).toEqual(['x']);
  });
});
