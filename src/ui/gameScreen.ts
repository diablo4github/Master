/**
 * Game screen DOM overlay: top bar (turn / gold / mana / research / plane),
 * plane switcher, End Turn, contextual side panel (city / unit / research),
 * and the toast stack. Rebuilt from store state on every change; every button
 * routes through the store (which owns all sim mutation).
 */

import { computeCityYields, cityPopulationCap, pickCityName, QUEUE_CAP } from '@sim/city/city';
import type { CityState, UnitState, UnitDef } from '@sim/types';

import type { Store } from './store';
import { el } from './dom';
import { empireSummary } from './econ';
import { summarizeStudy } from './summarize';
import { describeAbility } from './abilities';
import type { LairState, BattleRecord } from './battleTypes';
import { sideComposition, sideThreat, battleStart } from './battleSummary';
import { endTurnDecision, endTurnLabel } from './endTurn';
import { queueView, assembleQueueOptions } from './queue';
import { stackRows, armyView, canFormArmy, type UnitRow } from './army';

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

  // End Turn = decision assistant. The label reflects what a click will do
  // BEFORE the click; a modifier (shift-click) or the tiny secondary button
  // force the turn to advance regardless.
  const selectedCityId = st.selected?.kind === 'city' ? st.selected.id : null;
  const decision = endTurnDecision(game, store.content, st.humanPlayerId, selectedCityId);
  const decisionCity =
    decision.kind === 'production' ? game.cities.find((c) => c.id === decision.cityId) : undefined;
  const endLabel = endTurnLabel(decision, decisionCity?.name);

  const advance = () => store.command({ type: 'end-turn' });
  const act = () => {
    switch (decision.kind) {
      case 'research':
        store.toggleResearch(true);
        break;
      case 'production':
        store.openProduction(decision.cityId);
        if (decisionCity) store.requestCenter(decisionCity.x, decisionCity.y);
        break;
      case 'advance':
        advance();
        break;
    }
  };

  const endTurn = el('button', {
    class: `end-turn${decision.kind === 'advance' ? '' : ' assist'}`,
    type: 'button',
    id: 'end-turn',
    text: endLabel,
    title:
      decision.kind === 'advance'
        ? 'Advance to the next turn'
        : 'Resolve this decision — shift-click to end the turn anyway',
  });
  endTurn.addEventListener('click', (e) => {
    if ((e as MouseEvent).shiftKey) advance();
    else act();
  });

  // A small, clearly-labelled escape hatch when the assistant is holding a
  // decision: end the turn without resolving it.
  const forceEnd =
    decision.kind === 'advance'
      ? null
      : (() => {
          const b = el('button', {
            class: 'end-turn-force',
            id: 'end-turn-force',
            type: 'button',
            title: 'Skip remaining decisions and end the turn',
            text: 'End anyway ▸',
          });
          b.addEventListener('click', () => advance());
          return b;
        })();

  const battles = store.allBattles();
  const watched = new Set(st.watchedBattleIds);
  const unseen = battles.filter((b) => !watched.has(b.id) && (b.attackerPlayer === st.humanPlayerId || b.defenderPlayer === st.humanPlayerId)).length;
  const logBtn = el('button', { class: 'log-btn', id: 'battle-log-btn', type: 'button', title: 'Battle log' }, [
    el('span', { text: `⚔ Battles (${battles.length})` }),
    unseen > 0 ? el('span', { class: 'log-new', text: String(unseen) }) : null,
  ]);
  logBtn.addEventListener('click', () => store.toggleBattleLog());

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
      logBtn,
      el('div', { class: 'end-turn-group' }, [forceEnd, endTurn]),
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

  const queueBlock = productionQueue(store, city, yields.production);

  return panelShell(store, `${city.name}`, `${race?.name ?? city.raceId} city`, [
    el('div', { class: 'panel-line' }, [
      el('span', { text: `Population ${city.population}/${cap}` }),
    ]),
    el('h4', { class: 'panel-h', text: 'Per-turn yields' }),
    yieldRow,
    el('h4', { class: 'panel-h', text: 'Buildings' }),
    buildingList,
    queueBlock,
  ]);
}

