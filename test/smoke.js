const { chromium } = require('playwright-core'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const url = process.env.URL || 'file://' + ROOT + '/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [tag, vp] of [['m', { width: 390, height: 844 }], ['d', { width: 1440, height: 900 }]]) {
    const p = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await p.goto(url); await p.waitForTimeout(800); await p.screenshot({ path: `${ROOT}/shots/${tag}_tut0.png` });
    await p.click('#tutNext'); await p.waitForTimeout(400); await p.screenshot({ path: `${ROOT}/shots/${tag}_tut1.png` });
    for (const ch of 'чыве') await p.click(`#k_${ch}`); await p.waitForTimeout(300); await p.click('#k_ENTER'); await p.waitForTimeout(1800);
    await p.screenshot({ path: `${ROOT}/shots/${tag}_tut3.png` });
    console.log(tag, 'step', await p.evaluate(() => mutTushto.tutStep()), errs);
  }
  await b.close();
})();
