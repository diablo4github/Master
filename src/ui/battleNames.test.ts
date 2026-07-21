import { describe, expect, it } from 'vitest';

import { makeMap, makeState, makePlayer } from '@sim/__fixtures__/content';
import type { UnitState } from '@sim/types';
import type { BattleReport } from '@sim/combat/events';
import { resolveBattleNames } from './battleNames';

/** A minimal report carrying just the battle-start unit identities the resolver reads. */
function reportWith(units: { id: string; name: string }[]): BattleReport {
  return {
    events: [
      {
        type: 'battle-start',
        tick: 0,
        schemaVersion: 1,
        field: { plane: 'meridia', terrain: 'grassland', width: 10, height: 8, blocked: [], cover: [] },
        units: units.map((u) => ({ id: u.id, name: u.name, side: 'attacker' })),
      },
    ],
    outcome: { winner: 'attacker', survivors: { attacker: [], defender: [] }, ticks: 1 },
  } as unknown as BattleReport;
}

function gameWith(units: UnitState[]) {
  const map = makeMap('meridia', 10, 10, 'grassland');
  return makeState({ maps: [map], players: [makePlayer('player-0', 'orc')], units });
}

function unit(id: string, name?: string): UnitState {
  return {
    id,
    owner: 'player-0',
    defId: 'militia',
    plane: 'meridia',
    x: 0,
    y: 0,
    moves: 1,
    hp: 18,
    ...(name ? { name } : {}),
  };
}

describe('resolveBattleNames', () => {
  it('is total: every report unit resolves to at least its def name', () => {
    const report = reportWith([
      { id: 'unit-1', name: 'Militia' },
      { id: 'lair-0-m0', name: 'Giant Spider' },
    ]);
    const names = resolveBattleNames(report, null);
    expect(names.get('unit-1')).toBe('Militia');
    expect(names.get('lair-0-m0')).toBe('Giant Spider');
  });

  it('overrides with the provenance name for a unit still present in state', () => {
    const report = reportWith([{ id: 'unit-1', name: 'Militia' }]);
    const game = gameWith([unit('unit-1', '1st Grimfang Militia')]);
    const names = resolveBattleNames(report, game);
    expect(names.get('unit-1')).toBe('1st Grimfang Militia');
  });

  it('keeps the def name for a unit that no longer exists (a casualty)', () => {
    const report = reportWith([{ id: 'unit-1', name: 'Militia' }]);
    const game = gameWith([]); // unit-1 died and was removed
    const names = resolveBattleNames(report, game);
    expect(names.get('unit-1')).toBe('Militia');
  });

  it('does not override when the live unit carries no provenance name', () => {
    const report = reportWith([{ id: 'unit-1', name: 'Militia' }]);
    const game = gameWith([unit('unit-1')]); // no .name
    const names = resolveBattleNames(report, game);
    expect(names.get('unit-1')).toBe('Militia');
  });
});