/** ETA label for a queue row: turns, or ∞ when production can't finish it. */
function etaText(turns: number | null): string {
  return turns === null ? '∞' : `${turns}t`;
}

/**
 * The full production-queue UI: the ordered queue (head shows live progress),
 * per-item ▲▼ reorder and ✕ remove, cumulative ETA per item, and an
 * "Add to queue" picker whose legality is checked with earlier-queued buildings
 * counted as available (so granary→marketplace can be queued in one visit).
 */
function productionQueue(store: Store, city: CityState, production: number): HTMLElement {
  const content = store.content;
  const game = store.getState().game!;
  const rows = queueView(content, city, production);
  const full = city.buildQueue.length >= QUEUE_CAP;

  const queueEls: (Node | null)[] = rows.length
    ? rows.map((r) => {
        const cost = r.cost;
        const head = r.isHead;
        const meta = el('div', { class: 'q-item-meta' }, [
          el('span', { class: 'q-item-icon', text: r.kind === 'unit' ? '⚔' : '⌂' }),
          el('span', { class: 'q-item-name', text: r.name }),
          el('span', { class: 'q-item-eta', text: etaText(r.etaTurns) }),
        ]);
        const ctrl = el('div', { class: 'q-item-ctrl' }, [
          reorderBtn(store, city.id, r.index, r.index - 1, '▲', r.index === 0),
          reorderBtn(store, city.id, r.index, r.index + 1, '▼', r.index === rows.length - 1),
          dequeueBtn(store, city.id, r.index),
        ]);
        const progressBits = head
          ? [
              el('div', { class: 'q-head-nums' }, [
                el('span', { class: 'dim', text: `${Math.floor(r.progress)}/${cost}` }),
              ]),
              bar(cost > 0 ? r.progress / cost : 0, '#d69a4c'),
            ]
          : [];
        return el('div', { class: `q-item${head ? ' head' : ''}` }, [
          el('div', { class: 'q-item-top' }, [meta, ctrl]),
          ...progressBits,
        ]);
      })
    : [el('p', { class: 'dim', text: 'Queue empty — add production below.' })];

  // Add-to-queue picker.
  const options = assembleQueueOptions(game, content, city);
  const optionEls = options.map((o) => {
    const btn = el('button', {
      class: `build-opt${o.buildable ? '' : ' locked'}${o.queued ? ' queued' : ''}`,
      type: 'button',
      title: o.reason ?? `${o.name} — ${o.cost} production`,
    }, [
      el('span', { class: 'opt-name', text: o.name }),
      el('span', { class: 'opt-meta', text: `${o.kind === 'unit' ? '⚔ ' : '⌂ '}${o.cost}` }),
    ]);
    if (o.buildable && !full) {
      btn.addEventListener('click', () => {
        store.command({ type: 'queue-build', cityId: city.id, order: { kind: o.kind, id: o.id } });
      });
    } else {
      btn.disabled = true;
    }
    return btn;
  });

  const highlight = store.getState().highlightAddPicker;
  return el('div', { class: 'q-block' }, [
    el('div', { class: 'panel-h q-head-row' }, [
      el('span', { text: 'Production Queue' }),
      el('span', { class: 'q-count', text: `${city.buildQueue.length}/${QUEUE_CAP}` }),
    ]),
    el('div', { class: 'q-list' }, queueEls),
    el('h4', { class: `panel-h${highlight ? ' pulse' : ''}`, text: full ? 'Queue full' : 'Add to queue' }),
    el('div', { class: `build-opts${highlight ? ' pulse' : ''}` }, optionEls),
  ]);
}

