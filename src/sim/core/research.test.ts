/**
 * Two research shelves: a study is legal if it is in the player's RACE studies
 * list OR it is a magic study whose school the wizard knows
 * (player.setup.schools). Prereqs for a school study are validated against that
 * school tree's own chain. Uses bespoke inline content (school studies added to
 * the shared fixture) so the sim never touches src/data.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from './turn';
import type { GameContent, GameState, PlayerState } from './state';
import { CONTENT, makeMap, makeState, makePlayer } from '../__fixtures__/content';
import type { SchoolId, StudyDef } from '../types';

const ME = 'player-0';

// Two Chaos magic studies forming a prereq chain within the school tree.
const CHAOS_STUDIES: StudyDef[] = [
  { id: 'chaos-firebolt', name: 'Firebolt', school: 'chaos', cost: 20, effects: {}, description: 'Chaos basics.' },
  {
    id: 'chaos-firestorm',
    name: 'Firestorm',
    school: 'chaos',
    cost: 40,
    requires: ['chaos-firebolt'],
    effects: {},
    description: 'Requires Firebolt (same school tree).',
  },
];

const RESEARCH_CONTENT: GameContent = {
  ...CONTENT,
  studies: { ...CONTENT.studies, 'chaos-firebolt': CHAOS_STUDIES[0]!, 'chaos-firestorm': CHAOS_STUDIES[1]! },
};

/** An orc player whose wizard knows the given schools (pass undefined for none). */
function researchState(schools: readonly SchoolId[] | undefined): GameState {
  const player: PlayerState = makePlayer(ME, 'orc');
  player.setup = { ...player.setup, schools };
  return makeState({ maps: [makeMap('meridia', 8, 8, 'grassland')], players: [player] });
}

describe('set-research two shelves', () => {
  it('allows a school study when the wizard knows that school', () => {
    const s = applyCommand(researchState(['chaos']), RESEARCH_CONTENT, ME, {
      type: 'set-research', studyId: 'chaos-firebolt',
    });
    expect(s.players[0]!.research).toEqual({ activeStudyId: 'chaos-firebolt', progress: 0 });
  });

  it('rejects a school study when the wizard lacks that school, with a clear error', () => {
    // Nature wizard cannot touch the Chaos tree.
    expect(() =>
      applyCommand(researchState(['nature']), RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'chaos-firebolt' }),
    ).toThrow(/cannot research/i);
    // A wizard with no schools at all is likewise barred.
    expect(() =>
      applyCommand(researchState(undefined), RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'chaos-firebolt' }),
    ).toThrow(/cannot research/i);
  });

  it('validates a school study prereq against its own school tree', () => {
    // firestorm needs firebolt first, even though both are school studies.
    expect(() =>
      applyCommand(researchState(['chaos']), RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'chaos-firestorm' }),
    ).toThrow(/requires/);
    // With firebolt completed, firestorm becomes legal.
    const done = researchState(['chaos']);
    done.players[0]!.completedStudies = ['chaos-firebolt'];
    const s = applyCommand(done, RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'chaos-firestorm' });
    expect(s.players[0]!.research.activeStudyId).toBe('chaos-firestorm');
  });

  it('leaves race-study legality unchanged (allowed on the race list, rejected off both shelves)', () => {
    // war-drums is an orc race study — always legal regardless of schools.
    const s = applyCommand(researchState(['chaos']), RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'war-drums' });
    expect(s.players[0]!.research.activeStudyId).toBe('war-drums');
    // A study on neither shelf (not orc race study, wrong school) is rejected.
    expect(() =>
      applyCommand(researchState(['nature']), RESEARCH_CONTENT, ME, { type: 'set-research', studyId: 'chaos-firebolt' }),
    ).toThrow(/cannot research/i);
  });
});
