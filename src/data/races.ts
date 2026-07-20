/**
 * Races — the 30 playable peoples of Master.
 *
 * Content-as-data: no logic beyond the plain constant below (the small
 * `*_BASIC` / `*_MID` / `*_FULL` arrays are just reused building-list
 * fragments, not behavior). See docs/DESIGN.md "Races — 30 total".
 *
 * Split: 18 native to Meridia (the normal world), 6 to Umbra (the dark
 * world), 6 to Lumina (the light world). Orcs are the sole `generic: true`
 * baseline (growth 1.0, every yield 1.0) that all other races are balanced
 * against. Humans lean Life and are built around the temple chain in
 * `src/data/buildings.ts` — they are the only race with the full five-tier
 * chain; a handful of others cap partway up it, and most lack it entirely.
 */

import type { RaceDef, WorldId } from '@sim/types';

// ---------------------------------------------------------------------------
// Reused building-list fragments (plain data, not logic).
// ---------------------------------------------------------------------------

const ECON_BASIC = ['granary', 'marketplace', 'library'] as const;
const ECON_MID = [
  'granary',
  'marketplace',
  'library',
  'warehouse',
  'university',
  'grand-bazaar',
] as const;
const ECON_FULL = [
  'granary',
  'marketplace',
  'library',
  'warehouse',
  'university',
  'grand-bazaar',
  'trade-consulate',
  'grand-athenaeum',
  'mercantile-exchange',
] as const;

const PROD_BASIC = ['lumber-mill'] as const;
const PROD_MID = ['lumber-mill', 'masons-guild', 'foundry'] as const;
const PROD_FULL = [
  'lumber-mill',
  'masons-guild',
  'foundry',
  'arcane-forge',
  'world-forge',
] as const;

const MIL_BASIC = ['barracks', 'palisade'] as const;
const MIL_MID = [
  'barracks',
  'armory',
  'war-college',
  'palisade',
  'stone-walls',
  'fortress',
] as const;
const MIL_FULL = [
  'barracks',
  'armory',
  'war-college',
  'palisade',
  'stone-walls',
  'fortress',
  'citadel',
  'grand-citadel',
] as const;

const MAGIC_BASIC = ['shrine'] as const;
const MAGIC_MID = ['shrine', 'arcane-sanctum', 'mystic-conclave'] as const;
const MAGIC_FULL = [
  'shrine',
  'arcane-sanctum',
  'mystic-conclave',
  'spellward-bastion',
  'archmages-tower',
] as const;

const TEMPLE_T2 = ['temple', 'grand-tabernacle'] as const;
const TEMPLE_T3 = ['temple', 'grand-tabernacle', 'temple-of-radiant-vows'] as const;
const TEMPLE_FULL = [
  'temple',
  'grand-tabernacle',
  'temple-of-radiant-vows',
  'gilded-temple-spire',
  'celestial-temple',
] as const;

const DARK_BASIC = ['charnel-pit', 'bone-reliquary'] as const;
const DARK_MID = ['charnel-pit', 'bone-reliquary', 'ossuary-spire'] as const;
const DARK_FULL = [
  'charnel-pit',
  'bone-reliquary',
  'ossuary-spire',
  'black-mausoleum',
] as const;

const LIGHT_BASIC = ['radiant-atrium', 'sunwell-basin'] as const;
const LIGHT_MID = ['radiant-atrium', 'sunwell-basin', 'aurora-conclave'] as const;
const LIGHT_FULL = [
  'radiant-atrium',
  'sunwell-basin',
  'aurora-conclave',
  'seraphic-bastion',
] as const;

const MERIDIA: WorldId = 'meridia';
const UMBRA: WorldId = 'umbra';
const LUMINA: WorldId = 'lumina';

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

