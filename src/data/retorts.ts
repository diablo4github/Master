/**
 * Retorts: wizard perks chosen during customization. Schools are fixed by
 * the premade wizard; retorts are the only thing a player may customize.
 *
 * Content-as-data: no logic beyond the plain constant below. See
 * docs/DESIGN.md for school/summon/world design intent.
 */

import type { RetortDef } from '@sim/types';

export const RETORTS = {
  // -- Start-world retorts ---------------------------------------------------
  'umbral-covenant': {
    id: 'umbral-covenant',
    name: 'Umbral Covenant',
    description:
      'A sworn pact with the courts of the dark world: begin the game in ' +
      'Umbra instead of Meridia. Closed to Life wizards, whose blessings ' +
      'cannot take root in unbroken dark.',
    cost: 2,
    grantsStartWorld: 'umbra',
  },
  'luminous-covenant': {
    id: 'luminous-covenant',
    name: 'Luminous Covenant',
    description:
      'A sworn pact with the courts of the light world: begin the game in ' +
      'Lumina instead of Meridia. Closed to Death wizards, whose corruption ' +
      'cannot take root in unbroken light.',
    cost: 2,
    grantsStartWorld: 'lumina',
  },

  // -- Summon cost / access, school-flavored ---------------------------------
  'grave-tithe': {
    id: 'grave-tithe',
    name: 'Grave Tithe',
    description:
      'Converting mundane troops and town population into undead costs ' +
      'markedly less mana, letting a Death wizard field armies faster than ' +
      'any other school.',
    cost: 3,
    requiresSchool: 'death',
  },
  'bone-ledger': {
    id: 'bone-ledger',
    name: 'Bone Ledger',
    description:
      'Undead raised through conversion carry a fraction of the upkeep of ' +
      'living troops, letting a charnel army swell far past what mundane ' +
      'logistics would allow.',
    cost: 2,
    requiresSchool: 'death',
  },
  'charnel-writ': {
    id: 'charnel-writ',
    name: 'Charnel Writ',
    description:
      'Conquered population converts to loyal undead automatically instead ' +
      'of resisting occupation, turning captured cities into instant grave ' +
      'legions.',
    cost: 2,
    requiresSchool: 'death',
  },
  'sunspire-vows': {
    id: 'sunspire-vows',
    name: 'Sunspire Vows',
    description:
      'Temples cost less production to raise and grant a summon-power bonus ' +
      'that scales with the highest temple tier standing in your realm.',
    cost: 2,
    requiresSchool: 'life',
  },
  'gilded-liturgy': {
    id: 'gilded-liturgy',
    name: 'Gilded Liturgy',
    description:
      'Casting a Life summon from a city with a standing temple discounts ' +
      'its mana cost, rewarding a wizard who builds up rather than out.',
    cost: 2,
    requiresSchool: 'life',
  },
  'cinderborn-pact': {
    id: 'cinderborn-pact',
    name: 'Cinderborn Pact',
    description:
      'Chaos summons cost less mana to call and strike the battlefield with ' +
      'a burst of fire damage the instant they arrive.',
    cost: 2,
    requiresSchool: 'chaos',
  },
  'verdant-communion': {
    id: 'verdant-communion',
    name: 'Verdant Communion',
    description:
      'Nature summons cost less mana, and the terrain around a casting city ' +
      'quietly enriches itself over time, boosting future yields.',
    cost: 2,
    requiresSchool: 'nature',
  },
  'mirrorwoven-secrets': {
    id: 'mirrorwoven-secrets',
    name: 'Mirrorwoven Secrets',
    description:
      'Sorcery summons cost less mana, and the illusions bound into them ' +
      'resist enemy dispelling far better than usual.',
    cost: 2,
    requiresSchool: 'sorcery',
  },

  // -- Combat-caster perks ----------------------------------------------------
  'battle-attuned': {
    id: 'battle-attuned',
    name: 'Battle-Attuned',
    description:
      'While your wizard or hero is present at a battle, nearby troops fight ' +
      'with noticeably higher morale and resolve.',
    cost: 2,
  },
  'spellblade-discipline': {
    id: 'spellblade-discipline',
    name: 'Spellblade Discipline',
    description:
      'Your wizard and heroes strike harder in melee immediately after ' +
      'casting a combat spell, rewarding a caster who wades into the fight.',
    cost: 2,
  },
  'warding-sigil': {
    id: 'warding-sigil',
    name: 'Warding Sigil',
    description:
      'A standing ward reduces all damage your wizard personally takes in ' +
      'battle, making them far harder to snipe off the field.',
    cost: 1,
  },

  // -- Research perks -----------------------------------------------------
  'archive-of-ages': {
    id: 'archive-of-ages',
    name: 'Archive of Ages',
    description:
      'A flat, permanent boost to magical research output across every city ' +
      'in your realm.',
    cost: 2,
  },
  'convocation-of-scholars': {
    id: 'convocation-of-scholars',
    name: 'Convocation of Scholars',
    description:
      'Research output grows with the number of cities you hold, rewarding ' +
      'a wizard who expands wide as much as one who builds tall.',
    cost: 3,
  },
  'forbidden-index': {
    id: 'forbidden-index',
    name: 'Forbidden Index',
    description:
      'Studies belonging to your wizard’s schools cost less research to ' +
      'complete, letting a focused wizard race ahead in their specialty.',
    cost: 1,
  },

  // -- Economy perks ---------------------------------------------------------
  'covenant-of-coin': {
    id: 'covenant-of-coin',
    name: 'Covenant of Coin',
    description: 'A steady, flat increase to gold income across your realm.',
    cost: 1,
  },
  'trade-concord': {
    id: 'trade-concord',
    name: 'Trade Concord',
    description:
      'Trade routes with neutral and allied cities yield substantially more ' +
      'gold than usual.',
    cost: 2,
  },
  'quartermasters-boon': {
    id: 'quartermasters-boon',
    name: 'Quartermaster’s Boon',
    description: 'Gold upkeep for mundane military units is reduced realm-wide.',
    cost: 1,
  },
  'silver-tongued-envoy': {
    id: 'silver-tongued-envoy',
    name: 'Silver-Tongued Envoy',
    description:
      'Diplomatic relations with other wizards start higher and improve ' +
      'faster, and treaties cost less gold to broker.',
    cost: 1,
  },

  // -- Leadership / military perks --------------------------------------------
  'warlords-muster': {
    id: 'warlords-muster',
    name: 'Warlord’s Muster',
    description:
      'Mundane units complete training and production noticeably faster in ' +
      'every city.',
    cost: 2,
  },

  // -- Mana / node perks -----------------------------------------------------
  'ley-anchor': {
    id: 'ley-anchor',
    name: 'Ley Anchor',
    description:
      'Magical nodes under your control produce substantially more mana ' +
      'than usual.',
    cost: 2,
  },
  'font-attunement': {
    id: 'font-attunement',
    name: 'Font Attunement',
    description:
      'Your wizard begins the game with a large reserve of banked mana and ' +
      'regenerates it somewhat faster thereafter.',
    cost: 1,
  },

  // -- Utility -----------------------------------------------------------
  'wanderers-map': {
    id: 'wanderers-map',
    name: 'Wanderer’s Map',
    description:
      'The area around your starting city is revealed at the outset, and ' +
      'scouting units move faster for the rest of the game.',
    cost: 1,
  },
} as const satisfies Record<string, RetortDef>;
