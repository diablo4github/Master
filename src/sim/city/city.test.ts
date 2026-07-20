import { describe, expect, it } from 'vitest';
import {
  computeCityYields,
  tickGrowth,
  tickProduction,
  canBuild,
  buildBlockReason,
  foundCity,
  cityPopulationCap,
  growthThreshold,
} from './city';
import { CONTENT, makeMap, setTerrain, makeState, makePlayer, makeCity } from '../__fixtures__/content';
import type { GameState } from '../core/state';

// A 11x11 all-grassland Meridia map; a city sits at (5,5) with 8 grassland
// neighbors, so terrain contributions are exactly +1 food each.
function grasslandState(over?: Partial<Parameters<typeof makeCity>[0]>): GameState {
  const map = makeMap('meridia', 11, 11, 'grassland');
  const player = makePlayer('player-0', 'orc');
  const city = makeCity({ owner: 'player-0', raceId: 'orc', x: 5, y: 5, ...over });
  return makeState({ maps: [map], players: [player], cities: [city] });
}

describe('computeCityYields — hand-computed arithmetic', () => {
  it('bare orc city, pop 3, surrounded by 8 grassland', () => {
    // Base per pop (orc yields all 1.0): pop 3 =>
    //   food 3*2=6, prod 3*2=6, gold 3*2=6, research 3*1=3, mana 3*0.5=1.5
    // Terrain: 8 grassland * {food:1} => +8 food.
    //   food 6+8=14, prod 6, gold 6, research 3, mana 1.5
    // No buildings, no studies; multipliers all 1. Floor per axis:
    //   { food:14, production:6, gold:6, research:3, mana:1 }
    const state = grasslandState();
    expect(computeCityYields(state, CONTENT, state.cities[0]!)).toEqual({
      food: 14,
      production: 6,
      gold: 6,
      research: 3,
      mana: 1,
    });
  });

  it('applies building flats then a completed-study gold multiplier', () => {
    // Add a workshop (+2 prod flat) and complete gold-magic (gold x2).
    //   prod flat 6+2=8 -> floor 8
    //   gold flat 6, mult x2 -> floor 12
    const state = grasslandState({ buildings: ['workshop'] });
    state.players[0]!.completedStudies = ['gold-magic'];
    const y = computeCityYields(state, CONTENT, state.cities[0]!);
    expect(y.production).toBe(8);
    expect(y.gold).toBe(12);
    expect(y.food).toBe(14); // unchanged
  });

  it('flats are summed before multipliers (foundry multiplies workshop flat)', () => {
    // workshop(+2 prod) then foundry(x1.5): (6+2)*1.5 = 12 -> floor 12
    const state = grasslandState({ buildings: ['workshop', 'foundry'] });
    expect(computeCityYields(state, CONTENT, state.cities[0]!).production).toBe(12);
  });
});

describe('growth and starvation', () => {
  it('reaches pop+1 on the expected schedule', () => {
    // pop 3, food 14 => surplus = 14 - 3 = 11 (orc growthRate 1.0).
    // threshold(3) = 10 + 2*3 = 16.
    const state = grasslandState();
    const city = state.cities[0]!;
    expect(growthThreshold(3)).toBe(16);

    tickGrowth(state, CONTENT, city, 14); // progress 11 (< 16, no growth)
    expect(city.population).toBe(3);
    expect(city.growthProgress).toBe(11);

    tickGrowth(state, CONTENT, city, 14); // progress 22 >= 16 -> pop 4, carry 6
    expect(city.population).toBe(4);
    expect(city.growthProgress).toBe(6);
  });

  it('respects the housing cap', () => {
    // No housing -> cap = 10. A pop-10 city cannot grow.
    const state = grasslandState({ population: 10 });
    const city = state.cities[0]!;
    expect(cityPopulationCap(state, CONTENT, city)).toBe(10);
    tickGrowth(state, CONTENT, city, 100); // huge surplus
    expect(city.population).toBe(10);
    expect(city.growthProgress).toBe(0);

    // Granary adds +4 housing -> cap 14, growth resumes.
    city.buildings = ['granary'];
    expect(cityPopulationCap(state, CONTENT, city)).toBe(14);
    tickGrowth(state, CONTENT, city, 100);
    expect(city.population).toBeGreaterThan(10);
  });

  it('starvation drains progress and shrinks population, never below 1', () => {
    const state = grasslandState({ population: 3, growthProgress: 0 });
    const city = state.cities[0]!;
    tickGrowth(state, CONTENT, city, 1); // surplus 1-3 = -2 -> shrink
    expect(city.population).toBe(2);
    expect(city.growthProgress).toBe(0);

    city.population = 1;
    tickGrowth(state, CONTENT, city, 0); // surplus -1, cannot drop below 1
    expect(city.population).toBe(1);
  });
});

