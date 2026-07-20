/**
 * Ability hooks. Every one of the 14 AbilityDef types is realised here or in
 * the melee/charge/morale paths of the engine:
 *
 *   flying          — canMeleeReach(): only reach-2, ranged, or other flyers hit it
 *   first-strike    — reachPriority() in internal.ts (opportunity strike on contact)
 *   charge          — engine.ts charge physics (impact damage + morale shock)
 *   poison          — applyPoisonOnHit() + endOfTickEffects() DoT, ignores armor
 *   regeneration    — endOfTickEffects(): heals hits, stands figures back up
 *   fear            — morale.ts applyFearAuras()
 *   inspire         — morale.ts inspireBonus() (rally/steady aura)
 *   holy-aura       — endOfTickEffects(): heals nearby allies
 *   life-drain      — applyLifeDrain(): melee damage dealt heals the striker
 *   breath-weapon   — fireBreath(): a line blast that can rewrite a battle
 *   trample         — engine.ts: a charge that destroys a unit rolls into the next
 *   undead          — internal.ts checksMorale()=false, immune to poison/fear
 *   fearless        — morale.ts moraleCheck(): auto-pass
 *   pack-hunter     — packHunterFlank(): attack bonus only when flanking WITH a pack-mate
 */

import {
  type BattleContext,
  type Combatant,
  chebyshev,
  dirIndexTo,
  dirDiff,
  hasAbility,
  abilityOf,
  applyDamage,
  healCombatant,
  totalHp,
  recordCasualties,
  DIRS,
  inField,
  combatantAt,
  livingAllies,
  BREATH_SWATH,
  BREATH_DENSITY_REF,
  BREATH_MIN_DENSITY,
  HEAL_REF_FIGURES,
  HEAL_MAX_SCALE,
  POISON_PER_FIGURE,
  POISON_TICK_FRACTION,
  POISON_TICK_MIN,
} from './internal';

/**
 * Heals scale with the pool being refilled (percent-ish): a regenerating swarm
 * or a holy-aura tending a full regiment mends proportionally, while a lone
 * monster mends at its authored rate. Capped so it can't outrun all damage.
 */
function scaledHeal(base: number, targetMaxFigures: number): number {
  const scale = Math.min(HEAL_MAX_SCALE, Math.max(1, targetMaxFigures / HEAL_REF_FIGURES));
  return Math.round(base * scale);
}

/**
 * Can `attacker` land a MELEE blow on `target`? Flyers can only be reached in
 * melee by reach-2 weapons, other flyers, or (elsewhere) ranged fire.
 */
export function canMeleeReach(attacker: Combatant, target: Combatant): boolean {
  if (!hasAbility(target.def, 'flying')) return true;
  return hasAbility(attacker.def, 'flying') || attacker.def.combat.melee.reach >= 2;
}

/** life-drain: a fraction of melee damage dealt heals the striker. */
export function applyLifeDrain(ctx: BattleContext, attacker: Combatant, damageDealt: number): void {
  const drain = abilityOf(attacker.def, 'life-drain');
  if (!drain || damageDealt <= 0) return;
  const healed = healCombatant(attacker, Math.round(damageDealt * drain.fraction));
  if (healed > 0) {
    ctx.events.push({
      type: 'heal',
      tick: ctx.tick,
      targetId: attacker.id,
      sourceId: attacker.id,
      kind: 'life-drain',
      amount: healed,
      figuresAfter: attacker.figures,
      hpAfter: totalHp(attacker),
      at: { x: attacker.x, y: attacker.y },
    });
  }
}

/**
 * poison: envenoms a non-undead target on a landed melee exchange. Strength
 * scales with the number of figures actually struck (`landed`) — a poisoned
 * blade that catches forty men queues far more lingering damage than one that
 * grazes three. The pool is then bled proportionally in endOfTickEffects.
 */
