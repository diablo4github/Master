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
import { chromium, type ConsoleMessage } from 'playwright';

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

    console.log('smoke: ending turn 3×…');
    for (let i = 0; i < 3; i++) {
      await page.locator('#end-turn').click();
      await sleep(400);
    }
    await page.screenshot({ path: `${OUT}/smoke-3-turns.png` });

    console.log('smoke: clicking the capital (screen centre)…');
    await page.mouse.click(640, 400);
    await page.waitForSelector('.side-panel .panel-title', { timeout: 8_000 });
    await sleep(300);
    await page.screenshot({ path: `${OUT}/smoke-4-city.png` });

    const panelTitle = await page.locator('.side-panel .panel-title').first().textContent();
    console.log(`smoke: side panel title = "${panelTitle ?? ''}"`);

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
      await page.locator('#end-turn').click();
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
    // Pause at the opening frame first (before playback advances and the end
    // card can appear over the controls), then exercise the 4× speed control
    // and seek to a middle tick for a clean mid-battle frame.
    await page.locator('.bv-play').click(); // pause (open() starts it playing)
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
    await sleep(400);
    await page.screenshot({ path: `${OUT}/smoke-6-battle-mid.png` });

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
