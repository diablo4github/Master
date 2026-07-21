import { describe, expect, it } from 'vitest';

import type { StudyDef } from '@sim/types';
import { magicTierCap } from '@sim/types';
import {
  magicSchoolGroups,
  masteryHint,
  selectableMagicStudyIds,
  tierLockReason,
  TIER_LABELS,
} from './magicTiers';

function study(id: string, school: 'life' | 'death' | 'chaos', tier?: 1 | 2 | 3, cost = 10): StudyDef {
  return { id, name: id, school, tier, cost, effects: {}, description: '' };
}

describe('tierLockReason', () => {
  it('is unlocked (null) for every tier at or under the cap', () => {
    expect(tierLockReason(3, 1)).toBeNull();
    expect(tierLockReason(3, 2)).toBeNull();
    expect(tierLockReason(3, 3)).toBeNull();
    expect(tierLockReason(2, 1)).toBeNull();
    expect(tierLockReason(2, 2)).toBeNull();
    expect(tierLockReason(1, 1)).toBeNull();
  });

  it('phrases the dual-school cap (2) lock as reserved for single-school wizards', () => {
    expect(tierLockReason(2, 3)).toBe('Tier III is reserved for wizards of a single school.');
  });

  it('phrases the triple-school cap (1) lock as needing deeper focus', () => {
    expect(tierLockReason(1, 2)).toBe(
      'Tiers II–III require deeper school focus — your three schools reach only Tier I.',
    );
    expect(tierLockReason(1, 3)).toBe(
      'Tiers II–III require deeper school focus — your three schools reach only Tier I.',
    );
  });
});

describe('magicTierCap (sim invariant this module builds on)', () => {
  it('maps school count to the documented cap ladder', () => {
    expect(magicTierCap(1)).toBe(3);
    expect(magicTierCap(2)).toBe(2);
    expect(magicTierCap(3)).toBe(1);
  });
});

describe('magicSchoolGroups', () => {
  const studies = [
    study('life-1a', 'life', 1, 10),
    study('life-1b', 'life', 1, 5),
    study('life-2a', 'life', 2, 20),
    study('life-3a', 'life', 3, 40),
    study('death-1a', 'death', 1, 10), // different school — must not leak into life group
  ];

  it('returns one group per known school, tiers always in I, II, III order', () => {
    const groups = magicSchoolGroups(studies, ['life']);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.school).toBe('life');
    expect(groups[0]!.tiers.map((t) => t.tier)).toEqual([1, 2, 3]);
    expect(groups[0]!.tiers.map((t) => t.label)).toEqual([
      TIER_LABELS[1],
      TIER_LABELS[2],
      TIER_LABELS[3],
    ]);
  });

  it('buckets studies by tier, sorted by cost within a school, excluding other schools', () => {
    const [group] = magicSchoolGroups(studies, ['life']);
    const tier1 = group!.tiers[0]!;
    expect(tier1.studies.map((s) => s.id)).toEqual(['life-1b', 'life-1a']); // cost 5 before 10
    expect(group!.tiers[1]!.studies.map((s) => s.id)).toEqual(['life-2a']);
    expect(group!.tiers[2]!.studies.map((s) => s.id)).toEqual(['life-3a']);
    expect(group!.tiers.flatMap((t) => t.studies.map((s) => s.id))).not.toContain('death-1a');
  });

  it('returns an empty (not omitted) tier bucket when a school has no studies at that tier', () => {
    const groups = magicSchoolGroups([study('life-1a', 'life', 1)], ['life']);
    expect(groups[0]!.tiers).toHaveLength(3);
    expect(groups[0]!.tiers[1]!.studies).toEqual([]);
    expect(groups[0]!.tiers[2]!.studies).toEqual([]);
  });

  it('defaults a study missing `.tier` to Tier I', () => {
    const untiered = study('life-legacy', 'life', undefined);
    const groups = magicSchoolGroups([untiered], ['life']);
    expect(groups[0]!.tiers[0]!.studies.map((s) => s.id)).toEqual(['life-legacy']);
  });

  it('locks tiers above the cap: single school unlocks all three', () => {
    const groups = magicSchoolGroups(studies, ['life']);
    expect(groups[0]!.tiers.map((t) => t.locked)).toEqual([false, false, false]);
  });

  it('locks tiers above the cap: two schools unlock only I and II', () => {
    const groups = magicSchoolGroups(studies, ['life', 'death']);
    const life = groups.find((g) => g.school === 'life')!;
    expect(life.tiers.map((t) => t.locked)).toEqual([false, false, true]);
    expect(life.tiers[2]!.lockReason).toMatch(/single school/);
  });

  it('locks tiers above the cap: three schools unlock only I', () => {
    const groups = magicSchoolGroups(studies, ['life', 'death', 'chaos']);
    const life = groups.find((g) => g.school === 'life')!;
    expect(life.tiers.map((t) => t.locked)).toEqual([false, true, true]);
  });
});

describe('selectableMagicStudyIds', () => {
  const studies = [
    study('life-1', 'life', 1),
    study('life-2', 'life', 2),
    study('life-3', 'life', 3),
    study('death-1', 'death', 1),
  ];

  it('a pure mage (1 school) may select every tier of their school', () => {
    const ids = selectableMagicStudyIds(studies, ['life']);
    expect(ids.has('life-1')).toBe(true);
    expect(ids.has('life-2')).toBe(true);
    expect(ids.has('life-3')).toBe(true);
  });

  it('excludes studies whose tier exceeds the cap', () => {
    const ids = selectableMagicStudyIds(studies, ['life', 'death']); // cap 2
    expect(ids.has('life-1')).toBe(true);
    expect(ids.has('life-2')).toBe(true);
    expect(ids.has('life-3')).toBe(false); // locked out
  });

  it('excludes studies from a school the wizard does not know', () => {
    const ids = selectableMagicStudyIds(studies, ['life']);
    expect(ids.has('death-1')).toBe(false);
  });

  it('excludes race studies (no `.school`) entirely — they are outside this gate', () => {
    const raceStudy: StudyDef = { id: 'race-1', name: 'Race 1', cost: 5, effects: {}, description: '' };
    const ids = selectableMagicStudyIds([...studies, raceStudy], ['life']);
    expect(ids.has('race-1')).toBe(false);
  });
});

describe('masteryHint', () => {
  it('reflects the mastery/generalist dial per DESIGN.md', () => {
    expect(masteryHint(1)).toBe('Mastery: Tier III');
    expect(masteryHint(2)).toBe('Tier II ×2 schools');
    expect(masteryHint(3)).toBe('Tier I ×3 schools');
  });
});
