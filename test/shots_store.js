// Store screenshots (no ads, no links) -> release/store/raw/{mobile,desktop}_N_name.png
//   mobile 360×640 @3 = 1080×1920, desktop 1600×900 @1.2 = 1920×1080. Leaderboard uses a mocked API with demo nicknames.
// node test/shots_store.js   (then python3 tools/store_assets.py)
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const OUT = path.join(ROOT, 'release/store/raw'); fs.mkdirSync(OUT, { recursive: true });
const PORT = 17900 + Math.floor(Math.random() * 90), url = `http://127.0.0.1:${PORT}/index.html`;
const web = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '-d', ROOT], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = { v: 1, ts: 1, len: 5, mode: 'daily', set: { sound: false, theme: 'light', hc: false, hard: false, vib: true }, tut: { done: true, step: 0 }, stats: { daily: { 5: { p: 23, w: 21, cur: 9, max: 12, dist: [0, 2, 6, 8, 4, 1, 0, 2], lastDay: null } }, free: {} }, daily: {}, free: {}, rounds: 30, wins: 41 };
const today = Math.floor((Date.now() + 3 * 3600e3) / 864e5), DAY0 = 20745;
const ME = { pid: 'a'.repeat(32), key: 'b'.repeat(32), name: 'Мишук', q: [], cache: {} };
const names = ['Элнет', 'Пиалче', 'Шӱдыр_88', 'Мишук', 'Сылвика', 'Кайыкчо', 'Иван77', 'Ямдыш', 'Olga.K', 'Тойдемар', 'Сескем', 'Ачий'];
const gs = [2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 0, 0];
const board = () => { const top = names.map((n, i) => ({ n, g: gs[i] || 6, w: !!gs[i], r: i + 1, me: n === ME.name }));
  const wins = names.map((n, i) => ({ n, wins: 48 - i * 3 - (i % 2), played: 55 - i * 2, r: i + 1, me: n === ME.name }));
  const streaks = names.map((n, i) => ({ n, cur: Math.max(1, 21 - i * 2), best: 30 - i, r: i + 1, me: n === ME.name }));
  return { ok: true, today, day: today, no: today - DAY0 + 1, len: 5, me: { n: ME.name },
    daily: { top, me: top[3], total: 37 }, wins: { top: wins, me: wins[3], total: 214 }, streaks: { top: streaks, me: streaks[3], total: 120 } }; };
async function guesses(p, n, sol) { // guesses that share letters with the answer (pretty coloured rows)
  return p.evaluate(([n, sol]) => { const r = mutTushto.G().r, A = window.WORDS[r.w.length].a.filter(w => w !== r.w); const out = [];
    const sc = w => mutTushto.score(w, r.w); const val = s => [...s].reduce((a, c) => a + (c === 'c' ? 2 : c === 'p' ? 1 : 0), 0);
    for (let i = 0; i < n; i++) { const want = i + 1; const c = A.filter(w => !out.includes(w) && val(sc(w)) >= want && val(sc(w)) <= want + 2 && !sc(w).split('').every(x => x === 'c')); out.push(c[(i * 7) % Math.max(1, c.length)] || A[i]); }
    if (sol) out.push(r.w); return out; }, [n, sol]);
}
async function play(p, words) { for (const w of words) { await p.evaluate(w => { for (const c of w) mutTushto.input(c); mutTushto.input('ENTER'); }, w); await sleep(w.length * 230 + 500); } }
const SCENES = [
  ['game', base, async p => { await play(p, await guesses(p, 3)); await p.evaluate(() => { for (const c of mutTushto.G().r.w.slice(0, 2)) mutTushto.input(c); }); }],
  ['win', base, async p => { await play(p, await guesses(p, 3, true)); await sleep(1700); }],
  ['tutorial', null, async p => { await p.click('#tutNext'); for (const c of 'тул') await p.click('#k_' + c); await p.click('#k_ENTER'); await sleep(1700); }],
  ['leaders', base, async p => { await play(p, await guesses(p, 2, true)); await sleep(1700); await p.evaluate(() => document.getElementById('rOk').click()); await sleep(300); await p.click('#bLeaders'); await sleep(1200); }],
  ['lengths', base, async p => { await p.click('#bLen'); }],
  ['dark', Object.assign({}, base, { set: Object.assign({}, base.set, { theme: 'dark' }), mode: 'free', len: 6 }), async p => { await play(p, await guesses(p, 4)); }],
  ['stats', base, async p => { await play(p, await guesses(p, 2, true)); await sleep(1700); await p.evaluate(() => document.getElementById('rOk').click()); await p.click('#bStats'); }],
];
(async () => {
  await sleep(500);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  let errs = 0;
  for (const [kind, vp, dpr] of [['mobile', { width: 360, height: 640 }, 3], ['desktop', { width: 1600, height: 900 }, 1.2]]) {
    for (let i = 0; i < SCENES.length; i++) { const [name, st, fn] = SCENES[i];
      const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr });
      await ctx.route('**/api/mari-wordle/**', r => { const u = new URL(r.request().url()); const a = u.searchParams.get('a');
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(r.request().method() === 'POST' ? { ok: true, name: ME.name } : a === 'board' || !a ? board() : { ok: true, today }) }); });
      await ctx.addInitScript(([s, me]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.clear(); if (s) localStorage.setItem('mutTushto.v1', JSON.stringify(s)); localStorage.setItem('mutTushto.lb', JSON.stringify(me)); } }, [st, ME]);
      const p = await ctx.newPage(); p.on('pageerror', e => { errs++; console.log('pageerror', e.message); });
      await p.goto(url); await sleep(600); await p.evaluate(() => { Platform.links = false; Platform.shareUrl = null; });
      await fn(p); await sleep(500);
      const f = path.join(OUT, `${kind}_${i + 1}_${name}.png`); await p.screenshot({ path: f }); console.log(f); await ctx.close();
    }
  }
  await b.close(); web.kill(); if (errs) process.exit(1);
})();
