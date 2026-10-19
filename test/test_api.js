// Leaderboard API test: runs server/index.php with `php -S` on a temp data dir.
const { spawn, execSync } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'); const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mwlb-'));
fs.copyFileSync(ROOT + '/server/words.json', DATA + '/words.json'); fs.copyFileSync(ROOT + '/server/bad_mhr.json', DATA + '/bad_mhr.json');
const W = JSON.parse(fs.readFileSync(ROOT + '/server/words.json', 'utf8'));
const DAY0 = Math.floor(Date.UTC(2026, 9, 19) / 864e5) - 30, mskDay = () => Math.floor((Date.now() + 3 * 3600e3) / 864e5);
const daily = (len, day) => { const a = W[len].a, n = a.length; return a[(((day - DAY0) + len * 37) % n + n) % n]; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PORT = 18000 + Math.floor(Math.random() * 1000), URL = `http://127.0.0.1:${PORT}/index.php`;
const srv = spawn('php', ['-S', '127.0.0.1:' + PORT, '-t', ROOT + '/server'], { env: Object.assign({}, process.env, { MW_DATA: DATA, MW_DAY0: String(DAY0) }), stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async b => { const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
const get = async q => { const r = await fetch(URL + '?' + q); return [r.status, await r.json(), r.headers.get('access-control-allow-origin')]; };
const id = () => crypto.randomBytes(16).toString('hex');
(async () => {
  await sleep(700);
  const today = mskDay(), ans = daily(5, today), other = W[5].a.filter(w => w !== ans);
  const A = { pid: id(), key: id() }, B = { pid: id(), key: id() }, C = { pid: id(), key: id() };
  // nicknames
  for (const bad of ['х', 'Х у й', 'xyй', 'пиzда', 'ПИДОР', 'fuck_you', 'Ебланчик', 'ad min', 'болван', 'шлюха', 'a<b>', '12345', 'оченьоченьдлинныйник'])
    { const [s, j] = await get('a=check&name=' + encodeURIComponent(bad)); ok(!j.ok, 'rejects nickname «' + bad + '» (' + j.msg + ')'); }
  for (const good of ['Шӱдыр', 'Pravda', 'Ӱдыр', 'Мишук', 'Pirogov_M', 'Корабля мастер', 'Небо', 'Йошкар-Ола 12', 'Сеҥышо'])
    { const [s, j] = await get('a=check&name=' + encodeURIComponent(good)); ok(j.ok, 'accepts nickname «' + good + '»'); }
  let [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: [ans] }); ok(s === 422 && j.err === 'need_name', 'no results without a nickname (opt-in)');
  [s, j] = await post({ a: 'name', ...A, name: 'Мишук' }); ok(s === 200 && j.ok, 'set nickname');
  [s, j] = await post({ a: 'name', ...B, name: 'мишук' }); ok(s === 409, 'nickname unique (case-insensitive)');
  [s, j] = await post({ a: 'name', pid: A.pid, key: id(), name: 'Хакер' }); ok(s === 403, 'other key cannot rename a player');
  // validation
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: ['ыыыыы', ans] }); ok(s === 422 && j.err === 'bad_word', 'guess not in dictionary rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: other.slice(0, 3) }); ok(s === 422 && j.err === 'unfinished', 'unfinished loss rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: [ans, other[0]] }); ok(s === 422 && j.err === 'after_win', 'guesses after the answer rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: other.slice(0, 7) }); ok(s === 422 && j.err === 'too_many', '7 attempts without the extra-attempt flag rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today + 1, len: 5, g: [daily(5, today + 1)] }); ok(s === 422 && j.err === 'bad_day', 'future day rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today - 9, len: 5, g: [daily(5, today - 9)] }); ok(s === 422 && j.err === 'bad_day', 'older than 7 days rejected');
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: [other[0]].concat([daily(5, today - 1)]) }); ok(s === 422 || (j.won === false), 'yesterday\'s answer does not win today');
  // valid
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: [other[0], other[1], ans] }); ok(s === 200 && j.won && j.wins === 1, 'valid win accepted');
  [s, j] = await post({ a: 'submit', ...A, day: today, len: 5, g: [ans] }); ok(s === 200 && j.dup, 'one result per player per day+length');
  [s, j] = await post({ a: 'submit', ...A, day: today - 1, len: 5, g: [daily(5, today - 1)] }); ok(s === 200 && j.cur === 2, 'late (queued) result for yesterday → streak 2');
  [s, j] = await post({ a: 'submit', ...B, name: 'Ӱдыр', day: today, len: 5, g: [ans] }); ok(s === 200 && j.won, 'nickname + result in one request');
  [s, j] = await post({ a: 'submit', ...C, name: 'Сеҥышо', day: today, len: 5, g: other.slice(0, 6) }); ok(s === 200 && j.won === false, 'loss after 6 attempts accepted');
  [s, j] = await post({ a: 'submit', ...C, day: today, len: 3, g: W[3].a.filter(w => w !== daily(3, today)).slice(0, 6).concat([daily(3, today)]), x: true }); ok(s === 200 && j.won, '7th attempt (rewarded) win accepted');
  let h; [s, j, h] = await get('a=board&len=5&pid=' + A.pid);
  ok(h === '*', 'CORS header for web/Android/Yandex');
  ok(j.daily.top.map(e => e.n).join(',') === 'Ӱдыр,Мишук,Сеҥышо' && j.daily.top[0].g === 1 && j.daily.me.r === 2, 'daily table order: wins first, fewer attempts ' + JSON.stringify(j.daily.top));
  ok(j.wins.top[0].n === 'Мишук' && j.wins.top[0].wins === 2, 'all-time wins table');
  ok(j.streaks.top[0].n === 'Мишук' && j.streaks.top[0].cur === 2 && j.streaks.top[0].best === 2, 'streaks table');
  ok(!JSON.stringify(j).includes(A.key) && !JSON.stringify(j).includes('kh'), 'no keys leaked');
  const stored = fs.readFileSync(DATA + '/players.json', 'utf8') + fs.readFileSync(DATA + '/rate.json', 'utf8');
  ok(!stored.includes('127.0.0.1') && !stored.includes(A.key), 'no raw IPs or keys stored');
  [s, j] = await post({ a: 'delete', pid: C.pid, key: id() }); ok(s === 403, 'delete needs the player key');
  [s, j] = await post({ a: 'delete', ...C }); [, j] = await get('a=board&len=5');
  ok(!JSON.stringify(j).includes('Сеҥышо') && !fs.readFileSync(DATA + '/days/' + today + '.json', 'utf8').includes(C.pid), 'delete removes nickname and results');
  // rate limit
  let limited = false; for (let i = 0; i < 70 && !limited; i++) { [s] = await post({ a: 'name', pid: id(), key: id(), name: 'Тест' + i }); if (s === 429) limited = true; }
  ok(limited, 'rate limit per IP');
  srv.kill(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
