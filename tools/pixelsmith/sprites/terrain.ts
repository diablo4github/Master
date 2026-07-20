// 24x24 map tiles. Checkerboard (Bayer) dither is used sparingly — small
// accent patches for subtle texture, not a full-tile wash — in favor of
// distinct, individually-shaded features (tree crowns, ridgelines, wave
// crests, bone piles, crystal clusters, ...) built from shadeDisc and hand
// -plotted shapes. Every feature cluster is placed off-center and
// asymmetrically within its tile so the composition doesn't read as an
// obvious repeating grid when tiled edge-to-edge. Dithers are keyed on
// absolute in-tile coordinates, so any texture that remains stays
// continuous across tile boundaries. Light source is consistently top-left,
// matching every other sprite set in the pipeline.
import type { Sprite } from '../sprite';
import { compileSprite, ditherRect, fillRect, makeGrid, plot, setPixel, shadeDisc, type Grid } from '../pixels';
import { DEATH, EARTH, FOREST, GRASS, LIFE, SAND, SNOW, STONE, SWAMP, WATER } from '../colors';

const SIZE = 24;

function tile(id: string, colors: Record<string, string>, grid: Grid): Sprite {
  return compileSprite(id, SIZE, grid, colors);
}

function grassland(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  // Tiny corner sheen accents — texture, not a grid.
  ditherRect(g, 0, 0, 2, 2, 'm', 'l', 0.3);
  ditherRect(g, 21, 21, 23, 23, 'm', 'l', 0.3);
  // Scattered grass-blade tufts (small asymmetric clusters, not a grid).
  plot(g, [[3, 5], [3, 4], [4, 5]], 'd');
  plot(g, [[9, 3], [10, 3], [9, 2]], 'd');
  plot(g, [[15, 8], [16, 8], [15, 7]], 'd');
  plot(g, [[20, 4], [20, 3]], 'd');
  plot(g, [[6, 12], [7, 12], [6, 11]], 'd');
  plot(g, [[13, 15], [14, 15], [13, 14]], 'd');
  plot(g, [[19, 17], [19, 16]], 'd');
  plot(g, [[2, 18], [3, 18], [2, 17]], 'd');
  plot(g, [[10, 20], [11, 20], [10, 19]], 'd');
  plot(g, [[17, 21], [18, 21]], 'd');
  plot(g, [[4, 4], [9, 1], [16, 6], [7, 10], [14, 13]], 'l');
  return tile('grassland', { m: GRASS.mid, l: GRASS.light, d: GRASS.dark }, g);
}

function forest(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'fs');
  ditherRect(g, 0, 20, 2, 22, 'fs', 'fl', 0.3);
  ditherRect(g, 20, 20, 22, 22, 'fs', 'fl', 0.25);

  // Large tree, lower-left.
  fillRect(g, 4, 17, 5, 22, 't');
  setPixel(g, 5, 22, 'td');
  shadeDisc(g, 5, 12, 5, 'c', 'h', 's');
  // Medium tree, upper-right.
  fillRect(g, 17, 6, 18, 10, 't');
  setPixel(g, 18, 10, 'td');
  shadeDisc(g, 17, 3, 4, 'c', 'h', 's');
  // Small tree, right-of-center, lower.
  fillRect(g, 14, 18, 14, 21, 't');
  shadeDisc(g, 14, 16, 3, 'c', 'h', 's');
  // Low bush accent, far right.
  shadeDisc(g, 21, 15, 2, 'c', 'h', 's');
  return tile(
    'forest',
    { fs: GRASS.shadow, fl: GRASS.dark, t: FOREST.trunk, td: FOREST.trunkDark, c: FOREST.canopyMid, h: FOREST.canopyLight, s: FOREST.canopyDark },
    g,
  );
}

function hills(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'g');
  ditherRect(g, 0, 0, 2, 2, 'g', 'd', 0.3);
  ditherRect(g, 21, 0, 23, 2, 'g', 'd', 0.25);
  // Rolling mounds, varied size, asymmetric.
  shadeDisc(g, 6, 18, 7, 'b', 'h', 's');
  shadeDisc(g, 17, 8, 5, 'b', 'h', 's');
  shadeDisc(g, 20, 19, 3, 'b', 'h', 's');
  // Loose stones scattered on open ground.
  plot(g, [[2, 10], [21, 4], [11, 21], [3, 3]], 'd');
  return tile('hills', { g: EARTH.mid, d: EARTH.dark, b: EARTH.light, h: SAND.light, s: EARTH.shadow }, g);
}

