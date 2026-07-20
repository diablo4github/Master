/**
 * The full unit roster: generic core + one roster per world + creatures
 * (summons and lair monsters). Sub-files own their slices; ids must be
 * globally unique (tested).
 */
import type { UnitDef } from '../../sim/types';
import { CORE_UNITS } from './core';
import { MERIDIA_UNITS } from './meridia';
import { UMBRA_UNITS, LUMINA_UNITS } from './umbra-lumina';
import { CREATURE_UNITS } from './creatures';

export const UNITS: Record<string, UnitDef> = {
  ...CORE_UNITS,
  ...MERIDIA_UNITS,
  ...UMBRA_UNITS,
  ...LUMINA_UNITS,
  ...CREATURE_UNITS,
};