export function applyPoisonOnHit(attacker: Combatant, target: Combatant, landed: number): boolean {
  const poison = abilityOf(attacker.def, 'poison');
  if (!poison) return false;
  if (hasAbility(target.def, 'undead')) return false; // immune
  target.poison += poison.strength * Math.max(1, landed) * POISON_PER_FIGURE;
  return true;
}

/**
 * pack-hunter: returns the id of a pack-mate that is helping flank `target`,
 * or null. Fires only when BOTH the attacker and a living ally are pack-hunters,
 * both adjacent to the target, striking from meaningfully different angles.
 */
export function packHunterFlank(
  ctx: BattleContext,
  attacker: Combatant,
  target: Combatant,
): string | null {
  if (!hasAbility(attacker.def, 'pack-hunter')) return null;
  const attackerDir = dirIndexTo(target.x, target.y, attacker.x, attacker.y);
  for (const ally of livingAllies(ctx, attacker)) {
    if (!hasAbility(ally.def, 'pack-hunter')) continue;
    if (chebyshev(ally.x, ally.y, target.x, target.y) > 1) continue;
    const allyDir = dirIndexTo(target.x, target.y, ally.x, ally.y);
    // Two pack members pressing the same prey from different tiles are flanking
    // it together (any distinct approach angle; a lone pack-hunter never procs).
    if (dirDiff(attackerDir, allyDir) >= 1) return ally.id;
  }
  return null;
}

/**
 * breath-weapon: a line blast from `source` toward (tx,ty). Hits every enemy
 * on the line out to `range`, ignoring armor. Big enough to rewrite a battle;
 * gated by a cooldown. Returns true if it fired.
 */
export function fireBreath(ctx: BattleContext, source: Combatant, tx: number, ty: number): boolean {
  const breath = abilityOf(source.def, 'breath-weapon');
  if (!breath || source.breathCooldown > 0) return false;

  const dir = dirIndexTo(source.x, source.y, tx, ty);
  const [dx, dy] = DIRS[dir] as [number, number];
  const targets: Combatant[] = [];
  let cx = source.x;
  let cy = source.y;
  for (let step = 0; step < breath.range; step++) {
    cx += dx;
    cy += dy;
    if (!inField(ctx.field, cx, cy)) break;
    const occ = combatantAt(ctx, cx, cy);
    if (occ && occ.side !== source.side && occ.figures > 0) targets.push(occ);
  }
  if (targets.length === 0) return false;

  source.breathCooldown = breath.cooldown;
  ctx.events.push({
    type: 'ability-proc',
    tick: ctx.tick,
    ability: 'breath-weapon',
    sourceId: source.id,
    targetIds: targets.map((t) => t.id),
    at: { x: source.x, y: source.y },
    magnitude: breath.damage,
  });
  for (const t of targets) {
    // AREA EFFECT AT SCALE: the blast washes a SWATH of the formation, not a
    // single blow. The swath widens with the ranks' density (figures present),
    // and each caught figure takes up to `breath.damage` armor-ignoring damage.
    // Against massed 1-hit levies this reaps dozens-to-hundreds; against a lone
    // great monster (one figure) it merely chips `breath.damage` off the pool.
    const density = Math.max(BREATH_MIN_DENSITY, Math.min(1, t.figures / BREATH_DENSITY_REF));
    const caught = Math.max(1, Math.min(t.figures, Math.round(BREATH_SWATH * density)));
    const poolDamage = caught * Math.min(breath.damage, t.maxHits);
    const res = applyDamage(t, poolDamage); // armor-ignoring blast
    ctx.events.push({
      type: 'damage',
      tick: ctx.tick,
      targetId: t.id,
      sourceId: source.id,
      kind: 'breath',
      amount: poolDamage,
      figuresLost: res.figuresLost,
      figuresAfter: t.figures,
      hpAfter: totalHp(t),
      at: { x: t.x, y: t.y },
    });
    if (res.destroyed) {
      ctx.events.push({ type: 'death', tick: ctx.tick, unitId: t.id, at: { x: t.x, y: t.y } });
    } else if (res.figuresLost > 0) {
      // Counts toward this tick's proportional morale check (end of tick) — a
      // swath torn out of the ranks is exactly what breaks a formation.
      recordCasualties(t, res.figuresLost, 'casualties');
    }
  }
  return true;
}

