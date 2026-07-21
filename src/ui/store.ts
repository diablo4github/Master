/**
 * The single UI state store.
 *
 * Holds the authoritative GameState plus view-only UI state (current screen,
 * selection, active plane, camera intent, battle-viewer state, toasts). All sim
 * mutation flows through `command()`, which calls `applyCommand` and turns
 * thrown errors into toasts — views never call the sim directly. A
 * subscribe/notify loop lets views re-render on any change.
 */

import type { GameState, GameContent } from '@sim/core/state';
import type { PlaneId } from '@sim/types';
import { applyCommand, type Command } from '@sim/core/turn';
import {
  gameBattles,
  gameLairs,
  battleInvolves,
  type BattleRecord,
  type LairState,
} from './battleTypes';

export type Selection =
  | { kind: 'city'; id: string }
  | { kind: 'unit'; id: string }
  | { kind: 'army'; id: string }
  /** A multi-unit stack on a tile (no single id — identified by location). */
  | { kind: 'stack'; plane: PlaneId; x: number; y: number };

/** A pending move: whether the map click should move a solo unit or a whole army. */
export type MoveMode = { kind: 'unit'; id: string } | { kind: 'army'; id: string };

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
  /** Lair the lair panel is showing, or null. */
  selectedLairId: string | null;
  /** A pending move (solo unit or whole army) awaiting a target click, or null. */
  moveMode: MoveMode | null;
  /** Unit ids ticked in the stack panel (for Form army), reset on reselection. */
  stackChecked: string[];
  /**
   * When the End-Turn assistant opens an idle city, this pulses the city's
   * "Add to queue" picker so the player sees what to do. Cleared on reselection.
   */
  highlightAddPicker: boolean;
  /** Whether the research overlay is open. */
  showResearch: boolean;
  /** Which research shelf tab is active: the race tree or the magic (school) trees. */
  researchTab: 'race' | 'magic';
  /** Whether the battle-log list overlay is open. */
  showBattleLog: boolean;
  /** Battle currently being replayed full-screen, or null. */
  viewerBattle: BattleRecord | null;
  /** Ids of battles already prompted (Watch or Skip chosen). */
  watchedBattleIds: string[];
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

  /**
   * Dev/smoke-only overlays: battles and lairs injected outside the sim so the
   * viewer flow can be exercised before the sim's `game.lairs`/`game.battles`
   * fields are merged. Empty in a real game once the sim provides them.
   */
  private devBattles: BattleRecord[] = [];
  private devLairs: LairState[] = [];

  constructor(content: GameContent) {
    this.content = content;
    this.state = {
      screen: 'new-game',
      game: null,
      humanPlayerId: 'player-0',
      activePlane: 'meridia',
      selected: null,
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
      showResearch: false,
      researchTab: 'race',
      showBattleLog: false,
      viewerBattle: null,
      watchedBattleIds: [],
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
    this.devBattles = [];
    this.devLairs = [];
    this.set({
      screen: 'game',
      game,
      humanPlayerId,
      activePlane,
      selected: null,
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
      showResearch: false,
      showBattleLog: false,
      viewerBattle: null,
      watchedBattleIds: [],
      centerRequest: capital ? { x: capital.x, y: capital.y } : null,
    });
  }

  // --- View state ----------------------------------------------------------

  setActivePlane(plane: PlaneId): void {
    if (plane === this.state.activePlane) return;
    this.set({
      activePlane: plane,
      selected: null,
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
    });
  }

  select(sel: Selection | null): void {
    this.set({
      selected: sel,
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
    });
  }

  /** Select a city and pulse its Add-to-queue picker (End-Turn assistant). */
  openProduction(cityId: string): void {
    this.set({
      selected: { kind: 'city', id: cityId },
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: true,
      showResearch: false,
    });
  }

  selectLair(id: string | null): void {
    this.set({
      selectedLairId: id,
      selected: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
      showResearch: false,
    });
  }

  setMoveMode(mode: MoveMode | null): void {
    this.set({ moveMode: mode });
  }

  /** Toggle a unit's checkbox in the stack panel. */
  toggleStackCheck(unitId: string): void {
    const has = this.state.stackChecked.includes(unitId);
    this.set({
      stackChecked: has
        ? this.state.stackChecked.filter((id) => id !== unitId)
        : [...this.state.stackChecked, unitId],
    });
  }

  /** Replace the stack panel's checkbox set (select-all / clear). */
  setStackChecked(ids: string[]): void {
    this.set({ stackChecked: ids });
  }

  toggleResearch(open?: boolean): void {
    this.set({ showResearch: open ?? !this.state.showResearch });
  }

  setResearchTab(tab: 'race' | 'magic'): void {
    this.set({ researchTab: tab });
  }

  /**
   * End-Turn assistant: select an idle army, close overlays, and center on it so
   * its panel (with Move / Fortify prominent) is what the player sees next.
   */
  openArmyOrders(armyId: string): void {
    const game = this.state.game;
    const anchor = game?.units.find((u) => u.armyId === armyId) ?? null;
    this.set({
      selected: { kind: 'army', id: armyId },
      selectedLairId: null,
      moveMode: null,
      stackChecked: [],
      highlightAddPicker: false,
      showResearch: false,
      showBattleLog: false,
      centerRequest: anchor ? { x: anchor.x, y: anchor.y } : this.state.centerRequest,
    });
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

  // --- Battles & lairs -----------------------------------------------------

  /** All battle records: the sim's plus any dev/smoke-injected ones. */
  allBattles(): BattleRecord[] {
    const game = this.state.game;
    const sim = game ? gameBattles(game) : [];
    return [...sim, ...this.devBattles];
  }

  /** All lairs: the sim's plus any dev/smoke-injected ones. */
  allLairs(): LairState[] {
    const game = this.state.game;
    const sim = game ? gameLairs(game) : [];
    return [...sim, ...this.devLairs];
  }

  /**
   * The battle that should currently be prompting the player with a
   * Watch/Skip summary card: the most recent battle involving the human that
   * hasn't been acknowledged yet. Null when nothing is pending.
   */
  pendingBattle(): BattleRecord | null {
    const st = this.state;
    if (st.viewerBattle || st.showBattleLog) return null;
    const watched = new Set(st.watchedBattleIds);
    const battles = this.allBattles();
    for (let i = battles.length - 1; i >= 0; i--) {
      const rec = battles[i];
      if (rec && battleInvolves(rec, st.humanPlayerId) && !watched.has(rec.id)) {
        return rec;
      }
    }
    return null;
  }

  private markWatched(id: string): string[] {
    return this.state.watchedBattleIds.includes(id)
      ? this.state.watchedBattleIds
      : [...this.state.watchedBattleIds, id];
  }

  /** Dismiss the pending prompt without watching. */
  skipBattle(rec: BattleRecord): void {
    this.set({ watchedBattleIds: this.markWatched(rec.id) });
  }

  /** Open the full-screen replay for a battle (also marks it acknowledged). */
  watchBattle(rec: BattleRecord): void {
    this.set({
      viewerBattle: rec,
      watchedBattleIds: this.markWatched(rec.id),
      showBattleLog: false,
      showResearch: false,
    });
  }

  closeViewer(): void {
    this.set({ viewerBattle: null });
  }

  toggleBattleLog(open?: boolean): void {
    const next = open ?? !this.state.showBattleLog;
    this.set({ showBattleLog: next, showResearch: next ? false : this.state.showResearch });
  }

  /** Dev/smoke: inject a battle record so the prompt + viewer flow can run. */
  injectDevBattle(rec: BattleRecord): void {
    this.devBattles = [...this.devBattles, rec];
    this.set({}); // notify
  }

  /** Dev/smoke: inject a lair so it renders on the map. */
  injectDevLair(lair: LairState): void {
    this.devLairs = [...this.devLairs, lair];
    this.set({});
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