function reorderBtn(
  store: Store,
  cityId: string,
  from: number,
  to: number,
  glyph: string,
  disabled: boolean,
): HTMLElement {
  const b = el('button', { class: 'q-ctl', type: 'button', text: glyph, title: 'Reorder' });
  if (disabled) b.disabled = true;
  else b.addEventListener('click', () => store.command({ type: 'reorder-build', cityId, from, to }));
  return b;
}

function dequeueBtn(store: Store, cityId: string, index: number): HTMLElement {
  const b = el('button', { class: 'q-ctl q-remove', type: 'button', text: '✕', title: 'Remove' });
  b.addEventListener('click', () => store.command({ type: 'dequeue-build', cityId, index }));
  return b;
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

  const body: (Node | null)[] = [];
  if (!def) {
    body.push(el('p', { class: 'dim', text: 'Unknown unit.' }));
  } else {
    body.push(unitCombatBlock(def, unit));
  }

  const moveBtn = el('button', { class: 'action-btn', type: 'button', text: 'Move ▸' });
  moveBtn.addEventListener('click', () => {
    store.setMoveMode({ kind: 'unit', id: unit.id });
    store.toast('Click a destination tile.', 'info');
  });

  const actions = el('div', { class: 'panel-actions' }, [moveBtn]);
  if (isSettler) {
    const foundBtn = el('button', { class: 'action-btn primary', type: 'button', text: 'Found City' });
    foundBtn.addEventListener('click', () => {
      const st = store.getState();
      const game = st.game!;
      const player = game.players.find((p) => p.id === st.humanPlayerId);
      const race = player ? store.content.races[player.setup.raceId] : undefined;
      // Pre-fill with the next auto-drawn themed name; blank input omits the
      // name and lets the sim draw it (same value, deterministically).
      const suggested = race ? pickCityName(game, race) : '';
      const name = window.prompt(`Name the new city (blank = ${suggested || 'auto'}):`, suggested);
      if (name === null) return; // cancelled
      const trimmed = name.trim();
      const ok = store.command({
        type: 'found-city',
        unitId: unit.id,
        ...(trimmed ? { name: trimmed } : {}),
      });
      if (ok) store.select(null);
    });
    actions.append(foundBtn);
  }
  body.push(actions);

  const mm = store.getState().moveMode;
  if (mm && mm.kind === 'unit' && mm.id === unit.id) {
    body.push(el('p', { class: 'note', text: 'Awaiting destination — click the map.' }));
  }
  if (unit.armyId !== undefined) {
    body.push(
      el('p', { class: 'note', text: 'In an army. Moving it alone will detach it from the army.' }),
    );
  }
  if (def?.description) body.push(el('p', { class: 'desc', text: def.description }));

  return panelShell(store, def?.name ?? unit.defId, `${def?.role ?? 'unit'}`, body);
}

/**
 * The new multi-figure combat block: figures × hits, melee, ranged (if any),
 * armor/speed/morale/discipline/skill, and hover-described ability badges.
 */
