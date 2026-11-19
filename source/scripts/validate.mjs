import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
const pageErrors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(e.message));
const out = {};
const st = async (label) => { const s = await page.evaluate(() => G.state()); out[label] = s; return s; };
const setupIdle = async () => page.evaluate(() => {
  const g = G.game;
  g.player.state = 'idle'; g.player.stateTime = 0; g.player.stamina = 100; g.player.hp = g.player.maxHp; g.player.buffer = null;
  g.player.root.position.set(0,0,-1.35); g.player.yaw = Math.PI; g.player.root.rotation.y = Math.PI;
  g.boss.root.position.set(0,0,-3.85); g.boss.state='idle'; g.boss.stateTime=0; g.boss.cooldown=99; g.boss.attackType=''; g.boss.frozen=0; g.boss.clearWarning();
  g.locked = true; g.camYaw = Math.PI;
});
await page.goto('http://127.0.0.1:8201/?demo=combat&god=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 120000 });
await page.waitForFunction(() => window.G.state().mode === 'playing', null, { timeout: 30000 });
await page.waitForTimeout(500);

out.initial = await page.evaluate(() => ({ state: G.state(), audioReady: G.game.audio.ready, bossPos: G.game.boss.root.position.toArray(), playerPos: G.game.player.root.position.toArray() }));

// movement
await page.evaluate(() => G.press('w'));
await page.waitForTimeout(350);
await page.evaluate(() => G.release('w'));
out.moved = await st('moved');

// lock toggle
await page.evaluate(() => { G.game.boss.cooldown = 99; G.game.boss.state='idle'; G.press('tab'); });
await page.waitForTimeout(100);
out.lockOff = await st('lockOff');
await page.evaluate(() => G.press('tab'));

// light attack and combo
await setupIdle();
await page.evaluate(() => { G.game.player.stamina = 100; G.press('j'); });
await page.waitForTimeout(260);
out.light1 = await st('light1');
await page.evaluate(() => { G.game.player.stamina = 100; G.press('j'); });
await page.waitForTimeout(250);
await page.evaluate(() => { G.game.player.stamina = 100; G.press('j'); });
await page.waitForTimeout(700);
out.combo = await st('combo');

// heavy attack
await setupIdle();
await page.evaluate(() => { G.game.player.stamina = 100; G.press('k'); });
await page.waitForTimeout(500);
out.heavy = await st('heavy');

// spell
await page.waitForTimeout(700);
await page.evaluate(() => { G.game.player.state='idle'; G.game.player.spellCd=0; G.press('q'); });
await page.waitForTimeout(600);
out.spell = await st('spell');

// heal
await page.waitForTimeout(2200);
await page.evaluate(() => { G.game.player.state='idle'; G.game.player.hp=50; G.game.player.flasks=3; G.press('r'); });
await page.waitForTimeout(700);
out.heal = await st('heal');

// dodge iframe
await page.waitForTimeout(700);
await page.evaluate(() => { G.game.player.state='idle'; G.game.player.stamina=100; G.press('space'); });
await page.waitForTimeout(120);
out.dodge = await page.evaluate(() => ({ state: G.state(), invuln: G.game.player.invuln }));

// parry a scripted slam
await page.waitForTimeout(500);
await page.evaluate(() => {
  const g = G.game;
  g.setGod(false);
  g.player.state='idle'; g.player.hp=g.player.maxHp; g.player.invuln=0; g.player.root.position.set(0,0,-1.7); g.player.yaw=Math.PI; g.player.root.rotation.y=Math.PI;
  g.boss.root.position.set(0,0,-3.9); g.boss.state='idle'; g.boss.cooldown=99; g.boss.phase=1; g.boss.hp=480;
  g.boss.startTelegraph('slam', g);
});
await page.waitForFunction(() => G.state().bossState === 'attack', null, { timeout: 5000 });
await page.waitForTimeout(120);
await page.evaluate(() => G.press('l'));
await page.waitForTimeout(500);
out.parry = await st('parry');
await page.evaluate(() => G.game.setGod(true));

// poise break via a real heavy hit
await page.waitForTimeout(600);
await page.evaluate(() => {
  const g = G.game;
  g.player.state='idle'; g.player.stamina=100; g.player.root.position.set(0,0,-1.35); g.player.yaw=Math.PI; g.player.root.rotation.y=Math.PI;
  g.boss.root.position.set(0,0,-3.8); g.boss.state='idle'; g.boss.stateTime=0; g.boss.cooldown=99; g.boss.poise=5; g.boss.flash=0;
  g.press('k');
});
await page.waitForTimeout(600);
out.poisebreak = await st('poisebreak');

// phase 2
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const g = G.game;
  g.player.state='idle'; g.player.stamina=100; g.player.hp=g.player.maxHp; g.player.root.position.set(0,0,-1.35); g.player.yaw=Math.PI; g.player.root.rotation.y=Math.PI;
  g.boss.root.position.set(0,0,-3.8); g.boss.state='idle'; g.boss.stateTime=0; g.boss.cooldown=99; g.boss.hp=245; g.boss.poise=100; g.boss.flash=0;
  g.press('k');
});
await page.waitForTimeout(1000);
out.phase2 = await st('phase2');

