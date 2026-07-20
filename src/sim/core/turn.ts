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

import type { GameState, GameContent } from './state';
import type { BuildOrder, CityState, UnitState, YieldBundle } from '../types';
import {
  computeCityYields,
  tickProduction,
  tickGrowth,
  buildBlockReason,
  foundCity,
} from '../city/city';
import { moveUnit } from '../units/units';

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
      const path = moveUnit(map, unit, cmd.to.x, cmd.to.y);
      if (path === null) {
        throw new Error(`No path for unit '${cmd.unitId}' to (${cmd.to.x}, ${cmd.to.y})`);
      }
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

    // (5) Refresh movement for this player's units (including any just spawned).
    for (const unit of next.units) {
      if (unit.owner !== player.id) continue;
      const def = content.units[unit.defId];
      if (def) unit.moves = def.moves;
    }
  }

  next.turn += 1;
  return next;
}
