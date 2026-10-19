// Yandex release build with mocked SDK: SDK lifecycle, tutorial first, ads (fullscreen/rewarded/banner), sound paused during ads, cloud save, no links.
const { chromium } = require('playwright-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, process.env.DIR || 'release/build/yandex');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = u === '/sdk.js' ? path.join(__dirname, 'mock_yandex_sdk.js') : path.join(DIR, u);
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); }); }).listen(8766);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('response', r => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()));
  await p.clock.install();
  const log = () => p.evaluate(() => window.__ya.log.slice());
  const S = () => p.evaluate(() => JSON.parse(localStorage.getItem('mutTushto.v1')));
  async function type(w) { for (const ch of w) await p.click('#k_' + ch); await p.click('#k_ENTER'); await p.clock.runFor(w.length * 230 + 400); await sleep(100); }
  await p.goto('http://127.0.0.1:8766/'); await sleep(800);
  const info = await p.evaluate(() => ({ hooks: typeof window.mutTushto, name: Platform.name, links: Platform.links, share: Platform.shareUrl, ext: document.querySelectorAll('a[href^="http"]').length, ym: typeof window.ym, robots: !!document.querySelector('meta[name=robots]') }));
  ok(info.hooks === 'undefined' && info.name === 'yandex' && !info.links && info.share === null && info.ext === 0, 'release: yandex adapter, no hooks, no links ' + JSON.stringify(info));
  ok(info.ym === 'undefined' && !info.robots, 'no Metrika / noindex in Yandex build');
  let L = await log(); ok(L.indexOf('YaGames.init') < L.indexOf('LoadingAPI.ready') && L.filter(x => x === 'LoadingAPI.ready').length === 1, 'init → LoadingAPI.ready once');
  ok(!L.some(x => /adv\.show/.test(x)) && await p.isVisible('#tut'), 'tutorial first, no ads before it ends');
  ok(!L.includes('GameplayAPI.start'), 'no gameplay while tutorial bubble is shown');
  await p.click('#tutSkip'); await sleep(200); L = await log();
  ok(L.includes('adv.showBannerAdv'), 'tutorial done → sticky banner via API');
  ok(L[L.length - 1] === 'GameplayAPI.start', 'GameplayAPI.start in a round');
  ok(await p.isVisible('#bHint'), 'rewarded «Открыть букву» visible');
  await p.click('#bHint'); await p.clock.runFor(400); await sleep(50);
  const da = await p.evaluate(() => window.__ya.duringAd); await p.clock.runFor(500); await sleep(100);
  ok(da && da.musicPaused === true, 'sound blocked during rewarded ad'); ok(await p.evaluate(() => !Sound.blocked), 'sound restored after ad');
  ok((await S()).daily[3].hints.length === 1, 'reward: letter revealed');
  await p.evaluate(() => window.__ysdk._emit('game_api_pause')); ok(await p.evaluate(() => Sound.blocked), 'game_api_pause blocks sound');
  await p.evaluate(() => window.__ysdk._emit('game_api_resume')); ok(await p.evaluate(() => !Sound.blocked), 'game_api_resume restores sound');
  await type((await S()).daily[3].w); await p.clock.runFor(1500); await sleep(200);
  L = await log(); ok(L[L.length - 1] === 'GameplayAPI.stop' || L.lastIndexOf('GameplayAPI.stop') > L.lastIndexOf('GameplayAPI.start'), 'GameplayAPI.stop after round');
  const share = await p.evaluate(() => { document.getElementById('rShare').click(); return null; }); await sleep(200);
  ok(!/https?:|pirogovlab/.test(await p.evaluate(() => window.__lastShare || '')) && /🟩/.test(await p.evaluate(() => window.__lastShare || '')), 'share text without links: ' + JSON.stringify(await p.evaluate(() => window.__lastShare)));
  ok(!/fu-lab\.ru/.test(await p.textContent('#sheet')), 'card credit without domain');
  await p.click('#rFree'); await sleep(200);
  await p.clock.runFor(3000); L = await log(); ok(L.includes('player.setData'), 'cloud save via player.setData');
  // practice: fullscreen every 3rd round, ≥150 s
  await p.clock.fastForward(200e3);
  let fs0 = L.filter(x => x === 'adv.showFullscreenAdv').length;
  for (let i = 0; i < 3; i++) { await type((await S()).free[3].w); await p.clock.runFor(1500); await sleep(100); await p.click('#rNext'); await p.clock.runFor(800); await sleep(100); }
  L = await log(); const fsN = L.filter(x => x === 'adv.showFullscreenAdv').length - fs0;
  ok(fsN === 1, 'one fullscreen ad in 3 practice rounds (' + fsN + ')');
  const dfs = await p.evaluate(() => window.__ya.duringFs); ok(dfs && dfs.musicPaused === true, 'sound blocked during fullscreen');
  // cloud restore on a new device
  const saved = await S(); const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage();
  await p2.addInitScript(d => { window.__yaPreset = d; }, saved); await p2.goto('http://127.0.0.1:8766/'); await sleep(1200);
  ok(await p2.evaluate(() => { const s = JSON.parse(localStorage.getItem('mutTushto.v1')); return s.tut.done && s.wins >= 4 && document.getElementById('tut').hidden; }), 'new device: progress restored from cloud (player.getData)');
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close(); srv.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
