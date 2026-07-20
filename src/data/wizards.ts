/**
 * The 21 premade wizards: one for every legal school combination
 * (5 single-school + 9 two-school + 7 three-school; Life+Death never mixed).
 *
 * Content-as-data: no logic beyond the plain constant below. Players pick a
 * premade wizard and may customize only its retort loadout, never its
 * schools. See docs/DESIGN.md "The Five Schools of Magic".
 */

import type { WizardDef } from '@sim/types';

export const WIZARDS = {
  // ---------------------------------------------------------------------
  // Pure mages (5): single school, exploit their exclusive dimension.
  // ---------------------------------------------------------------------
  'ithariel-dawnclad': {
    id: 'ithariel-dawnclad',
    name: 'Ithariel Dawnclad',
    schools: ['life'],
    retorts: ['sunspire-vows', 'gilded-liturgy', 'luminous-covenant', 'warding-sigil'],
    bio:
      'A cloistered high priestess who measures her power in temple spires ' +
      'rather than armies. Ithariel treats the Empyrean as a second home, ' +
      'and would rather raise one perfect cathedral than ten garrisons.',
  },
  'nyxandra-vhale': {
    id: 'nyxandra-vhale',
    name: 'Nyxandra Vhale',
    schools: ['death'],
    retorts: ['grave-tithe', 'bone-ledger', 'charnel-writ', 'umbral-covenant'],
    bio:
      'A charnel administrator who runs conquest like an accountant runs a ' +
      'ledger, converting every fallen soldier and captured farmhand into ' +
      'fresh ranks. The Charnel Deep is less her retreat than her factory.',
  },
  'draven-ashcarn': {
    id: 'draven-ashcarn',
    name: 'Draven Ashcarn',
    schools: ['chaos'],
    retorts: ['cinderborn-pact', 'spellblade-discipline', 'battle-attuned'],
    bio:
      'A warmage who has never met a problem fire could not solve. Draven ' +
      'strides into the Maelstrom to stoke his own fury between campaigns, ' +
      'and fights every battle personally, blade first.',
  },
  'fennric-thornwake': {
    id: 'fennric-thornwake',
    name: 'Fennric Thornwake',
    schools: ['nature'],
    retorts: ['verdant-communion', 'trade-concord', 'ley-anchor'],
    bio:
      'A patient warden-druid who builds slow and builds deep, letting the ' +
      'Wildroot’s bounty feed a realm that grows richer every turn he is left ' +
      'unbothered.',
  },
  'lysenne-quorvain': {
    id: 'lysenne-quorvain',
    name: 'Lysenne Quorvain',
    schools: ['sorcery'],
    retorts: ['mirrorwoven-secrets', 'archive-of-ages', 'warding-sigil'],
    bio:
      'A reclusive researcher who treats the Aether as a laboratory, ' +
      'unraveling illusions other wizards cannot even perceive. Lysenne wins ' +
      'wars by knowing her enemy’s spellbook before the enemy finishes ' +
      'casting.',
  },

  // ---------------------------------------------------------------------
  // Two-school wizards (9).
  // ---------------------------------------------------------------------
  'cassia-emberveil': {
    id: 'cassia-emberveil',
    name: 'Cassia Emberveil',
    schools: ['life', 'chaos'],
    retorts: ['sunspire-vows', 'cinderborn-pact', 'spellblade-discipline'],
    bio:
      'A crusading templar who blesses her own army before burning the ' +
      'enemy’s to ash. Cassia sees no contradiction between exaltation and ' +
      'destruction — both, to her, are forms of judgment.',
  },
  'odharic-greenspire': {
    id: 'odharic-greenspire',
    name: 'Odharic Greenspire',
    schools: ['life', 'nature'],
    retorts: ['sunspire-vows', 'verdant-communion', 'covenant-of-coin'],
    bio:
      'A garden-priest whose temples are grown as much as built, vine and ' +
      'marble fused into monuments. Odharic’s realms are famous for feeding ' +
      'themselves and their neighbors alike.',
  },
  'perrinelle-glasswrought': {
    id: 'perrinelle-glasswrought',
    name: 'Perrinelle Glasswrought',
    schools: ['life', 'sorcery'],
    retorts: ['sunspire-vows', 'mirrorwoven-secrets', 'silver-tongued-envoy'],
    bio:
      'A court diplomat who wraps blessings in illusion and illusion in ' +
      'courtesy, brokering peace treaties that quietly favor her temples ' +
      'above all else.',
  },
  'malgrath-cinderbone': {
    id: 'malgrath-cinderbone',
    name: 'Malgrath Cinderbone',
    schools: ['death', 'chaos'],
    retorts: ['grave-tithe', 'cinderborn-pact', 'warlords-muster'],
    bio:
      'A conqueror-warlord who burns a battlefield first and raises its dead ' +
      'second, leaving nothing behind but ash and a swelling legion of the ' +
      'reanimated.',
  },
  'ysolde-rotgarden': {
    id: 'ysolde-rotgarden',
    name: 'Ysolde Rotgarden',
    schools: ['death', 'nature'],
    retorts: ['grave-tithe', 'verdant-communion', 'bone-ledger'],
    bio:
      'A plague-druid who tends blight the way others tend orchards. Ysolde ' +
      'converts field and folk alike, feeding rot into the soil until the ' +
      'land itself serves her legions.',
  },
  'corvain-duskmere': {
    id: 'corvain-duskmere',
    name: 'Corvain Duskmere',
    schools: ['death', 'sorcery'],
    retorts: ['grave-tithe', 'mirrorwoven-secrets', 'forbidden-index'],
    bio:
      'A spymaster necromancer who prefers a whisper to a war. Corvain’s ' +
      'agents are equal parts illusion and unquiet dead, and his enemies ' +
      'rarely learn who beat them until it is far too late.',
  },
  'brakka-stormroot': {
    id: 'brakka-stormroot',
    name: 'Brakka Stormroot',
    schools: ['chaos', 'nature'],
    retorts: ['cinderborn-pact', 'verdant-communion', 'battle-attuned'],
    bio:
      'A primal shaman who calls down wildfire and thunderstorm in the same ' +
      'breath she calls up beasts from the deep wood. Brakka’s armies fight ' +
      'like the weather: sudden, and total.',
  },
  'zephyrine-wrackspell': {
    id: 'zephyrine-wrackspell',
    name: 'Zephyrine Wrackspell',
    schools: ['chaos', 'sorcery'],
    retorts: ['cinderborn-pact', 'mirrorwoven-secrets', 'spellblade-discipline'],
    bio:
      'A battle-illusionist who feints with phantoms before finishing with ' +
      'fire. Zephyrine treats every war as a magic trick, and the punchline ' +
      'is always an explosion.',
  },
  'wrenna-mistloom': {
    id: 'wrenna-mistloom',
    name: 'Wrenna Mistloom',
    schools: ['nature', 'sorcery'],
    retorts: ['verdant-communion', 'mirrorwoven-secrets', 'wanderers-map'],
    bio:
      'A fey trickster who wraps her forests in mist and misdirection. ' +
      'Wrenna’s realm is rarely where enemy scouts think it is, and rarely ' +
      'as small as they assume.',
  },

  // ---------------------------------------------------------------------
  // Three-school wizards (7).
  // ---------------------------------------------------------------------
  'garrick-solheim': {
    id: 'garrick-solheim',
    name: 'Garrick Solheim',
    schools: ['life', 'chaos', 'nature'],
    retorts: ['sunspire-vows', 'cinderborn-pact', 'verdant-communion', 'warlords-muster'],
    bio:
      'A crusading generalist who blesses his troops, sets the field alight, ' +
      'and lets the wilderness finish the job. Garrick has no exclusive ' +
      'dimension to retreat to, so he simply conquers Meridia outright.',
  },
  'ophelia-vex': {
    id: 'ophelia-vex',
    name: 'Ophelia Vex',
    schools: ['life', 'chaos', 'sorcery'],
    retorts: ['sunspire-vows', 'cinderborn-pact', 'spellblade-discipline', 'warding-sigil'],
    bio:
      'A templar battle-illusionist who blesses her own image a dozen times ' +
      'over before the real Ophelia ever steps into melee, burning down ' +
      'whoever guesses wrong.',
  },
  'halvard-whisperwood': {
    id: 'halvard-whisperwood',
    name: 'Halvard Whisperwood',
    schools: ['life', 'nature', 'sorcery'],
    retorts: ['sunspire-vows', 'verdant-communion', 'mirrorwoven-secrets', 'archive-of-ages'],
    bio:
      'A druidic seer-priest who reads omens in temple smoke and forest ' +
      'canopy alike. Halvard’s realm grows quietly powerful while rivals are ' +
      'still deciding whether he is a threat.',
  },
  'morvath-blightcarn': {
    id: 'morvath-blightcarn',
    name: 'Morvath Blightcarn',
    schools: ['death', 'chaos', 'nature'],
    retorts: ['grave-tithe', 'cinderborn-pact', 'verdant-communion', 'warlords-muster'],
    bio:
      'An apocalyptic warlord who salts a field, burns what grows back, and ' +
      'raises whatever dies from either. Morvath’s campaigns leave nothing ' +
      'recognizable as the land they started from.',
  },
  'sevrenna-duskfall': {
    id: 'sevrenna-duskfall',
    name: 'Sevrenna Duskfall',
    schools: ['death', 'chaos', 'sorcery'],
    retorts: ['grave-tithe', 'cinderborn-pact', 'mirrorwoven-secrets', 'forbidden-index'],
    bio:
      'A nihilistic devastator who wants her enemies dead, their cities in ' +
      'ash, and her involvement in either never proven. Sevrenna is the ' +
      'rumor other wizards trade in dread.',
  },
  'quilan-marrowveil': {
    id: 'quilan-marrowveil',
    name: 'Quilan Marrowveil',
    schools: ['death', 'nature', 'sorcery'],
    retorts: ['grave-tithe', 'verdant-communion', 'mirrorwoven-secrets', 'forbidden-index'],
    bio:
      'A swamp-witch who blurs the line between rot, growth, and illusion ' +
      'until enemies can no longer tell what in her domain is alive, dead, or ' +
      'never real at all.',
  },
  'tarrow-windscar': {
    id: 'tarrow-windscar',
    name: 'Tarrow Windscar',
    schools: ['chaos', 'nature', 'sorcery'],
    retorts: ['cinderborn-pact', 'verdant-communion', 'mirrorwoven-secrets', 'battle-attuned'],
    bio:
      'An elemental generalist who thrives fully in Meridia, where all three ' +
      'of his schools run strongest. Tarrow needs no exotic dimension — the ' +
      'ordinary world is already his to command.',
  },
} as const satisfies Record<string, WizardDef>;
