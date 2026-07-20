/**
 * Buildings — the shared construction pool.
 *
 * Content-as-data: no logic beyond the plain constant below. Races in
 * `src/data/races.ts` reference these ids in their `buildings` lists; which
 * subset a race can build is a major axis of racial identity (see
 * docs/DESIGN.md "Races — 30 total").
 *
 * Categories:
 *  - Economy: granary -> warehouse, marketplace -> grand-bazaar ->
 *    trade-consulate -> mercantile-exchange, library -> university ->
 *    grand-athenaeum.
 *  - Production: lumber-mill -> masons-guild -> foundry -> arcane-forge ->
 *    world-forge.
 *  - Military: barracks -> armory -> war-college (troops), palisade ->
 *    stone-walls -> fortress -> citadel -> grand-citadel (defense).
 *  - Magic (general): shrine -> arcane-sanctum -> mystic-conclave ->
 *    spellward-bastion -> archmages-tower.
 *  - School shrines: one per school of magic, each requiring `shrine`.
 *  - The human temple chain: temple -> grand-tabernacle ->
 *    temple-of-radiant-vows -> gilded-temple-spire -> celestial-temple.
 *    Escalating mana/research/unrest bonuses; the top two tiers are
 *    deliberately LDS-style — gleaming white/gold spires and celestial
 *    grandeur, not gothic cathedrals. Humans are the only race with the
 *    full chain; a few others cap partway up or lack it entirely.
 *  - Dark-world (Umbra) flavor: charnel-pit -> bone-reliquary ->
 *    ossuary-spire -> black-mausoleum.
 *  - Light-world (Lumina) flavor: radiant-atrium -> sunwell-basin ->
 *    aurora-conclave -> seraphic-bastion.
 */

import type { BuildingDef } from '@sim/types';

