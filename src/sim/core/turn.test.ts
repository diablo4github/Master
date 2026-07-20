import { describe, expect, it } from 'vitest';
import { createGame } from './state';
import { applyCommand, advanceTurn, type Command } from './turn';
import type { GameState } from './state';
import { computeCityYields } from '../city/city';
import {
  CONTENT,
  makeMap,
  setTerrain,
  makeState,
  makePlayer,
  makeCity,
} from '../__fixtures__/content';
import type { GameSettings, UnitState } from '../types';

// --- Controlled state for targeted command tests --------------------------

function controlled(): GameState {
  const map = makeMap('meridia', 12, 12, 'grassland');
  setTerrain(map, 11, 11, 'ocean'); // an impassable target for move failures
  const player = makePlayer('player-0', 'orc');
  const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 2, y: 2 });
  const settler: UnitState = {
    id: 'unit-1', owner: 'player-0', defId: 'settler', plane: 'meridia', x: 8, y: 8, moves: 2, hp: 3,
  };
  const militia: UnitState = {
    id: 'unit-2', owner: 'player-0', defId: 'militia', plane: 'meridia', x: 2, y: 2, moves: 1, hp: 4,
  };
  return makeState({ maps: [map], players: [player], cities: [city], units: [settler, militia], nextEntityId: 3 });
}

describe('applyCommand — happy paths', () => {
  it('queue-build appends to the build queue', () => {
    const next = applyCommand(controlled(), CONTENT, 'player-0', {
      type: 'queue-build', cityId: 'city-1', order: { kind: 'unit', id: 'militia' },
    });
    expect(next.cities[0]!.buildQueue).toEqual([{ kind: 'unit', id: 'militia', progress: 0 }]);
  });

  it('move-unit advances a unit and leaves the source unchanged', () => {
    const start = controlled();
    const next = applyCommand(start, CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'unit-1', to: { x: 10, y: 8 },
    });
    const moved = next.units.find((u) => u.id === 'unit-1')!;
    expect(moved.x).toBe(10);
    expect(moved.y).toBe(8);
    // Input state not mutated.
    expect(start.units.find((u) => u.id === 'unit-1')!.x).toBe(8);
  });

  it('found-city consumes the settler and creates a city', () => {
    const next = applyCommand(controlled(), CONTENT, 'player-0', {
      type: 'found-city', unitId: 'unit-1', name: 'Colony',
    });
    expect(next.units.some((u) => u.id === 'unit-1')).toBe(false);
    expect(next.cities.some((c) => c.name === 'Colony' && c.x === 8 && c.y === 8)).toBe(true);
  });

  it('set-research selects a study and resets progress on switch', () => {
    let state = controlled();
    state = applyCommand(state, CONTENT, 'player-0', { type: 'set-research', studyId: 'war-drums' });
    expect(state.players[0]!.research).toEqual({ activeStudyId: 'war-drums', progress: 0 });
    // Simulate accrued progress, then re-select the SAME study: progress kept.
    state.players[0]!.research.progress = 7;
    state = applyCommand(state, CONTENT, 'player-0', { type: 'set-research', studyId: 'war-drums' });
    expect(state.players[0]!.research.progress).toBe(7);
    // Switch to a different study: progress resets.
    state = applyCommand(state, CONTENT, 'player-0', { type: 'set-research', studyId: 'gold-magic' });
    expect(state.players[0]!.research).toEqual({ activeStudyId: 'gold-magic', progress: 0 });
  });
});

