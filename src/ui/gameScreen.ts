/**
 * Game screen DOM overlay: top bar (turn / gold / mana / research / plane),
 * plane switcher, End Turn, contextual side panel (city / unit / research),
 * and the toast stack. Rebuilt from store state on every change; every button
 * routes through the store (which owns all sim mutation).
 */

import { computeCityYields, cityPopulationCap } from '@sim/city/city';
import type { CityState, UnitState } from '@sim/types';

import type { Store } from './store';
import { el } from './dom';
import { empireSummary } from './econ';
import { assembleBuildOptions } from './buildPicker';
import { summarizeStudy } from './summarize';

function bar(fraction: number, color: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  return el('div', { class: 'bar' }, [
    el('div', { class: 'bar-fill', style: `width:${pct}%;background:${color}` }),
  ]);
}

function stat(label: string, value: string, sub?: string, extra?: string): HTMLElement {
  return el('div', { class: `hud-stat${extra ? ' ' + extra : ''}` }, [
    el('span', { class: 'hud-label', text: label }),
    el('span', { class: 'hud-value', text: value }),
    sub ? el('span', { class: 'hud-sub', text: sub }) : null,
  ]);
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

// --- Top bar ---------------------------------------------------------------

function topBar(store: Store): HTMLElement {
  const st = store.getState();
  const game = st.game!;
  const s = empireSummary(game, store.content, st.humanPlayerId);
  const planeName = store.content.planes.find((p) => p.id === st.activePlane)?.name ?? st.activePlane;

  const research = el('button', { class: 'hud-stat hud-research', type: 'button', title: 'Open research' }, [
    el('span', { class: 'hud-label', text: 'Research' }),
    s.study
      ? el('span', { class: 'hud-value', text: s.study.def.name })
      : el('span', { class: 'hud-value dim', text: 'none' }),
    s.study
      ? bar(s.study.def.cost > 0 ? s.study.progress / s.study.def.cost : 0, '#8fb4ff')
      : el('span', { class: 'hud-sub', text: 'click to choose' }),
    s.study
      ? el('span', { class: 'hud-sub', text: `${Math.floor(s.study.progress)}/${s.study.def.cost}  (+${s.researchIncome}/t)` })
      : null,
  ]);
  research.addEventListener('click', () => store.toggleResearch(true));

  const planeBtns = store.content.planes
    .filter((p) => game.maps[p.id])
    .map((p) => {
      const b = el('button', {
        class: `plane-btn${p.id === st.activePlane ? ' selected' : ''}`,
        type: 'button',
        title: p.name,
        text: p.name,
      });
      b.addEventListener('click', () => store.setActivePlane(p.id));
      return b;
    });

  const endTurn = el('button', { class: 'end-turn', type: 'button', id: 'end-turn', text: 'End Turn ▸' });
  endTurn.addEventListener('click', () => {
    store.command({ type: 'end-turn' });
  });

  return el('div', { class: 'topbar' }, [
    el('div', { class: 'hud-left' }, [
      stat('Turn', String(game.turn)),
      stat('Gold', String(Math.floor(s.gold)), `${signed(s.goldIncome)}/t`, 'gold'),
      stat('Mana', String(Math.floor(s.mana)), `${signed(s.manaIncome)}/t`, 'mana'),
      research,
      stat('Plane', planeName, undefined, 'plane'),
    ]),
    el('div', { class: 'hud-right' }, [
      el('div', { class: 'plane-switch' }, planeBtns),
      endTurn,
    ]),
  ]);
}

// --- City panel ------------------------------------------------------------

function cityPanel(store: Store, city: CityState): HTMLElement {
  const st = store.getState();
  const game = st.game!;
  const content = store.content;
  const race = content.races[city.raceId];
  const yields = computeCityYields(game, content, city);
  const cap = cityPopulationCap(game, content, city);

  const yieldRow = el('div', { class: 'yield-grid' }, [
    yieldCell('Food', yields.food, '#7fc96b'),
    yieldCell('Prod', yields.production, '#d69a4c'),
    yieldCell('Gold', yields.gold, '#e7c94a'),
    yieldCell('Rsch', yields.research, '#8fb4ff'),
    yieldCell('Mana', yields.mana, '#c99be6'),
  ]);

  const buildingList = city.buildings.length
    ? el('ul', { class: 'building-list' },
        city.buildings.map((bId) => el('li', { text: content.buildings[bId]?.name ?? bId })))
    : el('p', { class: 'dim', text: 'No buildings yet.' });

  // Current build order.
  const order = city.buildQueue[0];
  let buildStatus: HTMLElement;
  if (order) {
    const def = order.kind === 'building' ? content.buildings[order.id] : content.units[order.id];
    const cost = def && 'cost' in def && typeof def.cost === 'number' ? def.cost : 0;
    buildStatus = el('div', { class: 'build-status' }, [
      el('div', { class: 'build-row' }, [
        el('span', { text: def?.name ?? order.id }),
        el('span', { class: 'dim', text: `${Math.floor(order.progress)}/${cost}` }),
      ]),
      bar(cost > 0 ? order.progress / cost : 0, '#d69a4c'),
    ]);
  } else {
    buildStatus = el('p', { class: 'dim', text: 'Idle — choose production below.' });
  }

  // Production picker.
  const options = assembleBuildOptions(game, content, city);
  const optionEls = options.map((o) => {
    const btn = el('button', {
      class: `build-opt${o.buildable ? '' : ' locked'}`,
      type: 'button',
      title: o.reason ?? `${o.name} — ${o.cost} production`,
    }, [
      el('span', { class: 'opt-name', text: o.name }),
      el('span', { class: 'opt-meta', text: `${o.kind === 'unit' ? '⚔ ' : '⌂ '}${o.cost}` }),
    ]);
    if (o.buildable) {
      btn.addEventListener('click', () => {
        store.command({ type: 'set-build', cityId: city.id, order: { kind: o.kind, id: o.id } });
      });
    } else {
      btn.disabled = true;
    }
    return btn;
  });

  return panelShell(store, `${city.name}`, `${race?.name ?? city.raceId} city`, [
    el('div', { class: 'panel-line' }, [
      el('span', { text: `Population ${city.population}/${cap}` }),
    ]),
    el('h4', { class: 'panel-h', text: 'Per-turn yields' }),
    yieldRow,
    el('h4', { class: 'panel-h', text: 'Buildings' }),
    buildingList,
    el('h4', { class: 'panel-h', text: 'Production' }),
    buildStatus,
    el('div', { class: 'build-opts' }, optionEls),
  ]);
}

function yieldCell(label: string, value: number, color: string): HTMLElement {
  return el('div', { class: 'yield-cell' }, [
    el('span', { class: 'yield-dot', style: `background:${color}` }),
    el('span', { class: 'yield-label', text: label }),
    el('span', { class: 'yield-val', text: String(value) }),
  ]);
}

// --- Unit panel ------------------------------------------------------------

function unitPanel(store: Store, unit: UnitState): HTMLElement {
  const content = store.content;
  const def = content.units[unit.defId];
  const isSettler = def?.role === 'settler';

  const statGrid = def
    ? el('div', { class: 'unit-stats' }, [
        unitStat('Attack', def.attack),
        unitStat('Defense', def.defense),
        unitStat('Hits', def.hits),
        unitStat('Moves', `${unit.moves}/${def.moves}`),
        unitStat('Skill', def.skill),
        unitStat('HP', `${unit.hp}/${def.hits}`),
      ])
    : el('p', { class: 'dim', text: 'Unknown unit.' });

  const moveBtn = el('button', { class: 'action-btn', type: 'button', text: 'Move ▸' });
  moveBtn.addEventListener('click', () => {
    store.setMoveMode(unit.id);
    store.toast('Click a destination tile.', 'info');
  });

  const actions = el('div', { class: 'panel-actions' }, [moveBtn]);
  if (isSettler) {
    const foundBtn = el('button', { class: 'action-btn primary', type: 'button', text: 'Found City' });
    foundBtn.addEventListener('click', () => {
      const name = window.prompt('Name the new city:', 'New Settlement');
      if (name && name.trim()) {
        const ok = store.command({ type: 'found-city', unitId: unit.id, name: name.trim() });
        if (ok) store.select(null);
      }
    });
    actions.append(foundBtn);
  }

  const moveHint = store.getState().moveMode === unit.id
    ? el('p', { class: 'note', text: 'Awaiting destination — click the map.' })
    : null;

  return panelShell(store, def?.name ?? unit.defId, `${def?.role ?? 'unit'}`, [
    statGrid,
    actions,
    moveHint,
    def?.description ? el('p', { class: 'desc', text: def.description }) : null,
  ]);
}

function unitStat(label: string, value: number | string): HTMLElement {
  return el('div', { class: 'unit-stat' }, [
    el('span', { class: 'us-label', text: label }),
    el('span', { class: 'us-val', text: String(value) }),
  ]);
}

// --- Research panel --------------------------------------------------------

function researchPanel(store: Store): HTMLElement {
  const st = store.getState();
  const game = st.game!;
  const content = store.content;
  const player = game.players.find((p) => p.id === st.humanPlayerId);
  const race = player ? content.races[player.setup.raceId] : undefined;
  const completed = player?.completedStudies ?? [];
  const activeId = player?.research.activeStudyId ?? null;

  const rows = (race?.studies ?? []).map((sid) => {
    const def = content.studies[sid];
    if (!def) return el('div');
    const isDone = completed.includes(sid);
    const isActive = activeId === sid;
    const missingReq = (def.requires ?? []).filter((r) => !completed.includes(r));
    const locked = missingReq.length > 0;

    const status = isDone ? '✓' : isActive ? '◆' : locked ? '🔒' : '○';
    const cls = isDone ? 'done' : isActive ? 'active' : locked ? 'locked' : 'available';

    const row = el('button', { class: `study-row ${cls}`, type: 'button' }, [
      el('div', { class: 'study-head' }, [
        el('span', { class: 'study-status', text: status }),
        el('span', { class: 'study-name', text: def.name }),
        el('span', { class: 'study-cost', text: `${def.cost} rp` }),
      ]),
      el('div', { class: 'study-effect', text: summarizeStudy(def) }),
      isActive && player
        ? bar(def.cost > 0 ? player.research.progress / def.cost : 0, '#8fb4ff')
        : null,
      locked
        ? el('div', { class: 'study-req', text: `Requires: ${missingReq.map((r) => content.studies[r]?.name ?? r).join(', ')}` })
        : null,
    ]);

    if (!isDone && !locked) {
      row.addEventListener('click', () => {
        if (isActive) return;
        const switching = activeId && activeId !== sid && (player?.research.progress ?? 0) > 0;
        if (switching && !window.confirm('Switching research discards progress on the current study. Continue?')) {
          return;
        }
        store.command({ type: 'set-research', studyId: sid });
      });
    } else {
      row.disabled = true;
    }
    return row;
  });

  const close = el('button', { class: 'panel-close', type: 'button', text: '✕' });
  close.addEventListener('click', () => store.toggleResearch(false));

  return el('div', { class: 'side-panel research' }, [
    el('div', { class: 'panel-title-row' }, [
      el('div', { class: 'panel-titles' }, [
        el('h2', { class: 'panel-title', text: 'Magical Studies' }),
        el('span', { class: 'panel-sub', text: race?.name ?? '' }),
      ]),
      close,
    ]),
    el('div', { class: 'study-list' }, rows),
  ]);
}

// --- Shared shell ----------------------------------------------------------

function panelShell(store: Store, title: string, sub: string, body: (Node | null)[]): HTMLElement {
  const close = el('button', { class: 'panel-close', type: 'button', text: '✕' });
  close.addEventListener('click', () => store.select(null));
  return el('div', { class: 'side-panel' }, [
    el('div', { class: 'panel-title-row' }, [
      el('div', { class: 'panel-titles' }, [
        el('h2', { class: 'panel-title', text: title }),
        el('span', { class: 'panel-sub', text: sub }),
      ]),
      close,
    ]),
    el('div', { class: 'panel-scroll' }, body),
  ]);
}

// --- Toasts ----------------------------------------------------------------

function toastStack(store: Store): HTMLElement {
  const st = store.getState();
  return el('div', { class: 'toast-stack' },
    st.toasts.map((t) => {
      const node = el('div', { class: `toast ${t.kind}`, text: t.message });
      node.addEventListener('click', () => store.dismissToast(t.id));
      return node;
    }));
}

// --- Entry -----------------------------------------------------------------

/** Builds the full game overlay for the current store state. */
export function renderGameOverlay(store: Store): HTMLElement {
  const st = store.getState();
  const game = st.game!;

  let side: HTMLElement | null = null;
  if (st.showResearch) {
    side = researchPanel(store);
  } else if (st.selected?.kind === 'city') {
    const city = game.cities.find((c) => c.id === st.selected!.id);
    if (city) side = cityPanel(store, city);
  } else if (st.selected?.kind === 'unit') {
    const unit = game.units.find((u) => u.id === st.selected!.id);
    if (unit) side = unitPanel(store, unit);
  }

  return el('div', { class: 'game-overlay' }, [
    topBar(store),
    side,
    toastStack(store),
  ]);
}
