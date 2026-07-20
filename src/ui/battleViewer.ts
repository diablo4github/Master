/**
 * The full-screen BATTLE VIEWER overlay (DOM chrome) + its Pixi playback layer.
 *
 * This is the learning tool from docs/DESIGN.md: the player watches a past
 * battle replay to understand *why* it went the way it did. It renders the
 * tactical field via `BattleView` (src/render/battleView.ts) and wraps it in
 * playback controls (play/pause, 1×/2×/4×, step, restart, tick scrubber), a
 * plain-language event feed synced to the clock, and a post-battle end card.
 *
 * Lifecycle is owned by main.ts: when `store.viewerBattle` is set it calls
 * `open(rec)`, and `close()` when it clears (Esc / the ✕). One Pixi Application
 * is created lazily and reused across battles.
 */

import { Application } from 'pixi.js';

import type { UnitDef } from '@sim/types';
import { BattleView, type BattleTime } from '@render/battleView';
import type { SpriteBank } from '@render/sprites';

import type { Store } from './store';
import type { BattleRecord } from './battleTypes';
import { el, clear } from './dom';
import {
  sideComposition,
  unitResults,
  buildFeed,
  battleStart,
  type FeedLine,
} from './battleSummary';

const SPEEDS = [1, 2, 4] as const;

export class BattleViewer {
  private readonly host: HTMLElement;
  private readonly store: Store;
  private readonly bank: SpriteBank;
  private readonly units: Record<string, UnitDef>;

  private app: Application | null = null;
  private view: BattleView | null = null;
  private root: HTMLElement | null = null;

  private rec: BattleRecord | null = null;
  private feed: FeedLine[] = [];
  private feedEls: { line: FeedLine; node: HTMLElement }[] = [];
  private feedListEl: HTMLElement | null = null;
  private lastFeedTick = -1;

  // Control refs rebuilt per open.
  private playBtn: HTMLButtonElement | null = null;
  private scrubber: HTMLInputElement | null = null;
  private tickLabel: HTMLElement | null = null;
  private speedBtns: { s: number; btn: HTMLButtonElement }[] = [];
  private endCard: HTMLElement | null = null;
  private endShown = false;

  constructor(host: HTMLElement, store: Store, bank: SpriteBank, units: Record<string, UnitDef>) {
    this.host = host;
    this.store = store;
    this.bank = bank;
    this.units = units;
    window.addEventListener('resize', () => this.view?.resize());
  }

  private async ensureApp(): Promise<void> {
    if (this.app) return;
    const app = new Application();
    await app.init({ background: '#0b0a10', antialias: false, resizeTo: this.host });
    app.canvas.classList.add('bv-canvas');
    this.host.appendChild(app.canvas);
    this.app = app;
    this.view = new BattleView(app, this.units);
    this.view.setBank(this.bank);
    this.view.onTime = (s) => this.onTime(s);
  }

  isOpenFor(id: string): boolean {
    return this.rec?.id === id;
  }

  async open(rec: BattleRecord): Promise<void> {
    await this.ensureApp();
    if (!this.app || !this.view) return;
    this.rec = rec;
    this.app.canvas.style.display = 'block';

    this.feed = buildFeed(rec.report);
    this.lastFeedTick = -1;
    this.endShown = false;

    this.buildChrome(rec);
    this.view.setReport(rec.report);
    // Kick off playback shortly so the opening frame is visible first.
    this.view.seek(0);
    this.view.play();
  }

  close(): void {
    this.view?.pause();
    if (this.app) this.app.canvas.style.display = 'none';
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.rec = null;
  }

  // --- DOM chrome ----------------------------------------------------------

