import { describe, expect, it } from 'vitest';
import { applyCommand, advanceTurn, idleArmies, armyOrderOf } from './turn';
import type { GameState } from './state';
import { CONTENT, makeMap, makeState, makePlayer } from '../__fixtures__/content';
import { chebyshev } from '../units/units';
import type { UnitState } from '../types';

const ME = 'player-0';

function unit(over: Partial<UnitState> & Pick<UnitState, 'id' | 'defId'>): UnitState {
  return {
    id: over.id,
    owner: over.owner ?? ME,
    defId: over.defId,
    plane: over.plane ?? 'meridia',
    x: over.x ?? 0,
    y: over.y ?? 0,
    moves: over.moves ?? 1,
    hp: over.hp ?? 18,
    ...(over.armyId !== undefined ? { armyId: over.armyId } : {}),
  };
}

/** A flat grassland Meridia with the given units and optional lairs. */
function armyState(units: UnitState[], over?: Partial<Parameters<typeof makeState>[0]>): GameState {
  return makeState({
    maps: [makeMap('meridia', 12, 12, 'grassland')],
    players: [makePlayer(ME, 'orc')],
    units,
    nextEntityId: 50,
    ...over,
  });
}

describe('form-army', () => {
  it('groups ≥2 co-located, army-free units and mints army-N from the entity counter', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3 }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3 }),
    ]);
    const next = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['u-1', 'u-2'] });
    const a = next.units.find((u) => u.id === 'u-1')!;
    const b = next.units.find((u) => u.id === 'u-2')!;
    expect(a.armyId).toBe('army-50');
    expect(b.armyId).toBe('army-50');
    expect(next.nextEntityId).toBe(51);
  });

  it('rejects fewer than two, non-co-located, and already-armied units', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3 }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3 }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 8, y: 8 }),
    ]);
    expect(() => applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['u-1'] })).toThrow(/at least 2/);
    expect(() => applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['u-1', 'u-3'] })).toThrow(/same tile/);
    const formed = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['u-1', 'u-2'] });
    // u-1 is now in an army; re-forming with it must fail.
    formed.units.push(unit({ id: 'u-4', defId: 'orc-warrior', x: 3, y: 3 }));
    expect(() => applyCommand(formed, CONTENT, ME, { type: 'form-army', unitIds: ['u-1', 'u-4'] })).toThrow(/already in an army/);
  });

  it('rejects an army larger than the stack cap of 9', () => {
    const many = Array.from({ length: 10 }, (_, i) => unit({ id: `u-${i}`, defId: 'orc-warrior', x: 4, y: 4 }));
    const s = armyState(many);
    expect(() =>
      applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: many.map((u) => u.id) }),
    ).toThrow(/at most 9/);
  });
});

describe('join-army / leave-army', () => {
  it('joins co-located units and rejects distant ones or over-cap joins', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 3, y: 3 }),
      unit({ id: 'u-4', defId: 'orc-warrior', x: 9, y: 9 }),
    ]);
    const joined = applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['u-3'] });
    expect(joined.units.find((u) => u.id === 'u-3')!.armyId).toBe('army-7');
    expect(() => applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['u-4'] })).toThrow(/not with army/);
    expect(() => applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'nope', unitIds: ['u-3'] })).toThrow(/Unknown army/);
  });

  it('leaving drops membership; dropping to a single member disbands the army', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
    ]);
    // Leaving one of three: army persists with two.
    let next = applyCommand(s, CONTENT, ME, { type: 'leave-army', unitIds: ['u-3'] });
    expect(next.units.find((u) => u.id === 'u-3')!.armyId).toBeUndefined();
    expect(next.units.filter((u) => u.armyId === 'army-7')).toHaveLength(2);
    // Leaving another: only one would remain, so the army disbands entirely.
    next = applyCommand(next, CONTENT, ME, { type: 'leave-army', unitIds: ['u-2'] });
    expect(next.units.every((u) => u.armyId === undefined)).toBe(true);
  });
});

