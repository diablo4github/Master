import { describe, expect, it } from 'vitest';
import { createGame } from './state';
import { applyCommand } from './turn';
import { pickCityName } from '../city/city';
import { CONTENT, makeMap, makeState, makePlayer, makeCity } from '../__fixtures__/content';
import type { GameSettings, UnitState } from '../types';

const ORC_NAMES = ['Grimfang', 'Bloodrock', 'Skullcleft', 'Ironmaw', 'Ashgut'];

describe('pickCityName — deterministic next-unused draw', () => {
  it('draws the first list name not already in use, scanning all cities', () => {
    const s = makeState({
      maps: [makeMap('meridia', 8, 8)],
      players: [makePlayer('player-0', 'orc')],
      cities: [
        makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', name: 'Grimfang' }),
        makeCity({ id: 'city-2', owner: 'player-0', raceId: 'orc', name: 'Bloodrock' }),
      ],
    });
    expect(pickCityName(s, CONTENT.races['orc']!)).toBe('Skullcleft');
  });

  it('falls back to numbered variants of the first name once the list is exhausted', () => {
    const cities = ORC_NAMES.map((name, i) =>
      makeCity({ id: `city-${i}`, owner: 'player-0', raceId: 'orc', name }),
    );
    const s = makeState({
      maps: [makeMap('meridia', 8, 8)],
      players: [makePlayer('player-0', 'orc')],
      cities,
    });
    // All five base names used -> next is '<first> II', then 'III', ...
    expect(pickCityName(s, CONTENT.races['orc']!)).toBe('Grimfang II');
    s.cities.push(makeCity({ id: 'city-x', owner: 'player-0', raceId: 'orc', name: 'Grimfang II' }));
    expect(pickCityName(s, CONTENT.races['orc']!)).toBe('Grimfang III');
  });
});

describe('capital naming at game start', () => {
  function settings(players: GameSettings['players']): GameSettings {
    return { seed: 4242, mapSize: 'small', players };
  }
  const ORC = { wizardId: 'w1', retorts: [], startWorld: 'meridia' as const, raceId: 'orc', human: true };

  it('capitals draw the first free themed names, deterministically', () => {
    const game = createGame(settings([ORC, { ...ORC, wizardId: 'w2' }]), CONTENT);
    const names = game.cities.map((c) => c.name).sort();
    // Two orc capitals -> the first two orc names, in order.
    expect(names).toEqual(['Bloodrock', 'Grimfang']);
    // Deterministic across runs.
    const again = createGame(settings([ORC, { ...ORC, wizardId: 'w2' }]), CONTENT);
    expect(again.cities.map((c) => c.name)).toEqual(game.cities.map((c) => c.name));
  });
});

describe('found-city naming', () => {
  function controlled() {
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', name: 'Testburg', x: 2, y: 2 });
    const settler: UnitState = {
      id: 'unit-1', owner: 'player-0', defId: 'settler', plane: 'meridia', x: 8, y: 8, moves: 2, hp: 8,
    };
    return makeState({ maps: [map], players: [player], cities: [city], units: [settler], nextEntityId: 5 });
  }

  it('uses a player-typed name verbatim', () => {
    const next = applyCommand(controlled(), CONTENT, 'player-0', {
      type: 'found-city', unitId: 'unit-1', name: 'Rivertown',
    });
    expect(next.cities.some((c) => c.name === 'Rivertown' && c.x === 8 && c.y === 8)).toBe(true);
  });

  it('auto-draws the next free race name when the name is omitted', () => {
    const next = applyCommand(controlled(), CONTENT, 'player-0', {
      type: 'found-city', unitId: 'unit-1',
    });
    // 'Testburg' is not in the orc list, so the first free orc name is drawn.
    expect(next.cities.some((c) => c.name === 'Grimfang' && c.x === 8 && c.y === 8)).toBe(true);
  });
});