function mountains(): Sprite {
  const g = makeGrid(SIZE);
  // Foothill ground is a darker value than the rock body, so the peaks
  // read as raised, lit forms instead of an outline on matching fill.
  fillRect(g, 0, 0, 23, 23, 'g');
  ditherRect(g, 0, 18, 6, 23, 'g', 'gd', 0.22);
  ditherRect(g, 17, 19, 23, 23, 'g', 'gd', 0.2);

  // A ridge of three peaks, back-to-front. The two flanking shoulders are
  // wider-growing than the narrow central peak so their bases poke out
  // past its base instead of being swallowed by it.
  drawPeak(g, 2, 15, 0.6, 23, 0, 'r', 'h', 'd', 'sn', 'snd');
  drawPeak(g, 22, 14, 0.55, 23, 0, 'r', 'h', 'd', 'sn', 'snd');
  drawPeak(g, 12, 2, 0.4, 23, 4, 'r', 'h', 'd', 'sn', 'snd');

  return tile('mountains', { g: STONE.dark, gd: STONE.shadow, r: STONE.mid, h: STONE.light, d: STONE.shadow, sn: SNOW.white, snd: SNOW.shadow }, g);
}

/** Draw one jagged mountain peak: a widening silhouette from `apexY` down
 * to `baseY`, lit-left/shadow-right slopes, and a snow cap on the top
 * `snowRows` rows. Local to mountains() — the snow-cap parameter makes this
 * too mountain-specific to be a general pixels.ts primitive. */
function drawPeak(
  g: Grid,
  apexX: number,
  apexY: number,
  growth: number,
  baseY: number,
  snowRows: number,
  chBody: string,
  chLight: string,
  chShadow: string,
  chSnow: string,
  chSnowShadow: string,
): void {
  for (let y = apexY; y <= baseY; y++) {
    const half = Math.max(0, Math.round((y - apexY) * growth));
    fillRect(g, apexX - half, y, apexX + half, y, chBody);
    setPixel(g, apexX - half, y, chLight);
    setPixel(g, apexX + half, y, chShadow);
    if (y - apexY < snowRows) {
      const snowHalf = Math.max(1, half - 1);
      fillRect(g, apexX - snowHalf, y, apexX + snowHalf, y, chSnow);
      setPixel(g, apexX + snowHalf, y, chSnowShadow);
    }
  }
}

/** Draw a short wave crest: a lit top edge over a shadowed trough, with a
 * bright foam tip — the "layered" look a single dither wash can't give. */
function drawWaveCrest(g: Grid, x: number, y: number, length: number, chLight: string, chShadow: string, chFoam: string): void {
  fillRect(g, x, y, x + length - 1, y, chLight);
  fillRect(g, x, y + 1, x + length - 1, y + 1, chShadow);
  setPixel(g, x, y, chFoam);
  setPixel(g, x + 1, y, chFoam);
}

// Hand-authored gentle swell, one y-offset per x (0..23) — deterministic,
// not a repeating small-period tile, so full-width wave bands undulate
// smoothly instead of reading as a dashed grid.
const OCEAN_WAVE = [0, 0, 1, 1, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -1, -1, 0, 0, 1, 1, 2, 2, 1, 1];

/** Draw one full-width undulating wave: a lit crest line over a shadowed
 * trough line, following OCEAN_WAVE (shifted by `phase` so bands at
 * different baseY don't line up into a grid), with foam only at a few
 * crest points. */
function drawWaveBand(g: Grid, baseY: number, phase: number, chLight: string, chShadow: string, chFoam: string, foamXs: number[]): void {
  for (let x = 0; x < SIZE; x++) {
    const y = baseY + OCEAN_WAVE[(x + phase) % SIZE]!;
    setPixel(g, x, y, chLight);
    setPixel(g, x, y + 1, chShadow);
  }
  for (const fx of foamXs) {
    const y = baseY + OCEAN_WAVE[(fx + phase) % SIZE]!;
    setPixel(g, fx, y, chFoam);
    setPixel(g, fx + 1, y, chFoam);
  }
}

function ocean(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 3, 3, 6, 5, 'm', 'd', 0.15);
  ditherRect(g, 16, 17, 19, 19, 'm', 'd', 0.12);
  // Three full-width undulating swells at different depths and phases —
  // layered wave crests instead of a dashed grid.
  drawWaveBand(g, 4, 0, 'l', 'd', 'w', [2, 11, 18]);
  drawWaveBand(g, 12, 9, 'l', 'd', 'w', [5, 14, 21]);
  drawWaveBand(g, 19, 4, 'l', 'd', 'w', [0, 9, 17]);
  return tile('ocean', { m: WATER.mid, l: WATER.light, d: WATER.dark, w: WATER.foam }, g);
}

