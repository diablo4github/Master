/**
 * The tactical battle viewer's RENDER layer.
 *
 * Pure playback: given a BattleReport (the deterministic event log from
 * src/sim/combat), it draws the tactical field and animates the event stream
 * tick by tick — it never re-runs the simulation. It owns its own PixiJS
 * Application (a separate full-screen canvas from the strategic MapView) and a
 * playback clock; the DOM overlay in src/ui/battleViewer.ts drives it through
 * play/pause/speed/seek and reads back the clock via `onTime`.
 *
 * Coordinate model: the field is `width × height` tiles (from battle-start).
 * Unit frames are precomputed per integer tick (start-of-tick state); movement
 * tweens within a tick along the event's path; hp/figure changes and transient
 * effects (volleys, melee bumps, floating numbers, ability flashes, morale
 * icons, rout arrows, death fades) render from the events at the current tick.
 */

import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';

import type { UnitDef } from '@sim/types';
import type {
  BattleReport,
  BattleEvent,
  BattleStartEvent,
  UnitSummary,
  MoveEvent,
  BattleSideId,
  EventPoint,
} from '@sim/combat/events';

import type { SpriteBank } from './sprites';
import { battleSpriteFor, battleGroundColor } from './spriteMaps';

type Status = 'fighting' | 'routing' | 'fled' | 'dead';

interface Frame {
  x: number;
  y: number;
  figures: number;
  hp: number;
  status: Status;
  alive: boolean;
}

interface UnitInfo {
  summary: UnitSummary;
  def: UnitDef | undefined;
  side: BattleSideId;
  maxFigures: number;
  maxHp: number;
}

const SIDE_COLOR: Record<BattleSideId, number> = {
  attacker: 0x74c7ff,
  defender: 0xff8158,
};

/** Base seconds per tick at 1× speed. */
const TICK_SECONDS = 0.62;

export interface BattleTime {
  tick: number;
  t: number;
  maxTick: number;
  playing: boolean;
  speed: number;
}

export class BattleView {
  private readonly app: Application;
  private readonly units: Record<string, UnitDef>;
  private bank: SpriteBank | null = null;

  private readonly ground = new Graphics();
  private readonly markers = new Graphics();
  private readonly tokenLayer = new Container();
  private readonly fxLayer = new Container();
  /** Hover tooltip (unit provenance name); sits above everything, never cleared. */
  private readonly tooltip = new Container();
  private tooltipBg = new Graphics();
  private tooltipText: Text | null = null;

  /** report-unit-id → display name (provenance), supplied by the viewer. */
  private names: Map<string, string> = new Map();

  // Field geometry
  private fieldW = 20;
  private fieldH = 14;
  private cell = 32;
  private ox = 0;
  private oy = 0;

  // Precomputed timeline
  private info = new Map<string, UnitInfo>();
  private snapshots: Map<string, Frame>[] = []; // index = tick (start-of-tick)
  private movesByTick = new Map<number, MoveEvent[]>();
  private fxByTick = new Map<number, BattleEvent[]>();
  private blocked: EventPoint[] = [];
  private cover: EventPoint[] = [];
  private maxTick = 0;

  // Playback clock
  private time = 0; // float ticks
  private playing = false;
  private speed = 1;

  onTime: (s: BattleTime) => void = () => {};

  constructor(app: Application, units: Record<string, UnitDef>) {
    this.app = app;
    this.units = units;
    app.stage.addChild(this.ground);
    app.stage.addChild(this.markers);
    app.stage.addChild(this.tokenLayer);
    app.stage.addChild(this.fxLayer);
    app.stage.addChild(this.tooltip);
    this.tooltip.visible = false;
    this.tooltip.addChild(this.tooltipBg);
    app.ticker.add(this.tick);
  }

  setBank(bank: SpriteBank): void {
    this.bank = bank;
  }

  /** Supply provenance display names (report-unit-id → name) for tooltips. */
  setNames(names: Map<string, string>): void {
    this.names = names;
  }

