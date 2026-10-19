// Leaderboard UI + offline queue against a local copy of the API (php -S).
const { chromium } = require('playwright-core'); const { spawn } = require('child_process'); const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const WPORT = 17000 + Math.floor(Math.random() * 900), base = `http://127.0.0.1:${WPORT}/index.html`;
const web = spawn('python3', ['-m', 'http.server', String(WPORT), '--bind', '127.0.0.1', '-d', ROOT], { stdio: 'ignore' });
const SH = path.join(ROOT, 'shots/leaders'); fs.mkdirSync(SH, { recursive: true });
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mwui-')); for (const f of ['words.json', 'bad_mhr.json']) fs.copyFileSync(ROOT + '/server/' + f, DATA + '/' + f);
const PORT = 19000 + Math.floor(Math.random() * 900), API = `http://127.0.0.1:${PORT}/index.php`;
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', ROOT + '/server'], { env: Object.assign({}, process.env, { MW_DATA: DATA }), stdio: 'ignore' });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function type(p, w) { for (const ch of w) await p.evaluate(c => mutTushto.input(c), ch); await p.evaluate(() => mutTushto.input('ENTER')); await sleep(w.length * 230 + 500); }
(async () => {
  await sleep(600);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  let api = 'http://127.0.0.1:9/index.php';   // first: server unreachable (offline)
  await ctx.addInitScript(() => { if (!localStorage.getItem('mutTushto.v1')) localStorage.setItem('mutTushto.v1', JSON.stringify({ v: 1, len: 5, mode: 'daily', tut: { done: true, step: 0 } })); });
  await ctx.exposeBinding('__api', () => api); await ctx.addInitScript(() => {});
  const open = async () => { const p = await ctx.newPage(); await p.addInitScript(() => { window.LB_API = localStorage.getItem('__api') || 'http://127.0.0.1:9/index.php'; }); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.goto(base); await sleep(600); return [p, errs]; };
  let [p, errs] = await open();
  // play today's daily offline: 2 misses then the answer
  const w = await p.evaluate(() => mutTushto.G().r.w); const miss = await p.evaluate(a => window.WORDS[5].a.filter(x => x !== a).slice(0, 2), w);
  for (const x of miss) await type(p, x); await type(p, w); await sleep(1500);
  ok(await p.evaluate(() => !!document.getElementById('rLb') && /Попасть в таблицу/.test(document.getElementById('rLb').textContent)), 'result card offers «Попасть в таблицу лидеров»');
  ok(await p.evaluate(() => LB.pending === 1), 'daily result queued locally (no nickname yet, offline)');
  await p.click('#rLb'); await sleep(800);
  ok(await p.evaluate(() => /Нет связи/.test(document.getElementById('lbStatus').textContent) && /укажите ник/.test(document.getElementById('lbStatus').textContent)), 'offline status shown');
  await p.fill('#lbIn', 'Мишук'); await p.click('#lbSave'); await sleep(600);
  ok(await p.evaluate(() => /Нет связи/.test(document.getElementById('lbErr').textContent)), 'nickname needs the server: clear offline message');
  // back online: reload the same page with the live API
  await p.evaluate(a => localStorage.setItem('__api', a), API); await p.reload(); await sleep(600);
  ok(await p.evaluate(() => LB.pending === 1), 'queue survives reload');
  await p.click('#bLeaders'); await sleep(700);
  await p.fill('#lbIn', 'хуйло'); await p.click('#lbSave'); await sleep(500);
  ok(await p.evaluate(() => /нельзя/.test(document.getElementById('lbErr').textContent)), 'bad nickname rejected by the server filter');
  await p.fill('#lbIn', 'Мишук'); await p.click('#lbSave'); await sleep(1500);
  ok(await p.evaluate(() => LB.name === 'Мишук' && LB.pending === 0), 'nickname saved, queued result sent');
  ok(await p.evaluate(() => { const r = document.querySelector('.lbR.me'); return r && /Мишук/.test(r.textContent) && /3\/6/.test(r.textContent); }), 'today table shows me with 3/6');
  await p.screenshot({ path: SH + '/leaders_today_390.png' });
  await p.click('[data-t=wins]'); await sleep(600);
  ok(await p.evaluate(() => /🏆 1/.test(document.querySelector('.lbR.me').textContent)), 'wins tab');
  await p.click('[data-t=streaks]'); await sleep(600);
  ok(await p.evaluate(() => /🔥 1/.test(document.querySelector('.lbR.me').textContent)), 'streaks tab');
  await p.screenshot({ path: SH + '/leaders_streaks_390.png' });
  await p.click('[data-t=day]'); await p.click('[data-l="3"]'); await sleep(600);
  ok(await p.evaluate(() => /никого нет/.test(document.getElementById('lbBody').textContent)), 'per-length daily table (3 letters empty)');
  ok(errs.length === 0, 'no JS errors ' + JSON.stringify(errs));
  await b.close(); srv.kill(); web.kill(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); web.kill(); process.exit(1); });
