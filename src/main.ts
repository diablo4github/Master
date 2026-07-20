/**
 * Entry point: wires the Pixi map renderer, the DOM UI overlay, and the store
 * together into the first playable 4X loop.
 *
 *   store (GameState + UI state)  ──subscribe──▶  render()
 *        ▲                                          │
 *        │ commands                                 ├─ DOM overlay (new game / HUD / panels)
 *        │                                          └─ MapView (terrain / cities / units)
 *   user input (DOM buttons, map clicks, keys)
 */

import { Application } from 'pixi.js';

import { CONTENT } from '@data/content';
import { loadSprites } from '@render/sprites';
import { MapView } from '@render/mapView';
import { Store } from '@ui/store';
import { mountNewGame } from '@ui/newGame';
import { renderGameOverlay } from '@ui/gameScreen';
import { clear } from '@ui/dom';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({ background: '#0a0a12', resizeTo: window, antialias: false });
  document.body.appendChild(app.canvas);
  app.canvas.classList.add('game-canvas');

  const bank = await loadSprites();
  const store = new Store(CONTENT);
  const mapView = new MapView(app, bank);

  // DOM overlay root.
  const overlay = document.createElement('div');
  overlay.id = 'ui-root';
  document.body.appendChild(overlay);

  // --- Map interaction ----------------------------------------------------
  mapView.onTileClick = (tileX, tileY) => {
    const st = store.getState();
    const game = st.game;
    if (!game) return;

    // Move mode: the next click is a destination for the pending unit.
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

    if (unit || city) store.toggleResearch(false);

    if (unit && city) {
      // Stacked (e.g. capital + garrison): select the city first, then cycle to
      // the unit on a repeat click so both remain reachable from the map.
      if (st.selected?.kind === 'city' && st.selected.id === city.id) {
        store.select({ kind: 'unit', id: unit.id });
      } else {
        store.select({ kind: 'city', id: city.id });
      }
    } else if (unit) {
      store.select({ kind: 'unit', id: unit.id });
    } else if (city) {
      store.select({ kind: 'city', id: city.id });
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

    // Game screen.
    newGameMounted = false;
    const game = st.game;
    if (!game) return;

    // Sync terrain when the plane changes.
    const map = game.maps[st.activePlane];
    if (map && lastPlane !== st.activePlane) {
      mapView.setPlane(map);
      lastPlane = st.activePlane;
    }

    // Sync entities + selection highlight.
    mapView.syncEntities(game, st.activePlane, st.selected);

    // Consume a pending recenter request (e.g. new game → capital).
    if (st.centerRequest) {
      mapView.centerOn(st.centerRequest.x, st.centerRequest.y);
      store.consumeCenter();
    }

    // Rebuild the DOM overlay.
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
    switch (e.key) {
      case 'ArrowLeft': mapView.panTiles(-2, 0); break;
      case 'ArrowRight': mapView.panTiles(2, 0); break;
      case 'ArrowUp': mapView.panTiles(0, -2); break;
      case 'ArrowDown': mapView.panTiles(0, 2); break;
      case 'Escape':
        store.toggleResearch(false);
        store.select(null);
        store.setMoveMode(null);
        break;
      case 'r': case 'R': store.toggleResearch(); break;
      default: return;
    }
    e.preventDefault();
  });
}

void main();