function shore(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'sm');
  fillRect(g, 0, 0, 23, 9, 'wm');
  ditherRect(g, 0, 0, 2, 1, 'wm', 'wl', 0.3);
  ditherRect(g, 21, 0, 23, 1, 'wm', 'wl', 0.25);
  drawWaveCrest(g, 2, 2, 5, 'wl', 'wm', 'f');
  drawWaveCrest(g, 14, 3, 4, 'wl', 'wm', 'f');
  // Jagged, asymmetric surf line where water meets sand.
  plot(g, [[0, 9], [1, 9], [2, 8], [3, 9], [4, 10], [5, 9], [6, 9], [7, 8], [8, 9], [9, 10], [10, 9], [11, 9], [12, 8], [13, 9], [14, 10], [15, 9], [16, 9], [17, 8], [18, 9], [19, 10], [20, 9], [21, 9], [22, 8], [23, 9]], 'f');
  plot(g, [[1, 10], [4, 11], [7, 10], [10, 11], [13, 10], [16, 11], [19, 10], [22, 11]], 'wl');
  ditherRect(g, 0, 21, 2, 23, 'sm', 'sl', 0.3);
  ditherRect(g, 21, 21, 23, 23, 'sm', 'sl', 0.25);
  plot(g, [[5, 20], [17, 12], [9, 22], [20, 18]], 'sd');
  return tile('shore', { wm: WATER.mid, wl: WATER.light, sm: SAND.mid, sl: SAND.light, sd: SAND.dark, f: WATER.foam }, g);
}

function desert(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 0, 21, 2, 23, 'm', 'd', 0.3);
  ditherRect(g, 21, 0, 23, 1, 'm', 'd', 0.25);
  // Dune ridges: a few overlapping low mounds forming a line, not one blob.
  shadeDisc(g, 5, 6, 4, 'l', 'll', 'd');
  shadeDisc(g, 10, 5, 3, 'l', 'll', 'd');
  shadeDisc(g, 14, 8, 3, 'l', 'll', 'd');
  shadeDisc(g, 18, 17, 4, 'l', 'll', 'd');
  shadeDisc(g, 21, 20, 2, 'l', 'll', 'd');
  // Sun-cracked ground and scattered pebbles.
  plot(g, [[2, 20], [3, 21], [9, 15], [20, 4], [16, 22]], 'c');
  return tile('desert', { m: SAND.mid, d: SAND.dark, l: SAND.light, ll: SAND.light, c: SAND.shadow }, g);
}

function swamp(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 21, 0, 23, 1, 'm', 'd', 0.3);
  ditherRect(g, 0, 22, 1, 23, 'm', 'd', 0.25);
  // Murky pools, irregular and asymmetric.
  shadeDisc(g, 6, 16, 5, 'p', 'm', 'd');
  shadeDisc(g, 17, 6, 4, 'p', 'm', 'd');
  // Sickly reed clumps at pool edges.
  plot(g, [[2, 12], [2, 11], [3, 12], [4, 11], [4, 10]], 's');
  plot(g, [[20, 10], [20, 9], [21, 10]], 's');
  plot(g, [[10, 20], [10, 19], [11, 20], [11, 19]], 's');
  plot(g, [[13, 2], [14, 2], [13, 1]], 's');
  return tile('swamp', { m: SWAMP.mid, d: SWAMP.dark, p: SWAMP.muck, s: SWAMP.sick }, g);
}

function ashenWaste(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 10, 0, 12, 1, 'm', 'd', 0.3);
  ditherRect(g, 0, 22, 1, 23, 'm', 'd', 0.25);
  // Low ash drifts, lighter than the base ground so they read as raised.
  shadeDisc(g, 5, 5, 3, 'ml', 'ml', 'd');
  shadeDisc(g, 19, 18, 4, 'ml', 'ml', 'd');
  // Glowing ember fissures, jagged and asymmetric.
  plot(g, [[3, 12], [4, 13], [4, 14], [5, 15], [6, 15]], 'e');
  plot(g, [[15, 4], [16, 5], [17, 5], [18, 6]], 'e');
  plot(g, [[10, 20], [11, 20], [12, 21]], 'e');
  plot(g, [[4, 14], [16, 5]], 'el');
  return tile('ashen-waste', { m: DEATH.ashMid, ml: DEATH.ashLight, d: DEATH.ashDark, e: DEATH.ember, el: DEATH.emberLight }, g);
}

function bonefield(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 0, 0, 2, 1, 'm', 'd', 0.3);
  ditherRect(g, 17, 10, 19, 12, 'm', 'd', 0.25);
  // Skull-ish mound, lower-left.
  shadeDisc(g, 5, 17, 3, 'b', 'bl', 'sh');
  plot(g, [[4, 16], [6, 16]], 'sh');
  // Rib-cage arcs, mid-left.
  plot(g, [[9, 8], [9, 9], [9, 10], [9, 11]], 'b');
  plot(g, [[10, 8], [11, 9], [12, 10]], 'b');
  plot(g, [[8, 9], [7, 10], [6, 11]], 'b');
  // Long femur bone, diagonal, upper-right.
  plot(g, [[16, 3], [17, 4], [18, 5], [19, 6], [20, 7]], 'b');
  shadeDisc(g, 16, 3, 1, 'bl', 'bl', 'b');
  shadeDisc(g, 20, 7, 1, 'bl', 'bl', 'b');
  // Scattered bone fragments.
  plot(g, [[2, 12], [13, 20], [21, 17], [3, 21]], 'b');
  return tile('bonefield', { m: DEATH.boneWhite, d: DEATH.boneShadow, b: DEATH.boneBright, bl: DEATH.boneBright, sh: DEATH.ashDark }, g);
}