  private showTooltip(name: string, x: number, y: number): void {
    if (this.tooltipText) {
      this.tooltip.removeChild(this.tooltipText);
      this.tooltipText.destroy();
    }
    const t = new Text({
      text: name,
      style: {
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        fontWeight: 'bold',
        fill: '#f4ecd6',
      },
    });
    t.anchor.set(0.5, 1);
    this.tooltipText = t;
    const padX = 6;
    const padY = 3;
    const w = t.width + padX * 2;
    const h = t.height + padY * 2;
    this.tooltipBg.clear();
    this.tooltipBg
      .roundRect(-w / 2, -h, w, h, 4)
      .fill({ color: 0x14110c, alpha: 0.92 })
      .stroke({ color: 0xf2d58f, width: 1, alpha: 0.8 });
    t.y = -padY;
    this.tooltip.addChild(t);
    this.tooltip.x = x;
    this.tooltip.y = y;
    this.tooltip.visible = true;
  }

  private hideTooltip(): void {
    this.tooltip.visible = false;
  }

  destroy(): void {
    this.app.ticker.remove(this.tick);
    this.app.destroy(true, { children: true });
  }

  // --- Timeline precompute -------------------------------------------------

  setReport(report: BattleReport): void {
    const start = report.events.find((e) => e.type === 'battle-start') as
      | BattleStartEvent
      | undefined;
    if (!start) return;

    this.fieldW = start.field.width;
    this.fieldH = start.field.height;
    this.blocked = start.field.blocked;
    this.cover = start.field.cover;
    this.groundColor = battleGroundColor(start.field.terrain);

    this.info.clear();
    const cur = new Map<string, Frame>();
    for (const u of start.units) {
      const def = this.units[u.defId];
      this.info.set(u.id, {
        summary: u,
        def,
        side: u.side,
        maxFigures: Math.max(1, Math.round(u.maxHp / Math.max(1, u.hits))),
        maxHp: u.maxHp,
      });
      cur.set(u.id, {
        x: u.start.x,
        y: u.start.y,
        figures: u.figures,
        hp: u.startHp,
        status: 'fighting',
        alive: true,
      });
    }

    this.movesByTick.clear();
    this.fxByTick.clear();
    this.maxTick = report.outcome.ticks;

    // Group events by tick.
    const byTick = new Map<number, BattleEvent[]>();
    for (const e of report.events) {
      if (e.type === 'battle-start') continue;
      const list = byTick.get(e.tick) ?? [];
      list.push(e);
      byTick.set(e.tick, list);
      this.maxTick = Math.max(this.maxTick, e.tick);
    }

    // Build start-of-tick snapshots by replaying tick by tick.
    this.snapshots = [];
    for (let ti = 0; ti <= this.maxTick; ti++) {
      // snapshot = state entering tick ti
      this.snapshots[ti] = cloneFrames(cur);
      const events = byTick.get(ti) ?? [];
      const moves: MoveEvent[] = [];
      const fx: BattleEvent[] = [];
      for (const e of events) {
        applyEvent(cur, e);
        if (e.type === 'move') moves.push(e);
        else if (e.type !== 'rally') fx.push(e);
        else fx.push(e);
      }
      if (moves.length) this.movesByTick.set(ti, moves);
      if (fx.length) this.fxByTick.set(ti, fx);
    }
    // Final resting snapshot.
    this.snapshots[this.maxTick + 1] = cloneFrames(cur);

    this.time = 0;
    this.playing = false;
    this.layout();
    this.drawGround();
    this.render();
    this.emit();
  }

  private groundColor = 0x40402f;

  // --- Layout --------------------------------------------------------------

  resize(): void {
    this.layout();
    this.drawGround();
    this.render();
  }