function unitCombatBlock(def: UnitDef, unit: UnitState): HTMLElement {
  const c = def.combat;
  const maxHp = c.figures * c.hits;
  const figuresNow = Math.max(0, Math.ceil(unit.hp / Math.max(1, c.hits)));

  const rows: HTMLElement[] = [];

  rows.push(
    el('div', { class: 'ucb-line' }, [
      el('span', { class: 'ucb-key', text: 'Formation' }),
      el('span', { class: 'ucb-val', text: `${figuresNow}/${c.figures} figures × ${c.hits} hits` }),
    ]),
  );
  rows.push(
    el('div', { class: 'ucb-line' }, [
      el('span', { class: 'ucb-key', text: 'HP pool' }),
      el('span', { class: 'ucb-val', text: `${unit.hp}/${maxHp}` }),
    ]),
  );
  rows.push(
    el('div', { class: 'ucb-line' }, [
      el('span', { class: 'ucb-key', text: 'Melee' }),
      el('span', {
        class: 'ucb-val',
        text: `${c.melee.attack} atk / ${c.melee.damage} dmg · reach ${c.melee.reach}`,
      }),
    ]),
  );
  if (c.ranged) {
    rows.push(
      el('div', { class: 'ucb-line' }, [
        el('span', { class: 'ucb-key', text: 'Ranged' }),
        el('span', {
          class: 'ucb-val',
          text: `${c.ranged.attack} atk / ${c.ranged.damage} dmg · rng ${c.ranged.range} · ${c.ranged.ammo} ammo`,
        }),
      ]),
    );
  }

  const chips = el('div', { class: 'unit-stats' }, [
    unitStat('Armor', c.armor),
    unitStat('Speed', c.speed),
    unitStat('Mass', c.mass),
    unitStat('Morale', c.morale),
    unitStat('Discip', c.discipline),
    unitStat('Skill', def.skill),
  ]);

  const badges =
    def.abilities.length > 0
      ? el(
          'div',
          { class: 'ability-badges' },
          def.abilities.map((a) => {
            const b = describeAbility(a);
            return el('span', { class: 'ability-badge', title: b.text, text: b.label });
          }),
        )
      : el('p', { class: 'dim ucb-noab', text: 'No special abilities.' });

  return el('div', { class: 'unit-combat' }, [
    el('div', { class: 'ucb-lines' }, rows),
    chips,
    el('h4', { class: 'panel-h', text: 'Abilities' }),
    badges,
  ]);
}

function unitStat(label: string, value: number | string): HTMLElement {
  return el('div', { class: 'unit-stat' }, [
    el('span', { class: 'us-label', text: label }),
    el('span', { class: 'us-val', text: String(value) }),
  ]);
}

// --- Stack & army panels ---------------------------------------------------

function hpColor(frac: number): string {
  return frac > 0.5 ? '#7fc96b' : frac > 0.25 ? '#e7c94a' : '#d6553f';
}

/**
 * A unit line for the stack/army lists: name (clickable to select the
 * individual), figure count ("342 / 350"), an hp bar, an army tag, and an
 * optional Leave button for a unit already in an army.
 */
function unitRowEl(
  store: Store,
  row: UnitRow,
  opts: { checkbox?: boolean; checked?: boolean; leave?: boolean },
): HTMLElement {
  const left: (Node | null)[] = [];
  if (opts.checkbox) {
    const cb = el('input', { class: 'stack-cb', type: 'checkbox' }) as HTMLInputElement;
    cb.checked = !!opts.checked;
    cb.addEventListener('change', () => store.toggleStackCheck(row.id));
    left.push(cb);
  }

  const nameBtn = el('button', { class: 'stack-name', type: 'button', title: 'Select this unit' }, [
    el('span', { text: row.name }),
    row.armyId !== undefined ? el('span', { class: 'army-tag', text: '⚑' }) : null,
  ]);
  nameBtn.addEventListener('click', () => store.select({ kind: 'unit', id: row.id }));

  const right: (Node | null)[] = [
    el('span', { class: 'stack-figs', text: `${row.figures} / ${row.maxFigures}` }),
  ];
  if (opts.leave && row.armyId !== undefined) {
    const lv = el('button', { class: 'stack-leave', type: 'button', text: 'Leave', title: 'Leave the army' });
    lv.addEventListener('click', () => store.command({ type: 'leave-army', unitIds: [row.id] }));
    right.push(lv);
  }

  return el('div', { class: 'stack-row' }, [
    el('div', { class: 'stack-row-top' }, [
      el('div', { class: 'stack-row-left' }, [...left, nameBtn]),
      el('div', { class: 'stack-row-right' }, right),
    ]),
    bar(row.hpFrac, hpColor(row.hpFrac)),
  ]);
}

