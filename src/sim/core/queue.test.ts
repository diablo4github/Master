import { describe, expect, it } from 'vitest';
import { applyCommand } from './turn';
import type { GameState } from './state';
import { tickProduction } from '../city/city';
import { CONTENT, makeMap, makeState, makePlayer, makeCity } from '../__fixtures__/content';
import type { BuildOrder } from '../types';

const ME = 'player-0';

function cityState(over?: Partial<Parameters<typeof makeCity>[0]>): GameState {
  const map = makeMap('meridia', 11, 11, 'grassland');
  const player = makePlayer(ME, 'orc');
  const city = makeCity({ id: 'city-1', owner: ME, raceId: 'orc', x: 5, y: 5, ...over });
  return makeState({ maps: [map], players: [player], cities: [city] });
}

const B = (kind: 'building' | 'unit', id: string): { kind: 'building' | 'unit'; id: string } => ({ kind, id });

describe('queue-build (append)', () => {
  it('appends orders in order and rejects duplicates', () => {
    let s = cityState();
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'workshop') });
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('unit', 'militia') });
    expect(s.cities[0]!.buildQueue.map((o) => o.id)).toEqual(['workshop', 'militia']);
    expect(() =>
      applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'workshop') }),
    ).toThrow(/already queued/);
  });

  it('accepts a building whose prerequisite is EARLIER in the queue, rejects it otherwise', () => {
    let s = cityState();
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'workshop') });
    // foundry requires workshop, which is queued just ahead -> legal at queue time.
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'foundry') });
    expect(s.cities[0]!.buildQueue.map((o) => o.id)).toEqual(['workshop', 'foundry']);
    // Queuing foundry with no workshop built or queued -> rejected.
    expect(() =>
      applyCommand(cityState(), CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'foundry') }),
    ).toThrow(/requires/);
  });

  it('allows duplicate UNIT orders but still rejects duplicate BUILDING orders', () => {
    let s = cityState();
    // Three militia in a row is legal now (queue multiples of the same unit).
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('unit', 'militia') });
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('unit', 'militia') });
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('unit', 'militia') });
    expect(s.cities[0]!.buildQueue.map((o) => o.id)).toEqual(['militia', 'militia', 'militia']);
    // A building already queued is still rejected.
    s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'workshop') });
    expect(() =>
      applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'workshop') }),
    ).toThrow(/already queued/);
    // A building already BUILT is rejected too.
    const built = cityState({ buildings: ['granary'] });
    expect(() =>
      applyCommand(built, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('building', 'granary') }),
    ).toThrow(/already built/i);
  });

  it('trains two identically-deffed regiments from duplicate unit orders', () => {
    let s = cityState({
      buildQueue: [
        { kind: 'unit', id: 'militia', progress: 0 }, // cost 10
        { kind: 'unit', id: 'militia', progress: 0 }, // cost 10
      ],
    });
    const before = s.units.length;
    // One fat production tick completes both regiments (10 + 10).
    tickProduction(s, CONTENT, s.cities[0]!, 20);
    expect(s.cities[0]!.buildQueue).toHaveLength(0);
    const trained = s.units.filter((u) => u.defId === 'militia');
    expect(trained).toHaveLength(before + 2);
    // Two distinct regiments (unique ids), both on the city tile.
    expect(new Set(trained.map((u) => u.id)).size).toBe(2);
    for (const u of trained) {
      expect(u.x).toBe(s.cities[0]!.x);
      expect(u.y).toBe(s.cities[0]!.y);
    }
  });

  it('enforces the queue cap of 7', () => {
    let s = cityState();
    s.players[0]!.completedStudies = ['arcane-arts', 'war-drums']; // unlock wizard-tower + orc-warrior
    const seven = [
      B('building', 'granary'),
      B('building', 'workshop'),
      B('building', 'foundry'),
      B('building', 'barracks'),
      B('building', 'wizard-tower'),
      B('unit', 'militia'),
      B('unit', 'settler'),
    ];
    for (const o of seven) s = applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: o });
    expect(s.cities[0]!.buildQueue).toHaveLength(7);
    expect(() =>
      applyCommand(s, CONTENT, ME, { type: 'queue-build', cityId: 'city-1', order: B('unit', 'orc-warrior') }),
    ).toThrow(/queue is full/);
  });
});