// victory through the real death path
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const g = G.game;
  g.player.state='idle'; g.player.stamina=100; g.player.root.position.set(0,0,-1.35); g.player.yaw=Math.PI; g.player.root.rotation.y=Math.PI;
  g.boss.root.position.set(0,0,-3.8); g.boss.state='idle'; g.boss.stateTime=0; g.boss.cooldown=99; g.boss.hp=10; g.boss.phase=2;
  g.press('k');
});
await page.waitForTimeout(4200);
out.victory = await st('victory');

// restart via actual UI button
await page.evaluate(() => document.getElementById('retryBtn').click());
await page.waitForTimeout(800);
out.restart = await st('restart');

// defeat path
await page.evaluate(() => {
  const g = G.game;
  g.setGod(false);
  g.player.hp = 1;
  g.player.state='idle';
  g.player.takeDamage(999, g.boss.root.position, g);
});
await page.waitForTimeout(2600);
out.defeat = await st('defeat');

// audio context after a real user click
await page.evaluate(() => { G.game.mode = 'playing'; });
const ptr = await page.evaluate(() => { const g=G.game; g.mode='playing'; return 1; });
await page.mouse.click(720, 500);
await page.waitForTimeout(300);
out.audio = await page.evaluate(() => ({ ready: G.game.audio.ready, state: G.game.audio.ctx?.state ?? null }));

// fps sample
out.fps = await page.evaluate(async () => {
  let n = 0; const start = performance.now();
  await new Promise((resolve) => {
    function tick(t) { n++; if (t - start > 2000) resolve(); else requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });
  return Math.round(n / ((performance.now() - start) / 1000));
});

await browser.close();
console.log(JSON.stringify({ summary: {
  initialMode: out.initial.state.mode,
  moved: out.moved.playerPos,
  lockOff: out.lockOff.locked,
  comboHits: out.combo.hits, combo: out.combo.combo, bossHpCombo: out.combo.bossHp,
  heavyHp: out.heavy.bossHp, heavyState: out.heavy.playerState,
  spellFrozen: out.spell.frozen,
  healHp: out.heal.hp, healFlasks: out.heal.flasks,
  dodgeState: out.dodge.state.playerState, dodgeInvuln: out.dodge.invuln,
  parries: out.parry.parries, parryBossState: out.parry.bossState,
  poisebreakState: out.poisebreak.bossState, poise: out.poisebreak.poise,
  phase2: out.phase2.phase, phase2BossState: out.phase2.bossState,
  victoryMode: out.victory.mode, victoryResult: out.victory.result,
  restartMode: out.restart.mode, restartHp: out.restart.hp, restartBossHp: out.restart.bossHp,
  defeatMode: out.defeat.mode, defeatResult: out.defeat.result,
  audio: out.audio, fps: out.fps,
  errors, pageErrors
}}, null, 2));