describe('join-army with auto-leave', () => {
  it('a unit already in another army auto-leaves it (disbanding a one-member remnant)', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-8' }),
      unit({ id: 'u-4', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-8' }),
    ], { armyOrders: { 'army-8': { kind: 'fortify' } } });
    const next = applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['u-3'] });
    expect(next.units.find((u) => u.id === 'u-3')!.armyId).toBe('army-7');
    // army-8 dropped to one member (u-4) -> disbanded, its order cleaned up.
    expect(next.units.find((u) => u.id === 'u-4')!.armyId).toBeUndefined();
    expect(armyOrderOf(next, 'army-8')).toBeUndefined();
    expect(next.units.filter((u) => u.armyId === 'army-7')).toHaveLength(3);
  });

  it('joining a unit already in the target army is a no-op (no double count, no error)', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
    ]);
    const next = applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['u-1'] });
    expect(next.units.filter((u) => u.armyId === 'army-7')).toHaveLength(2);
  });

  it('auto-leave still respects the destination stack cap', () => {
    // army-7 already holds 8; a 9th from another army fits, a 10th would not.
    const units: UnitState[] = [];
    for (let i = 0; i < 8; i++) units.push(unit({ id: `a-${i}`, defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }));
    units.push(unit({ id: 'b-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-8' }));
    units.push(unit({ id: 'b-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-8' }));
    const s = armyState(units);
    expect(() =>
      applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['b-1', 'b-2'] }),
    ).toThrow(/at most 9/);
  });
});

describe('merge-stack', () => {
  it('loose units only: mints a fresh army and folds every unit in', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 4, y: 4 }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 4, y: 4 }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 4, y: 4 }),
      unit({ id: 'far', defId: 'orc-warrior', x: 9, y: 9 }), // not on the tile
    ]);
    const next = applyCommand(s, CONTENT, ME, { type: 'merge-stack', plane: 'meridia', x: 4, y: 4 });
    const ids = next.units.filter((u) => u.armyId !== undefined).map((u) => u.id).sort();
    expect(ids).toEqual(['u-1', 'u-2', 'u-3']);
    const armyId = next.units.find((u) => u.id === 'u-1')!.armyId!;
    expect(armyId).toBe('army-50'); // minted from the entity counter
    expect(next.units.filter((u) => u.armyId === armyId)).toHaveLength(3);
    expect(next.units.find((u) => u.id === 'far')!.armyId).toBeUndefined();
  });

  it('one army + loose units: keeps the existing army id and joins the loose units', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 4, y: 4 }),
    ], { armyOrders: { 'army-7': { kind: 'fortify' } } });
    const next = applyCommand(s, CONTENT, ME, { type: 'merge-stack', plane: 'meridia', x: 4, y: 4 });
    expect(next.units.filter((u) => u.armyId === 'army-7')).toHaveLength(3);
    expect(next.nextEntityId).toBe(50); // no fresh id minted
    // Reorganizing clears the kept army's fortify.
    expect(armyOrderOf(next, 'army-7')).toBeUndefined();
  });

  it('two armies: mints a fresh army id, absorbs everyone, and drops folded orders', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-8' }),
      unit({ id: 'u-4', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-8' }),
    ], { armyOrders: { 'army-7': { kind: 'move', x: 9, y: 9 }, 'army-8': { kind: 'fortify' } } });
    const next = applyCommand(s, CONTENT, ME, { type: 'merge-stack', plane: 'meridia', x: 4, y: 4 });
    const armyId = next.units.find((u) => u.id === 'u-1')!.armyId!;
    expect(armyId).toBe('army-50');
    expect(next.units.filter((u) => u.armyId === armyId)).toHaveLength(4);
    expect(armyOrderOf(next, 'army-7')).toBeUndefined();
    expect(armyOrderOf(next, 'army-8')).toBeUndefined();
    expect(armyOrderOf(next, armyId)).toBeUndefined();
  });

  it('rejects a single-unit tile (<2 units) and an over-cap merge', () => {
    const solo = armyState([unit({ id: 'lonely', defId: 'orc-warrior', x: 4, y: 4 })]);
    expect(() =>
      applyCommand(solo, CONTENT, ME, { type: 'merge-stack', plane: 'meridia', x: 4, y: 4 }),
    ).toThrow(/at least 2/);
    const crowd = armyState(
      Array.from({ length: 10 }, (_, i) => unit({ id: `c-${i}`, defId: 'orc-warrior', x: 4, y: 4 })),
    );
    expect(() =>
      applyCommand(crowd, CONTENT, ME, { type: 'merge-stack', plane: 'meridia', x: 4, y: 4 }),
    ).toThrow(/at most 9/);
  });
});

