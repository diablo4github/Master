import { describe, expect, it } from 'vitest';
import { SCHOOL_IDS, isLegalSchoolCombo, legalStartWorlds } from '@sim/types';
import type { RetortDef, SchoolId, WizardDef } from '@sim/types';
import { SCHOOLS } from './schools';
import { PLANES } from './planes';
import { RETORTS } from './retorts';
import { WIZARDS } from './wizards';

// The source files use `as const satisfies Record<...>` to keep literal
// types tight for content authors. That produces a union of exact literal
// object types, which TS unions awkwardly (e.g. `.includes` on a union of
// readonly tuples degrades to `never`). Re-widen to the plain interfaces
// here so the test bodies below can use ordinary array/interface semantics.
const retortList: RetortDef[] = Object.values(RETORTS);
const retortById: Record<string, RetortDef> = RETORTS;
const wizardList: WizardDef[] = Object.values(WIZARDS);

describe('schools', () => {
  it('has exactly 5 schools, matching SCHOOL_IDS', () => {
    const ids = Object.keys(SCHOOLS).sort();
    expect(ids).toEqual([...SCHOOL_IDS].sort());
    expect(ids).toHaveLength(5);
  });

  it('every school def id matches its key', () => {
    for (const [key, def] of Object.entries(SCHOOLS)) {
      expect(def.id).toBe(key);
    }
  });
});

describe('planes', () => {
  it('has exactly 8 planes', () => {
    expect(Object.keys(PLANES)).toHaveLength(8);
  });

  it('has exactly 3 worlds and 5 dimensions', () => {
    const planes = Object.values(PLANES);
    const worlds = planes.filter((p) => p.kind === 'world');
    const dimensions = planes.filter((p) => p.kind === 'dimension');
    expect(worlds).toHaveLength(3);
    expect(dimensions).toHaveLength(5);
  });

  it('every plane def id matches its key', () => {
    for (const [key, def] of Object.entries(PLANES)) {
      expect(def.id).toBe(key);
    }
  });

  it('each dimension school is unique and matches SCHOOLS[school].dimension', () => {
    const dimensions = Object.values(PLANES).filter((p) => p.kind === 'dimension');
    const schools = dimensions.map((d) => d.school);
    expect(schools.every((s) => s !== undefined)).toBe(true);
    expect(new Set(schools).size).toBe(dimensions.length);

    for (const dim of dimensions) {
      const school = dim.school as SchoolId;
      expect(SCHOOLS[school].dimension).toBe(dim.id);
    }

    // Every school has exactly one dimension, and it appears in PLANES.
    for (const schoolId of SCHOOL_IDS) {
      const dimId = SCHOOLS[schoolId].dimension;
      expect(PLANES[dimId].kind).toBe('dimension');
      expect(PLANES[dimId].school).toBe(schoolId);
    }
  });

  it('worlds cover meridia, umbra, lumina', () => {
    const worldIds = Object.values(PLANES)
      .filter((p) => p.kind === 'world')
      .map((p) => p.id)
      .sort();
    expect(worldIds).toEqual(['lumina', 'meridia', 'umbra']);
  });
});

describe('retorts', () => {
  it('every retort def id matches its key', () => {
    for (const [key, def] of Object.entries(RETORTS)) {
      expect(def.id).toBe(key);
    }
  });

  it('includes the two start-world retorts', () => {
    expect(RETORTS['umbral-covenant'].grantsStartWorld).toBe('umbra');
    expect(RETORTS['luminous-covenant'].grantsStartWorld).toBe('lumina');
  });

  it('has between 18 and 24 build-defining retorts (excluding start-world)', () => {
    const buildDefining = retortList.filter((r) => !r.grantsStartWorld);
    expect(buildDefining.length).toBeGreaterThanOrEqual(18);
    expect(buildDefining.length).toBeLessThanOrEqual(24);
  });

  it('every retort has a cost between 1 and 3', () => {
    for (const retort of retortList) {
      expect(retort.cost).toBeGreaterThanOrEqual(1);
      expect(retort.cost).toBeLessThanOrEqual(3);
    }
  });
});