/** Multi-unit stack panel: checkboxes + Form army; per-unit Leave / select. */
function stackPanel(store: Store, plane: CityState['plane'], x: number, y: number): HTMLElement {
  const st = store.getState();
  const game = st.game!;
  const rows = stackRows(game, store.content, st.humanPlayerId, plane, x, y);

  if (rows.length === 0) {
    return panelShell(store, 'Stack', `(${x}, ${y})`, [
      el('p', { class: 'dim', text: 'No units here.' }),
    ]);
  }

  const rowIds = rows.map((r) => r.id);
  const checked = new Set(st.stackChecked.filter((id) => rowIds.includes(id)));
  const allChecked = rowIds.every((id) => checked.has(id));

  const selectAll = el('label', { class: 'stack-all' }, [
    (() => {
      const cb = el('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = allChecked;
      cb.addEventListener('change', () => store.setStackChecked(allChecked ? [] : rowIds));
      return cb;
    })(),
    el('span', { text: 'Select all' }),
  ]);

  const rowEls = rows.map((r) =>
    unitRowEl(store, r, { checkbox: true, checked: checked.has(r.id), leave: true }),
  );

  const canForm = canFormArmy(rows, checked);
  const formBtn = el('button', { class: 'action-btn primary', type: 'button', text: `Form army (${checked.size})` });
  if (canForm) {
    formBtn.addEventListener('click', () => {
      const ok = store.command({ type: 'form-army', unitIds: [...checked] });
      if (ok) {
        store.setStackChecked([]);
        // Re-select the freshly formed army by re-selecting the stack; the map
        // click path will resolve a single-army tile to the army panel.
        store.select({ kind: 'stack', plane, x, y });
      }
    });
  } else {
    formBtn.disabled = true;
  }

  return panelShell(store, 'Stack', `(${x}, ${y}) · ${rows.length} units`, [
    el('p', { class: 'note', text: 'Tick units and Form army, or click a name to inspect one.' }),
    selectAll,
    el('div', { class: 'stack-list' }, rowEls),
    el('div', { class: 'panel-actions' }, [formBtn]),
  ]);
}

/** Army panel: members, slowest pace, total figures, army move, per-member ops. */
function armyPanel(store: Store, armyId: string): HTMLElement {
  const st = store.getState();
  const game = st.game!;
  const view = armyView(game, store.content, armyId);

  if (view.members.length === 0) {
    return panelShell(store, 'Army', 'disbanded', [
      el('p', { class: 'dim', text: 'This army no longer exists.' }),
    ]);
  }

  const moveBtn = el('button', { class: 'action-btn', type: 'button', text: 'Move army ▸' });
  moveBtn.addEventListener('click', () => {
    store.setMoveMode({ kind: 'army', id: armyId });
    store.toast('Click a destination tile — the whole army marches.', 'info');
  });

  const rowEls = view.members.map((r) => unitRowEl(store, r, { leave: true }));

  const body: (Node | null)[] = [
    el('div', { class: 'panel-line' }, [
      el('span', { text: `${view.members.length} units · pace ${view.pace} · ${view.totalFigures} figures` }),
    ]),
    el('div', { class: 'panel-actions' }, [moveBtn]),
    el('h4', { class: 'panel-h', text: 'Members' }),
    el('div', { class: 'stack-list' }, rowEls),
  ];

  const mm = st.moveMode;
  if (mm && mm.kind === 'army' && mm.id === armyId) {
    body.push(el('p', { class: 'note', text: 'Awaiting destination — click the map.' }));
  }

  return panelShell(store, 'Army', 'moves and fights as one', body);
}

// --- Lair panel ------------------------------------------------------------

function lairPanel(store: Store, lair: LairState): HTMLElement {
  const content = store.content;
  const monsters = lair.monsterIds.map((id) => content.units[id]).filter((d): d is UnitDef => !!d);
  // Danger hint: sum of figures × hits across the (living) garrison.
  const danger = monsters.reduce((sum, d) => sum + d.combat.figures * d.combat.hits, 0);
  const dangerLabel = danger < 20 ? 'Minor' : danger < 45 ? 'Dangerous' : danger < 90 ? 'Deadly' : 'Nightmare';

  const list = lair.cleared
    ? el('p', { class: 'dim', text: 'Cleared — the guardians are slain.' })
    : el(
        'ul',
        { class: 'building-list' },
        monsters.map((d) =>
          el('li', {}, [
            el('span', { text: `${d.name}` }),
            el('span', { class: 'dim', text: `  ${d.combat.figures}×${d.combat.hits}` }),
          ]),
        ),
      );

  const body: (Node | null)[] = [
    el('div', { class: 'panel-line' }, [
      el('span', { text: lair.cleared ? 'A cleared ruin.' : 'A monster lair. Scout before you strike.' }),
    ]),
    el('h4', { class: 'panel-h', text: 'Guardians' }),
    list,
  ];
  if (!lair.cleared) {
    body.push(
      el('div', { class: 'lair-hint' }, [
        el('span', { class: 'lair-danger', text: `Danger: ${dangerLabel}` }),
        el('span', { class: 'dim', text: ` (threat ${danger})` }),
      ]),
    );
    body.push(el('h4', { class: 'panel-h', text: 'Rumored loot' }));
    body.push(
      el('div', { class: 'yield-grid lair-loot' }, [
        el('div', { class: 'yield-cell' }, [
          el('span', { class: 'yield-dot', style: 'background:#e7c94a' }),
          el('span', { class: 'yield-label', text: 'Gold' }),
          el('span', { class: 'yield-val', text: String(lair.loot.gold) }),
        ]),
        el('div', { class: 'yield-cell' }, [
          el('span', { class: 'yield-dot', style: 'background:#c99be6' }),
          el('span', { class: 'yield-label', text: 'Mana' }),
          el('span', { class: 'yield-val', text: String(lair.loot.mana) }),
        ]),
      ]),
    );
  }

  return panelShellLair(store, lair.cleared ? 'Cleared Lair' : 'Monster Lair', `(${lair.x}, ${lair.y})`, body);
}

function panelShellLair(store: Store, title: string, sub: string, body: (Node | null)[]): HTMLElement {
  const close = el('button', { class: 'panel-close', type: 'button', text: '✕' });
  close.addEventListener('click', () => store.selectLair(null));
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

// --- Battle summary card (Watch / Skip prompt) -----------------------------

function battleSummaryCard(store: Store, rec: BattleRecord): HTMLElement {
  const start = battleStart(rec.report);
  const terrain = start ? start.field.terrain : '';
  const atkThreat = sideThreat(rec.report, 'attacker');
  const defThreat = sideThreat(rec.report, 'defender');

  const compCol = (label: string, side: 'attacker' | 'defender', threat: number, cls: string) =>
    el('div', { class: `card-col ${cls}` }, [
      el('div', { class: 'card-col-head' }, [
        el('span', { class: 'card-col-title', text: label }),
        el('span', { class: 'card-threat', text: `threat ${threat}` }),
      ]),
      el(
        'ul',
        { class: 'card-comp' },
        sideComposition(rec.report, side).map((r) =>
          el('li', { text: r.count > 1 ? `${r.name} ×${r.count}` : r.name }),
        ),
      ),
    ]);

  const watchBtn = el('button', { class: 'card-btn primary', id: 'battle-watch', type: 'button', text: 'Watch battle' });
  watchBtn.addEventListener('click', () => store.watchBattle(rec));
  const skipBtn = el('button', { class: 'card-btn', id: 'battle-skip', type: 'button', text: 'Skip' });
  skipBtn.addEventListener('click', () => store.skipBattle(rec));

  const outcome = rec.report.outcome.winner;
  return el('div', { class: 'battle-card-backdrop' }, [
    el('div', { class: 'battle-card', id: 'battle-card' }, [
      el('div', { class: 'card-head' }, [
        el('h2', { class: 'card-title', text: 'Battle!' }),
        el('span', { class: 'card-loc', text: `${terrain} · turn ${rec.turn} · (${rec.x}, ${rec.y})` }),
      ]),
      el('div', { class: 'card-cols' }, [
        compCol('Attacker', 'attacker', atkThreat, 'atk'),
        el('span', { class: 'card-vs', text: 'vs' }),
        compCol('Defender', 'defender', defThreat, 'def'),
      ]),
      el('p', { class: 'card-hint', text: `Outcome recorded: ${outcome === 'draw' ? 'stalemate' : outcome + ' victory'}. Watch to see why.` }),
      el('div', { class: 'card-actions' }, [skipBtn, watchBtn]),
    ]),
  ]);
}

// --- Battle log overlay ----------------------------------------------------

function battleLogOverlay(store: Store): HTMLElement {
  const st = store.getState();
  const battles = store.allBattles();

  const close = el('button', { class: 'panel-close', type: 'button', text: '✕' });
  close.addEventListener('click', () => store.toggleBattleLog(false));

  const rows = battles.length
    ? battles
        .slice()
        .reverse()
        .map((rec) => {
          const winner = rec.report.outcome.winner;
          const atk = sideComposition(rec.report, 'attacker').map((r) => (r.count > 1 ? `${r.name}×${r.count}` : r.name)).join(', ');
          const def = sideComposition(rec.report, 'defender').map((r) => (r.count > 1 ? `${r.name}×${r.count}` : r.name)).join(', ');
          const row = el('button', { class: 'log-row', type: 'button' }, [
            el('div', { class: 'log-row-top' }, [
              el('span', { class: 'log-turn', text: `Turn ${rec.turn}` }),
              el('span', { class: `log-outcome ${winner}`, text: winner === 'draw' ? 'stalemate' : `${winner} won` }),
              rec.lairId ? el('span', { class: 'log-lair', text: '⌖ lair' }) : null,
            ]),
            el('div', { class: 'log-row-comp', text: `${atk}  vs  ${def}` }),
          ]);
          row.addEventListener('click', () => store.watchBattle(rec));
          return row;
        })
    : [el('p', { class: 'dim', text: 'No battles fought yet.' })];

  return el('div', { class: 'battle-log-backdrop' }, [
    el('div', { class: 'battle-log' }, [
      el('div', { class: 'panel-title-row' }, [
        el('div', { class: 'panel-titles' }, [
          el('h2', { class: 'panel-title', text: 'Battle Log' }),
          el('span', { class: 'panel-sub', text: `${battles.length} battle(s)` }),
        ]),
        close,
      ]),
      el('div', { class: 'log-list' }, rows),
    ]),
  ]);
  void st;
}

// --- Entry -----------------------------------------------------------------

/** Builds the full game overlay for the current store state. */
export function renderGameOverlay(store: Store): HTMLElement {
  const st = store.getState();
  const game = st.game!;

  let side: HTMLElement | null = null;
  if (st.showResearch) {
    side = researchPanel(store);
  } else if (st.selectedLairId) {
    const lair = store.allLairs().find((l) => l.id === st.selectedLairId);
    if (lair) side = lairPanel(store, lair);
  } else if (st.selected?.kind === 'city') {
    const id = st.selected.id;
    const city = game.cities.find((c) => c.id === id);
    if (city) side = cityPanel(store, city);
  } else if (st.selected?.kind === 'unit') {
    const id = st.selected.id;
    const unit = game.units.find((u) => u.id === id);
    if (unit) side = unitPanel(store, unit);
  } else if (st.selected?.kind === 'army') {
    side = armyPanel(store, st.selected.id);
  } else if (st.selected?.kind === 'stack') {
    side = stackPanel(store, st.selected.plane, st.selected.x, st.selected.y);
  }

  // The Watch/Skip prompt appears when a new human battle is unacknowledged and
  // the full viewer / log aren't already open.
  const pending = store.pendingBattle();

  return el('div', { class: 'game-overlay' }, [
    topBar(store),
    side,
    st.showBattleLog ? battleLogOverlay(store) : null,
    pending ? battleSummaryCard(store, pending) : null,
    toastStack(store),
  ]);
}
