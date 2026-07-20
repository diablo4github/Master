/**
 * Sprite mapping tables.
 *
 * The sim models 30 terrain ids and a growing unit roster, but the generated
 * spritesheets currently draw only a subset (13 terrains, 5 units, 3 city
 * tiers, 3 temple tiers). These tables map every sim id to the closest drawn
 * sprite so the renderer never has a hole. Dedicated art for the exotic
 * dimension terrains and the militia will replace the fallbacks noted below.
 *
 * Pure data + tiny pure selectors — safe to unit-test without Pixi.
 */

import type { TerrainId } from '@sim/map/tiles';

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

/** Ids actually drawn in assets/units.png (see assets/units.json). */
export type DrawnUnitId =
  | 'orc-warrior'
  | 'human-spearman'
  | 'skeleton'
  | 'angel'
  | 'settler';

/**
 * Every one of the 30 sim TerrainIds → the closest drawn tile. The 13 tiles
 * that have their own art map to themselves; the remaining 17 (dimension and a
 * few world terrains) borrow the nearest thematic drawn tile until dedicated
 * dimension tiles are authored:
 *   - dark / death terrain  → ashen-waste / bonefield / gloom-forest family
 *   - light terrain         → radiant-plain / crystal-forest family
 *   - chaos / fire terrain   → desert / mountains (scorched, molten)
 *   - nature / growth terrain → forest / swamp / grassland
 *   - sorcery / aether terrain → crystal-forest / hills (crystalline, faceted)
 *   - tundra / aurora-peaks   → mountains / hills (no snow tile yet)
 */
export const TERRAIN_SPRITE_MAP: Record<TerrainId, DrawnTerrainId> = {
  // Universal water — drawn.
  ocean: 'ocean',
  shore: 'shore',
  // Meridia — all drawn except tundra.
  grassland: 'grassland',
  forest: 'forest',
  hills: 'hills',
  mountains: 'mountains',
  desert: 'desert',
  swamp: 'swamp',
  tundra: 'hills', // fallback: no dedicated snow/tundra tile yet.
  // Umbra (dark world) — drawn.
  'ashen-waste': 'ashen-waste',
  bonefield: 'bonefield',
  'gloom-forest': 'gloom-forest',
  // Lumina (light world) — radiant-plain / crystal-forest drawn; peaks borrow.
  'radiant-plain': 'radiant-plain',
  'crystal-forest': 'crystal-forest',
  'aurora-peaks': 'mountains', // fallback: luminous peaks → mountains for now.
  // Empyrean (Life dimension) → radiant / crystal family.
  'cloud-shoal': 'radiant-plain',
  'gilded-reef': 'shore',
  'sanctum-spire': 'crystal-forest',
  // Charnel Deep (Death dimension) → dark-world family.
  'bone-marsh': 'swamp',
  'blood-fen': 'swamp',
  blackspire: 'ashen-waste',
  // Maelstrom (Chaos dimension) → scorched / molten family.
  'cinder-flat': 'desert',
  'magma-field': 'desert',
  'brimstone-spire': 'mountains',
  // Wildroot (Nature dimension) → verdant family.
  'vine-tangle': 'forest',
  mossmire: 'swamp',
  'canopy-spire': 'gloom-forest',
  // Aether (Sorcery dimension) → crystalline / faceted family.
  'mirror-flat': 'crystal-forest',
  'prism-shard': 'crystal-forest',
  'starlit-void': 'hills',
};

/**
 * Unit defId → drawn unit sprite. Every unit in the roster maps here.
 * 'militia' has no dedicated sprite, so it borrows the human-spearman art (a
 * generic spear-and-shield levy, which fits) until its own is drawn.
 */
export const UNIT_SPRITE_MAP: Record<string, DrawnUnitId> = {
  settler: 'settler',
  militia: 'human-spearman', // fallback: no militia sprite yet; a levy spearman reads correctly.
  'orc-warrior': 'orc-warrior',
  'human-spearman': 'human-spearman',
  skeleton: 'skeleton',
  angel: 'angel',
};

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
