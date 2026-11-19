import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8201/?demo=combat', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 120000 });
await page.waitForFunction(() => window.G.state().mode === 'playing', null, { timeout: 30000 });
await page.waitForTimeout(800);
const results={};
async function prep() {
  await page.evaluate(() => {
    const g=G.game;
    g.setGod(false);
    g.player.state='idle'; g.player.stateTime=0; g.player.hp=g.player.maxHp; g.player.invuln=0; g.player.stamina=100; g.player.buffer=null;
    g.player.root.position.set(0,0,-1.7); g.player.yaw=Math.PI; g.player.root.rotation.y=Math.PI;
    g.boss.root.position.set(0,0,-3.9); g.boss.state='idle'; g.boss.stateTime=0; g.boss.cooldown=99; g.boss.phase=1; g.boss.hp=480; g.boss.poise=100; g.boss.frozen=0; g.boss.clearWarning();
    g.locked=true;
  });
}
async function trigger(type='slam') {
  await page.evaluate((type) => { const g=G.game; g.boss.startTelegraph(type, g); }, type);
  await page.waitForFunction(() => G.state().bossState === 'attack', null, { timeout: 5000 });
}

// no defense -> should take damage
await prep(); await trigger('slam'); await page.waitForTimeout(700);
results.hit = await page.evaluate(() => ({ hp: G.state().hp, parries: G.state().parries, state: G.state().playerState, boss: G.state().bossState }));

// parry
await prep(); await trigger('slam'); await page.waitForTimeout(110);
await page.evaluate(() => G.press('l'));
await page.waitForTimeout(600);
results.parry = await page.evaluate(() => ({ hp: G.state().hp, parries: G.state().parries, state: G.state().playerState, boss: G.state().bossState, pstate: G.game.player.state, stime: G.game.player.stateTime, window: G.game.player.parryWindow }));

// dodge
await prep(); await trigger('slam'); await page.waitForTimeout(220);
await page.evaluate(() => G.press('space'));
await page.waitForTimeout(600);
results.dodge = await page.evaluate(() => ({ hp: G.state().hp, state: G.state().playerState, boss: G.state().bossState, invuln: G.game.player.invuln }));

// sweep and charge can also be started without errors
await prep(); await trigger('sweep'); await page.waitForTimeout(700);
results.sweep = await page.evaluate(() => ({ hp: G.state().hp, boss: G.state().bossState, attack: G.state().bossAttack }));
await prep(); await trigger('charge'); await page.waitForTimeout(900);
results.charge = await page.evaluate(() => ({ hp: G.state().hp, boss: G.state().bossState, attack: G.state().bossAttack }));

await browser.close();
console.log(JSON.stringify({results, errors},null,2));
