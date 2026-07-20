import { describe, expect, it } from 'vitest';
import { createGame } from './state';
import { advanceTurn, applyCommand } from './turn';
import type { GameSettings, PlayerSetup } from '../types';
import { CONTENT, FIXTURE_PLANES } from '../__fixtures__/content';

const PLAYER_ONE: PlayerSetup = {
  wizardId: 'test-wizard-one',
  retorts: ['test-retort'],
  startWorld: 'meridia',
  raceId: 'orc',
  human: true,
};

const PLAYER_TWO: PlayerSetup = {
  wizardId: 'test-wizard-two',
  retorts: [],
  startWorld: 'meridia',
  raceId: 'human',
  human: false,
};

function makeSettings(): GameSettings {
  return { seed: 8675309, mapSize: 'small', players: [PLAYER_ONE, PLAYER_TWO] };
}

describe('createGame', () => {
  it('is deterministic for a fixed settings object', () => {
    const settings = makeSettings();
    const gameA = createGame(settings, CONTENT);
    const gameB = createGame(settings, CONTENT);
    expect(gameA).toEqual(gameB);
  });

  it('produces the expected skeleton shape with new player fields', () => {
    const game = createGame(makeSettings(), CONTENT);
    expect(game.turn).toBe(1);
    expect(game.players).toHaveLength(2);
    expect(game.players[0]!).toMatchObject({
      id: 'player-0',
      mana: 20,
      gold: 100,
      knownSpells: [],
      research: { activeStudyId: null, progress: 0 },
      completedStudies: [],
    });
    expect(Object.keys(game.maps).sort()).toEqual(['meridia', 'umbra']);
    expect(game.rngState).toBeDefined();
    expect(game.nextEntityId).toBeGreaterThan(1);
  });

  it('founds one capital per player (population 3) on the right plane', () => {
    const game = createGame(makeSettings(), CONTENT);
    expect(game.cities).toHaveLength(2);
    for (const player of game.players) {
      const capital = game.cities.find((c) => c.owner === player.id);
      expect(capital).toBeDefined();
      expect(capital?.population).toBe(3);
      expect(capital?.plane).toBe(player.setup.startWorld);
      // Capital tile is passable, non-peak land.
      const map = game.maps[capital!.plane];
      const tile = map.tiles[capital!.y * map.width + capital!.x]!;
      expect(tile.terrain).not.toBe('ocean');
      expect(tile.terrain).not.toBe('shore');
      expect(tile.elevation).not.toBe(3);
    }
  });

  it('spawns a settler and a garrison per player; garrison is race-specific or militia', () => {
    const game = createGame(makeSettings(), CONTENT);
    for (const player of game.players) {
      const units = game.units.filter((u) => u.owner === player.id);
      const settlers = units.filter((u) => u.defId === 'settler');
      expect(settlers).toHaveLength(1);
      const garrison = units.filter((u) => u.defId !== 'settler');
      expect(garrison).toHaveLength(1);
    }
    // Orc's first racial unit is orc-warrior; human has none -> militia.
    const orc = game.players[0]!;
    const human = game.players[1]!;
    expect(game.units.some((u) => u.owner === orc.id && u.defId === 'orc-warrior')).toBe(true);
    expect(game.units.some((u) => u.owner === human.id && u.defId === 'militia')).toBe(true);
  });

  it('mints entity ids from a single never-reused counter', () => {
    const game = createGame(makeSettings(), CONTENT);
    const ids = [...game.cities.map((c) => c.id), ...game.units.map((u) => u.id)];
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(game.cities[0]!.id).toBe('city-1');
  });

  it('starts on different tiles for two players sharing a plane', () => {
    const game = createGame(makeSettings(), CONTENT);
    const a = game.cities[0]!;
    const b = game.cities[1]!;
    expect(a.x === b.x && a.y === b.y).toBe(false);
  });

  it('JSON round-trip deep-equals the original state', () => {
    const game = createGame(makeSettings(), CONTENT);
    const roundTripped = JSON.parse(JSON.stringify(game));
    expect(roundTripped).toEqual(game);
  });
});

describe('turn processing basics', () => {
  it('advanceTurn increments the turn counter', () => {
    const game = createGame(makeSettings(), CONTENT);
    expect(advanceTurn(game, CONTENT).turn).toBe(game.turn + 1);
  });

  it('advanceTurn does not mutate the input state', () => {
    const game = createGame(makeSettings(), CONTENT);
    const before = JSON.stringify(game);
    advanceTurn(game, CONTENT);
    expect(JSON.stringify(game)).toBe(before);
  });

  it('advanceTurn is deterministic', () => {
    const a = createGame(makeSettings(), CONTENT);
    const b = createGame(makeSettings(), CONTENT);
    expect(advanceTurn(a, CONTENT)).toEqual(advanceTurn(b, CONTENT));
  });

  it('end-turn advances the turn via the command pattern', () => {
    const game = createGame(makeSettings(), CONTENT);
    expect(applyCommand(game, CONTENT, 'player-0', { type: 'end-turn' }).turn).toBe(game.turn + 1);
  });

  it('only the FIXTURE_PLANES are generated', () => {
    const game = createGame(makeSettings(), CONTENT);
    expect(Object.keys(game.maps).sort()).toEqual(FIXTURE_PLANES.map((p) => p.id).sort());
  });
});
