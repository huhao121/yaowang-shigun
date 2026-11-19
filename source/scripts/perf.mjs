import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors=[]; page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8201/?auto=1&god=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.G && window.G.ready, null, { timeout: 120000 });
await page.waitForFunction(() => window.G.state().mode === 'playing', null, { timeout: 30000 });
await page.waitForTimeout(2500);
const fps = await page.evaluate(async () => {
  let n = 0; const start = performance.now(); let last=start; let spikes=0;
  await new Promise((resolve) => {
    function tick(t) { n++; if (t-last>35) spikes++; last=t; if (t - start > 3000) resolve(); else requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });
  return { fps: Math.round(n / ((performance.now()-start)/1000)), spikes, state: G.state() };
});
// verify that a hit produces hitstop/trauma by polling frames around the next hit
const hit = await page.evaluate(async () => {
  return await new Promise((resolve) => {
    let samples=[]; const start=performance.now();
    function tick(t){
      const s=G.state(); samples.push({t:Math.round(t-start), hitstop:s.hitstop, trauma:s.trauma, hp:s.bossHp});
      if (s.hitstop>0.01 || t-start>6000) resolve({hitstopSeen:s.hitstop>0.01, sample:s, samples:samples.filter(x=>x.hitstop>0).slice(0,3)});
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
});
await browser.close();
console.log(JSON.stringify({fps, hit, errors},null,2));