describe('wizards', () => {
  it('has exactly 21 premade wizards', () => {
    expect(Object.keys(WIZARDS)).toHaveLength(21);
  });

  it('every wizard def id matches its key', () => {
    for (const [key, def] of Object.entries(WIZARDS)) {
      expect(def.id).toBe(key);
    }
  });

  it('every wizard has a legal school combo', () => {
    for (const wizard of wizardList) {
      expect(isLegalSchoolCombo(wizard.schools)).toBe(true);
    }
  });

  it('has 5 single-school, 9 two-school, and 7 three-school wizards', () => {
    const wizards = wizardList;
    const single = wizards.filter((w) => w.schools.length === 1);
    const double = wizards.filter((w) => w.schools.length === 2);
    const triple = wizards.filter((w) => w.schools.length === 3);
    expect(single).toHaveLength(5);
    expect(double).toHaveLength(9);
    expect(triple).toHaveLength(7);
  });

  it('every legal school combination appears exactly once', () => {
    const seen = new Map<string, number>();
    for (const wizard of wizardList) {
      const key = [...wizard.schools].sort().join('+');
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }

    // Build the full set of legal combos from SCHOOL_IDS (sizes 1-3).
    const expectedKeys = new Set<string>();
    const ids = [...SCHOOL_IDS];
    const combos: SchoolId[][] = [];
    const choose = (start: number, picked: SchoolId[]) => {
      if (picked.length > 0) combos.push([...picked]);
      if (picked.length === 3) return;
      for (let i = start; i < ids.length; i++) {
        picked.push(ids[i]!);
        choose(i + 1, picked);
        picked.pop();
      }
    };
    choose(0, []);
    for (const combo of combos) {
      if (isLegalSchoolCombo(combo)) {
        expectedKeys.add([...combo].sort().join('+'));
      }
    }

    expect(expectedKeys.size).toBe(21);
    expect(new Set(seen.keys())).toEqual(expectedKeys);
    for (const count of seen.values()) {
      expect(count).toBe(1);
    }
  });

  it('every wizard retort id exists in RETORTS', () => {
    for (const wizard of wizardList) {
      for (const retortId of wizard.retorts) {
        expect(retortById[retortId], `${wizard.id} -> ${retortId}`).toBeDefined();
      }
    }
  });

  it('every wizard has 2-4 default retorts', () => {
    for (const wizard of wizardList) {
      expect(wizard.retorts.length).toBeGreaterThanOrEqual(2);
      expect(wizard.retorts.length).toBeLessThanOrEqual(4);
    }
  });

  it('school-restricted retorts in a wizard loadout match the wizard schools', () => {
    for (const wizard of wizardList) {
      for (const retortId of wizard.retorts) {
        const retort = retortById[retortId];
        expect(retort, `${wizard.id} -> ${retortId}`).toBeDefined();
        if (retort?.requiresSchool) {
          expect(wizard.schools).toContain(retort.requiresSchool);
        }
      }
    }
  });

  it('legalStartWorlds never allows life wizards into umbra nor death wizards into lumina', () => {
    for (const wizard of wizardList) {
      const worlds = legalStartWorlds(wizard.schools);
      expect(worlds).toContain('meridia');
      if (wizard.schools.includes('life')) {
        expect(worlds).not.toContain('umbra');
      }
      if (wizard.schools.includes('death')) {
        expect(worlds).not.toContain('lumina');
      }
      if (!wizard.schools.includes('life')) {
        expect(worlds).toContain('umbra');
      }
      if (!wizard.schools.includes('death')) {
        expect(worlds).toContain('lumina');
      }
    }
  });

  it('no wizard default loadout grants an illegal start world for its schools', () => {
    for (const wizard of wizardList) {
      const legal = legalStartWorlds(wizard.schools);
      for (const retortId of wizard.retorts) {
        const retort = retortById[retortId];
        expect(retort, `${wizard.id} -> ${retortId}`).toBeDefined();
        if (retort?.grantsStartWorld) {
          expect(legal).toContain(retort.grantsStartWorld);
        }
      }
    }
  });
});
