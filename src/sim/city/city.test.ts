import { describe, expect, it } from 'vitest';
import {
  computeCityYields,
  tickGrowth,
  tickProduction,
  canBuild,
  buildBlockReason,
  foundCity,
  cityPopulationCap,
  cityFoodPotentialCap,
  growthThreshold,
  catchmentTiles,
  workedTiles,
  ordinal,
  recordRaised,
  provenanceName,
  CATCHMENT_RADIUS,
} from './city';
import { CONTENT, makeMap, setTerrain, makeState, makePlayer, makeCity } from '../__fixtures__/content';
import type { GameState, GameContent } from '../core/state';
import type { UnitDef } from '../types';

// An 11x11 single-terrain Meridia map with an orc city at (5,5).
function terrainState(
  terrain: Parameters<typeof makeMap>[3] = 'grassland',
  over?: Partial<Parameters<typeof makeCity>[0]>,
): GameState {
  const map = makeMap('meridia', 11, 11, terrain);
  const player = makePlayer('player-0', 'orc');
  const city = makeCity({ owner: 'player-0', raceId: 'orc', x: 5, y: 5, ...over });
  return makeState({ maps: [map], players: [player], cities: [city] });
}

const key = (t: { x: number; y: number }): string => `${t.x},${t.y}`;

// ===========================================================================
// Catchment ownership
// ===========================================================================

describe('catchment', () => {
  it('is the in-bounds 5x5 block a lone city owns, always including its center', () => {
    const state = terrainState();
    const city = state.cities[0]!;
    const tiles = catchmentTiles(state, city);
    // 5x5 fully in bounds at (5,5) on an 11x11 map => 25 owned tiles.
    expect(tiles).toHaveLength((2 * CATCHMENT_RADIUS + 1) ** 2);
    expect(tiles.some((t) => t.x === 5 && t.y === 5)).toBe(true);
    for (const t of tiles) {
      expect(Math.max(Math.abs(t.x - 5), Math.abs(t.y - 5))).toBeLessThanOrEqual(CATCHMENT_RADIUS);
    }
  });

  it('assigns overlap to the earlier city; no tile is claimed (or worked) twice', () => {
    // Two cities 3 apart share catchment columns 6 and 7. City-1 is earlier in
    // state.cities, so it wins those tiles.
    const map = makeMap('meridia', 13, 11, 'grassland');
    const player = makePlayer('player-0', 'orc');
    const a = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 5, y: 5, population: 6 });
    const b = makeCity({ id: 'city-2', owner: 'player-0', raceId: 'orc', x: 8, y: 5, population: 6 });
    const state = makeState({ maps: [map], players: [player], cities: [a, b] });

    const aTiles = new Set(catchmentTiles(state, a).map(key));
    const bTiles = new Set(catchmentTiles(state, b).map(key));

    // Each city keeps its own center.
    expect(aTiles.has('5,5')).toBe(true);
    expect(bTiles.has('8,5')).toBe(true);
    // Disputed column 6/7 tiles belong to the earlier city only.
    expect(aTiles.has('6,5')).toBe(true);
    expect(aTiles.has('7,5')).toBe(true);
    expect(bTiles.has('6,5')).toBe(false);
    expect(bTiles.has('7,5')).toBe(false);
    // No tile is owned by both.
    for (const t of aTiles) expect(bTiles.has(t)).toBe(false);
    // ...and therefore no tile is worked by both.
    const aWorked = new Set(workedTiles(state, CONTENT, a).map(key));
    const bWorked = new Set(workedTiles(state, CONTENT, b).map(key));
    for (const t of aWorked) expect(bWorked.has(t)).toBe(false);
  });
});

// ===========================================================================
// Worked-tile selection (best-first, deterministic)
// ===========================================================================

describe('workedTiles', () => {
  it('picks the best tiles by desirability, center first', () => {
    // Desert base (desirability 3). Salt in one grassland (8), one forest (7),
    // one hills (6). A pop-2 city works its center plus the two best others:
    // grassland then forest, never the hills or a desert tile.
    const state = terrainState('desert', { population: 2 });
    const map = state.maps.meridia!;
    setTerrain(map, 5, 4, 'grassland'); // desirability 8
    setTerrain(map, 6, 5, 'forest'); //    desirability 7
    setTerrain(map, 5, 6, 'hills'); //     desirability 6
    const worked = workedTiles(state, CONTENT, state.cities[0]!).map(key);
    expect(worked).toEqual(['5,5', '5,4', '6,5']);
  });

  it('breaks desirability ties by tile index (row-major)', () => {
    // Two equal-desirability forests; the lower row-major index wins.
    const state = terrainState('desert', { population: 1 });
    const map = state.maps.meridia!;
    setTerrain(map, 5, 4, 'forest'); // index 4*11+5 = 49
    setTerrain(map, 4, 5, 'forest'); // index 5*11+4 = 59
    const worked = workedTiles(state, CONTENT, state.cities[0]!).map(key);
    expect(worked).toEqual(['5,5', '5,4']);
  });
});

