/**
 * Pure summarizers over a BattleReport for the viewer's summary card, battle
 * log, event feed, and end card. No DOM, no Pixi.
 */

import type {
  BattleReport,
  BattleStartEvent,
  UnitSummary,
  BattleSideId,
} from '@sim/combat/events';

export function battleStart(report: BattleReport): BattleStartEvent | undefined {
  return report.events.find((e) => e.type === 'battle-start') as BattleStartEvent | undefined;
}

export interface CompRow {
  name: string;
  count: number;
  figures: number;
}

/** Aggregated composition of one side: "Orc Warrior ×2 (11)". */
export function sideComposition(report: BattleReport, side: BattleSideId): CompRow[] {
  const start = battleStart(report);
  if (!start) return [];
  const byName = new Map<string, CompRow>();
  for (const u of start.units) {
    if (u.side !== side) continue;
    const row = byName.get(u.name) ?? { name: u.name, count: 0, figures: 0 };
    row.count += 1;
    row.figures += u.figures;
    byName.set(u.name, row);
  }
  return [...byName.values()];
}

/** Rough danger reading for scouting: total figures × hits across a side. */
export function sideThreat(report: BattleReport, side: BattleSideId): number {
  const start = battleStart(report);
  if (!start) return 0;
  let t = 0;
  for (const u of start.units) {
    if (u.side === side) t += u.figures * u.hits;
  }
  return t;
}

export interface UnitResult {
  id: string;
  name: string;
  side: BattleSideId;
  startFigures: number;
  endFigures: number;
  survived: boolean;
}

export function unitResults(report: BattleReport, names?: Map<string, string>): UnitResult[] {
  const start = battleStart(report);
  if (!start) return [];
  const survHp = new Map<string, number>();
  for (const s of report.outcome.survivors.attacker) survHp.set(s.id, s.hp);
  for (const s of report.outcome.survivors.defender) survHp.set(s.id, s.hp);

  return start.units.map((u: UnitSummary) => {
    const hp = survHp.get(u.id);
    const survived = hp !== undefined && hp > 0;
    const endFigures = survived ? Math.max(1, Math.ceil(hp / Math.max(1, u.hits))) : 0;
    return {
      id: u.id,
      name: names?.get(u.id) ?? u.name,
      side: u.side,
      startFigures: u.figures,
      endFigures,
      survived,
    };
  });
}

/** id → display name, for the event feed. */
export function unitNameMap(report: BattleReport): Map<string, string> {
  const start = battleStart(report);
  const m = new Map<string, string>();
  if (start) for (const u of start.units) m.set(u.id, u.name);
  return m;
}

/** id → side, for feed colouring. */
export function unitSideMap(report: BattleReport): Map<string, BattleSideId> {
  const start = battleStart(report);
  const m = new Map<string, BattleSideId>();
  if (start) for (const u of start.units) m.set(u.id, u.side);
  return m;
}

export interface FeedLine {
  tick: number;
  text: string;
  side?: BattleSideId;
  /** Emphasis: 'rout'/'death' get a stronger style. */
  tone?: 'normal' | 'good' | 'bad' | 'magic';
}

const ABILITY_VERB: Record<string, string> = {
  'breath-weapon': 'looses a searing breath over',
  fear: 'radiates dread at',
  'holy-aura': 'bathes allies near',
  inspire: 'rallies allies near',
  'life-drain': 'drains the life of',
  poison: 'envenoms',
  'first-strike': 'strikes first at',
  charge: 'charges',
  regeneration: 'knits its wounds',
  trample: 'tramples',
  'pack-hunter': 'hunts in a pack near',
  flying: 'wheels over',
  undead: 'presses on, unfeeling,',
  fearless: 'holds fast',
};

