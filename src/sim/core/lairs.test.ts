/**
 * Lair seeding + strategic battle triggering.
 *
 * Uses bespoke inline content (a world + a school dimension, plus a tiered
 * roster of monster-role units) rather than the shared fixture, so the seeding
 * constraints and battle mechanics can be asserted directly. Never imports
 * src/data.
 */
import { describe, expect, it } from 'vitest';

import { createGame } from './state';
import type { GameState } from './state';
import { applyCommand, advanceTurn } from './turn';
import type { GameContent } from './state';
import { CONTENT, MERIDIA, makeMap, makeState, makePlayer, makeCity } from '../__fixtures__/content';
import { chebyshev } from '../units/units';
import type { GameSettings, PlaneDef, UnitDef, UnitState } from '../types';

// --- Tiered monster roster ------------------------------------------------

function monster(
  id: string,
  figures: number,
  hits: number,
  damage: number,
  abilities: UnitDef['abilities'] = [],
): UnitDef {
  return {
    id,
    name: id,
    role: 'monster',
    origin: { generic: true },
    combat: {
      figures,
      hits,
      melee: { attack: Math.max(2, damage + 1), damage, reach: 1 },
      armor: Math.floor(hits / 4),
      speed: 2,
      mass: 2,
      morale: 60,
      discipline: 40,
    },
    moves: 1,
    skill: 20 + damage * 3,
    upkeep: {},
    abilities,
    description: `test monster ${id}`,
  };
}

const WEAKLING = monster('test-weakling', 4, 1, 1); // power 4
const BRUTE = monster('test-brute', 2, 6, 4); // power 48
const DRAKE = monster('test-drake', 1, 20, 8, [
  { type: 'breath-weapon', damage: 8, range: 3, cooldown: 3 },
]); // power 160, "strong"

const MONSTERS: Record<string, UnitDef> = {
  'test-weakling': WEAKLING,
  'test-brute': BRUTE,
  'test-drake': DRAKE,
};

const MAELSTROM: PlaneDef = {
  id: 'maelstrom',
  name: 'Maelstrom',
  kind: 'dimension',
  school: 'chaos',
  thrivingSchools: ['chaos'],
  description: 'test dimension',
};

/** Content with a world + a dimension and the tiered monster roster. */
const SEED_CONTENT: GameContent = {
  planes: [MERIDIA, MAELSTROM],
  races: CONTENT.races,
  buildings: CONTENT.buildings,
  units: { ...CONTENT.units, ...MONSTERS },
  studies: CONTENT.studies,
};

/** Content usable in controlled makeState battle scenarios (worlds only). */
const BATTLE_CONTENT: GameContent = {
  ...CONTENT,
  units: { ...CONTENT.units, ...MONSTERS },
};

const SEED_SETTINGS: GameSettings = {
  seed: 13572468,
  mapSize: 'small',
  players: [{ wizardId: 'w', retorts: [], startWorld: 'meridia', raceId: 'orc', human: true }],
};

function isStrong(defId: string): boolean {
  const def = SEED_CONTENT.units[defId]!;
  return def.abilities.some((a) => a.type === 'breath-weapon' || a.type === 'fear');
}

// --- Seeding --------------------------------------------------------------

