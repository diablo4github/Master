// 16x16 unit sprites, facing right, on a transparent background. Light
// source is top-left throughout: highlight chars sit on the top/left faces
// of a shape, shadow chars on the bottom/right faces, matching the terrain
// and building sprites for a consistent overall look.
import type { Sprite } from '../sprite';
import { compileSprite, fillRect, makeGrid, setPixel, type Grid } from '../pixels';
import { DEATH, EARTH, FOREST, LIFE, METAL, OUTLINE, SKIN, WATER } from '../colors';

const SIZE = 16;

function unit(id: string, colors: Record<string, string>, grid: Grid): Sprite {
  return compileSprite(id, SIZE, grid, colors);
}

function orcWarrior(): Sprite {
  const g = makeGrid(SIZE);
  // head
  fillRect(g, 6, 1, 9, 4, 's');
  fillRect(g, 6, 1, 7, 1, 'sl');
  setPixel(g, 9, 3, 'o');
  fillRect(g, 8, 4, 9, 4, 'sd');
  // torso / leather armor
  fillRect(g, 5, 5, 10, 9, 'a');
  fillRect(g, 5, 5, 6, 6, 'al');
  fillRect(g, 9, 8, 10, 9, 'ad');
  fillRect(g, 5, 10, 10, 10, 'ad');
  // left arm sliver, right arm + axe
  fillRect(g, 4, 6, 4, 8, 'a');
  fillRect(g, 10, 6, 12, 7, 's');
  fillRect(g, 12, 3, 13, 8, 'w');
  fillRect(g, 11, 2, 14, 4, 'm');
  fillRect(g, 11, 2, 12, 2, 'ml');
  // legs and boots
  fillRect(g, 5, 11, 6, 14, 'a');
  fillRect(g, 9, 11, 10, 14, 'a');
  fillRect(g, 5, 11, 5, 12, 'al');
  fillRect(g, 9, 13, 10, 14, 'ad');
  fillRect(g, 4, 15, 7, 15, 'm');
  fillRect(g, 8, 15, 11, 15, 'm');
  return unit('orc-warrior', {
    o: OUTLINE, s: SKIN.orc, sl: SKIN.orcLight, sd: SKIN.orcDark,
    a: EARTH.mid, al: EARTH.light, ad: EARTH.shadow,
    m: METAL.mid, ml: METAL.light, w: FOREST.trunk,
  }, g);
}

function humanSpearman(): Sprite {
  const g = makeGrid(SIZE);
  // head + helmet
  fillRect(g, 6, 2, 9, 4, 's');
  fillRect(g, 6, 1, 9, 2, 'm');
  fillRect(g, 6, 1, 7, 1, 'ml');
  setPixel(g, 9, 3, 'o');
  // torso tunic
  fillRect(g, 5, 5, 10, 9, 't');
  fillRect(g, 5, 5, 6, 6, 'tl');
  fillRect(g, 9, 8, 10, 9, 'td');
  fillRect(g, 5, 10, 10, 10, 'td');
  // arms
  fillRect(g, 4, 6, 4, 8, 't');
  fillRect(g, 10, 6, 11, 8, 's');
  // spear, tip up-right
  fillRect(g, 11, 7, 14, 8, 'sp');
  fillRect(g, 13, 4, 14, 7, 'sp');
  fillRect(g, 12, 2, 15, 4, 'm');
  fillRect(g, 12, 2, 13, 2, 'ml');
  // legs and boots
  fillRect(g, 5, 11, 6, 14, 't');
  fillRect(g, 9, 11, 10, 14, 't');
  fillRect(g, 5, 11, 5, 12, 'tl');
  fillRect(g, 9, 13, 10, 14, 'td');
  fillRect(g, 4, 15, 7, 15, 'm');
  fillRect(g, 8, 15, 11, 15, 'm');
  return unit('human-spearman', {
    o: OUTLINE, s: SKIN.human, m: METAL.mid, ml: METAL.light,
    t: WATER.mid, tl: WATER.light, td: WATER.dark, sp: EARTH.dark,
  }, g);
}

