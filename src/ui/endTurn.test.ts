import { describe, expect, it } from 'vitest';

import { CONTENT, makeMap, makeState, makePlayer, makeCity } from '@sim/__fixtures__/content';
import type { BuildOrder, UnitState } from '@sim/types';
import { endTurnDecision, hasSelectableStudy, endTurnLabel } from './endTurn';

function armyUnit(id: string, over: Partial<UnitState> = {}): UnitState {
  const defId = over.defId ?? 'militia';
  const def = CONTENT.units[defId]!;
  return {
    id,
    owner: 'player-0',
    defId,
    plane: 'meridia',
    x: over.x ?? 5,
    y: over.y ?? 5,
    moves: over.moves ?? 1,
    hp: over.hp ?? def.combat.figures * def.combat.hits,
    ...over,
  };
}

/** One orc city, research unset, empty queue by default. */
function game(opts?: { queue?: BuildOrder[]; completed?: string[]; activeStudy?: string | null }) {
  const map = makeMap('meridia', 12, 12, 'grassland');
  const player = makePlayer('player-0', 'orc');
  player.completedStudies = opts?.completed ?? [];
  player.research = { activeStudyId: opts?.activeStudy ?? null, progress: 0 };
  const city = makeCity({
    id: 'city-1',
    owner: 'player-0',
    raceId: 'orc',
    x: 5,
    y: 5,
    buildQueue: opts?.queue ?? [],
  });
  const state = makeState({ maps: [map], players: [player], cities: [city] });
  return state;
}

