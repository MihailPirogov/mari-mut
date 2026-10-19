// Main test: logic (daily determinism, scoring, dictionary), tutorial first (no ads before it ends), ads flow with ?adsim=1, physical keyboard.
const { chromium } = require('playwright-core'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'); const base = process.env.URL || 'file://' + ROOT + '/index.html';
const SH = path.join(ROOT, 'shots/test'); fs.mkdirSync(SH, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function type(p, w) { for (const ch of w) await p.evaluate(c => mutTushto.input(c), ch); await p.evaluate(() => mutTushto.input('ENTER')); await sleep(w.length * 230 + 450); }
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.clock.install();
  await p.goto(base + '?adsim=1'); await sleep(600);
  // ---- logic
  const L = await p.evaluate(() => { const M = mutTushto, d = M.mskDay();
    const det = [3, 4, 5, 6, 7, 8].every(n => M.dailyWord(n, d) === M.dailyWord(n, d) && M.isValid(M.dailyWord(n, d)) && M.dailyWord(n, d).length === n);
    const diff = M.dailyWord(5, d) !== M.dailyWord(5, d + 1);
    // Moscow boundary: 20:59:59 UTC is still the same Moscow day, 21:00 UTC is the next one
    const t = Date.UTC(2026, 9, 19, 20, 59, 59), b1 = M.mskDay(t) === M.mskDay(t - 3600e3 * 20), b2 = M.mskDay(t + 1000) === M.mskDay(t) + 1;
    const no1 = M.dailyNo(M.mskDay(Date.UTC(2026, 9, 19, 0, 0))) === 1;
    let uniq = new Set(); for (let i = 0; i < 300; i++) uniq.add(M.dailyWord(5, d + i));
    const sc = [M.score('кече', 'кече') === 'cccc', M.score('чыве', 'кече') === 'paac', M.score('ееее', 'кече') === 'acac', M.score('ееке', 'кече') === 'acpc'];
    return { det, diff, b1, b2, no1, uniq: uniq.size, sc, valid: [M.isValid('кече'), M.isValid('кумыл'), !M.isValid('ыыыыы'), !M.isValid('qwert')],
      hard: [M.hardViolation('кече', [['чыве', 'paac']]) === null, !!M.hardViolation('шудо', [['чыве', 'paac']])],
      kbd: [M.keyFromEvent({ key: '3' }) === 'ӱ', M.keyFromEvent({ key: 'Ё' }) === 'е', M.keyFromEvent({ key: 'q', code: 'KeyQ' }) === 'й', M.keyFromEvent({ key: 'Enter' }) === 'ENTER', M.keyFromEvent({ key: 'ӱ' }) === 'ӱ', M.keyFromEvent({ key: 'ü' }) === 'ӱ', M.keyFromEvent({ key: 'ä' }) === 'ӓ', M.keyFromEvent({ key: 'ӈ' }) === 'ҥ', M.keyFromEvent({ key: 'ң' }) === 'ҥ', M.keyFromEvent({ key: 'у\u0308' }) === 'ӱ', M.keyFromEvent({ key: '\u0308' }) === 'DIA'] }; });
  ok(L.det, 'daily word deterministic, valid and of the right length for 3..8'); ok(L.diff, 'daily word changes next day');
  ok(L.b1 && L.b2, 'daily switches at 00:00 Moscow (21:00 UTC)'); ok(L.no1, 'Задача дня №1 = 19.10.2026');
  ok(L.uniq === 300, 'no repeats in 300 consecutive daily words (' + L.uniq + ')');
  ok(L.sc.every(x => x === true), 'scoring incl. duplicate letters ' + JSON.stringify(L.sc));
  ok(L.valid.every(Boolean), 'dictionary validation'); ok(L.hard.every(Boolean), 'hard mode rules'); ok(L.kbd.every(Boolean), 'physical keyboard mapping (1–5 → Ӓ Ӧ Ӱ Ӹ Ҥ, ЙЦУКЕН by position)');
  // ---- tutorial first, no ads before end
  ok(await p.evaluate(() => mutTushto.G().mode === 'tut' && mutTushto.G().len === 3 && !document.getElementById('tut').hidden), 'first launch starts the interactive tutorial with 3 letters');
  ok(await p.evaluate(() => document.getElementById('bHint').hidden), 'no rewarded hint button during tutorial');
  await p.click('#tutNext'); await sleep(200);
  ok(await p.evaluate(() => mutTushto.tutStep()) === 1, 'tutorial waits for typing');
  await p.keyboard.press('KeyF'); ok(await p.evaluate(() => mutTushto.G() && document.querySelector('#t0_0').textContent === ''), 'tutorial ignores a wrong letter');
  for (const ch of 'тул') await p.click('#k_' + ch);
  await sleep(150); ok(await p.evaluate(() => mutTushto.tutStep()) === 2, 'typing ТУЛ advances to «press ВВОД»');
  await p.click('#k_ENTER'); await sleep(1600);
  ok(await p.evaluate(() => mutTushto.tutStep()) === 3, 'submit advances to colour explanation');
  await p.screenshot({ path: SH + '/tut_colors.png' });
  await p.click('#tutNext'); await sleep(150);
  ok(await p.evaluate(() => mutTushto.tutStep() === 4 && !document.getElementById('bHint').hidden && document.getElementById('bHint').disabled), 'tutorial shows the 🎬 hint button (disabled)');
  await p.click('#tutNext'); await sleep(150); await p.click('#tutNext'); await sleep(150);
  ok(await p.evaluate(() => document.getElementById('tut').hidden), 'free play inside tutorial');
  await type(p, 'мут'); await sleep(1500);
  ok(await p.evaluate(() => !document.getElementById('modal').hidden && document.querySelector('.csrc') && /Словарь марийского языка|Учаев/.test(document.querySelector('.csrc').textContent)), 'word card with source credit after the round');
  await p.screenshot({ path: SH + '/tut_card.png' });
  ok(await p.evaluate(() => !window.__adsim.some(x => x !== 'banner-')), 'no ads at all during the tutorial');
  await p.click('#rOk'); await sleep(300);
  for (let i = 0; i < 4; i++) { ok(!(await p.evaluate(() => document.getElementById('tut').hidden)), 'tour step ' + (i + 7)); await p.click('#tutNext'); await sleep(300); }
  ok(await p.evaluate(() => mutTushto.st().tut.done && mutTushto.G().mode === 'daily' && mutTushto.G().len === 3), 'tutorial done -> daily puzzle, 3 letters by default');
  ok(await p.evaluate(() => window.__adsim.includes('banner+')), 'sticky banner only after the tutorial');
  // ---- daily round: hint via rewarded
  await p.click('#bHint'); await p.clock.runFor(1600); await sleep(200);
  ok(await p.evaluate(() => mutTushto.G().r.hints.length === 1 && window.__adsim.includes('rewarded')), 'rewarded → letter revealed');
  // lose daily → offer extra attempt
  const wrong = await p.evaluate(() => { const r = mutTushto.G().r; return window.WORDS[r.w.length].a.filter(w => w !== r.w).slice(0, 6); });
  for (const w of wrong) await type(p, w);
  await sleep(300);
  ok(await p.evaluate(() => !!document.getElementById('xAd')), 'after 6 misses: offer «ещё попытка» for rewarded ad');
  await p.click('#xAd'); await p.clock.runFor(1600); await sleep(300);
  ok(await p.evaluate(() => mutTushto.G().r.extra && document.querySelectorAll('#grid .row').length === 7), '7th row granted');
  await type(p, await p.evaluate(() => mutTushto.G().r.w)); await sleep(1500);
  const share = await p.evaluate(() => mutTushto.shareText());
  ok(/задача дня №\d+/.test(share) && /7\/7/.test(share) && /\n🟩🟩🟩(\n|$)/.test(share), 'share text with emoji grid:\n' + share);
  const s1 = await p.evaluate(() => mutTushto.st().stats.daily[3]);
  ok(s1.p === 1 && s1.w === 1 && s1.cur === 1, 'daily stats + streak');
  await p.click('#rOk');
  // ---- practice rounds: interstitial not too often (every 3rd round, ≥150 s)
  await p.click('[data-mode=free]'); await sleep(200);
  const before = await p.evaluate(() => window.__adsim.filter(x => x === 'interstitial').length);
  for (let i = 0; i < 4; i++) { await type(p, await p.evaluate(() => mutTushto.G().r.w)); await sleep(1500); await p.evaluate(() => document.getElementById('rNext').click()); await p.clock.runFor(1700); await sleep(300); }
  const n1 = await p.evaluate(() => window.__adsim.filter(x => x === 'interstitial').length) - before;
  ok(n1 === 0, 'no interstitial within 150 s of the last ad (' + n1 + ')');
  await p.clock.fastForward(200e3);
  for (let i = 0; i < 3; i++) { await type(p, await p.evaluate(() => mutTushto.G().r.w)); await sleep(1500); await p.evaluate(() => document.getElementById('rNext').click()); await p.clock.runFor(1700); await sleep(300); }
  const n2 = await p.evaluate(() => window.__adsim.filter(x => x === 'interstitial').length) - before;
  ok(n2 === 1, 'exactly one interstitial after 3 rounds once 150 s passed (' + n2 + ')');
  ok(await p.evaluate(() => /Практика/.test(document.getElementById('sub').textContent)), 'practice mode');
  // physical keyboard: real key presses (Russian letters, 1-5 digits, Mari Unicode)
  await p.evaluate(() => { mutTushto.input('DEL'); mutTushto.input('DEL'); mutTushto.input('DEL'); });
  const kd = (k, code) => p.evaluate(([k, code]) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: code || '', bubbles: true, cancelable: true })), [k, code]);
  await kd('в', 'KeyD'); await p.keyboard.press('3'); await kd('д', 'KeyL'); ok(await p.evaluate(() => [0,1,2].map(j => document.getElementById('t0_' + j).textContent).join('') === 'вӱд'), 'typing «в3д» on a physical keyboard gives ВӰД ' + await p.evaluate(() => JSON.stringify([document.getElementById('modal').hidden, mutTushto.G().len, mutTushto.G().r.g.length, document.getElementById('grid').textContent])));
  await p.evaluate(() => { for (let i = 0; i < 3; i++) mutTushto.input('DEL'); }); for (const c of 'шӱм') await kd(c);
  ok(await p.evaluate(() => [0,1,2].map(j => document.getElementById('t0_' + j).textContent).join('') === 'шӱм'), 'Mari Unicode letters typed directly');
  await p.evaluate(() => { for (let i = 0; i < 3; i++) mutTushto.input('DEL'); });
  // invalid word
  await p.evaluate(() => { for (const c of 'ыыы') mutTushto.input(c); mutTushto.input('ENTER'); }); await sleep(200);
  ok(await p.evaluate(() => /нет в словаре/.test(document.getElementById('toast').textContent) && mutTushto.G().r.g.length === 0), 'invalid word rejected');
  // challenge link (?w=)
  const p2 = await ctx.newPage(); await p2.goto(base + '?w=' + Buffer.from('кумыл').toString('base64')); await sleep(500);
  ok(await p2.evaluate(() => mutTushto.G().r.w === 'кумыл' && mutTushto.G().mode === 'free'), 'friend link ?w= starts that word');
  ok(errs.length === 0, 'no JS errors ' + JSON.stringify(errs));
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
