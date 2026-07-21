/**
 * Provenance name resolver for the battle viewer.
 *
 * PROBLEM: the combat engine's event schema is frozen. Every `UnitSummary` in a
 * `battle-start` event carries `name = def.name` (the generic "Orc Warrior"),
 * because the engine is handed only `{ id, def, hp }` per unit (BattleUnitInput)
 * — it never sees the strategic UnitState's provenance name ("1st Grimfang Orc
 * Warriors"). So the replay, feed, and end card would show generic names.
 *
 * RESOLVER: a unit's battle identity IS its strategic `UnitState.id` (see
 * src/sim/combat/resolve.ts), so we can recover the provenance name UI-side by
 * matching report unit ids back to live `state.units`. We build a map:
 *
 *   1. baseline: every report unit id → its report name (def.name), so the map
 *      is TOTAL — lair monsters (id `${lair.id}-mN`, no UnitState) and any
 *      already-removed casualty still resolve to a sensible name.
 *   2. override: for any report unit id still present in `game.units` that
 *      carries a `.name`, use that provenance name instead.
 *
 * Because the override only fires for units that still exist, a regiment that
 * died in the battle keeps its generic report name (its UnitState is gone) —
 * acceptable, and strictly better than showing generic names for everyone. In
 * practice the viewer opens right after the fight, so surviving attackers show
 * their provenance and fallen ones read as their type. The map is passed to the
 * feed, end card, and token tooltips (see battleViewer.ts / battleView.ts).
 */

import type { GameState } from '@sim/core/state';
import type { BattleReport } from '@sim/combat/events';
import { battleStart } from './battleSummary';

/** Map every unit id in a battle report to its best display name. */
export function resolveBattleNames(
  report: BattleReport,
  game: GameState | null,
): Map<string, string> {
  const names = new Map<string, string>();
  const start = battleStart(report);
  if (start) for (const u of start.units) names.set(u.id, u.name);
  if (game) {
    for (const u of game.units) {
      if (u.name && names.has(u.id)) names.set(u.id, u.name);
    }
  }
  return names;
}
