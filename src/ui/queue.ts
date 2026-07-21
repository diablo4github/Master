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
   * How many copies of THIS order's id sit in the whole queue. >1 means the
   * player queued the same unit several times (units may be duplicated); the
   * panel shows a "×N" marker so a batch reads at a glance. Buildings are always
   * 1 (the sim rejects a second copy).
   */
  dupCount: number;
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
  const idCounts = new Map<string, number>();
  for (const o of city.buildQueue) idCounts.set(o.id, (idCounts.get(o.id) ?? 0) + 1);
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
      dupCount: idCounts.get(order.id) ?? 1,
      etaTurns: queueEtaTurns(remaining, production),
    };
  });
}

export interface QueueBuildOption extends BuildOption {
  /** Already sitting in this city's queue. For buildings this disables the
   * option (a building is a one-off); units ignore it — duplicates are legal. */
  queued: boolean;
  /** For units: how many copies are already queued (shown as a ×N hint). */
  queuedCount: number;
}

/** The picker split into its two visible shelves. */
export interface QueueOptionSections {
  buildings: QueueBuildOption[];
  units: QueueBuildOption[];
}

/**
 * Options for the "Add to queue" picker, split into a **Buildings** shelf and a
 * **Units** shelf so the panel can header them separately.
 *
 * Buildings: every building the race can eventually build EXCEPT ones already
 * built (those are hidden entirely, never greyed). A building whose prerequisite
 * is queued earlier counts as available; one already queued is flagged `queued`
 * and marked unbuildable (a building is a one-off, no double-queue).
 *
 * Units: mundane trainable units only — summons, wild monsters, and school
 * (summon) origins are filtered OUT entirely (the sim rejects them, so we never
 * show a permanently-locked row). Units may be queued repeatedly, so a
 * queued-already unit stays buildable and carries `queuedCount` for a ×N hint.
 */
export function assembleQueueOptions(
  state: GameState,
  content: GameContent,
  city: CityState,
): QueueOptionSections {
  const race = content.races[city.raceId];
  if (!race) return { buildings: [], units: [] };

  const queuedIds = new Set(city.buildQueue.map((o) => o.id));
  const queuedCounts = new Map<string, number>();
  for (const o of city.buildQueue) queuedCounts.set(o.id, (queuedCounts.get(o.id) ?? 0) + 1);
  const availableBuildings = [
    ...city.buildings,
    ...city.buildQueue.filter((o) => o.kind === 'building').map((o) => o.id),
  ];

  const buildings: QueueBuildOption[] = [];
  for (const id of race.buildings) {
    const def = content.buildings[id];
    if (!def) continue;
    // Already-built buildings are HIDDEN, not greyed.
    if (city.buildings.includes(id)) continue;
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
      queuedCount: queued ? 1 : 0,
    });
  }
  buildings.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const units: QueueBuildOption[] = [];
  for (const id of Object.keys(content.units)) {
    const def = content.units[id];
    if (!def) continue;
    // Summons/monsters are conjured, never trained — omit them so the list
    // shows only what a city can actually produce.
    if (def.role === 'summon' || def.role === 'monster' || 'school' in def.origin) continue;
    const trainableByRace =
      'generic' in def.origin || ('race' in def.origin && def.origin.race === city.raceId);
    if (!trainableByRace) continue;
    // Units may be duplicated: legality doesn't depend on being queued already.
    const reason = buildBlockReason(state, content, city, 'unit', id);
    const count = queuedCounts.get(id) ?? 0;
    units.push({
      kind: 'unit',
      id,
      name: def.name,
      cost: def.cost ?? 0,
      tier: 0,
      buildable: reason === null,
      reason,
      queued: count > 0,
      queuedCount: count,
    });
  }
  units.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return { buildings, units };
}
