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

import type { ArmyOrder, GameState, GameContent, LairState } from './state';
import type { BuildOrder, CityState, PlaneId, UnitState, YieldBundle } from '../types';
import {
  computeCityYields,
  tickProduction,
  tickGrowth,
  buildBlockReason,
  foundCity,
  mintEntityId,
  QUEUE_CAP,
} from '../city/city';
import { findPath, MOVE_COSTS } from '../units/units';
import { getTile, type Tile } from '../map/tiles';
import { fromState } from './rng';
import { resolveStacks, type StackUnit } from '../combat/resolve';

/** Commands a player (human or AI) can issue against the sim. */
export type Command =
  | { type: 'end-turn' }
  // Production queue (replaces the old single set-build):
  | { type: 'queue-build'; cityId: string; order: { kind: 'building' | 'unit'; id: string } }
  | { type: 'dequeue-build'; cityId: string; index: number }
  | { type: 'reorder-build'; cityId: string; from: number; to: number }
  // Units & armies:
  | { type: 'move-unit'; unitId: string; to: { x: number; y: number } }
  | { type: 'form-army'; unitIds: string[] }
  | { type: 'join-army'; armyId: string; unitIds: string[] }
  | { type: 'leave-army'; unitIds: string[] }
  | { type: 'merge-stack'; plane: PlaneId; x: number; y: number }
  | { type: 'move-army'; armyId: string; to: { x: number; y: number } }
  | { type: 'fortify-army'; armyId: string }
  // City & research:
  | { type: 'found-city'; unitId: string; name?: string }
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

    case 'queue-build': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const city = requireOwnedCity(next, playerId, cmd.cityId);
      if (city.buildQueue.length >= QUEUE_CAP) {
        throw new Error(`${city.name}'s build queue is full (max ${QUEUE_CAP})`);
      }
      // Duplicate UNIT orders are legal (queue three militia); duplicate
      // BUILDING orders are not — a building is a one-off, so a second copy in
      // the queue is rejected here (an already-BUILT one is caught by
      // buildBlockReason below).
      if (cmd.order.kind === 'building' && city.buildQueue.some((o) => o.id === cmd.order.id)) {
        throw new Error(`'${cmd.order.id}' is already queued in ${city.name}`);
      }
      // Loose queue-time validation: a building whose prerequisite is queued
      // EARLIER counts as available. Race/study legality is still enforced.
      const availableBuildings = [
        ...city.buildings,
        ...city.buildQueue.filter((o) => o.kind === 'building').map((o) => o.id),
      ];
      const reason = buildBlockReason(next, content, city, cmd.order.kind, cmd.order.id, {
        availableBuildings,
      });
      if (reason) throw new Error(reason);
      city.buildQueue.push({ kind: cmd.order.kind, id: cmd.order.id, progress: 0 });
      return next;
    }

    case 'dequeue-build': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const city = requireOwnedCity(next, playerId, cmd.cityId);
      if (cmd.index < 0 || cmd.index >= city.buildQueue.length) {
        throw new Error(`No queue entry at index ${cmd.index} in ${city.name}`);
      }
      city.buildQueue.splice(cmd.index, 1);
      return next;
    }

    case 'reorder-build': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const city = requireOwnedCity(next, playerId, cmd.cityId);
      const len = city.buildQueue.length;
      if (cmd.from < 0 || cmd.from >= len) {
        throw new Error(`No queue entry at index ${cmd.from} in ${city.name}`);
      }
      if (cmd.to < 0 || cmd.to >= len) {
        throw new Error(`Cannot move queue entry to index ${cmd.to} in ${city.name}`);
      }
      const [moved] = city.buildQueue.splice(cmd.from, 1);
      if (moved) city.buildQueue.splice(cmd.to, 0, moved);
      return next;
    }

    case 'move-unit': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      const unit = requireOwnedUnit(next, playerId, cmd.unitId);
      const map = next.maps[unit.plane];
      if (!map) throw new Error(`No map for plane '${unit.plane}'`);
      // Moving a single unit out of its army DETACHES it: it leaves the army
      // and moves alone, and the army disbands if only one member remains.
      if (unit.armyId !== undefined) {
        const leftArmy = unit.armyId;
        delete unit.armyId;
        cleanupArmies(next, leftArmy);
      }
      moveUnitWithBattles(next, content, unit, cmd.to.x, cmd.to.y);
      return next;
    }

    case 'form-army':
      return formArmy(structuredClone(state), playerId, cmd.unitIds);

    case 'join-army':
      return joinArmy(structuredClone(state), playerId, cmd.armyId, cmd.unitIds);

    case 'leave-army':
      return leaveArmy(structuredClone(state), playerId, cmd.unitIds);

    case 'merge-stack':
      return mergeStack(structuredClone(state), playerId, cmd.plane, cmd.x, cmd.y);

    case 'move-army': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      // Validate ownership before recording intent, so a bad army id never
      // leaves a dangling order. An explicit move order replaces any prior
      // order (including fortify).
      requireArmyAnchor(next, playerId, cmd.armyId);
      next.armyOrders[cmd.armyId] = { kind: 'move', x: cmd.to.x, y: cmd.to.y };
      const outcome = marchArmy(next, content, playerId, cmd.armyId, cmd.to.x, cmd.to.y, true);
      reconcileMarchOrder(next, cmd.armyId, outcome);
      return next;
    }

    case 'fortify-army': {
      const next = structuredClone(state);
      requirePlayer(next, playerId);
      requireArmyAnchor(next, playerId, cmd.armyId);
      next.armyOrders[cmd.armyId] = { kind: 'fortify' };
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
      // Name is optional: absent/blank auto-draws the next themed race name;
      // a player-typed name is used as-is. foundCity validates terrain and
      // spacing, throwing on any violation.
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
      // Two research shelves: a study is legal if it belongs to the player's
      // RACE studies list, OR it is a magic study whose school the wizard knows
      // (player.setup.schools). Prereqs (below) are validated the same way for
      // both — a school study's chain lives within its own school tree.
      const isRaceStudy = race.studies.includes(cmd.studyId);
      const isSchoolStudy =
        study.school !== undefined && (player.setup.schools ?? []).includes(study.school);
      if (!isRaceStudy && !isSchoolStudy) {
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

// ---------------------------------------------------------------------------
// Armies: units that move and fight as one
// ---------------------------------------------------------------------------

/** Live members of an army, in stable state order. */
function armyMembers(state: GameState, armyId: string): UnitState[] {
  return state.units.filter((u) => u.armyId === armyId);
}

/**
 * Disbands any army that has dropped to one or zero members (its last member's
 * armyId is cleared). Pass a specific `armyId` to check just that army, or omit
 * to sweep every army — used after battle casualties, where an army may lose
 * members. An army is only ever a subset of a single owner's co-located stack.
 */
function cleanupArmies(state: GameState, armyId?: string): void {
  const ids = new Set<string>();
  for (const u of state.units) {
    if (u.armyId === undefined) continue;
    if (armyId === undefined || u.armyId === armyId) ids.add(u.armyId);
  }
  for (const id of ids) {
    const members = armyMembers(state, id);
    if (members.length <= 1) {
      for (const m of members) delete m.armyId;
      // A disbanded army forgets its standing order.
      delete state.armyOrders[id];
    }
  }
}

/**
 * Resolves and validates an army's anchor member (its first live unit in state
 * order), throwing the standard errors if the army is unknown or not owned by
 * `playerId`. Used by commands that take an army id.
 */
function requireArmyAnchor(state: GameState, playerId: string, armyId: string): UnitState {
  const members = armyMembers(state, armyId);
  if (members.length === 0) throw new Error(`Unknown army '${armyId}'`);
  const anchor = members[0]!;
  if (anchor.owner !== playerId) throw new Error(`Army '${armyId}' is not owned by ${playerId}`);
  return anchor;
}

/** The standing order attached to an army, or undefined if it is idle. */
export function armyOrderOf(state: GameState, armyId: string): ArmyOrder | undefined {
  return state.armyOrders[armyId];
}

/**
 * Armies owned by `playerId` that have NO standing order and still have
 * movement to spend — the set the end-turn assistant surfaces so the player
 * never wastes an army's turn. Fortified and move-ordered armies both carry an
 * order and are therefore excluded. Deterministic: army ids are returned in the
 * order their members first appear in `state.units`.
 */
export function idleArmies(state: GameState, playerId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of state.units) {
    if (u.owner !== playerId || u.armyId === undefined) continue;
    const armyId = u.armyId;
    if (seen.has(armyId)) continue;
    seen.add(armyId);
    if (state.armyOrders[armyId]) continue; // fortified or move-ordered
    const members = armyMembers(state, armyId);
    const remaining = members.reduce((m, x) => Math.min(m, x.moves), Infinity);
    if (remaining > 0) out.push(armyId);
  }
  return out;
}

/** form-army: groups ≥2 co-located, army-free, same-owner units into a new army. */
function formArmy(state: GameState, playerId: string, unitIds: string[]): GameState {
  requirePlayer(state, playerId);
  if (unitIds.length < 2) throw new Error('An army needs at least 2 units');
  if (new Set(unitIds).size !== unitIds.length) throw new Error('Duplicate unit in army');
  if (unitIds.length > STACK_CAP) {
    throw new Error(`An army may hold at most ${STACK_CAP} units`);
  }

  const units = unitIds.map((id) => requireOwnedUnit(state, playerId, id));
  const first = units[0]!;
  for (const u of units) {
    if (u.armyId !== undefined) throw new Error(`Unit '${u.id}' is already in an army`);
    if (u.plane !== first.plane || u.x !== first.x || u.y !== first.y) {
      throw new Error('All units in an army must start on the same tile');
    }
  }

  const armyId = mintEntityId(state, 'army');
  for (const u of units) u.armyId = armyId;
  return state;
}

/** join-army: adds co-located, army-free units to an existing army. */
function joinArmy(state: GameState, playerId: string, armyId: string, unitIds: string[]): GameState {
  requirePlayer(state, playerId);
  const members = armyMembers(state, armyId);
  if (members.length === 0) throw new Error(`Unknown army '${armyId}'`);
  const anchor = members[0]!;
  if (anchor.owner !== playerId) throw new Error(`Army '${armyId}' is not owned by ${playerId}`);
  if (new Set(unitIds).size !== unitIds.length) throw new Error('Duplicate unit in join');

  const units = unitIds.map((id) => requireOwnedUnit(state, playerId, id));
  for (const u of units) {
    if (u.armyId !== undefined) throw new Error(`Unit '${u.id}' is already in an army`);
    if (u.plane !== anchor.plane || u.x !== anchor.x || u.y !== anchor.y) {
      throw new Error(`Unit '${u.id}' is not with army '${armyId}'`);
    }
  }
  if (members.length + units.length > STACK_CAP) {
    throw new Error(`An army may hold at most ${STACK_CAP} units`);
  }

  for (const u of units) u.armyId = armyId;
  return state;
}

/** leave-army: detaches units from their army, disbanding a stub remnant. */
function leaveArmy(state: GameState, playerId: string, unitIds: string[]): GameState {
  requirePlayer(state, playerId);
  const affected = new Set<string>();
  for (const id of unitIds) {
    const unit = requireOwnedUnit(state, playerId, id);
    if (unit.armyId === undefined) throw new Error(`Unit '${id}' is not in an army`);
    affected.add(unit.armyId);
    delete unit.armyId;
  }
  for (const armyId of affected) cleanupArmies(state, armyId);
  return state;
}

/**
 * Moves a whole army toward (tx, ty) as one perfectly-stacked group. The army
 * advances tile by tile at the SLOWEST member's remaining movement (a step is
 * taken only while every member still has movement left, then the tile's cost
 * is deducted from each member). Stacking cap and hostile-tile battles work
 * exactly as for a single unit: reaching a tile adjacent to a live lair (or
 * enemy stack) halts the march and resolves a battle whose attacker side is
 * every same-owner unit co-located with the army. Mutates `state` in place.
 */
function moveArmyWithBattles(
  state: GameState,
  content: GameContent,
  playerId: string,
  armyId: string,
  tx: number,
  ty: number,
): void {
  const members = armyMembers(state, armyId);
  if (members.length === 0) throw new Error(`Unknown army '${armyId}'`);
  const anchor = members[0]!;
  if (anchor.owner !== playerId) throw new Error(`Army '${armyId}' is not owned by ${playerId}`);

  const map = state.maps[anchor.plane];
  if (!map) throw new Error(`No map for plane '${anchor.plane}'`);

  const path = findPath(map, anchor.x, anchor.y, tx, ty);
  if (path === null) throw new Error(`No path for army '${armyId}' to (${tx}, ${ty})`);

  const slowest = () => members.reduce((m, u) => Math.min(m, u.moves), Infinity);

  for (let i = 1; i < path.length; i++) {
    if (slowest() <= 0) break;
    const step = path[i]!;

    // Hostile tile: fight from the current tile with the full co-located stack.
    const lair = lairAt(state, anchor.plane, step.x, step.y);
    const enemies = lair ? [] : enemyUnitsAt(state, anchor.owner, anchor.plane, step.x, step.y);
    if (lair || enemies.length > 0) {
      const stackMates = stackAt(state, anchor.owner, anchor.plane, anchor.x, anchor.y);
      resolveBattle(state, content, anchor, stackMates, step.x, step.y, lair, enemies);
      for (const u of members) u.moves = 0;
      return;
    }

    // Friendly stacking cap: army members plus prior occupants must fit.
    const occupants = stackAt(state, anchor.owner, anchor.plane, step.x, step.y).filter(
      (u) => u.armyId !== armyId,
    );
    if (occupants.length + members.length > STACK_CAP) {
      throw new Error(
        `Cannot move army '${armyId}' into (${step.x}, ${step.y}): stack is full (max ${STACK_CAP} units)`,
      );
    }

    const cost = MOVE_COSTS[(getTile(map, step.x, step.y) as Tile).terrain];
    for (const u of members) {
      u.x = step.x;
      u.y = step.y;
      u.moves = Math.max(0, u.moves - cost);
    }
  }
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

  // Battle deaths may thin an army below two members — disband any stub.
  cleanupArmies(state);

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