function titleCase(s: string): string {
  return s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Plain-language narration synced to playback. Combines each strike with its
 * casualties into a single readable line ("Orc Warriors charge the Giant
 * Spiders — 4 figures lost"), and calls out morale breaks, rallies, abilities,
 * and deaths — this is where the "why" of the battle lives.
 */
export function buildFeed(report: BattleReport, nameOverride?: Map<string, string>): FeedLine[] {
  const names = nameOverride ?? unitNameMap(report);
  const sides = unitSideMap(report);
  const start = battleStart(report);
  const lines: FeedLine[] = [];

  if (start) {
    lines.push({ tick: 0, text: `Battle begins on ${titleCase(start.field.terrain)}.`, tone: 'normal' });
  }

  // Pair actions to their casualties within the same tick.
  interface PendingAction {
    attackerId: string;
    verb: string;
    charge: boolean;
    flank: boolean;
    rear: boolean;
  }
  const pending = new Map<string, PendingAction>(); // key: `${tick}:${targetId}`

  const nm = (id: string | null): string => (id ? names.get(id) ?? 'Something' : 'Something');

  for (const e of report.events) {
    switch (e.type) {
      case 'melee': {
        pending.set(`${e.tick}:${e.targetId}`, {
          attackerId: e.unitId,
          verb: e.charge ? 'charge' : 'strike',
          charge: e.charge,
          flank: e.flank,
          rear: e.rear,
        });
        break;
      }
      case 'volley': {
        pending.set(`${e.tick}:${e.targetId}`, {
          attackerId: e.unitId,
          verb: 'volley',
          charge: false,
          flank: false,
          rear: false,
        });
        break;
      }
      case 'damage': {
        const act = pending.get(`${e.tick}:${e.targetId}`);
        if (e.figuresLost > 0) {
          const attacker = act ? nm(act.attackerId) : nm(e.sourceId);
          const verb = act ? act.verb : 'hit';
          const flankNote = act?.rear ? ' from the rear' : act?.flank ? ' on the flank' : '';
          const verbConj = verb === 'strike' ? 'strike' : verb === 'charge' ? 'charge into' : verb === 'volley' ? 'volley' : 'hit';
          lines.push({
            tick: e.tick,
            side: sides.get(act?.attackerId ?? e.sourceId ?? ''),
            text: `${attacker} ${verbConj} ${nm(e.targetId)}${flankNote} — ${e.figuresLost} figure${e.figuresLost > 1 ? 's' : ''} lost`,
            tone: 'bad',
          });
        }
        break;
      }
      case 'heal': {
        if (e.amount > 0) {
          lines.push({
            tick: e.tick,
            side: sides.get(e.targetId),
            text: `${nm(e.targetId)} recovers ${e.amount} (${titleCase(e.kind)})`,
            tone: 'good',
          });
        }
        break;
      }
      case 'ability-proc': {
        const verb = ABILITY_VERB[e.ability] ?? `unleashes ${titleCase(e.ability)} on`;
        const targets = e.targetIds.length ? e.targetIds.map(nm).join(', ') : 'the field';
        lines.push({
          tick: e.tick,
          side: sides.get(e.sourceId),
          text: `${nm(e.sourceId)} ${verb} ${targets}`,
          tone: 'magic',
        });
        break;
      }
      case 'morale-check': {
        if (!e.passed) {
          lines.push({
            tick: e.tick,
            side: sides.get(e.unitId),
            text: `${nm(e.unitId)} wavers (${titleCase(e.trigger)})`,
            tone: 'bad',
          });
        }
        break;
      }
      case 'rout': {
        lines.push({ tick: e.tick, side: sides.get(e.unitId), text: `${nm(e.unitId)} break and flee!`, tone: 'bad' });
        break;
      }
      case 'rally': {
        lines.push({ tick: e.tick, side: sides.get(e.unitId), text: `${nm(e.unitId)} rally and reform.`, tone: 'good' });
        break;
      }
      case 'death': {
        lines.push({ tick: e.tick, side: sides.get(e.unitId), text: `${nm(e.unitId)} is wiped out.`, tone: 'bad' });
        break;
      }
      case 'flee-off': {
        lines.push({ tick: e.tick, side: sides.get(e.unitId), text: `${nm(e.unitId)} flees the field.`, tone: 'bad' });
        break;
      }
      case 'battle-end': {
        const w = e.winner === 'draw' ? 'The battle ends in a stalemate' : `${titleCase(e.winner)} wins the field`;
        lines.push({ tick: e.tick, text: `${w}.`, tone: 'good' });
        break;
      }
      default:
        break;
    }
  }

  return lines;
}