describe('production tick', () => {
  it('completes a building, then a unit that appears on the map', () => {
    const state = grasslandState();
    const city = state.cities[0]!;

    city.buildQueue = [{ kind: 'building', id: 'workshop', progress: 0 }];
    tickProduction(state, CONTENT, city, 20); // workshop cost 20
    expect(city.buildings).toContain('workshop');
    expect(city.buildQueue).toHaveLength(0);

    city.buildQueue = [{ kind: 'unit', id: 'militia', progress: 0 }];
    const before = state.units.length;
    tickProduction(state, CONTENT, city, 10); // militia cost 10
    expect(state.units).toHaveLength(before + 1);
    const spawned = state.units[state.units.length - 1]!;
    expect(spawned.defId).toBe('militia');
    expect(spawned.x).toBe(city.x);
    expect(spawned.y).toBe(city.y);
    expect(spawned.moves).toBe(1); // militia moves
    expect(spawned.hp).toBe(18); // militia figures 6 × hits 3
  });

  it('accumulates production across turns before completing', () => {
    const state = grasslandState();
    const city = state.cities[0]!;
    city.buildQueue = [{ kind: 'building', id: 'foundry', progress: 0 }]; // cost 40
    tickProduction(state, CONTENT, city, 15);
    expect(city.buildings).not.toContain('foundry');
    expect(city.buildQueue[0]!.progress).toBe(15);
    tickProduction(state, CONTENT, city, 30); // 45 >= 40
    expect(city.buildings).toContain('foundry');
  });
});

describe('canBuild / buildBlockReason', () => {
  it('rejects a building the race cannot construct', () => {
    const state = grasslandState();
    // grand-cathedral is human-only; the city is orc.
    expect(canBuild(state, CONTENT, state.cities[0]!, 'grand-cathedral')).toBe(false);
    expect(buildBlockReason(state, CONTENT, state.cities[0]!, 'building', 'grand-cathedral')).toMatch(
      /cannot build/i,
    );
  });

  it('rejects an unmet requires-chain, allows it once satisfied', () => {
    const state = grasslandState();
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'foundry')).toBe(false); // needs workshop
    city.buildings = ['workshop'];
    expect(canBuild(state, CONTENT, city, 'foundry')).toBe(true);
  });

  it('rejects a study-gated building until the study is completed', () => {
    const state = grasslandState();
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'wizard-tower')).toBe(false);
    state.players[0]!.completedStudies = ['arcane-arts'];
    expect(canBuild(state, CONTENT, city, 'wizard-tower')).toBe(true);
  });

  it('rejects an already-built building', () => {
    const state = grasslandState({ buildings: ['workshop'] });
    expect(canBuild(state, CONTENT, state.cities[0]!, 'workshop')).toBe(false);
  });

  it('gates a study-locked unit and refuses summons', () => {
    const state = grasslandState();
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'orc-warrior')).toBe(false); // needs war-drums
    state.players[0]!.completedStudies = ['war-drums'];
    expect(canBuild(state, CONTENT, city, 'orc-warrior')).toBe(true);
    // Summons are never trainable in a city.
    expect(canBuild(state, CONTENT, city, 'fire-elemental')).toBe(false);
    expect(buildBlockReason(state, CONTENT, city, 'unit', 'fire-elemental')).toMatch(/summon/i);
  });

  it('allows generic units regardless of race', () => {
    const state = grasslandState();
    expect(canBuild(state, CONTENT, state.cities[0]!, 'militia')).toBe(true);
    expect(canBuild(state, CONTENT, state.cities[0]!, 'settler')).toBe(true);
  });
});

describe('foundCity validation', () => {
  function baseState(): GameState {
    const map = makeMap('meridia', 12, 12, 'grassland');
    setTerrain(map, 2, 2, 'ocean');
    setTerrain(map, 3, 2, 'mountains'); // peak (elevation 3)
    const player = makePlayer('player-0', 'orc');
    return makeState({ maps: [map], players: [player], cities: [], nextEntityId: 1 });
  }

  it('founds a city on valid land and mints an id', () => {
    const state = baseState();
    const city = foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 6, 6, 'New Town');
    expect(city.id).toBe('city-1');
    expect(state.cities).toHaveLength(1);
    expect(city.population).toBe(1);
  });

  it('rejects water, peaks, and too-close sites', () => {
    const state = baseState();
    foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 6, 6, 'First');
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 2, 2, 'Sea')).toThrow(/water/i);
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 3, 2, 'Peak')).toThrow(/peak/i);
    // (7,7) is Chebyshev distance 1 from First at (6,6) -> too close.
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 7, 7, 'Cramped')).toThrow(
      /apart/i,
    );
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 99, 99, 'Void')).toThrow(
      /bounds/i,
    );
  });
});
