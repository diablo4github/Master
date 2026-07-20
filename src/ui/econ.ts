/**
 * Read-only economic summaries for the HUD.
 *
 * Mirrors the income arithmetic in `advanceTurn` (yields minus upkeep) so the
 * top bar can show "+N/turn" figures without advancing the sim. Purely
 * derived from state + content; never mutates anything.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { StudyDef } from '@sim/types';
import { computeCityYields } from '@sim/city/city';

export interface EmpireSummary {
  gold: number;
  mana: number;
  goldIncome: number;
  manaIncome: number;
  researchIncome: number;
  /** Active study (if any) with progress toward its cost. */
  study: { def: StudyDef; progress: number } | null;
}

/** Aggregates a player's per-turn income across all their cities. */
export function empireSummary(
  state: GameState,
  content: GameContent,
  playerId: string,
): EmpireSummary {
  const player = state.players.find((p) => p.id === playerId);
  const cities = state.cities.filter((c) => c.owner === playerId);
  const units = state.units.filter((u) => u.owner === playerId);

  let gold = 0;
  let mana = 0;
  let research = 0;
  for (const city of cities) {
    const y = computeCityYields(state, content, city);
    gold += y.gold;
    mana += y.mana;
    research += y.research;
  }

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

  const activeId = player?.research.activeStudyId ?? null;
  const activeDef = activeId ? content.studies[activeId] : undefined;

  return {
    gold: player?.gold ?? 0,
    mana: player?.mana ?? 0,
    goldIncome: gold - buildingUpkeep - unitGold,
    manaIncome: mana - unitMana,
    researchIncome: research,
    study: activeDef ? { def: activeDef, progress: player?.research.progress ?? 0 } : null,
  };
}
