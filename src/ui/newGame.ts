/**
 * New Game screen (DOM overlay).
 *
 * Wizard picker (all 21 premades, grouped by school count) → start-world
 * picker (limited to legalStartWorlds, auto-adding the covenant retort for
 * Umbra/Lumina) → race picker (races native to the chosen world) → seed →
 * Start, which builds the sim via createGame and hands it to the store.
 */

import { createGame } from '@sim/core/state';
import type {
  GameSettings,
  PlayerSetup,
  PlaneDef,
  PlaneId,
  RetortDef,
  SchoolDef,
  SchoolId,
  WizardDef,
  WorldId,
} from '@sim/types';
import { legalStartWorlds } from '@sim/types';
import { CONTENT } from '@data/content';
import { SCHOOLS as SCHOOLS_RAW } from '@data/schools';
import { WIZARDS as WIZARDS_RAW } from '@data/wizards';
import { RETORTS as RETORTS_RAW } from '@data/retorts';
import { PLANES as PLANES_RAW } from '@data/planes';
import { RACES } from '@data/races';

import type { Store } from './store';
import { el, clear, chip } from './dom';

// Widen the `as const` content to their interface types for ergonomic lookup.
const SCHOOLS = SCHOOLS_RAW as Record<SchoolId, SchoolDef>;
const WIZARDS = WIZARDS_RAW as Record<string, WizardDef>;
const RETORTS = RETORTS_RAW as Record<string, RetortDef>;
const PLANES = PLANES_RAW as Record<PlaneId, PlaneDef>;

const WIZARD_LIST = Object.values(WIZARDS);
const DEFAULT_SEED = 20260720;

interface NewGameSel {
  wizardId: string;
  world: WorldId;
  raceId: string;
  seed: number;
}

function schoolChips(schools: readonly string[]): HTMLElement {
  const wrap = el('span', { class: 'chips' });
  for (const sid of schools) {
    const school = SCHOOLS[sid as keyof typeof SCHOOLS];
    if (school) wrap.append(chip(school.color, school.name));
  }
  return wrap;
}

function retortNames(ids: readonly string[]): string {
  return ids
    .map((id) => RETORTS[id as keyof typeof RETORTS]?.name ?? id)
    .join(' · ');
}

function defaultRaceFor(world: WorldId): string {
  const match = Object.values(RACES).find((r) => r.homeWorld === world);
  return match?.id ?? 'orcs';
}

