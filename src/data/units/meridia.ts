/**
 * Rosters for the 18 Meridia races. Owned by the meridia-units content pass.
 *
 * Every unit is balanced against the CORE_UNITS anchors in ./core.ts
 * (militia: f6 h3 melee 3/2 armor1 spd2 mass1 mor40 dis30 skill15 cost30).
 * Stats bend from those anchors by physiology and culture per race; the
 * typed AbilityDef vocabulary in src/sim/types.ts is used sparingly —
 * most units carry 0-1 abilities, and composition gaps (no cavalry for
 * chitinfolk, no archers for ogres, no plain infantry for centaurfolk) are
 * deliberate racial identity, not oversights.
 */
import type { UnitDef } from '../../sim/types';

export const MERIDIA_UNITS: Record<string, UnitDef> = {
  // ===========================================================================
  // Orcs — the generic baseline. Broad, unremarkable, competent at everything.
  // ===========================================================================
  'orc-warrior': {
    id: 'orc-warrior',
    name: 'Orc Warrior',
    role: 'infantry',
    origin: { race: 'orcs' },
    cost: 40,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 3, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 45,
      discipline: 35,
    },
    moves: 1,
    skill: 20,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Crude iron blades and a willingness to close distance fast. Orc warriors ' +
      'form the backbone of any warband, unremarkable but reliable in the shield line.',
  },
  'orc-spearman': {
    id: 'orc-spearman',
    name: 'Orc Spearman',
    role: 'infantry',
    origin: { race: 'orcs' },
    cost: 38,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 45,
      discipline: 35,
    },
    moves: 1,
    skill: 20,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Levied spears held at length to blunt a charge before it lands. Green and ' +
      'prone to breaking if the fight drags on.',
  },
  'orc-archer': {
    id: 'orc-archer',
    name: 'Orc Archer',
    role: 'ranged',
    origin: { race: 'orcs' },
    cost: 45,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 6, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 40,
      discipline: 30,
    },
    moves: 1,
    skill: 22,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Short recurve bows loosed from the second rank, thinning an enemy line ' +
      'before the warriors close.',
  },
  'orc-wolf-rider': {
    id: 'orc-wolf-rider',
    name: 'Orc Wolf-Rider',
    role: 'cavalry',
    origin: { race: 'orcs' },
    cost: 70,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 3,
      morale: 45,
      discipline: 30,
    },
    moves: 2,
    skill: 25,
    upkeep: { gold: 2 },
    abilities: [{ type: 'charge', bonus: 3 }],
    description:
      'Mounted on snarling dire wolves, these riders slam into loose formations ' +
      'and vanish before a counter-charge can form.',
  },
  'orc-warchief': {
    id: 'orc-warchief',
    name: 'Orc Warchief',
    role: 'infantry',
    origin: { race: 'orcs' },
    cost: 95,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 60,
      discipline: 45,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 2 },
    abilities: [{ type: 'inspire', radius: 3, bonus: 10 }],
    description:
      'A battle-scarred leader whose bellowed commands steady a wavering warband ' +
      'and remind every orc nearby why they follow.',
  },

  // ===========================================================================
  // Humans — Life-leaning, balanced culture, no glaring strength or weakness.
  // ===========================================================================
  'human-spearman': {
    id: 'human-spearman',
    name: 'Human Spearman',
    role: 'infantry',
    origin: { race: 'humans' },
    cost: 40,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 50,
      discipline: 50,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Drilled townsfolk turned soldier, spears leveled to hold a line against ' +
      'anything that charges. Steady, unremarkable, dependable.',
  },
  'human-swordsman': {
    id: 'human-swordsman',
    name: 'Human Swordsman',
    role: 'infantry',
    origin: { race: 'humans' },
    cost: 45,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 1,
      morale: 50,
      discipline: 50,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Trained infantry with sword and shield, built to trade blows in a stand-up ' +
      'fight rather than finesse their way past one.',
  },
  'human-archer': {
    id: 'human-archer',
    name: 'Human Archer',
    role: 'ranged',
    origin: { race: 'humans' },
    cost: 46,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 6, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 48,
      discipline: 45,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Longbowmen who volley from range and fall back behind the shield line when ' +
      'the enemy closes, thinning ranks before steel meets steel.',
  },
  'human-knight': {
    id: 'human-knight',
    name: 'Human Knight',
    role: 'cavalry',
    origin: { race: 'humans' },
    cost: 90,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 3,
      speed: 4,
      mass: 4,
      morale: 58,
      discipline: 55,
    },
    moves: 2,
    skill: 38,
    upkeep: { gold: 3 },
    abilities: [{ type: 'charge', bonus: 4 }],
    description:
      'Armored lancers whose charge is the decisive weapon of any human army — ' +
      'devastating against a broken or unformed line.',
  },
  'human-templar': {
    id: 'human-templar',
    name: 'Human Templar',
    role: 'infantry',
    origin: { race: 'humans' },
    cost: 100,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 6, damage: 3, reach: 1 },
      armor: 3,
      speed: 2,
      mass: 2,
      morale: 65,
      discipline: 60,
    },
    moves: 1,
    skill: 42,
    upkeep: { gold: 2 },
    abilities: [{ type: 'inspire', radius: 2, bonus: 8 }],
    description:
      'A blessed champion of the temple, whose presence on the field steadies ' +
      'nearby troops as much as any war-cry.',
  },

  // ===========================================================================
  // Dwarves — high armor/discipline, low speed. No cavalry: dwarves do not ride.
  // ===========================================================================
  'dwarf-warrior': {
    id: 'dwarf-warrior',
    name: 'Dwarf Warrior',
    role: 'infantry',
    origin: { race: 'dwarves' },
    cost: 48,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 4, damage: 3, reach: 1 },
      armor: 3,
      speed: 1,
      mass: 2,
      morale: 55,
      discipline: 65,
    },
    moves: 1,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Stout infantry in thick plate, built to anchor a line and simply refuse to ' +
      'move. Slow to advance, slower to break.',
  },
  'dwarf-crossbowman': {
    id: 'dwarf-crossbowman',
    name: 'Dwarf Crossbowman',
    role: 'ranged',
    origin: { race: 'dwarves' },
    cost: 55,
    combat: {
      figures: 320,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 5, damage: 3, range: 6, ammo: 6 },
      armor: 2,
      speed: 1,
      mass: 1,
      morale: 50,
      discipline: 60,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Heavy steel-bowed crossbows that punch through armor other archers can\'t ' +
      'touch, traded for a slow reload.',
  },
  'dwarf-ironguard': {
    id: 'dwarf-ironguard',
    name: 'Dwarf Ironguard',
    role: 'infantry',
    origin: { race: 'dwarves' },
    cost: 95,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 5,
      speed: 1,
      mass: 2,
      morale: 60,
      discipline: 75,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Veteran heavy infantry sheathed in the finest dwarven plate, a wall that ' +
      'holds long after lesser troops would have routed.',
  },
  'dwarf-battering-ram': {
    id: 'dwarf-battering-ram',
    name: 'Dwarf Battering Ram',
    role: 'siege',
    origin: { race: 'dwarves' },
    cost: 80,
    combat: {
      figures: 1,
      hits: 30,
      melee: { attack: 3, damage: 5, reach: 1 },
      armor: 4,
      speed: 1,
      mass: 6,
      morale: 60,
      discipline: 70,
    },
    moves: 1,
    skill: 15,
    upkeep: { gold: 2 },
    abilities: [{ type: 'trample' }],
    description:
      'A war-engine driven by grim dwarven muscle, built to smash gates and keep ' +
      'grinding forward through whatever stands in its path.',
  },
  'dwarf-berserker': {
    id: 'dwarf-berserker',
    name: 'Dwarf Berserker',
    role: 'infantry',
    origin: { race: 'dwarves' },
    cost: 90,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 55,
      discipline: 50,
    },
    moves: 1,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: [{ type: 'fearless' }],
    description:
      'Grim, axe-wielding dwarves who fight past wounds that would break any other ' +
      'people, their resolve as hard as the stone they were quarried from.',
  },

  // ===========================================================================
  // High Elves — skill/accuracy high, fragile. Veteran skill over raw numbers.
  // ===========================================================================
  'high-elf-spearman': {
    id: 'high-elf-spearman',
    name: 'High Elf Spearman',
    role: 'infantry',
    origin: { race: 'high-elves' },
    cost: 42,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 45,
      discipline: 45,
    },
    moves: 1,
    skill: 38,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Elegant but thin-skinned spear-line, trading armor for reach and precision ' +
      '— a single solid hit can down a figure.',
  },
  'high-elf-archer': {
    id: 'high-elf-archer',
    name: 'High Elf Archer',
    role: 'ranged',
    origin: { race: 'high-elves' },
    cost: 55,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 6, damage: 2, range: 7, ammo: 10 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 45,
      discipline: 45,
    },
    moves: 1,
    skill: 48,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Centuries of practiced marksmanship loosed from elegant longbows, rarely ' +
      'missing a target at any range they can see.',
  },
  'high-elf-swordmaster': {
    id: 'high-elf-swordmaster',
    name: 'High Elf Swordmaster',
    role: 'infantry',
    origin: { race: 'high-elves' },
    cost: 100,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 7, damage: 4, reach: 1 },
      armor: 2,
      speed: 3,
      mass: 1,
      morale: 55,
      discipline: 55,
    },
    moves: 1,
    skill: 60,
    upkeep: { gold: 2 },
    abilities: [{ type: 'first-strike' }],
    description:
      'A duelist trained since childhood, fast enough to land the first cut before ' +
      'a slower opponent can react.',
  },
  'high-elf-lancer': {
    id: 'high-elf-lancer',
    name: 'High Elf Lancer',
    role: 'cavalry',
    origin: { race: 'high-elves' },
    cost: 85,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 4,
      mass: 4,
      morale: 50,
      discipline: 50,
    },
    moves: 2,
    skill: 42,
    upkeep: { gold: 2 },
    abilities: [{ type: 'charge', bonus: 3 }],
    description:
      'Mounted nobility whose disciplined charge is aimed with the same precision ' +
      'as their archery.',
  },
  'high-elf-outrider': {
    id: 'high-elf-outrider',
    name: 'High Elf Outrider',
    role: 'cavalry',
    origin: { race: 'high-elves' },
    cost: 75,
    combat: {
      figures: 220,
      hits: 2,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 5, damage: 2, range: 6, ammo: 6 },
      armor: 1,
      speed: 4,
      mass: 3,
      morale: 45,
      discipline: 40,
    },
    moves: 2,
    skill: 45,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Mounted skirmishers who loose arrows on the gallop, always a stride ahead ' +
      'of anything that tries to close.',
  },

  // ===========================================================================
  // Wood Elves — Nature-attuned forest skirmishers, kiting archery and beast-bond.
  // ===========================================================================
  'wood-elf-spearman': {
    id: 'wood-elf-spearman',
    name: 'Wood Elf Spearman',
    role: 'infantry',
    origin: { race: 'wood-elves' },
    cost: 40,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 48,
      discipline: 42,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Lightly armored forest spearmen who hold just long enough for the archers ' +
      'behind them to do their work.',
  },
  'wood-elf-archer': {
    id: 'wood-elf-archer',
    name: 'Wood Elf Archer',
    role: 'ranged',
    origin: { race: 'wood-elves' },
    cost: 55,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 6, damage: 2, range: 7, ammo: 10 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 48,
      discipline: 42,
    },
    moves: 1,
    skill: 50,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Master kiters, always retreating a step as they loose, punishing anything ' +
      'slow enough to give chase.',
  },
  'wood-elf-scout': {
    id: 'wood-elf-scout',
    name: 'Wood Elf Scout',
    role: 'infantry',
    origin: { race: 'wood-elves' },
    cost: 45,
    combat: {
      figures: 360,
      hits: 1,
      melee: { attack: 3, damage: 2, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 45,
      discipline: 35,
    },
    moves: 2,
    skill: 35,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Fleet-footed rangers who screen an army\'s flanks and vanish into the trees ' +
      'before a fight turns against them.',
  },
  'wood-elf-beastmaster': {
    id: 'wood-elf-beastmaster',
    name: 'Wood Elf Beastmaster',
    role: 'infantry',
    origin: { race: 'wood-elves' },
    cost: 65,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 4, damage: 3, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 50,
      discipline: 40,
    },
    moves: 1,
    skill: 38,
    upkeep: { gold: 2, food: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'Fights alongside a bonded forest predator, the pair striking in tandem to ' +
      'overwhelm anything caught between them.',
  },
  'wood-elf-warden': {
    id: 'wood-elf-warden',
    name: 'Wood Elf Warden',
    role: 'infantry',
    origin: { race: 'wood-elves' },
    cost: 85,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 2 },
      armor: 2,
      speed: 2,
      mass: 1,
      morale: 52,
      discipline: 48,
    },
    moves: 1,
    skill: 45,
    upkeep: { gold: 2 },
    abilities: [{ type: 'first-strike' }],
    description:
      'Ambush specialists who let an enemy walk past before striking from cover, ' +
      'landing the first blow before the fight is even seen coming.',
  },

  // ===========================================================================
  // Dusk Elves — Chaos-touched raiders: poison, ambush, hit-and-fade.
  // ===========================================================================
  'dusk-elf-skirmisher': {
    id: 'dusk-elf-skirmisher',
    name: 'Dusk Elf Skirmisher',
    role: 'infantry',
    origin: { race: 'dusk-elves' },
    cost: 40,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 42,
      discipline: 35,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Lightly armed raiders who strike fast and fall back rather than trade blows ' +
      'in the open.',
  },
  'dusk-elf-poison-archer': {
    id: 'dusk-elf-poison-archer',
    name: 'Dusk Elf Poison Archer',
    role: 'ranged',
    origin: { race: 'dusk-elves' },
    cost: 60,
    combat: {
      figures: 320,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 5, damage: 2, range: 6, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 42,
      discipline: 35,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 2 },
    abilities: [{ type: 'poison', strength: 2 }],
    description:
      'Arrows tipped in a slow-working venom — a wound that looks minor at first ' +
      'often proves fatal by the second turn.',
  },
  'dusk-elf-assassin': {
    id: 'dusk-elf-assassin',
    name: 'Dusk Elf Assassin',
    role: 'infantry',
    origin: { race: 'dusk-elves' },
    cost: 95,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 7, damage: 4, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 1,
      morale: 45,
      discipline: 30,
    },
    moves: 1,
    skill: 55,
    upkeep: { gold: 2 },
    abilities: [{ type: 'first-strike' }, { type: 'poison', strength: 2 }],
    description:
      'A handful of blades that strike before the enemy can raise a guard, ' +
      'envenomed steel finishing what the first cut started.',
  },
  'dusk-elf-raider': {
    id: 'dusk-elf-raider',
    name: 'Dusk Elf Raider',
    role: 'cavalry',
    origin: { race: 'dusk-elves' },
    cost: 75,
    combat: {
      figures: 220,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 3,
      morale: 45,
      discipline: 30,
    },
    moves: 2,
    skill: 40,
    upkeep: { gold: 2 },
    abilities: [{ type: 'charge', bonus: 2 }],
    description:
      'Mounted raiders bred for the hit-and-fade tactics their whole culture is ' +
      'built around.',
  },
  'dusk-elf-shadowstalker': {
    id: 'dusk-elf-shadowstalker',
    name: 'Dusk Elf Shadowstalker',
    role: 'infantry',
    origin: { race: 'dusk-elves' },
    cost: 60,
    combat: {
      figures: 300,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 45,
      discipline: 30,
    },
    moves: 2,
    skill: 42,
    upkeep: { gold: 1 },
    abilities: [{ type: 'fear', radius: 1 }],
    description:
      'Unsettling scouts whose mere presence on a flank is enough to fray an ' +
      'enemy\'s nerve before a blow is struck.',
  },

  // ===========================================================================
  // Halflings — many small figures, low damage, surprisingly stubborn morale.
  // ===========================================================================
  'halfling-militia': {
    id: 'halfling-militia',
    name: 'Halfling Militia',
    role: 'infantry',
    origin: { race: 'halflings' },
    cost: 35,
    combat: {
      figures: 440,
      hits: 1,
      melee: { attack: 3, damage: 1, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 55,
      discipline: 40,
    },
    moves: 1,
    skill: 18,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'A great many small, cheerful figures with kitchen-knife courage — ' +
      'individually harmless, but surprisingly slow to break.',
  },
  'halfling-slinger': {
    id: 'halfling-slinger',
    name: 'Halfling Slinger',
    role: 'ranged',
    origin: { race: 'halflings' },
    cost: 38,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 3, damage: 1, range: 5, ammo: 10 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 52,
      discipline: 38,
    },
    moves: 1,
    skill: 22,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Simple slings loosed by the dozen, more volume than power but enough to ' +
      'wear down anything that lingers in range.',
  },
  'halfling-scout': {
    id: 'halfling-scout',
    name: 'Halfling Scout',
    role: 'infantry',
    origin: { race: 'halflings' },
    cost: 28,
    combat: {
      figures: 360,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 48,
      discipline: 30,
    },
    moves: 2,
    skill: 25,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Quick, unassuming foragers who slip past enemy lines to scout ahead, never ' +
      'meant to fight if they can help it.',
  },
  'halfling-hearthguard': {
    id: 'halfling-hearthguard',
    name: 'Halfling Hearthguard',
    role: 'infantry',
    origin: { race: 'halflings' },
    cost: 60,
    combat: {
      figures: 300,
      hits: 2,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 1,
      morale: 65,
      discipline: 50,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 1 },
    abilities: [{ type: 'fearless' }],
    description:
      'Home defenders who, against all sense, simply refuse to run — a ' +
      'stubbornness that has surprised more than one invader.',
  },

  // ===========================================================================
  // Lizardfolk — amphibious swamp ambushers (water rules land later).
  // ===========================================================================
  'lizardfolk-warrior': {
    id: 'lizardfolk-warrior',
    name: 'Lizardfolk Warrior',
    role: 'infantry',
    origin: { race: 'lizardfolk' },
    cost: 42,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 45,
      discipline: 35,
    },
    moves: 1,
    skill: 22,
    upkeep: { gold: 1, food: 1 },
    abilities: [],
    description:
      'Swamp-bred infantry as comfortable wading through mire as marching open ' +
      'ground, holding a line with cold patience.',
  },
  'lizardfolk-venom-hunter': {
    id: 'lizardfolk-venom-hunter',
    name: 'Lizardfolk Venom Hunter',
    role: 'ranged',
    origin: { race: 'lizardfolk' },
    cost: 52,
    combat: {
      figures: 320,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 5, ammo: 6 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 42,
      discipline: 32,
    },
    moves: 1,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [{ type: 'poison', strength: 2 }],
    description:
      'Javelins tipped in milked venom, thrown from the reeds before the target ' +
      'ever sees the thrower.',
  },
  'lizardfolk-raptor-rider': {
    id: 'lizardfolk-raptor-rider',
    name: 'Lizardfolk Raptor Rider',
    role: 'cavalry',
    origin: { race: 'lizardfolk' },
    cost: 72,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 3,
      morale: 45,
      discipline: 30,
    },
    moves: 2,
    skill: 30,
    upkeep: { gold: 2, food: 1 },
    abilities: [{ type: 'charge', bonus: 2 }],
    description:
      'Mounted on swift swamp raptors, these riders close distance faster than ' +
      'anything else the terrain allows.',
  },
  'lizardfolk-ambusher': {
    id: 'lizardfolk-ambusher',
    name: 'Lizardfolk Ambusher',
    role: 'infantry',
    origin: { race: 'lizardfolk' },
    cost: 80,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 6, damage: 3, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 48,
      discipline: 35,
    },
    moves: 1,
    skill: 38,
    upkeep: { gold: 2 },
    abilities: [{ type: 'first-strike' }],
    description:
      'Motionless in the shallows until the moment they strike, landing the first ' +
      'blow before the enemy line can react.',
  },

  // ===========================================================================
  // Gnolls — explosive-breeding pack raiders. Swarm figures, pack-hunter.
  // ===========================================================================
  'gnoll-rusher': {
    id: 'gnoll-rusher',
    name: 'Gnoll Rusher',
    role: 'infantry',
    origin: { race: 'gnolls' },
    cost: 36,
    combat: {
      figures: 120,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 40,
      discipline: 25,
    },
    moves: 1,
    skill: 20,
    upkeep: { gold: 1, food: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'A howling mass of gnolls that closes distance at a dead sprint, hitting ' +
      'hardest when a second pack member is already fighting alongside.',
  },
  'gnoll-hunter': {
    id: 'gnoll-hunter',
    name: 'Gnoll Hunter',
    role: 'ranged',
    origin: { race: 'gnolls' },
    cost: 40,
    combat: {
      figures: 110,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 3, damage: 2, range: 5, ammo: 6 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 38,
      discipline: 25,
    },
    moves: 1,
    skill: 22,
    upkeep: { gold: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'Thrown spears loosed from the pack\'s edge, most effective when flanking ' +
      'alongside another hunter.',
  },
  'gnoll-flesh-render': {
    id: 'gnoll-flesh-render',
    name: 'Gnoll Flesh-Render',
    role: 'infantry',
    origin: { race: 'gnolls' },
    cost: 78,
    combat: {
      figures: 80,
      hits: 2,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 42,
      discipline: 25,
    },
    moves: 1,
    skill: 35,
    upkeep: { gold: 2, food: 1 },
    abilities: [{ type: 'fear', radius: 1 }],
    description:
      'The pack\'s biggest and meanest, whose snarling presence alone can crack a ' +
      'wavering enemy line.',
  },
  'gnoll-packleader': {
    id: 'gnoll-packleader',
    name: 'Gnoll Packleader',
    role: 'infantry',
    origin: { race: 'gnolls' },
    cost: 85,
    combat: {
      figures: 70,
      hits: 2,
      melee: { attack: 6, damage: 3, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 48,
      discipline: 30,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 2 },
    abilities: [{ type: 'inspire', radius: 2, bonus: 8 }, { type: 'pack-hunter' }],
    description:
      'Rallies the pack with howls and bites of its own, driving nearby gnolls ' +
      'into a fiercer, more coordinated frenzy.',
  },
  'gnoll-scavenger': {
    id: 'gnoll-scavenger',
    name: 'Gnoll Scavenger',
    role: 'infantry',
    origin: { race: 'gnolls' },
    cost: 28,
    combat: {
      figures: 120,
      hits: 1,
      melee: { attack: 3, damage: 1, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 35,
      discipline: 20,
    },
    moves: 2,
    skill: 18,
    upkeep: { gold: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'Fast, opportunistic looters who screen a pack\'s advance and strip whatever ' +
      'the fight leaves behind.',
  },

  // ===========================================================================
  // Beastkin — well-rounded Nature-bound hybrids. No standout leg or hole.
  // ===========================================================================
  'beastkin-warrior': {
    id: 'beastkin-warrior',
    name: 'Beastkin Warrior',
    role: 'infantry',
    origin: { race: 'beastkin' },
    cost: 42,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 48,
      discipline: 40,
    },
    moves: 1,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Hybrid tribesfolk fighting with spear and claw alike, a solid and ' +
      'unremarkable line unit.',
  },
  'beastkin-hunter': {
    id: 'beastkin-hunter',
    name: 'Beastkin Hunter',
    role: 'ranged',
    origin: { race: 'beastkin' },
    cost: 46,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 6, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 46,
      discipline: 38,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Bow-hunters raised tracking game long before they ever tracked an enemy, ' +
      'picking targets with practiced patience.',
  },
  'beastkin-strider': {
    id: 'beastkin-strider',
    name: 'Beastkin Strider',
    role: 'infantry',
    origin: { race: 'beastkin' },
    cost: 55,
    combat: {
      figures: 360,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 2,
      morale: 46,
      discipline: 35,
    },
    moves: 2,
    skill: 32,
    upkeep: { gold: 1, food: 1 },
    abilities: [],
    description:
      'Long-limbed runners who outpace almost anything on foot, screening the ' +
      'tribe\'s flanks.',
  },
  'beastkin-packrunner': {
    id: 'beastkin-packrunner',
    name: 'Beastkin Packrunner',
    role: 'infantry',
    origin: { race: 'beastkin' },
    cost: 48,
    combat: {
      figures: 100,
      hits: 1,
      melee: { attack: 5, damage: 2, reach: 1 },
      armor: 0,
      speed: 3,
      mass: 1,
      morale: 45,
      discipline: 32,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 1, food: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'Wolf-kin who fight best in numbers, snapping harder when another ' +
      'packrunner is already in the fray.',
  },
  'beastkin-totem-guardian': {
    id: 'beastkin-totem-guardian',
    name: 'Beastkin Totem Guardian',
    role: 'infantry',
    origin: { race: 'beastkin' },
    cost: 90,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 55,
      discipline: 45,
    },
    moves: 1,
    skill: 40,
    upkeep: { gold: 2, food: 1 },
    abilities: [{ type: 'regeneration', perTick: 1 }],
    description:
      'Bound to a totem spirit that knits wounds shut even mid-battle, letting ' +
      'this guardian keep fighting long after a mortal wound would drop it.',
  },

  // ===========================================================================
  // Draconians — Chaos-touched dragon-kin. Limited flying, one breath-weapon elite.
  // ===========================================================================
  'draconian-legionnaire': {
    id: 'draconian-legionnaire',
    name: 'Draconian Legionnaire',
    role: 'infantry',
    origin: { race: 'draconians' },
    cost: 50,
    combat: {
      figures: 400,
      hits: 1,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 50,
      discipline: 48,
    },
    moves: 1,
    skill: 30,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Scaled, disciplined infantry drilled in tight formation — the backbone of ' +
      'any draconian legion.',
  },
  'draconian-scale-archer': {
    id: 'draconian-scale-archer',
    name: 'Draconian Scale Archer',
    role: 'ranged',
    origin: { race: 'draconians' },
    cost: 52,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 3, damage: 2, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 6, ammo: 8 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 46,
      discipline: 40,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Draconian marksmen whose scaled hide lets them stand firm at range instead ' +
      'of falling back.',
  },
  'draconian-wingguard': {
    id: 'draconian-wingguard',
    name: 'Draconian Wingguard',
    role: 'infantry',
    origin: { race: 'draconians' },
    cost: 80,
    combat: {
      figures: 300,
      hits: 1,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 48,
      discipline: 40,
    },
    moves: 2,
    skill: 35,
    upkeep: { gold: 2, food: 1 },
    abilities: [{ type: 'flying' }],
    description:
      'Rare fliers among the draconians, able to cross terrain and strike from ' +
      'above where ground troops cannot follow.',
  },
  'draconian-flamecaller': {
    id: 'draconian-flamecaller',
    name: 'Draconian Flamecaller',
    role: 'infantry',
    origin: { race: 'draconians' },
    cost: 130,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 2,
      morale: 55,
      discipline: 45,
    },
    moves: 1,
    skill: 42,
    upkeep: { gold: 3, food: 1 },
    abilities: [{ type: 'breath-weapon', damage: 8, range: 3, cooldown: 3 }],
    description:
      'An elite bearing true dragon-blood, capable of loosing a searing cone of ' +
      'breath that can gut an entire enemy formation in one blast.',
  },

  // ===========================================================================
  // Nomads — horse-borne plains traders. Mobility and skirmish, thin heavy war.
  // ===========================================================================
  'nomad-spearman': {
    id: 'nomad-spearman',
    name: 'Nomad Spearman',
    role: 'infantry',
    origin: { race: 'nomads' },
    cost: 40,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 46,
      discipline: 38,
    },
    moves: 1,
    skill: 26,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Dismounted plainsfolk holding a line only long enough for the horse ' +
      'warriors to come around.',
  },
  'nomad-horse-archer': {
    id: 'nomad-horse-archer',
    name: 'Nomad Horse Archer',
    role: 'cavalry',
    origin: { race: 'nomads' },
    cost: 75,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 3, damage: 2, reach: 1 },
      ranged: { attack: 5, damage: 2, range: 6, ammo: 8 },
      armor: 1,
      speed: 4,
      mass: 3,
      morale: 48,
      discipline: 35,
    },
    moves: 2,
    skill: 38,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Loosing arrows at a full gallop, wheeling away before an enemy can ever ' +
      'close the distance.',
  },
  'nomad-raider': {
    id: 'nomad-raider',
    name: 'Nomad Raider',
    role: 'cavalry',
    origin: { race: 'nomads' },
    cost: 80,
    combat: {
      figures: 220,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 4,
      mass: 4,
      morale: 48,
      discipline: 35,
    },
    moves: 2,
    skill: 34,
    upkeep: { gold: 2 },
    abilities: [{ type: 'charge', bonus: 3 }],
    description:
      'Fast horse warriors whose charge is timed to catch an enemy already ' +
      'reeling from arrow fire.',
  },
  'nomad-scout': {
    id: 'nomad-scout',
    name: 'Nomad Scout',
    role: 'cavalry',
    origin: { race: 'nomads' },
    cost: 45,
    combat: {
      figures: 200,
      hits: 1,
      melee: { attack: 3, damage: 1, reach: 1 },
      armor: 0,
      speed: 5,
      mass: 2,
      morale: 42,
      discipline: 28,
    },
    moves: 2,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Outriders who range far ahead of the main camp, reporting back long before ' +
      'any threat arrives.',
  },

  // ===========================================================================
  // Barbarians — tribal warclans, built for war. High morale, low discipline.
  // ===========================================================================
  'barbarian-warrior': {
    id: 'barbarian-warrior',
    name: 'Barbarian Warrior',
    role: 'infantry',
    origin: { race: 'barbarians' },
    cost: 45,
    combat: {
      figures: 420,
      hits: 1,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 60,
      discipline: 30,
    },
    moves: 1,
    skill: 25,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Roaring, axe-swinging clansfolk who fight with more heart than formation — ' +
      'devastating in a charge, ragged if the fight drags on.',
  },
  'barbarian-hunter': {
    id: 'barbarian-hunter',
    name: 'Barbarian Hunter',
    role: 'ranged',
    origin: { race: 'barbarians' },
    cost: 42,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 3, damage: 2, reach: 1 },
      ranged: { attack: 3, damage: 2, range: 5, ammo: 6 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 55,
      discipline: 28,
    },
    moves: 1,
    skill: 24,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Thrown axes and javelins loosed before the warriors close, more instinct ' +
      'than drill.',
  },
  'barbarian-raider': {
    id: 'barbarian-raider',
    name: 'Barbarian Raider',
    role: 'cavalry',
    origin: { race: 'barbarians' },
    cost: 75,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 4,
      morale: 58,
      discipline: 28,
    },
    moves: 2,
    skill: 30,
    upkeep: { gold: 2 },
    abilities: [{ type: 'charge', bonus: 3 }],
    description:
      'Mounted clan raiders whose charge hits like the warcry that precedes it — ' +
      'loud, fast, and hard to stop.',
  },
  'barbarian-berserker': {
    id: 'barbarian-berserker',
    name: 'Barbarian Berserker',
    role: 'infantry',
    origin: { race: 'barbarians' },
    cost: 90,
    combat: {
      figures: 280,
      hits: 2,
      melee: { attack: 7, damage: 4, reach: 1 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 65,
      discipline: 20,
    },
    moves: 1,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: [{ type: 'first-strike' }],
    description:
      'Whipped into a battle-fury that lands the first killing blow before an ' +
      'enemy can raise a guard, heedless of any formation around it.',
  },

  // ===========================================================================
  // Chitinfolk — hive-minded insectoid swarm. No cavalry: the hive does not ride.
  // ===========================================================================
  'chitinfolk-drone': {
    id: 'chitinfolk-drone',
    name: 'Chitinfolk Drone',
    role: 'infantry',
    origin: { race: 'chitinfolk' },
    cost: 34,
    combat: {
      figures: 120,
      hits: 1,
      melee: { attack: 3, damage: 2, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 35,
      discipline: 45,
    },
    moves: 1,
    skill: 18,
    upkeep: { gold: 1 },
    abilities: [{ type: 'pack-hunter' }],
    description:
      'A tireless hive-swarm that presses forward as a single coordinated body, ' +
      'each drone fighting fiercer with another close at hand.',
  },
  'chitinfolk-spitter': {
    id: 'chitinfolk-spitter',
    name: 'Chitinfolk Spitter',
    role: 'ranged',
    origin: { race: 'chitinfolk' },
    cost: 44,
    combat: {
      figures: 100,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 1, range: 5, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 32,
      discipline: 42,
    },
    moves: 1,
    skill: 22,
    upkeep: { gold: 1 },
    abilities: [{ type: 'poison', strength: 1 }],
    description:
      'Corrosive spit that scars through armor slowly, fired from the rear ranks ' +
      'of the swarm.',
  },
  'chitinfolk-warrior-caste': {
    id: 'chitinfolk-warrior-caste',
    name: 'Chitinfolk Warrior-Caste',
    role: 'infantry',
    origin: { race: 'chitinfolk' },
    cost: 85,
    combat: {
      figures: 70,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 4,
      speed: 1,
      mass: 2,
      morale: 42,
      discipline: 55,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Bred specifically for war, armored in carapace thicker than any forged ' +
      'plate.',
  },
  'chitinfolk-stalker': {
    id: 'chitinfolk-stalker',
    name: 'Chitinfolk Stalker',
    role: 'infantry',
    origin: { race: 'chitinfolk' },
    cost: 48,
    combat: {
      figures: 110,
      hits: 1,
      melee: { attack: 4, damage: 2, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 1,
      morale: 35,
      discipline: 40,
    },
    moves: 2,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Many-legged skirmishers whose speed lets the hive scout and screen without ' +
      'ever needing a mount.',
  },

  // ===========================================================================
  // Gnomes — inventive tinkerers, poor and reluctant soldiers.
  // ===========================================================================
  'gnome-militia': {
    id: 'gnome-militia',
    name: 'Gnome Militia',
    role: 'infantry',
    origin: { race: 'gnomes' },
    cost: 25,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 35,
      discipline: 30,
    },
    moves: 1,
    skill: 15,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Reluctant conscripts armed more out of necessity than any taste for war — ' +
      'the weakest line troops in Meridia, and they know it.',
  },
  'gnome-sling-tinkerer': {
    id: 'gnome-sling-tinkerer',
    name: 'Gnome Sling-Tinkerer',
    role: 'ranged',
    origin: { race: 'gnomes' },
    cost: 32,
    combat: {
      figures: 320,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 3, damage: 1, range: 6, ammo: 8 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 35,
      discipline: 30,
    },
    moves: 1,
    skill: 20,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'A sling rigged with a clockwork release mechanism, more clever than ' +
      'powerful.',
  },
  'gnome-illusion-guard': {
    id: 'gnome-illusion-guard',
    name: 'Gnome Illusion Guard',
    role: 'infantry',
    origin: { race: 'gnomes' },
    cost: 60,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 3, damage: 2, reach: 1 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 40,
      discipline: 35,
    },
    moves: 1,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: [{ type: 'fear', radius: 1 }],
    description:
      'Sorcerous trickery that makes this small guard seem far more numerous and ' +
      'dangerous than it is, unsettling anything that gets close.',
  },
  'gnome-clockwork-scout': {
    id: 'gnome-clockwork-scout',
    name: 'Gnome Clockwork Scout',
    role: 'infantry',
    origin: { race: 'gnomes' },
    cost: 40,
    combat: {
      figures: 300,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      armor: 1,
      speed: 4,
      mass: 1,
      morale: 35,
      discipline: 28,
    },
    moves: 2,
    skill: 25,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'A gnome astride a small mechanical runner, faster and more reliable than ' +
      'the gnome\'s own two legs.',
  },

  // ===========================================================================
  // Ogres — few figures, huge hits/mass/damage, low discipline. No archers.
  // ===========================================================================
  'ogre-brute': {
    id: 'ogre-brute',
    name: 'Ogre Brute',
    role: 'infantry',
    origin: { race: 'ogres' },
    cost: 70,
    combat: {
      figures: 70,
      hits: 9,
      melee: { attack: 5, damage: 6, reach: 1 },
      armor: 2,
      speed: 1,
      mass: 5,
      morale: 40,
      discipline: 20,
    },
    moves: 1,
    skill: 18,
    upkeep: { gold: 2, food: 1 },
    abilities: [],
    description:
      'A handful of towering figures whose single blow can end a fight — ' +
      'undisciplined, but nothing enjoys standing in front of one.',
  },
  'ogre-crusher': {
    id: 'ogre-crusher',
    name: 'Ogre Crusher',
    role: 'infantry',
    origin: { race: 'ogres' },
    cost: 110,
    combat: {
      figures: 55,
      hits: 12,
      melee: { attack: 6, damage: 7, reach: 1 },
      armor: 2,
      speed: 1,
      mass: 6,
      morale: 42,
      discipline: 20,
    },
    moves: 1,
    skill: 25,
    upkeep: { gold: 3, food: 1 },
    abilities: [{ type: 'trample' }],
    description:
      'Bigger and meaner than the common brute, able to shrug off a killing blow ' +
      'and keep smashing forward through the figure that dealt it.',
  },
  'ogre-siege-breaker': {
    id: 'ogre-siege-breaker',
    name: 'Ogre Siege-Breaker',
    role: 'siege',
    origin: { race: 'ogres' },
    cost: 90,
    combat: {
      figures: 45,
      hits: 11,
      melee: { attack: 4, damage: 8, reach: 1 },
      armor: 2,
      speed: 1,
      mass: 6,
      morale: 38,
      discipline: 18,
    },
    moves: 1,
    skill: 15,
    upkeep: { gold: 2, food: 1 },
    abilities: [],
    description:
      'Muscle applied directly to gates and walls — no finesse, just enough raw ' +
      'strength to make a fortification\'s defenses moot.',
  },
  'ogre-warlord': {
    id: 'ogre-warlord',
    name: 'Ogre Warlord',
    role: 'infantry',
    origin: { race: 'ogres' },
    cost: 125,
    combat: {
      figures: 40,
      hits: 15,
      melee: { attack: 6, damage: 7, reach: 1 },
      armor: 3,
      speed: 1,
      mass: 6,
      morale: 45,
      discipline: 25,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 3, food: 1 },
    abilities: [{ type: 'fear', radius: 2 }],
    description:
      'A towering, terrifying leader whose mere approach is enough to break a ' +
      'wavering enemy line before a blow is struck.',
  },

  // ===========================================================================
  // Centaurfolk — the cavalry IS the race. No plain infantry: they never dismount.
  // ===========================================================================
  'centaur-guardian': {
    id: 'centaur-guardian',
    name: 'Centaur Guardian',
    role: 'cavalry',
    origin: { race: 'centaurfolk' },
    cost: 55,
    combat: {
      figures: 240,
      hits: 2,
      melee: { attack: 4, damage: 2, reach: 2 },
      armor: 1,
      speed: 3,
      mass: 2,
      morale: 50,
      discipline: 45,
    },
    moves: 2,
    skill: 30,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Horse-bodied infantry that never has to worry about outrunning its own ' +
      'charge, holding ground with spears leveled.',
  },
  'centaur-archer': {
    id: 'centaur-archer',
    name: 'Centaur Archer',
    role: 'ranged',
    origin: { race: 'centaurfolk' },
    cost: 60,
    combat: {
      figures: 330,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 5, damage: 2, range: 6, ammo: 8 },
      armor: 0,
      speed: 3,
      mass: 2,
      morale: 48,
      discipline: 40,
    },
    moves: 2,
    skill: 35,
    upkeep: { gold: 2 },
    abilities: [],
    description:
      'Fires from horseback at a full gallop, retreating a stride with every shot ' +
      'loosed.',
  },
  'centaur-lancer': {
    id: 'centaur-lancer',
    name: 'Centaur Lancer',
    role: 'cavalry',
    origin: { race: 'centaurfolk' },
    cost: 90,
    combat: {
      figures: 220,
      hits: 3,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 5,
      mass: 5,
      morale: 52,
      discipline: 42,
    },
    moves: 2,
    skill: 38,
    upkeep: { gold: 3 },
    abilities: [{ type: 'charge', bonus: 4 }],
    description:
      'The centaurfolk\'s signature: an unbroken charge with the mass and speed of ' +
      'a warhorse guided by a warrior\'s own hands.',
  },
  'centaur-chieftain': {
    id: 'centaur-chieftain',
    name: 'Centaur Chieftain',
    role: 'cavalry',
    origin: { race: 'centaurfolk' },
    cost: 110,
    combat: {
      figures: 200,
      hits: 3,
      melee: { attack: 6, damage: 4, reach: 1 },
      armor: 2,
      speed: 4,
      mass: 4,
      morale: 58,
      discipline: 50,
    },
    moves: 2,
    skill: 45,
    upkeep: { gold: 3 },
    abilities: [{ type: 'inspire', radius: 3, bonus: 10 }],
    description:
      'A herd-leader whose rallying cry steadies every centaur nearby mid-charge.',
  },

  // ===========================================================================
  // Tidefolk — amphibious coastal folk, non-militant by nature (water rules later).
  // ===========================================================================
  'tidefolk-militia': {
    id: 'tidefolk-militia',
    name: 'Tidefolk Militia',
    role: 'infantry',
    origin: { race: 'tidefolk' },
    cost: 38,
    combat: {
      figures: 380,
      hits: 1,
      melee: { attack: 3, damage: 2, reach: 2 },
      armor: 1,
      speed: 2,
      mass: 1,
      morale: 42,
      discipline: 35,
    },
    moves: 1,
    skill: 20,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Coastal levies, competent but reluctant soldiers who would rather be ' +
      'fishing than fighting.',
  },
  'tidefolk-harpooner': {
    id: 'tidefolk-harpooner',
    name: 'Tidefolk Harpooner',
    role: 'ranged',
    origin: { race: 'tidefolk' },
    cost: 45,
    combat: {
      figures: 320,
      hits: 1,
      melee: { attack: 2, damage: 1, reach: 1 },
      ranged: { attack: 4, damage: 2, range: 5, ammo: 6 },
      armor: 0,
      speed: 2,
      mass: 1,
      morale: 40,
      discipline: 32,
    },
    moves: 1,
    skill: 25,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Barbed harpoons meant for sharks and sea-beasts, repurposed for anything ' +
      'that gets too close on land.',
  },
  'tidefolk-tideguard': {
    id: 'tidefolk-tideguard',
    name: 'Tidefolk Tideguard',
    role: 'infantry',
    origin: { race: 'tidefolk' },
    cost: 75,
    combat: {
      figures: 260,
      hits: 2,
      melee: { attack: 5, damage: 3, reach: 1 },
      armor: 2,
      speed: 2,
      mass: 1,
      morale: 46,
      discipline: 40,
    },
    moves: 1,
    skill: 32,
    upkeep: { gold: 2 },
    abilities: [{ type: 'regeneration', perTick: 1 }],
    description:
      'Amphibious defenders whose bodies knit shut minor wounds almost as fast as ' +
      'they\'re dealt — full water combat comes later, but the resilience is ' +
      'already there.',
  },
  'tidefolk-current-runner': {
    id: 'tidefolk-current-runner',
    name: 'Tidefolk Current-Runner',
    role: 'infantry',
    origin: { race: 'tidefolk' },
    cost: 42,
    combat: {
      figures: 340,
      hits: 1,
      melee: { attack: 3, damage: 1, reach: 1 },
      armor: 0,
      speed: 4,
      mass: 1,
      morale: 40,
      discipline: 28,
    },
    moves: 2,
    skill: 28,
    upkeep: { gold: 1 },
    abilities: [],
    description:
      'Fast, amphibious scouts equally at home sprinting a shoreline or wading a ' +
      'tidal flat.',
  },
};