describe('move-unit detaches from an army', () => {
  it('a lone move clears armyId, moves the unit alone, and disbands a one-member remnant', () => {
    const s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 2, y: 2, armyId: 'army-7', moves: 1 }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 2, y: 2, armyId: 'army-7', moves: 1 }),
    ]);
    const next = applyCommand(s, CONTENT, ME, { type: 'move-unit', unitId: 'u-1', to: { x: 4, y: 2 } });
    const a = next.units.find((u) => u.id === 'u-1')!;
    const b = next.units.find((u) => u.id === 'u-2')!;
    expect(a.armyId).toBeUndefined();
    expect(chebyshev(a.x, a.y, 2, 2)).toBe(1); // moved one tile alone (moves 1)
    expect(b.x).toBe(2); // the other unit stayed put
    expect(b.y).toBe(2);
    expect(b.armyId).toBeUndefined(); // remnant of one -> disbanded
  });
});

describe('move-army: perfectly-stacked, slowest-pace group march', () => {
  it('advances at the slowest member across multiple turns, staying stacked', () => {
    let s = armyState([
      unit({ id: 'slow', defId: 'militia', x: 1, y: 1, moves: 1 }), // moves 1
      unit({ id: 'fast', defId: 'settler', x: 1, y: 1, moves: 2 }), // moves 2
    ]);
    s = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['slow', 'fast'] });
    const armyId = s.units.find((u) => u.id === 'slow')!.armyId!;

    let prev = { x: 1, y: 1 };
    for (let turn = 0; turn < 3; turn++) {
      s = applyCommand(s, CONTENT, ME, { type: 'move-army', armyId, to: { x: 9, y: 1 } });
      const slow = s.units.find((u) => u.id === 'slow')!;
      const fast = s.units.find((u) => u.id === 'fast')!;
      // Exactly one tile per turn — the militia's pace caps the faster settler.
      expect(chebyshev(prev.x, prev.y, slow.x, slow.y)).toBe(1);
      // Perfectly stacked.
      expect({ x: fast.x, y: fast.y }).toEqual({ x: slow.x, y: slow.y });
      prev = { x: slow.x, y: slow.y };
      // Simulate a fresh turn's movement refresh.
      s = structuredClone(s);
      s.units.find((u) => u.id === 'slow')!.moves = 1;
      s.units.find((u) => u.id === 'fast')!.moves = 2;
    }
  });

  it('refuses to march into a stack that would exceed the cap', () => {
    const units: UnitState[] = [
      unit({ id: 'a', defId: 'orc-warrior', x: 0, y: 0 }),
      unit({ id: 'b', defId: 'orc-warrior', x: 0, y: 0 }),
    ];
    // Eight bystanders already sit on the destination tile (1,0).
    for (let i = 0; i < 8; i++) units.push(unit({ id: `x-${i}`, defId: 'orc-warrior', x: 1, y: 0 }));
    let s = armyState(units);
    s = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['a', 'b'] });
    const armyId = s.units.find((u) => u.id === 'a')!.armyId!;
    expect(() => applyCommand(s, CONTENT, ME, { type: 'move-army', armyId, to: { x: 1, y: 0 } })).toThrow(/stack is full/);
  });
});

describe('move-army triggers a lair battle with the full stack', () => {
  it('every army member is on the attacker side, and casualties never leave a one-member army', () => {
    const lair: GameState['lairs'][number] = {
      id: 'lair-0',
      plane: 'meridia',
      x: 5,
      y: 5,
      monsterIds: ['militia'],
      monsterHp: [3],
      loot: { gold: 50, mana: 25 },
      cleared: false,
    };
    let s = armyState(
      [
        unit({ id: 'w-1', defId: 'orc-warrior', x: 4, y: 5, moves: 1 }),
        unit({ id: 'w-2', defId: 'orc-warrior', x: 4, y: 5, moves: 1 }),
      ],
      { lairs: [lair] },
    );
    s = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['w-1', 'w-2'] });
    const armyId = s.units.find((u) => u.id === 'w-1')!.armyId!;
    s = applyCommand(s, CONTENT, ME, { type: 'move-army', armyId, to: { x: 5, y: 5 } });

    expect(s.battles).toHaveLength(1);
    const rec = s.battles[0]!;
    expect(rec.attackerPlayer).toBe(ME);
    expect(rec.lairId).toBe('lair-0');

    const start = rec.report.events[0]!;
    expect(start.type).toBe('battle-start');
    if (start.type === 'battle-start') {
      const attackerIds = start.units.filter((u) => u.side === 'attacker').map((u) => u.id).sort();
      expect(attackerIds).toEqual(['w-1', 'w-2']);
    }

    // After the battle, no army may be left with exactly one member.
    const remaining = s.units.filter((u) => u.armyId === armyId).length;
    expect(remaining).not.toBe(1);
    // Cleared iff the attacker won — mirrors the lair contract.
    if (rec.report.outcome.winner === 'attacker') {
      expect(s.lairs[0]!.cleared).toBe(true);
    }
  });
});

