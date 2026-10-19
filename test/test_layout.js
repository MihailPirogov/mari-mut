// Layout: fits without scroll from 360×640 to 1920×1080, fluid spacing grows with room, ВВОД on the right with ⌫ next to it.
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const base = process.env.URL || 'file://' + ROOT + '/index.html';
const SH = path.join(ROOT, 'shots/layout'); fs.mkdirSync(SH, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = [[360, 640], [390, 844], [412, 915], [768, 1024], [1280, 720], [1920, 1080]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = [];
  for (const [w, h] of SIZES) for (const len of [3, 5, 8]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w <= 412 ? 2 : 1 });
    await ctx.addInitScript(l => { if (!localStorage.getItem('mutTushto.v1')) localStorage.setItem('mutTushto.v1', JSON.stringify({ v: 1, len: l, mode: 'daily', tut: { done: true, step: 0 } })); window.LB_API = 'http://127.0.0.1:9/'; }, len);
    const p = await ctx.newPage(); await p.goto(base); await sleep(500);
    const m = await p.evaluate(() => {
      const r = id => document.getElementById(id).getBoundingClientRect();
      const kb = r('kb'), en = r('k_ENTER'), del = r('k_DEL'), last = document.querySelector('#kb .kr:last-child');
      const btns = ['bMenu', 'bSound', 'bLeaders', 'bStats', 'bSettings'].map(id => document.getElementById(id)).filter(e => e.offsetParent).map(e => e.getBoundingClientRect());
      const logo = document.querySelector('#logo b').getBoundingClientRect();
      const overlap = btns.some(x => x.left < logo.right && x.right > logo.left) || btns.some(x => x.right > innerWidth + 0.5 || x.left < -0.5);
      const t = document.getElementById('t0_0').getBoundingClientRect(), t1 = document.getElementById('t0_1').getBoundingClientRect();
      return { scroll: document.documentElement.scrollHeight - innerHeight, kbBottom: kb.bottom - innerHeight, enterLast: last.lastElementChild.id === 'k_ENTER' && last.lastElementChild.previousElementSibling.id === 'k_DEL',
        enterRight: en.left > del.left && en.right <= innerWidth, overlap, ts: Math.round(t.width), gap: Math.round(t1.left - t.right), kh: Math.round(en.height),
        grid: r('grid').bottom <= r('msg').top + 1 };
    });
    res.push({ w, h, len, ...m });
    const tag = `${w}x${h} len${len}`;
    ok(m.scroll <= 0 && m.kbBottom <= 0.5, `${tag}: no scroll, keyboard on screen (tile ${m.ts}px, gap ${m.gap}px, key ${m.kh}px)`);
    ok(m.enterLast && m.enterRight, `${tag}: ВВОД on the right, ⌫ next to it`);
    ok(!m.overlap, `${tag}: header fits`); ok(m.grid, `${tag}: grid above the message line`);
    ok(m.ts >= (len === 8 && w <= 360 ? 30 : 36), `${tag}: tiles big enough (${m.ts}px)`);
    if (len === 5) await p.screenshot({ path: `${SH}/${w}x${h}.png` });
    await ctx.close();
  }
  const g = k => res.find(r => r.w === k[0] && r.h === k[1] && r.len === 5);
  ok(g([1920, 1080]).ts > g([360, 640]).ts && g([1920, 1080]).gap > g([360, 640]).gap && g([412, 915]).kh > g([360, 640]).kh, 'more room → bigger tiles, gaps and keys');
  // tutorial spotlight follows the moved ВВОД key
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); await p.goto(base); await sleep(500);
  await p.click('#tutNext'); for (const ch of 'тул') await p.click('#k_' + ch); await sleep(500);
  const sp = await p.evaluate(() => { const h = document.getElementById('tutHole').getBoundingClientRect(), e = document.getElementById('k_ENTER').getBoundingClientRect(); return Math.abs((h.left + h.right) / 2 - (e.left + e.right) / 2) < 3 && Math.abs((h.top + h.bottom) / 2 - (e.top + e.bottom) / 2) < 3; });
  ok(sp, 'tutorial spotlight is on #k_ENTER (right side)'); await p.screenshot({ path: `${SH}/tutorial_enter_390.png` });
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