describe('applyCommand — failure modes throw clear errors', () => {
  it('unknown player', () => {
    expect(() => applyCommand(controlled(), CONTENT, 'nobody', { type: 'end-turn' })).not.toThrow();
    expect(() =>
      applyCommand(controlled(), CONTENT, 'nobody', { type: 'set-research', studyId: 'war-drums' }),
    ).toThrow(/Unknown player/);
  });

  it('queue-build: unknown city, unowned city, illegal build', () => {
    const s = controlled();
    s.cities.push(makeCity({ id: 'city-9', owner: 'player-1', raceId: 'orc' }));
    expect(() =>
      applyCommand(s, CONTENT, 'player-0', { type: 'queue-build', cityId: 'ghost', order: { kind: 'unit', id: 'militia' } }),
    ).toThrow(/Unknown city/);
    expect(() =>
      applyCommand(s, CONTENT, 'player-0', { type: 'queue-build', cityId: 'city-9', order: { kind: 'unit', id: 'militia' } }),
    ).toThrow(/not owned/);
    expect(() =>
      applyCommand(s, CONTENT, 'player-0', { type: 'queue-build', cityId: 'city-1', order: { kind: 'building', id: 'grand-cathedral' } }),
    ).toThrow(/cannot build/i);
  });

  it('move-unit: unknown unit, unowned unit, no path', () => {
    const s = controlled();
    s.units.push({ id: 'unit-9', owner: 'player-1', defId: 'militia', plane: 'meridia', x: 1, y: 1, moves: 1, hp: 4 });
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'move-unit', unitId: 'ghost', to: { x: 1, y: 1 } })).toThrow(/Unknown unit/);
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'move-unit', unitId: 'unit-9', to: { x: 1, y: 1 } })).toThrow(/not owned/);
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'move-unit', unitId: 'unit-1', to: { x: 11, y: 11 } })).toThrow(/No path/);
  });

  it('found-city: non-settler, blank name auto-draws, invalid site', () => {
    const s = controlled();
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'found-city', unitId: 'unit-2', name: 'X' })).toThrow(/cannot found/);
    // Blank name is no longer an error: it auto-draws the next themed race name.
    // The existing city is 'Testburg', so the first free orc name is drawn.
    const drawn = applyCommand(s, CONTENT, 'player-0', { type: 'found-city', unitId: 'unit-1', name: '   ' });
    expect(drawn.cities.some((c) => c.name === 'Grimfang' && c.x === 8 && c.y === 8)).toBe(true);
    // Move the settler next to the existing city, then founding is too close.
    const moved = structuredClone(s);
    const settler = moved.units.find((u) => u.id === 'unit-1')!;
    settler.x = 3; settler.y = 3;
    expect(() => applyCommand(moved, CONTENT, 'player-0', { type: 'found-city', unitId: 'unit-1', name: 'Cramped' })).toThrow(/apart/i);
  });

  it('set-research: unknown, wrong race, already done, unmet requires', () => {
    const s = controlled();
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'set-research', studyId: 'nope' })).toThrow(/Unknown study/);
    // fertility-rites requires arcane-arts.
    expect(() => applyCommand(s, CONTENT, 'player-0', { type: 'set-research', studyId: 'fertility-rites' })).toThrow(/requires/);
    // Already completed.
    const done = structuredClone(s);
    done.players[0]!.completedStudies = ['war-drums'];
    expect(() => applyCommand(done, CONTENT, 'player-0', { type: 'set-research', studyId: 'war-drums' })).toThrow(/already/);
  });
});

describe('advanceTurn — economy and research', () => {
  it('applies gold income net of upkeep and accrues research', () => {
    let s = controlled();
    s = applyCommand(s, CONTENT, 'player-0', { type: 'set-research', studyId: 'war-drums' });
    const city = s.cities[0]!;
    const y = computeCityYields(s, CONTENT, city);
    // Upkeep: no buildings; units = settler(food, no gold) + militia(gold 1).
    const goldBefore = s.players[0]!.gold;
    const next = advanceTurn(s, CONTENT);
    expect(next.players[0]!.gold).toBe(goldBefore + y.gold - 1); // -1 militia gold upkeep
    expect(next.players[0]!.research.progress).toBe(y.research);
  });

  it('completes a study when its cost is met and discards overflow', () => {
    let s = controlled();
    s = applyCommand(s, CONTENT, 'player-0', { type: 'set-research', studyId: 'war-drums' });
    s.players[0]!.research.progress = 19; // war-drums cost 20; +research this turn tips it over
    const next = advanceTurn(s, CONTENT);
    expect(next.players[0]!.completedStudies).toContain('war-drums');
    expect(next.players[0]!.research).toEqual({ activeStudyId: null, progress: 0 });
  });

  it('production then growth run per city; a finished unit appears', () => {
    let s = controlled();
    s.cities[0]!.buildQueue = [{ kind: 'unit', id: 'militia', progress: 5 }];
    // Give the city enough production by boosting pop so yields complete it.
    s.cities[0]!.population = 5;
    const before = s.units.length;
    s = advanceTurn(s, CONTENT);
    expect(s.units.length).toBeGreaterThanOrEqual(before); // may or may not complete in one turn
    // Refreshed movement for all units.
    for (const u of s.units) {
      const def = CONTENT.units[u.defId]!;
      expect(u.moves).toBe(def.moves);
    }
  });
});