  private layout(): void {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const padX = 40;
    const padTop = 96; // room for the top control bar / title
    const padBottom = 150; // room for the event feed / end card handled by DOM
    const availW = Math.max(120, w - padX * 2);
    const availH = Math.max(120, h - padTop - padBottom);
    this.cell = Math.floor(Math.min(availW / this.fieldW, availH / this.fieldH));
    this.cell = Math.max(14, this.cell);
    const fieldPxW = this.cell * this.fieldW;
    const fieldPxH = this.cell * this.fieldH;
    this.ox = Math.round((w - fieldPxW) / 2);
    this.oy = Math.round(padTop + (availH - fieldPxH) / 2);
  }

  private px(x: number): number {
    return this.ox + x * this.cell;
  }
  private py(y: number): number {
    return this.oy + y * this.cell;
  }
  private cx(x: number): number {
    return this.ox + (x + 0.5) * this.cell;
  }
  private cy(y: number): number {
    return this.oy + (y + 0.5) * this.cell;
  }

  private drawGround(): void {
    const g = this.ground;
    g.clear();
    const w = this.cell * this.fieldW;
    const h = this.cell * this.fieldH;
    // Base ground wash.
    g.rect(this.ox, this.oy, w, h).fill({ color: this.groundColor });
    // Grid.
    for (let x = 0; x <= this.fieldW; x++) {
      g.moveTo(this.px(x), this.oy).lineTo(this.px(x), this.oy + h);
    }
    for (let y = 0; y <= this.fieldH; y++) {
      g.moveTo(this.ox, this.py(y)).lineTo(this.ox + w, this.py(y));
    }
    g.stroke({ color: 0x000000, alpha: 0.16, width: 1 });
    // Border.
    g.rect(this.ox, this.oy, w, h).stroke({ color: 0x000000, alpha: 0.5, width: 2 });

    // Cover (scrub/trees) — semi-transparent green blobs.
    const m = this.markers;
    m.clear();
    for (const p of this.cover) {
      m.roundRect(this.px(p.x) + 3, this.py(p.y) + 3, this.cell - 6, this.cell - 6, 4)
        .fill({ color: 0x4c7a3a, alpha: 0.34 });
    }
    // Blocked (rocks) — solid dark rounded blocks.
    for (const p of this.blocked) {
      m.roundRect(this.px(p.x) + 3, this.py(p.y) + 3, this.cell - 6, this.cell - 6, 3)
        .fill({ color: 0x2a2622, alpha: 0.9 })
        .stroke({ color: 0x000000, alpha: 0.5, width: 1 });
    }
  }

  // --- Playback controls ---------------------------------------------------

  play(): void {
    if (this.time >= this.maxTick + 1) this.time = 0;
    this.playing = true;
    this.emit();
  }
  pause(): void {
    this.playing = false;
    this.emit();
  }
  togglePlay(): void {
    this.playing ? this.pause() : this.play();
  }
  setSpeed(s: number): void {
    this.speed = s;
    this.emit();
  }
  stepTick(dir: number): void {
    this.playing = false;
    this.time = clamp(Math.round(this.time) + dir, 0, this.maxTick + 1);
    this.render();
    this.emit();
  }
  restart(): void {
    this.time = 0;
    this.playing = true;
    this.render();
    this.emit();
  }
  seek(tick: number): void {
    this.time = clamp(tick, 0, this.maxTick + 1);
    this.render();
    this.emit();
  }
  getMaxTick(): number {
    return this.maxTick;
  }

  private tick = (): void => {
    if (!this.playing) return;
    const dtMs = this.app.ticker.deltaMS;
    const dTicks = (dtMs / 1000) * (this.speed / TICK_SECONDS);
    this.time += dTicks;
    if (this.time >= this.maxTick + 1) {
      this.time = this.maxTick + 1;
      this.playing = false;
    }
    this.render();
    this.emit();
  };

  private emit(): void {
    this.onTime({
      tick: Math.min(this.maxTick, Math.floor(this.time)),
      t: this.time,
      maxTick: this.maxTick,
      playing: this.playing,
      speed: this.speed,
    });
  }

  // --- Rendering -----------------------------------------------------------

