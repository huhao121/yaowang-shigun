import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8201/';
const OUT = path.resolve('artifacts');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
  ],
});

const errors = [];
const pageErrors = [];
const failedRequests = [];
const logs = [];

function watch(page, tag) {
  page.on('console', (msg) => {
    logs.push({ tag, type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') errors.push({ tag, text: msg.text() });
  });
  page.on('pageerror', (err) => pageErrors.push({ tag, message: err.message, stack: err.stack }));
  page.on('requestfailed', (req) => failedRequests.push({ tag, url: req.url(), failure: req.failure()?.errorText }));
}

async function waitReady(page) {
  await page.waitForFunction(() => window.G && window.G.ready === true, null, { timeout: 120000 });
}

const title = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
watch(title, 'title');
await title.goto(BASE, { waitUntil: 'domcontentloaded' });
await waitReady(title);
await title.waitForTimeout(1600);
await title.screenshot({ path: path.join(OUT, 'title.png') });
console.log('title state', await title.evaluate(() => window.G.state()));
await title.close();

const game = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
watch(game, 'gameplay');
await game.goto(`${BASE}?auto=1&god=1`, { waitUntil: 'domcontentloaded' });
await waitReady(game);
await game.waitForFunction(() => window.G.state().mode === 'playing', null, { timeout: 30000 });
// Wait for an authored attack + trail so the screenshot shows a real combat frame.
await game.waitForFunction(() => {
  const s = window.G.state();
  return s.mode === 'playing' && s.time >= 2.8;
}, null, { timeout: 30000 });
await game.evaluate(() => window.G.pauseOnNextHit(true));
await game.waitForFunction(() => window.G.state().paused === true, null, { timeout: 15000 });
await game.waitForTimeout(40);
await game.screenshot({ path: path.join(OUT, 'gameplay.png') });
await game.evaluate(() => window.G.resume());
const gameState = await game.evaluate(() => window.G.state());
console.log('gameplay state', gameState);

// Check that the boss actually takes damage from the automated combat.
const hpBefore = gameState.bossHp;
await game.waitForTimeout(2200);
const hpAfter = await game.evaluate(() => window.G.state().bossHp);
console.log('boss hp before/after', hpBefore, hpAfter);

await game.evaluate(() => window.G.forceResult(true));
await game.waitForTimeout(1300);
await game.screenshot({ path: path.join(OUT, 'result.png') });
console.log('result state', await game.evaluate(() => window.G.state()));

// Extra confidence frame: failure state, in the same tab to keep one WebGL context alive.
await game.goto(`${BASE}?auto=1&god=1`, { waitUntil: 'domcontentloaded' });
await waitReady(game);
await game.waitForFunction(() => window.G.state().mode === 'playing', null, { timeout: 30000 });
await game.waitForTimeout(1600);
await game.evaluate(() => window.G.forceResult(false));
await game.waitForTimeout(1000);
await game.screenshot({ path: path.join(OUT, 'result-loss.png') });

await browser.close();

const report = { errors, pageErrors, failedRequests, screenshots: ['title.png', 'gameplay.png', 'result.png', 'result-loss.png'], logs: logs.filter((l) => l.type === 'error') };
fs.writeFileSync(path.join(OUT, 'console.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ errors, pageErrors, failedRequests }, null, 2));
if (errors.length || pageErrors.length || failedRequests.length) process.exitCode = 1;
