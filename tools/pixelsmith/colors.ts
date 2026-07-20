// Shared color families for pixelsmith art. Every sprite set below draws
// from these constants (rather than inventing one-off hex strings) so the
// whole game reads as one coherent palette, and so a future bulk restyle is
// a matter of editing values here instead of hunting through every sprite.
//
// Naming convention within a family: Mid (base tone) / Light (highlight,
// used on the side facing the light source) / Dark (shade) / Shadow
// (deepest shade, used sparingly). Light source is consistently top-left
// across all sprites.

export const GRASS = {
  mid: '#4f8a3d',
  light: '#79b85a',
  dark: '#356027',
  shadow: '#24401a',
};

export const FOREST = {
  canopyDark: '#1f4d2b',
  canopyMid: '#2f6b3a',
  canopyLight: '#4a8f4f',
  trunk: '#4a3420',
  trunkDark: '#2e1f13',
};

export const EARTH = {
  mid: '#8a6a3f',
  light: '#ab8a58',
  dark: '#5e4526',
  shadow: '#3e2e18',
};

export const STONE = {
  mid: '#7d8188',
  light: '#a3a8ae',
  dark: '#54585e',
  shadow: '#34373c',
};

export const SNOW = {
  white: '#eef3f7',
  shadow: '#c3d0da',
};

export const WATER = {
  mid: '#2f6ea8',
  light: '#5b9bd1',
  dark: '#1f4a78',
  foam: '#cfeaf7',
};

export const SAND = {
  mid: '#d9b563',
  light: '#eccf8e',
  dark: '#b8934a',
  shadow: '#8a6a35',
};

export const SWAMP = {
  mid: '#5f7048',
  dark: '#3d4a2a',
  muck: '#2a3323',
  sick: '#7a8f45',
};

export const DEATH = {
  ashMid: '#5a5a5e',
  ashLight: '#7d7d82',
  ashDark: '#3a3a3d',
  ember: '#d9662f',
  emberLight: '#f2a84f',
  boneWhite: '#d8d0b0',
  boneBright: '#efe8cf',
  boneShadow: '#a89f7c',
  voidBlack: '#17141c',
  purple: '#5a3d6b',
  purpleLight: '#7d5c8f',
};

export const LIFE = {
  gold: '#e8c25a',
  goldLight: '#f7e08a',
  goldDark: '#a87d2e',
  green: '#a8c47a',
  greenLight: '#cfe3a8',
  white: '#f5f3ea',
  whiteShadow: '#d8d3c0',
  crystalBlue: '#bfe3f0',
  crystalBlueLight: '#eaf8ff',
  crystalBlueDark: '#8fc0d6',
};

export const CHAOS = {
  red: '#c0392b',
};

export const SKIN = {
  orc: '#5a7d3a',
  orcLight: '#7fa855',
  orcDark: '#3d5a26',
  human: '#d9a066',
  humanLight: '#eec18a',
  humanDark: '#a8703f',
};

export const METAL = {
  mid: '#8a8f94',
  light: '#c3c8cc',
  dark: '#5a5f64',
};

/** Near-black outline used to keep small silhouettes readable at 1x. */
export const OUTLINE = '#141414';