  private render(): void {
    if (!this.bank) return;
    const ti = clamp(Math.floor(this.time), 0, this.maxTick + 1);
    const frac = clamp(this.time - ti, 0, 1);
    const base = this.snapshots[Math.min(ti, this.snapshots.length - 1)];
    if (!base) return;

    this.tokenLayer.removeChildren();
    this.fxLayer.removeChildren();

    const moves = this.movesByTick.get(ti) ?? [];
    const moveById = new Map<string, MoveEvent>();
    for (const mv of moves) moveById.set(mv.unitId, mv);

    // Units that die/flee this tick fade out.
    const fx = this.fxByTick.get(ti) ?? [];
    const fadingOut = new Set<string>();
    for (const e of fx) {
      if (e.type === 'death' || e.type === 'flee-off') fadingOut.add(e.unitId);
    }

    for (const [id, f] of base) {
      if (!f.alive) continue;
      const info = this.info.get(id);
      if (!info) continue;

      let cx: number;
      let cy: number;
      const mv = moveById.get(id);
      if (mv) {
        const pt = lerpPath(mv.from, mv.path, frac);
        cx = this.cx(pt.x);
        cy = this.cy(pt.y);
      } else {
        cx = this.cx(f.x);
        cy = this.cy(f.y);
      }

      let alpha = 1;
      if (fadingOut.has(id)) alpha = 1 - frac;
      this.drawToken(cx, cy, info, f, alpha);
    }

    this.drawEffects(fx, frac);
  }

  private drawToken(cx: number, cy: number, info: UnitInfo, f: Frame, alpha: number): void {
    const color = SIDE_COLOR[info.side];
    const cont = new Container();
    cont.x = cx;
    cont.y = cy;
    cont.alpha = alpha;

    const r = this.cell * 0.42;

    // Hover tooltip with the regiment's provenance name.
    const displayName = this.names.get(info.summary.id) ?? info.summary.name;
    cont.eventMode = 'static';
    cont.cursor = 'pointer';
    cont.on('pointerover', () => this.showTooltip(displayName, cx, cy - r - this.cell * 0.32));
    cont.on('pointerout', () => this.hideTooltip());

    // Side-colored base disc + outline.
    const disc = new Graphics();
    disc.circle(0, 0, r).fill({ color: 0x14110c, alpha: 0.55 });
    disc
      .circle(0, 0, r)
      .stroke({ color, width: Math.max(2, this.cell * 0.08), alpha: 0.95 });
    if (f.status === 'routing') {
      disc.circle(0, 0, r).stroke({ color: 0xffd24a, width: 1, alpha: 0.9 });
    }
    cont.addChild(disc);

    // Archetype sprite.
    const sid = info.def ? battleSpriteFor(info.def) : 'swordsman';
    const tex = this.bank?.battle.textures[sid] ?? Texture.WHITE;
    const s = new Sprite(tex);
    s.anchor.set(0.5, 0.5);
    const scale = (this.cell * 0.72) / (tex.width || 16);
    s.scale.set(scale);
    if (f.status === 'routing') s.tint = 0xffcf9a;
    cont.addChild(s);

    // Figure-count BADGE (top): regiments run to the hundreds, so a compact
    // number reads where pips can't. It ticks down as figures fall.
    const badgeY = -r - Math.max(8, this.cell * 0.3);
    const bw = Math.max(18, this.cell * 0.62);
    const bh = Math.max(11, this.cell * 0.3);
    const badge = new Graphics();
    badge
      .roundRect(-bw / 2, badgeY - bh / 2, bw, bh, 3)
      .fill({ color: 0x14110c, alpha: 0.85 })
      .stroke({ color, width: 1.5, alpha: 0.95 });
    cont.addChild(badge);
    const countText = new Text({
      text: `${f.figures}`,
      style: {
        fontFamily: 'monospace',
        fontSize: Math.max(9, this.cell * 0.26),
        fontWeight: 'bold',
        fill: '#f4ecd6',
      },
    });
    countText.anchor.set(0.5, 0.5);
    countText.y = badgeY;
    cont.addChild(countText);

    // HP bar (bottom).
    const barW = r * 1.7;
    const barH = Math.max(2, this.cell * 0.09);
    const barY = r + Math.max(2, this.cell * 0.06);
    const hpFrac = clamp(f.hp / Math.max(1, info.maxHp), 0, 1);
    const bar = new Graphics();
    bar.rect(-barW / 2, barY, barW, barH).fill({ color: 0x000000, alpha: 0.7 });
    const hpColor = hpFrac > 0.5 ? 0x7fc96b : hpFrac > 0.25 ? 0xe7c94a : 0xd6553f;
    bar.rect(-barW / 2, barY, barW * hpFrac, barH).fill({ color: hpColor });
    cont.addChild(bar);

    this.tokenLayer.addChild(cont);
  }

