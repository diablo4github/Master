/**
 * Pure helpers for magic-tier structure.
 *
 * DESIGN.md: "Magic comes in three tiers per school", reached by school
 * focus — magicTierCap(schoolCount) caps how deep a wizard may research in
 * EVERY school they know (1 school -> tier 3, 2 -> tier 2, 3 -> tier 1). This
 * module derives the research panel's Magic-tab grouping (school -> tier I/II/
 * III buckets, each flagged locked/unlocked) and the wizard-card mastery hint,
 * so both gameScreen.ts and newGame.ts share one source of truth.
 *
 * No DOM — unit-tested directly.
 */

import type { SchoolId, StudyDef } from '@sim/types';
import { magicTierCap } from '@sim/types';

/** Roman-numeral tier headers, per DESIGN.md's tier ladder. */
export const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'TIER I — Initiate',
  2: 'TIER II — Adept',
  3: 'TIER III — Master',
};

/**
 * One-line explanation for a tier that sits above the wizard's cap, phrased
 * by cause (dual-school vs triple-school). Null when the tier is unlocked.
 */
export function tierLockReason(cap: 0 | 1 | 2 | 3, tier: 1 | 2 | 3): string | null {
  if (tier <= cap) return null;
  if (cap === 2) return 'Tier III is reserved for wizards of a single school.';
  return 'Tiers II–III require deeper school focus — your three schools reach only Tier I.';
}

export interface MagicTierGroup {
  tier: 1 | 2 | 3;
  label: string;
  locked: boolean;
  lockReason: string | null;
  studies: StudyDef[];
}

export interface MagicSchoolGroup {
  school: SchoolId;
  cap: 0 | 1 | 2 | 3;
  tiers: MagicTierGroup[];
}

/**
 * Groups a wizard's known-school magic studies into per-school, per-tier
 * buckets (TIER I/II/III in that order), each flagged locked/unlocked against
 * magicTierCap(schools.length). Studies missing a `.tier` (race studies never
 * carry one; magic-school content mid-migration may not either) default to
 * tier 1. Every tier bucket is returned even when empty, so the panel always
 * renders all three headers for a known school — readable and stable
 * regardless of how much tiered content currently exists.
 */
export function magicSchoolGroups(
  studies: readonly StudyDef[],
  schools: readonly SchoolId[],
): MagicSchoolGroup[] {
  const cap = magicTierCap(schools.length);
  return schools.map((school) => {
    const schoolStudies = studies
      .filter((s) => s.school === school)
      .slice()
      .sort((a, b) => a.cost - b.cost);
    const tiers: MagicTierGroup[] = ([1, 2, 3] as const).map((tier) => {
      const lockReason = tierLockReason(cap, tier);
      return {
        tier,
        label: TIER_LABELS[tier],
        locked: lockReason !== null,
        lockReason,
        studies: schoolStudies.filter((s) => (s.tier ?? 1) === tier),
      };
    });
    return { school, cap, tiers };
  });
}

/**
 * Ids of magic studies the wizard's school focus permits researching (their
 * school is known AND their tier <= cap). Race studies (no `.school`) are
 * outside this gate entirely — callers should union this with the race shelf.
 */
export function selectableMagicStudyIds(
  studies: readonly StudyDef[],
  schools: readonly SchoolId[],
): Set<string> {
  const cap = magicTierCap(schools.length);
  const out = new Set<string>();
  for (const s of studies) {
    if (!s.school || !schools.includes(s.school)) continue;
    if ((s.tier ?? 1) <= cap) out.add(s.id);
  }
  return out;
}

/**
 * Subtle wizard-card hint summarizing the mastery/generalist dial for a given
 * school count (see DESIGN.md's Focus/Reach table).
 */
export function masteryHint(schoolCount: number): string {
  if (schoolCount === 2) return 'Tier II ×2 schools';
  if (schoolCount >= 3) return 'Tier I ×3 schools';
  return 'Mastery: Tier III';
}