/** Forms an army from two co-located orc-warriors and returns [state, armyId]. */
function twoUnitArmy(x: number, y: number, tx: number, ty: number): { s: GameState; armyId: string } {
  let s = armyState([
    unit({ id: 'm-1', defId: 'orc-warrior', x, y, moves: 1 }),
    unit({ id: 'm-2', defId: 'orc-warrior', x, y, moves: 1 }),
  ], { maps: [makeMap('meridia', 16, 16, 'grassland')] });
  s = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['m-1', 'm-2'] });
  const armyId = s.units.find((u) => u.id === 'm-1')!.armyId!;
  s = applyCommand(s, CONTENT, ME, { type: 'move-army', armyId, to: { x: tx, y: ty } });
  return { s, armyId };
}

describe('persistent move orders + auto-march', () => {
  it('move-army records the destination and marches the first leg', () => {
    const { s, armyId } = twoUnitArmy(0, 0, 9, 0);
    expect(armyOrderOf(s, armyId)).toEqual({ kind: 'move', x: 9, y: 0 });
    const anchor = s.units.find((u) => u.id === 'm-1')!;
    expect(anchor.x).toBe(1); // orc-warrior moves 1 -> one grassland tile
  });

  it('auto-marches toward the destination each turn, keeping the order until arrival', () => {
    let { s, armyId } = twoUnitArmy(0, 0, 4, 0);
    // After the command the army sits at x=1 with the order still standing.
    expect(s.units.find((u) => u.id === 'm-1')!.x).toBe(1);
    for (let turn = 2; turn <= 3; turn++) {
      s = advanceTurn(s, CONTENT);
      const anchor = s.units.find((u) => u.id === 'm-1')!;
      expect(anchor.x).toBe(turn); // advanced exactly one tile via auto-march
      expect(s.units.find((u) => u.id === 'm-2')!.x).toBe(turn); // stays perfectly stacked
      expect(armyOrderOf(s, armyId)).toEqual({ kind: 'move', x: 4, y: 0 }); // never forgotten
    }
    // Fourth leg reaches the destination and the order is cleared.
    s = advanceTurn(s, CONTENT);
    expect(s.units.find((u) => u.id === 'm-1')!.x).toBe(4);
    expect(armyOrderOf(s, armyId)).toBeUndefined();
  });

  it('a long march is fully deterministic across three auto-march turns', () => {
    const { s: start, armyId } = twoUnitArmy(0, 8, 12, 8);
    // Clone the identical starting state twice so the only variable is the sim.
    let a: GameState = structuredClone(start);
    let b: GameState = structuredClone(start);
    for (let i = 0; i < 3; i++) {
      a = advanceTurn(a, CONTENT);
      b = advanceTurn(b, CONTENT);
    }
    expect(a).toEqual(b);
    // Still en route with the order intact (12 tiles is farther than 4 legs).
    expect(armyOrderOf(a, armyId)).toEqual({ kind: 'move', x: 12, y: 8 });
    // And survives a JSON round-trip unchanged.
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('a battle triggered mid-march STOPS and clears the order', () => {
    const lair: GameState['lairs'][number] = {
      id: 'lair-0', plane: 'meridia', x: 5, y: 5,
      monsterIds: ['militia'], monsterHp: [3], loot: { gold: 50, mana: 25 }, cleared: false,
    };
    let s = armyState([
      unit({ id: 'w-1', defId: 'orc-warrior', x: 3, y: 5, moves: 1 }),
      unit({ id: 'w-2', defId: 'orc-warrior', x: 3, y: 5, moves: 1 }),
    ], { maps: [makeMap('meridia', 16, 16, 'grassland')], lairs: [lair] });
    s = applyCommand(s, CONTENT, ME, { type: 'form-army', unitIds: ['w-1', 'w-2'] });
    const armyId = s.units.find((u) => u.id === 'w-1')!.armyId!;
    // Order the army onto the lair tile; it walks up over several turns.
    s = applyCommand(s, CONTENT, ME, { type: 'move-army', armyId, to: { x: 5, y: 5 } });
    expect(armyOrderOf(s, armyId)).toEqual({ kind: 'move', x: 5, y: 5 }); // en route from (4,5)
    // Auto-march the next turn walks into the lair -> battle, order cleared.
    s = advanceTurn(s, CONTENT);
    expect(s.battles).toHaveLength(1);
    expect(armyOrderOf(s, armyId)).toBeUndefined();
  });
});

describe('fortify orders', () => {
  it('fortify-army sets a fortify order that move-army then replaces', () => {
    let s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
    ]);
    s = applyCommand(s, CONTENT, ME, { type: 'fortify-army', armyId: 'army-7' });
    expect(armyOrderOf(s, 'army-7')).toEqual({ kind: 'fortify' });
    s = applyCommand(s, CONTENT, ME, { type: 'move-army', armyId: 'army-7', to: { x: 5, y: 3 } });
    expect(armyOrderOf(s, 'army-7')!.kind).toBe('move');
  });

  it('joining or leaving an army clears its fortify; disband deletes the entry', () => {
    // join clears fortify
    let s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 3, y: 3 }),
    ], { armyOrders: { 'army-7': { kind: 'fortify' } } });
    let next = applyCommand(s, CONTENT, ME, { type: 'join-army', armyId: 'army-7', unitIds: ['u-3'] });
    expect(armyOrderOf(next, 'army-7')).toBeUndefined();

    // leave (army survives with two) clears fortify
    s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-3', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
    ], { armyOrders: { 'army-7': { kind: 'fortify' } } });
    next = applyCommand(s, CONTENT, ME, { type: 'leave-army', unitIds: ['u-3'] });
    expect(armyOrderOf(next, 'army-7')).toBeUndefined();
    expect(next.units.filter((u) => u.armyId === 'army-7')).toHaveLength(2);

    // leave that disbands the army deletes the order entirely
    s = armyState([
      unit({ id: 'u-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
      unit({ id: 'u-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-7' }),
    ], { armyOrders: { 'army-7': { kind: 'fortify' } } });
    next = applyCommand(s, CONTENT, ME, { type: 'leave-army', unitIds: ['u-2'] });
    expect(armyOrderOf(next, 'army-7')).toBeUndefined();
    expect(next.units.every((u) => u.armyId === undefined)).toBe(true);
  });
});