  private drawEffects(fx: BattleEvent[], frac: number): void {
    for (const e of fx) {
      switch (e.type) {
        case 'volley': {
          const fromX = this.cx(e.from.x);
          const fromY = this.cy(e.from.y);
          const toX = this.cx(e.to.x);
          const toY = this.cy(e.to.y);
          const g = new Graphics();
          // Faint full trajectory + a projectile moving along it.
          g.moveTo(fromX, fromY).lineTo(toX, toY).stroke({ color: 0xe8dca0, alpha: 0.28, width: 1 });
          const px = fromX + (toX - fromX) * frac;
          const py = fromY + (toY - fromY) * frac;
          g.circle(px, py, Math.max(2, this.cell * 0.08)).fill({ color: 0xffe9a8 });
          this.fxLayer.addChild(g);
          break;
        }
        case 'melee': {
          const g = new Graphics();
          const x = this.cx(e.at.x);
          const y = this.cy(e.at.y);
          const rr = this.cell * (0.2 + frac * 0.25);
          g.circle(x, y, rr).stroke({ color: 0xffffff, alpha: 0.5 * (1 - frac), width: 2 });
          if (e.charge) {
            g.circle(x, y, rr * 0.6).stroke({ color: 0xffb347, alpha: 0.6 * (1 - frac), width: 2 });
          }
          this.fxLayer.addChild(g);
          break;
        }
        case 'damage': {
          // At regiment scale the meaningful number is figures lost, not hp.
          // Chip damage that fells no figure floats nothing (keeps it readable).
          if (e.figuresLost <= 0) break;
          const rise = frac * this.cell * 0.9;
          const t = new Text({
            text: `-${e.figuresLost}`,
            style: {
              fontFamily: 'monospace',
              fontSize: Math.max(11, this.cell * 0.4),
              fontWeight: 'bold',
              fill: '#ff5a44',
              stroke: { color: '#1a0d08', width: 3 },
            },
          });
          t.anchor.set(0.5, 1);
          t.x = this.cx(e.at.x);
          t.y = this.cy(e.at.y) - this.cell * 0.35 - rise;
          t.alpha = 1 - frac * 0.6;
          this.fxLayer.addChild(t);
          break;
        }
        case 'heal': {
          if (e.amount <= 0) break;
          const rise = frac * this.cell * 0.9;
          const t = new Text({
            text: `+${e.amount}`,
            style: {
              fontFamily: 'monospace',
              fontSize: Math.max(11, this.cell * 0.36),
              fontWeight: 'bold',
              fill: '#8ff09a',
              stroke: { color: '#0c1a0c', width: 3 },
            },
          });
          t.anchor.set(0.5, 1);
          t.x = this.cx(e.at.x);
          t.y = this.cy(e.at.y) - this.cell * 0.35 - rise;
          t.alpha = 1 - frac * 0.6;
          this.fxLayer.addChild(t);
          break;
        }
        case 'ability-proc': {
          const x = this.cx(e.at.x);
          const y = this.cy(e.at.y);
          const g = new Graphics();
          const rr = this.cell * (0.3 + frac * 0.5);
          g.circle(x, y, rr).stroke({ color: 0xc9a0ff, alpha: 0.7 * (1 - frac), width: 3 });
          this.fxLayer.addChild(g);
          const label = new Text({
            text: abilityLabel(e.ability),
            style: {
              fontFamily: 'Georgia, serif',
              fontSize: Math.max(10, this.cell * 0.3),
              fontWeight: 'bold',
              fill: '#e2c8ff',
              stroke: { color: '#1a1030', width: 3 },
            },
          });
          label.anchor.set(0.5, 1);
          label.x = x;
          label.y = y - this.cell * 0.5;
          label.alpha = 1 - frac * 0.5;
          this.fxLayer.addChild(label);
          break;
        }
        case 'morale-check': {
          if (e.passed) break;
          const x = this.cx(e.at.x);
          const y = this.cy(e.at.y);
          const t = new Text({
            text: '⛊✖',
            style: {
              fontSize: Math.max(12, this.cell * 0.42),
              fill: '#ff6a4a',
              stroke: { color: '#1a0a06', width: 3 },
            },
          });
          t.anchor.set(0.5, 0.5);
          t.x = x;
          t.y = y - this.cell * 0.15;
          t.alpha = 1 - frac * 0.4;
          this.fxLayer.addChild(t);
          break;
        }
        case 'rout':
        case 'flee-off': {
          const x = this.cx(e.at.x);
          const y = this.cy(e.at.y);
          const t = new Text({
            text: '➤',
            style: {
              fontSize: Math.max(12, this.cell * 0.5),
              fill: '#ffd24a',
              stroke: { color: '#1a1206', width: 3 },
            },
          });
          t.anchor.set(0.5, 0.5);
          t.x = x + frac * this.cell * 0.4;
          t.y = y;
          t.alpha = 1 - frac * 0.5;
          this.fxLayer.addChild(t);
          break;
        }
        default:
          break;
      }
    }
  }
}