describe('lair seeding', () => {
  const game = createGame(SEED_SETTINGS, SEED_CONTENT);
  const starts = game.cities.map((c) => ({ plane: c.plane, x: c.x, y: c.y }));

  it('is deterministic for a fixed seed', () => {
    const again = createGame(SEED_SETTINGS, SEED_CONTENT);
    expect(again.lairs).toEqual(game.lairs);
  });

  it('seeds lairs on both the world and the dimension', () => {
    expect(game.lairs.some((l) => l.plane === 'meridia')).toBe(true);
    expect(game.lairs.some((l) => l.plane === 'maelstrom')).toBe(true);
  });

  it('places every lair on passable, non-peak land', () => {
    for (const lair of game.lairs) {
      const map = game.maps[lair.plane];
      const tile = map.tiles[lair.y * map.width + lair.x]!;
      expect(tile.terrain).not.toBe('ocean');
      expect(tile.terrain).not.toBe('shore');
      expect(tile.elevation).not.toBe(3);
    }
  });

  it('keeps every lair ≥5 from any start and ≥4 from every other lair', () => {
    for (const lair of game.lairs) {
      for (const s of starts) {
        if (s.plane !== lair.plane) continue;
        expect(chebyshev(lair.x, lair.y, s.x, s.y)).toBeGreaterThanOrEqual(5);
      }
    }
    for (let i = 0; i < game.lairs.length; i++) {
      for (let j = i + 1; j < game.lairs.length; j++) {
        const a = game.lairs[i]!;
        const b = game.lairs[j]!;
        if (a.plane !== b.plane) continue;
        expect(chebyshev(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('gives each lair a full-hp garrison of 1–4 monsters with loot', () => {
    for (const lair of game.lairs) {
      expect(lair.monsterIds.length).toBeGreaterThanOrEqual(1);
      expect(lair.monsterIds.length).toBeLessThanOrEqual(4);
      expect(lair.monsterHp).toHaveLength(lair.monsterIds.length);
      lair.monsterIds.forEach((defId, idx) => {
        const def = SEED_CONTENT.units[defId]!;
        expect(def.role).toBe('monster');
        expect(lair.monsterHp[idx]).toBe(def.combat.figures * def.combat.hits);
      });
      expect(lair.loot.gold).toBeGreaterThan(0);
      expect(lair.loot.mana).toBe(Math.round(lair.loot.gold / 2));
      expect(lair.cleared).toBe(false);
    }
  });

  it('never garrisons the nearest world lair to a start with a breath-weapon monster', () => {
    const worldStart = starts.find((s) => s.plane === 'meridia')!;
    const worldLairs = game.lairs.filter((l) => l.plane === 'meridia');
    let nearest = worldLairs[0]!;
    for (const l of worldLairs) {
      if (
        chebyshev(l.x, l.y, worldStart.x, worldStart.y) <
        chebyshev(nearest.x, nearest.y, worldStart.x, worldStart.y)
      ) {
        nearest = l;
      }
    }
    expect(nearest.monsterIds.some(isStrong)).toBe(false);
  });

  it('confines strong monsters to distant world lairs and the dimension', () => {
    // Every lair holding a strong monster is either in a dimension or sits in
    // the farther half of its world (tier ≥ 0.5 by construction).
    for (const lair of game.lairs) {
      if (!lair.monsterIds.some(isStrong)) continue;
      if (lair.plane === 'maelstrom') continue; // dimension: always allowed
      const worldStart = starts.find((s) => s.plane === lair.plane)!;
      // A near-start lair (the minimum distance possible is 5) must not be
      // strong; assert it is meaningfully out from the start.
      expect(chebyshev(lair.x, lair.y, worldStart.x, worldStart.y)).toBeGreaterThan(5);
    }
  });

  it('is denser (per tile) in the dimension than in the world', () => {
    const world = game.maps['meridia'];
    const dim = game.maps['maelstrom'];
    const worldDensity =
      game.lairs.filter((l) => l.plane === 'meridia').length / (world.width * world.height);
    const dimDensity =
      game.lairs.filter((l) => l.plane === 'maelstrom').length / (dim.width * dim.height);
    expect(dimDensity).toBeGreaterThan(worldDensity);
  });
});

// --- Battle triggering ----------------------------------------------------

function unit(over: Partial<UnitState> & Pick<UnitState, 'id' | 'defId' | 'x' | 'y'>): UnitState {
  const def = BATTLE_CONTENT.units[over.defId]!;
  return {
    id: over.id,
    owner: over.owner ?? 'player-0',
    defId: over.defId,
    plane: over.plane ?? 'meridia',
    x: over.x,
    y: over.y,
    moves: over.moves ?? 2,
    hp: over.hp ?? def.combat.figures * def.combat.hits,
  };
}

/** A controlled grassland state with one player and the given units + lairs. */
function battleState(units: UnitState[], lairs: GameState['lairs']): GameState {
  const map = makeMap('meridia', 12, 12, 'grassland');
  const player = makePlayer('player-0', 'orc');
  return makeState({ maps: [map], players: [player], units, lairs });
}

describe('battle triggering on movement', () => {
  it('moving to a tile ADJACENT to a lair does not trigger a battle', () => {
    const attacker = unit({ id: 'a1', defId: 'orc-warrior', x: 5, y: 3 });
    const lair: GameState['lairs'][number] = {
      id: 'lair-x', plane: 'meridia', x: 5, y: 5,
      monsterIds: ['test-weakling'], monsterHp: [4], loot: { gold: 20, mana: 10 }, cleared: false,
    };
    const s = battleState([attacker], [lair]);
    const next = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'a1', to: { x: 5, y: 4 },
    });
    expect(next.battles).toHaveLength(0);
    const moved = next.units.find((u) => u.id === 'a1')!;
    expect([moved.x, moved.y]).toEqual([5, 4]);
    expect(next.lairs[0]!.cleared).toBe(false);
  });

  it('moving ONTO a live lair resolves exactly one well-formed battle and the mover stays adjacent', () => {
    const a1 = unit({ id: 'a1', defId: 'orc-warrior', x: 5, y: 4 });
    const a2 = unit({ id: 'a2', defId: 'orc-warrior', x: 5, y: 4 }); // co-located stackmate
    const lair: GameState['lairs'][number] = {
      id: 'lair-x', plane: 'meridia', x: 5, y: 5,
      monsterIds: ['test-weakling'], monsterHp: [4], loot: { gold: 50, mana: 25 }, cleared: false,
    };
    const s = battleState([a1, a2], [lair]);
    const goldBefore = s.players[0]!.gold;
    const manaBefore = s.players[0]!.mana;
    const next = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'a1', to: { x: 5, y: 5 },
    });

    expect(next.battles).toHaveLength(1);
    const rec = next.battles[0]!;
    expect(rec.lairId).toBe('lair-x');
    expect(rec.attackerPlayer).toBe('player-0');
    expect(rec.defenderPlayer).toBe('neutral');
    expect(rec.plane).toBe('meridia');
    expect(rec.report.events[0]!.type).toBe('battle-start');
    expect(rec.report.events[rec.report.events.length - 1]!.type).toBe('battle-end');

    // Both stackmates were the attacker side of the report.
    const startedIds = rec.report.events[0]!.type === 'battle-start'
      ? rec.report.events[0]!.units.filter((u) => u.side === 'attacker').map((u) => u.id)
      : [];
    expect(new Set(startedIds)).toEqual(new Set(['a1', 'a2']));

    // The moving unit never entered the lair tile.
    const mover = next.units.find((u) => u.id === 'a1');
    if (mover) expect([mover.x, mover.y]).toEqual([5, 4]);

    // Lopsided win: lair cleared, loot credited exactly once.
    expect(rec.report.outcome.winner).toBe('attacker');
    expect(next.lairs[0]!.cleared).toBe(true);
    expect(next.players[0]!.gold).toBe(goldBefore + 50);
    expect(next.players[0]!.mana).toBe(manaBefore + 25);
  });

  it('a cleared lair no longer triggers a battle', () => {
    const a1 = unit({ id: 'a1', defId: 'orc-warrior', x: 5, y: 4 });
    const lair: GameState['lairs'][number] = {
      id: 'lair-x', plane: 'meridia', x: 5, y: 5,
      monsterIds: ['test-weakling'], monsterHp: [4], loot: { gold: 50, mana: 25 }, cleared: false,
    };
    let s = battleState([a1], [lair]);
    s = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'a1', to: { x: 5, y: 5 },
    });
    expect(s.battles).toHaveLength(1);
    expect(s.lairs[0]!.cleared).toBe(true);

    // Refresh movement and march onto the (now cleared) lair tile.
    s = advanceTurn(s, BATTLE_CONTENT);
    const mover = s.units.find((u) => u.id === 'a1')!;
    s = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'a1', to: { x: 5, y: 5 },
    });
    expect(s.battles).toHaveLength(1); // no new battle
    const after = s.units.find((u) => u.id === 'a1')!;
    expect([after.x, after.y]).toEqual([5, 5]); // enters the empty tile now
  });

  it('a defeat leaves the lair uncleared with its damaged garrison persisted', () => {
    const weak = unit({ id: 's1', defId: 'settler', x: 5, y: 4 });
    const lair: GameState['lairs'][number] = {
      id: 'lair-d', plane: 'meridia', x: 5, y: 5,
      monsterIds: ['test-drake', 'test-drake'], monsterHp: [20, 20],
      loot: { gold: 999, mana: 500 }, cleared: false,
    };
    const s = battleState([weak], [lair]);
    const goldBefore = s.players[0]!.gold;
    const next = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 's1', to: { x: 5, y: 5 },
    });
    expect(next.battles).toHaveLength(1);
    expect(next.battles[0]!.report.outcome.winner).not.toBe('attacker');
    expect(next.lairs[0]!.cleared).toBe(false);
    expect(next.players[0]!.gold).toBe(goldBefore); // no loot on defeat
    // Garrison hp persisted (still a live garrison), never above its max.
    next.lairs[0]!.monsterHp.forEach((hp) => {
      expect(hp).toBeGreaterThanOrEqual(0);
      expect(hp).toBeLessThanOrEqual(20);
    });
    // The weak attacker was wiped out.
    expect(next.units.some((u) => u.id === 's1')).toBe(false);
  });
});

