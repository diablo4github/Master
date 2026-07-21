/**
 * End-to-end smoke test for the presentation layer.
 *
 * Builds the app, serves the production bundle with `vite preview`, drives the
 * full new-game → game-screen → end-turn → city-panel flow in headless
 * Chromium, screenshots each stage, and fails loudly (non-zero exit) on any
 * page console error or thrown exception.
 *
 * Run: `npx tsx tools/smoke/smoke.ts`
 * Chromium is preinstalled; we point Playwright straight at it (no download).
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, type ConsoleMessage, type Page } from 'playwright';

/**
 * Advance the turn regardless of the decision assistant: click the tiny
 * "End anyway" escape hatch when it's present (a research/production decision is
 * pending), otherwise the End Turn button is already in plain advance mode.
 */
async function forceEndTurn(page: Page): Promise<void> {
  const force = page.locator('#end-turn-force');
  if ((await force.count()) > 0) await force.first().click();
  else await page.locator('#end-turn').click();
}

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/claude-0/-home-user-Master/47d03efb-956f-5373-8ab8-0baa55c26e76/scratchpad';
const PORT = 5199;
const URL_BASE = `http://localhost:${PORT}`;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(300);
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

async function main(): Promise<void> {
  console.log('smoke: building…');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

  console.log('smoke: starting vite preview…');
  const server: ChildProcess = spawn(
    'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  const stopServer = () => {
    try {
      server.kill('SIGTERM');
      execSync('pkill -f "vite preview" || true', { stdio: 'ignore' });
    } catch {
      /* already gone */
    }
  };

  const errors: string[] = [];
  let browserClosed = false;

  try {
    await waitForServer(URL_BASE);

    const browser = await chromium.launch({ headless: true, executablePath: CHROME });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err: Error) => errors.push(`pageerror: ${err.message}`));

    console.log('smoke: loading new-game screen…');
    await page.goto(URL_BASE, { waitUntil: 'load' });
    await page.waitForSelector('.newgame', { timeout: 15_000 });
    await page.waitForSelector('.wizard-card', { timeout: 15_000 });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/smoke-1-newgame.png` });

    console.log('smoke: choosing Ithariel Dawnclad → Meridia → Humans…');
    await page.locator('.wizard-card', { hasText: 'Ithariel Dawnclad' }).click();
    await page.locator('.pick-btn', { hasText: 'Meridia' }).click();
    await page.locator('.race-btn', { hasText: 'Humans' }).click();

    console.log('smoke: starting the game…');
    await page.locator('#start-game').click();
    await page.waitForSelector('.topbar', { timeout: 15_000 });
    await page.waitForSelector('#end-turn', { timeout: 15_000 });
    await sleep(900); // let Pixi centre the camera and draw the map
    await page.screenshot({ path: `${OUT}/smoke-2-game.png` });

    // --- End Turn = decision assistant ------------------------------------
    // With research unset the button labels itself "Choose Research" up front.
    const researchLabel = (await page.locator('#end-turn').textContent())?.trim() ?? '';
    console.log(`smoke: end-turn label (research unset) = "${researchLabel}"`);
    await page.screenshot({ path: `${OUT}/smoke-9-endturn.png` });

    console.log('smoke: clicking End Turn → research panel; choosing a study…');
    await page.locator('#end-turn').click();
    await page.waitForSelector('.side-panel.research', { timeout: 8_000 });
    await page.locator('.study-row.available').first().click();
    await sleep(250);

    // Research set: the button now demands production. Clicking it opens the
    // idle capital with its Add-to-queue picker highlighted.
    const prodLabel = (await page.locator('#end-turn').textContent())?.trim() ?? '';
    console.log(`smoke: end-turn label (research set) = "${prodLabel}"`);
    console.log('smoke: clicking End Turn → city production…');
    await page.locator('#end-turn').click();
    await page.waitForSelector('.side-panel .q-block', { timeout: 8_000 });
    await sleep(300);
    await page.screenshot({ path: `${OUT}/smoke-4-city.png` });

    const panelTitle = await page.locator('.side-panel .panel-title').first().textContent();
    console.log(`smoke: side panel title = "${panelTitle ?? ''}"`);

    // The Add-to-queue picker is split into Buildings and Units shelves.
    const sectionHeaders = await page.locator('.build-section-h').allTextContents();
    console.log(`smoke: build sections = ${JSON.stringify(sectionHeaders.map((s) => s.trim()))}`);
    if (!sectionHeaders.some((s) => /Buildings/i.test(s)) || !sectionHeaders.some((s) => /Units/i.test(s))) {
      throw new Error('expected Buildings and Units sections in the Add-to-queue picker');
    }

    // Queue granary → marketplace → militia ×2 in this one visit (two militia
    // exercises the ×N duplicate marker; buildings + units span both shelves).
    console.log('smoke: queuing granary + marketplace + militia ×2…');
    for (const name of ['Granary', 'Marketplace', 'Militia', 'Militia']) {
      await page.locator('.build-opts .build-opt:not(:disabled)', { hasText: name }).first().click();
      await sleep(200);
    }
    await page.waitForSelector('.q-item', { timeout: 8_000 });
    const queued = await page.locator('.q-item').count();
    const hasMult = (await page.locator('.q-item-mult').count()) > 0;
    console.log(`smoke: queue length = ${queued}, ×N marker present = ${hasMult}`);
    if (!hasMult) throw new Error('expected a ×N marker on the duplicated militia order');
    await page.screenshot({ path: `${OUT}/smoke-8-queue.png` });

    // --- Research tabs (Race | Magic) -------------------------------------
    console.log('smoke: opening research → Magic tab…');
    await page.keyboard.press('r'); // toggle research overlay open
    await page.waitForSelector('.side-panel.research .research-tabs', { timeout: 8_000 });
    const tabLabels = await page.locator('.research-tab').allTextContents();
    console.log(`smoke: research tabs = ${JSON.stringify(tabLabels.map((s) => s.trim()))}`);
    await page.locator('.research-tab', { hasText: 'Magic' }).click();
    await page.waitForSelector('.study-group-head .chip', { timeout: 8_000 });
    await sleep(250);

    // Tier structure (DESIGN.md: "Magic comes in three tiers per school").
    // Ithariel Dawnclad is a pure Life mage (1 school -> magicTierCap 3), so
    // all three tier headers should be present and NONE locked.
    const tierLabels = await page.locator('.study-tier-head .study-tier-label').allTextContents();
    console.log(`smoke: magic tier headers = ${JSON.stringify(tierLabels.map((s) => s.trim()))}`);
    if (!tierLabels.some((t) => /TIER III/.test(t))) {
      throw new Error('expected a "TIER III" tier header on the Magic tab for a pure Life wizard');
    }
    const lockedTierHeaders = await page.locator('.study-tier-head.locked').count();
    console.log(`smoke: locked tier headers (expect 0 for a pure mage) = ${lockedTierHeaders}`);
    if (lockedTierHeaders !== 0) {
      throw new Error(`expected 0 locked tier headers for a pure Life wizard, saw ${lockedTierHeaders}`);
    }

    await page.screenshot({ path: `${OUT}/smoke-10-research.png` });
    await page.keyboard.press('r'); // close research overlay

    // --- Army panel with a persistent move order --------------------------
    // Drive the sim through the exposed store: move the settler onto the
    // capital tile, merge the two co-located units into an army, order it to a
    // far tile (a partial march keeps the standing order), then select it so
    // the panel shows "Moving to (x, y)".
    console.log('smoke: forming an army and giving it a standing move order…');
    const armyOk = await page.evaluate(`
      (() => {
        const s = window.__master.store;
        const human = s.getState().humanPlayerId;
        const g = s.getState().game;
        const cap = g.cities.find((c) => c.owner === human);
        if (!cap) return false;
        const settler = g.units.find((u) => u.owner === human && u.defId === 'settler');
        if (settler) s.command({ type: 'move-unit', unitId: settler.id, to: { x: cap.x, y: cap.y } });
        const g2 = s.getState().game;
        const onCap = g2.units.filter(
          (u) => u.owner === human && u.plane === cap.plane && u.x === cap.x && u.y === cap.y,
        );
        if (onCap.length < 2) return false;
        s.command({ type: 'form-army', unitIds: onCap.map((u) => u.id) });
        const g3 = s.getState().game;
        const member = g3.units.find((u) => onCap.some((o) => o.id === u.id) && u.armyId);
        const armyId = member && member.armyId;
        if (!armyId) return false;
        // Find a passable land tile a few tiles away so the march is partial
        // (the standing order then persists across turns). Passable ≈ not
        // ocean/shore and not a peak.
        const map = g3.maps[cap.plane];
        const passable = (x, y) => {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
          const t = map.tiles[y * map.width + x];
          return !!t && t.elevation !== 3 && t.terrain !== 'ocean' && t.terrain !== 'shore';
        };
        const candidates = [];
        for (let d = 6; d >= 3; d--) {
          for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, -d], [d, -d], [-d, d]]) {
            if (passable(cap.x + dx, cap.y + dy)) candidates.push({ x: cap.x + dx, y: cap.y + dy });
          }
        }
        // Issue the order to the first target the sim accepts (a reachable path,
        // partial this turn) so the standing "Moving to" order sticks.
        let ordered = false;
        for (const target of candidates) {
          if (s.command({ type: 'move-army', armyId, to: target })) { ordered = true; break; }
        }
        if (!ordered) return false;
        s.select({ kind: 'army', id: armyId });
        return true;
      })()
    `);
    console.log(`smoke: army setup ok = ${armyOk}`);
    await page.waitForSelector('.army-order.move', { timeout: 8_000 });
    const orderText = (await page.locator('.army-order-text').first().textContent())?.trim() ?? '';
    console.log(`smoke: army order = "${orderText}"`);
    await sleep(250);
    await page.screenshot({ path: `${OUT}/smoke-11-army.png` });
    // Return the map to a clean selection for the battle flow.
    await page.evaluate('window.__master.store.select(null)');

    console.log('smoke: advancing a few turns (End anyway when a decision pends)…');
    for (let i = 0; i < 3; i++) {
      await forceEndTurn(page);
      await sleep(400);
    }
    await page.screenshot({ path: `${OUT}/smoke-3-turns.png` });

    // --- Battle viewer flow ------------------------------------------------
    // The sim's lair-triggered battle append isn't merged yet, so we drive the
    // same UI path through the dev hook (window.__master): seed a lair near the
    // capital, "march" via a couple of End Turns, then fabricate a real battle
    // (a genuine BattleReport via the sim's resolveStacks) as if the garrison
    // reached the lair. This exercises the prompt → viewer → end-card flow.
    console.log('smoke: waiting for dev hook…');
    await page.waitForFunction('!!window.__master', undefined, { timeout: 10_000 });

    console.log('smoke: seeding a lair + marching (End Turn ×2)…');
    await page.evaluate('window.__master.injectLair()');
    await sleep(200);
    for (let i = 0; i < 2; i++) {
      await forceEndTurn(page);
      await sleep(300);
    }

    console.log('smoke: triggering the lair battle…');
    await page.evaluate('window.__master.simulateLairBattle()');

    await page.waitForSelector('#battle-card', { timeout: 8_000 });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/smoke-5-battle-prompt.png` });

    const promptComp = await page.locator('#battle-card .card-comp').first().textContent();
    console.log(`smoke: prompt attacker comp = "${(promptComp ?? '').trim()}"`);

    console.log('smoke: watching the battle…');
    await page.locator('#battle-watch').click();
    await page.waitForSelector('.battle-viewer', { timeout: 8_000 });

    // The replay starts PAUSED at tick 0 with the play button pulsing. Assert
    // the clock does NOT advance on its own before the player presses play.
    await page.waitForSelector('.bv-play.pulse', { timeout: 4_000 });
    const tickBefore = (await page.locator('.bv-tick-label').textContent())?.trim() ?? '';
    await sleep(800);
    const tickAfter = (await page.locator('.bv-tick-label').textContent())?.trim() ?? '';
    console.log(`smoke: paused clock "${tickBefore}" → "${tickAfter}"`);
    if (!/^0\s*\//.test(tickBefore) || tickBefore !== tickAfter) {
      throw new Error(`battle should start paused at tick 0 (saw "${tickBefore}" then "${tickAfter}")`);
    }

    // Still PAUSED: exercise the 4× speed control and scrub (via input events,
    // which keep playback paused) to a middle tick — a clean, static mid-battle
    // frame with tokens on the field, taken BEFORE any play/end-card overlay.
    await page.locator('.bv-speed', { hasText: '4×' }).click();
    await page.evaluate(`
      (() => {
        const scrub = document.querySelector('.bv-scrub');
        if (scrub) {
          const max = parseInt(scrub.max, 10) || 1;
          scrub.value = String(Math.max(1, Math.floor(max * 0.4)));
          scrub.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await sleep(300);
    const tickMid = (await page.locator('.bv-tick-label').textContent())?.trim() ?? '';
    await page.screenshot({ path: `${OUT}/smoke-6-battle-mid.png` });

    // Now press play (from the mid frame, so the button is not under the end
    // card) to prove the replay advances only once the player starts it.
    await page.locator('.bv-play').click();
    await sleep(300);
    const tickPlaying = (await page.locator('.bv-tick-label').textContent())?.trim() ?? '';
    console.log(`smoke: clock mid "${tickMid}" → after play "${tickPlaying}"`);
    if (tickPlaying === tickMid) {
      throw new Error(`clock should advance after play (stuck at "${tickPlaying}")`);
    }

    // Seek to the final tick so the end card resolves (no covered controls).
    await page.evaluate(`
      (() => {
        const scrub = document.querySelector('.bv-scrub');
        if (scrub) {
          scrub.value = scrub.max;
          scrub.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await page.waitForSelector('.bv-endcard .bv-end-banner', { state: 'visible', timeout: 12_000 });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/smoke-7-battle-end.png` });

    const banner = await page.locator('.bv-end-banner').first().textContent();
    console.log(`smoke: end card banner = "${(banner ?? '').trim()}"`);

    await browser.close();
    browserClosed = true;
  } finally {
    stopServer();
  }

  void browserClosed;

  if (errors.length) {
    console.error('smoke: FAILED — page errors detected:');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log('smoke: OK — screenshots written to', OUT);
}

main().catch((err) => {
  console.error('smoke: FAILED —', err);
  process.exit(1);
});
