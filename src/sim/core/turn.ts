/**
 * Command processing and turn advancement.
 *
 * Updates are immutable from the caller's point of view: `applyCommand` and
 * `advanceTurn` never mutate the GameState passed in — they clone it via
 * `structuredClone` (cheap for a turn-based game, and it keeps update code
 * free of hand-written deep copies) and mutate the clone. GameState is a plain
 * JSON tree, so the clone is faithful; `state.test.ts` separately verifies the
 * JSON round-trip invariant.
 *
 * Commands throw Error with human-readable messages on any illegal request —
 * the UI relies on those messages verbatim.
 */

import type { GameState, GameContent, LairState } from './state';
import type { BuildOrder, CityState, PlaneId, UnitState, YieldBundle } from '../types';
import {
  computeCityYields,
  tickProduction,
  tickGrowth,
  buildBlockReason,
  foundCity,
} from '../city/city';
import { findPath, MOVE_COSTS } from '../units/units';
import { getTile, type Tile } from '../map/tiles';
import { fromState } from './rng';
import { resolveStacks, type StackUnit } from '../combat/resolve';

/** Commands a player (human or AI) can issue against the sim. */
export type Command =
  | { type: 'end-turn' }
  | { type: 'set-build'; cityId: string; order: { kind: 'building' | 'unit'; id: string } }
  | { type: 'move-unit'; unitId: string; to: { x: number; y: number } }
  | { type: 'found-city'; unitId: string; name: string }
  | { type: 'set-research'; studyId: string };

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player '${playerId}'`);
  return player;
}

function requireOwnedCity(state: GameState, playerId: string, cityId: string): CityState {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) throw new Error(`Unknown city '${cityId}'`);
  if (city.owner !== playerId) throw new Error(`City '${cityId}' is not owned by ${playerId}`);
  return city;
}

function requireOwnedUnit(state: GameState, playerId: string, unitId: string): UnitState {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`Unknown unit '${unitId}'`);
  if (unit.owner !== playerId) throw new Error(`Unit '${unitId}' is not owned by ${playerId}`);
  return unit;
}

/** Applies a single player's command to the state, returning a new GameState. */
export function applyCommand(
  state: GameState,
  content: GameContent,
  playerId: string,
  cmd: Command,
): GameState {
  switch (cmd.type) {
    case 'end-turn':
      return advanceTurn(state, content);

    case 'set-build': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const city = requireOwnedCity(next, playerId, cmd.cityId);
      const reason = buildBlockReason(next, content, city, cmd.order.kind, cmd.order.id);
      if (reason) throw new Error(reason);
      // Queue is length-1 this milestone: setting a build replaces the head.
      city.buildQueue = [{ kind: cmd.order.kind, id: cmd.order.id, progress: 0 }];
      return next;
    }

    case 'move-unit': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const unit = requireOwnedUnit(next, playerId, cmd.unitId);
      const map = next.maps[unit.plane];
      if (!map) throw new Error(`No map for plane '${unit.plane}'`);
      moveUnitWithBattles(next, content, unit, cmd.to.x, cmd.to.y);
      return next;
    }

    case 'found-city': {
      const next = structuredClone(state);
      const player = requirePlayer(next, playerId);
      const unit = requireOwnedUnit(next, playerId, cmd.unitId);
      const def = content.units[unit.defId];
      if (!def || def.role !== 'settler') {
        throw new Error(`Unit '${cmd.unitId}' cannot found a city`);
      }
      if (!cmd.name || cmd.name.trim().length === 0) {
        throw new Error('A new city needs a name');
      }
      // foundCity validates terrain and spacing, throwing on any violation.
      foundCity(next, content, playerId, player.setup.raceId, unit.plane, unit.x, unit.y, cmd.name);
      // Consume the settler.
      next.units = next.units.filter((u) => u.id !== cmd.unitId);
      return next;
    }

    case 'set-research': {
      const next = structuredClone(state);
      const player = requirePlayer(next, playerId);
      const race = content.races[player.setup.raceId];
      if (!race) throw new Error(`Unknown race '${player.setup.raceId}'`);
      const study = content.studies[cmd.studyId];
      if (!study) throw new Error(`Unknown study '${cmd.studyId}'`);
      if (!race.studies.includes(cmd.studyId)) {
        throw new Error(`${race.name} cannot research '${study.name}'`);
      }
      if (player.completedStudies.includes(cmd.studyId)) {
        throw new Error(`'${study.name}' is already researched`);
      }
      if (study.requires) {
        for (const req of study.requires) {
          if (!player.completedStudies.includes(req)) {
            const reqDef = content.studies[req];
            throw new Error(
              `'${study.name}' requires '${reqDef ? reqDef.name : req}' first`,
            );
          }
        }
      }
      // Switching studies resets progress (MoM-style commitment). Re-selecting
      // the study already in progress is a no-op that keeps its progress.
      if (player.research.activeStudyId !== cmd.studyId) {
        player.research = { activeStudyId: cmd.studyId, progress: 0 };
      }
      return next;
    }

    default: {
      const exhaustive: never = cmd;
      throw new Error(`applyCommand: unknown command ${JSON.stringify(exhaustive)} from ${playerId}`);
    }
  }
}

/**
 * Advances the game by one full turn. Processes players in index order; for
 * each: (1) sum city yields, (2) apply gold/mana income net of upkeep,
 * (3) accumulate research and complete the active study when its cost is met
 * (overflow research is discarded), (4) per city run a production tick then a
 * growth tick, (5) refresh unit movement. Finally increments the turn counter.
 *
 * Never mutates the input state.
 */
export function advanceTurn(state: GameState, content: GameContent): GameState {
  const next = structuredClone(state);

  for (const player of next.players) {
    const cities = next.cities.filter((c) => c.owner === player.id);
    const units = next.units.filter((u) => u.owner === player.id);

    // (1) Sum yields — one snapshot per city, reused for production & growth so
    //     a building completed this turn only takes effect next turn.
    const yieldsByCity = new Map<string, YieldBundle>();
    const empire: YieldBundle = { food: 0, production: 0, gold: 0, research: 0, mana: 0 };
    for (const city of cities) {
      const y = computeCityYields(next, content, city);
      yieldsByCity.set(city.id, y);
      empire.food += y.food;
      empire.production += y.production;
      empire.gold += y.gold;
      empire.research += y.research;
      empire.mana += y.mana;
    }

    // (2) Upkeep.
    let buildingUpkeep = 0;
    for (const city of cities) {
      for (const bId of city.buildings) {
        const b = content.buildings[bId];
        if (b) buildingUpkeep += b.upkeep;
      }
    }
    let unitGold = 0;
    let unitMana = 0;
    for (const unit of units) {
      const def = content.units[unit.defId];
      if (!def) continue;
      unitGold += def.upkeep.gold ?? 0;
      unitMana += def.upkeep.mana ?? 0;
    }
    player.gold += empire.gold - buildingUpkeep - unitGold;
    player.mana += empire.mana - unitMana;

    // (3) Research.
    player.research.progress += empire.research;
    const activeId = player.research.activeStudyId;
    if (activeId) {
      const study = content.studies[activeId];
      if (study && player.research.progress >= study.cost) {
        player.completedStudies.push(activeId);
        player.research = { activeStudyId: null, progress: 0 }; // overflow discarded
      }
    }

    // (4) Per-city production then growth, from the same yield snapshot.
    for (const city of cities) {
      const y = yieldsByCity.get(city.id) as YieldBundle;
      tickProduction(next, content, city, y.production);
      tickGrowth(next, content, city, y.food);
    }

    // (5) Refresh movement and apply gentle healing for this player's units
    //     (including any just spawned). Units standing on a friendly city tile
    //     recover HEAL_IN_CITY of their max pool per turn; those in the field
    //     recover HEAL_IN_FIELD. This keeps battle casualties meaningful while
    //     letting a bruised army recover over several turns rather than needing
    //     to be disbanded.
    for (const unit of next.units) {
      if (unit.owner !== player.id) continue;
      const def = content.units[unit.defId];
      if (!def) continue;
      unit.moves = def.moves;

      const maxHp = def.combat.figures * def.combat.hits;
      if (unit.hp < maxHp) {
        const onFriendlyCity = next.cities.some(
          (c) => c.owner === player.id && c.plane === unit.plane && c.x === unit.x && c.y === unit.y,
        );
        const rate = onFriendlyCity ? HEAL_IN_CITY : HEAL_IN_FIELD;
        unit.hp = Math.min(maxHp, unit.hp + maxHp * rate);
      }
    }
  }

  next.turn += 1;
  return next;
}

// ---------------------------------------------------------------------------
// Strategic movement, stacking, and battle triggering
// ---------------------------------------------------------------------------

/** Max units of one owner that may share a tile. */
const STACK_CAP = 9;
/** Fraction of max HP a unit recovers per turn while on a friendly city tile. */
const HEAL_IN_CITY = 0.2;
/** Fraction of max HP a unit recovers per turn while out in the field. */
const HEAL_IN_FIELD = 0.05;

/** A live (uncleared) lair sitting on the given tile, if any. */
function lairAt(state: GameState, plane: PlaneId, x: number, y: number): LairState | undefined {
  return state.lairs.find((l) => !l.cleared && l.plane === plane && l.x === x && l.y === y);
}

/** Same-owner units co-located on a tile. */
function stackAt(
  state: GameState,
  owner: string,
  plane: PlaneId,
  x: number,
  y: number,
): UnitState[] {
  return state.units.filter(
    (u) => u.owner === owner && u.plane === plane && u.x === x && u.y === y,
  );
}

/** Enemy-owned units occupying a tile (future wizard-vs-wizard warfare). */
function enemyUnitsAt(
  state: GameState,
  owner: string,
  plane: PlaneId,
  x: number,
  y: number,
): UnitState[] {
  return state.units.filter(
    (u) => u.owner !== owner && u.plane === plane && u.x === x && u.y === y,
  );
}

/** Wraps a UnitState with its def for the combat bridge; skips unknown defs. */
function toStack(content: GameContent, units: readonly UnitState[]): StackUnit[] {
  const out: StackUnit[] = [];
  for (const state of units) {
    const def = content.units[state.defId];
    if (def) out.push({ state, def });
  }
  return out;
}

/**
 * Moves `unit` toward (tx, ty) along the A* path, honouring three rules:
 *  - Stacking: it may never step onto a tile already holding STACK_CAP
 *    same-owner units (clear error, thrown before any state change matters).
 *  - Hostiles: stepping INTO a tile with a live lair (or, generically, enemy
 *    units) does not enter it — movement halts on the adjacent tile and a
 *    battle resolves there. The moving unit never enters the hostile tile.
 *  - Movement points: it advances as far as this turn's points allow (MoM
 *    rule: any remaining movement buys at least one step).
 *
 * The attacker stack is the moving unit plus every same-owner unit that started
 * the move co-located with it. Mutates `state` in place.
 */
function moveUnitWithBattles(
  state: GameState,
  content: GameContent,
  unit: UnitState,
  tx: number,
  ty: number,
): void {
  const map = state.maps[unit.plane];
  if (!map) throw new Error(`No map for plane '${unit.plane}'`);

  const path = findPath(map, unit.x, unit.y, tx, ty);
  if (path === null) throw new Error(`No path for unit '${unit.id}' to (${tx}, ${ty})`);

  // The attacker stack is whoever started this move on the mover's tile.
  const stackMates = stackAt(state, unit.owner, unit.plane, unit.x, unit.y);

  // Walk the path from index 1 (index 0 is the current tile).
  for (let i = 1; i < path.length; i++) {
    if (unit.moves <= 0) break;
    const step = path[i]!;

    // Hostile tile: fight from the adjacent tile; never enter it.
    const lair = lairAt(state, unit.plane, step.x, step.y);
    const enemies = lair ? [] : enemyUnitsAt(state, unit.owner, unit.plane, step.x, step.y);
    if (lair || enemies.length > 0) {
      resolveBattle(state, content, unit, stackMates, step.x, step.y, lair, enemies);
      unit.moves = 0; // attacking ends the turn
      return;
    }

    // Friendly stacking cap: cannot pile onto a full tile.
    const occupants = stackAt(state, unit.owner, unit.plane, step.x, step.y).filter(
      (u) => u.id !== unit.id,
    );
    if (occupants.length >= STACK_CAP) {
      throw new Error(
        `Cannot move unit '${unit.id}' into (${step.x}, ${step.y}): stack is full (max ${STACK_CAP} units)`,
      );
    }

    const cost = MOVE_COSTS[(getTile(map, step.x, step.y) as Tile).terrain];
    unit.x = step.x;
    unit.y = step.y;
    unit.moves = Math.max(0, unit.moves - cost);
  }
}

/**
 * Resolves a battle at (bx, by) between the attacking stack and the defenders
 * (a lair garrison or enemy units), applies casualties/loot, and appends a
 * BattleRecord. The battle seed is forked deterministically from the stored
 * master rng state so replays reproduce the fight exactly.
 */
function resolveBattle(
  state: GameState,
  content: GameContent,
  mover: UnitState,
  stackMates: readonly UnitState[],
  bx: number,
  by: number,
  lair: LairState | undefined,
  enemies: readonly UnitState[],
): void {
  const battleId = `battle-${state.nextBattleId}`;
  state.nextBattleId += 1;

  const attacker = toStack(content, stackMates);

  // Build the defender stack. Lair monsters get synthetic UnitStates so the
  // engine can map casualties back to the parallel monsterHp array.
  const defenderStates: UnitState[] = [];
  if (lair) {
    lair.monsterIds.forEach((defId, idx) => {
      const hp = lair.monsterHp[idx] ?? 0;
      if (hp > 0) {
        defenderStates.push({
          id: `${lair.id}-m${idx}`,
          owner: 'neutral',
          defId,
          plane: lair.plane,
          x: lair.x,
          y: lair.y,
          moves: 0,
          hp,
        });
      }
    });
  } else {
    defenderStates.push(...enemies);
  }
  const defender = toStack(content, defenderStates);

  const tile = getTile(state.maps[mover.plane]!, bx, by) as Tile;
  const battleRng = fromState(state.rngState).fork('battle:' + battleId);
  const seed = battleRng.int(0, 0x7fffffff);

  const result = resolveStacks({
    seed,
    attacker,
    defender,
    terrain: { plane: mover.plane, terrain: tile.terrain },
  });

  // Apply attacker casualties: dead units are removed, survivors take new hp.
  for (const outcome of result.attacker) {
    const u = state.units.find((x) => x.id === outcome.id);
    if (!u) continue;
    if (!outcome.survived) {
      state.units = state.units.filter((x) => x.id !== outcome.id);
    } else {
      u.hp = outcome.hp;
    }
  }

  const attackerWon = result.winner === 'attacker';

  if (lair) {
    // Persist the garrison's damage back into the parallel hp array.
    for (const outcome of result.defender) {
      const idx = Number(outcome.id.slice((lair.id + '-m').length));
      if (Number.isInteger(idx) && idx >= 0 && idx < lair.monsterHp.length) {
        lair.monsterHp[idx] = outcome.survived ? outcome.hp : 0;
      }
    }
    if (attackerWon) {
      lair.cleared = true;
      const player = state.players.find((p) => p.id === mover.owner);
      if (player) {
        player.gold += lair.loot.gold;
        player.mana += lair.loot.mana;
      }
    }
  } else {
    // Enemy-unit defenders: apply their casualties directly.
    for (const outcome of result.defender) {
      const u = state.units.find((x) => x.id === outcome.id);
      if (!u) continue;
      if (!outcome.survived) {
        state.units = state.units.filter((x) => x.id !== outcome.id);
      } else {
        u.hp = outcome.hp;
      }
    }
  }

  state.battles.push({
    id: battleId,
    turn: state.turn,
    plane: mover.plane,
    x: bx,
    y: by,
    attackerPlayer: mover.owner,
    defenderPlayer: lair ? 'neutral' : enemies[0]?.owner ?? 'neutral',
    report: result.report,
    ...(lair ? { lairId: lair.id } : {}),
  });
}
