import { describe, expect, it } from 'vitest';
import { createGame } from './state';
import { advanceTurn, applyCommand } from './turn';
import type { GameSettings, PlaneDef, PlayerSetup } from '../types';

// Inline minimal content — src/data is off-limits (written concurrently by
// other agents), so sim tests construct their own tiny fixtures.
const MERIDIA: PlaneDef = {
  id: 'meridia',
  name: 'Meridia',
  kind: 'world',
  thrivingSchools: ['chaos', 'nature', 'sorcery'],
  description: 'The normal world.',
};

const UMBRA: PlaneDef = {
  id: 'umbra',
  name: 'Umbra',
  kind: 'world',
  thrivingSchools: ['death'],
  description: 'The dark world.',
};

const PLANES: PlaneDef[] = [MERIDIA, UMBRA];

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
  raceId: 'orc',
  human: false,
};

function makeSettings(): GameSettings {
  return {
    seed: 8675309,
    mapSize: 'small',
    players: [PLAYER_ONE, PLAYER_TWO],
  };
}

describe('createGame', () => {
  it('is deterministic for a fixed settings object', () => {
    const settings = makeSettings();
    const content = { planes: PLANES };
    const gameA = createGame(settings, content);
    const gameB = createGame(settings, content);
    expect(gameA).toEqual(gameB);
  });

  it('produces the expected skeleton shape', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    expect(game.turn).toBe(1);
    expect(game.players).toHaveLength(2);
    expect(game.players[0]).toEqual({
      id: 'player-0',
      setup: PLAYER_ONE,
      mana: 0,
      gold: 0,
      knownSpells: [],
    });
    expect(Object.keys(game.maps).sort()).toEqual(['meridia', 'umbra']);
    expect(game.rngState).toBeDefined();
  });

  it('JSON round-trip deep-equals the original state', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    const roundTripped = JSON.parse(JSON.stringify(game));
    expect(roundTripped).toEqual(game);
  });
});

describe('turn processing', () => {
  it('advanceTurn increments the turn counter', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    const next = advanceTurn(game);
    expect(next.turn).toBe(game.turn + 1);
  });

  it('advanceTurn does not mutate the input state', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    const turnBefore = game.turn;
    advanceTurn(game);
    expect(game.turn).toBe(turnBefore);
  });

  it('advanceTurn is deterministic', () => {
    const gameA = createGame(makeSettings(), { planes: PLANES });
    const gameB = createGame(makeSettings(), { planes: PLANES });
    expect(advanceTurn(gameA)).toEqual(advanceTurn(gameB));
  });

  it('applyCommand end-turn advances the turn via the command pattern', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    const next = applyCommand(game, 'player-0', { type: 'end-turn' });
    expect(next.turn).toBe(game.turn + 1);
  });

  it('applyCommand noop returns state with no changes', () => {
    const game = createGame(makeSettings(), { planes: PLANES });
    const next = applyCommand(game, 'player-0', { type: 'noop' });
    expect(next).toEqual(game);
  });

  it('repeated end-turn commands accumulate turns deterministically', () => {
    let game = createGame(makeSettings(), { planes: PLANES });
    for (let i = 0; i < 5; i++) {
      game = applyCommand(game, 'player-0', { type: 'end-turn' });
    }
    expect(game.turn).toBe(6);
  });
});
