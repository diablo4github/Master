/**
 * Assembled game content.
 *
 * Pure constant composition: gathers the individual data modules into the
 * single `GameContent` object the sim consumes via `createGame` /
 * `applyCommand` / `advanceTurn`. No logic lives here — every field is one of
 * the existing `src/data` registries, re-exported in the shape the sim wants.
 *
 * The sim never imports `src/data` directly (see docs/ARCHITECTURE.md); the
 * presentation layer injects this object instead.
 */

import type { GameContent } from '@sim/core/state';
import type { PlaneDef } from '@sim/types';

import { PLANES } from './planes';
import { RACES } from './races';
import { BUILDINGS } from './buildings';
import { UNITS } from './units';
import { STUDIES } from './studies';

/** The eight plane definitions as the array the sim expects. */
export const PLANE_LIST: PlaneDef[] = Object.values(PLANES) as PlaneDef[];

/** The single content bundle handed to the sim for a real (non-test) game. */
export const CONTENT: GameContent = {
  planes: PLANE_LIST,
  races: RACES,
  buildings: BUILDINGS,
  units: UNITS,
  studies: STUDIES,
};
