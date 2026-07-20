// 24x24 city sprites — sit on top of a terrain tile, so unlike terrain
// tiles these do NOT fill every pixel: outside the settlement's footprint
// stays transparent ('.') so the terrain underneath shows through. Three
// tiers (village -> town -> large) read as a size/material progression:
// wood-and-thatch huts, a stone-walled hall among more huts with a road,
// then a full stone curtain wall with a keep behind it. Race-neutral earthy
// palette drawn from colors.ts families. Light source is consistently
// top-left, matching every other sprite set in the pipeline.
import type { Sprite } from '../sprite';
import { compileSprite, ditherRect, fillRect, makeGrid, plot, setPixel, type Grid } from '../pixels';
import { EARTH, OUTLINE, SAND, STONE } from '../colors';

const SIZE = 24;

function city(id: string, colors: Record<string, string>, grid: Grid): Sprite {
  return compileSprite(id, SIZE, grid, colors);
}

/** A gable roof: a triangle growing linearly from `apexX,apexY` down to a
 * base `baseHalf` pixels wide either side, lit-left/shadow-right slopes —
 * the same idiom as terrain.ts's drawPeak and buildings.ts's roofTriangle,
 * reused here at hut scale. */
function gableRoof(
  grid: Grid,
  apexX: number,
  apexY: number,
  baseHalf: number,
  height: number,
  chBody: string,
  chLight: string,
  chShadow: string,
): void {
  for (let i = 0; i <= height; i++) {
    const y = apexY + i;
    const half = Math.max(0, Math.round((i / height) * baseHalf));
    fillRect(grid, apexX - half, y, apexX + half, y, chBody);
    setPixel(grid, apexX - half, y, chLight);
    setPixel(grid, apexX + half, y, chShadow);
  }
}

function village(): Sprite {
  const g = makeGrid(SIZE);

  // Trodden dirt clearing along the bottom of the tile — a flat band, not
  // a rounded blob, so it doesn't cut diagonal notches into the huts
  // standing on it. All three huts sit flush on its top edge (y19).
  fillRect(g, 1, 19, 22, 23, 'g');
  ditherRect(g, 1, 19, 22, 20, 'g', 'gl', 0.25);
  plot(g, [[9, 21], [3, 22], [20, 21]], 'gs');

  // Hut A — large, left.
  fillRect(g, 2, 14, 7, 19, 'w');
  fillRect(g, 2, 14, 2, 19, 'wl');
  fillRect(g, 7, 15, 7, 19, 'wd');
  gableRoof(g, 4, 8, 3, 6, 'th', 'thl', 'thd');
  fillRect(g, 4, 16, 5, 19, 'dr');

  // Hut B — medium, center, set back (taller wall reads as further away).
  fillRect(g, 11, 10, 16, 19, 'w');
  fillRect(g, 11, 10, 11, 19, 'wl');
  fillRect(g, 16, 11, 16, 19, 'wd');
  gableRoof(g, 13, 3, 3, 7, 'th', 'thl', 'thd');
  fillRect(g, 13, 16, 14, 19, 'dr');

  // Hut C — small, right.
  fillRect(g, 18, 15, 22, 19, 'w');
  fillRect(g, 18, 15, 18, 19, 'wl');
  fillRect(g, 22, 16, 22, 19, 'wd');
  gableRoof(g, 20, 10, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 19, 17, 20, 19, 'dr');

  return city('city-village', {
    g: EARTH.dark, gl: EARTH.mid, gs: EARTH.shadow,
    w: EARTH.mid, wl: EARTH.light, wd: EARTH.shadow,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    dr: OUTLINE,
  }, g);
}