// ===========================================================================
// Yields — hand-computed
// ===========================================================================

describe('computeCityYields — hand-computed arithmetic', () => {
  it('orc city, pop 3, catchment all grassland', () => {
    // Worked = center + 3 grassland = 4 tiles x {food:2} => food 8.
    // Civic per pop {research:1, gold:0.5, production:0.5}: pop 3 =>
    //   research 3, gold 1.5, production 1.5 (town labor floor).
    // raw = { food:8, production:1.5, gold:1.5, research:3, mana:0 }.
    // Orc race multipliers are all 1.0; no buildings/studies. Floor each axis:
    //   { food:8, production:1, gold:1, research:3, mana:0 }.
    const state = terrainState('grassland', { population: 3 });
    expect(computeCityYields(state, CONTENT, state.cities[0]!)).toEqual({
      food: 8,
      production: 1,
      gold: 1,
      research: 3,
      mana: 0,
    });
  });

  it('applies a building flat then a completed-study multiplier', () => {
    // workshop adds +2 production flat; gold-magic multiplies gold x2.
    //   production: (raw 1.5 civic labor)*1 + 2 = 3.5 -> floor 3
    //   gold:       (raw 1.5)*1                -> x2 = 3 -> floor 3
    const state = terrainState('grassland', { population: 3, buildings: ['workshop'] });
    state.players[0]!.completedStudies = ['gold-magic'];
    const y = computeCityYields(state, CONTENT, state.cities[0]!);
    expect(y.production).toBe(3);
    expect(y.gold).toBe(3);
    expect(y.food).toBe(8); // unchanged
  });

  it('sums flats before multipliers (foundry multiplies the workshop flat)', () => {
    // production: (1.5 civic + 2 workshop) * 1.5 foundry = 5.25 -> floor 5
    const state = terrainState('grassland', { population: 3, buildings: ['workshop', 'foundry'] });
    expect(computeCityYields(state, CONTENT, state.cities[0]!).production).toBe(5);
  });

  it('terrain matters: a grassland site out-eats a tundra site ~2:1+', () => {
    const gs = terrainState('grassland', { population: 3 });
    const ts = terrainState('tundra', { population: 3 });
    const grass = computeCityYields(gs, CONTENT, gs.cities[0]!);
    const tundra = computeCityYields(ts, CONTENT, ts.cities[0]!);
    expect(grass.food).toBeGreaterThanOrEqual(tundra.food * 2);
  });
});

// ===========================================================================
// Growth, food-potential cap, and starvation
// ===========================================================================

