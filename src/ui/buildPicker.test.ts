import { describe, expect, it } from 'vitest';

import {
  CONTENT,
  makeMap,
  makeState,
  makePlayer,
  makeCity,
} from '@sim/__fixtures__/content';
import { assembleBuildOptions } from './buildPicker';

/** A one-city orc game on a grassland map, no studies completed. */
function orcGame() {
  const map = makeMap('meridia', 12, 12, 'grassland');
  const player = makePlayer('player-0', 'orc');
  const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 5, y: 5 });
  const state = makeState({ maps: [map], players: [player], cities: [city] });
  return { state, city };
}

describe('assembleBuildOptions', () => {
  it('lists the race\'s buildings and trainable units, buildings before units', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    const kinds = opts.map((o) => o.kind);
    const firstUnit = kinds.indexOf('unit');
    const lastBuilding = kinds.lastIndexOf('building');
    expect(firstUnit).toBeGreaterThan(-1);
    expect(lastBuilding).toBeLessThan(firstUnit); // all buildings precede all units
  });

  it('marks a buildable tier-1 building as buildable', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    const granary = opts.find((o) => o.id === 'granary');
    expect(granary?.buildable).toBe(true);
    expect(granary?.reason).toBeNull();
  });

  it('locks a building whose prerequisite building is missing, with a reason', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    // fixture: foundry requires workshop, which is not yet built.
    const foundry = opts.find((o) => o.id === 'foundry');
    expect(foundry?.buildable).toBe(false);
    expect(foundry?.reason).toMatch(/workshop/i);
  });

  it('locks a study-gated building until its study is researched', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    // fixture: wizard-tower is gated by the arcane-arts study.
    const tower = opts.find((o) => o.id === 'wizard-tower');
    expect(tower?.buildable).toBe(false);
    expect(tower?.reason).toMatch(/study/i);
  });

  it('locks a study-gated racial unit, but allows generic units', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    const settler = opts.find((o) => o.id === 'settler');
    const militia = opts.find((o) => o.id === 'militia');
    const orcWarrior = opts.find((o) => o.id === 'orc-warrior');
    expect(settler?.buildable).toBe(true);
    expect(militia?.buildable).toBe(true);
    // fixture: orc-warrior is gated by the war-drums study.
    expect(orcWarrior?.buildable).toBe(false);
  });

  it('excludes summons entirely', () => {
    const { state, city } = orcGame();
    const opts = assembleBuildOptions(state, CONTENT, city);
    expect(opts.find((o) => o.id === 'fire-elemental')).toBeUndefined();
  });

  it('unlocks the study-gated building once its study is completed', () => {
    const { state, city } = orcGame();
    const player = state.players[0]!;
    player.completedStudies = ['arcane-arts'];
    const opts = assembleBuildOptions(state, CONTENT, city);
    const tower = opts.find((o) => o.id === 'wizard-tower');
    expect(tower?.buildable).toBe(true);
  });
});
