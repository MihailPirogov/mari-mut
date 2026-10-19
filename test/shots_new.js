// Review screenshots of the new layout (game in progress) + leaderboard: shots/review/
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const base = 'file://' + ROOT + '/index.html'; const SH = path.join(ROOT, 'shots/review'); fs.mkdirSync(SH, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [w, h, dpr] of [[390, 844, 3], [1920, 1080, 1], [360, 640, 2]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await ctx.addInitScript(() => { localStorage.setItem('mutTushto.v1', JSON.stringify({ v: 1, len: 5, mode: 'daily', tut: { done: true, step: 0 } })); window.LB_API = 'http://127.0.0.1:9/'; });
    const p = await ctx.newPage(); await p.goto(base); await sleep(500);
    const ws = await p.evaluate(() => { const a = mutTushto.G().r.w; return window.WORDS[5].a.filter(x => x !== a && [...x].some(c => a.includes(c))).slice(0, 2); });
    for (const x of ws) { for (const c of x) await p.evaluate(c => mutTushto.input(c), c); await p.evaluate(() => mutTushto.input('ENTER')); await sleep(1800); }
    for (const c of 'ку') await p.evaluate(c => mutTushto.input(c), c); await sleep(300);
    await p.screenshot({ path: `${SH}/mari_wordle_${w}x${h}.png` }); await ctx.close();
  }
  await b.close();
})();