  private buildChrome(rec: BattleRecord): void {
    if (this.root) this.root.remove();
    const start = battleStart(rec.report);
    const terrain = start ? start.field.terrain : '';

    const closeBtn = el('button', { class: 'bv-close', type: 'button', text: '✕ Close (Esc)' });
    closeBtn.addEventListener('click', () => this.store.closeViewer());

    const title = el('div', { class: 'bv-title' }, [
      el('span', { class: 'bv-vs' }, [
        el('span', { class: 'bv-side atk', text: this.compText(rec, 'attacker') }),
        el('span', { class: 'bv-versus', text: 'vs' }),
        el('span', { class: 'bv-side def', text: this.compText(rec, 'defender') }),
      ]),
      el('span', { class: 'bv-loc', text: `${terrain} · turn ${rec.turn} · (${rec.x}, ${rec.y})` }),
    ]);

    const top = el('div', { class: 'bv-top' }, [title, closeBtn]);

    // Event feed.
    this.feedEls = [];
    const feedNodes = this.feed.map((line) => {
      const node = el('div', { class: `bv-feed-line ${line.tone ?? 'normal'}${line.side ? ' ' + line.side : ''}` }, [
        el('span', { class: 'bv-feed-tick', text: `t${line.tick}` }),
        el('span', { class: 'bv-feed-text', text: line.text }),
      ]);
      this.feedEls.push({ line, node });
      return node;
    });
    this.feedListEl = el('div', { class: 'bv-feed-list' }, feedNodes);
    const feed = el('div', { class: 'bv-feed' }, [
      el('div', { class: 'bv-feed-head', text: 'Battle Report' }),
      this.feedListEl,
    ]);

    // Controls.
    const controls = this.buildControls();

    // End card (hidden until shown).
    this.endCard = this.buildEndCard(rec);
    this.endCard.style.display = 'none';

    this.root = el('div', { class: 'battle-viewer' }, [top, feed, controls, this.endCard]);
    this.host.appendChild(this.root);
  }

  private compText(rec: BattleRecord, side: 'attacker' | 'defender'): string {
    const rows = sideComposition(rec.report, side);
    if (!rows.length) return side === 'attacker' ? 'Attacker' : 'Defender';
    return rows.map((r) => (r.count > 1 ? `${r.name} ×${r.count}` : r.name)).join(', ');
  }

  private buildControls(): HTMLElement {
    const view = this.view!;

    const restart = el('button', { class: 'bv-ctl', type: 'button', title: 'Restart', text: '⏮' });
    restart.addEventListener('click', () => view.restart());

    const stepBack = el('button', { class: 'bv-ctl', type: 'button', title: 'Step back', text: '◀|' });
    stepBack.addEventListener('click', () => view.stepTick(-1));

    this.playBtn = el('button', { class: 'bv-ctl bv-play', type: 'button', title: 'Play/Pause', text: '▶' });
    this.playBtn.addEventListener('click', () => view.togglePlay());

    const stepFwd = el('button', { class: 'bv-ctl', type: 'button', title: 'Step forward', text: '|▶' });
    stepFwd.addEventListener('click', () => view.stepTick(1));

    this.speedBtns = SPEEDS.map((s) => {
      const btn = el('button', { class: `bv-ctl bv-speed${s === 1 ? ' active' : ''}`, type: 'button', text: `${s}×` });
      btn.addEventListener('click', () => view.setSpeed(s));
      return { s, btn };
    });

    this.scrubber = el('input', {
      class: 'bv-scrub',
      type: 'range',
      min: '0',
      max: String(Math.max(1, view.getMaxTick())),
      value: '0',
      step: '1',
    }) as HTMLInputElement;
    this.scrubber.addEventListener('input', () => {
      if (this.scrubber) view.seek(parseInt(this.scrubber.value, 10));
    });

    this.tickLabel = el('span', { class: 'bv-tick-label', text: `0 / ${view.getMaxTick()}` });

    return el('div', { class: 'bv-controls' }, [
      el('div', { class: 'bv-ctl-group' }, [restart, stepBack, this.playBtn, stepFwd]),
      el('div', { class: 'bv-ctl-group bv-speeds' }, this.speedBtns.map((x) => x.btn)),
      this.scrubber,
      this.tickLabel,
    ]);
  }

