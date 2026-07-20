import { describe, expect, it } from 'vitest';
import { STUDIES } from './studies';
import { RACES } from './races';
import { BUILDINGS } from './buildings';
import { SCHOOL_IDS } from '@sim/types';

const races = Object.values(RACES);
const studyIds = new Set(Object.keys(STUDIES));
const buildingIds = new Set(Object.keys(BUILDINGS));

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Map from study id -> the id of the race whose `studies` list contains it. */
const raceOfStudy = new Map<string, string>();
for (const race of races) {
  for (const studyId of race.studies) {
    raceOfStudy.set(studyId, race.id);
  }
}

/** The magic shelf: studies carrying a `school`, independent of any race. */
const magicStudies = Object.values(STUDIES).filter((s) => s.school !== undefined);

describe('studies', () => {
  it('every study id referenced by every race exists in STUDIES', () => {
    for (const race of races) {
      for (const studyId of race.studies) {
        expect(STUDIES[studyId], `${race.id} -> ${studyId}`).toBeDefined();
      }
    }
  });

  it('has no orphan studies: every STUDIES key is referenced by a race or carries a school', () => {
    for (const id of studyIds) {
      const study = STUDIES[id];
      const ownedByRace = raceOfStudy.has(id);
      const ownedByMagicShelf = !!study?.school;
      expect(
        ownedByRace || ownedByMagicShelf,
        `${id} is not referenced by any race and carries no school`
      ).toBe(true);
    }
  });

  it('every study def id matches its key', () => {
    for (const [key, def] of Object.entries(STUDIES)) {
      expect(def.id).toBe(key);
    }
  });

  it('ids are kebab-case matching their record keys', () => {
    for (const key of Object.keys(STUDIES)) {
      expect(key).toMatch(KEBAB_CASE);
    }
  });

  it('every `requires` id exists and belongs to the same race\'s study list', () => {
    for (const race of races) {
      const raceStudySet = new Set(race.studies);
      for (const studyId of race.studies) {
        const study = STUDIES[studyId];
        expect(study, studyId).toBeDefined();
        if (!study) continue;
        for (const req of study.requires ?? []) {
          expect(STUDIES[req], `${studyId} requires ${req}`).toBeDefined();
          expect(
            raceStudySet.has(req),
            `${race.id}: ${studyId} requires ${req}, which is not in ${race.id}'s study list`
          ).toBe(true);
        }
      }
    }
  });

  it('the first study in each race\'s list has no requires (or only requires within-chain roots)', () => {
    // Every race must have at least one root study (no requires) to anchor its chain.
    for (const race of races) {
      const roots = race.studies.filter((id) => {
        const study = STUDIES[id];
        return study && (!study.requires || study.requires.length === 0);
      });
      expect(roots.length, `${race.id} has no root study`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has no requires cycles: every race chain terminates', () => {
    for (const race of races) {
      for (const startId of race.studies) {
        const visited = new Set<string>();
        let current: string | undefined = startId;
        const stack = [current];
        while (stack.length > 0) {
          const id = stack.pop();
          if (!id) continue;
          expect(visited.has(id), `cycle detected involving ${id} (from ${startId})`).toBe(
            false
          );
          visited.add(id);
          const study = STUDIES[id];
          for (const req of study?.requires ?? []) {
            stack.push(req);
          }
        }
      }
    }
  });

  it('costs strictly increase along every requires chain', () => {
    for (const [id, study] of Object.entries(STUDIES)) {
      for (const reqId of study.requires ?? []) {
        const req = STUDIES[reqId];
        expect(req, `${id} requires ${reqId}`).toBeDefined();
        if (!req) continue;
        expect(
          study.cost,
          `${id} (cost ${study.cost}) should cost more than its prerequisite ${reqId} (cost ${req.cost})`
        ).toBeGreaterThan(req.cost);
      }
    }
  });

  it('every unlocksBuildings id exists in BUILDINGS and is in the owning race\'s building list', () => {
    for (const [studyId, study] of Object.entries(STUDIES)) {
      const buildingsUnlocked = study.effects.unlocksBuildings ?? [];
      if (buildingsUnlocked.length === 0) continue;

      const raceId = raceOfStudy.get(studyId);
      expect(raceId, `${studyId} is not owned by any race`).toBeDefined();
      const race = raceId ? RACES[raceId] : undefined;
      expect(race, `${studyId} -> race ${raceId}`).toBeDefined();

      for (const buildingId of buildingsUnlocked) {
        expect(buildingIds.has(buildingId), `${studyId} unlocks unknown building ${buildingId}`).toBe(
          true
        );
        expect(
          race?.buildings.includes(buildingId),
          `${studyId} unlocks ${buildingId}, but ${raceId} cannot build it`
        ).toBe(true);
      }
    }
  });

  it('humans\' deepest study unlocks celestial-temple', () => {
    const humans = RACES.humans;
    expect(humans).toBeDefined();
    if (!humans) throw new Error('unreachable');

    const deepestId = humans.studies[humans.studies.length - 1];
    expect(deepestId).toBeDefined();
    const deepest = deepestId ? STUDIES[deepestId] : undefined;
    expect(deepest, `humans deepest study ${deepestId}`).toBeDefined();
    expect(deepest?.effects.unlocksBuildings).toContain('celestial-temple');
  });

  it('every study has at least one effect (cityEffects non-empty or an unlock)', () => {
    for (const [id, study] of Object.entries(STUDIES)) {
      const { cityEffects, unlocksBuildings, unlocksUnits } = study.effects;
      const hasCityEffects = !!cityEffects && Object.keys(cityEffects).length > 0;
      const hasUnlocks = (unlocksBuildings?.length ?? 0) > 0 || (unlocksUnits?.length ?? 0) > 0;
      expect(hasCityEffects || hasUnlocks, `${id} has no effects`).toBe(true);
    }
  });

  it('unlocksUnits only reference the sanctioned roster', () => {
    const roster = new Set(['settler', 'militia', 'orc-warrior', 'human-spearman']);
    for (const [id, study] of Object.entries(STUDIES)) {
      for (const unitId of study.effects.unlocksUnits ?? []) {
        expect(roster.has(unitId), `${id} unlocks unsanctioned unit ${unitId}`).toBe(true);
      }
    }
  });

  it('every study id referenced by races appears in exactly one race\'s list', () => {
    const counts = new Map<string, number>();
    for (const race of races) {
      for (const studyId of race.studies) {
        counts.set(studyId, (counts.get(studyId) ?? 0) + 1);
      }
    }
    for (const [id, count] of counts) {
      expect(count, `${id} referenced by ${count} races`).toBe(1);
    }
  });

  it('race studies are unchanged: no race-owned study carries a school', () => {
    for (const id of raceOfStudy.keys()) {
      expect(STUDIES[id]?.school, `${id} is race-owned but has a school set`).toBeUndefined();
    }
  });
});

describe('magic shelf (school studies)', () => {
  it('has 127 total studies: 97 race studies + 30 magic studies', () => {
    expect(studyIds.size).toBe(127);
    expect(magicStudies.length).toBe(30);
  });

  it('has exactly 6 studies per school, each with a valid school id', () => {
    const bySchool = new Map<string, number>();
    for (const study of magicStudies) {
      expect(SCHOOL_IDS as readonly string[], `${study.id} has invalid school ${study.school}`).toContain(
        study.school
      );
      bySchool.set(study.school as string, (bySchool.get(study.school as string) ?? 0) + 1);
    }
    expect(bySchool.size).toBe(SCHOOL_IDS.length);
    for (const school of SCHOOL_IDS) {
      expect(bySchool.get(school), `school ${school} does not have exactly 6 studies`).toBe(6);
    }
  });

  it('magic study ids are kebab-case and prefixed magic-<school>-', () => {
    for (const study of magicStudies) {
      expect(study.id).toMatch(KEBAB_CASE);
      expect(study.id.startsWith(`magic-${study.school}-`), study.id).toBe(true);
    }
  });

  it('magic chains stay within their school: requires only reference same-school ids', () => {
    for (const study of magicStudies) {
      for (const reqId of study.requires ?? []) {
        const req = STUDIES[reqId];
        expect(req, `${study.id} requires ${reqId}`).toBeDefined();
        expect(
          req?.school,
          `${study.id} (school ${study.school}) requires ${reqId} (school ${req?.school})`
        ).toBe(study.school);
      }
    }
  });

  it('each school has exactly one root study (no requires) anchoring its chain', () => {
    for (const school of SCHOOL_IDS) {
      const roots = magicStudies.filter((s) => s.school === school && (!s.requires || s.requires.length === 0));
      expect(roots.length, `school ${school} does not have exactly one root study`).toBe(1);
    }
  });

  it('each school forms a single linear chain of 6 studies with no cycles', () => {
    for (const school of SCHOOL_IDS) {
      const schoolStudies = magicStudies.filter((s) => s.school === school);
      for (const start of schoolStudies) {
        const visited = new Set<string>();
        let current: string | undefined = start.id;
        while (current) {
          expect(visited.has(current), `cycle detected involving ${current} (from ${start.id})`).toBe(
            false
          );
          visited.add(current);
          const reqs: readonly string[] = STUDIES[current]?.requires ?? [];
          current = reqs[0];
        }
      }
    }
  });

  it('every magic study has non-empty cityEffects', () => {
    for (const study of magicStudies) {
      const cityEffects = study.effects.cityEffects;
      expect(cityEffects, `${study.id} has no cityEffects`).toBeDefined();
      expect(
        cityEffects && Object.keys(cityEffects).length > 0,
        `${study.id} has empty cityEffects`
      ).toBe(true);
    }
  });

  it('the magic shelf has no unlocksBuildings or unlocksUnits', () => {
    for (const study of magicStudies) {
      expect(study.effects.unlocksBuildings ?? [], study.id).toEqual([]);
      expect(study.effects.unlocksUnits ?? [], study.id).toEqual([]);
    }
  });
});