describe('stack cap enforcement', () => {
  it('rejects moving a unit onto a tile already holding the max stack', () => {
    const full: UnitState[] = [];
    for (let i = 0; i < 9; i++) {
      full.push(unit({ id: `f${i}`, defId: 'orc-warrior', x: 5, y: 5, moves: 0 }));
    }
    const mover = unit({ id: 'm', defId: 'orc-warrior', x: 5, y: 4, moves: 2 });
    const s = battleState([...full, mover], []);
    expect(() =>
      applyCommand(s, BATTLE_CONTENT, 'player-0', { type: 'move-unit', unitId: 'm', to: { x: 5, y: 5 } }),
    ).toThrow(/stack is full/i);
  });

  it('allows moving onto a tile with room to spare', () => {
    const eight: UnitState[] = [];
    for (let i = 0; i < 8; i++) {
      eight.push(unit({ id: `f${i}`, defId: 'orc-warrior', x: 5, y: 5, moves: 0 }));
    }
    const mover = unit({ id: 'm', defId: 'orc-warrior', x: 5, y: 4, moves: 2 });
    const s = battleState([...eight, mover], []);
    const next = applyCommand(s, BATTLE_CONTENT, 'player-0', {
      type: 'move-unit', unitId: 'm', to: { x: 5, y: 5 },
    });
    expect(next.units.filter((u) => u.x === 5 && u.y === 5)).toHaveLength(9);
  });
});