describe('growth and the food-potential cap', () => {
  it('accumulates surplus toward the next population point', () => {
    // Grassland pop 3: computeCityYields food = 8, surplus = 8 - 3 = 5.
    // threshold(3) = 10 + 2*3 = 16 (orc growthRate 1.0).
    const state = terrainState('grassland', { population: 3 });
    const city = state.cities[0]!;
    expect(growthThreshold(3)).toBe(16);
    tickGrowth(state, CONTENT, city, 8); // progress 5
    expect(city.population).toBe(3);
    expect(city.growthProgress).toBe(5);
    tickGrowth(state, CONTENT, city, 8); // progress 10
    tickGrowth(state, CONTENT, city, 8); // progress 15
    expect(city.population).toBe(3);
    tickGrowth(state, CONTENT, city, 8); // 20 >= 16 -> pop 4, carry 4
    expect(city.population).toBe(4);
    expect(city.growthProgress).toBe(4);
  });

  it('rich land caps high; housing binds first on grassland', () => {
    const state = terrainState('grassland', { population: 3 });
    const city = state.cities[0]!;
    // Grassland (food 2 per tile) can feed far more than housing allows.
    expect(cityFoodPotentialCap(state, CONTENT, city)).toBeGreaterThan(20);
    // So the effective cap is the housing limit (10 with no housing buildings).
    expect(cityPopulationCap(state, CONTENT, city)).toBe(10);

    // A granary (+4 housing) raises the effective cap; growth resumes past 10.
    const capped = terrainState('grassland', { population: 10, buildings: ['granary'] });
    expect(cityPopulationCap(capped, CONTENT, capped.cities[0]!)).toBe(14);
    tickGrowth(capped, CONTENT, capped.cities[0]!, 100);
    expect(capped.cities[0]!.population).toBeGreaterThan(10);
  });

  it('poor land caps low and holds steady with zero starvation thrash', () => {
    // Pure tundra (food 0.5 per tile) can only ever feed ~1 pop.
    const state = terrainState('tundra', { population: 1 });
    const city = state.cities[0]!;
    expect(cityFoodPotentialCap(state, CONTENT, city)).toBe(1);
    expect(cityPopulationCap(state, CONTENT, city)).toBe(1);

    // Run many turns from the true food yield: population never oscillates.
    const seen: number[] = [];
    for (let t = 0; t < 8; t++) {
      const food = computeCityYields(state, CONTENT, city).food;
      tickGrowth(state, CONTENT, city, food);
      seen.push(city.population);
    }
    expect(seen).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(city.growthProgress).toBe(0);
  });

  it('an overlarge city on poor land shrinks to its cap, then stops (no thrash)', () => {
    // A tundra site seeded at pop 3 starves down to 1 and stabilizes there.
    const state = terrainState('tundra', { population: 3 });
    const city = state.cities[0]!;
    const seen: number[] = [];
    for (let t = 0; t < 8; t++) {
      const food = computeCityYields(state, CONTENT, city).food;
      tickGrowth(state, CONTENT, city, food);
      seen.push(city.population);
    }
    expect(seen).toEqual([2, 1, 1, 1, 1, 1, 1, 1]);
    // Monotone non-increasing, then flat — never a shrink-then-grow bounce.
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeLessThanOrEqual(seen[i - 1]!);
  });

  it('starvation drains progress and shrinks population, never below 1', () => {
    const state = terrainState('grassland', { population: 3 });
    const city = state.cities[0]!;
    tickGrowth(state, CONTENT, city, 1); // surplus 1-3 = -2 -> shrink
    expect(city.population).toBe(2);
    expect(city.growthProgress).toBe(0);
    city.population = 1;
    tickGrowth(state, CONTENT, city, 0); // cannot drop below 1
    expect(city.population).toBe(1);
  });
});

// ===========================================================================
// Production tick + regiment provenance
// ===========================================================================

describe('production tick', () => {
  it('completes a building, then a unit that appears on the map', () => {
    const state = terrainState('grassland');
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
  });

  it('accumulates production across turns before completing', () => {
    const state = terrainState('grassland');
    const city = state.cities[0]!;
    city.buildQueue = [{ kind: 'building', id: 'barracks', progress: 0 }]; // cost 30
    tickProduction(state, CONTENT, city, 15);
    expect(city.buildings).not.toContain('barracks');
    expect(city.buildQueue[0]!.progress).toBe(15);
    tickProduction(state, CONTENT, city, 20); // 35 >= 30
    expect(city.buildings).toContain('barracks');
  });

  it('names each completed regiment by home and order of muster', () => {
    const state = terrainState('grassland', { name: 'Testburg' });
    const city = state.cities[0]!;
    state.players[0]!.completedStudies = ['war-drums']; // unlock orc-warrior

    const raise = (id: string, cost: number): string => {
      city.buildQueue = [{ kind: 'unit', id, progress: 0 }];
      tickProduction(state, CONTENT, city, cost);
      return state.units[state.units.length - 1]!.name!;
    };

    expect(raise('militia', 10)).toBe('1st Testburg Militia');
    expect(raise('militia', 10)).toBe('2nd Testburg Militia');
    expect(raise('militia', 10)).toBe('3rd Testburg Militia');
    // A different def keeps its own independent counter.
    expect(raise('orc-warrior', 20)).toBe('1st Testburg Orc Warrior');
    expect(raise('orc-warrior', 20)).toBe('2nd Testburg Orc Warrior');
    expect(city.raised).toEqual({ militia: 3, 'orc-warrior': 2 });
  });
});