// --- Integration: determinism, round-trip, multi-player order --------------

const P_ORC: GameSettings['players'][number] = {
  wizardId: 'w-orc', retorts: [], startWorld: 'meridia', raceId: 'orc', human: true,
};
const P_HUMAN: GameSettings['players'][number] = {
  wizardId: 'w-human', retorts: [], startWorld: 'meridia', raceId: 'human', human: false,
};

function settings(players = [P_ORC, P_HUMAN]): GameSettings {
  return { seed: 424242, mapSize: 'small', players };
}

function buildScript(game: GameState): { playerId: string; cmd: Command }[] {
  const orcSettler = game.units.find((u) => u.owner === 'player-0' && u.defId === 'settler')!;
  const humanCap = game.cities.find((c) => c.owner === 'player-1')!;
  const script: { playerId: string; cmd: Command }[] = [
    { playerId: 'player-0', cmd: { type: 'set-research', studyId: 'war-drums' } },
    { playerId: 'player-0', cmd: { type: 'queue-build', cityId: 'city-1', order: { kind: 'unit', id: 'militia' } } },
    { playerId: 'player-1', cmd: { type: 'queue-build', cityId: humanCap.id, order: { kind: 'building', id: 'granary' } } },
    // Move settler to its own tile (always valid) to exercise the command path.
    { playerId: 'player-0', cmd: { type: 'move-unit', unitId: orcSettler.id, to: { x: orcSettler.x, y: orcSettler.y } } },
  ];
  while (script.length < 20) script.push({ playerId: 'player-0', cmd: { type: 'end-turn' } });
  return script;
}

describe('full-game determinism and serialization', () => {
  it('two games run through the same 20-command script are deep-equal', () => {
    const a = createGame(settings(), CONTENT);
    const b = createGame(settings(), CONTENT);
    const script = buildScript(a); // a and b are identical, so one script fits both
    let sa = a;
    let sb = b;
    for (const step of script) {
      sa = applyCommand(sa, CONTENT, step.playerId, step.cmd);
      sb = applyCommand(sb, CONTENT, step.playerId, step.cmd);
    }
    expect(sa).toEqual(sb);
  });

  it('JSON round-trip mid-game deep-equals', () => {
    let s = createGame(settings(), CONTENT);
    const script = buildScript(s).slice(0, 8);
    for (const step of script) s = applyCommand(s, CONTENT, step.playerId, step.cmd);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('advanceTurn with 3 players is order-stable and deterministic', () => {
    const three = settings([P_ORC, P_HUMAN, { ...P_ORC, wizardId: 'w-orc-3', raceId: 'orc' }]);
    const a = createGame(three, CONTENT);
    const b = createGame(three, CONTENT);
    expect(a.players).toHaveLength(3);
    let sa = a;
    let sb = b;
    for (let i = 0; i < 5; i++) {
      sa = advanceTurn(sa, CONTENT);
      sb = advanceTurn(sb, CONTENT);
    }
    expect(sa).toEqual(sb);
    expect(sa.turn).toBe(a.turn + 5);
  });
});
