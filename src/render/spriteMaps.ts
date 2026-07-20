/**
 * Sprite mapping tables + selectors.
 *
 * The sim models 30 terrain ids and a 150-strong unit roster, but the generated
 * spritesheets draw a curated subset: 13 terrains, 14 combat archetypes
 * (assets/battle.json), 3 city tiers, 3 temple tiers, and a lair. These tables
 * and selectors map every sim id to the closest drawn sprite so the renderer
 * never has a hole.
 *
 * Unit sprites are chosen by ARCHETYPE, not by id: `battleSpriteFor(def)`
 * inspects a unit's combat profile and picks one of the 14 battle-sheet
 * archetypes. Both the tactical battle viewer and the strategic map use it, so
 * a unit reads the same everywhere and new content never needs a sprite added.
 *
 * Pure data + tiny pure selectors — safe to unit-test without Pixi.
 */

import type { TerrainId } from '@sim/map/tiles';
import type { UnitDef, AbilityDef } from '@sim/types';

/** Ids actually drawn in assets/terrain.png (see assets/terrain.json). */
export type DrawnTerrainId =
  | 'grassland'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'ocean'
  | 'shore'
  | 'desert'
  | 'swamp'
  | 'ashen-waste'
  | 'bonefield'
  | 'gloom-forest'
  | 'radiant-plain'
  | 'crystal-forest';

/** The 14 combat archetypes drawn in assets/battle.png (see assets/battle.json). */
export type BattleSpriteId =
  | 'spearman'
  | 'swordsman'
  | 'archer'
  | 'crossbowman'
  | 'cavalry'
  | 'brute'
  | 'swarm'
  | 'skirmisher'
  | 'flyer'
  | 'mage'
  | 'undead'
  | 'celestial'
  | 'beast'
  | 'dragon';

/** Every archetype id, for tests and validation. */
export const BATTLE_SPRITE_IDS: readonly BattleSpriteId[] = [
  'spearman', 'swordsman', 'archer', 'crossbowman', 'cavalry', 'brute',
  'swarm', 'skirmisher', 'flyer', 'mage', 'undead', 'celestial', 'beast', 'dragon',
];

/**
 * Every one of the 30 sim TerrainIds → the closest drawn tile. The 13 tiles
 * that have their own art map to themselves; the remaining 17 (dimension and a
 * few world terrains) borrow the nearest thematic drawn tile until dedicated
 * dimension tiles are authored.
 */
export const TERRAIN_SPRITE_MAP: Record<TerrainId, DrawnTerrainId> = {
  ocean: 'ocean',
  shore: 'shore',
  grassland: 'grassland',
  forest: 'forest',
  hills: 'hills',
  mountains: 'mountains',
  desert: 'desert',
  swamp: 'swamp',
  tundra: 'hills',
  'ashen-waste': 'ashen-waste',
  bonefield: 'bonefield',
  'gloom-forest': 'gloom-forest',
  'radiant-plain': 'radiant-plain',
  'crystal-forest': 'crystal-forest',
  'aurora-peaks': 'mountains',
  'cloud-shoal': 'radiant-plain',
  'gilded-reef': 'shore',
  'sanctum-spire': 'crystal-forest',
  'bone-marsh': 'swamp',
  'blood-fen': 'swamp',
  blackspire: 'ashen-waste',
  'cinder-flat': 'desert',
  'magma-field': 'desert',
  'brimstone-spire': 'mountains',
  'vine-tangle': 'forest',
  mossmire: 'swamp',
  'canopy-spire': 'gloom-forest',
  'mirror-flat': 'crystal-forest',
  'prism-shard': 'crystal-forest',
  'starlit-void': 'hills',
};

/**
 * Battlefield ground tint (a flat RGB) keyed by the strategic terrain the
 * battle is fought on. The tactical field is a small abstract arena, so rather
 * than tile terrain art we wash the ground in a terrain-appropriate colour and
 * mark obstacles/cover on top. Every one of the 30 TerrainIds resolves via
 * `battleGroundColor`.
 */
const GROUND_TINTS: Partial<Record<TerrainId, number>> = {
  grassland: 0x3f5a2c,
  forest: 0x27401f,
  'vine-tangle': 0x243a1c,
  mossmire: 0x33422a,
  hills: 0x5a5230,
  mountains: 0x4b463f,
  'aurora-peaks': 0x565f6e,
  desert: 0x8a744a,
  'cinder-flat': 0x5c4636,
  'magma-field': 0x5a2f22,
  'brimstone-spire': 0x4a3630,
  swamp: 0x34402e,
  'bone-marsh': 0x424536,
  'blood-fen': 0x4a2f2c,
  tundra: 0x6b7078,
  'ashen-waste': 0x3d3833,
  bonefield: 0x565043,
  blackspire: 0x2c2a30,
  'gloom-forest': 0x24282a,
  'radiant-plain': 0x6f7a54,
  'crystal-forest': 0x3f5560,
  'mirror-flat': 0x51606a,
  'prism-shard': 0x4a4b66,
  'starlit-void': 0x22243a,
  'cloud-shoal': 0x6a7488,
  'gilded-reef': 0x5f6a55,
  'sanctum-spire': 0x62687a,
  'canopy-spire': 0x223326,
  ocean: 0x24384f,
  shore: 0x5b6a63,
};

