// Store screenshots without ads. node shots_release.js  -> release/yandex_assets/{mobile,desktop}_N.png + release/play_assets/screenshots/
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const url = 'file://' + ROOT + '/index.html';
const YA = path.join(ROOT, 'release/yandex_assets'), PL = path.join(ROOT, 'release/play_assets/screenshots'); [YA, PL].forEach(d => fs.mkdirSync(d, { recursive: true }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = { v: 1, ts: 1, len: 5, mode: 'daily', set: { sound: false, theme: 'light', hc: false, hard: false, vib: true }, tut: { done: true, step: 0 }, stats: { daily: { 5: { p: 23, w: 21, cur: 9, max: 12, dist: [0, 2, 6, 8, 4, 1, 0, 2], lastDay: null } }, free: {} }, daily: {}, free: {}, rounds: 30, wins: 41 };
async function guesses(p, n, sol) { // pick guesses that share letters with the answer (pretty coloured rows)
  return p.evaluate(([n, sol]) => { const r = mutTushto.G().r, A = window.WORDS[r.w.length].a.filter(w => w !== r.w); const out = [];
    const sc = w => mutTushto.score(w, r.w); const val = s => [...s].reduce((a, c) => a + (c === 'c' ? 2 : c === 'p' ? 1 : 0), 0);
    for (let i = 0; i < n; i++) { const want = i + 1; const c = A.filter(w => !out.includes(w) && val(sc(w)) >= want && val(sc(w)) <= want + 2 && !sc(w).split('').every(x => x === 'c')); out.push(c[(i * 7) % Math.max(1, c.length)] || A[i]); }
    if (sol) out.push(r.w); return out; }, [n, sol]);
}
async function play(p, words) { for (const w of words) { await p.evaluate(w => { for (const c of w) mutTushto.input(c); mutTushto.input('ENTER'); }, w); await sleep(w.length * 230 + 500); } }
async function scene(p, i, st, fn) {
  await p.goto('about:blank'); await p.goto(url); await p.evaluate(s => { localStorage.clear(); if (s) localStorage.setItem('mutTushto.v1', JSON.stringify(s)); }, st); await p.goto(url); await sleep(500); await p.evaluate(() => { Platform.links = false; Platform.shareUrl = null; });
  if (fn) await fn(p); await sleep(400);
}
const SCENES = [
  ['game', base, async p => { await play(p, await guesses(p, 3)); await p.evaluate(() => { for (const c of mutTushto.G().r.w.slice(0, 2)) mutTushto.input(c); }); }],
  ['card', base, async p => { await play(p, await guesses(p, 3, true)); await sleep(1600); }],
  ['tutorial', null, async p => { await p.click('#tutNext'); for (const c of 'тул') await p.click('#k_' + c); await p.click('#k_ENTER'); await sleep(1700); }],
  ['lengths', base, async p => { await p.click('#bLen'); }],
  ['light', Object.assign({}, base, { set: Object.assign({}, base.set, { theme: 'dark' }), mode: 'free', len: 6 }), async p => { await play(p, await guesses(p, 4)); }],
  ['stats', base, async p => { await play(p, await guesses(p, 2, true)); await sleep(1600); await p.evaluate(() => document.getElementById('rOk').click()); await p.click('#bStats'); }],
  ['rules', base, async p => { await p.click('#bMenu'); }],
];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const only = process.argv[2];
  for (const [kind, vp, dpr] of [['mobile', { width: 360, height: 640 }, 3], ['desktop', { width: 1280, height: 720 }, 1.5]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: dpr })).newPage();
    for (let i = 0; i < SCENES.length; i++) { const [name, st, fn] = SCENES[i]; await scene(p, i, st, fn);
      const f = path.join(YA, `${kind}_${i + 1}_${name}.png`); await p.screenshot({ path: f });
      if (kind === 'mobile') fs.copyFileSync(f, path.join(PL, `phone_${i + 1}_${name}.png`)); console.log(f); }
  }
  await b.close();
})();