export function mountNewGame(root: HTMLElement, store: Store): void {
  const firstWizard = WIZARD_LIST[0];
  const sel: NewGameSel = {
    wizardId: firstWizard ? firstWizard.id : 'ithariel-dawnclad',
    world: 'meridia',
    raceId: defaultRaceFor('meridia'),
    seed: DEFAULT_SEED,
  };

  function selectWizard(id: string): void {
    sel.wizardId = id;
    const wiz = WIZARDS[id as keyof typeof WIZARDS];
    const legal = wiz ? legalStartWorlds(wiz.schools) : (['meridia'] as WorldId[]);
    if (!legal.includes(sel.world)) sel.world = 'meridia';
    if (!Object.values(RACES).some((r) => r.id === sel.raceId && r.homeWorld === sel.world)) {
      sel.raceId = defaultRaceFor(sel.world);
    }
    render();
  }

  function selectWorld(world: WorldId): void {
    sel.world = world;
    sel.raceId = defaultRaceFor(world);
    render();
  }

  function start(): void {
    const wiz = WIZARDS[sel.wizardId as keyof typeof WIZARDS];
    if (!wiz) return;
    const retorts = [...wiz.retorts];
    // Umbra/Lumina require the matching covenant retort in the loadout.
    if (sel.world !== 'meridia') {
      const covenant = Object.values(RETORTS).find((r) => r.grantsStartWorld === sel.world);
      if (covenant && !retorts.includes(covenant.id)) retorts.push(covenant.id);
    }
    const setup: PlayerSetup = {
      wizardId: wiz.id,
      // Denormalize the chosen wizard's schools onto the setup so the sim can
      // gate magic studies (and the research panel's Magic tab) without
      // importing content. A pure mage carries one school; an archmage up to 3.
      schools: [...wiz.schools],
      retorts,
      startWorld: sel.world,
      raceId: sel.raceId,
      human: true,
    };
    const settings: GameSettings = {
      seed: Number.isFinite(sel.seed) ? sel.seed : DEFAULT_SEED,
      mapSize: 'small',
      players: [setup],
    };
    try {
      const game = createGame(settings, CONTENT);
      store.startGame(game, 'player-0', sel.world);
    } catch (err) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  function wizardCard(id: string): HTMLElement {
    const wiz = WIZARDS[id as keyof typeof WIZARDS];
    if (!wiz) return el('div');
    const selected = id === sel.wizardId;
    const card = el('button', { class: `wizard-card${selected ? ' selected' : ''}`, type: 'button' }, [
      el('div', { class: 'wizard-head' }, [
        el('span', { class: 'wizard-name', text: wiz.name }),
        schoolChips(wiz.schools),
      ]),
      el('div', { class: 'wizard-retorts', text: retortNames(wiz.retorts) }),
      el('div', { class: 'wizard-bio', text: wiz.bio }),
    ]);
    card.addEventListener('click', () => selectWizard(id));
    return card;
  }

  function wizardGroup(title: string, count: number): HTMLElement {
    const cards = WIZARD_LIST.filter((w) => w.schools.length === count).map((w) => wizardCard(w.id));
    return el('div', { class: 'wizard-group' }, [
      el('h3', { class: 'group-title', text: title }),
      el('div', { class: 'wizard-grid' }, cards),
    ]);
  }

  function worldPicker(): HTMLElement {
    const wiz = WIZARDS[sel.wizardId as keyof typeof WIZARDS];
    const legal = wiz ? legalStartWorlds(wiz.schools) : (['meridia'] as WorldId[]);
    const buttons = legal.map((w) => {
      const plane = PLANES[w];
      const b = el('button', {
        class: `pick-btn${sel.world === w ? ' selected' : ''}`,
        type: 'button',
      }, [el('span', { text: plane?.name ?? w })]);
      b.addEventListener('click', () => selectWorld(w));
      return b;
    });
    const worldPlane = PLANES[sel.world];
    const note =
      sel.world !== 'meridia'
        ? el('p', {
            class: 'note',
            text: `Starting in ${worldPlane?.name ?? sel.world} auto-adds the ${
              Object.values(RETORTS).find((r) => r.grantsStartWorld === sel.world)?.name ?? 'covenant'
            } retort to your loadout.`,
          })
        : null;
    return el('div', { class: 'panel-block' }, [
      el('h3', { class: 'group-title', text: 'Start World' }),
      el('div', { class: 'pick-row' }, buttons),
      el('p', { class: 'desc', text: worldPlane?.description ?? '' }),
      note,
    ]);
  }

  function racePicker(): HTMLElement {
    const races = Object.values(RACES).filter((r) => r.homeWorld === sel.world);
    const buttons = races.map((r) => {
      const b = el('button', {
        class: `race-btn${sel.raceId === r.id ? ' selected' : ''}`,
        type: 'button',
      }, [el('span', { text: r.name }), r.generic ? el('span', { class: 'tag', text: 'baseline' }) : null]);
      b.addEventListener('click', () => {
        sel.raceId = r.id;
        render();
      });
      return b;
    });
    const race = RACES[sel.raceId];
    const y = race?.yields;
    const affinity = race?.schoolAffinity ? SCHOOLS[race.schoolAffinity] : null;
    const summary = race
      ? el('div', { class: 'race-summary' }, [
          el('div', {
            class: 'yield-line',
            text: [
              `Growth ×${race.growthRate.toFixed(2)}`,
              y ? `  ·  Food ×${y.food}` : '',
              y ? `  Prod ×${y.production}` : '',
              y ? `  Gold ×${y.gold}` : '',
              y ? `  Rsch ×${y.research}` : '',
              y ? `  Mana ×${y.mana}` : '',
            ].join(''),
          }),
          affinity
            ? el('div', { class: 'affinity' }, ['Affinity: ', chip(affinity.color, affinity.name), ` ${affinity.name}`])
            : null,
          el('p', { class: 'desc', text: race.description }),
        ])
      : null;
    return el('div', { class: 'panel-block' }, [
      el('h3', { class: 'group-title', text: 'Race' }),
      el('div', { class: 'race-row' }, buttons),
      summary,
    ]);
  }

  function seedBlock(): HTMLElement {
    const input = el('input', {
      class: 'seed-input',
      type: 'number',
      value: String(sel.seed),
    });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      sel.seed = Number.isNaN(v) ? DEFAULT_SEED : v;
    });
    return el('div', { class: 'panel-block' }, [
      el('h3', { class: 'group-title', text: 'Seed' }),
      input,
    ]);
  }

  function render(): void {
    clear(root);
    const startBtn = el('button', { class: 'start-btn', type: 'button', id: 'start-game', text: 'Begin the Age' });
    startBtn.addEventListener('click', start);

    const layout = el('div', { class: 'newgame' }, [
      el('div', { class: 'newgame-header' }, [
        el('h1', { class: 'game-title', text: 'MASTER' }),
        el('p', { class: 'subtitle', text: 'Choose your wizard, world, and people.' }),
      ]),
      el('div', { class: 'newgame-body' }, [
        el('div', { class: 'wizard-col' }, [
          wizardGroup('Pure Mages — single school', 1),
          wizardGroup('Adepts — two schools', 2),
          wizardGroup('Archmages — three schools', 3),
        ]),
        el('div', { class: 'config-col' }, [
          worldPicker(),
          racePicker(),
          seedBlock(),
          startBtn,
        ]),
      ]),
    ]);
    root.append(layout);
  }

  render();
}
