/**
 * Studies — the magical "tech tree" of each race.
 *
 * Content-as-data: no logic beyond the plain constant below. Research is
 * limited to magical studies only (see docs/DESIGN.md "Races — 30 total"):
 * each race in `src/data/races.ts` has a unique chain of study ids listed in
 * its `studies` array, and every one of those ids must be defined here.
 *
 * Each race's chain is a self-contained tree: the first study has no
 * `requires`, and every later study requires an earlier study from that same
 * race's list. Costs escalate with depth (roughly 40 -> 90 -> 180 -> 350 ->
 * 700 research points), and effects are flavored to the race's identity as
 * described in its `RaceDef.description`.
 *
 * Building unlocks are used sparingly, gating a handful of capstone
 * buildings behind a race's deepest studies — most notably humans' temple
 * chain, where `humans-covenant-rites-1` unlocks 'gilded-temple-spire' and
 * the final study `humans-pilgrimage-1` unlocks 'celestial-temple' (see
 * docs/DESIGN.md, the temple chain is humans' signature playstyle).
 *
 * Below the race studies is the **magic shelf**: a second, race-independent
 * 6-study chain per school of magic (docs/DESIGN.md "Research has two
 * shelves"), marked by `StudyDef.school` instead of being listed in any
 * race's `studies` array. Any wizard who knows a school may research that
 * school's tree. See the "Magic shelf" section below for its own rules.
 */

import type { StudyDef } from '@sim/types';

