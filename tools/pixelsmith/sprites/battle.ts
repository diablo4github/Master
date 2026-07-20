// Battle-archetype sprites: the tactical battle viewer renders every unit
// (across ~150 races/creatures) as one of these 14 shared archetypes until
// per-unit art exists. Because many different units on screen at once share
// the same handful of sprites, each archetype needs a strong, instantly
// readable 1x silhouette AND a palette family distinct enough from its
// neighbors that a mixed battle line reads at a glance without captions.
// 16x16, facing right, transparent background, light source top-left —
// matching every other sprite set in the pipeline.
//
// Plus one strategic-map sprite, 'lair' (24x24): a monster lair marker (see
// docs/DESIGN.md "Where battles come from") that must read against any
// terrain tile, so — like the city sprites — it only paints its footprint
// and leaves the rest transparent.
import type { Sprite } from '../sprite';
import { compileSprite, ditherRect, fillRect, makeGrid, plot, setPixel, shadeDisc, type Grid } from '../pixels';
import { CHAOS, DEATH, EARTH, LIFE, METAL, OUTLINE, SAND, SKIN, STONE, SWAMP } from '../colors';

const SIZE = 16;
const LAIR_SIZE = 24;

function battle(id: string, colors: Record<string, string>, grid: Grid): Sprite {
  return compileSprite(id, SIZE, grid, colors);
}

