/**
 * Human-readable descriptions for the 14 typed combat abilities.
 *
 * Every member of the `AbilityDef` union in src/sim/types.ts is covered
 * (exhaustively — the `never` fallthrough makes the compiler enforce it). Used
 * by the unit panel's ability badges and the battle viewer's ability-proc feed.
 */

import type { AbilityDef } from '@sim/types';

export interface AbilityBlurb {
  /** Short badge label. */
  label: string;
  /** Full hover/description text, magnitudes filled in. */
  text: string;
}

export function describeAbility(a: AbilityDef): AbilityBlurb {
  switch (a.type) {
    case 'flying':
      return {
        label: 'Flying',
        text: 'Flies over terrain and obstacles; can only be struck by ranged attacks, reach weapons, or other fliers.',
      };
    case 'first-strike':
      return {
        label: 'First Strike',
        text: 'Lands its blow before the defender can answer — a slower foe may fall before it swings.',
      };
    case 'charge':
      return {
        label: 'Charge',
        text: `Adds +${a.bonus} impact damage on a charge, scaling with speed and mass. Devastating against a loose or broken line.`,
      };
    case 'poison':
      return {
        label: 'Poison',
        text: `Each hit leaves lingering poison (strength ${a.strength}) that keeps dealing damage over the following ticks.`,
      };
    case 'regeneration':
      return {
        label: 'Regeneration',
        text: `Heals ${a.perTick} hit(s) every tick; downed figures can stand back up if the wound closes in time.`,
      };
    case 'fear':
      return {
        label: 'Fear',
        text: `Radiates dread within ${a.radius} tile(s), pressuring the morale of nearby enemies before a blow is struck.`,
      };
    case 'inspire':
      return {
        label: 'Inspire',
        text: `Steadies allies within ${a.radius} tile(s), granting +${a.bonus} morale so they hold and rally.`,
      };
    case 'holy-aura':
      return {
        label: 'Holy Aura',
        text: `Radiant aura heals allies within ${a.radius} tile(s) for ${a.healPerTick} per tick.`,
      };
    case 'life-drain':
      return {
        label: 'Life Drain',
        text: `Heals itself for ${Math.round(a.fraction * 100)}% of the melee damage it deals.`,
      };
    case 'breath-weapon':
      return {
        label: 'Breath Weapon',
        text: `Looses a line blast for ${a.damage} damage out to ${a.range} tiles (cooldown ${a.cooldown} ticks) — can gut a whole formation.`,
      };
    case 'trample':
      return {
        label: 'Trample',
        text: 'Keeps moving through a figure it kills, carving a path deep into a formation.',
      };
    case 'undead':
      return {
        label: 'Undead',
        text: 'Never checks morale (cannot rout); immune to poison and fear; needs no food upkeep.',
      };
    case 'fearless':
      return {
        label: 'Fearless',
        text: 'Passes every morale check through living discipline — it will not break, though it can still be killed.',
      };
    case 'pack-hunter':
      return {
        label: 'Pack Hunter',
        text: 'Strikes harder when flanking a target alongside another pack-hunter.',
      };
    default: {
      const exhaustive: never = a;
      return { label: 'Unknown', text: String(exhaustive) };
    }
  }
}