describe('idleArmies', () => {
  it('lists only unordered armies with movement left — excludes fortified, ordered, spent, and loose units', () => {
    const s = armyState([
      // idle: has moves, no order
      unit({ id: 'a-1', defId: 'orc-warrior', x: 1, y: 1, armyId: 'army-idle', moves: 1 }),
      unit({ id: 'a-2', defId: 'orc-warrior', x: 1, y: 1, armyId: 'army-idle', moves: 1 }),
      // fortified: excluded
      unit({ id: 'f-1', defId: 'orc-warrior', x: 2, y: 2, armyId: 'army-fort', moves: 1 }),
      unit({ id: 'f-2', defId: 'orc-warrior', x: 2, y: 2, armyId: 'army-fort', moves: 1 }),
      // move-ordered: excluded
      unit({ id: 'o-1', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-move', moves: 1 }),
      unit({ id: 'o-2', defId: 'orc-warrior', x: 3, y: 3, armyId: 'army-move', moves: 1 }),
      // spent (0 moves): excluded
      unit({ id: 's-1', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-spent', moves: 0 }),
      unit({ id: 's-2', defId: 'orc-warrior', x: 4, y: 4, armyId: 'army-spent', moves: 0 }),
      // loose unit, not in any army: never counted
      unit({ id: 'loose', defId: 'orc-warrior', x: 5, y: 5, moves: 1 }),
    ], {
      armyOrders: {
        'army-fort': { kind: 'fortify' },
        'army-move': { kind: 'move', x: 9, y: 9 },
      },
    });
    expect(idleArmies(s, ME)).toEqual(['army-idle']);
  });
});