  private buildEndCard(rec: BattleRecord): HTMLElement {
    const results = unitResults(rec.report);
    const winner = rec.report.outcome.winner;
    const ticks = rec.report.outcome.ticks;

    const rowFor = (side: 'attacker' | 'defender') =>
      results
        .filter((r) => r.side === side)
        .map((r) =>
          el('div', { class: `bv-res-row${r.survived ? '' : ' dead'}` }, [
            el('span', { class: 'bv-res-name', text: r.name }),
            el('span', {
              class: 'bv-res-fig',
              text: r.survived
                ? `${r.endFigures}/${r.startFigures} figures`
                : `wiped (${r.startFigures} lost)`,
            }),
          ]),
        );

    const loot = rec.lairId
      ? el('div', { class: 'bv-loot', text: this.lootText(rec) })
      : null;

    const replayBtn = el('button', { class: 'bv-ctl bv-replay', type: 'button', text: '↺ Replay' });
    replayBtn.addEventListener('click', () => {
      if (this.endCard) this.endCard.style.display = 'none';
      this.endShown = false;
      this.view?.restart();
    });
    const doneBtn = el('button', { class: 'bv-ctl bv-done', type: 'button', text: 'Close' });
    doneBtn.addEventListener('click', () => this.store.closeViewer());

    return el('div', { class: 'bv-endcard' }, [
      el('div', {
        class: `bv-end-banner ${winner}`,
        text: winner === 'draw' ? 'Stalemate' : `${cap(winner)} Victory`,
      }),
      el('div', { class: 'bv-end-sub', text: `${ticks} ticks` }),
      el('div', { class: 'bv-end-cols' }, [
        el('div', { class: 'bv-end-col' }, [el('h4', { text: 'Attacker' }), ...rowFor('attacker')]),
        el('div', { class: 'bv-end-col' }, [el('h4', { text: 'Defender' }), ...rowFor('defender')]),
      ]),
      loot,
      el('div', { class: 'bv-end-actions' }, [replayBtn, doneBtn]),
    ]);
  }

  private lootText(rec: BattleRecord): string {
    const lair = this.store.allLairs().find((l) => l.id === rec.lairId);
    const won = rec.report.outcome.winner === 'attacker';
    if (!lair) return won ? 'Lair cleared.' : 'The lair holds.';
    if (!won) return 'The lair holds — no loot taken.';
    return `Lair cleared — loot: ${lair.loot.gold} gold, ${lair.loot.mana} mana.`;
  }

  // --- Playback sync -------------------------------------------------------

  private onTime(s: BattleTime): void {
    if (this.playBtn) this.playBtn.textContent = s.playing ? '❚❚' : '▶';
    if (this.scrubber && document.activeElement !== this.scrubber) {
      this.scrubber.value = String(Math.min(s.maxTick, Math.round(s.t)));
    }
    if (this.tickLabel) this.tickLabel.textContent = `${s.tick} / ${s.maxTick}`;
    for (const { s: sp, btn } of this.speedBtns) btn.classList.toggle('active', sp === s.speed);

    if (s.tick !== this.lastFeedTick) {
      this.lastFeedTick = s.tick;
      this.highlightFeed(s.tick);
    }

    // Reveal the end card once playback reaches the end and stops.
    if (!s.playing && s.t >= s.maxTick + 0.999 && !this.endShown && this.endCard) {
      this.endShown = true;
      this.endCard.style.display = 'flex';
    }
  }

  private highlightFeed(tick: number): void {
    let lastVisible: HTMLElement | null = null;
    for (const { line, node } of this.feedEls) {
      const shown = line.tick <= tick;
      node.classList.toggle('past', shown);
      node.classList.toggle('current', line.tick === tick);
      if (shown) lastVisible = node;
    }
    if (lastVisible && this.feedListEl) {
      lastVisible.scrollIntoView({ block: 'nearest' });
    }
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
