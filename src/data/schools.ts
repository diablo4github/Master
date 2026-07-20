/**
 * The Five Schools of Magic.
 *
 * Content-as-data: no logic beyond the plain constant below. See
 * docs/DESIGN.md "The Five Schools of Magic" for the source design intent.
 */

import type { SchoolDef, SchoolId } from '@sim/types';

export const SCHOOLS = {
  life: {
    id: 'life',
    name: 'Life',
    color: '#f5f0dc',
    dimension: 'empyrean',
    tagline: 'Blessing, protection, and exaltation.',
    summonProfile:
      'Fewest summons in the game, but the strongest — angelic and celestial ' +
      'beings that cost the most mana and favor to call, and reshape a battle ' +
      'the moment they arrive.',
  },
  death: {
    id: 'death',
    name: 'Death',
    color: '#1a1420',
    dimension: 'charnel-deep',
    tagline: 'Corruption, conversion, and attrition.',
    summonProfile:
      'The broadest summoning access of any school, generally weaker unit for ' +
      'unit. Its signature mechanic is conversion: mundane troops and town ' +
      'population can be turned directly into undead and demonic servants.',
  },
  chaos: {
    id: 'chaos',
    name: 'Chaos',
    color: '#c73a2e',
    dimension: 'maelstrom',
    tagline: 'Destruction, fire, and raw force.',
    summonProfile:
      'Mid-range summons pulled from living infernos and elemental fury; ' +
      'thrives in Meridia, trading subtlety for immediate, overwhelming ' +
      'damage.',
  },
  nature: {
    id: 'nature',
    name: 'Nature',
    color: '#3f8f3a',
    dimension: 'wildroot',
    tagline: 'Growth, beasts, and terrain.',
    summonProfile:
      'Mid-range summons drawn from the wild — great beasts and terrain ' +
      'spirits; thrives in Meridia, and doubles as the school best suited to ' +
      'shaping and enriching the land itself.',
  },
  sorcery: {
    id: 'sorcery',
    name: 'Sorcery',
    color: '#2f6fb0',
    dimension: 'aether',
    tagline: 'Illusion, counter-magic, and manipulation.',
    summonProfile:
      'Mid-range summons woven from illusion and captured spirits; thrives in ' +
      'Meridia, and specializes in unmaking the enemy’s magic as much as ' +
      'fielding its own.',
  },
} as const satisfies Record<SchoolId, SchoolDef>;