export function battleGroundColor(terrain: TerrainId): number {
  return GROUND_TINTS[terrain] ?? 0x40402f;
}

// ---------------------------------------------------------------------------
// Unit archetype selection
// ---------------------------------------------------------------------------

function has(abilities: readonly AbilityDef[], type: AbilityDef['type']): boolean {
  return abilities.some((a) => a.type === type);
}

/**
 * Hand-picked overrides for units whose FANTASY the numeric rules can't infer
 * — animal packs and lone beasts read wrong as generic infantry. Kept small on
 * purpose; everything else flows through the archetype rules below.
 */
const SPRITE_OVERRIDES: Record<string, BattleSpriteId> = {
  // Beast packs: many small four-legged bodies.
  'giant-spiders': 'swarm',
  'wolf-pack': 'swarm',
  'dire-wolf': 'swarm',
  // Lone quadruped beasts.
  'great-boar': 'beast',
  hellhound: 'beast',
  // Settlers are unarmed civilians on the move — the light "skirmisher"
  // silhouette reads as non-line-infantry and keeps them distinct from troops
  // on the strategic map (the escort-me signal that matters for gameplay).
  settler: 'skirmisher',
};

/**
 * Chooses a battle-sheet archetype for a unit by inspecting its combat profile.
 * Total over the whole roster (always returns a real BattleSpriteId).
 *
 * Decision order (first match wins) — most identity-defining traits first:
 *   1. explicit override (beast packs, settlers)
 *   2. undead ability        → undead   (skeletons, zombies, wraiths)
 *   3. Life-school summon     → celestial (angels, guardian spirits, archons)
 *   4. dragonish: a lone breath-weapon creature → dragon (drakes, elder dragons)
 *   5. flying                → flyer     (wyverns, djinn, winged riders)
 *   6. mounted: role cavalry, or speed≥4 & mass≥3 → cavalry
 *   7. beast-pack: 7+ figures with pack-hunter → swarm (hives, gnoll packs)
 *   8. fast light foot: infantry, speed≥4, armor≤1, no bow → skirmisher
 *   9. fragile support caster: aura + weak melee, ≤3 figures → mage
 *  10. reach-2 polearms      → spearman
 *  11. ranged: range≥6 → archer, else → crossbowman
 *  12. small heavy bruiser: ≤3 figures, mass≥2, no bow → brute
 *  13. everything else       → swordsman (the generic line-infantry silhouette)
 */
export function battleSpriteFor(def: UnitDef): BattleSpriteId {
  const override = SPRITE_OVERRIDES[def.id];
  if (override) return override;

  const c = def.combat;
  const ab = def.abilities;
  const ranged = c.ranged;

  // 2. Undead.
  if (has(ab, 'undead')) return 'undead';

  // 3. Life-school summons — celestial radiance.
  if ('school' in def.origin && def.origin.school === 'life') return 'celestial';

  // 4. Dragonish: a single-body creature that breathes.
  if (has(ab, 'breath-weapon') && c.figures <= 1) return 'dragon';

  // 5. Flying.
  if (has(ab, 'flying')) return 'flyer';

  // 6. Mounted / cavalry.
  if (def.role === 'cavalry' || (c.speed >= 4 && c.mass >= 3)) return 'cavalry';

  // 7. Beast-pack swarm (hive drones, wolfish packs).
  if (c.figures >= 7 && has(ab, 'pack-hunter')) return 'swarm';

  // 8. Fast light infantry — skirmishers/scouts.
  if (def.role === 'infantry' && c.speed >= 4 && c.armor <= 1 && !ranged) return 'skirmisher';

  // 9. Fragile support caster (robed): meaningful aura, negligible melee.
  if (
    !ranged &&
    c.armor <= 1 &&
    c.melee.damage <= 2 &&
    c.figures <= 3 &&
    (has(ab, 'holy-aura') || has(ab, 'inspire') || has(ab, 'fear'))
  ) {
    return 'mage';
  }

  // 10. Reach-2 spears/pikes.
  if (c.melee.reach === 2) return 'spearman';

  // 11. Ranged.
  if (ranged) return ranged.range >= 6 ? 'archer' : 'crossbowman';

  // 12. Small heavy bruiser.
  if (c.figures <= 3 && c.mass >= 2) return 'brute';

  // 13. Generic line infantry.
  return 'swordsman';
}

export type CitySpriteId = 'city-village' | 'city-town' | 'city-large';

/**
 * City sprite tier by population (MoM-style thresholds):
 * <5 village, 5–8 town, 9+ large.
 */
export function citySpriteFor(population: number): CitySpriteId {
  if (population < 5) return 'city-village';
  if (population < 9) return 'city-town';
  return 'city-large';
}