describe('provenance helpers', () => {
  it('ordinal handles 1st/2nd/3rd, the 11-13 exception, and 21st+', () => {
    expect([1, 2, 3, 4, 5, 11, 12, 13, 21, 22, 23, 100, 101, 111, 113].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '100th',
      '101st',
      '111th',
      '113th',
    ]);
  });

  it('recordRaised lazily initializes and increments; provenanceName reads it', () => {
    const city = makeCity({ owner: 'player-0', raceId: 'orc', name: 'Grimfang' });
    expect(city.raised).toBeUndefined();
    expect(recordRaised(city, 'militia')).toBe(1);
    expect(recordRaised(city, 'militia')).toBe(2);
    expect(city.raised).toEqual({ militia: 2 });
    const militia = CONTENT.units['militia']!;
    expect(provenanceName(city, militia)).toBe('2nd Grimfang Militia');
    // With no record, provenanceName defaults to a 1st muster.
    expect(provenanceName(makeCity({ owner: 'p', raceId: 'orc', name: 'Ashgut' }), militia)).toBe(
      '1st Ashgut Militia',
    );
  });
});

// ===========================================================================
// Buildability — requires-chains, study gates, summons & monsters
// ===========================================================================

describe('canBuild / buildBlockReason', () => {
  it('rejects a building the race cannot construct', () => {
    const state = terrainState('grassland');
    expect(canBuild(state, CONTENT, state.cities[0]!, 'grand-cathedral')).toBe(false);
    expect(buildBlockReason(state, CONTENT, state.cities[0]!, 'building', 'grand-cathedral')).toMatch(
      /cannot build/i,
    );
  });

  it('rejects an unmet requires-chain, allows it once satisfied', () => {
    const state = terrainState('grassland');
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'foundry')).toBe(false); // needs workshop
    city.buildings = ['workshop'];
    expect(canBuild(state, CONTENT, city, 'foundry')).toBe(true);
  });

  it('rejects a study-gated building until the study is completed', () => {
    const state = terrainState('grassland');
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'wizard-tower')).toBe(false);
    state.players[0]!.completedStudies = ['arcane-arts'];
    expect(canBuild(state, CONTENT, city, 'wizard-tower')).toBe(true);
  });

  it('rejects an already-built building', () => {
    const state = terrainState('grassland', { buildings: ['workshop'] });
    expect(canBuild(state, CONTENT, state.cities[0]!, 'workshop')).toBe(false);
  });

  it('gates a study-locked unit and allows generic units', () => {
    const state = terrainState('grassland');
    const city = state.cities[0]!;
    expect(canBuild(state, CONTENT, city, 'orc-warrior')).toBe(false); // needs war-drums
    state.players[0]!.completedStudies = ['war-drums'];
    expect(canBuild(state, CONTENT, city, 'orc-warrior')).toBe(true);
    expect(canBuild(state, CONTENT, city, 'militia')).toBe(true);
    expect(canBuild(state, CONTENT, city, 'settler')).toBe(true);
  });

  it('never allows summons or monsters to be trained in a city', () => {
    const state = terrainState('grassland');
    const city = state.cities[0]!;

    // fire-elemental is a Chaos summon.
    expect(canBuild(state, CONTENT, city, 'fire-elemental')).toBe(false);
    expect(buildBlockReason(state, CONTENT, city, 'unit', 'fire-elemental')).toMatch(/summon/i);

    // A wild monster (generic origin, role 'monster') is equally barred.
    const troll: UnitDef = {
      id: 'wild-troll',
      name: 'Wild Troll',
      role: 'monster',
      origin: { generic: true },
      combat: {
        figures: 4,
        hits: 6,
        melee: { attack: 6, damage: 4, reach: 1 },
        armor: 3,
        speed: 2,
        mass: 3,
        morale: 60,
        discipline: 40,
      },
      moves: 1,
      skill: 20,
      upkeep: {},
      abilities: [{ type: 'regeneration', perTick: 1 }],
      description: 'A wilderness rampager, never trained.',
    };
    const content: GameContent = { ...CONTENT, units: { ...CONTENT.units, 'wild-troll': troll } };
    expect(canBuild(state, content, city, 'wild-troll')).toBe(false);
    expect(buildBlockReason(state, content, city, 'unit', 'wild-troll')).toMatch(/not trained/i);
  });
});

// ===========================================================================
// City founding
// ===========================================================================

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

  it('rejects water, peaks, too-close sites, and out-of-bounds', () => {
    const state = baseState();
    foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 6, 6, 'First');
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 2, 2, 'Sea')).toThrow(/water/i);
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 3, 2, 'Peak')).toThrow(/peak/i);
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 7, 7, 'Cramped')).toThrow(/apart/i);
    expect(() => foundCity(state, CONTENT, 'player-0', 'orc', 'meridia', 99, 99, 'Void')).toThrow(/bounds/i);
  });
});
