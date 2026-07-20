import { describe, expect, it } from 'vitest';
import { STUDIES } from './studies';
import { RACES } from './races';
import { BUILDINGS } from './buildings';

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

describe('studies', () => {
  it('every study id referenced by every race exists in STUDIES', () => {
    for (const race of races) {
      for (const studyId of race.studies) {
        expect(STUDIES[studyId], `${race.id} -> ${studyId}`).toBeDefined();
      }
    }
  });

  it('has no orphan studies: every STUDIES key is referenced by some race', () => {
    for (const id of studyIds) {
      expect(raceOfStudy.has(id), `${id} is not referenced by any race`).toBe(true);
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
});
