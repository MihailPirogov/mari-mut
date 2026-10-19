// Records gameplay for the 16:9 trailer -> /tmp/mwtrailer/*.webm (cut by tools/make_trailer.py)
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const url = 'file://' + ROOT + '/index.html'; const OUT = '/tmp/mwtrailer';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const pre = await (await b.newContext()).newPage(); // seed state
  const st = { v: 1, ts: 1, len: 5, mode: 'daily', set: { sound: false, theme: 'light', hc: false, hard: false, vib: false }, tut: { done: true, step: 0 }, stats: { daily: { 5: { p: 12, w: 11, cur: 6, max: 8, dist: [0, 1, 4, 4, 2, 0, 0, 1], lastDay: null } }, free: {} }, daily: {}, free: {}, rounds: 1, wins: 15 };
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT, size: { width: 1600, height: 900 } } });
  await ctx.addInitScript(s => { if (!localStorage.getItem('mutTushto.v1')) localStorage.setItem('mutTushto.v1', JSON.stringify(s)); }, st);
  const p = await ctx.newPage(); const t0 = Date.now(); const marks = []; const mark = k => marks.push([k, (Date.now() - t0) / 1000]);
  await p.goto(url); await sleep(1200); mark('start');
  const pick = (n, sol) => p.evaluate(([n, sol]) => { const r = mutTushto.G().r, A = window.WORDS[r.w.length].a.filter(w => w !== r.w); const out = [];
    const val = w => [...mutTushto.score(w, r.w)].reduce((a, c) => a + (c === 'c' ? 2 : c === 'p' ? 1 : 0), 0);
    for (let i = 0; i < n; i++) { const c = A.filter(w => !out.includes(w) && val(w) >= i + 1 && val(w) <= i + 3); out.push(c[(i * 5) % Math.max(1, c.length)] || A[i]); } if (sol) out.push(r.w); return out; }, [n, sol]);
  const typeW = async w => { for (const ch of w) { await p.evaluate(c => mutTushto.input(c), ch); await sleep(150); } await sleep(200); await p.evaluate(() => mutTushto.input('ENTER')); await sleep(w.length * 230 + 500); };
  for (const w of await pick(3, true)) await typeW(w);
  mark('win'); await sleep(2600); await p.evaluate(() => document.getElementById('sheet').scrollBy({ top: 200, behavior: 'smooth' })); await sleep(1500); mark('card');
  await p.evaluate(() => document.getElementById('rOk').click()); await sleep(500);
  await p.click('[data-mode=free]'); await sleep(500); await p.click('#bLen'); await sleep(900); await p.click('[data-len="6"]'); await sleep(600); mark('free');
  for (const w of await pick(3, true)) await typeW(w);
  await sleep(2300); await p.evaluate(() => document.getElementById('rOk').click()); await sleep(400);
  await p.click('#bSettings'); await sleep(500); await p.click('[data-set=theme]'); await sleep(900); await p.evaluate(() => document.querySelector('[data-close]').click()); await sleep(300);
  await p.click('#bNext'); await sleep(500);
  for (const w of await pick(2)) await typeW(w);
  await p.click('#bStats'); await sleep(2000); mark('end');
  fs.writeFileSync(OUT + '/marks.json', JSON.stringify(marks)); await ctx.close(); await b.close();
})();
