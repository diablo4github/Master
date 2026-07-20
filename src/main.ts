/**
 * Entry point: wires the Pixi map renderer, the DOM UI overlay, the battle
 * viewer, and the store together into the first playable 4X loop.
 *
 *   store (GameState + UI state)  ──subscribe──▶  render()
 *        ▲                                          │
 *        │ commands                                 ├─ DOM overlay (new game / HUD / panels / prompts)
 *        │                                          ├─ MapView (terrain / cities / units / lairs)
 *   user input                                      └─ BattleViewer (full-screen replay)
 */

import { Application } from 'pixi.js';

import { CONTENT } from '@data/content';
import { loadSprites } from '@render/sprites';
import { MapView } from '@render/mapView';
import { resolveStacks, type StackUnit } from '@sim/combat/resolve';
import type { UnitState, PlaneId } from '@sim/types';
import { Store } from '@ui/store';
import { mountNewGame } from '@ui/newGame';
import { renderGameOverlay } from '@ui/gameScreen';
import { BattleViewer } from '@ui/battleViewer';
import type { BattleRecord, LairState } from '@ui/battleTypes';
import { clear } from '@ui/dom';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({ background: '#0a0a12', resizeTo: window, antialias: false });
  document.body.appendChild(app.canvas);
  app.canvas.classList.add('game-canvas');

  const bank = await loadSprites();
  const store = new Store(CONTENT);
  const mapView = new MapView(app, bank, CONTENT.units);

  // DOM overlay root.
  const overlay = document.createElement('div');
  overlay.id = 'ui-root';
  document.body.appendChild(overlay);

  // Battle viewer host (own Pixi canvas, mounted lazily on first open).
  const battleRoot = document.createElement('div');
  battleRoot.id = 'battle-root';
  document.body.appendChild(battleRoot);
  const battleViewer = new BattleViewer(battleRoot, store, bank, CONTENT.units);

  // --- Map interaction ----------------------------------------------------
  mapView.onTileClick = (tileX, tileY) => {
    const st = store.getState();
    const game = st.game;
    if (!game) return;

    if (st.moveMode) {
      store.command({ type: 'move-unit', unitId: st.moveMode, to: { x: tileX, y: tileY } });
      store.setMoveMode(null);
      return;
    }

    const unit = game.units.find(
      (u) => u.owner === st.humanPlayerId && u.plane === st.activePlane && u.x === tileX && u.y === tileY,
    );
    const city = game.cities.find(
      (c) => c.plane === st.activePlane && c.x === tileX && c.y === tileY,
    );
    const lair = store
      .allLairs()
      .find((l) => l.plane === st.activePlane && l.x === tileX && l.y === tileY);

    if (unit || city || lair) store.toggleResearch(false);

    if (unit && city) {
      if (st.selected?.kind === 'city' && st.selected.id === city.id) {
        store.select({ kind: 'unit', id: unit.id });
      } else {
        store.select({ kind: 'city', id: city.id });
      }
    } else if (unit) {
      store.select({ kind: 'unit', id: unit.id });
    } else if (city) {
      store.select({ kind: 'city', id: city.id });
    } else if (lair) {
      store.selectLair(lair.id);
    } else {
      store.select(null);
    }
  };

  // --- Render loop (state-driven) -----------------------------------------
  let newGameMounted = false;
  let lastPlane: string | null = null;

  function render(): void {
    const st = store.getState();

    if (st.screen === 'new-game') {
      if (!newGameMounted) {
        clear(overlay);
        mountNewGame(overlay, store);
        newGameMounted = true;
        lastPlane = null;
      }
      return;
    }

    newGameMounted = false;
    const game = st.game;
    if (!game) return;

    const map = game.maps[st.activePlane];
    if (map && lastPlane !== st.activePlane) {
      mapView.setPlane(map);
      lastPlane = st.activePlane;
    }

    mapView.syncEntities(game, st.activePlane, st.selected, store.allLairs(), st.selectedLairId);

    if (st.centerRequest) {
      mapView.centerOn(st.centerRequest.x, st.centerRequest.y);
      store.consumeCenter();
    }

    // Battle viewer open/close (fire-and-forget; open() is async).
    if (st.viewerBattle) {
      if (!battleViewer.isOpenFor(st.viewerBattle.id)) void battleViewer.open(st.viewerBattle);
    } else {
      battleViewer.close();
    }

    clear(overlay);
    overlay.append(renderGameOverlay(store));
  }

  store.subscribe(render);
  render();

  // --- Keyboard -----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (store.getState().screen !== 'game') return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const st = store.getState();
    switch (e.key) {
      case 'ArrowLeft': mapView.panTiles(-2, 0); break;
      case 'ArrowRight': mapView.panTiles(2, 0); break;
      case 'ArrowUp': mapView.panTiles(0, -2); break;
      case 'ArrowDown': mapView.panTiles(0, 2); break;
      case 'Escape':
        if (st.viewerBattle) { store.closeViewer(); break; }
        if (st.showBattleLog) { store.toggleBattleLog(false); break; }
        store.toggleResearch(false);
        store.select(null);
        store.selectLair(null);
        store.setMoveMode(null);
        break;
      case 'r': case 'R': store.toggleResearch(); break;
      default: return;
    }
    e.preventDefault();
  });

  installDevHooks(store);
}

