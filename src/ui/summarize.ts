/**
 * Human-readable one-line summaries of building / study effects, for the
 * panels. Pure formatting over the typed effect objects.
 */

import type { CityEffects, StudyDef, YieldBundle } from '@sim/types';

const YIELD_LABEL: Record<keyof YieldBundle, string> = {
  food: 'Food',
  production: 'Prod',
  gold: 'Gold',
  research: 'Rsch',
  mana: 'Mana',
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '');
}

export function summarizeCityEffects(e: CityEffects): string {
  const parts: string[] = [];
  if (e.yields) {
    for (const [k, v] of Object.entries(e.yields)) {
      if (typeof v === 'number' && v !== 0) parts.push(`+${fmt(v)} ${YIELD_LABEL[k as keyof YieldBundle]}`);
    }
  }
  if (e.yieldMultipliers) {
    for (const [k, v] of Object.entries(e.yieldMultipliers)) {
      if (typeof v === 'number' && v !== 1) parts.push(`×${fmt(v)} ${YIELD_LABEL[k as keyof YieldBundle]}`);
    }
  }
  if (e.growthBonus) parts.push(`+${Math.round(e.growthBonus * 100)}% growth`);
  if (e.housing) parts.push(`+${e.housing} housing`);
  if (e.defenseBonus) parts.push(`+${e.defenseBonus} defense`);
  if (e.unrestReduction) parts.push(`-${e.unrestReduction} unrest`);
  return parts.join(', ') || 'No direct yield';
}

export function summarizeStudy(def: StudyDef): string {
  const parts: string[] = [];
  if (def.effects.cityEffects) parts.push(summarizeCityEffects(def.effects.cityEffects));
  if (def.effects.unlocksBuildings?.length) {
    parts.push(`unlocks ${def.effects.unlocksBuildings.length} building(s)`);
  }
  if (def.effects.unlocksUnits?.length) {
    parts.push(`unlocks ${def.effects.unlocksUnits.length} unit(s)`);
  }
  return parts.join(' · ') || 'Attunement';
}
