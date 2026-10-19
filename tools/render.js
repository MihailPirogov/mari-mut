// node tools/render.js in.html out.png W H
const { chromium } = require('playwright-core');
(async () => { const [i, o, w, h] = process.argv.slice(2); const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage(); await p.goto('file://' + require('path').resolve(i)); await p.waitForTimeout(400);
  await p.screenshot({ path: o, omitBackground: true }); await b.close(); })();