function town(): Sprite {
  const g = makeGrid(SIZE);

  // Road hint: a worn dirt track approaching the hall from the tile's
  // south edge, widening slightly toward the viewer for a hint of depth.
  fillRect(g, 10, 20, 14, 23, 'rd');
  fillRect(g, 11, 20, 13, 23, 'rl');

  // Central hall — stone-walled and taller than the surrounding huts, the
  // town's civic anchor.
  fillRect(g, 9, 11, 16, 20, 'st');
  fillRect(g, 9, 11, 9, 20, 'stl');
  fillRect(g, 16, 12, 16, 20, 'std');
  gableRoof(g, 12, 3, 5, 8, 'th', 'thl', 'thd');
  fillRect(g, 11, 17, 13, 20, 'dr');

  // Three smaller wood-and-thatch huts flank the hall with clear gaps —
  // denser than the village, but each still reads as its own building
  // (no two footprints share a row range in the same column band).
  fillRect(g, 1, 15, 5, 19, 'w');
  fillRect(g, 1, 15, 1, 19, 'wl');
  fillRect(g, 5, 16, 5, 19, 'wd');
  gableRoof(g, 3, 10, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 2, 17, 3, 19, 'dr');

  fillRect(g, 18, 6, 22, 10, 'w');
  fillRect(g, 18, 6, 18, 10, 'wl');
  fillRect(g, 22, 7, 22, 10, 'wd');
  gableRoof(g, 20, 1, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 19, 8, 20, 10, 'dr');

  fillRect(g, 18, 17, 22, 21, 'w');
  fillRect(g, 18, 17, 18, 21, 'wl');
  fillRect(g, 22, 18, 22, 21, 'wd');
  gableRoof(g, 20, 12, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 19, 19, 20, 21, 'dr');

  return city('city-town', {
    rd: SAND.dark, rl: SAND.mid,
    w: EARTH.mid, wl: EARTH.light, wd: EARTH.shadow,
    st: STONE.mid, stl: STONE.light, std: STONE.dark,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    dr: OUTLINE,
  }, g);
}

function large(): Sprite {
  const g = makeGrid(SIZE);

  // Ground apron in front of the gate — flat, not a rounded blob, so it
  // doesn't notch into the gate's straight edges.
  fillRect(g, 9, 22, 14, 23, 'g');
  ditherRect(g, 9, 22, 14, 23, 'g', 'gl', 0.3);

  // Curtain wall.
  fillRect(g, 1, 13, 22, 21, 'st');
  fillRect(g, 1, 13, 1, 21, 'stl');
  fillRect(g, 22, 13, 22, 21, 'std');
  fillRect(g, 1, 21, 22, 21, 'std');
  // Corner merlons — the only crenellations, so they read as distinct
  // teeth instead of speckling the whole wall top with clutter.
  fillRect(g, 1, 11, 2, 12, 'stl');
  fillRect(g, 21, 11, 22, 12, 'std');

  // Peeking rooftops of ordinary buildings inside the wall, flanking the
  // keep — only the roofs are visible, the walls hidden behind the curtain.
  gableRoof(g, 4, 9, 2, 3, 'th', 'thl', 'thd');
  gableRoof(g, 19, 9, 2, 3, 'th', 'thl', 'thd');

  // Keep tower, rising above the curtain wall at the center.
  fillRect(g, 9, 5, 14, 13, 'kp');
  fillRect(g, 9, 5, 9, 13, 'kpl');
  fillRect(g, 14, 5, 14, 13, 'kpd');
  setPixel(g, 11, 8, 'win');
  setPixel(g, 12, 8, 'win');
  gableRoof(g, 11, 1, 3, 4, 'th', 'thl', 'thd');
  setPixel(g, 11, 0, 'thl');

  // Gate: a rounded archway cut into the wall, with a dark opening and a
  // wooden double door beneath.
  fillRect(g, 9, 15, 14, 21, 'gt');
  fillRect(g, 10, 14, 13, 14, 'gt');
  fillRect(g, 9, 17, 14, 21, 'dr');
  setPixel(g, 11, 17, 'gt');
  setPixel(g, 12, 17, 'gt');

  return city('city-large', {
    g: EARTH.dark, gl: EARTH.mid,
    st: STONE.mid, stl: STONE.light, std: STONE.dark,
    kp: STONE.dark, kpl: STONE.mid, kpd: STONE.shadow,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    win: OUTLINE, gt: OUTLINE, dr: EARTH.dark,
  }, g);
}

export const CITY_SPRITES: Sprite[] = [village(), town(), large()];