export const RACES: Record<string, RaceDef> = {
  // =========================================================================
  // Meridia — 18 races
  // =========================================================================
  orcs: {
    id: 'orcs',
    name: 'Orcs',
    homeWorld: MERIDIA,
    generic: true,
    growthRate: 1.0,
    yields: { food: 1.0, production: 1.0, gold: 1.0, research: 1.0, mana: 1.0 },
    buildings: [...ECON_FULL, ...PROD_FULL, ...MIL_FULL, ...MAGIC_BASIC],
    studies: [
      'orcs-warcraft-1',
      'orcs-warcraft-2',
      'orcs-siegecraft-1',
      'orcs-hardened-stock-1',
    ],
    cityNames: [
      "Grokhaz",
      "Uzgash Camp",
      "Mokdrum",
      "Skarnak",
      "Thraggus Hold",
      "Gorrukk",
      "Ashgut",
      "Ravage Camp",
      "Skullmash",
      "Grudgehold",
      "Warfang Camp",
      "Bonecrush Camp",
    ],
    description:
      'The generic baseline of Meridia: unremarkable at everything and capable of ' +
      'everything. Orcs grow, build, and produce at the reference rate other races ' +
      'are balanced against, with the broadest building access of any people.',
  },
  humans: {
    id: 'humans',
    name: 'Humans',
    homeWorld: MERIDIA,
    growthRate: 1.05,
    yields: { food: 1.0, production: 1.0, gold: 1.1, research: 1.2, mana: 1.2 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_MID,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_MID,
      'shrine-of-life',
      ...TEMPLE_FULL,
    ],
    studies: [
      'humans-faith-1',
      'humans-faith-2',
      'humans-life-attunement-1',
      'humans-covenant-rites-1',
      'humans-pilgrimage-1',
    ],
    cityNames: [
      "Trueharbor",
      "Covenant's Rest",
      "Gracehold",
      "Pilgrim's Rise",
      "Faithspire",
      "Vowhaven",
      "Sacrament Hill",
      "Zealcrest",
      "Gildenvow",
      "Mercyfall",
      "Templeward",
      "Steadfast Hollow",
    ],
    description:
      'A devout, Life-leaning people whose civic life revolves around the temple: ' +
      'every settlement aspires to outgrow the last, culminating in monumental ' +
      'gold-and-white spires. The only race that ever completes the full temple chain.',
  },
  dwarves: {
    id: 'dwarves',
    name: 'Dwarves',
    homeWorld: MERIDIA,
    growthRate: 0.8,
    yields: { food: 0.7, production: 1.8, gold: 1.2, research: 0.8, mana: 0.6 },
    buildings: [...ECON_MID, ...PROD_FULL, ...MIL_FULL, ...MAGIC_BASIC, 'temple'],
    studies: ['dwarves-runic-lore-1', 'dwarves-deep-mining-1', 'dwarves-siegecraft-1'],
    cityNames: [
      "Kharaz-Dun",
      "Bronzedeep",
      "Grimhold",
      "Stonereach",
      "Dunkarrow",
      "Ironvein",
      "Kraggendel",
      "Thrundelve",
      "Deepforge",
      "Skarrenhall",
      "Ombrak Hold",
      "Vundrikeep",
    ],
    description:
      'Mountain artisans with the strongest production in Meridia and matching ' +
      'access to fortification and forge buildings. Slow to breed and largely ' +
      'indifferent to magic beyond a single humble shrine to keep the peace.',
  },
  'high-elves': {
    id: 'high-elves',
    name: 'High Elves',
    homeWorld: MERIDIA,
    growthRate: 0.7,
    yields: { food: 0.8, production: 0.7, gold: 1.1, research: 1.8, mana: 1.7 },
    schoolAffinity: 'sorcery',
    buildings: [
      ...ECON_FULL,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_FULL,
      'shrine-of-sorcery',
      ...TEMPLE_T3,
    ],
    studies: [
      'high-elves-arcane-lore-1',
      'high-elves-arcane-lore-2',
      'high-elves-star-charting-1',
      'high-elves-enchantment-1',
    ],
    cityNames: [
      "Aelenthar",
      "Sil'Vareth",
      "Lorendil",
      "Maerathyr",
      "Ithareth",
      "Calenmire",
      "Ysendral",
      "Norathiel",
      "Quelanor",
      "Faelistar",
      "Threnodel",
      "Vaelithorn",
    ],
    description:
      'Ancient scholars steeped in Sorcery, with research and mana yields unmatched ' +
      'outside Lumina. Slow-breeding and militarily soft, they lean entirely on ' +
      'magic and trade — and keep enough piety to raise temples three tiers deep.',
  },
  'wood-elves': {
    id: 'wood-elves',
    name: 'Wood Elves',
    homeWorld: MERIDIA,
    growthRate: 1.0,
    yields: { food: 1.3, production: 0.8, gold: 0.9, research: 1.1, mana: 1.3 },
    schoolAffinity: 'nature',
    buildings: [...ECON_BASIC, ...PROD_BASIC, ...MIL_MID, ...MAGIC_MID, 'shrine-of-nature'],
    studies: [
      'wood-elves-woodcraft-1',
      'wood-elves-beastfriend-1',
      'wood-elves-pathfinding-1',
    ],
    cityNames: [
      "Greenhollow",
      "Thornwood Vale",
      "Elderleaf",
      "Mosswatch",
      "Willowmere",
      "Fernshade",
      "Duskbranch",
      "Ashenglen",
      "Larkwood",
      "Brackenfall",
      "Hollowbrook",
      "Wyldrest",
    ],
    description:
      'Forest rangers attuned to Nature, thriving off strong food and mana yields ' +
      'from land they refuse to clear-cut. Skilled skirmishers with little taste ' +
      'for heavy industry or trade infrastructure.',
  },
  'dusk-elves': {
    id: 'dusk-elves',
    name: 'Dusk Elves',
    homeWorld: MERIDIA,
    growthRate: 0.9,
    yields: { food: 0.8, production: 1.0, gold: 1.3, research: 1.2, mana: 1.1 },
    schoolAffinity: 'chaos',
    buildings: [...ECON_MID, ...PROD_BASIC, ...MIL_MID, ...MAGIC_MID, 'shrine-of-chaos'],
    studies: [
      'dusk-elves-shadow-cant-1',
      'dusk-elves-raiding-1',
      'dusk-elves-poisoncraft-1',
    ],
    cityNames: [
      "Nyxaranth",
      "Vhessara",
      "Sha'lindre",
      "Duskmere",
      "Kelvash",
      "Zhaltiri",
      "Vor'ashen",
      "Raven's Cant",
      "Silthorn",
      "Mireshade",
      "Quen'thala",
      "Blackbriar Vale",
    ],
    description:
      'Shadowed cousins of the high elves who never left the deep woods for the ' +
      'sunlit courts. Cunning raiders and smugglers with a taste for Chaos magic, ' +
      'strong on gold and research but never quite trusted by their neighbors.',
  },
  halflings: {
    id: 'halflings',
    name: 'Halflings',
    homeWorld: MERIDIA,
    growthRate: 1.3,
    yields: { food: 1.6, production: 0.7, gold: 1.3, research: 0.9, mana: 0.7 },
    buildings: [...ECON_FULL, ...PROD_BASIC, ...MIL_BASIC, ...MAGIC_BASIC, ...TEMPLE_T2],
    studies: [
      'halflings-hearth-lore-1',
      'halflings-foraging-1',
      'halflings-luck-charms-1',
    ],
    cityNames: [
      "Hearthdown",
      "Clover Bend",
      "Barleywick",
      "Sweetmeadow",
      "Pumpkin Hollow",
      "Honeybrook",
      "Millbrook Fen",
      "Berryvale",
      "Nutbrook",
      "Windlefen",
      "Sunnyhollow",
      "Dapplewick",
    ],
    description:
      'Cheerful, fast-breeding farmer-folk with the best food and gold yields in ' +
      'Meridia. Weak in production and war, but pious enough in a homespun way to ' +
      'raise a modest tabernacle in every hamlet.',
  },
  lizardfolk: {
    id: 'lizardfolk',
    name: 'Lizardfolk',
    homeWorld: MERIDIA,
    growthRate: 1.2,
    yields: { food: 1.4, production: 1.3, gold: 0.7, research: 0.6, mana: 0.9 },
    buildings: [...ECON_BASIC, ...PROD_MID, ...MIL_MID, ...MAGIC_BASIC],
    studies: [
      'lizardfolk-swamp-lore-1',
      'lizardfolk-venomcraft-1',
      'lizardfolk-hatchery-rites-1',
    ],
    cityNames: [
      "Sszithra",
      "Xik'thara",
      "Vashkeel",
      "Krosstiss",
      "Thallask",
      "Ixarune",
      "Skarrvash",
      "Mirezz",
      "Vorssath",
      "Yssiktar",
      "Zhukatal",
      "Brakkosh",
    ],
    description:
      'Amphibious swamp-dwellers that breed and build quickly, combining strong ' +
      'food and production with little interest in scholarship, trade, or magic.',
  },
  gnolls: {
    id: 'gnolls',
    name: 'Gnolls',
    homeWorld: MERIDIA,
    growthRate: 1.4,
    yields: { food: 1.1, production: 1.2, gold: 0.8, research: 0.5, mana: 0.6 },
    buildings: [...ECON_BASIC, ...PROD_BASIC, ...MIL_FULL, ...MAGIC_BASIC],
    studies: ['gnolls-pack-tactics-1', 'gnolls-scavenging-1', 'gnolls-frenzy-rites-1'],
    cityNames: [
      "Yikka-Gnash",
      "Snarlrock",
      "Gnashpit",
      "Yipfang",
      "Kraggle Maw",
      "Ratclaw Camp",
      "Skreel Hollow",
      "Muckfang",
      "Ha'yikka",
      "Bonegnash",
      "Yowlmaw",
      "Krakfen",
    ],
    description:
      'Hyena-kin raiders who breed explosively and overrun enemies through sheer ' +
      'numbers, backed by the deepest military building access in Meridia. Books ' +
      'and shrines hold little interest for the pack.',
  },
  beastkin: {
    id: 'beastkin',
    name: 'Beastkin',
    homeWorld: MERIDIA,
    growthRate: 1.1,
    yields: { food: 1.2, production: 1.1, gold: 0.9, research: 0.7, mana: 1.0 },
    schoolAffinity: 'nature',
    buildings: [...ECON_BASIC, ...PROD_MID, ...MIL_MID, ...MAGIC_MID, 'shrine-of-nature'],
    studies: [
      'beastkin-totem-lore-1',
      'beastkin-pack-hunting-1',
      'beastkin-shapeward-1',
    ],
    cityNames: [
      "Talonreach",
      "Stagheart Camp",
      "Wolfmoor",
      "Bramblehorn",
      "Elkwatch",
      "Fangwood Rest",
      "Owlspire",
      "Ashclaw",
      "Ravenfoot",
      "Boarhide Hollow",
      "Foxglen",
      "Bearclaw Reach",
    ],
    description:
      'Hybrid animal-tribes bound to Nature, well-rounded hunters and warriors with ' +
      'a totemic spiritual streak. No single standout yield, but no glaring weakness.',
  },
  draconians: {
    id: 'draconians',
    name: 'Draconians',
    homeWorld: MERIDIA,
    growthRate: 0.7,
    yields: { food: 0.8, production: 1.4, gold: 1.0, research: 1.0, mana: 1.4 },
    schoolAffinity: 'chaos',
    buildings: [...ECON_BASIC, ...PROD_MID, ...MIL_FULL, ...MAGIC_MID, 'shrine-of-chaos'],
    studies: [
      'draconians-dragon-blood-1',
      'draconians-flamecraft-1',
      'draconians-wing-drill-1',
    ],
    cityNames: [
      "Vaszrakor",
      "Kharzuun",
      "Ignathrax",
      "Drakscale Hold",
      "Zarrenfyre",
      "Vhorrak",
      "Cindrathis",
      "Skaldrath",
      "Emberclaw Roost",
      "Rhaxador",
      "Fyrhollow",
      "Karnasyth",
    ],
    description:
      'Dragon-descended warriors touched by Chaos, slow to multiply but ferocious ' +
      'in the field, with production and mana well above baseline.',
  },
  nomads: {
    id: 'nomads',
    name: 'Nomads',
    homeWorld: MERIDIA,
    growthRate: 1.0,
    yields: { food: 1.0, production: 0.8, gold: 1.4, research: 0.8, mana: 0.8 },
    buildings: [...ECON_MID, ...PROD_BASIC, ...MIL_MID, ...MAGIC_BASIC],
    studies: ['nomads-horse-lore-1', 'nomads-trade-routes-1', 'nomads-scouting-1'],
    cityNames: [
      "Windreach",
      "Duskcaravan",
      "Saltflat Rest",
      "Sablewind",
      "Horizon's Fare",
      "Amberdust",
      "Tradewind Camp",
      "Farrider's Rest",
      "Goldensteppe",
      "Duneshadow",
      "Cindertrail",
      "Wanderhearth",
    ],
    description:
      'Horse-borne plains traders who thrive on caravan gold and mobility, with ' +
      'middling everything else and little patience for permanent architecture.',
  },
  barbarians: {
    id: 'barbarians',
    name: 'Barbarians',
    homeWorld: MERIDIA,
    growthRate: 1.2,
    yields: { food: 1.0, production: 1.3, gold: 0.7, research: 0.5, mana: 0.7 },
    buildings: [...ECON_BASIC, ...PROD_MID, ...MIL_FULL, ...MAGIC_BASIC],
    studies: [
      'barbarians-warcry-1',
      'barbarians-ironworking-1',
      'barbarians-raiding-1',
    ],
    cityNames: [
      "Skarrholt",
      "Ironclaw Hold",
      "Battlemoor",
      "Wolfsblood Camp",
      "Grimtusk",
      "Redaxe Hollow",
      "Bonecarve",
      "Thundermaw",
      "Skyrend Hold",
      "Ravensworn",
      "Stormfang",
      "Warhowl",
    ],
    description:
      'Tribal warrior-clans built for war and little else: strong growth and ' +
      'production feed a deep military building line, with scholarship and trade ' +
      'left to softer peoples.',
  },
  chitinfolk: {
    id: 'chitinfolk',
    name: 'Chitinfolk',
    homeWorld: MERIDIA,
    growthRate: 1.3,
    yields: { food: 0.9, production: 1.8, gold: 0.6, research: 0.6, mana: 0.5 },
    buildings: [...ECON_BASIC, ...PROD_FULL, ...MIL_MID, ...MAGIC_BASIC],
    studies: [
      'chitinfolk-hive-mind-1',
      'chitinfolk-chitin-forging-1',
      'chitinfolk-swarm-labor-1',
    ],
    cityNames: [
      "Tk'vessa Hive",
      "Chrysalith",
      "Skitterhold",
      "Mandible Reach",
      "Hivespire",
      "Carapace Hollow",
      "Xiit'ra",
      "Thrumhive",
      "Clickmoor",
      "Swarmwell",
      "K'thassa",
      "Ossivein",
    ],
    description:
      'A hive-minded insectoid people whose tireless, coordinated labor drives the ' +
      'second-highest production in Meridia. Individuality, trade, and magic are ' +
      'all foreign concepts to the hive.',
  },
  gnomes: {
    id: 'gnomes',
    name: 'Gnomes',
    homeWorld: MERIDIA,
    growthRate: 0.9,
    yields: { food: 0.8, production: 1.3, gold: 1.0, research: 1.6, mana: 1.2 },
    schoolAffinity: 'sorcery',
    buildings: [
      ...ECON_MID,
      ...PROD_FULL,
      ...MIL_BASIC,
      ...MAGIC_FULL,
      'shrine-of-sorcery',
    ],
    studies: [
      'gnomes-tinkering-1',
      'gnomes-illusion-craft-1',
      'gnomes-clockwork-1',
      'gnomes-arcane-engineering-1',
    ],
    cityNames: [
      "Gearhollow",
      "Brasswick",
      "Tinkervale",
      "Clockspire",
      "Springworks",
      "Coppergear",
      "Whirligig Hollow",
      "Sparkforge",
      "Bellowsmoke",
      "Rivethollow",
      "Gizmorrow",
      "Cogwhistle",
    ],
    description:
      'Inventive tinkerers steeped in Sorcery, pairing strong research with ' +
      'surprisingly deep production access through clockwork industry. Poor soldiers ' +
      'who would rather not fight at all.',
  },
  ogres: {
    id: 'ogres',
    name: 'Ogres',
    homeWorld: MERIDIA,
    growthRate: 0.8,
    yields: { food: 0.9, production: 1.7, gold: 0.6, research: 0.5, mana: 0.5 },
    buildings: [...ECON_BASIC, ...PROD_MID, ...MIL_FULL, ...MAGIC_BASIC],
    studies: [
      'ogres-brute-strength-1',
      'ogres-crude-siegecraft-1',
      'ogres-thick-hide-1',
    ],
    cityNames: [
      "Grubknuckle",
      "Skullcrush Camp",
      "Bonebash",
      "Mudflop",
      "Thudrock",
      "Gutstomp",
      "Clubfen",
      "Bruteholm",
      "Smashmoor",
      "Grimeknuckle",
      "Dungheap Rest",
      "Boulderguts",
    ],
    description:
      'Hulking brutes prized for raw production and muscle in the shield wall. ' +
      'Nearly illiterate as a people, with the shortest study list and weakest ' +
      'magic access of any Meridian race.',
  },
  centaurfolk: {
    id: 'centaurfolk',
    name: 'Centaurfolk',
    homeWorld: MERIDIA,
    growthRate: 1.0,
    yields: { food: 1.2, production: 1.0, gold: 1.1, research: 0.8, mana: 0.9 },
    buildings: [...ECON_MID, ...PROD_BASIC, ...MIL_MID, ...MAGIC_BASIC],
    studies: [
      'centaurfolk-plains-lore-1',
      'centaurfolk-cavalry-drill-1',
      'centaurfolk-herd-wisdom-1',
    ],
    cityNames: [
      "Hoofmarch",
      "Wildmane Vale",
      "Cloverun",
      "Sunmeadow Reach",
      "Farrowfield",
      "Galemere",
      "Longstride",
      "Windmane Camp",
      "Brackenhoof",
      "Sedgemoor",
      "Thistledown Reach",
      "Amberfield",
    ],
    description:
      'Plains-dwelling horse-bodied folk, natural cavalry and herders with balanced ' +
      'yields across the board and no particular weakness.',
  },
  tidefolk: {
    id: 'tidefolk',
    name: 'Tidefolk',
    homeWorld: MERIDIA,
    growthRate: 1.0,
    yields: { food: 1.3, production: 0.8, gold: 1.2, research: 1.1, mana: 1.2 },
    schoolAffinity: 'sorcery',
    buildings: [
      ...ECON_MID,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_MID,
      'shrine-of-sorcery',
    ],
    studies: [
      'tidefolk-current-lore-1',
      'tidefolk-coral-craft-1',
      'tidefolk-tide-calling-1',
    ],
    cityNames: [
      "Coralhold",
      "Tidereach",
      "Saltspire",
      "Brinewater",
      "Pearlshoal",
      "Kelpmere",
      "Wavecrest Hollow",
      "Driftmoor",
      "Foamwick",
      "Deepcurrent",
      "Shellstrand",
      "Moonlit Shoal",
    ],
    description:
      'Amphibious coastal folk who harvest the sea and read its currents like ' +
      'scripture. Capable across food, gold, and magic, but non-militant by nature.',
  },

  // =========================================================================
  // Umbra — 6 races (death-flavored)
  // =========================================================================
  wraithkin: {
    id: 'wraithkin',
    name: 'Wraithkin',
    homeWorld: UMBRA,
    growthRate: 0.6,
    yields: { food: 0.5, production: 0.6, gold: 0.8, research: 1.3, mana: 1.9 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_BASIC,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_MID,
      'shrine-of-death',
      ...DARK_FULL,
    ],
    studies: [
      'wraithkin-soul-lore-1',
      'wraithkin-incorporeal-drift-1',
      'wraithkin-dread-aura-1',
    ],
    cityNames: [
      "Sorrowveil",
      "Palehollow",
      "Mournspire",
      "Grayveil Hollow",
      "Whisperfen",
      "Duskshroud",
      "Fadewick",
      "Hollowsigh",
      "Wanehallow",
      "Greymist Reach",
      "Silentmarch",
      "Echofen",
    ],
    description:
      'Incorporeal death-touched spirits bound loosely to mortal shape. They barely ' +
      'eat and barely build, but channel mana more freely than any other people, ' +
      'and hold the full run of Umbra\'s bone-built architecture.',
  },
  ghouls: {
    id: 'ghouls',
    name: 'Ghouls',
    homeWorld: UMBRA,
    growthRate: 1.1,
    yields: { food: 0.5, production: 1.1, gold: 0.5, research: 0.5, mana: 1.1 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_BASIC,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_BASIC,
      'shrine-of-death',
      ...DARK_MID,
    ],
    studies: [
      'ghouls-feeding-rites-1',
      'ghouls-carrion-lore-1',
      'ghouls-rotcraft-1',
    ],
    cityNames: [
      "Charnegrave",
      "Rotmarsh",
      "Gnawhollow",
      "Fleshmire",
      "Maggotfen",
      "Boneheap",
      "Carrionwick",
      "Graveglut",
      "Putrid Hollow",
      "Skinpit",
      "Wormrest",
      "Ratbone Fen",
    ],
    description:
      'Cannibal, undead-adjacent folk who grow their numbers by feeding on the ' +
      'fallen rather than farming. Low food needs, middling everything else.',
  },
  hollowfolk: {
    id: 'hollowfolk',
    name: 'Hollowfolk',
    homeWorld: UMBRA,
    growthRate: 0.9,
    yields: { food: 0.6, production: 1.0, gold: 0.7, research: 0.7, mana: 1.2 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_BASIC,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_MID,
      'shrine-of-death',
      ...DARK_MID,
    ],
    studies: [
      'hollowfolk-hunger-rites-1',
      'hollowfolk-bone-whittling-1',
      'hollowfolk-pale-lore-1',
    ],
    cityNames: [
      "Hollowdeep",
      "Palegrasp",
      "Gauntmire",
      "Hungerdelve",
      "Cavewane",
      "Ashenhollow",
      "Bleakburrow",
      "Stonewane",
      "Duskdelve",
      "Marrowdeep",
      "Faminehold",
      "Greydelve",
    ],
    description:
      'Pale, gaunt cannibal clans dwelling in Umbra\'s deep hollows. Unsettling to ' +
      'outsiders but competent in both war and death-magic, with no severe weaknesses.',
  },
  'shadow-goblins': {
    id: 'shadow-goblins',
    name: 'Shadow Goblins',
    homeWorld: UMBRA,
    growthRate: 1.3,
    yields: { food: 0.8, production: 1.2, gold: 1.0, research: 0.6, mana: 1.0 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_BASIC,
      ...PROD_MID,
      ...MIL_FULL,
      ...MAGIC_BASIC,
      'shrine-of-death',
      ...DARK_BASIC,
    ],
    studies: [
      'shadow-goblins-ambush-craft-1',
      'shadow-goblins-tunnel-lore-1',
      'shadow-goblins-nightsight-1',
    ],
    cityNames: [
      "Nightburrow",
      "Skulkhollow",
      "Sneakwarren",
      "Tunnelfang",
      "Blackburrow",
      "Creepmaw",
      "Duskscuttle",
      "Shivfen",
      "Slygrot",
      "Gloomwarren",
      "Snickerhollow",
      "Vermingully",
    ],
    description:
      'Sly, fast-breeding raiders who strike from the dark and back it up with a ' +
      'deep military building line. Little patience for study, plenty for war.',
  },
  'vampire-aristocracy': {
    id: 'vampire-aristocracy',
    name: 'Vampire Aristocracy',
    homeWorld: UMBRA,
    growthRate: 0.5,
    yields: { food: 0.5, production: 0.8, gold: 1.9, research: 1.6, mana: 1.7 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_FULL,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_FULL,
      'shrine-of-death',
      ...DARK_FULL,
    ],
    studies: [
      'vampire-aristocracy-blood-lore-1',
      'vampire-aristocracy-court-intrigue-1',
      'vampire-aristocracy-dominion-rites-1',
      'vampire-aristocracy-undying-legacy-1',
    ],
    cityNames: [
      "Vaelgrave Court",
      "Bloodspire",
      "Nocturne Hollow",
      "Crimson Sepulcher",
      "Ravensgrave Manor",
      "Gravemourn Hall",
      "Sable Reliquary",
      "Withering Crown",
      "Moonless Court",
      "Obsidian Crypt",
      "Sanguine Hollow",
      "Elderblood Keep",
    ],
    description:
      'An ancient noble bloodline ruling Umbra from gilded crypts. The slowest ' +
      'growth of any race in the game, offset by the best gold yield, deep research ' +
      'and mana, and full command of every building Umbra offers.',
  },
  'plague-cultists': {
    id: 'plague-cultists',
    name: 'Plague Cultists',
    homeWorld: UMBRA,
    growthRate: 1.2,
    yields: { food: 0.9, production: 0.9, gold: 1.3, research: 0.8, mana: 1.1 },
    schoolAffinity: 'death',
    buildings: [
      ...ECON_MID,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_BASIC,
      'shrine-of-death',
      ...DARK_MID,
    ],
    studies: [
      'plague-cultists-contagion-rites-1',
      'plague-cultists-plunder-craft-1',
      'plague-cultists-fervor-1',
    ],
    cityNames: [
      "Pestgrave",
      "Bilehollow",
      "Fevermarsh",
      "Rotwick Shrine",
      "Cinderplague",
      "Miasma Hollow",
      "Blightmoor",
      "Sorewick",
      "Contagion Rest",
      "Plaguewrit Hollow",
      "Sickle Hollow",
      "Fester's End",
    ],
    description:
      'Fanatic devotees who spread disease as doctrine, prospering through plunder ' +
      'and grim fervor rather than honest toil. Solid gold and mana, average at ' +
      'everything else.',
  },

  // =========================================================================
  // Lumina — 6 races (life-flavored)
  // =========================================================================
  sunborn: {
    id: 'sunborn',
    name: 'Sunborn',
    homeWorld: LUMINA,
    growthRate: 0.9,
    yields: { food: 0.9, production: 0.9, gold: 1.0, research: 1.3, mana: 1.6 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_MID,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_MID,
      'shrine-of-life',
      ...LIGHT_FULL,
    ],
    studies: [
      'sunborn-celestial-blood-1',
      'sunborn-radiant-oath-1',
      'sunborn-blessing-rites-1',
    ],
    cityNames: [
      "Sunspire Reach",
      "Dawnhollow",
      "Radiant Vale",
      "Goldenlight Hold",
      "Sunwardcrest",
      "Brightmoor",
      "Solarian Hollow",
      "Daybreak Landing",
      "Aurelian Hold",
      "Lightwarden Reach",
      "Glowmere",
      "Sundial Crest",
    ],
    description:
      'Mortals touched by celestial light generations back, natural clerics and ' +
      'knights of Lumina with strong mana and balanced war-craft. The most ' +
      'well-rounded of the light-world peoples.',
  },
  'lammasu-folk': {
    id: 'lammasu-folk',
    name: 'Lammasu Folk',
    homeWorld: LUMINA,
    growthRate: 0.7,
    yields: { food: 1.0, production: 1.1, gold: 1.0, research: 1.4, mana: 1.3 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_FULL,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_MID,
      'shrine-of-life',
      ...LIGHT_MID,
    ],
    studies: [
      'lammasu-folk-oracular-wisdom-1',
      'lammasu-folk-guardian-oath-1',
      'lammasu-folk-law-lore-1',
    ],
    cityNames: [
      "Oraclehold",
      "Judicaster",
      "Lawspire",
      "Verdict Hollow",
      "Scalehaven",
      "Wisdomreach",
      "Sagecourt",
      "Truthgate",
      "Ledgerhall",
      "Counsel's Rest",
      "Foresight Vale",
      "Mandate Hollow",
    ],
    description:
      'Lion-bodied, human-faced sages who serve as judges and oracles across ' +
      'Lumina. Wise and prosperous, with the deepest economic building access on ' +
      'the plane, but no appetite for war.',
  },
  'seraphic-avians': {
    id: 'seraphic-avians',
    name: 'Seraphic Avians',
    homeWorld: LUMINA,
    growthRate: 1.0,
    yields: { food: 1.1, production: 0.8, gold: 0.9, research: 1.0, mana: 1.4 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_BASIC,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_MID,
      'shrine-of-life',
      ...LIGHT_BASIC,
    ],
    studies: [
      'seraphic-avians-windsong-1',
      'seraphic-avians-skyward-drill-1',
      'seraphic-avians-featherlight-1',
    ],
    cityNames: [
      "Skyhaven Aerie",
      "Windroost",
      "Cloudperch",
      "Featherreach",
      "Highwing Hollow",
      "Aerieholm",
      "Skysong Nest",
      "Galecrest",
      "Talonwatch",
      "Cirrus Hollow",
      "Wingspire",
      "Zephyr Roost",
    ],
    description:
      'Winged bird-folk who patrol Lumina\'s high air, swift skirmishers with a ' +
      'natural gift for mana and food, but thin production and only the most ' +
      'humble of the radiant structures.',
  },
  crystalfolk: {
    id: 'crystalfolk',
    name: 'Crystalfolk',
    homeWorld: LUMINA,
    growthRate: 0.6,
    yields: { food: 0.5, production: 1.5, gold: 1.2, research: 1.2, mana: 1.5 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_MID,
      ...PROD_FULL,
      ...MIL_MID,
      ...MAGIC_FULL,
      'shrine-of-life',
      ...LIGHT_MID,
    ],
    studies: [
      'crystalfolk-refraction-lore-1',
      'crystalfolk-living-lattice-1',
      'crystalfolk-resonance-rites-1',
    ],
    cityNames: [
      "Prismhold",
      "Facetreach",
      "Glimmerdeep",
      "Shardspire",
      "Lucent Hollow",
      "Crystalvein",
      "Refractspire",
      "Glasswrought",
      "Opalhollow",
      "Radiant Facet",
      "Diamondrift",
      "Quartzhold",
    ],
    description:
      'Living crystal beings that need almost no food and grow slowly by accretion, ' +
      'offering formidable production and magic in exchange for a population that ' +
      'is always small.',
  },
  sidhefolk: {
    id: 'sidhefolk',
    name: 'Sidhefolk',
    homeWorld: LUMINA,
    growthRate: 0.8,
    yields: { food: 1.0, production: 0.8, gold: 1.4, research: 1.1, mana: 1.5 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_FULL,
      ...PROD_BASIC,
      ...MIL_MID,
      ...MAGIC_MID,
      'shrine-of-life',
      ...LIGHT_FULL,
    ],
    studies: [
      'sidhefolk-unicorn-bond-1',
      'sidhefolk-fae-court-1',
      'sidhefolk-glamour-rites-1',
    ],
    cityNames: [
      "Caelmara",
      "Sionnfaer",
      "Liannor",
      "Faelurien",
      "Brighdanel",
      "Sionnwyth",
      "Aelfsong Court",
      "Thessaline Fae",
      "Ravenshee",
      "Silverhoof Glade",
      "Gloamfae",
      "Wisplight Court",
    ],
    description:
      'Fae nobility of Lumina who ride unicorns to war and hold court in radiant ' +
      'palaces. Wealthy and magically gifted, with a taste for pageantry over ' +
      'heavy industry.',
  },
  haloborn: {
    id: 'haloborn',
    name: 'Haloborn',
    homeWorld: LUMINA,
    growthRate: 0.7,
    yields: { food: 0.5, production: 0.7, gold: 0.9, research: 1.5, mana: 1.9 },
    schoolAffinity: 'life',
    buildings: [
      ...ECON_BASIC,
      ...PROD_BASIC,
      ...MIL_BASIC,
      ...MAGIC_FULL,
      'shrine-of-life',
      ...LIGHT_FULL,
    ],
    studies: [
      'haloborn-inner-light-1',
      'haloborn-halo-binding-1',
      'haloborn-radiant-focus-1',
      'haloborn-ascendant-rites-1',
    ],
    cityNames: [
      "Halospire",
      "Lumenhollow",
      "Radiance Vale",
      "Glowspire",
      "Aureole Reach",
      "Beaconhollow",
      "Incandeep",
      "Haloglen",
      "Brilliance Court",
      "Emberhalo",
      "Halcyon Ring",
      "Glorycrest",
    ],
    description:
      'Fragments of Lumina\'s own light given mortal form — the most mana-saturated ' +
      'race in the game, with research to match, but fragile, slow to multiply, and ' +
      'nearly useless on a battlefield or a building site.',
  },
};