describe('gentle strategic healing', () => {
  it('heals 20% of max on a friendly city tile and 5% in the field', () => {
    const cityHealer = unit({ id: 'h1', defId: 'orc-warrior', x: 2, y: 2, hp: 9 });
    const fieldHealer = unit({ id: 'h2', defId: 'orc-warrior', x: 8, y: 8, hp: 9 });
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 2, y: 2 });
    const s = makeState({ maps: [map], players: [player], cities: [city], units: [cityHealer, fieldHealer] });
    const max = BATTLE_CONTENT.units['orc-warrior']!.combat.figures * BATTLE_CONTENT.units['orc-warrior']!.combat.hits; // 18
    const next = advanceTurn(s, BATTLE_CONTENT);
    const h1 = next.units.find((u) => u.id === 'h1')!;
    const h2 = next.units.find((u) => u.id === 'h2')!;
    expect(h1.hp).toBeCloseTo(9 + max * 0.2, 5); // 12.6
    expect(h2.hp).toBeCloseTo(9 + max * 0.05, 5); // 9.9
  });

  it('never heals a unit above its max pool', () => {
    const nearlyFull = unit({ id: 'h', defId: 'orc-warrior', x: 2, y: 2, hp: 17.5 });
    const map = makeMap('meridia', 12, 12, 'grassland');
    const player = makePlayer('player-0', 'orc');
    const city = makeCity({ id: 'city-1', owner: 'player-0', raceId: 'orc', x: 2, y: 2 });
    const s = makeState({ maps: [map], players: [player], cities: [city], units: [nearlyFull] });
    const next = advanceTurn(s, BATTLE_CONTENT);
    expect(next.units.find((u) => u.id === 'h')!.hp).toBe(18);
  });
});
