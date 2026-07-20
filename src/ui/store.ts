/**
 * The single UI state store.
 *
 * Holds the authoritative GameState plus view-only UI state (current screen,
 * selection, active plane, camera intent, toasts). All sim mutation flows
 * through `command()`, which calls `applyCommand` and turns thrown errors into
 * toasts — views never call the sim directly. A subscribe/notify loop lets
 * views re-render on any change.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { PlaneId } from '@sim/types';
import { applyCommand, type Command } from '@sim/core/turn';

export interface Selection {
  kind: 'city' | 'unit';
  id: string;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

export interface UiState {
  screen: 'new-game' | 'game';
  game: GameState | null;
  humanPlayerId: string;
  activePlane: PlaneId;
  selected: Selection | null;
  /** Unit id awaiting a move-target click, or null. */
  moveMode: string | null;
  /** Whether the research overlay is open. */
  showResearch: boolean;
  toasts: Toast[];
  /** Tile the map view should recentre on (consumed by the view), or null. */
  centerRequest: { x: number; y: number } | null;
}

type Listener = () => void;

export class Store {
  readonly content: GameContent;
  private state: UiState;
  private listeners = new Set<Listener>();
  private nextToastId = 1;

  constructor(content: GameContent) {
    this.content = content;
    this.state = {
      screen: 'new-game',
      game: null,
      humanPlayerId: 'player-0',
      activePlane: 'meridia',
      selected: null,
      moveMode: null,
      showResearch: false,
      toasts: [],
      centerRequest: null,
    };
  }

  getState(): UiState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<UiState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  // --- Lifecycle -----------------------------------------------------------

  startGame(game: GameState, humanPlayerId: string, activePlane: PlaneId): void {
    const capital = game.cities.find((c) => c.owner === humanPlayerId) ?? null;
    this.set({
      screen: 'game',
      game,
      humanPlayerId,
      activePlane,
      selected: null,
      moveMode: null,
      showResearch: false,
      centerRequest: capital ? { x: capital.x, y: capital.y } : null,
    });
  }

  // --- View state ----------------------------------------------------------

  setActivePlane(plane: PlaneId): void {
    if (plane === this.state.activePlane) return;
    this.set({ activePlane: plane, selected: null, moveMode: null });
  }

  select(sel: Selection | null): void {
    this.set({ selected: sel, moveMode: null });
  }

  setMoveMode(unitId: string | null): void {
    this.set({ moveMode: unitId });
  }

  toggleResearch(open?: boolean): void {
    this.set({ showResearch: open ?? !this.state.showResearch });
  }

  requestCenter(x: number, y: number): void {
    this.set({ centerRequest: { x, y } });
  }

  consumeCenter(): void {
    if (this.state.centerRequest) this.set({ centerRequest: null });
  }

  toast(message: string, kind: Toast['kind'] = 'info'): void {
    const t: Toast = { id: this.nextToastId++, message, kind };
    this.set({ toasts: [...this.state.toasts, t] });
    window.setTimeout(() => this.dismissToast(t.id), 4500);
  }

  dismissToast(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  // --- Sim mutation --------------------------------------------------------

  /** Applies a command for the human player. Returns success; toasts on error. */
  command(cmd: Command): boolean {
    const game = this.state.game;
    if (!game) return false;
    try {
      const next = applyCommand(game, this.content, this.state.humanPlayerId, cmd);
      this.set({ game: next });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.toast(message, 'error');
      return false;
    }
  }
}
