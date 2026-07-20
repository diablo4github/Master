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
import { createGame, type GameContent, type GameState, type LairState } from '../src/sim/core/state';
import { advanceTurn, applyCommand } from '../src/sim/core/turn';
import { findPath, chebyshev } from '../src/sim/units/units';
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

function isLairTile(state: GameState, x: number, y: number): boolean {
  const plane = state.cities[0]!.plane;
  return state.lairs.some((l) => l.plane === plane && l.x === x && l.y === y);
}

/**
 * First safe city site 3–6 tiles from the capital that the settler can reach
 * WITHOUT its path crossing a lair (which would start a battle mid-march).
 */
function pickCitySite(state: GameState) {
  const capital = state.cities[0]!;
  const map = state.maps[capital.plane];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const d = Math.max(Math.abs(x - capital.x), Math.abs(y - capital.y));
      if (d < 3 || d > 6) continue;
      const terrain = getTile(map, x, y)!.terrain;
      if (!SAFE_SITE_TERRAIN.includes(terrain)) continue;
      if (isLairTile(state, x, y)) continue;
      const path = findPath(map, capital.x, capital.y, x, y);
      if (path && !path.some((p) => isLairTile(state, p.x, p.y))) return { x, y };
    }
  }
  throw new Error('no reachable city site near the capital for this seed');
}

/** Nearest lair (by Chebyshev) on the capital's plane the capital can path to. */
function nearestReachableLair(state: GameState): LairState {
  const capital = state.cities[0]!;
  const map = state.maps[capital.plane];
  const reachable = state.lairs
    .filter((l) => l.plane === capital.plane && findPath(map, capital.x, capital.y, l.x, l.y))
    .sort((a, b) => chebyshev(a.x, a.y, capital.x, capital.y) - chebyshev(b.x, b.y, capital.x, capital.y));
  const lair = reachable[0];
  if (!lair) throw new Error('no reachable meridia lair for this seed');
  return lair;
}

/**
 * Plays a fixed 80-turn session and returns the final state. Beyond the
 * economy/settler arc it raises a two-militia strike stack, forms it into an
 * army, and issues a SINGLE move-army order toward the nearest reachable lair.
 * The persistent order + advanceTurn auto-march then carry the army across the
 * map on their own until it reaches the lair and a real strategic battle
 * resolves (which clears the order) — so the whole strike is one command plus
 * the sim, folded into the deterministic session.
 */
function playSession(): GameState {
  let state = createGame(settings, content);
  const me = state.players[0]!.id;
  const site = pickCitySite(state);
  const targetLair = nearestReachableLair(state);

  state = applyCommand(state, content, me, { type: 'set-research', studyId: 'humans-faith-1' });

  let militiaOrders = 0;
  let ordered = false;

  for (let turn = 0; turn < 80; turn++) {
    // Settle the second city.
    const settler = state.units.find((u) => u.owner === me && u.defId === 'settler');
    if (settler) {
      if (settler.x === site.x && settler.y === site.y) {
        state = applyCommand(state, content, me, { type: 'found-city', unitId: settler.id, name: 'New Hope' });
      } else if (settler.moves > 0) {
        state = applyCommand(state, content, me, { type: 'move-unit', unitId: settler.id, to: site });
      }
    }

    // Capital build order: two militia (the strike stack), then granary, then
    // marketplace. Appended to the queue whenever it empties.
    const capital = state.cities[0]!;
    if (capital.buildQueue.length === 0) {
      let order: { kind: 'building' | 'unit'; id: string } | null = null;
      if (militiaOrders < 2) {
        order = { kind: 'unit', id: 'militia' };
        militiaOrders += 1;
      } else if (!capital.buildings.includes('granary')) {
        order = { kind: 'building', id: 'granary' };
      } else if (!capital.buildings.includes('marketplace')) {
        order = { kind: 'building', id: 'marketplace' };
      }
      if (order) state = applyCommand(state, content, me, { type: 'queue-build', cityId: capital.id, order });
    }

    // Raise a two-militia strike force, FORM IT INTO AN ARMY, and issue a SINGLE
    // move-army order toward the lair. Auto-march does the rest across turns; the
    // battle triggers on arrival and clears the order — no per-turn re-issuing.
    if (!ordered && state.cities.length >= 2) {
      const strike = state.units.filter((u) => u.owner === me && u.defId === 'militia').slice(0, 2);
      if (strike.length >= 2) {
        let armyId = strike[0]!.armyId;
        if (armyId === undefined) {
          const [a, b] = strike;
          if (a && b && a.x === b.x && a.y === b.y && b.armyId === undefined) {
            state = applyCommand(state, content, me, { type: 'form-army', unitIds: [a.id, b.id] });
            armyId = state.units.find((u) => u.id === a.id)!.armyId;
          }
        }
        if (armyId !== undefined) {
          state = applyCommand(state, content, me, {
            type: 'move-army',
            armyId,
            to: { x: targetLair.x, y: targetLair.y },
          });
          ordered = true;
        }
      }
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

  it('fought a real strategic battle: the militia stack struck a lair', () => {
    expect(final.battles.length).toBeGreaterThanOrEqual(1);
    const rec = final.battles[0]!;
    expect(rec.attackerPlayer).toBe(me.id);
    expect(rec.defenderPlayer).toBe('neutral');
    expect(rec.lairId).toBeDefined();
    expect(rec.plane).toBe('meridia');
    // Well-formed replay: starts with battle-start, ends with battle-end.
    expect(rec.report.events[0]!.type).toBe('battle-start');
    expect(rec.report.events[rec.report.events.length - 1]!.type).toBe('battle-end');
    // It was a stack (both militia) versus the lair garrison.
    const start = rec.report.events[0]!;
    if (start.type === 'battle-start') {
      const attackers = start.units.filter((u) => u.side === 'attacker');
      const defenders = start.units.filter((u) => u.side === 'defender');
      expect(attackers.length).toBe(2);
      expect(defenders.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('battle outcome is consistent with lair state (cleared+loot iff attacker won)', () => {
    const rec = final.battles[0]!;
    const lair = final.lairs.find((l) => l.id === rec.lairId)!;
    if (rec.report.outcome.winner === 'attacker') {
      expect(lair.cleared).toBe(true);
    } else {
      expect(lair.cleared).toBe(false);
      // A surviving garrison keeps at least one live monster.
      expect(lair.monsterHp.some((hp) => hp > 0)).toBe(true);
    }
  });

  it('is fully deterministic: replaying the identical session matches deep-equal', () => {
    expect(playSession()).toEqual(final);
  });

  it('replays the battle log identically across sessions', () => {
    const other = playSession();
    expect(other.battles).toEqual(final.battles);
  });

  it('survives a JSON save/load round-trip', () => {
    expect(JSON.parse(JSON.stringify(final))).toEqual(final);
  });
});