/**
 * End-of-tick continuous effects, in deterministic combatant order:
 * poison damage-over-time, regeneration, holy-aura healing, cooldown ticking.
 */
export function endOfTickEffects(ctx: BattleContext): void {
  // Cooldowns.
  for (const c of ctx.combatants) {
    if (c.breathCooldown > 0) c.breathCooldown -= 1;
  }

  // Poison DoT (ignores armor; undead can never be poisoned so pool stays 0).
  // Bleeds a proportion of the outstanding pool each tick (min POISON_TICK_MIN),
  // so a heavily-envenomed regiment grinds down proportionally.
  for (const c of ctx.combatants) {
    if (c.figures <= 0 || c.poison <= 0) continue;
    const dmg = Math.min(c.poison, Math.max(POISON_TICK_MIN, Math.round(c.poison * POISON_TICK_FRACTION)));
    c.poison -= dmg;
    const res = applyDamage(c, dmg);
    ctx.events.push({
      type: 'damage',
      tick: ctx.tick,
      targetId: c.id,
      sourceId: null,
      kind: 'poison',
      amount: dmg,
      figuresLost: res.figuresLost,
      figuresAfter: c.figures,
      hpAfter: totalHp(c),
      at: { x: c.x, y: c.y },
    });
    if (res.destroyed) {
      ctx.events.push({ type: 'death', tick: ctx.tick, unitId: c.id, at: { x: c.x, y: c.y } });
    } else if (res.figuresLost > 0) {
      recordCasualties(c, res.figuresLost, 'casualties');
    }
  }

  // Regeneration.
  for (const c of ctx.combatants) {
    if (c.figures <= 0) continue;
    const regen = abilityOf(c.def, 'regeneration');
    if (!regen) continue;
    const healed = healCombatant(c, scaledHeal(regen.perTick, c.maxFigures));
    if (healed > 0) {
      ctx.events.push({
        type: 'heal',
        tick: ctx.tick,
        targetId: c.id,
        sourceId: c.id,
        kind: 'regeneration',
        amount: healed,
        figuresAfter: c.figures,
        hpAfter: totalHp(c),
        at: { x: c.x, y: c.y },
      });
    }
  }

  // Holy-aura healing of nearby allies.
  for (const src of ctx.combatants) {
    if (src.figures <= 0) continue;
    const aura = abilityOf(src.def, 'holy-aura');
    if (!aura) continue;
    const healedIds: string[] = [];
    for (const ally of ctx.combatants) {
      if (ally.side !== src.side || ally.figures <= 0) continue;
      if (totalHp(ally) >= ally.maxFigures * ally.maxHits) continue;
      if (chebyshev(src.x, src.y, ally.x, ally.y) > aura.radius) continue;
      const healed = healCombatant(ally, scaledHeal(aura.healPerTick, ally.maxFigures));
      if (healed > 0) {
        healedIds.push(ally.id);
        ctx.events.push({
          type: 'heal',
          tick: ctx.tick,
          targetId: ally.id,
          sourceId: src.id,
          kind: 'holy-aura',
          amount: healed,
          figuresAfter: ally.figures,
          hpAfter: totalHp(ally),
          at: { x: ally.x, y: ally.y },
        });
      }
    }
    if (healedIds.length > 0) {
      ctx.events.push({
        type: 'ability-proc',
        tick: ctx.tick,
        ability: 'holy-aura',
        sourceId: src.id,
        targetIds: healedIds,
        at: { x: src.x, y: src.y },
        magnitude: aura.healPerTick,
      });
    }
  }
}