describe('endTurnDecision', () => {
  it('(a) demands research first when research is unset and a study is selectable', () => {
    const st = game();
    expect(endTurnDecision(st, CONTENT, 'player-0')).toEqual({ kind: 'research' });
  });

  it('(b) demands production for an idle city once research is set', () => {
    const st = game({ activeStudy: 'arcane-arts' });
    expect(endTurnDecision(st, CONTENT, 'player-0')).toEqual({
      kind: 'production',
      cityId: 'city-1',
    });
  });

  it('(c) advances when research is set and every city has a queued order', () => {
    const st = game({
      activeStudy: 'arcane-arts',
      queue: [{ kind: 'building', id: 'granary', progress: 0 }],
    });
    expect(endTurnDecision(st, CONTENT, 'player-0')).toEqual({ kind: 'advance' });
  });

  it('research takes priority over an idle city', () => {
    const st = game(); // research unset AND queue empty
    expect(endTurnDecision(st, CONTENT, 'player-0').kind).toBe('research');
  });

  it('cycles through every idle city on repeated clicks', () => {
    const map = makeMap('meridia', 20, 20, 'grassland');
    const player = makePlayer('player-0', 'orc');
    player.research = { activeStudyId: 'arcane-arts', progress: 0 };
    const a = makeCity({ id: 'city-a', owner: 'player-0', raceId: 'orc', x: 4, y: 4 });
    const b = makeCity({ id: 'city-b', owner: 'player-0', raceId: 'orc', x: 10, y: 10 });
    const c = makeCity({ id: 'city-c', owner: 'player-0', raceId: 'orc', x: 16, y: 16 });
    const st = makeState({ maps: [map], players: [player], cities: [a, b, c] });

    // No selection → first idle city.
    expect(endTurnDecision(st, CONTENT, 'player-0', null)).toEqual({
      kind: 'production',
      cityId: 'city-a',
    });
    // Selecting a → next is b, then c, then wraps to a.
    expect(endTurnDecision(st, CONTENT, 'player-0', 'city-a')).toEqual({
      kind: 'production',
      cityId: 'city-b',
    });
    expect(endTurnDecision(st, CONTENT, 'player-0', 'city-b')).toEqual({
      kind: 'production',
      cityId: 'city-c',
    });
    expect(endTurnDecision(st, CONTENT, 'player-0', 'city-c')).toEqual({
      kind: 'production',
      cityId: 'city-a',
    });
  });

  it('(c) surfaces an idle army after research and production are settled', () => {
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    player.research = { activeStudyId: 'arcane-arts', progress: 0 };
    // City with a queued order (no production decision pending).
    const city = makeCity({
      id: 'city-1',
      owner: 'player-0',
      raceId: 'orc',
      x: 5,
      y: 5,
      buildQueue: [{ kind: 'building', id: 'granary', progress: 0 }],
    });
    // An army (2 units) on a far tile, no standing order, movement to spend.
    const units = [
      armyUnit('u1', { armyId: 'army-1', x: 9, y: 9, moves: 1 }),
      armyUnit('u2', { armyId: 'army-1', x: 9, y: 9, moves: 1 }),
    ];
    const st = makeState({ maps: [map], players: [player], cities: [city], units });
    expect(endTurnDecision(st, CONTENT, 'player-0')).toEqual({ kind: 'army', armyId: 'army-1' });
  });

  it('cycles through every idle army on repeated clicks', () => {
    const map = makeMap('meridia', 20, 20, 'grassland');
    const player = makePlayer('player-0', 'orc');
    player.research = { activeStudyId: 'arcane-arts', progress: 0 };
    const units = [
      armyUnit('a1', { armyId: 'army-a', x: 3, y: 3, moves: 1 }),
      armyUnit('a2', { armyId: 'army-a', x: 3, y: 3, moves: 1 }),
      armyUnit('b1', { armyId: 'army-b', x: 10, y: 10, moves: 1 }),
      armyUnit('b2', { armyId: 'army-b', x: 10, y: 10, moves: 1 }),
    ];
    const st = makeState({ maps: [map], players: [player], units });
    expect(endTurnDecision(st, CONTENT, 'player-0', null, null)).toEqual({
      kind: 'army',
      armyId: 'army-a',
    });
    expect(endTurnDecision(st, CONTENT, 'player-0', null, 'army-a')).toEqual({
      kind: 'army',
      armyId: 'army-b',
    });
    expect(endTurnDecision(st, CONTENT, 'player-0', null, 'army-b')).toEqual({
      kind: 'army',
      armyId: 'army-a',
    });
  });

  it('production takes priority over an idle army', () => {
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    player.research = { activeStudyId: 'arcane-arts', progress: 0 };
    const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 5, y: 5 });
    const units = [
      armyUnit('u1', { armyId: 'army-1', x: 9, y: 9, moves: 1 }),
      armyUnit('u2', { armyId: 'army-1', x: 9, y: 9, moves: 1 }),
    ];
    const st = makeState({ maps: [map], players: [player], cities: [city], units });
    expect(endTurnDecision(st, CONTENT, 'player-0').kind).toBe('production');
  });

  it('advances when research is set and there are no cities at all', () => {
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    player.research = { activeStudyId: 'arcane-arts', progress: 0 };
    const st = makeState({ maps: [map], players: [player], cities: [] });
    expect(endTurnDecision(st, CONTENT, 'player-0')).toEqual({ kind: 'advance' });
  });

  it('does not demand research when nothing is selectable (all studies done)', () => {
    // Complete every orc study; research stays null but nothing is selectable,
    // so the decision falls through to the idle city.
    const st = game({ completed: ['arcane-arts', 'war-drums', 'fertility-rites', 'gold-magic'] });
    expect(hasSelectableStudy(st, CONTENT, 'player-0')).toBe(false);
    expect(endTurnDecision(st, CONTENT, 'player-0').kind).toBe('production');
  });
});

describe('endTurnLabel', () => {
  it('labels each decision for the button', () => {
    expect(endTurnLabel({ kind: 'research' })).toBe('Choose Research');
    expect(endTurnLabel({ kind: 'production', cityId: 'city-1' }, 'Grimfang')).toBe(
      'Choose Production (Grimfang)',
    );
    expect(endTurnLabel({ kind: 'army', armyId: 'army-1' })).toBe('Army Awaiting Orders');
    expect(endTurnLabel({ kind: 'advance' })).toBe('End Turn ▸');
  });
});