// ---------------------------------------------------------------------------
// Dev/preview-only debugging hooks (exposed on window.__master).
//
// Gated to localhost so a real deployment never ships them. Lets the smoke test
// (and manual debugging) drive the lair/battle flow before the sim's
// game.lairs/game.battles fields are merged: it injects a lair on the map and
// fabricates a real BattleReport via the sim's resolveStacks, then hands it to
// the store so the Watch/Skip prompt and full viewer light up.
// ---------------------------------------------------------------------------

interface MasterDevApi {
  store: Store;
  simulateLairBattle: (opts?: { monsterIds?: string[] }) => BattleRecord | null;
  injectLair: (partial?: Partial<LairState>) => LairState | null;
  state: () => unknown;
}

function installDevHooks(store: Store): void {
  const host = location.hostname;
  const isLocal =
    import.meta.env.DEV || host === 'localhost' || host === '127.0.0.1' || host === '';
  if (!isLocal) return;

  const api: MasterDevApi = {
    store,
    state: () => store.getState().game,
    injectLair: (partial) => {
      const game = store.getState().game;
      if (!game) return null;
      const cap = game.cities.find((c) => c.owner === store.getState().humanPlayerId);
      const plane: PlaneId = store.getState().activePlane;
      const lair: LairState = {
        id: partial?.id ?? `lair-dev-${store.allLairs().length}`,
        plane: partial?.plane ?? plane,
        x: partial?.x ?? (cap ? cap.x + 2 : 4),
        y: partial?.y ?? (cap ? cap.y : 4),
        monsterIds: partial?.monsterIds ?? ['giant-spiders', 'wolf-pack'],
        monsterHp: partial?.monsterHp ?? [10, 12],
        loot: partial?.loot ?? { gold: 120, mana: 40 },
        cleared: partial?.cleared ?? false,
      };
      store.injectDevLair(lair);
      return lair;
    },
    simulateLairBattle: (opts) => {
      const game = store.getState().game;
      if (!game) return null;
      const humanId = store.getState().humanPlayerId;
      const monsterIds = opts?.monsterIds ?? ['giant-spiders', 'wolf-pack'];

      const plane = store.getState().activePlane;

      // Attacker: the human's units (garrison + escort). Fall back to a militia.
      const attacker: StackUnit[] = [];
      for (const s of game.units.filter((u) => u.owner === humanId).slice(0, 4)) {
        const def = CONTENT.units[s.defId];
        if (def) attacker.push({ state: s, def });
      }
      if (attacker.length === 0) {
        const militia = CONTENT.units['militia'];
        if (militia) {
          const state: UnitState = {
            id: 'dev-atk', owner: humanId, defId: 'militia', plane, x: 0, y: 0,
            moves: militia.moves, hp: militia.combat.figures * militia.combat.hits,
          };
          attacker.push({ state, def: militia });
        }
      }

      const defender: StackUnit[] = [];
      monsterIds.forEach((mid, i) => {
        const def = CONTENT.units[mid];
        if (!def) return;
        const state: UnitState = {
          id: `mon-${i}`, owner: 'neutral', defId: mid, plane, x: 0, y: 0,
          moves: def.moves, hp: def.combat.figures * def.combat.hits,
        };
        defender.push({ state, def });
      });

      if (attacker.length === 0 || defender.length === 0) return null;

      const lair = store.allLairs()[0];
      const result = resolveStacks({
        seed: (game.settings.seed ^ (game.turn * 2654435761)) | 0,
        attacker,
        defender,
        terrain: { plane: store.getState().activePlane, terrain: 'grassland' },
      });
      const rec: BattleRecord = {
        id: `battle-dev-${store.allBattles().length}`,
        turn: game.turn,
        plane: store.getState().activePlane,
        x: lair ? lair.x : 4,
        y: lair ? lair.y : 4,
        attackerPlayer: humanId,
        defenderPlayer: 'neutral',
        report: result.report,
        lairId: lair ? lair.id : undefined,
      };
      store.injectDevBattle(rec);
      return rec;
    },
  };

  (window as unknown as { __master: MasterDevApi }).__master = api;
}

void main();
