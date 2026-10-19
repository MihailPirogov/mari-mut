// Android bundle (assets/www) in Chrome with a mocked window.AndroidBridge: ads via native bridge, sound paused, no Metrika.
const { chromium } = require('playwright-core'); const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '../android/app/src/main/assets/www');
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; fs.readFile(path.join(DIR, u), (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': u.endsWith('.html') ? 'text/html; charset=utf-8' : u.endsWith('.css') ? 'text/css' : u.endsWith('.png') ? 'image/png' : 'application/javascript; charset=utf-8' }); r.end(b); }); }).listen(8767);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; }; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { const log = window.__ab = [];
    window.AndroidBridge = { vibrate() {}, share(t) { log.push('share:' + t); }, shareImage() {}, openUrl(u) { log.push('open:' + u); },
      rewardedAvailable: () => true, showRewarded(cb) { log.push('rewarded'); setTimeout(() => { log.push('blocked:' + Sound.blocked); window[cb](true); }, 200); },
      interstitialAvailable: () => true, showInterstitial(cb) { log.push('interstitial'); setTimeout(() => window[cb](), 200); },
      bannerAvailable: () => true, showBanner() { log.push('banner+'); }, hideBanner() { log.push('banner-'); } }; });
  await p.goto('http://127.0.0.1:8767/'); await sleep(700);
  ok(await p.evaluate(() => Platform.name === 'android' && typeof ym === 'undefined' && typeof mutTushto === 'undefined'), 'android adapter, no Metrika, no hooks');
  ok(await p.evaluate(() => !__ab.includes('banner+') && !__ab.includes('rewarded')), 'no ads during tutorial');
  await p.click('#tutSkip'); await sleep(200);
  ok(await p.evaluate(() => __ab.includes('banner+')), 'native banner after tutorial');
  await p.click('#bHint'); await sleep(500);
  ok(await p.evaluate(() => __ab.includes('blocked:true') && !Sound.blocked), 'rewarded via bridge, sound paused during it');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('mutTushto.v1')).daily[3].hints.length === 1), 'reward granted');
  ok(await p.evaluate(() => window.__appBack() === false), 'back button: no modal → app handles exit');
  ok(errs.length === 0, 'no errors ' + JSON.stringify(errs));
  await b.close(); srv.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