// --- helpers -----------------------------------------------------------------

function cloneFrames(m: Map<string, Frame>): Map<string, Frame> {
  const out = new Map<string, Frame>();
  for (const [k, v] of m) out.set(k, { ...v });
  return out;
}

function applyEvent(cur: Map<string, Frame>, e: BattleEvent): void {
  switch (e.type) {
    case 'move': {
      const f = cur.get(e.unitId);
      if (f) {
        f.x = e.to.x;
        f.y = e.to.y;
      }
      break;
    }
    case 'damage': {
      const f = cur.get(e.targetId);
      if (f) {
        f.figures = e.figuresAfter;
        f.hp = e.hpAfter;
        if (e.figuresAfter <= 0) {
          f.alive = false;
          f.status = 'dead';
        }
      }
      break;
    }
    case 'heal': {
      const f = cur.get(e.targetId);
      if (f) {
        f.figures = e.figuresAfter;
        f.hp = e.hpAfter;
      }
      break;
    }
    case 'rout': {
      const f = cur.get(e.unitId);
      if (f) f.status = 'routing';
      break;
    }
    case 'rally': {
      const f = cur.get(e.unitId);
      if (f) f.status = 'fighting';
      break;
    }
    case 'death': {
      const f = cur.get(e.unitId);
      if (f) {
        f.alive = false;
        f.status = 'dead';
        f.figures = 0;
      }
      break;
    }
    case 'flee-off': {
      const f = cur.get(e.unitId);
      if (f) {
        f.alive = false;
        f.status = 'fled';
      }
      break;
    }
    default:
      break;
  }
}

function lerpPath(from: EventPoint, path: EventPoint[], frac: number): { x: number; y: number } {
  const pts = [from, ...path];
  if (pts.length === 1) return { x: from.x, y: from.y };
  const segs = pts.length - 1;
  const p = clamp(frac, 0, 1) * segs;
  const i = Math.min(segs - 1, Math.floor(p));
  const local = p - i;
  const a = pts[i] as EventPoint;
  const b = pts[i + 1] as EventPoint;
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function abilityLabel(type: string): string {
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
