import { describe, expect, it } from 'vitest';

import { CONTENT, makeMap, makeState, makePlayer, makeCity } from '@sim/__fixtures__/content';
import type { BuildOrder } from '@sim/types';
import { queueEtaTurns, queueView, assembleQueueOptions } from './queue';

function cityWithQueue(queue: BuildOrder[], buildings: string[] = []) {
  const map = makeMap('meridia', 12, 12, 'grassland');
  const player = makePlayer('player-0', 'orc');
  const city = makeCity({
    id: 'city-1',
    owner: 'player-0',
    raceId: 'orc',
    x: 5,
    y: 5,
    buildings,
    buildQueue: queue,
  });
  const state = makeState({ maps: [map], players: [player], cities: [city] });
  return { state, city };
}

describe('queueEtaTurns', () => {
  it('divides remaining by production, rounding up', () => {
    expect(queueEtaTurns(20, 5)).toBe(4);
    expect(queueEtaTurns(21, 5)).toBe(5); // ceil
    expect(queueEtaTurns(0, 5)).toBe(1); // completes next tick
  });

  it('is ∞-safe: null when production is zero or negative', () => {
    expect(queueEtaTurns(20, 0)).toBeNull();
    expect(queueEtaTurns(20, -3)).toBeNull();
  });
});

describe('queueView', () => {
  it('reports cumulative ETAs across the queue at the current production rate', () => {
    // granary cost 20, workshop cost 20; production 10/turn.
    const { state, city } = cityWithQueue([
      { kind: 'building', id: 'granary', progress: 0 },
      { kind: 'building', id: 'workshop', progress: 0 },
    ]);
    void state;
    const rows = queueView(CONTENT, city, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('Granary');
    expect(rows[0]!.etaTurns).toBe(2); // 20/10
    expect(rows[1]!.etaTurns).toBe(4); // (20+20)/10 cumulative
    expect(rows[0]!.isHead).toBe(true);
  });

  it('subtracts the head progress from every cumulative ETA', () => {
    const { city } = cityWithQueue([
      { kind: 'building', id: 'granary', progress: 12 }, // 8 left on head
      { kind: 'building', id: 'workshop', progress: 0 },
    ]);
    const rows = queueView(CONTENT, city, 8);
    expect(rows[0]!.etaTurns).toBe(1); // 8 remaining / 8
    expect(rows[1]!.etaTurns).toBe(4); // (40 - 12) / 8 = 3.5 → 4
  });

  it('marks every ETA null when production is zero', () => {
    const { city } = cityWithQueue([{ kind: 'building', id: 'granary', progress: 0 }]);
    const rows = queueView(CONTENT, city, 0);
    expect(rows[0]!.etaTurns).toBeNull();
  });
});

describe('assembleQueueOptions', () => {
  it('splits into Buildings and Units shelves', () => {
    const { state, city } = cityWithQueue([]);
    const { buildings, units } = assembleQueueOptions(state, CONTENT, city);
    expect(buildings.every((o) => o.kind === 'building')).toBe(true);
    expect(units.every((o) => o.kind === 'unit')).toBe(true);
    expect(buildings.length).toBeGreaterThan(0);
    expect(units.length).toBeGreaterThan(0);
  });

  it('treats an earlier-queued prerequisite as available (granary→marketplace chains)', () => {
    // Fixture chain: foundry requires workshop. With workshop queued ahead,
    // foundry should become queueable in the same visit.
    const { state, city } = cityWithQueue([{ kind: 'building', id: 'workshop', progress: 0 }]);
    const { buildings } = assembleQueueOptions(state, CONTENT, city);
    const foundry = buildings.find((o) => o.id === 'foundry');
    expect(foundry?.buildable).toBe(true);
    // The workshop itself is already queued and can't be queued twice.
    const workshop = buildings.find((o) => o.id === 'workshop');
    expect(workshop?.queued).toBe(true);
    expect(workshop?.buildable).toBe(false);
  });

  it('without the prerequisite queued, the dependent stays locked', () => {
    const { state, city } = cityWithQueue([]);
    const { buildings } = assembleQueueOptions(state, CONTENT, city);
    const foundry = buildings.find((o) => o.id === 'foundry');
    expect(foundry?.buildable).toBe(false);
    expect(foundry?.reason).toMatch(/workshop/i);
  });

  it('hides an already-built building entirely (not greyed)', () => {
    const { state, city } = cityWithQueue([], ['granary']);
    const { buildings } = assembleQueueOptions(state, CONTENT, city);
    expect(buildings.find((o) => o.id === 'granary')).toBeUndefined();
  });

  it('allows duplicate units and tracks how many are queued', () => {
    const { state, city } = cityWithQueue([
      { kind: 'unit', id: 'militia', progress: 0 },
      { kind: 'unit', id: 'militia', progress: 0 },
    ]);
    const { units } = assembleQueueOptions(state, CONTENT, city);
    const militia = units.find((o) => o.id === 'militia');
    expect(militia?.buildable).toBe(true); // still queueable despite duplicates
    expect(militia?.queuedCount).toBe(2);
  });

  it('never lists summon or monster units', () => {
    const { state, city } = cityWithQueue([]);
    const { units } = assembleQueueOptions(state, CONTENT, city);
    // fire-elemental is a summon (school origin) in the fixture.
    expect(units.find((o) => o.id === 'fire-elemental')).toBeUndefined();
    expect(units.every((o) => CONTENT.units[o.id]?.role !== 'monster')).toBe(true);
    expect(units.every((o) => CONTENT.units[o.id]?.role !== 'summon')).toBe(true);
  });
});

describe('queueView dupCount', () => {
  it('counts copies of the same order id for a ×N marker', () => {
    const { city } = cityWithQueue([
      { kind: 'unit', id: 'militia', progress: 0 },
      { kind: 'building', id: 'granary', progress: 0 },
      { kind: 'unit', id: 'militia', progress: 0 },
    ]);
    const rows = queueView(CONTENT, city, 10);
    const militiaRows = rows.filter((r) => r.id === 'militia');
    expect(militiaRows).toHaveLength(2);
    expect(militiaRows.every((r) => r.dupCount === 2)).toBe(true);
    expect(rows.find((r) => r.id === 'granary')?.dupCount).toBe(1);
  });
});
