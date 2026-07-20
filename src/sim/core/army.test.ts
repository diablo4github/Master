import { describe, expect, it } from 'vitest';
import { applyCommand } from './turn';
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