export const BUILDINGS: Record<string, BuildingDef> = {
  // ---------------------------------------------------------------------
  // Economy
  // ---------------------------------------------------------------------
  granary: {
    id: 'granary',
    name: 'Granary',
    tier: 1,
    cost: 40,
    upkeep: 1,
    effects: '+15% food storage; reduces starvation loss after bad harvests.',
    description:
      'Raised grain stores and root cellars that carry a town through a lean season.',
  },
  marketplace: {
    id: 'marketplace',
    name: 'Marketplace',
    tier: 1,
    cost: 45,
    upkeep: 1,
    effects: '+2 gold per population; unlocks caravan trade with neighbors.',
    description: 'Stalls, scales, and haggling — the beating heart of any town.',
  },
  library: {
    id: 'library',
    name: 'Library',
    tier: 1,
    cost: 50,
    upkeep: 1,
    effects: '+2 research per population.',
    description: 'Copied scrolls and bound tomes, kept by a patient archivist.',
  },
  warehouse: {
    id: 'warehouse',
    name: 'Warehouse',
    tier: 2,
    requires: 'granary',
    cost: 95,
    upkeep: 2,
    effects: '+30% food storage; eliminates spoilage losses.',
    description: 'Stone-walled stores that keep grain dry through the worst winters.',
  },
  university: {
    id: 'university',
    name: 'University',
    tier: 3,
    requires: 'library',
    cost: 180,
    upkeep: 3,
    effects: '+4 research per population; unlocks advanced study nodes.',
    description: 'Lecture halls and disputation courts drawing scholars from afar.',
  },
  'grand-bazaar': {
    id: 'grand-bazaar',
    name: 'Grand Bazaar',
    tier: 3,
    requires: 'marketplace',
    cost: 190,
    upkeep: 3,
    effects: '+4 gold per population; +1 trade route capacity.',
    description: 'A sprawling covered market that draws merchants from every road.',
  },
  'trade-consulate': {
    id: 'trade-consulate',
    name: 'Trade Consulate',
    tier: 4,
    requires: 'grand-bazaar',
    cost: 280,
    upkeep: 4,
    effects: '+6 gold per population; foreign trade agreements yield bonus gold.',
    description: 'A chartered house of foreign factors, brokers, and treaty-scribes.',
  },
  'grand-athenaeum': {
    id: 'grand-athenaeum',
    name: 'Grand Athenaeum',
    tier: 5,
    requires: 'university',
    cost: 480,
    upkeep: 7,
    effects: '+8 research per population; free study node unlock once per era.',
    description: 'A domed hall of infinite shelving, said to hold a copy of every book lost elsewhere.',
  },
  'mercantile-exchange': {
    id: 'mercantile-exchange',
    name: 'Mercantile Exchange',
    tier: 5,
    requires: 'trade-consulate',
    cost: 500,
    upkeep: 7,
    effects: '+10 gold per population; sets favorable prices at every owned marketplace.',
    description: 'A bourse of ticker-boards and shouting brokers that prices the whole realm.',
  },

  // ---------------------------------------------------------------------
  // Production
  // ---------------------------------------------------------------------
  'lumber-mill': {
    id: 'lumber-mill',
    name: 'Lumber Mill',
    tier: 1,
    cost: 40,
    upkeep: 1,
    effects: '+2 production per population.',
    description: 'Water-driven saws that turn felled timber into usable stock.',
  },
  'masons-guild': {
    id: 'masons-guild',
    name: "Masons' Guild",
    tier: 2,
    requires: 'lumber-mill',
    cost: 100,
    upkeep: 2,
    effects: '+3 production per population; -10% building cost.',
    description: 'A chartered hall of stonecutters and carpenters who train the next generation.',
  },
  foundry: {
    id: 'foundry',
    name: 'Foundry',
    tier: 3,
    requires: 'masons-guild',
    cost: 190,
    upkeep: 3,
    effects: '+5 production per population; unlocks metal-hulled units.',
    description: 'Roaring furnaces and quenching pits that cast iron by the ton.',
  },
  'arcane-forge': {
    id: 'arcane-forge',
    name: 'Arcane Forge',
    tier: 4,
    requires: 'foundry',
    cost: 300,
    upkeep: 5,
    effects: '+7 production per population; +3 mana per population.',
    description: 'A foundry bound with warding runes, quenching blades in enchanted brine.',
  },
  'world-forge': {
    id: 'world-forge',
    name: 'World Forge',
    tier: 5,
    requires: 'arcane-forge',
    cost: 520,
    upkeep: 8,
    effects: '+12 production per population; -20% unit production cost realm-wide.',
    description: 'A forge-complex vast enough to arm an age, its hammers never silent.',
  },

  // ---------------------------------------------------------------------
  // Military — troop chain
  // ---------------------------------------------------------------------
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    tier: 1,
    cost: 45,
    upkeep: 1,
    effects: 'Unlocks basic infantry training; +10% recruit experience.',
    description: 'Bunks, drill yards, and a weapon rack — the start of every soldier\'s career.',
  },
  armory: {
    id: 'armory',
    name: 'Armory',
    tier: 2,
    requires: 'barracks',
    cost: 100,
    upkeep: 2,
    effects: '+1 attack and defense to garrisoned units; unlocks armored infantry.',
    description: 'Racked steel and leather, fitted and maintained by a standing quartermaster.',
  },
  'war-college': {
    id: 'war-college',
    name: 'War College',
    tier: 3,
    requires: 'armory',
    cost: 200,
    upkeep: 3,
    effects: '+20% recruit experience; unlocks veteran promotion path.',
    description: 'Tacticians and drillmasters who turn levies into a proper army.',
  },

  // ---------------------------------------------------------------------
  // Military — defense chain
  // ---------------------------------------------------------------------
  palisade: {
    id: 'palisade',
    name: 'Palisade',
    tier: 1,
    cost: 40,
    upkeep: 1,
    effects: '+15% defense to garrison; blocks raiding parties without siege support.',
    description: 'A ring of sharpened logs, quick to raise and better than nothing at all.',
  },
  'stone-walls': {
    id: 'stone-walls',
    name: 'Stone Walls',
    tier: 2,
    requires: 'palisade',
    cost: 110,
    upkeep: 2,
    effects: '+35% defense to garrison; requires siege units to assault.',
    description: 'Quarried block and mortar replacing the old timber ring.',
  },
  fortress: {
    id: 'fortress',
    name: 'Fortress',
    tier: 3,
    requires: 'stone-walls',
    cost: 210,
    upkeep: 4,
    effects: '+60% defense to garrison; garrisoned units heal each turn.',
    description: 'A proper keep with murder-holes, a deep well, and a standing garrison.',
  },
  citadel: {
    id: 'citadel',
    name: 'Citadel',
    tier: 4,
    requires: 'fortress',
    cost: 320,
    upkeep: 5,
    effects: '+90% defense to garrison; +1 unit upkeep-free garrison slot.',
    description: 'A fortress within the fortress, meant to hold after the outer walls fall.',
  },
  'grand-citadel': {
    id: 'grand-citadel',
    name: 'Grand Citadel',
    tier: 5,
    requires: 'citadel',
    cost: 540,
    upkeep: 8,
    effects: '+140% defense to garrison; automatically repels raids below a strength threshold.',
    description: 'A mountain of dressed stone that has never once been taken by storm.',
  },

  // ---------------------------------------------------------------------
  // Magic — general
  // ---------------------------------------------------------------------
  shrine: {
    id: 'shrine',
    name: 'Shrine',
    tier: 1,
    cost: 50,
    upkeep: 1,
    effects: '+2 mana per population.',
    description: 'A small consecrated space where the veil between worlds runs thin.',
  },
  'arcane-sanctum': {
    id: 'arcane-sanctum',
    name: 'Arcane Sanctum',
    tier: 2,
    requires: 'shrine',
    cost: 110,
    upkeep: 2,
    effects: '+3 mana per population; +2 research per population.',
    description: 'A cloistered study-hall where local hedge-magic is formalized into doctrine.',
  },
  'mystic-conclave': {
    id: 'mystic-conclave',
    name: 'Mystic Conclave',
    tier: 3,
    requires: 'arcane-sanctum',
    cost: 200,
    upkeep: 3,
    effects: '+5 mana per population; unlocks casting of tier-3 spells locally.',
    description: 'A standing council of spellcasters who meet to trade discoveries and disputes.',
  },
  'spellward-bastion': {
    id: 'spellward-bastion',
    name: 'Spellward Bastion',
    tier: 4,
    requires: 'mystic-conclave',
    cost: 310,
    upkeep: 5,
    effects: '+7 mana per population; wards the settlement against hostile spells.',
    description: 'Warded towers ringing the settlement, humming faintly at all hours.',
  },
  'archmages-tower': {
    id: 'archmages-tower',
    name: "Archmage's Tower",
    tier: 5,
    requires: 'spellward-bastion',
    cost: 550,
    upkeep: 8,
    effects: '+12 mana per population; +6 research per population.',
    description: 'A single vast spire visible from every corner of the province, home to the realm\'s finest.',
  },

  // ---------------------------------------------------------------------
  // Magic — school shrines
  // ---------------------------------------------------------------------
  'shrine-of-life': {
    id: 'shrine-of-life',
    name: 'Shrine of Life',
    tier: 2,
    requires: 'shrine',
    cost: 120,
    upkeep: 2,
    effects: '+4 mana per population when the ruling wizard studies Life; reduces unrest.',
    description: 'White-draped stonework hung with lilies that never seem to wilt.',
  },
  'shrine-of-death': {
    id: 'shrine-of-death',
    name: 'Shrine of Death',
    tier: 2,
    requires: 'shrine',
    cost: 120,
    upkeep: 2,
    effects: '+4 mana per population when the ruling wizard studies Death; enables conversion rites.',
    description: 'A sunken vault of black candles where the dead are asked, politely, for favors.',
  },
  'shrine-of-chaos': {
    id: 'shrine-of-chaos',
    name: 'Shrine of Chaos',
    tier: 2,
    requires: 'shrine',
    cost: 120,
    upkeep: 2,
    effects: '+4 mana per population when the ruling wizard studies Chaos; +1 production.',
    description: 'A cracked-open fire-pit shrine that never quite burns the same way twice.',
  },
  'shrine-of-nature': {
    id: 'shrine-of-nature',
    name: 'Shrine of Nature',
    tier: 2,
    requires: 'shrine',
    cost: 120,
    upkeep: 2,
    effects: '+4 mana per population when the ruling wizard studies Nature; +1 food.',
    description: 'A living ring of standing trees grown, not built, around an old stone.',
  },
  'shrine-of-sorcery': {
    id: 'shrine-of-sorcery',
    name: 'Shrine of Sorcery',
    tier: 2,
    requires: 'shrine',
    cost: 120,
    upkeep: 2,
    effects: '+4 mana per population when the ruling wizard studies Sorcery; +1 research.',
    description: 'A mirrored hall that shows visitors reflections that are not quite their own.',
  },

  // ---------------------------------------------------------------------
  // The human temple chain
  // ---------------------------------------------------------------------
  temple: {
    id: 'temple',
    name: 'Temple',
    tier: 1,
    cost: 55,
    upkeep: 1,
    effects: '+2 mana, +1 research per population; -10% unrest.',
    description: 'A modest chapel of whitewashed timber where the faithful gather at dawn.',
  },
  'grand-tabernacle': {
    id: 'grand-tabernacle',
    name: 'Grand Tabernacle',
    tier: 2,
    requires: 'temple',
    cost: 130,
    upkeep: 2,
    effects: '+4 mana, +2 research per population; -20% unrest.',
    description: 'A domed meeting-house of pale stone, its choir audible from the street.',
  },
  'temple-of-radiant-vows': {
    id: 'temple-of-radiant-vows',
    name: 'Temple of Radiant Vows',
    tier: 3,
    requires: 'grand-tabernacle',
    cost: 230,
    upkeep: 3,
    effects: '+6 mana, +3 research per population; -30% unrest; +1 happiness per population.',
    description:
      'Polished white walls trimmed in gold leaf, its windows cut to scatter dawn light across the square.',
  },
  'gilded-temple-spire': {
    id: 'gilded-temple-spire',
    name: 'Gilded Temple Spire',
    tier: 4,
    requires: 'temple-of-radiant-vows',
    cost: 360,
    upkeep: 5,
    effects: '+9 mana, +5 research per population; -40% unrest; +2 happiness per population.',
    description:
      'A soaring white spire sheathed in gold, visible for miles, drawing pilgrims from every province.',
  },
  'celestial-temple': {
    id: 'celestial-temple',
    name: 'Celestial Temple',
    tier: 5,
    requires: 'gilded-temple-spire',
    cost: 600,
    upkeep: 8,
    effects: '+15 mana, +8 research per population; -60% unrest; +3 happiness per population; realm-wide morale bonus.',
    description:
      'The faith made monumental: gleaming white stone and gold spires crowned by a golden herald-figure ' +
      'atop the highest pinnacle, arms raised over the land it watches. Pilgrims travel a lifetime to see it once.',
  },

  // ---------------------------------------------------------------------
  // Dark-world (Umbra) flavor
  // ---------------------------------------------------------------------
  'charnel-pit': {
    id: 'charnel-pit',
    name: 'Charnel Pit',
    tier: 1,
    cost: 40,
    upkeep: 1,
    effects: '+2 mana per population; converts battle casualties into a small food/mana return.',
    description: 'An open pit where the dead of Umbra are rendered down to something still useful.',
  },
  'bone-reliquary': {
    id: 'bone-reliquary',
    name: 'Bone Reliquary',
    tier: 2,
    requires: 'charnel-pit',
    cost: 110,
    upkeep: 2,
    effects: '+4 mana per population; stores fallen troops for later reanimation.',
    description: 'Stacked femurs and skulls mortared into load-bearing walls, catalogued by a bone-scribe.',
  },
  'ossuary-spire': {
    id: 'ossuary-spire',
    name: 'Ossuary Spire',
    tier: 3,
    requires: 'bone-reliquary',
    cost: 210,
    upkeep: 3,
    effects: '+6 mana per population; +2 research per population; unlocks minor undead conversion.',
    description: 'A tower built entirely of interlocked bone, humming with old grief.',
  },
  'black-mausoleum': {
    id: 'black-mausoleum',
    name: 'Black Mausoleum',
    tier: 4,
    requires: 'ossuary-spire',
    cost: 340,
    upkeep: 5,
    effects: '+10 mana per population; unlocks mass conversion of population into undead levies.',
    description: 'A vast sunken hall of black basalt where Umbra\'s great and terrible dead lie in state.',
  },

  // ---------------------------------------------------------------------
  // Light-world (Lumina) flavor
  // ---------------------------------------------------------------------
  'radiant-atrium': {
    id: 'radiant-atrium',
    name: 'Radiant Atrium',
    tier: 1,
    cost: 45,
    upkeep: 1,
    effects: '+2 mana per population; +1 happiness per population.',
    description: 'An open-roofed hall of pale stone that seems to hold daylight after dusk falls.',
  },
  'sunwell-basin': {
    id: 'sunwell-basin',
    name: 'Sunwell Basin',
    tier: 2,
    requires: 'radiant-atrium',
    cost: 115,
    upkeep: 2,
    effects: '+4 mana per population; slowly heals garrisoned units each turn.',
    description: "A basin of ever-full water lit from within, said to be a captured fragment of Lumina's sky.",
  },
  'aurora-conclave': {
    id: 'aurora-conclave',
    name: 'Aurora Conclave',
    tier: 3,
    requires: 'sunwell-basin',
    cost: 220,
    upkeep: 3,
    effects: '+6 mana per population; +3 research per population.',
    description: 'A ring of light-woven pillars where Lumina\'s natives commune with the plane itself.',
  },
  'seraphic-bastion': {
    id: 'seraphic-bastion',
    name: 'Seraphic Bastion',
    tier: 4,
    requires: 'aurora-conclave',
    cost: 350,
    upkeep: 5,
    effects: '+10 mana per population; grants flying garrison units a defense bonus.',
    description: 'A fortress of living light, its ramparts patrolled by things with too many wings.',
  },
};
