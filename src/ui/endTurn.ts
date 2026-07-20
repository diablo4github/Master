/**
 * End Turn as a DECISION ASSISTANT (docs/DESIGN.md "Management Philosophy").
 *
 * `endTurnDecision` is a pure function of game state: it decides what a click on
 * the End Turn button should do BEFORE the click, so the button can label itself
 * honestly. Rules, in order:
 *
 *   (a) research is unset AND at least one study is selectable  → 'research'
 *   (b) some owned city has an EMPTY build queue                → 'production:cityId'
 *       (repeated clicks cycle through every such city)
 *   (c) otherwise                                               → 'advance'
 *
 * The caller passes the currently-selected city id (if any) so that when the
 * player is already looking at an empty-queue city, the next click advances to
 * the NEXT empty-queue city rather than re-opening the same one.
 */

import type { GameState, GameContent } from '@sim/core/state';

export type EndTurnDecision =
  | { kind: 'research' }
  | { kind: 'production'; cityId: string }
  | { kind: 'advance' };

/**
 * True when the player has at least one magical study they could select right
 * now: in their race's tree, not already completed, with all prerequisites met.
 */
export function hasSelectableStudy(
  state: GameState,
  content: GameContent,
  playerId: string,
): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  const race = content.races[player.setup.raceId];
  if (!race) return false;
  for (const sid of race.studies) {
    if (player.completedStudies.includes(sid)) continue;
    const def = content.studies[sid];
    if (!def) continue;
    const reqs = def.requires ?? [];
    if (reqs.every((r) => player.completedStudies.includes(r))) return true;
  }
  return false;
}

/** Owned cities (stable state order) whose build queue is empty. */
export function emptyQueueCities(state: GameState, playerId: string): string[] {
  return state.cities
    .filter((c) => c.owner === playerId && c.buildQueue.length === 0)
    .map((c) => c.id);
}

/**
 * Decide what clicking End Turn should do. `selectedCityId` is the city panel's
 * current selection (or null); when it names an empty-queue city, the decision
 * cycles to the NEXT empty-queue city so repeated clicks walk every idle city.
 */
export function endTurnDecision(
  state: GameState,
  content: GameContent,
  playerId: string,
  selectedCityId?: string | null,
): EndTurnDecision {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { kind: 'advance' };

  // (a) Research needs choosing and there is something choosable.
  if (player.research.activeStudyId === null && hasSelectableStudy(state, content, playerId)) {
    return { kind: 'research' };
  }

  // (b) An idle city wants an order. Cycle through them on repeated clicks.
  const idle = emptyQueueCities(state, playerId);
  if (idle.length > 0) {
    let next = idle[0] as string;
    if (selectedCityId) {
      const i = idle.indexOf(selectedCityId);
      if (i >= 0) next = idle[(i + 1) % idle.length] as string;
    }
    return { kind: 'production', cityId: next };
  }

  // (c) Nothing needs the player — advance.
  return { kind: 'advance' };
}

/** The button label for a decision (city name resolved by the caller). */
export function endTurnLabel(decision: EndTurnDecision, cityName?: string): string {
  switch (decision.kind) {
    case 'research':
      return 'Choose Research';
    case 'production':
      return `Choose Production${cityName ? ` (${cityName})` : ''}`;
    case 'advance':
      return 'End Turn ▸';
  }
}
