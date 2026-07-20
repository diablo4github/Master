// Small internal drawing helpers used by tools/pixelsmith/sprites/*.ts to
// build Sprite `rows` programmatically instead of hand-typing character
// grids. Building grids in code (rather than literal strings) makes the
// dimensions self-correct (a Grid is always exactly `size` x `size`) and
// lets tile textures use a deterministic ordered dither instead of noise.
//
// Grid cells hold readable multi-character *labels* (e.g. 'skin-light',
// 'roof-dark') rather than raw palette characters — a Sprite's `rows`
// format requires exactly one character per pixel, which is too cramped to
// author directly. compileSprite() below does the label -> single-char
// assignment as a final step.
import type { Sprite, SpriteSize } from './sprite';

export type Grid = string[][];

/** A size x size grid filled with `fill` (default: transparent '.'). */
export function makeGrid(size: number, fill = '.'): Grid {
  return Array.from({ length: size }, () => Array<string>(size).fill(fill));
}

/** Convert a Grid into the `rows: string[]` shape a Sprite expects. Only
 * valid if every cell is already a single character — see compileSprite()
 * for the normal path, which handles multi-character labels. */
export function toRows(grid: Grid): string[] {
  return grid.map((row) => row.join(''));
}

// Pool of distinct single characters available to compileSprite for
// auto-assigning to grid labels. '.' is reserved for transparent (per the
// Sprite format) so it's deliberately excluded.
const PALETTE_CHAR_POOL = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Compile a labeled Grid into a Sprite: every distinct non-'.' label gets
 * a single auto-assigned character, and `colors` supplies the hex color
 * for each label used. This is the normal way to turn a Grid built with
 * fillRect/setPixel/plot/ditherRect into a Sprite, since those helpers
 * store whatever label string you pass them, not single characters.
 */
export function compileSprite(id: string, size: SpriteSize, grid: Grid, colors: Record<string, string>): Sprite {
  const labelToChar = new Map<string, string>();
  let next = 0;

  const rows = grid.map((row) =>
    row
      .map((label) => {
        if (label === '.') return '.';
        let ch = labelToChar.get(label);
        if (ch === undefined) {
          if (!(label in colors)) {
            throw new Error(`compileSprite '${id}': label '${label}' has no entry in colors`);
          }
          if (next >= PALETTE_CHAR_POOL.length) {
            throw new Error(`compileSprite '${id}': ran out of distinct palette characters`);
          }
          ch = PALETTE_CHAR_POOL[next]!;
          next += 1;
          labelToChar.set(label, ch);
        }
        return ch;
      })
      .join(''),
  );

  const palette: Record<string, string> = {};
  for (const [label, ch] of labelToChar) {
    palette[ch] = colors[label]!;
  }

  return { id, size, palette, rows };
}

/** Set a single pixel. Out-of-bounds coordinates are silently ignored, so
 * callers can plot shapes that clip at tile edges without extra bounds
 * checks at every call site. */
export function setPixel(grid: Grid, x: number, y: number, ch: string): void {
  const size = grid.length;
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  grid[y]![x] = ch;
}

/** Fill an inclusive rectangle [x0,x1] x [y0,y1]. */
export function fillRect(grid: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(grid, x, y, ch);
    }
  }
}

/** Set many individual pixels to the same character. */
export function plot(grid: Grid, points: Array<[number, number]>, ch: string): void {
  for (const [x, y] of points) setPixel(grid, x, y, ch);
}

// 4x4 ordered (Bayer) dither matrix. Because it's indexed purely by each
// pixel's coordinate mod 4, it repeats identically starting from (0,0) in
// every sprite — so ground textures stay continuous when tiles are placed
// edge-to-edge on the map grid, instead of showing a seam.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * Fill an inclusive rectangle with an ordered dither between two
 * characters. `ratio` (0..1) is approximately the fraction of pixels that
 * become `chB`; the rest become `chA`. Produces subtle, tileable texture
 * instead of random noise.
 */
export function ditherRect(
  grid: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  chA: string,
  chB: string,
  ratio: number,
): void {
  const threshold = ratio * 16;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const m = BAYER_4X4[y % 4]![x % 4]!;
      setPixel(grid, x, y, m < threshold ? chB : chA);
    }
  }
}
