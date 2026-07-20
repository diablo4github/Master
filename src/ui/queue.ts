/**
 * Pure helpers for the city PRODUCTION QUEUE panel.
 *
 * The sim owns the queue (queue-build / dequeue-build / reorder-build in
 * src/sim/core/turn.ts, QUEUE_CAP in src/sim/city/city.ts). This module derives
 * everything the panel needs to DRAW that queue without touching the sim:
 *
 *  - `queueView`   — one row per queued order, with per-item progress on the
 *    head and a cumulative ETA in turns (∞-safe → null when production ≤ 0).
 *  - `assembleQueueOptions` — the "Add to queue" picker: like the build picker,
 *    but a building whose prerequisite is queued EARLIER counts as available
 *    (so granary→marketplace can be queued in one visit), and orders already in
 *    the queue are flagged so they can't be double-queued.
 *
 * No DOM, no Pixi — unit-tested against the content fixture.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { BuildOrder, CityState } from '@sim/types';
import { buildBlockReason } from '@sim/city/city';
import type { BuildOption } from './buildPicker';

export interface QueueItemView {
  index: number;
  kind: 'building' | 'unit';
  id: string;
  name: string;
  /** Total production cost of this order. */
  cost: number;
  /** Production already invested in this order (only the head is ever > 0). */
  progress: number;
  isHead: boolean;
  /**
   * Turns until THIS item finishes, accounting for every item ahead of it and
   * the head's progress. null when it can never finish at the current rate
   * (production ≤ 0) — the panel shows "∞".
   */
  etaTurns: number | null;
}

function orderCost(content: GameContent, order: BuildOrder): number {
  if (order.kind === 'building') return content.buildings[order.id]?.cost ?? Infinity;
  return content.units[order.id]?.cost ?? Infinity;
}

function orderName(content: GameContent, order: BuildOrder): string {
  const def = order.kind === 'building' ? content.buildings[order.id] : content.units[order.id];
  return def?.name ?? order.id;
}

/**
 * Turns to invest `remaining` production at `production`/turn. ∞-safe:
 * returns null when production ≤ 0 (nothing will ever complete). Anything with
 * remaining ≤ 0 is one turn away (it completes on the next tick).
 */
export function queueEtaTurns(remaining: number, production: number): number | null {
  if (production <= 0) return null;
  if (remaining <= 0) return 1;
  return Math.ceil(remaining / production);
}

/**
 * Rows for the queue, head first. Each row's ETA is cumulative: it sums the
 * cost of every order up to and including this one, subtracts the production
 * already banked in the head, and divides by the per-turn production.
 */
export function queueView(
  content: GameContent,
  city: CityState,
  production: number,
): QueueItemView[] {
  const headProgress = city.buildQueue[0]?.progress ?? 0;
  let cumCost = 0;
  return city.buildQueue.map((order, index) => {
    cumCost += orderCost(content, order);
    const remaining = cumCost - headProgress;
    return {
      index,
      kind: order.kind,
      id: order.id,
      name: orderName(content, order),
      cost: orderCost(content, order),
      progress: order.progress,
      isHead: index === 0,
      etaTurns: queueEtaTurns(remaining, production),
    };
  });
}

export interface QueueBuildOption extends BuildOption {
  /** Already sitting in this city's queue (can't be queued twice). */
  queued: boolean;
}

/**
 * Options for the "Add to queue" picker. Buildings the race can eventually
 * build and mundane units it can train, each annotated with buildability where
 * a building whose prerequisite is queued EARLIER counts as satisfied. Orders
 * already in the queue are flagged `queued` (and marked unbuildable) so the UI
 * can disable them; already-built buildings are excluded by the sim's own
 * reason string as before.
 */
export function assembleQueueOptions(
  state: GameState,
  content: GameContent,
  city: CityState,
): QueueBuildOption[] {
  const race = content.races[city.raceId];
  if (!race) return [];

  const queuedIds = new Set(city.buildQueue.map((o) => o.id));
  const availableBuildings = [
    ...city.buildings,
    ...city.buildQueue.filter((o) => o.kind === 'building').map((o) => o.id),
  ];

  const buildings: QueueBuildOption[] = [];
  for (const id of race.buildings) {
    const def = content.buildings[id];
    if (!def) continue;
    const queued = queuedIds.has(id);
    const reason = queued
      ? 'Already queued'
      : buildBlockReason(state, content, city, 'building', id, { availableBuildings });
    buildings.push({
      kind: 'building',
      id,
      name: def.name,
      cost: def.cost,
      tier: def.tier,
      buildable: !queued && reason === null,
      reason,
      queued,
    });
  }
  buildings.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const units: QueueBuildOption[] = [];
  for (const id of Object.keys(content.units)) {
    const def = content.units[id];
    if (!def) continue;
    if (def.role === 'summon' || 'school' in def.origin) continue;
    const trainableByRace =
      'generic' in def.origin || ('race' in def.origin && def.origin.race === city.raceId);
    if (!trainableByRace) continue;
    const queued = queuedIds.has(id);
    const reason = queued ? 'Already queued' : buildBlockReason(state, content, city, 'unit', id);
    units.push({
      kind: 'unit',
      id,
      name: def.name,
      cost: def.cost ?? 0,
      tier: 0,
      buildable: !queued && reason === null,
      reason,
      queued,
    });
  }
  units.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return [...buildings, ...units];
}
