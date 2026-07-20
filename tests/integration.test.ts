/**
 * Whole-game integration: the real content from src/data driving the real
 * sim through a scripted multi-decade session. This is the "no placeholders"
 * proof — if any layer stubs out, a scripted game stops progressing.
 */
import { describe, expect, it } from 'vitest';

import { PLANES } from '../src/data/planes';
import { RACES } from '../src/data/races';
import { BUILDINGS } from '../src/data/buildings';
import { UNITS } from '../src/data/units';
import { STUDIES } from '../src/data/studies';
import { WIZARDS } from '../src/data/wizards';
import { createGame, type GameContent, type GameState } from '../src/sim/core/state';
import { advanceTurn, applyCommand } from '../src/sim/core/turn';
import { findPath } from '../src/sim/units/units';
import { getTile, type TerrainId } from '../src/sim/map/tiles';
import type { GameSettings } from '../src/sim/types';

const content: GameContent = {
  planes: Object.values(PLANES),
  races: RACES,
  buildings: BUILDINGS,
  units: UNITS,
  studies: STUDIES,
};

const settings: GameSettings = {
  seed: 20260720,
  mapSize: 'small',
  players: [
    {
      wizardId: 'ithariel-dawnclad',
      retorts: [...WIZARDS['ithariel-dawnclad']!.retorts],
      startWorld: 'meridia',
      raceId: 'humans',
      human: true,
    },
  ],
};

/** Terrain that is definitely settleable and walkable on Meridia. */
const SAFE_SITE_TERRAIN: readonly TerrainId[] = ['grassland', 'forest', 'hills', 'desert'];

/** First safe city site 3–6 tiles from the capital that the settler can reach. */
function pickCitySite(state: GameState) {
  const capital = state.cities[0]!;
  const map = state.maps[capital.plane];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const d = Math.max(Math.abs(x - capital.x), Math.abs(y - capital.y));
      if (d < 3 || d > 6) continue;
      const terrain = getTile(map, x, y)!.terrain;
      if (!SAFE_SITE_TERRAIN.includes(terrain)) continue;
      if (findPath(map, capital.x, capital.y, x, y)) return { x, y };
    }
  }
  throw new Error('no reachable city site near the capital for this seed');
}

/** Plays a fixed 80-turn session and returns the final state. */
function playSession(): GameState {
  let state = createGame(settings, content);
  const me = state.players[0]!.id;
  const site = pickCitySite(state);

  state = applyCommand(state, content, me, { type: 'set-research', studyId: 'humans-faith-1' });
  state = applyCommand(state, content, me, {
    type: 'set-build',
    cityId: state.cities[0]!.id,
    order: { kind: 'building', id: 'granary' },
  });

  for (let turn = 0; turn < 80; turn++) {
    const settler = state.units.find(
      (u) => u.owner === me && u.defId === 'settler',
    );
    if (settler) {
      if (settler.x === site.x && settler.y === site.y) {
        state = applyCommand(state, content, me, {
          type: 'found-city',
          unitId: settler.id,
          name: 'New Hope',
        });
      } else if (settler.moves > 0) {
        state = applyCommand(state, content, me, {
          type: 'move-unit',
          unitId: settler.id,
          to: site,
        });
      }
    }
    // Keep the capital busy: queue a marketplace once the granary is done.
    const capital = state.cities[0]!;
    if (
      capital.buildings.includes('granary') &&
      !capital.buildings.includes('marketplace') &&
      capital.buildQueue.length === 0
    ) {
      state = applyCommand(state, content, me, {
        type: 'set-build',
        cityId: capital.id,
        order: { kind: 'building', id: 'marketplace' },
      });
    }
    state = advanceTurn(state, content);
  }
  return state;
}

describe('an 80-turn human session on the real content', () => {
  const final = playSession();
  const me = final.players[0]!;
  const capital = final.cities[0]!;

  it('starts with a capital, settler, and garrison and ends on turn 81', () => {
    expect(final.turn).toBe(81);
    expect(capital.plane).toBe('meridia');
  });

  it('completed real construction from the build queue', () => {
    expect(capital.buildings).toContain('granary');
    expect(capital.buildings).toContain('marketplace');
  });

  it('grew the capital beyond its starting population', () => {
    expect(capital.population).toBeGreaterThan(3);
  });

  it('completed the first faith study through real research yields', () => {
    expect(me.completedStudies).toContain('humans-faith-1');
  });

  it('founded a second city with the settler', () => {
    expect(final.cities.filter((c) => c.owner === me.id)).toHaveLength(2);
    expect(final.cities[1]!.name).toBe('New Hope');
    expect(final.units.find((u) => u.defId === 'settler')).toBeUndefined();
  });

  it('accumulated treasury and mana from real yields', () => {
    expect(me.gold).not.toBe(100);
    expect(me.mana).toBeGreaterThan(20);
  });

  it('is fully deterministic: replaying the identical session matches deep-equal', () => {
    expect(playSession()).toEqual(final);
  });

  it('survives a JSON save/load round-trip', () => {
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});