// ---------------------------------------------------------------------------
// 1. Spearman — round shield forward, spear held level at chest height so
// the reach silhouette (a thin line clear to the sprite's right edge) is
// unmistakable even at 1x.
function spearman(): Sprite {
  const g = makeGrid(SIZE);
  // head
  fillRect(g, 6, 2, 9, 4, 'sk');
  fillRect(g, 6, 1, 9, 2, 'me');
  fillRect(g, 6, 1, 7, 1, 'mel');
  setPixel(g, 9, 3, 'o');
  // torso, leather
  fillRect(g, 5, 5, 10, 9, 'le');
  fillRect(g, 5, 5, 6, 6, 'lel');
  fillRect(g, 9, 8, 10, 9, 'led');
  fillRect(g, 5, 10, 10, 10, 'led');
  // round shield on the leading (back) arm
  shadeDisc(g, 3, 8, 2, 'sh', 'shl', 'shd');
  setPixel(g, 3, 8, 'sb');
  // spear arm, levelled straight out at chest height
  fillRect(g, 10, 7, 11, 8, 'sk');
  fillRect(g, 11, 7, 15, 7, 'ha');
  fillRect(g, 13, 6, 15, 6, 'mel');
  setPixel(g, 15, 6, 'me');
  // legs and boots
  fillRect(g, 5, 11, 6, 14, 'le');
  fillRect(g, 9, 11, 10, 14, 'le');
  fillRect(g, 5, 11, 5, 12, 'lel');
  fillRect(g, 9, 13, 10, 14, 'led');
  fillRect(g, 4, 15, 7, 15, 'bo');
  fillRect(g, 8, 15, 11, 15, 'bo');
  return battle('spearman', {
    o: OUTLINE, sk: SKIN.human, me: METAL.mid, mel: METAL.light,
    le: EARTH.mid, lel: EARTH.light, led: EARTH.shadow,
    sh: METAL.mid, shl: METAL.light, shd: METAL.dark, sb: OUTLINE,
    ha: EARTH.dark, bo: EARTH.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 2. Swordsman — sword raised vertically overhead, tall pointed kite shield
// on the leading arm. Grey plate reads distinct from the spearman's leather.
function swordsman(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 2, 9, 4, 'sk');
  fillRect(g, 6, 1, 9, 2, 'me');
  fillRect(g, 6, 1, 7, 1, 'mel');
  setPixel(g, 9, 3, 'o');
  // torso, plate
  fillRect(g, 5, 5, 10, 9, 'pl');
  fillRect(g, 5, 5, 6, 6, 'pll');
  fillRect(g, 9, 8, 10, 9, 'pld');
  fillRect(g, 5, 10, 10, 10, 'pld');
  // kite shield: flat top tapering to a point at the bottom
  fillRect(g, 2, 5, 4, 8, 'sh');
  fillRect(g, 3, 9, 3, 9, 'sh');
  setPixel(g, 3, 10, 'sh');
  fillRect(g, 2, 5, 2, 7, 'shl');
  fillRect(g, 4, 6, 4, 8, 'shd');
  // sword arm raised straight up, blade clear above the head
  fillRect(g, 10, 6, 11, 8, 'sk');
  fillRect(g, 10, 3, 11, 5, 'me');
  fillRect(g, 9, 5, 12, 5, 'med');
  fillRect(g, 10, 0, 11, 3, 'me');
  setPixel(g, 10, 0, 'mel');
  fillRect(g, 5, 11, 6, 14, 'pl');
  fillRect(g, 9, 11, 10, 14, 'pl');
  fillRect(g, 5, 11, 5, 12, 'pll');
  fillRect(g, 9, 13, 10, 14, 'pld');
  fillRect(g, 4, 15, 7, 15, 'bo');
  fillRect(g, 8, 15, 11, 15, 'bo');
  return battle('swordsman', {
    o: OUTLINE, sk: SKIN.human, me: METAL.mid, mel: METAL.light, med: METAL.dark,
    pl: STONE.mid, pll: STONE.light, pld: STONE.dark,
    sh: METAL.mid, shl: METAL.light, shd: METAL.dark, bo: STONE.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 3. Archer — bow drawn full, string pulled to the ear; the taut bow curve
// and nocked arrow are the read, so the body stays slim and unarmored.
function archer(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 2, 9, 4, 'sk');
  fillRect(g, 6, 1, 8, 2, 'ho');
  setPixel(g, 9, 3, 'o');
  fillRect(g, 5, 5, 9, 9, 'cl');
  fillRect(g, 5, 5, 6, 6, 'cll');
  fillRect(g, 8, 8, 9, 9, 'cld');
  fillRect(g, 5, 10, 9, 10, 'cld');
  // bow: a tall vertical curve out front, string drawn back to cheek
  setPixel(g, 11, 2, 'wo');
  setPixel(g, 12, 3, 'wo');
  setPixel(g, 12, 4, 'wo');
  fillRect(g, 12, 5, 12, 8, 'wo');
  setPixel(g, 12, 9, 'wo');
  setPixel(g, 12, 10, 'wo');
  setPixel(g, 11, 11, 'wo');
  plot(g, [[11, 3], [12, 6], [12, 8], [11, 10]], 'wol');
  // string drawn back, arrow nocked pointing right
  plot(g, [[11, 3], [9, 6], [11, 10]], 'st');
  fillRect(g, 9, 6, 14, 6, 'ar');
  setPixel(g, 14, 6, 'me');
  // drawing hand at the ear
  setPixel(g, 9, 6, 'sk');
  fillRect(g, 5, 11, 6, 14, 'cl');
  fillRect(g, 8, 11, 9, 14, 'cl');
  fillRect(g, 5, 11, 5, 12, 'cll');
  fillRect(g, 8, 13, 9, 14, 'cld');
  fillRect(g, 4, 15, 7, 15, 'bo');
  fillRect(g, 7, 15, 10, 15, 'bo');
  return battle('archer', {
    o: OUTLINE, sk: SKIN.human, ho: SAND.dark,
    cl: SAND.mid, cll: SAND.light, cld: SAND.dark,
    wo: EARTH.dark, wol: EARTH.light, st: OUTLINE, ar: EARTH.mid, me: METAL.light,
    bo: EARTH.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 4. Crossbowman — crossbow held level, tucked at the hip; a pavise corner
// planted at the feet distinguishes the silhouette from the archer's curve.
function crossbowman(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 2, 9, 4, 'sk');
  fillRect(g, 6, 1, 9, 2, 'me');
  setPixel(g, 9, 3, 'o');
  fillRect(g, 5, 5, 10, 9, 'br');
  fillRect(g, 5, 5, 6, 6, 'brl');
  fillRect(g, 9, 8, 10, 9, 'brd');
  fillRect(g, 5, 10, 10, 10, 'brd');
  // crossbow: horizontal stock + vertical prod (bow-arm) held level at the hip
  fillRect(g, 10, 8, 14, 9, 'wo');
  fillRect(g, 13, 6, 13, 11, 'me');
  fillRect(g, 13, 6, 13, 7, 'mel');
  fillRect(g, 13, 10, 13, 11, 'med');
  setPixel(g, 10, 7, 'sk');
  // pavise: a wooden shield-corner planted at the front foot
  fillRect(g, 11, 12, 13, 15, 'pv');
  fillRect(g, 11, 12, 11, 15, 'pvl');
  fillRect(g, 13, 13, 13, 15, 'pvd');
  fillRect(g, 5, 11, 6, 14, 'br');
  fillRect(g, 9, 11, 10, 14, 'br');
  fillRect(g, 5, 11, 5, 12, 'brl');
  fillRect(g, 9, 13, 10, 14, 'brd');
  fillRect(g, 4, 15, 7, 15, 'bo');
  fillRect(g, 8, 15, 10, 15, 'bo');
  return battle('crossbowman', {
    o: OUTLINE, sk: SKIN.human, me: METAL.mid, mel: METAL.light, med: METAL.dark,
    br: STONE.dark, brl: STONE.mid, brd: STONE.shadow,
    wo: EARTH.dark, pv: EARTH.mid, pvl: EARTH.light, pvd: EARTH.shadow,
    bo: STONE.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 5. Cavalry — horse body low and long, rider above, lance couched dead
// level at chest height. The widest, lowest silhouette of the set.
function cavalry(): Sprite {
  const g = makeGrid(SIZE);
  // horse body, galloping — long low barrel with a raised neck and head
  fillRect(g, 1, 10, 11, 13, 'ho');
  fillRect(g, 1, 10, 3, 11, 'hol');
  fillRect(g, 9, 12, 11, 13, 'hod');
  fillRect(g, 7, 6, 9, 10, 'ho');
  fillRect(g, 8, 4, 11, 7, 'ho');
  fillRect(g, 10, 4, 11, 5, 'hol');
  setPixel(g, 11, 5, 'o');
  fillRect(g, 0, 5, 1, 9, 'ma');
  // legs, mid-stride (front pair forward, rear pair trailing)
  fillRect(g, 2, 14, 3, 15, 'ho');
  fillRect(g, 9, 14, 10, 15, 'ho');
  setPixel(g, 5, 13, 'hod');
  setPixel(g, 12, 13, 'hod');
  // rider torso + head, seated on the horse's back
  fillRect(g, 5, 3, 8, 6, 'ar');
  fillRect(g, 5, 3, 5, 5, 'arl');
  fillRect(g, 6, 0, 8, 2, 'sk');
  fillRect(g, 6, 0, 7, 0, 'me');
  setPixel(g, 8, 1, 'o');
  // lance, couched level, projecting well past the horse's head
  fillRect(g, 9, 7, 15, 7, 'la');
  setPixel(g, 15, 7, 'mel');
  return battle('cavalry', {
    o: OUTLINE, ho: EARTH.dark, hol: EARTH.mid, hod: EARTH.shadow, ma: SAND.shadow,
    ar: METAL.mid, arl: METAL.light, sk: SKIN.human, me: METAL.mid,
    la: EARTH.mid, mel: METAL.light,
  }, g);
}

// ---------------------------------------------------------------------------
// 6. Brute — hulking, ogre-scaled: an oversized head/shoulder block and a
// two-handed club raised overhead. Broader than every humanoid archetype.
function brute(): Sprite {
  const g = makeGrid(SIZE);
  // small eyes, jutting brow, tusks — big blunt head
  fillRect(g, 5, 1, 10, 5, 'sk');
  fillRect(g, 5, 1, 6, 2, 'skl');
  fillRect(g, 9, 3, 10, 5, 'skd');
  plot(g, [[6, 3], [9, 3]], 'o');
  plot(g, [[6, 5], [9, 5]], 'tu');
  // massive shoulders/torso, wider than the head
  fillRect(g, 3, 6, 12, 11, 'sk');
  fillRect(g, 3, 6, 5, 7, 'skl');
  fillRect(g, 10, 9, 12, 11, 'skd');
  fillRect(g, 3, 11, 12, 11, 'skd');
  // loincloth
  fillRect(g, 4, 10, 11, 12, 'lo');
  // club, raised overhead in both hands
  fillRect(g, 11, 1, 13, 5, 'cl');
  fillRect(g, 11, 1, 11, 5, 'cll');
  fillRect(g, 13, 2, 13, 5, 'cld');
  fillRect(g, 10, 6, 13, 8, 'sk');
  fillRect(g, 2, 7, 3, 9, 'sk');
  // short thick legs
  fillRect(g, 4, 12, 6, 14, 'sk');
  fillRect(g, 9, 12, 11, 14, 'sk');
  fillRect(g, 3, 15, 7, 15, 'skd');
  fillRect(g, 8, 15, 12, 15, 'skd');
  return battle('brute', {
    o: OUTLINE, sk: SWAMP.sick, skl: EARTH.light, skd: SWAMP.dark, tu: DEATH.boneWhite,
    lo: EARTH.shadow, cl: EARTH.mid, cll: EARTH.light, cld: EARTH.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 7. Swarm — three small beast shapes clustered and lunging together, so
// the cell reads as "many small things" rather than one creature.
function swarm(): Sprite {
  const g = makeGrid(SIZE);
  function lunger(x: number, y: number): void {
    fillRect(g, x, y, x + 3, y + 2, 'bd');
    setPixel(g, x, y, 'bdl');
    setPixel(g, x + 3, y + 1, 'bdd');
    setPixel(g, x + 4, y + 1, 'o');
    setPixel(g, x + 3, y, 'ey');
    plot(g, [[x - 1, y + 2], [x - 1, y + 3]], 'bd');
    plot(g, [[x + 1, y + 3], [x + 2, y + 3]], 'bd');
  }
  lunger(1, 2);
  lunger(6, 7);
  lunger(2, 11);
  return battle('swarm', {
    o: OUTLINE, bd: SWAMP.mid, bdl: SWAMP.sick, bdd: SWAMP.dark, ey: CHAOS.red,
  }, g);
}

// ---------------------------------------------------------------------------
// 8. Skirmisher — light runner, one leg forward, javelin cocked back for a
// throw; the running stride is the read, distinct from the archer's stance.
function skirmisher(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 2, 9, 4, 'sk');
  fillRect(g, 6, 1, 8, 2, 'ho');
  setPixel(g, 9, 3, 'o');
  fillRect(g, 5, 5, 9, 9, 'cl');
  fillRect(g, 5, 5, 6, 6, 'cll');
  fillRect(g, 8, 8, 9, 9, 'cld');
  // cloak trailing behind from the run
  fillRect(g, 2, 6, 4, 10, 'cp');
  setPixel(g, 2, 6, 'cpl');
  // javelin arm cocked back overhead for the throw
  fillRect(g, 8, 4, 12, 5, 'sk');
  fillRect(g, 11, 0, 12, 4, 'ja');
  setPixel(g, 12, 0, 'me');
  // legs mid-stride, front leg extended
  fillRect(g, 8, 11, 10, 12, 'cl');
  fillRect(g, 10, 13, 13, 14, 'sk');
  fillRect(g, 5, 11, 6, 14, 'cl');
  fillRect(g, 5, 11, 5, 12, 'cll');
  fillRect(g, 12, 15, 14, 15, 'bo');
  fillRect(g, 4, 15, 7, 15, 'bo');
  return battle('skirmisher', {
    o: OUTLINE, sk: SKIN.orc, ho: EARTH.shadow,
    cl: SAND.mid, cll: SAND.light, cld: SAND.dark,
    cp: SAND.dark, cpl: SAND.mid,
    ja: EARTH.dark, me: METAL.light, bo: EARTH.shadow,
  }, g);
}

// ---------------------------------------------------------------------------
// 9. Flyer — bat-winged, held clear of the ground line (nothing painted
// below row 12) with both wings spread wide mid-beat.
function flyer(): Sprite {
  const g = makeGrid(SIZE);
  // wings, spread wide, ragged leathery tips
  fillRect(g, 0, 3, 5, 7, 'wi');
  fillRect(g, 0, 3, 1, 5, 'wil');
  fillRect(g, 4, 6, 5, 7, 'wid');
  plot(g, [[0, 3], [2, 2], [0, 8], [3, 8]], 'wi');
  fillRect(g, 10, 3, 15, 7, 'wi');
  fillRect(g, 10, 3, 11, 5, 'wil');
  fillRect(g, 14, 6, 15, 7, 'wid');
  plot(g, [[15, 3], [13, 2], [15, 8], [12, 8]], 'wi');
  // small hunched body, clear of the ground
  fillRect(g, 6, 4, 9, 8, 'sk');
  fillRect(g, 6, 4, 7, 5, 'skl');
  fillRect(g, 8, 6, 9, 8, 'skd');
  fillRect(g, 6, 2, 9, 4, 'sk');
  setPixel(g, 8, 3, 'ey');
  setPixel(g, 9, 4, 'o');
  fillRect(g, 6, 9, 9, 11, 'sk');
  // clawed feet drawn up beneath the body, still above the ground line
  plot(g, [[6, 12], [9, 12]], 'skd');
  return battle('flyer', {
    o: OUTLINE, sk: SKIN.orcDark, skl: SKIN.orc, skd: DEATH.purple, ey: CHAOS.red,
    wi: STONE.dark, wil: STONE.mid, wid: DEATH.purple,
  }, g);
}

// ---------------------------------------------------------------------------
// 10. Mage — long robe to the ground, raised staff topped with a single
// glowing pixel; the vertical staff + glow is the unmistakable read.
function mage(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 3, 9, 5, 'sk');
  fillRect(g, 5, 0, 10, 3, 'ro');
  fillRect(g, 5, 0, 6, 1, 'rol');
  setPixel(g, 9, 4, 'o');
  // robe, floor length
  fillRect(g, 5, 6, 10, 14, 'ro');
  fillRect(g, 5, 6, 6, 8, 'rol');
  fillRect(g, 9, 10, 10, 14, 'rod');
  fillRect(g, 4, 15, 11, 15, 'rod');
  fillRect(g, 4, 6, 4, 9, 'ro');
  // staff, raised, glowing tip
  fillRect(g, 11, 3, 12, 13, 'st');
  setPixel(g, 11, 3, 'stl');
  shadeDisc(g, 11, 1, 1, 'gl', 'gll', 'gl');
  fillRect(g, 10, 8, 11, 9, 'sk');
  return battle('mage', {
    o: OUTLINE, sk: SKIN.human,
    ro: DEATH.purple, rol: DEATH.purpleLight, rod: DEATH.voidBlack,
    st: EARTH.dark, stl: EARTH.light, gl: LIFE.crystalBlue, gll: LIFE.crystalBlueLight,
  }, g);
}

// ---------------------------------------------------------------------------
// 11. Undead — ragged and hunched, hollow black eye sockets, one clawed arm
// raised. Same bone family as the units.ts skeleton but a rangier pose.
function undead(): Sprite {
  const g = makeGrid(SIZE);
  fillRect(g, 6, 2, 9, 5, 'bo');
  setPixel(g, 7, 4, 'ey');
  setPixel(g, 8, 4, 'ey');
  fillRect(g, 6, 2, 7, 2, 'bol');
  fillRect(g, 8, 5, 9, 5, 'bod');
  // hunched ribcage, torso leaning right
  fillRect(g, 6, 6, 9, 10, 'bo');
  fillRect(g, 6, 7, 6, 9, 'bod');
  fillRect(g, 8, 7, 8, 9, 'bod');
  // tattered cloth strips over the hips
  plot(g, [[6, 10], [7, 11], [9, 10], [8, 12]], 'cl');
  // one arm raised clawing forward, one hanging low
  fillRect(g, 9, 5, 12, 6, 'bo');
  plot(g, [[12, 4], [13, 4], [12, 3]], 'bo');
  fillRect(g, 5, 8, 5, 12, 'bo');
  // uneven legs, one shorter — a shambling stance
  fillRect(g, 6, 11, 7, 14, 'bo');
  fillRect(g, 8, 11, 9, 13, 'bo');
  fillRect(g, 6, 11, 6, 12, 'bol');
  fillRect(g, 8, 12, 9, 13, 'bod');
  fillRect(g, 5, 15, 7, 15, 'bod');
  fillRect(g, 7, 14, 9, 14, 'bod');
  return battle('undead', {
    o: OUTLINE, bo: DEATH.boneWhite, bol: DEATH.boneBright, bod: DEATH.boneShadow,
    ey: DEATH.voidBlack, cl: DEATH.purple,
  }, g);
}

// ---------------------------------------------------------------------------
// 12. Celestial — wings raised and open (not folded, unlike the units.ts
// angel), a bright halo glint, white/gold throughout for max contrast
// against the darker archetypes it fights alongside.
function celestial(): Sprite {
  const g = makeGrid(SIZE);
  setPixel(g, 7, 0, 'go');
  fillRect(g, 6, 0, 9, 0, 'go');
  // wings, raised open above the shoulders
  fillRect(g, 1, 1, 5, 7, 'wi');
  fillRect(g, 1, 1, 2, 3, 'wil');
  fillRect(g, 4, 5, 5, 7, 'wid');
  fillRect(g, 10, 1, 14, 7, 'wi');
  fillRect(g, 13, 1, 14, 3, 'wil');
  fillRect(g, 10, 5, 11, 7, 'wid');
  fillRect(g, 6, 2, 9, 4, 'sk');
  setPixel(g, 9, 3, 'o');
  fillRect(g, 5, 5, 10, 10, 'ro');
  fillRect(g, 5, 5, 6, 6, 'rol');
  fillRect(g, 9, 8, 10, 10, 'rod');
  fillRect(g, 5, 8, 10, 8, 'go');
  fillRect(g, 4, 6, 4, 8, 'ro');
  fillRect(g, 10, 6, 11, 8, 'sk');
  fillRect(g, 5, 11, 10, 14, 'ro');
  fillRect(g, 5, 11, 6, 12, 'rol');
  fillRect(g, 9, 13, 10, 14, 'rod');
  fillRect(g, 4, 15, 11, 15, 'rod');
  return battle('celestial', {
    o: OUTLINE, sk: SKIN.human,
    ro: LIFE.white, rol: LIFE.goldLight, rod: LIFE.whiteShadow, go: LIFE.gold,
    wi: LIFE.crystalBlueLight, wil: LIFE.white, wid: LIFE.crystalBlueDark,
  }, g);
}

// ---------------------------------------------------------------------------
// 13. Beast — low quadruped predator, mid-lunge with an open jaw and
// trailing tail; the only four-legged non-mounted silhouette in the set.
function beast(): Sprite {
  const g = makeGrid(SIZE);
  // low horizontal body
  fillRect(g, 2, 8, 11, 11, 'fu');
  fillRect(g, 2, 8, 4, 9, 'ful');
  fillRect(g, 8, 10, 11, 11, 'fud');
  // head thrust forward, low, jaw open
  fillRect(g, 10, 6, 14, 9, 'fu');
  setPixel(g, 13, 7, 'ey');
  fillRect(g, 12, 9, 15, 10, 'ja');
  setPixel(g, 15, 9, 'to');
  // tail, curled up behind
  plot(g, [[1, 7], [0, 6], [0, 5], [1, 4]], 'fu');
  // legs, mid-stride
  fillRect(g, 3, 12, 4, 15, 'fu');
  fillRect(g, 9, 12, 10, 15, 'fu');
  setPixel(g, 3, 15, 'fud');
  setPixel(g, 9, 15, 'fud');
  plot(g, [[6, 13], [6, 14]], 'fud');
  plot(g, [[12, 11], [12, 12]], 'fud');
  return battle('beast', {
    o: OUTLINE, fu: EARTH.mid, ful: EARTH.light, fud: EARTH.shadow,
    ey: CHAOS.red, ja: STONE.shadow, to: DEATH.boneWhite,
  }, g);
}

// ---------------------------------------------------------------------------
// 14. Dragon — the showpiece: wings filling the top of the cell, a long
// neck reaching right into an open-jawed head, one flame pixel cluster.
// May crowd the full 16x16.
function dragon(): Sprite {
  const g = makeGrid(SIZE);
  // wings, swept back and filling the upper half
  fillRect(g, 0, 0, 7, 5, 'wi');
  fillRect(g, 0, 0, 2, 2, 'wil');
  fillRect(g, 5, 3, 7, 5, 'wid');
  plot(g, [[0, 0], [3, 6], [7, 6], [1, 3]], 'wi');
  fillRect(g, 4, 1, 9, 4, 'wi');
  fillRect(g, 4, 1, 5, 2, 'wil');
  // body, low and long
  fillRect(g, 2, 8, 9, 12, 'sc');
  fillRect(g, 2, 8, 4, 9, 'scl');
  fillRect(g, 7, 10, 9, 12, 'scd');
  // long neck reaching right and up into the head
  fillRect(g, 8, 5, 11, 9, 'sc');
  fillRect(g, 10, 4, 14, 7, 'sc');
  fillRect(g, 10, 4, 11, 5, 'scl');
  setPixel(g, 13, 5, 'ey');
  fillRect(g, 13, 6, 15, 7, 'ja');
  // breath-flame pixel cluster at the jaw
  plot(g, [[15, 6], [15, 5]], 'fl');
  setPixel(g, 15, 4, 'fll');
  // tail curling at the bottom-left
  plot(g, [[1, 12], [0, 13], [0, 14], [1, 15]], 'sc');
  // legs
  fillRect(g, 3, 13, 4, 15, 'sc');
  fillRect(g, 7, 13, 8, 15, 'sc');
  fillRect(g, 3, 15, 4, 15, 'scd');
  fillRect(g, 7, 15, 8, 15, 'scd');
  return battle('dragon', {
    o: OUTLINE, sc: CHAOS.red, scl: DEATH.ember, scd: DEATH.ashDark,
    wi: DEATH.ashDark, wil: DEATH.ashLight, wid: DEATH.voidBlack,
    ey: LIFE.goldLight, ja: STONE.shadow, fl: DEATH.ember, fll: DEATH.emberLight,
  }, g);
}

// ---------------------------------------------------------------------------
// Lair (24x24, strategic map) — a dark cave mouth in a rocky knoll with
// scattered bones. Kept in this file (rather than joining cities.ts, which
// this milestone's owner does not touch) since it's a battle-adjacent
// strategic marker seeded specifically for the "clear a lair" encounters
// this milestone introduces. Like the city sprites, only its footprint is
// painted — the rest stays transparent so it reads against any terrain tile.
function lair(): Sprite {
  const g = makeGrid(LAIR_SIZE);
  // rocky knoll mound, asymmetric
  shadeDisc(g, 10, 15, 9, 'rk', 'rkl', 'rkd');
  shadeDisc(g, 17, 17, 6, 'rk', 'rkl', 'rkd');
  fillRect(g, 1, 20, 22, 23, 'gr');
  ditherRect(g, 1, 20, 22, 21, 'gr', 'grl', 0.25);
  // cave mouth: a dark arched opening cut into the knoll
  fillRect(g, 7, 12, 14, 19, 'vo');
  fillRect(g, 8, 10, 13, 12, 'vo');
  fillRect(g, 9, 9, 12, 10, 'vo');
  fillRect(g, 6, 15, 6, 19, 'rkd');
  fillRect(g, 15, 15, 15, 19, 'rkd');
  // scattered bones around the entrance
  fillRect(g, 3, 20, 6, 20, 'bo');
  setPixel(g, 4, 19, 'bo');
  fillRect(g, 16, 21, 19, 21, 'bo');
  setPixel(g, 18, 20, 'bo');
  plot(g, [[2, 21], [5, 22], [17, 19], [20, 22], [11, 21]], 'bo');
  shadeDisc(g, 20, 21, 1, 'bo', 'bol', 'bo');
  shadeDisc(g, 5, 22, 1, 'bo', 'bol', 'bo');
  return compileSprite('lair', LAIR_SIZE, g, {
    rk: STONE.mid, rkl: STONE.light, rkd: STONE.shadow,
    gr: EARTH.dark, grl: EARTH.mid,
    vo: DEATH.voidBlack, bo: DEATH.boneWhite, bol: DEATH.boneBright,
  });
}

export const BATTLE_SPRITES: Sprite[] = [
  spearman(), swordsman(), archer(), crossbowman(), cavalry(),
  brute(), swarm(), skirmisher(), flyer(), mage(),
  undead(), celestial(), beast(), dragon(),
];

// The lair is 24x24 — a different cell size than the 16x16 battle
// archetypes above, so packSheet can't lay it out on the same sheet (it
// requires every sprite on a sheet to match the sheet's cellSize exactly).
// Choice: it gets its own single-sprite 'lair' sheet at 24px cells rather
// than joining cities.ts (out of scope for this milestone) or forcing a
// mixed-size 'battle' sheet. See build.ts's SHEETS list.
export const LAIR_SPRITES: Sprite[] = [lair()];