export const STUDIES: Record<string, StudyDef> = {
  // =========================================================================
  // Meridia — 18 races
  // =========================================================================

  // ---------------------------------------------------------------------
  // Orcs — generic baseline: straightforward warcraft and siege doctrine.
  // ---------------------------------------------------------------------
  'orcs-warcraft-1': {
    id: 'orcs-warcraft-1',
    name: 'Warcraft Fundamentals',
    cost: 40,
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.05 } },
      unlocksUnits: ['orc-warrior'],
    },
    description:
      'Drilled ranks and standardized weapon-drills, taught in every orcish warband ' +
      'from the youngest recruit up.',
  },
  'orcs-warcraft-2': {
    id: 'orcs-warcraft-2',
    name: 'Advanced Warcraft',
    cost: 88,
    requires: ['orcs-warcraft-1'],
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.08 } },
    },
    description:
      'Coordinated formations and shouted battle-signals let orc levies fight as a ' +
      'single body instead of a mob.',
  },
  'orcs-siegecraft-1': {
    id: 'orcs-siegecraft-1',
    name: 'Siegecraft',
    cost: 175,
    requires: ['orcs-warcraft-2'],
    effects: {
      cityEffects: { yields: { production: 2 }, defenseBonus: 3 },
    },
    description:
      'Ram-heads, sapping picks, and crude engines — orcish know-how for breaking ' +
      'walls that stand in the way.',
  },
  'orcs-hardened-stock-1': {
    id: 'orcs-hardened-stock-1',
    name: 'Hardened Stock',
    cost: 340,
    requires: ['orcs-siegecraft-1'],
    effects: {
      cityEffects: { growthBonus: 0.05, unrestReduction: 1 },
    },
    description:
      'Generations of hard living bred into doctrine: orc broods grow fast and stay ' +
      'orderly under any warlord worth following.',
  },

  // ---------------------------------------------------------------------
  // Humans — the temple/faith chain, culminating in the celestial spires.
  // ---------------------------------------------------------------------
  'humans-faith-1': {
    id: 'humans-faith-1',
    name: 'Common Faith',
    cost: 42,
    effects: {
      cityEffects: { yields: { mana: 1 }, unrestReduction: 1 },
      unlocksUnits: ['human-spearman'],
    },
    description:
      'Everyday devotion said at dawn in every temple courtyard, binding a town ' +
      'together as much as any law.',
  },
  'humans-faith-2': {
    id: 'humans-faith-2',
    name: 'Deepening Faith',
    cost: 92,
    requires: ['humans-faith-1'],
    effects: {
      cityEffects: { unrestReduction: 2, yieldMultipliers: { mana: 1.1 } },
    },
    description:
      'Formal liturgy and trained clergy replace folk prayer, drawing the divine ' +
      'closer to daily life.',
  },
  'humans-life-attunement-1': {
    id: 'humans-life-attunement-1',
    name: 'Life Attunement',
    cost: 185,
    requires: ['humans-faith-2'],
    effects: {
      cityEffects: { yields: { mana: 3, research: 1 } },
    },
    description:
      'Rites that open a channel to Life magic itself, felt first as warmth in the ' +
      'temple stones and later in every blessing cast.',
  },
  'humans-covenant-rites-1': {
    id: 'humans-covenant-rites-1',
    name: 'Covenant Rites',
    cost: 365,
    requires: ['humans-life-attunement-1'],
    effects: {
      cityEffects: { unrestReduction: 3, yieldMultipliers: { research: 1.15 } },
      unlocksBuildings: ['gilded-temple-spire'],
    },
    description:
      'A binding oath between crown, clergy, and Light — the doctrine that lets a ' +
      'town raise a gold-sheathed spire instead of another chapel.',
  },
  'humans-pilgrimage-1': {
    id: 'humans-pilgrimage-1',
    name: 'Great Pilgrimage',
    cost: 720,
    requires: ['humans-covenant-rites-1'],
    effects: {
      cityEffects: { yields: { mana: 5, research: 3 }, unrestReduction: 4 },
      unlocksBuildings: ['celestial-temple'],
    },
    description:
      'The faith made a journey: pilgrims cross the realm to see the promised ' +
      'monument raised, and the monument itself becomes a beacon for more.',
  },

  // ---------------------------------------------------------------------
  // Dwarves — runic lore feeding mining and siegecraft.
  // ---------------------------------------------------------------------
  'dwarves-runic-lore-1': {
    id: 'dwarves-runic-lore-1',
    name: 'Runic Lore',
    cost: 38,
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.08 } },
    },
    description:
      'Runes chiseled into lintel and tool alike, said to remember the strength of ' +
      'the hand that first carved them.',
  },
  'dwarves-deep-mining-1': {
    id: 'dwarves-deep-mining-1',
    name: 'Deep Mining',
    cost: 85,
    requires: ['dwarves-runic-lore-1'],
    effects: {
      cityEffects: { yields: { production: 3, gold: 1 } },
    },
    description:
      'Shafts driven deeper than any surface-dweller would dare, following veins by ' +
      'runic dowsing rather than luck.',
  },
  'dwarves-siegecraft-1': {
    id: 'dwarves-siegecraft-1',
    name: 'Dwarven Siegecraft',
    cost: 172,
    requires: ['dwarves-deep-mining-1'],
    effects: {
      cityEffects: { defenseBonus: 5, yields: { production: 2 } },
    },
    description:
      'Runic-tempered engines and countermining tunnels — dwarven fortresses do not ' +
      'fall so much as outlast the siege.',
  },

  // ---------------------------------------------------------------------
  // High Elves — arcane scholarship into star charts and enchantment.
  // ---------------------------------------------------------------------
  'high-elves-arcane-lore-1': {
    id: 'high-elves-arcane-lore-1',
    name: 'Arcane Lore I',
    cost: 44,
    effects: {
      cityEffects: { yieldMultipliers: { research: 1.1 } },
    },
    description:
      'The foundational canon of Sorcery, copied and re-copied in the archives of ' +
      'every high elf city.',
  },
  'high-elves-arcane-lore-2': {
    id: 'high-elves-arcane-lore-2',
    name: 'Arcane Lore II',
    cost: 95,
    requires: ['high-elves-arcane-lore-1'],
    effects: {
      cityEffects: { yieldMultipliers: { research: 1.12, mana: 1.08 } },
    },
    description:
      'Advanced disputation on the nature of illusion and counter-magic, taught only ' +
      'to those who mastered the first canon.',
  },
  'high-elves-star-charting-1': {
    id: 'high-elves-star-charting-1',
    name: 'Star Charting',
    cost: 195,
    requires: ['high-elves-arcane-lore-2'],
    effects: {
      cityEffects: { yields: { research: 3, mana: 2 } },
    },
    description:
      'Centuries of patient observation from tower-top observatories, mapping the ' +
      'sky\'s slow drift onto Sorcery\'s deeper patterns.',
  },
  'high-elves-enchantment-1': {
    id: 'high-elves-enchantment-1',
    name: 'High Enchantment',
    cost: 375,
    requires: ['high-elves-star-charting-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.15 } },
      unlocksBuildings: ['archmages-tower'],
    },
    description:
      'The mastery that lets a high elf archmage bind wards and workings into stone ' +
      'itself, raising a tower worthy of the title.',
  },

  // ---------------------------------------------------------------------
  // Wood Elves — woodcraft, beast-bonds, and pathfinding.
  // ---------------------------------------------------------------------
  'wood-elves-woodcraft-1': {
    id: 'wood-elves-woodcraft-1',
    name: 'Woodcraft',
    cost: 41,
    effects: {
      cityEffects: { yields: { food: 2 } },
    },
    description:
      'Coppicing, grafting, and quiet husbandry that feeds a wood elf settlement ' +
      'without ever felling the canopy.',
  },
  'wood-elves-beastfriend-1': {
    id: 'wood-elves-beastfriend-1',
    name: 'Beastfriend Rites',
    cost: 88,
    requires: ['wood-elves-woodcraft-1'],
    effects: {
      cityEffects: { yieldMultipliers: { food: 1.1, mana: 1.05 } },
    },
    description:
      'A wordless pact with the forest\'s beasts, who guide hunters to game and share ' +
      'in the woods\' quiet magic.',
  },
  'wood-elves-pathfinding-1': {
    id: 'wood-elves-pathfinding-1',
    name: 'Pathfinding',
    cost: 178,
    requires: ['wood-elves-beastfriend-1'],
    effects: {
      cityEffects: { growthBonus: 0.05, yields: { mana: 2 } },
    },
    description:
      'Hidden trails known only to the initiated, letting wood elf settlements grow ' +
      'without ever clearing a road.',
  },

  // ---------------------------------------------------------------------
  // Dusk Elves — shadow-cant, raiding, and poisoncraft.
  // ---------------------------------------------------------------------
  'dusk-elves-shadow-cant-1': {
    id: 'dusk-elves-shadow-cant-1',
    name: 'Shadow Cant',
    cost: 43,
    effects: {
      cityEffects: { yields: { gold: 2 } },
    },
    description:
      'A coded market-tongue spoken in the deep woods, moving contraband where the ' +
      'sunlit courts never think to look.',
  },
  'dusk-elves-raiding-1': {
    id: 'dusk-elves-raiding-1',
    name: 'Raiding Doctrine',
    cost: 91,
    requires: ['dusk-elves-shadow-cant-1'],
    effects: {
      cityEffects: { yieldMultipliers: { gold: 1.1 }, defenseBonus: 2 },
    },
    description:
      'Hit-and-fade tactics touched by Chaos, striking rich targets and vanishing ' +
      'before a reprisal can form.',
  },
  'dusk-elves-poisoncraft-1': {
    id: 'dusk-elves-poisoncraft-1',
    name: 'Poisoncraft',
    cost: 183,
    requires: ['dusk-elves-raiding-1'],
    effects: {
      cityEffects: { yields: { research: 2, gold: 2 } },
    },
    description:
      'Venom-brewing refined into a science, sold quietly to anyone with coin and no ' +
      'questions.',
  },

  // ---------------------------------------------------------------------
  // Halflings — hearth-lore, foraging, and homespun luck.
  // ---------------------------------------------------------------------
  'halflings-hearth-lore-1': {
    id: 'halflings-hearth-lore-1',
    name: 'Hearth Lore',
    cost: 39,
    effects: {
      cityEffects: { yields: { food: 2 }, unrestReduction: 1 },
    },
    description:
      'Recipes and hospitality passed down every hearth-line, keeping a hamlet fed ' +
      'and content through any season.',
  },
  'halflings-foraging-1': {
    id: 'halflings-foraging-1',
    name: 'Foraging Wisdom',
    cost: 87,
    requires: ['halflings-hearth-lore-1'],
    effects: {
      cityEffects: { yieldMultipliers: { food: 1.12 } },
    },
    description:
      'A halfling knows every root, berry, and mushroom worth eating within a day\'s ' +
      'walk of home.',
  },
  'halflings-luck-charms-1': {
    id: 'halflings-luck-charms-1',
    name: 'Luck Charms',
    cost: 176,
    requires: ['halflings-foraging-1'],
    effects: {
      cityEffects: { growthBonus: 0.08, yields: { gold: 2 } },
    },
    description:
      'Horseshoes, four-leaf clovers, and small homespun charms that halflings swear ' +
      'by, whether or not the magic is real.',
  },

  // ---------------------------------------------------------------------
  // Lizardfolk — swamp lore, venomcraft, and rapid hatchery rites.
  // ---------------------------------------------------------------------
  'lizardfolk-swamp-lore-1': {
    id: 'lizardfolk-swamp-lore-1',
    name: 'Swamp Lore',
    cost: 40,
    effects: {
      cityEffects: { yields: { food: 2 } },
    },
    description:
      'Knowledge of which reeds feed and which bite, gathered across generations of ' +
      'wading the same fen.',
  },
  'lizardfolk-venomcraft-1': {
    id: 'lizardfolk-venomcraft-1',
    name: 'Venomcraft',
    cost: 86,
    requires: ['lizardfolk-swamp-lore-1'],
    effects: {
      cityEffects: { defenseBonus: 2, yields: { production: 1 } },
    },
    description:
      'Milked and refined venoms that coat spear and dart, turning a swamp ambush ' +
      'into a near-certain kill.',
  },
  'lizardfolk-hatchery-rites-1': {
    id: 'lizardfolk-hatchery-rites-1',
    name: 'Hatchery Rites',
    cost: 174,
    requires: ['lizardfolk-venomcraft-1'],
    effects: {
      cityEffects: { growthBonus: 0.1, housing: 2 },
    },
    description:
      'Warmed clutch-pits and ritual timing that let a lizardfolk brood hatch faster ' +
      'and stronger than nature alone would allow.',
  },

  // ---------------------------------------------------------------------
  // Gnolls — pack tactics, scavenging, and frenzy.
  // ---------------------------------------------------------------------
  'gnolls-pack-tactics-1': {
    id: 'gnolls-pack-tactics-1',
    name: 'Pack Tactics',
    cost: 42,
    effects: {
      cityEffects: { defenseBonus: 2 },
    },
    description:
      'Coordinated flanking and howled signals that let a gnoll pack fight as one ' +
      'many-fanged animal.',
  },
  'gnolls-scavenging-1': {
    id: 'gnolls-scavenging-1',
    name: 'Scavenging',
    cost: 89,
    requires: ['gnolls-pack-tactics-1'],
    effects: {
      cityEffects: { yields: { food: 2, gold: 1 } },
    },
    description:
      'Nothing goes to waste in a gnoll camp — battlefield leavings and a raided ' +
      'larder both feed the pack.',
  },
  'gnolls-frenzy-rites-1': {
    id: 'gnolls-frenzy-rites-1',
    name: 'Frenzy Rites',
    cost: 181,
    requires: ['gnolls-scavenging-1'],
    effects: {
      cityEffects: { growthBonus: 0.12, defenseBonus: 2 },
    },
    description:
      'A howling ritual that whips a whole camp into breeding, biting frenzy at ' +
      'once — numbers are the pack\'s only real doctrine.',
  },

  // ---------------------------------------------------------------------
  // Beastkin — totem lore, pack hunting, and shapeward rites.
  // ---------------------------------------------------------------------
  'beastkin-totem-lore-1': {
    id: 'beastkin-totem-lore-1',
    name: 'Totem Lore',
    cost: 40,
    effects: {
      cityEffects: { yields: { mana: 1 }, unrestReduction: 1 },
    },
    description:
      'Carved totems that hold a hybrid tribe\'s animal spirits close, settling ' +
      'disputes as often as they ward off harm.',
  },
  'beastkin-pack-hunting-1': {
    id: 'beastkin-pack-hunting-1',
    name: 'Pack Hunting',
    cost: 87,
    requires: ['beastkin-totem-lore-1'],
    effects: {
      cityEffects: { yields: { food: 2, production: 1 } },
    },
    description:
      'Hunts run the way the pack-spirits taught: patient, coordinated, and rarely ' +
      'coming home empty-handed.',
  },
  'beastkin-shapeward-1': {
    id: 'beastkin-shapeward-1',
    name: 'Shapeward Rites',
    cost: 177,
    requires: ['beastkin-pack-hunting-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.1 }, defenseBonus: 2 },
    },
    description:
      'A totemic rite that lets a beastkin call on their animal aspect more fully in ' +
      'defense of the tribe\'s grounds.',
  },

  // ---------------------------------------------------------------------
  // Draconians — dragon blood, flamecraft, and wing drill.
  // ---------------------------------------------------------------------
  'draconians-dragon-blood-1': {
    id: 'draconians-dragon-blood-1',
    name: 'Dragon Blood',
    cost: 43,
    effects: {
      cityEffects: { yields: { mana: 2 } },
    },
    description:
      'Old draconic ancestry stirred to the surface through ritual and meditation, ' +
      'thickening the Chaos in a draconian\'s veins.',
  },
  'draconians-flamecraft-1': {
    id: 'draconians-flamecraft-1',
    name: 'Flamecraft',
    cost: 92,
    requires: ['draconians-dragon-blood-1'],
    effects: {
      cityEffects: { yields: { production: 3 }, defenseBonus: 2 },
    },
    description:
      'Forge-fire and breath-fire both bent to draconian purposes, smelting metal ' +
      'and tempering resolve alike.',
  },
  'draconians-wing-drill-1': {
    id: 'draconians-wing-drill-1',
    name: 'Wing Drill',
    cost: 186,
    requires: ['draconians-flamecraft-1'],
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.1, mana: 1.1 } },
    },
    description:
      'Formation flight drilled over open sky, turning scattered draconian raiders ' +
      'into a disciplined aerial host.',
  },

  // ---------------------------------------------------------------------
  // Nomads — horse lore, trade routes, and scouting.
  // ---------------------------------------------------------------------
  'nomads-horse-lore-1': {
    id: 'nomads-horse-lore-1',
    name: 'Horse Lore',
    cost: 39,
    effects: {
      cityEffects: { yields: { gold: 1 } },
      unlocksUnits: ['settler'],
    },
    description:
      'Generations spent in the saddle, reading a horse\'s mood as easily as a ' +
      'neighbor\'s — and knowing exactly how far a herd can travel before dusk.',
  },
  'nomads-trade-routes-1': {
    id: 'nomads-trade-routes-1',
    name: 'Trade Routes',
    cost: 86,
    requires: ['nomads-horse-lore-1'],
    effects: {
      cityEffects: { yieldMultipliers: { gold: 1.15 } },
    },
    description:
      'Mapped caravan roads linking distant camps, carrying goods and news faster ' +
      'than any settled kingdom\'s post.',
  },
  'nomads-scouting-1': {
    id: 'nomads-scouting-1',
    name: 'Scouting Doctrine',
    cost: 173,
    requires: ['nomads-trade-routes-1'],
    effects: {
      cityEffects: { yields: { gold: 3, research: 1 } },
    },
    description:
      'Fast riders ranging far ahead of the main camp, mapping opportunity and ' +
      'danger long before either arrives.',
  },

  // ---------------------------------------------------------------------
  // Barbarians — war cry, ironworking, and raiding.
  // ---------------------------------------------------------------------
  'barbarians-warcry-1': {
    id: 'barbarians-warcry-1',
    name: 'War Cry',
    cost: 41,
    effects: {
      cityEffects: { defenseBonus: 2 },
      unlocksUnits: ['militia'],
    },
    description:
      'A roared clan-cry that steadies a barbarian shield-line and puts fear into ' +
      'anyone unlucky enough to face it.',
  },
  'barbarians-ironworking-1': {
    id: 'barbarians-ironworking-1',
    name: 'Ironworking',
    cost: 88,
    requires: ['barbarians-warcry-1'],
    effects: {
      cityEffects: { yields: { production: 3 } },
    },
    description:
      'Bog-iron smelted over clan bonfires into axeheads and rough plate, good ' +
      'enough for war if not for court.',
  },
  'barbarians-raiding-1': {
    id: 'barbarians-raiding-1',
    name: 'Raiding Doctrine',
    cost: 179,
    requires: ['barbarians-ironworking-1'],
    effects: {
      cityEffects: { yields: { gold: 2 }, defenseBonus: 3 },
    },
    description:
      'Fast, brutal raids timed to the harvest of softer neighbors, bringing home ' +
      'plunder a clan could never grow itself.',
  },

  // ---------------------------------------------------------------------
  // Chitinfolk — hive mind, chitin forging, and swarm labor.
  // ---------------------------------------------------------------------
  'chitinfolk-hive-mind-1': {
    id: 'chitinfolk-hive-mind-1',
    name: 'Hive Mind',
    cost: 42,
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.08 } },
    },
    description:
      'A shared, wordless coordination that lets a chitinfolk work-swarm labor as a ' +
      'single tireless organism.',
  },
  'chitinfolk-chitin-forging-1': {
    id: 'chitinfolk-chitin-forging-1',
    name: 'Chitin Forging',
    cost: 90,
    requires: ['chitinfolk-hive-mind-1'],
    effects: {
      cityEffects: { yields: { production: 4 }, defenseBonus: 2 },
    },
    description:
      'Shed carapace layered and bonded into tools and armor, harder than it has any ' +
      'right to be.',
  },
  'chitinfolk-swarm-labor-1': {
    id: 'chitinfolk-swarm-labor-1',
    name: 'Swarm Labor',
    cost: 182,
    requires: ['chitinfolk-chitin-forging-1'],
    effects: {
      cityEffects: { growthBonus: 0.06, yieldMultipliers: { production: 1.1 } },
    },
    description:
      'Every hand — or claw — turned to the hive\'s single purpose, multiplying both ' +
      'the workforce and the work it can move.',
  },

  // ---------------------------------------------------------------------
  // Gnomes — tinkering, illusion craft, clockwork, and arcane engineering.
  // ---------------------------------------------------------------------
  'gnomes-tinkering-1': {
    id: 'gnomes-tinkering-1',
    name: 'Tinkering',
    cost: 40,
    effects: {
      cityEffects: { yields: { research: 2 } },
    },
    description:
      'A gnome workshop is never quiet: gears, springs, and half-finished contraptions ' +
      'cover every surface.',
  },
  'gnomes-illusion-craft-1': {
    id: 'gnomes-illusion-craft-1',
    name: 'Illusion Craft',
    cost: 90,
    requires: ['gnomes-tinkering-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.1 }, defenseBonus: 1 },
    },
    description:
      'Sorcerous trickery layered over mechanical trickery, so a gnome workshop\'s ' +
      'defenses are rarely what they appear to be.',
  },
  'gnomes-clockwork-1': {
    id: 'gnomes-clockwork-1',
    name: 'Clockwork Industry',
    cost: 182,
    requires: ['gnomes-illusion-craft-1'],
    effects: {
      cityEffects: { yields: { production: 4, research: 2 } },
    },
    description:
      'Self-winding presses and gear-driven assembly lines that turn a gnome ' +
      'settlement into a small, whirring factory.',
  },
  'gnomes-arcane-engineering-1': {
    id: 'gnomes-arcane-engineering-1',
    name: 'Arcane Engineering',
    cost: 355,
    requires: ['gnomes-clockwork-1'],
    effects: {
      cityEffects: { yieldMultipliers: { research: 1.15 } },
      unlocksBuildings: ['archmages-tower'],
    },
    description:
      'The marriage of Sorcery and machine, precise enough that a gnome-built tower ' +
      'can rival an elder mage\'s spire.',
  },

  // ---------------------------------------------------------------------
  // Ogres — brute strength, crude siegecraft, and thick hide.
  // ---------------------------------------------------------------------
  'ogres-brute-strength-1': {
    id: 'ogres-brute-strength-1',
    name: 'Brute Strength',
    cost: 38,
    effects: {
      cityEffects: { yields: { production: 2 } },
    },
    description:
      'No secret to it: an ogre put to work moves more stone, faster, than three of ' +
      'anyone else.',
  },
  'ogres-crude-siegecraft-1': {
    id: 'ogres-crude-siegecraft-1',
    name: 'Crude Siegecraft',
    cost: 84,
    requires: ['ogres-brute-strength-1'],
    effects: {
      cityEffects: { yields: { production: 2 }, defenseBonus: 2 },
    },
    description:
      'Battering rams that are really just an ogre with a log — crude, but it works.',
  },
  'ogres-thick-hide-1': {
    id: 'ogres-thick-hide-1',
    name: 'Thick Hide',
    cost: 170,
    requires: ['ogres-crude-siegecraft-1'],
    effects: {
      cityEffects: { defenseBonus: 5 },
    },
    description:
      'An ogre\'s hide already turns a blade; this is simply learning to put it in ' +
      'front of the people who matter.',
  },

  // ---------------------------------------------------------------------
  // Centaurfolk — plains lore, cavalry drill, and herd wisdom.
  // ---------------------------------------------------------------------
  'centaurfolk-plains-lore-1': {
    id: 'centaurfolk-plains-lore-1',
    name: 'Plains Lore',
    cost: 41,
    effects: {
      cityEffects: { yields: { food: 1, gold: 1 } },
    },
    description:
      'Reading grass, wind, and herd-track across the open plains that centaurfolk ' +
      'call home.',
  },
  'centaurfolk-cavalry-drill-1': {
    id: 'centaurfolk-cavalry-drill-1',
    name: 'Cavalry Drill',
    cost: 89,
    requires: ['centaurfolk-plains-lore-1'],
    effects: {
      cityEffects: { defenseBonus: 3 },
    },
    description:
      'Wheeling charges and disciplined lance-lines, drilled at a gallop by folk who ' +
      'never dismount to practice.',
  },
  'centaurfolk-herd-wisdom-1': {
    id: 'centaurfolk-herd-wisdom-1',
    name: 'Herd Wisdom',
    cost: 180,
    requires: ['centaurfolk-cavalry-drill-1'],
    effects: {
      cityEffects: { growthBonus: 0.05, yields: { food: 2 } },
    },
    description:
      'The accumulated judgment of many herds and many seasons, passed down through ' +
      'elder centaurfolk to guide the young.',
  },

  // ---------------------------------------------------------------------
  // Tidefolk — current lore, coral craft, and tide calling.
  // ---------------------------------------------------------------------
  'tidefolk-current-lore-1': {
    id: 'tidefolk-current-lore-1',
    name: 'Current Lore',
    cost: 40,
    effects: {
      cityEffects: { yields: { food: 1, mana: 1 } },
    },
    description:
      'Reading tide and current like scripture, tidefolk know exactly where the sea ' +
      'will give and where it will take.',
  },
  'tidefolk-coral-craft-1': {
    id: 'tidefolk-coral-craft-1',
    name: 'Coral Craft',
    cost: 87,
    requires: ['tidefolk-current-lore-1'],
    effects: {
      cityEffects: { yields: { gold: 2, production: 1 } },
    },
    description:
      'Living coral shaped, grown, and traded as building stock, jewelry, and ' +
      'currency all at once.',
  },
  'tidefolk-tide-calling-1': {
    id: 'tidefolk-tide-calling-1',
    name: 'Tide Calling',
    cost: 176,
    requires: ['tidefolk-coral-craft-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.12 } },
    },
    description:
      'A Sorcery-tinged rite that lets a tidefolk elder call the sea\'s own current ' +
      'to a settlement\'s aid.',
  },

  // =========================================================================
  // Umbra — 6 races (death-flavored)
  // =========================================================================

  // ---------------------------------------------------------------------
  // Wraithkin — soul lore, incorporeal drift, and dread aura.
  // ---------------------------------------------------------------------
  'wraithkin-soul-lore-1': {
    id: 'wraithkin-soul-lore-1',
    name: 'Soul Lore',
    cost: 44,
    effects: {
      cityEffects: { yields: { mana: 3 } },
    },
    description:
      'A wraithkin\'s first true study of its own half-existence, and how much magic ' +
      'leaks through the gap.',
  },
  'wraithkin-incorporeal-drift-1': {
    id: 'wraithkin-incorporeal-drift-1',
    name: 'Incorporeal Drift',
    cost: 93,
    requires: ['wraithkin-soul-lore-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.15 } },
    },
    description:
      'Learning to loosen the mortal shape further still, drawing mana more freely ' +
      'the less solid a wraithkin becomes.',
  },
  'wraithkin-dread-aura-1': {
    id: 'wraithkin-dread-aura-1',
    name: 'Dread Aura',
    cost: 188,
    requires: ['wraithkin-incorporeal-drift-1'],
    effects: {
      cityEffects: { unrestReduction: 2, defenseBonus: 3 },
    },
    description:
      'A cold, wordless presence that settles over a wraithkin holding, unnerving ' +
      'attackers and dissenters alike.',
  },

  // ---------------------------------------------------------------------
  // Ghouls — feeding rites, carrion lore, and rotcraft.
  // ---------------------------------------------------------------------
  'ghouls-feeding-rites-1': {
    id: 'ghouls-feeding-rites-1',
    name: 'Feeding Rites',
    cost: 39,
    effects: {
      cityEffects: { yields: { food: 2 } },
    },
    description:
      'Solemn ritual around what other peoples call an unspeakable meal, keeping a ' +
      'ghoul warren fed without a single field sown.',
  },
  'ghouls-carrion-lore-1': {
    id: 'ghouls-carrion-lore-1',
    name: 'Carrion Lore',
    cost: 85,
    requires: ['ghouls-feeding-rites-1'],
    effects: {
      cityEffects: { yields: { mana: 2, food: 1 } },
    },
    description:
      'Knowing exactly what the dead still have to give, and how long a body keeps ' +
      'giving it.',
  },
  'ghouls-rotcraft-1': {
    id: 'ghouls-rotcraft-1',
    name: 'Rotcraft',
    cost: 171,
    requires: ['ghouls-carrion-lore-1'],
    effects: {
      cityEffects: { defenseBonus: 2, unrestReduction: 1 },
    },
    description:
      'Decay bent to purpose — wards of rot and stench that keep both scavengers and ' +
      'invaders at a wary distance.',
  },

  // ---------------------------------------------------------------------
  // Hollowfolk — hunger rites, bone whittling, and pale lore.
  // ---------------------------------------------------------------------
  'hollowfolk-hunger-rites-1': {
    id: 'hollowfolk-hunger-rites-1',
    name: 'Hunger Rites',
    cost: 41,
    effects: {
      cityEffects: { yields: { food: 1, mana: 1 } },
    },
    description:
      'A hollowfolk clan\'s grim discipline around its hunger, channeling deprivation ' +
      'into something closer to focus.',
  },
  'hollowfolk-bone-whittling-1': {
    id: 'hollowfolk-bone-whittling-1',
    name: 'Bone Whittling',
    cost: 88,
    requires: ['hollowfolk-hunger-rites-1'],
    effects: {
      cityEffects: { yields: { production: 2 } },
    },
    description:
      'Every bone finds a second use in hollowfolk hands — tool, needle, or fetish, ' +
      'nothing wasted.',
  },
  'hollowfolk-pale-lore-1': {
    id: 'hollowfolk-pale-lore-1',
    name: 'Pale Lore',
    cost: 178,
    requires: ['hollowfolk-bone-whittling-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.1, research: 1.05 } },
    },
    description:
      'Quiet study conducted deep in Umbra\'s hollows, undisturbed by sun or ' +
      'surface-dweller alike.',
  },

  // ---------------------------------------------------------------------
  // Shadow Goblins — ambush craft, tunnel lore, and nightsight.
  // ---------------------------------------------------------------------
  'shadow-goblins-ambush-craft-1': {
    id: 'shadow-goblins-ambush-craft-1',
    name: 'Ambush Craft',
    cost: 40,
    effects: {
      cityEffects: { defenseBonus: 2 },
    },
    description:
      'The shadow goblin doctrine of never fighting fair: strike first, strike from ' +
      'the dark, and be gone before the count.',
  },
  'shadow-goblins-tunnel-lore-1': {
    id: 'shadow-goblins-tunnel-lore-1',
    name: 'Tunnel Lore',
    cost: 87,
    requires: ['shadow-goblins-ambush-craft-1'],
    effects: {
      cityEffects: { yields: { production: 2, gold: 1 } },
    },
    description:
      'A warren of dug passages beneath every shadow goblin holding, doubling as ' +
      'mine, market, and escape route.',
  },
  'shadow-goblins-nightsight-1': {
    id: 'shadow-goblins-nightsight-1',
    name: 'Nightsight',
    cost: 176,
    requires: ['shadow-goblins-tunnel-lore-1'],
    effects: {
      cityEffects: { defenseBonus: 4 },
    },
    description:
      'Eyes long adapted to lightless tunnels give shadow goblin sentries the edge in ' +
      'any fight fought in the dark.',
  },

  // ---------------------------------------------------------------------
  // Vampire Aristocracy — blood lore, court intrigue, dominion, legacy.
  // ---------------------------------------------------------------------
  'vampire-aristocracy-blood-lore-1': {
    id: 'vampire-aristocracy-blood-lore-1',
    name: 'Blood Lore',
    cost: 45,
    effects: {
      cityEffects: { yields: { mana: 2, gold: 1 } },
    },
    description:
      'The oldest study of the bloodline itself — what it grants, what it costs, and ' +
      'how to keep both a secret from the mortal court.',
  },
  'vampire-aristocracy-court-intrigue-1': {
    id: 'vampire-aristocracy-court-intrigue-1',
    name: 'Court Intrigue',
    cost: 96,
    requires: ['vampire-aristocracy-blood-lore-1'],
    effects: {
      cityEffects: { yieldMultipliers: { gold: 1.15 } },
    },
    description:
      'Whispered debts and gilded favors, the true currency of every crypt-court in ' +
      'Umbra.',
  },
  'vampire-aristocracy-dominion-rites-1': {
    id: 'vampire-aristocracy-dominion-rites-1',
    name: 'Dominion Rites',
    cost: 198,
    requires: ['vampire-aristocracy-court-intrigue-1'],
    effects: {
      cityEffects: { yields: { research: 3 }, unrestReduction: 2 },
    },
    description:
      'Formal rites of fealty that bind a vampire lord\'s holdings to their will, ' +
      'mortal and undead subjects alike.',
  },
  'vampire-aristocracy-undying-legacy-1': {
    id: 'vampire-aristocracy-undying-legacy-1',
    name: 'Undying Legacy',
    cost: 380,
    requires: ['vampire-aristocracy-dominion-rites-1'],
    effects: {
      cityEffects: { yieldMultipliers: { gold: 1.2, mana: 1.15 } },
      unlocksBuildings: ['black-mausoleum'],
    },
    description:
      'A bloodline\'s claim to permanence, sealed in stone: the mausoleum that will ' +
      'still be standing, and still be owed, long after mortal dynasties are dust.',
  },

  // ---------------------------------------------------------------------
  // Plague Cultists — contagion rites, plunder craft, and fervor.
  // ---------------------------------------------------------------------
  'plague-cultists-contagion-rites-1': {
    id: 'plague-cultists-contagion-rites-1',
    name: 'Contagion Rites',
    cost: 42,
    effects: {
      cityEffects: { yields: { mana: 2 } },
    },
    description:
      'Doctrine that treats plague as sacrament, cultivated and studied with the ' +
      'devotion others reserve for scripture.',
  },
  'plague-cultists-plunder-craft-1': {
    id: 'plague-cultists-plunder-craft-1',
    name: 'Plunder Craft',
    cost: 90,
    requires: ['plague-cultists-contagion-rites-1'],
    effects: {
      cityEffects: { yields: { gold: 3 } },
    },
    description:
      'The grim economics of raiding a plague-weakened neighbor before anyone else ' +
      'gets the chance.',
  },
  'plague-cultists-fervor-1': {
    id: 'plague-cultists-fervor-1',
    name: 'Fanatic Fervor',
    cost: 182,
    requires: ['plague-cultists-plunder-craft-1'],
    effects: {
      cityEffects: { unrestReduction: 2, defenseBonus: 2 },
    },
    description:
      'Zeal whipped to a fever pitch, holding a cult together through hardship that ' +
      'would scatter any ordinary settlement.',
  },

  // =========================================================================
  // Lumina — 6 races (life-flavored)
  // =========================================================================

  // ---------------------------------------------------------------------
  // Sunborn — celestial blood, radiant oath, and blessing rites.
  // ---------------------------------------------------------------------
  'sunborn-celestial-blood-1': {
    id: 'sunborn-celestial-blood-1',
    name: 'Celestial Blood',
    cost: 43,
    effects: {
      cityEffects: { yields: { mana: 2 } },
    },
    description:
      'The old celestial touch in sunborn blood, studied and coaxed a little closer ' +
      'to the surface.',
  },
  'sunborn-radiant-oath-1': {
    id: 'sunborn-radiant-oath-1',
    name: 'Radiant Oath',
    cost: 91,
    requires: ['sunborn-celestial-blood-1'],
    effects: {
      cityEffects: { defenseBonus: 3, unrestReduction: 1 },
    },
    description:
      'A knight\'s vow sworn under open sky, binding sunborn defenders to their ' +
      'charges with more than steel.',
  },
  'sunborn-blessing-rites-1': {
    id: 'sunborn-blessing-rites-1',
    name: 'Blessing Rites',
    cost: 184,
    requires: ['sunborn-radiant-oath-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.12 }, yields: { research: 2 } },
    },
    description:
      'Formal clerical blessing, laid over a settlement the way sunlight lies over ' +
      'open ground.',
  },

  // ---------------------------------------------------------------------
  // Lammasu Folk — oracular wisdom, guardian oath, and law lore.
  // ---------------------------------------------------------------------
  'lammasu-folk-oracular-wisdom-1': {
    id: 'lammasu-folk-oracular-wisdom-1',
    name: 'Oracular Wisdom',
    cost: 44,
    effects: {
      cityEffects: { yields: { research: 2 } },
    },
    description:
      'Cryptic, rarely wrong pronouncements delivered by lammasu sages who study a ' +
      'question longer than most peoples study a lifetime.',
  },
  'lammasu-folk-guardian-oath-1': {
    id: 'lammasu-folk-guardian-oath-1',
    name: 'Guardian Oath',
    cost: 93,
    requires: ['lammasu-folk-oracular-wisdom-1'],
    effects: {
      cityEffects: { defenseBonus: 3 },
    },
    description:
      'The lion-bodied vow to stand between danger and the judged, taken seriously ' +
      'by every lammasu sworn to it.',
  },
  'lammasu-folk-law-lore-1': {
    id: 'lammasu-folk-law-lore-1',
    name: 'Law Lore',
    cost: 189,
    requires: ['lammasu-folk-guardian-oath-1'],
    effects: {
      cityEffects: { unrestReduction: 3, yields: { gold: 2 } },
    },
    description:
      'Precedent and judgment codified across generations of lammasu courts, keeping ' +
      'the peace better than any garrison could alone.',
  },

  // ---------------------------------------------------------------------
  // Seraphic Avians — windsong, skyward drill, and featherlight rites.
  // ---------------------------------------------------------------------
  'seraphic-avians-windsong-1': {
    id: 'seraphic-avians-windsong-1',
    name: 'Windsong',
    cost: 40,
    effects: {
      cityEffects: { yields: { mana: 2 } },
    },
    description:
      'A high, wordless song carried on Lumina\'s winds, said to be the oldest music ' +
      'the seraphic avians know.',
  },
  'seraphic-avians-skyward-drill-1': {
    id: 'seraphic-avians-skyward-drill-1',
    name: 'Skyward Drill',
    cost: 87,
    requires: ['seraphic-avians-windsong-1'],
    effects: {
      cityEffects: { defenseBonus: 2, yields: { food: 1 } },
    },
    description:
      'Formation flying practiced at altitude, letting seraphic avian patrols spot ' +
      'and answer threats long before they land.',
  },
  'seraphic-avians-featherlight-1': {
    id: 'seraphic-avians-featherlight-1',
    name: 'Featherlight Rites',
    cost: 176,
    requires: ['seraphic-avians-skyward-drill-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.1 }, growthBonus: 0.04 },
    },
    description:
      'A rite of near-weightlessness, letting a seraphic avian brood hatch, grow, and ' +
      'take wing faster than heavier folk ever could.',
  },

  // ---------------------------------------------------------------------
  // Crystalfolk — refraction lore, living lattice, and resonance rites.
  // ---------------------------------------------------------------------
  'crystalfolk-refraction-lore-1': {
    id: 'crystalfolk-refraction-lore-1',
    name: 'Refraction Lore',
    cost: 45,
    effects: {
      cityEffects: { yields: { mana: 2 } },
    },
    description:
      'The study of how light bends and splits through a crystalfolk\'s own body, ' +
      'the first step toward shaping it on purpose.',
  },
  'crystalfolk-living-lattice-1': {
    id: 'crystalfolk-living-lattice-1',
    name: 'Living Lattice',
    cost: 94,
    requires: ['crystalfolk-refraction-lore-1'],
    effects: {
      cityEffects: { yields: { production: 3 } },
    },
    description:
      'Crystal grown in deliberate, load-bearing lattices rather than left to chance, ' +
      'strong enough to build with.',
  },
  'crystalfolk-resonance-rites-1': {
    id: 'crystalfolk-resonance-rites-1',
    name: 'Resonance Rites',
    cost: 190,
    requires: ['crystalfolk-living-lattice-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.15, production: 1.1 } },
    },
    description:
      'A struck chord that sets an entire crystalfolk settlement humming in ' +
      'sympathetic resonance, magic and labor alike moving a little faster.',
  },

  // ---------------------------------------------------------------------
  // Sidhefolk — unicorn bond, fae court, and glamour rites.
  // ---------------------------------------------------------------------
  'sidhefolk-unicorn-bond-1': {
    id: 'sidhefolk-unicorn-bond-1',
    name: 'Unicorn Bond',
    cost: 42,
    effects: {
      cityEffects: { yields: { mana: 2 }, defenseBonus: 2 },
    },
    description:
      'The old fae pact between sidhefolk rider and unicorn mount, sworn once and ' +
      'kept for a lifetime.',
  },
  'sidhefolk-fae-court-1': {
    id: 'sidhefolk-fae-court-1',
    name: 'Fae Court',
    cost: 90,
    requires: ['sidhefolk-unicorn-bond-1'],
    effects: {
      cityEffects: { yields: { gold: 3 } },
    },
    description:
      'Glittering court protocol where favor is currency and every sidhefolk noble ' +
      'is owed, or owes, something.',
  },
  'sidhefolk-glamour-rites-1': {
    id: 'sidhefolk-glamour-rites-1',
    name: 'Glamour Rites',
    cost: 182,
    requires: ['sidhefolk-fae-court-1'],
    effects: {
      cityEffects: { yieldMultipliers: { gold: 1.12, mana: 1.08 } },
    },
    description:
      'Illusion woven over a sidhefolk hall until it looks — and to visitors, ' +
      'is — grander than it has any right to be.',
  },

  // ---------------------------------------------------------------------
  // Haloborn — inner light, halo binding, radiant focus, ascendant rites.
  // ---------------------------------------------------------------------
  'haloborn-inner-light-1': {
    id: 'haloborn-inner-light-1',
    name: 'Inner Light',
    cost: 44,
    effects: {
      cityEffects: { yields: { mana: 3 } },
    },
    description:
      'A haloborn learns to draw on the fragment of Lumina\'s own light held inside ' +
      'them, carefully, so it does not burn them out.',
  },
  'haloborn-halo-binding-1': {
    id: 'haloborn-halo-binding-1',
    name: 'Halo Binding',
    cost: 94,
    requires: ['haloborn-inner-light-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.15 } },
    },
    description:
      'Binding the inner light into a stable halo rather than a flicker, so it can be ' +
      'drawn on again and again.',
  },
  'haloborn-radiant-focus-1': {
    id: 'haloborn-radiant-focus-1',
    name: 'Radiant Focus',
    cost: 192,
    requires: ['haloborn-halo-binding-1'],
    effects: {
      cityEffects: { yields: { research: 4, mana: 2 } },
    },
    description:
      'Discipline that channels a haloborn\'s saturating light into precise, ' +
      'sustained study rather than a diffuse glow.',
  },
  'haloborn-ascendant-rites-1': {
    id: 'haloborn-ascendant-rites-1',
    name: 'Ascendant Rites',
    cost: 370,
    requires: ['haloborn-radiant-focus-1'],
    effects: {
      cityEffects: { yieldMultipliers: { mana: 1.2, research: 1.15 } },
      unlocksBuildings: ['seraphic-bastion'],
    },
    description:
      'The rite that lets a haloborn\'s inner light spill outward into the world, ' +
      'raising a bastion of living light around them.',
  },

  // =========================================================================
  // Magic shelf — one 6-study tree per school of magic (see docs/DESIGN.md
  // "Research has two shelves"). Any wizard who knows a school may research
  // that school's tree alongside their race's studies; `school` marks these
  // as school-wide rather than race-owned, so no race lists them in
  // `RaceDef.studies`. Costs escalate 60 -> 150 -> 320 -> 600 -> 1000 -> 1500
  // (+/-20%) per chain, steeper than any race chain — a pure mage's deepest
  // study is meant to be a bragging-rights commitment. No unlocksBuildings /
  // unlocksUnits here: shrine access is race-gated and summon unlocks arrive
  // with the casting milestone, so the magic shelf is pure cityEffects.
  // =========================================================================

  // ---------------------------------------------------------------------
  // Life — consecration and communion: blessing, protection, exaltation.
  // Growth, unrest suppression, and research drawn from faith itself.
  // ---------------------------------------------------------------------
  'magic-life-1-consecration': {
    id: 'magic-life-1-consecration',
    name: 'Consecration',
    school: 'life',
    cost: 58,
    effects: {
      cityEffects: { yields: { mana: 1 }, unrestReduction: 1 },
    },
    description:
      'Ground and water blessed until they carry a faint, unmistakable warmth — ' +
      'the first mark of a wizard sworn to Life.',
  },
  'magic-life-2-benediction': {
    id: 'magic-life-2-benediction',
    name: 'Benediction',
    school: 'life',
    cost: 145,
    requires: ['magic-life-1-consecration'],
    effects: {
      cityEffects: { growthBonus: 0.05, unrestReduction: 1 },
    },
    description:
      'A standing blessing laid over field and cradle alike, easing both the ' +
      'harvest and the newborn\'s first breath.',
  },
  'magic-life-3-sanctified-doctrine': {
    id: 'magic-life-3-sanctified-doctrine',
    name: 'Sanctified Doctrine',
    school: 'life',
    cost: 310,
    requires: ['magic-life-2-benediction'],
    effects: {
      cityEffects: { yields: { research: 2, mana: 1 }, unrestReduction: 1 },
    },
    description:
      'Scripture studied as seriously as any spellbook, turning devotion itself ' +
      'into a source of insight.',
  },
  'magic-life-4-exalted-communion': {
    id: 'magic-life-4-exalted-communion',
    name: 'Exalted Communion',
    school: 'life',
    cost: 560,
    requires: ['magic-life-3-sanctified-doctrine'],
    effects: {
      cityEffects: { growthBonus: 0.1, unrestReduction: 3, yields: { mana: 3 } },
    },
    description:
      'Rites that let a wizard commune directly with Life\'s source, and channel ' +
      'a measure of its abundance into every hearth in the realm.',
  },
  'magic-life-5-celestial-mandate': {
    id: 'magic-life-5-celestial-mandate',
    name: 'Celestial Mandate',
    school: 'life',
    cost: 980,
    requires: ['magic-life-4-exalted-communion'],
    effects: {
      cityEffects: {
        yields: { research: 6, mana: 4 },
        growthBonus: 0.12,
        unrestReduction: 3,
      },
    },
    description:
      'A formal charter, sworn before something that is not quite mortal, ' +
      'naming the wizard\'s realm blessed and its people its stewards.',
  },
  'magic-life-6-apotheosis-of-the-white-flame': {
    id: 'magic-life-6-apotheosis-of-the-white-flame',
    name: 'Apotheosis of the White Flame',
    school: 'life',
    cost: 1480,
    requires: ['magic-life-5-celestial-mandate'],
    effects: {
      cityEffects: {
        growthBonus: 0.2,
        unrestReduction: 6,
        yields: { research: 9, mana: 6 },
        yieldMultipliers: { research: 1.2 },
      },
    },
    description:
      'The wizard\'s own body becomes a lesser conduit for Life\'s light — a ' +
      'mantle every pure Life mage wears, and every rival fears.',
  },

  // ---------------------------------------------------------------------
  // Death — tithes of the dead: corruption, conversion, attrition. Mana and
  // gold drawn from a realm's graves, crypts, and battlefields.
  // ---------------------------------------------------------------------
  'magic-death-1-grave-tithe': {
    id: 'magic-death-1-grave-tithe',
    name: 'Grave Tithe',
    school: 'death',
    cost: 55,
    effects: {
      cityEffects: { yields: { mana: 2, gold: 1 } },
    },
    description:
      'The dead are asked for a small toll before they are allowed to rest, ' +
      'paid in mana and a handful of grave-goods.',
  },
  'magic-death-2-bone-toll': {
    id: 'magic-death-2-bone-toll',
    name: 'Bone Toll',
    school: 'death',
    cost: 140,
    requires: ['magic-death-1-grave-tithe'],
    effects: {
      cityEffects: { yields: { mana: 3, gold: 2 } },
    },
    description:
      'A wider levy on Umbra\'s bone-yards and battlefields, converting what ' +
      'the living leave behind into coin and power.',
  },
  'magic-death-3-charnel-covenant': {
    id: 'magic-death-3-charnel-covenant',
    name: 'Charnel Covenant',
    school: 'death',
    cost: 300,
    requires: ['magic-death-2-bone-toll'],
    effects: {
      cityEffects: { yields: { mana: 5, gold: 3 } },
    },
    description:
      'A binding pact with the restless dead of the realm, who give up their ' +
      'lingering essence in exchange for a wizard\'s patronage.',
  },
  'magic-death-4-black-tithing': {
    id: 'magic-death-4-black-tithing',
    name: 'Black Tithing',
    school: 'death',
    cost: 570,
    requires: ['magic-death-3-charnel-covenant'],
    effects: {
      cityEffects: { yields: { mana: 8, gold: 5 }, unrestReduction: 2 },
    },
    description:
      'Death\'s tax made formal and empire-wide: every grave, crypt, and ' +
      'battlefield now pays its due on schedule.',
  },
  'magic-death-5-reapers-accord': {
    id: 'magic-death-5-reapers-accord',
    name: "Reaper's Accord",
    school: 'death',
    cost: 1020,
    requires: ['magic-death-4-black-tithing'],
    effects: {
      cityEffects: { yields: { mana: 12, gold: 8 }, yieldMultipliers: { mana: 1.2 } },
    },
    description:
      'An accord struck with something that collects on every death in the ' +
      'realm, and is willing to share a cut.',
  },
  'magic-death-6-dominion-of-the-grave': {
    id: 'magic-death-6-dominion-of-the-grave',
    name: 'Dominion of the Grave',
    school: 'death',
    cost: 1490,
    requires: ['magic-death-5-reapers-accord'],
    effects: {
      cityEffects: {
        yields: { mana: 18, gold: 12 },
        yieldMultipliers: { mana: 1.35, gold: 1.2 },
      },
    },
    description:
      'The wizard\'s claim over death itself made absolute — nothing dies in ' +
      'the realm without enriching them a little more.',
  },

  // ---------------------------------------------------------------------
  // Chaos — forge-fires: destruction, fire, raw force bent toward
  // production. Escalating output, never at the cost of stability.
  // ---------------------------------------------------------------------
  'magic-chaos-1-forge-fire': {
    id: 'magic-chaos-1-forge-fire',
    name: 'Forge-Fire Rite',
    school: 'chaos',
    cost: 60,
    effects: {
      cityEffects: { yieldMultipliers: { production: 1.06 } },
    },
    description:
      'A rite that keeps every forge and furnace in the realm burning a shade ' +
      'hotter than it has any right to.',
  },
  'magic-chaos-2-cinder-doctrine': {
    id: 'magic-chaos-2-cinder-doctrine',
    name: 'Cinder Doctrine',
    school: 'chaos',
    cost: 155,
    requires: ['magic-chaos-1-forge-fire'],
    effects: {
      cityEffects: { yields: { production: 3 }, yieldMultipliers: { production: 1.08 } },
    },
    description:
      'Controlled destruction turned into method: rubble and ash, properly ' +
      'directed, feed the next thing built.',
  },
  'magic-chaos-3-wildfire-rites': {
    id: 'magic-chaos-3-wildfire-rites',
    name: 'Wildfire Rites',
    school: 'chaos',
    cost: 330,
    requires: ['magic-chaos-2-cinder-doctrine'],
    effects: {
      cityEffects: { yields: { production: 5 }, yieldMultipliers: { production: 1.12 } },
    },
    description:
      'Chaos let loose just enough to scour and clear, leaving forges and ' +
      'workshops running hotter for it.',
  },
  'magic-chaos-4-molten-covenant': {
    id: 'magic-chaos-4-molten-covenant',
    name: 'Molten Covenant',
    school: 'chaos',
    cost: 600,
    requires: ['magic-chaos-3-wildfire-rites'],
    effects: {
      cityEffects: { yields: { production: 7 }, yieldMultipliers: { production: 1.18 } },
    },
    description:
      'A standing bargain with raw elemental force, its fury bent toward the ' +
      'bellows and anvils of the realm.',
  },
  'magic-chaos-5-inferno-mastery': {
    id: 'magic-chaos-5-inferno-mastery',
    name: 'Inferno Mastery',
    school: 'chaos',
    cost: 1010,
    requires: ['magic-chaos-4-molten-covenant'],
    effects: {
      cityEffects: { yields: { production: 10 }, yieldMultipliers: { production: 1.25 } },
    },
    description:
      'The wizard learns to hold a firestorm in cupped hands and pour it, ' +
      'precisely, into every foundry they own.',
  },
  'magic-chaos-6-maelstrom-forged': {
    id: 'magic-chaos-6-maelstrom-forged',
    name: 'Maelstrom-Forged',
    school: 'chaos',
    cost: 1500,
    requires: ['magic-chaos-5-inferno-mastery'],
    effects: {
      cityEffects: { yields: { production: 15 }, yieldMultipliers: { production: 1.4 } },
    },
    description:
      'A permanent tether to the Maelstrom itself, its raw destructive current ' +
      'rerouted wholesale into production.',
  },

  // ---------------------------------------------------------------------
  // Nature — the green chain: growth, beasts, terrain. Food and population
  // growth, drawn from land that answers a wizard's attention.
  // ---------------------------------------------------------------------
  'magic-nature-1-first-growth': {
    id: 'magic-nature-1-first-growth',
    name: 'First Growth',
    school: 'nature',
    cost: 62,
    effects: {
      cityEffects: { yields: { food: 2 } },
    },
    description:
      'A coaxing rite that convinces field and orchard to give a little more, ' +
      'a little sooner.',
  },
  'magic-nature-2-verdant-rite': {
    id: 'magic-nature-2-verdant-rite',
    name: 'Verdant Rite',
    school: 'nature',
    cost: 148,
    requires: ['magic-nature-1-first-growth'],
    effects: {
      cityEffects: { yields: { food: 3 }, growthBonus: 0.04 },
    },
    description:
      'Green magic poured into root and soil until a realm\'s farmland ' +
      'outgrows its ordinary bounds.',
  },
  'magic-nature-3-wildroot-communion': {
    id: 'magic-nature-3-wildroot-communion',
    name: 'Wildroot Communion',
    school: 'nature',
    cost: 315,
    requires: ['magic-nature-2-verdant-rite'],
    effects: {
      cityEffects: { yields: { food: 4 }, growthBonus: 0.07 },
    },
    description:
      'Communion with the deep roots beneath every field, which remember how ' +
      'to grow better than any farmer taught them.',
  },
  'magic-nature-4-bountiful-harvest': {
    id: 'magic-nature-4-bountiful-harvest',
    name: 'Bountiful Harvest',
    school: 'nature',
    cost: 590,
    requires: ['magic-nature-3-wildroot-communion'],
    effects: {
      cityEffects: { yields: { food: 6 }, growthBonus: 0.1 },
    },
    description:
      'A season-spanning working that turns every harvest into the best one ' +
      'anyone can remember.',
  },
  'magic-nature-5-primal-blossoming': {
    id: 'magic-nature-5-primal-blossoming',
    name: 'Primal Blossoming',
    school: 'nature',
    cost: 1000,
    requires: ['magic-nature-4-bountiful-harvest'],
    effects: {
      cityEffects: { yields: { food: 9 }, growthBonus: 0.15 },
    },
    description:
      'The land itself quickens under the wizard\'s attention, orchards and ' +
      'pastures growing as if touched by an early, endless spring.',
  },
  'magic-nature-6-worldroot-awakening': {
    id: 'magic-nature-6-worldroot-awakening',
    name: 'Worldroot Awakening',
    school: 'nature',
    cost: 1470,
    requires: ['magic-nature-5-primal-blossoming'],
    effects: {
      cityEffects: { yields: { food: 14 }, growthBonus: 0.22, housing: 3 },
    },
    description:
      'The wizard wakes something ancient and green beneath the whole realm, ' +
      'and it answers by making the land generous beyond reason.',
  },

  // ---------------------------------------------------------------------
  // Sorcery — illusion and counter-magic bent toward scholarship. Research
  // multipliers and the mana to sustain them.
  // ---------------------------------------------------------------------
  'magic-sorcery-1-arcane-current': {
    id: 'magic-sorcery-1-arcane-current',
    name: 'Arcane Current',
    school: 'sorcery',
    cost: 65,
    effects: {
      cityEffects: { yields: { mana: 2 }, yieldMultipliers: { research: 1.05 } },
    },
    description:
      'A subtle current of Sorcery drawn into the realm\'s libraries and ' +
      'towers, sharpening thought as much as spellcraft.',
  },
  'magic-sorcery-2-mirrorweave': {
    id: 'magic-sorcery-2-mirrorweave',
    name: 'Mirrorweave',
    school: 'sorcery',
    cost: 150,
    requires: ['magic-sorcery-1-arcane-current'],
    effects: {
      cityEffects: { yields: { mana: 3 }, yieldMultipliers: { research: 1.08 } },
    },
    description:
      'Illusion-craft turned inward, reflecting a scholar\'s own insight back ' +
      'at them clarified and doubled.',
  },
  'magic-sorcery-3-veiled-doctrine': {
    id: 'magic-sorcery-3-veiled-doctrine',
    name: 'Veiled Doctrine',
    school: 'sorcery',
    cost: 325,
    requires: ['magic-sorcery-2-mirrorweave'],
    effects: {
      cityEffects: {
        yields: { mana: 4, research: 2 },
        yieldMultipliers: { research: 1.1 },
      },
    },
    description:
      'A body of counter-magic theory taught only in whispers, useful for ' +
      'unmaking a rival\'s work as much as advancing one\'s own.',
  },
  'magic-sorcery-4-counterspell-canon': {
    id: 'magic-sorcery-4-counterspell-canon',
    name: 'Counterspell Canon',
    school: 'sorcery',
    cost: 605,
    requires: ['magic-sorcery-3-veiled-doctrine'],
    effects: {
      cityEffects: {
        yields: { mana: 6 },
        yieldMultipliers: { research: 1.15, mana: 1.1 },
      },
    },
    description:
      'The formal canon of unmaking, which turns out to teach as much about ' +
      'how magic works as any spellbook does.',
  },
  'magic-sorcery-5-labyrinthine-mastery': {
    id: 'magic-sorcery-5-labyrinthine-mastery',
    name: 'Labyrinthine Mastery',
    school: 'sorcery',
    cost: 1015,
    requires: ['magic-sorcery-4-counterspell-canon'],
    effects: {
      cityEffects: {
        yields: { mana: 9, research: 4 },
        yieldMultipliers: { research: 1.2 },
      },
    },
    description:
      'Thought bent into recursive mazes that trap error and let a wizard\'s ' +
      'true insights escape faster than ever.',
  },
  'magic-sorcery-6-grand-illusion': {
    id: 'magic-sorcery-6-grand-illusion',
    name: 'Grand Illusion',
    school: 'sorcery',
    cost: 1490,
    requires: ['magic-sorcery-5-labyrinthine-mastery'],
    effects: {
      cityEffects: {
        yields: { mana: 14, research: 6 },
        yieldMultipliers: { research: 1.3, mana: 1.2 },
      },
    },
    description:
      'The wizard\'s masterwork: an illusion so vast and so perfect it ' +
      'reshapes how an entire realm perceives — and produces — knowledge.',
  },
};