function skeleton(): Sprite {
  const g = makeGrid(SIZE);
  // skull
  fillRect(g, 6, 1, 9, 4, 'b');
  setPixel(g, 7, 3, 'o');
  setPixel(g, 8, 3, 'o');
  fillRect(g, 6, 1, 7, 1, 'bl');
  fillRect(g, 8, 4, 9, 4, 'bd');
  // ribcage torso
  fillRect(g, 6, 5, 9, 9, 'b');
  fillRect(g, 6, 6, 6, 8, 'bd');
  fillRect(g, 9, 6, 9, 8, 'bd');
  // tattered cloth over hips
  fillRect(g, 5, 9, 10, 10, 'c');
  // arms + sword
  fillRect(g, 5, 6, 5, 8, 'b');
  fillRect(g, 10, 6, 11, 8, 'b');
  fillRect(g, 12, 3, 12, 8, 'm');
  fillRect(g, 11, 8, 13, 8, 'md');
  setPixel(g, 12, 2, 'ml');
  // legs and feet
  fillRect(g, 6, 11, 7, 14, 'b');
  fillRect(g, 8, 11, 9, 14, 'b');
  fillRect(g, 6, 11, 6, 12, 'bl');
  fillRect(g, 8, 13, 9, 14, 'bd');
  fillRect(g, 5, 15, 7, 15, 'bd');
  fillRect(g, 8, 15, 10, 15, 'bd');
  return unit('skeleton', {
    o: OUTLINE, b: DEATH.boneWhite, bl: DEATH.boneBright, bd: DEATH.boneShadow,
    c: DEATH.purple, m: METAL.mid, ml: METAL.light, md: METAL.dark,
  }, g);
}

function angel(): Sprite {
  const g = makeGrid(SIZE);
  // halo
  fillRect(g, 6, 0, 9, 0, 'g');
  setPixel(g, 5, 0, 'g');
  setPixel(g, 10, 0, 'g');
  // wings, folded behind the body
  fillRect(g, 2, 4, 5, 10, 'w');
  fillRect(g, 10, 4, 13, 10, 'w');
  fillRect(g, 2, 4, 3, 6, 'wl');
  fillRect(g, 12, 8, 13, 10, 'wd');
  // head
  fillRect(g, 6, 2, 9, 4, 's');
  fillRect(g, 6, 2, 7, 2, 'sl');
  setPixel(g, 9, 3, 'o');
  // robe torso with gold sash trim
  fillRect(g, 5, 5, 10, 10, 'r');
  fillRect(g, 5, 5, 6, 6, 'rl');
  fillRect(g, 9, 8, 10, 10, 'rd');
  fillRect(g, 5, 8, 10, 8, 'g');
  // arms; right hand holds a small blessing orb
  fillRect(g, 4, 6, 4, 8, 'r');
  fillRect(g, 10, 6, 11, 8, 's');
  fillRect(g, 12, 6, 13, 7, 'g');
  // robe hem / legs
  fillRect(g, 5, 11, 10, 14, 'r');
  fillRect(g, 5, 11, 6, 12, 'rl');
  fillRect(g, 9, 13, 10, 14, 'rd');
  fillRect(g, 4, 15, 11, 15, 'rd');
  return unit('angel', {
    o: OUTLINE, s: SKIN.human, sl: SKIN.humanLight,
    r: LIFE.white, rl: LIFE.goldLight, rd: LIFE.whiteShadow, g: LIFE.gold,
    w: LIFE.crystalBlueLight, wl: LIFE.white, wd: LIFE.crystalBlueDark,
  }, g);
}

export const UNIT_SPRITES: Sprite[] = [orcWarrior(), humanSpearman(), skeleton(), angel()];