describe('dequeue-build / reorder-build', () => {
  function threeQueued(): GameState {
    return cityState({
      buildQueue: [
        { kind: 'building', id: 'granary', progress: 0 },
        { kind: 'building', id: 'workshop', progress: 0 },
        { kind: 'unit', id: 'militia', progress: 0 },
      ],
    });
  }

  it('dequeue removes the indexed order and rejects out-of-range', () => {
    const s = applyCommand(threeQueued(), CONTENT, ME, { type: 'dequeue-build', cityId: 'city-1', index: 1 });
    expect(s.cities[0]!.buildQueue.map((o) => o.id)).toEqual(['granary', 'militia']);
    expect(() => applyCommand(threeQueued(), CONTENT, ME, { type: 'dequeue-build', cityId: 'city-1', index: 9 })).toThrow(/No queue entry/);
  });

  it('reorder moves an order and rejects out-of-range indices', () => {
    const s = applyCommand(threeQueued(), CONTENT, ME, { type: 'reorder-build', cityId: 'city-1', from: 0, to: 2 });
    expect(s.cities[0]!.buildQueue.map((o) => o.id)).toEqual(['workshop', 'militia', 'granary']);
    expect(() => applyCommand(threeQueued(), CONTENT, ME, { type: 'reorder-build', cityId: 'city-1', from: 0, to: 9 })).toThrow(/Cannot move/);
  });
});

describe('tickProduction: queue rollover, overflow, and illegal-head skip', () => {
  it('completes the head then rolls overflow into the next order', () => {
    const s = cityState({
      buildQueue: [
        { kind: 'building', id: 'workshop', progress: 0 }, // cost 20
        { kind: 'building', id: 'barracks', progress: 0 }, // cost 30
      ],
    });
    const city = s.cities[0]!;
    tickProduction(s, CONTENT, city, 55); // 20 completes workshop, 35 rolls to barracks (>=30)
    expect(city.buildings).toEqual(['workshop', 'barracks']);
    expect(city.buildQueue).toHaveLength(0);
  });

  it('carries partial overflow into the next order without completing it', () => {
    const s = cityState({
      buildQueue: [
        { kind: 'building', id: 'workshop', progress: 0 }, // cost 20
        { kind: 'building', id: 'barracks', progress: 0 }, // cost 30
      ],
    });
    const city = s.cities[0]!;
    tickProduction(s, CONTENT, city, 40); // workshop done, 20 rolls to barracks (<30)
    expect(city.buildings).toEqual(['workshop']);
    expect(city.buildQueue).toEqual<BuildOrder[]>([{ kind: 'building', id: 'barracks', progress: 20 }]);
  });

  it('skips an illegal head (unmet prerequisite) with no production lost', () => {
    // foundry needs a workshop that is neither built nor ahead of it -> illegal head.
    const s = cityState({
      buildQueue: [
        { kind: 'building', id: 'foundry', progress: 0 },
        { kind: 'building', id: 'barracks', progress: 0 }, // cost 30
      ],
    });
    const city = s.cities[0]!;
    tickProduction(s, CONTENT, city, 30);
    expect(city.buildings).toEqual(['barracks']); // full 30 went to barracks, foundry skipped
    expect(city.buildQueue).toHaveLength(0);
  });

  it('skips a head already completed elsewhere', () => {
    const s = cityState({
      buildings: ['granary'],
      buildQueue: [
        { kind: 'building', id: 'granary', progress: 0 }, // already built -> skip
        { kind: 'building', id: 'workshop', progress: 0 }, // cost 20
      ],
    });
    const city = s.cities[0]!;
    tickProduction(s, CONTENT, city, 20);
    expect(city.buildings).toEqual(['granary', 'workshop']);
    expect(city.buildQueue).toHaveLength(0);
  });
});
