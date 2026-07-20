/**
 * Pure assembly of a city's production menu.
 *
 * Lists every building the city's race can (eventually) construct and every
 * mundane unit it can train, annotated with whether it is currently buildable
 * and, if not, the sim's own human-readable reason (via buildBlockReason).
 * No Pixi/DOM — unit-testable against a content fixture.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { CityState } from '@sim/types';
import { buildBlockReason } from '@sim/city/city';

export interface BuildOption {
  kind: 'building' | 'unit';
  id: string;
  name: string;
  cost: number;
  tier: number;
  /** Currently buildable in this city. */
  buildable: boolean;
  /** Human-readable reason it is locked, or null when buildable. */
  reason: string | null;
}

/**
 * All production options for a city, buildings first (by tier, then name) then
 * trainable units (by cost, then name). Summons and other-race units are
 * excluded entirely; study/requirement-gated items are included but flagged
 * unbuildable with a reason.
 */
export function assembleBuildOptions(
  state: GameState,
  content: GameContent,
  city: CityState,
): BuildOption[] {
  const race = content.races[city.raceId];
  if (!race) return [];

  const buildings: BuildOption[] = [];
  for (const id of race.buildings) {
    const def = content.buildings[id];
    if (!def) continue;
    const reason = buildBlockReason(state, content, city, 'building', id);
    buildings.push({
      kind: 'building',
      id,
      name: def.name,
      cost: def.cost,
      tier: def.tier,
      buildable: reason === null,
      reason,
    });
  }
  buildings.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  const units: BuildOption[] = [];
  for (const id of Object.keys(content.units)) {
    const def = content.units[id];
    if (!def) continue;
    if (def.role === 'summon' || 'school' in def.origin) continue;
    const trainableByRace =
      'generic' in def.origin || ('race' in def.origin && def.origin.race === city.raceId);
    if (!trainableByRace) continue;
    const reason = buildBlockReason(state, content, city, 'unit', id);
    units.push({
      kind: 'unit',
      id,
      name: def.name,
      cost: def.cost ?? 0,
      tier: 0,
      buildable: reason === null,
      reason,
    });
  }
  units.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));

  return [...buildings, ...units];
}