function gloomForest(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 0, 0, 2, 2, 'm', 'v', 0.3);
  ditherRect(g, 21, 21, 23, 23, 'm', 'v', 0.25);
  // Twisted dead trunk, tall, left of center.
  plot(g, [[6, 22], [6, 20], [7, 19], [6, 17], [7, 15], [6, 13], [7, 12]], 't');
  plot(g, [[6, 22], [6, 20]], 't');
  shadeDisc(g, 7, 9, 4, 'c', 'h', 't');
  // Shorter twisted trunk, right side.
  plot(g, [[18, 22], [18, 20], [17, 19], [18, 17], [17, 16]], 't');
  shadeDisc(g, 17, 13, 3, 'c', 'h', 't');
  // Eerie purple light motes, away from the trees.
  plot(g, [[3, 6], [20, 5], [10, 21], [22, 15]], 'h');
  return tile('gloom-forest', { m: SWAMP.dark, v: DEATH.voidBlack, t: DEATH.voidBlack, c: DEATH.purple, h: DEATH.purpleLight }, g);
}

function radiantPlain(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 0, 0, 2, 1, 'm', 'l', 0.3);
  ditherRect(g, 21, 22, 23, 23, 'm', 'l', 0.25);
  // Golden flower / sparkle clusters, varied size, asymmetric.
  plot(g, [[5, 4], [6, 4], [5, 3]], 'sp');
  plot(g, [[17, 6], [18, 6]], 'sp');
  plot(g, [[9, 11], [10, 11], [9, 10], [10, 12]], 'sp');
  plot(g, [[20, 14]], 'sp');
  plot(g, [[3, 15], [4, 15]], 'sp');
  plot(g, [[13, 20], [14, 20], [13, 19]], 'sp');
  plot(g, [[10, 12], [18, 6]], 'spl');
  return tile('radiant-plain', { m: LIFE.green, l: LIFE.greenLight, sp: LIFE.gold, spl: LIFE.goldLight }, g);
}

/** A tapering crystal shard: `height` rows, widest at the base, lit facet
 * on the left, shadow facet on the right, bright tip at the apex. */
function drawShard(g: Grid, baseX: number, baseY: number, height: number, chBody: string, chLight: string, chShadow: string, chTip: string): void {
  for (let i = 0; i < height; i++) {
    const y = baseY - i;
    const half = Math.max(0, Math.round((height - i) / 3) - 1);
    fillRect(g, baseX - half, y, baseX + half, y, chBody);
    setPixel(g, baseX - half, y, chLight);
    if (half > 0) setPixel(g, baseX + half, y, chShadow);
  }
  setPixel(g, baseX, baseY - height, chTip);
}

function crystalForest(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 0, 0, 23, 23, 'm');
  ditherRect(g, 0, 0, 2, 1, 'm', 'l', 0.3);
  ditherRect(g, 21, 0, 23, 1, 'm', 'l', 0.25);
  // Three crystal clusters, each with 2-3 shards of varying height, asymmetric.
  drawShard(g, 5, 20, 8, 'c', 'h', 'sd', 'spk');
  drawShard(g, 7, 21, 5, 'c', 'h', 'sd', 'spk');
  drawShard(g, 3, 19, 4, 'c', 'h', 'sd', 'spk');

  drawShard(g, 18, 13, 7, 'c', 'h', 'sd', 'spk');
  drawShard(g, 20, 14, 4, 'c', 'h', 'sd', 'spk');

  drawShard(g, 12, 8, 5, 'c', 'h', 'sd', 'spk');
  drawShard(g, 10, 7, 3, 'c', 'h', 'sd', 'spk');
  return tile('crystal-forest', { m: LIFE.white, l: LIFE.crystalBlueLight, c: LIFE.crystalBlue, h: LIFE.crystalBlueLight, sd: LIFE.crystalBlueDark, spk: LIFE.crystalBlueLight }, g);
}

export const TERRAIN_SPRITES: Sprite[] = [
  grassland(),
  forest(),
  hills(),
  mountains(),
  ocean(),
  shore(),
  desert(),
  swamp(),
  ashenWaste(),
  bonefield(),
  gloomForest(),
  radiantPlain(),
  crystalForest(),
];
