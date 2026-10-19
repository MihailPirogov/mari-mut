/* Марий мут (Mari Words). PirogovLab. State in localStorage 'mutTushto.v1' (+ cloud on Yandex). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'mutTushto.v1', ROWS = 6, LENS = [3, 4, 5, 6, 7, 8];
  const DAY0 = Math.floor(Date.UTC(2026, 9, 19) / 864e5);   // Задача дня №1 = 19.10.2026 (Moscow)
  const TUT_SECRET = 'мут', TUT_GUIDE = 'тул';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = window.WORDS, CARDS = window.CARDS || {}, GLOSS = window.GLOSS || {};

  /* ---------- pure logic (exported for tests) ---------- */
  function mskDay(now) { return Math.floor(((now == null ? Date.now() : now) + 3 * 3600e3) / 864e5); }
  function dailyNo(day) { return day - DAY0 + 1; }
  function dailyWord(len, day) { const a = W[len].a, n = a.length; return a[(((day - DAY0) + len * 37) % n + n) % n]; }
  const VALID = {};
  function validSet(len) { if (!VALID[len]) { VALID[len] = new Set(W[len].a.concat(W[len].g ? W[len].g.split(' ') : [])); } return VALID[len]; }
  function isValid(w) { return !!(W[w.length] && validSet(w.length).has(w)); }
  function score(guess, secret) {
    const n = secret.length, r = Array(n).fill('a'), s = secret.split('');
    for (let i = 0; i < n; i++) if (guess[i] === s[i]) { r[i] = 'c'; s[i] = null; }
    for (let i = 0; i < n; i++) if (r[i] === 'a') { const j = s.indexOf(guess[i]); if (j >= 0) { r[i] = 'p'; s[j] = null; } }
    return r.join('');
  }
  function hardViolation(guess, rows) {   // rows: [[word, score]]
    for (const [w, sc] of rows) {
      for (let i = 0; i < w.length; i++) if (sc[i] === 'c' && guess[i] !== w[i]) return `${i + 1}-я буква должна быть «${w[i].toUpperCase()}»`;
      const need = {}; for (let i = 0; i < w.length; i++) if (sc[i] !== 'a') need[w[i]] = (need[w[i]] || 0) + 1;
      for (const ch in need) if (guess.split(ch).length - 1 < need[ch]) return `В слове должна быть буква «${ch.toUpperCase()}»`;
    }
    return null;
  }

  /* ---------- state ---------- */
  function fresh() { return { v: 1, ts: 0, len: 3, mode: 'daily', set: { sound: true, theme: 'light', hc: false, hard: false, vib: true }, tut: { done: false, step: 0 }, stats: { daily: {}, free: {} }, daily: {}, free: {}, rounds: 0, wins: 0 }; }
  let st = Platform.storage.load(KEY);
  if (!st || st.v !== 1) st = fresh();
  st = Object.assign(fresh(), st); st.set = Object.assign(fresh().set, st.set);
  let saveT = 0;
  function save() { st.ts = Date.now(); Platform.storage.save(KEY, st); clearTimeout(saveT); saveT = setTimeout(() => Platform.cloud.available && Platform.cloud.push(st), 2500); }
  function stat(mode, len) { const s = st.stats[mode]; return s[len] || (s[len] = { p: 0, w: 0, cur: 0, max: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0], lastDay: null }); }

  /* ---------- round ---------- */
  let G = null, cur = '', busy = false, adShowing = false, sessionStart = Date.now(), lastAd = Date.now() - 60e3;
  function roundFor(mode, len) {
    if (mode === 'tut') return st.tutRound || (st.tutRound = { w: TUT_SECRET, g: [], done: false, won: false, hints: [], extra: false });
    if (mode === 'daily') {
      const day = mskDay(); let r = st.daily[len];
      if (!r || r.day !== day) r = st.daily[len] = { day, w: dailyWord(len, day), g: [], done: false, won: false, hints: [], extra: false };
      return r;
    }
    let r = st.free[len];
    if (!r || (r.done && r.consumed)) r = st.free[len] = newFree(len);
    return r;
  }
  function newFree(len, word) { const a = W[len].a; return { w: word || a[Math.floor(Math.random() * a.length)], g: [], done: false, won: false, hints: [], extra: false, friend: !!word }; }
  function start(mode, len) {
    st.mode = mode === 'tut' ? st.mode : mode; if (mode !== 'tut') st.len = len;
    G = { mode, len: mode === 'tut' ? 3 : len }; G.r = roundFor(mode, G.len); cur = '';
    save(); render(); updUI(); gp();
  }
  const rowsOf = () => ROWS + (G.r.extra ? 1 : 0);
  const scores = () => G.r.g.map(w => [w, score(w, G.r.w)]);

  /* ---------- rendering ---------- */
  function render() {
    const grid = $('grid'), n = G.len, R = rowsOf();
    grid.innerHTML = '';
    for (let i = 0; i < R; i++) {
      const row = document.createElement('div'); row.className = 'row' + (i === ROWS ? ' extra' : ''); row.style.gridTemplateColumns = `repeat(${n},auto)`;
      for (let j = 0; j < n; j++) { const t = document.createElement('div'); t.className = 't'; t.id = `t${i}_${j}`; row.appendChild(t); }
      grid.appendChild(row);
    }
    fit(); paint(); renderKb();
  }
  function fit() {
    if (!G) return;
    // fluid layout: tiles, gaps and keys grow with free space (caps keep it sensible on big monitors)
    const b = $('board'), n = G.len, R = rowsOf(), H = innerHeight, Wd = innerWidth;
    const tsMax = H >= 900 && Wd >= 700 ? 84 : H >= 780 ? 74 : 66;
    const gapFor = t => Math.max(5, Math.min(11, Math.round(t * 0.12)));
    let ts = 66, gap = 6;
    for (let k = 0; k < 2; k++) {   // gap depends on tile size: iterate once
      ts = Math.max(26, Math.floor(Math.min((b.clientWidth - 8 - gap * (n - 1)) / n, (b.clientHeight - 6 - gap * (R - 1)) / R, tsMax)));
      gap = gapFor(ts);
    }
    $('grid').style.setProperty('--ts', ts + 'px'); $('grid').style.setProperty('--gap', gap + 'px');
    const kh = Math.max(38, Math.min(H >= 900 ? 62 : 56, Math.floor(H * 0.062))); $('kb').style.setProperty('--kh', kh + 'px');
  }
  function paint(skipRow) {
    const sc = scores(), R = rowsOf();
    for (let i = 0; i < R; i++) {
      if (i === skipRow) continue;
      for (let j = 0; j < G.len; j++) {
        const t = $(`t${i}_${j}`); if (!t) continue;
        if (i < sc.length) { t.textContent = sc[i][0][j]; t.className = 't ' + sc[i][1][j]; }
        else if (i === sc.length && !G.r.done) {
          const ch = cur[j]; const h = !ch && G.r.hints.includes(j);
          t.textContent = ch || (h ? G.r.w[j] : ''); t.className = 't' + (ch ? ' f' : h ? ' hintL' : '');
        } else { t.textContent = ''; t.className = 't'; }
      }
    }
  }
  const KB = [['ӓ', 'ӧ', 'ӱ', 'ӹ', 'ҥ'], ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'], ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'], ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю', 'DEL', 'ENTER']];   // ВВОД справа, ⌫ рядом — как на обычной клавиатуре
  function keyState() {
    const m = {}; const rank = { a: 1, p: 2, c: 3 };
    scores().forEach(([w, s]) => { for (let i = 0; i < w.length; i++) if (!m[w[i]] || rank[s[i]] > rank[m[w[i]]]) m[w[i]] = s[i]; });
    G.r.hints.forEach(j => { m[G.r.w[j]] = 'c'; });
    return m;
  }
  function renderKb() {
    const ks = keyState(), kb = $('kb'); kb.innerHTML = '';
    KB.forEach((row, ri) => {
      const r = document.createElement('div'); r.className = 'kr';
      row.forEach(k => {
        const b = document.createElement('button'); b.className = 'k' + (ri === 0 ? ' mari' : '') + (k.length > 1 ? ' wide' : '') + (k === 'ENTER' ? ' enter' : '') + (ks[k] ? ' ' + ks[k] : '');
        b.textContent = k === 'DEL' ? '⌫' : k === 'ENTER' ? 'ВВОД' : k; b.dataset.k = k; b.id = 'k_' + k;
        r.appendChild(b);
      });
      kb.appendChild(r);
    });
  }
  $('kb').addEventListener('pointerdown', e => { const b = e.target.closest('.k'); if (!b) return; e.preventDefault(); Sound.unlock(); input(b.dataset.k); });

  function updUI() {
    document.querySelectorAll('#segMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === (G.mode === 'tut' ? 'daily' : G.mode)));
    $('bLen').innerHTML = `<b>${G.len}</b> ${plural(G.len)} ▾`;
    const r = G.r;
    $('sub').textContent = G.mode === 'daily' ? `Задача дня №${dailyNo(r.day)} · одно слово для всех` : G.mode === 'tut' ? 'Обучение' : r.friend ? 'Слово от друга' : 'Практика · сколько угодно слов';
    $('bHint').hidden = !(adsOk() && !r.done && Platform.ads.rewardedAvailable() && r.hints.length < G.len - 1);
    $('bNext').hidden = !(r.done && G.mode !== 'daily');
    $('bCardAgain').hidden = !r.done; $('bShare').hidden = !(r.done && G.mode !== 'tut');
    $('bNext').textContent = G.mode === 'tut' ? 'Дальше ›' : 'Новое слово ›';
    if (r.done) setMsg(r.won ? `Сеҥышыч! Слово: ${r.w.toUpperCase()}` : `Слово было: ${r.w.toUpperCase()}`);
    else setMsg('');
    fit();
  }
  function plural(n) { return n === 3 || n === 4 ? 'буквы' : 'букв'; }
  function setMsg(t) { $('msg').textContent = t; }
  let toastT = 0;
  function toast(t, ms) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms || 1600); }

  /* ---------- input ---------- */
  function input(k) {
    if (!G || busy || G.r.done || !$('modal').hidden) return;
    if (tutBlocks(k)) return;
    if (k === 'DEL') { if (cur) { cur = cur.slice(0, -1); Sound.del(); paint(); } return; }
    if (k === 'ENTER') return submit();
    if (k === 'DIA') { const l = cur.slice(-1); if (DIA[l]) { cur = cur.slice(0, -1) + DIA[l]; paint(); tutEvent('type'); } return; }
    if (cur.length < G.len && /^[а-яӓӧӱӹҥ]$/.test(k)) { cur += k; Sound.key(cur.length); haptic(8); paint(); tutEvent('type'); }
  }
  const CODE = { KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з', BracketLeft: 'х', BracketRight: 'ъ', KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д', Semicolon: 'ж', Quote: 'э', KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь', Comma: 'б', Period: 'ю' };
  const LOOK = { 'ё': 'е', 'ä': 'ӓ', 'ö': 'ӧ', 'ü': 'ӱ', 'ÿ': 'ӹ', 'ӛ': 'ӓ', 'ӫ': 'ӧ', 'ӈ': 'ҥ', 'ң': 'ҥ', 'ŋ': 'ҥ', 'ӊ': 'ҥ', 'ӳ': 'ӱ', 'ӯ': 'ӱ', 'ў': 'ӱ', 'ӹ': 'ӹ', 'ӓ': 'ӓ', 'ӧ': 'ӧ', 'ӱ': 'ӱ' };
  const DIA = { 'а': 'ӓ', 'о': 'ӧ', 'у': 'ӱ', 'ы': 'ӹ' };
  const DIG = { '1': 'ӓ', '2': 'ӧ', '3': 'ӱ', '4': 'ӹ', '5': 'ҥ' };
  function keyFromEvent(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (e.key === 'Enter') return 'ENTER';
    if (e.key === 'Backspace') return 'DEL';
    let k = (e.key || '').normalize('NFC').toLowerCase();
    if (k === '\u0308') return 'DIA';                  // dead-key / combining diaeresis: merge with the previous letter
    if (LOOK[k]) k = LOOK[k];
    if (DIG[k]) return DIG[k];
    if (/^[а-яӓӧӱӹҥ]$/.test(k)) return k;
    if (/^[a-z;'\[\],.]$/.test(k) && CODE[e.code]) return CODE[e.code];
    return null;
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('modal').hidden) { closeModal(); return; }
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = keyFromEvent(e); if (!k) return;
    e.preventDefault(); Sound.unlock(); input(k);
  });

  function shakeRow(msg) { const row = $('grid').children[G.r.g.length]; row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); Sound.wrong(); haptic(40); toast(msg); }
  function submit() {
    if (cur.length < G.len) return shakeRow('Недостаточно букв');
    if (!isValid(cur)) return shakeRow('Такого слова нет в словаре');
    if (st.set.hard && G.mode !== 'tut') { const v = hardViolation(cur, scores()); if (v) return shakeRow(v); }
    const w = cur, row = G.r.g.length, sc = score(w, G.r.w);
    G.r.g.push(w); cur = ''; busy = true; save();
    for (let j = 0; j < G.len; j++) {
      const t = $(`t${row}_${j}`);
      setTimeout(() => { t.classList.add('flip'); setTimeout(() => { t.textContent = w[j]; t.className = 't flip ' + sc[j]; Sound.flip(j, sc[j]); }, 210); }, j * 230);
    }
    setTimeout(() => { busy = false; paint(); renderKb(); after(w, sc, row); }, G.len * 230 + 300);
  }
  function after(w, sc, row) {
    tutEvent('submit');
    if (w === G.r.w) return finish(true, row);
    if (G.r.g.length >= rowsOf()) {
      if (!G.r.extra && adsOk() && G.mode !== 'tut' && Platform.ads.rewardedAvailable()) return offerExtra();
      return finish(false);
    }
    gp();
  }
  function offerExtra() {
    modal(`<h2>Почти!</h2><p style="text-align:center">Посмотрите рекламу и получите <b>ещё одну попытку</b>.</p>
      <button class="big gold" id="xAd">🎬 Ещё попытка</button><button class="big" id="xNo">Показать слово</button>`, { noClose: true });
    $('xAd').onclick = async () => { closeModal(); const ok = await withAd(() => Platform.ads.showRewarded()); if (ok) { G.r.extra = true; save(); render(); updUI(); toast('Седьмая попытка!'); gp(); } else { toast('Реклама недоступна'); finish(false); } };
    $('xNo').onclick = () => { closeModal(); finish(false); };
  }
  function finish(won, row) {
    const r = G.r; r.done = true; r.won = won; save();
    if (G.mode !== 'tut') {
      const s = stat(G.mode === 'daily' ? 'daily' : 'free', G.len); s.p++;
      if (won) { s.w++; s.dist[r.g.length - 1]++; st.wins++; } else s.dist[7]++;
      if (G.mode === 'daily') {
        const cont = s.lastDay === r.day - 1;
        s.cur = won ? (cont ? s.cur + 1 : 1) : 0; s.lastDay = won ? r.day : s.lastDay;
      } else s.cur = won ? s.cur + 1 : 0;
      s.max = Math.max(s.max, s.cur); st.rounds++;
      save();
      if (Platform.leaderboard.available) Platform.leaderboard.submit('wins', st.wins);
      if (G.mode === 'daily' && window.LB) LB.record(r.day, G.len, r.g, r.extra);
      try { if (window.ym && window.YM_ID) ym(window.YM_ID, 'reachGoal', won ? 'win' : 'lose'); } catch (e) {}
    }
    gp(); updUI();
    if (won) { const rw = $('grid').children[row]; rw.classList.add('dance'); Sound.win(); confetti(); haptic(30); }
    else Sound.lose();
    setTimeout(() => showResult(), won ? 1300 : 900);
  }

  /* ---------- result + word card ---------- */
  function cardHtml(w) {
    const c = CARDS[w];
    let h = `<div class="cardW"><div class="tiles">${w.split('').map(ch => `<div class="t c">${esc(ch)}</div>`).join('')}</div>${c && c.s ? `<div class="str">${esc(c.s)}${c.g ? ' · ' + esc(c.g) : ''}</div>` : ''}</div>`;
    if (c) {
      c.m.forEach((hom, hi) => {
        if (c.m.length > 1) h += `<div class="sense"><span class="num">${['I', 'II', 'III'][hi]}</span></div>`;
        hom.forEach(s => {
          h += `<div class="sense">${hom.length > 1 ? `<span class="num">${esc(String(s.n).replace(/\)$/, ''))}${String(s.n).includes(')') ? ')' : '.'}</span>` : ''}${s.l ? `<span class="lab">${esc(s.l)}</span> ` : ''}${esc(s.d)}</div>`;
          (s.e || []).forEach(e => { h += `<div class="cex"><i>${esc(e[0])}</i>${e[1] ? `<span>${esc(e[1])}</span>` : ''}${e[2] ? `<small>${esc(e[2])}</small>` : ''}</div>`; });
        });
      });
      const src = c.src === 'vu2003' ? 'Васильев В.М., Учаев З.В. «Марийско-русский словарь» (2003)' : '«Марий йылме мутер» / «Словарь марийского языка» в 10 т. (МарНИИЯЛИ, 1990–2005), ' + (Platform.links ? 'dict.fu-lab.ru' : 'Fu-Lab');
      h += `<div class="csrc">Источник: ${src}</div>`;
    } else h += `<div class="sense">${esc(GLOSS[w] || 'Перевод пока не найден')}</div>`;
    return h;
  }
  function showResult() {
    const r = G.r, n = r.g.length;
    let head = r.won ? `<div class="result">🎉 Сеҥышыч! ${n}/${rowsOf()}</div>` : `<div class="result">Ой, сеҥен отыл…</div>`;
    let btns = '';
    if (G.mode === 'tut') btns = `<button class="big red" id="rOk">Дальше</button>`;
    else {
      btns = `<button class="big blue" id="rShare" style="background:linear-gradient(180deg,#4a8cf0,#2c62c9);color:#fff">📤 Поделиться результатом</button>`;
      btns += G.mode === 'daily' ? `<div class="cnt" id="cnt"></div>${window.LB ? `<button class="big" id="rLb">🏆 ${LB.name ? 'Таблица лидеров' : 'Попасть в таблицу лидеров'}</button>` : ''}<button class="big gold" id="rFree">♾️ Играть в практику</button>` : `<button class="big gold" id="rNext">Новое слово ›</button>`;
      btns += `<button class="big" id="rOk">Закрыть</button>`;
    }
    modal(head + cardHtml(r.w) + btns, { onClose: () => tutEvent('cardClosed') });
    const b = id => $(id) && ($(id).onclick = fnMap[id]);
    const fnMap = { rOk: closeModal, rShare: share, rNext: () => { closeModal(); next(); }, rFree: () => { closeModal(); start('free', G.len); }, rLb: () => { closeModal(); openLeaders('day', G.len); } };
    Object.keys(fnMap).forEach(b);
    if ($('cnt')) countdown();
  }
  function countdown() {
    const el = $('cnt'); if (!el) return;
    const ms = (mskDay() + 1) * 864e5 - (Date.now() + 3 * 3600e3), s = Math.max(0, Math.floor(ms / 1000));
    el.textContent = `Следующее слово дня через ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    setTimeout(countdown, 1000);
  }
  async function next() {
    if (G.mode === 'tut') return;
    if (G.mode === 'free') { G.r.consumed = true; await maybeInterstitial(); st.free[G.len] = newFree(G.len); start('free', G.len); }
  }
  function shareText() {
    const r = G.r, hc = st.set.hc, E = { c: hc ? '🟧' : '🟩', p: hc ? '🟦' : '🟨', a: '⬛' };
    const title = G.mode === 'daily' ? `Марий мут · задача дня №${dailyNo(r.day)} · ${G.len} ${plural(G.len)}` : `Марий мут · ${G.len} ${plural(G.len)}`;
    let t = `${title}\n${r.won ? r.g.length : 'X'}/${rowsOf()}${st.set.hard ? '*' : ''}\n` + scores().map(([, s]) => s.split('').map(x => E[x]).join('')).join('\n');
    if (Platform.links && Platform.shareUrl) {
      if (G.mode === 'daily') t += '\n' + Platform.shareUrl;
      else { t += `\nУгадаешь моё слово? ` + Platform.shareUrl + '?w=' + encodeWord(r.w); }
    }
    return t;
  }
  function encodeWord(w) { return btoa(unescape(encodeURIComponent(w))).replace(/=+$/, ''); }
  function decodeWord(s) { try { return decodeURIComponent(escape(atob(s))).toLowerCase(); } catch (e) { return null; } }
  async function share() {
    const t = shareText(); window.__lastShare = t;
    if (navigator.share && Platform.name !== 'yandex') { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    if (Platform.name === 'android') { Platform.share(t); return; }
    try { await navigator.clipboard.writeText(t); toast('Результат скопирован'); } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Результат скопирован'); } catch (e2) {} ta.remove();
    }
  }

  /* ---------- ads ---------- */
  function adsOk() { return !!st.tut.done; }
  function gp() {
    const on = !!(G && !G.r.done && $('modal').hidden && !adShowing && !tutVisible() && !document.hidden);
    if (on !== gp.last) { gp.last = on; on ? Platform.gameplay.start() : Platform.gameplay.stop(); }
  }
  async function withAd(fn) { adShowing = true; gp(); try { return await fn(); } finally { adShowing = false; lastAd = Date.now(); gp(); } }
  function updBanner() { if (adsOk() && Platform.ads.bannerAvailable()) Platform.ads.showBanner(); else Platform.ads.hideBanner(); }
  async function maybeInterstitial() {
    if (!adsOk() || !Platform.ads.interstitialAvailable()) return;
    if (st.rounds % 3 !== 0 || Date.now() - lastAd < 150e3) return;
    await withAd(() => Platform.ads.showInterstitial());
  }
  async function hint() {
    const r = G.r; const known = new Set(r.hints); scores().forEach(([w, s]) => { for (let i = 0; i < s.length; i++) if (s[i] === 'c') known.add(i); });
    const free = []; for (let i = 0; i < G.len; i++) if (!known.has(i)) free.push(i);
    if (!free.length) return toast('Все буквы уже открыты');
    const ok = await withAd(() => Platform.ads.showRewarded());
    if (!ok) return toast('Реклама недоступна');
    r.hints.push(free[Math.floor(Math.random() * free.length)]); save(); paint(); renderKb(); updUI(); toast('Буква открыта');
  }
  $('bHint').onclick = () => { if (!adsOk()) return; Sound.click(); hint(); };
  $('bNext').onclick = () => { Sound.click(); next(); };
  $('bShare').onclick = () => { Sound.click(); share(); };
  $('bCardAgain').onclick = () => { Sound.click(); showResult(); };

  /* ---------- modals ---------- */
  let onModalClose = null;
  function modal(html, o) { o = o || {}; $('sheet').innerHTML = (o.noClose ? '' : '<button class="x" data-close>✕</button>') + html; $('modal').hidden = false; $('sheet').scrollTop = 0; onModalClose = o.onClose || null; gp(); }
  function closeModal() { if ($('modal').hidden) return; $('modal').hidden = true; const f = onModalClose; onModalClose = null; gp(); if (f) f(); }
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal' && $('sheet').querySelector('[data-close]') || e.target.closest('[data-close]')) { Sound.click(); closeModal(); } });

  function openLen() {
    modal(`<h2>Сколько букв?</h2><div class="lens">${LENS.map(n => `<button data-len="${n}" class="${n === st.len ? 'on' : ''}">${n}<small>${W[n].a.length} слов</small></button>`).join('')}</div>`);
    $('sheet').querySelectorAll('[data-len]').forEach(b => b.onclick = () => { Sound.click(); closeModal(); start(st.mode, +b.dataset.len); });
  }
  function openRules() {
    const ex = (w, i, cls) => `<div class="ex">${w.split('').map((c, j) => `<div class="t ${j === i ? cls : ''}">${c}</div>`).join('')}</div>`;
    modal(`<h2>Кузе модаш? Как играть</h2>
      <p>Угадайте <b>марийское слово</b> за 6 попыток. Каждая попытка должна быть настоящим словом из словаря. После ввода клетки окрасятся:</p>
      ${ex('кече', 0, 'c')}<p><b>К</b> есть в слове и стоит на своём месте.</p>
      ${ex('шудо', 1, 'p')}<p><b>У</b> есть в слове, но в другом месте.</p>
      ${ex('пасу', 2, 'a')}<p><b>С</b> в слове нет.</p>
      <p>☀️ <b>Задача дня</b> — одно слово для всех на день (по московскому времени) для каждой длины. ♾️ <b>Практика</b> — сколько угодно слов. Длина слова — от 3 до 8 букв: начните с 3, это проще всего.</p>
      <p>После раунда открывается карточка слова с переводом и примерами из словаря.</p>
      <p>⌨️ С клавиатуры компьютера: русская раскладка (или латинская по позициям ЙЦУКЕН), <b>1–5</b> = Ӓ Ӧ Ӱ Ӹ Ҥ (подходит и марийская раскладка, и буквы ä ö ü), Enter — проверить, Backspace — стереть.</p>
      <button class="big" id="rTut">🎓 Пройти обучение заново</button><button class="big red" data-close>Тӱҥалаш! Играть</button>`);
    $('rTut').onclick = () => { closeModal(); tutReplay(); };
  }
  function openStats() {
    const mode = G.mode === 'free' ? 'free' : 'daily', s = stat(mode, G.len), mx = Math.max(1, ...s.dist);
    const rowsHtml = [1, 2, 3, 4, 5, 6, 7].map(i => `<div><span style="width:14px">${i}</span><i style="width:${Math.max(7, 100 * s.dist[i - 1] / mx)}%" class="${G.r.done && G.r.won && G.r.g.length === i ? 'cur' : ''}">${s.dist[i - 1]}</i></div>`).join('');
    modal(`<h2>Статистика</h2><p style="text-align:center;margin-top:-4px;color:var(--mute);font-weight:700">${mode === 'daily' ? 'Задача дня' : 'Практика'} · ${G.len} ${plural(G.len)}</p>
      <div class="statn"><div><b>${s.p}</b><small>сыграно</small></div><div><b>${s.p ? Math.round(100 * s.w / s.p) : 0}%</b><small>побед</small></div><div><b>${s.cur}</b><small>серия</small></div><div><b>${s.max}</b><small>лучшая серия</small></div></div>
      <div class="dist">${rowsHtml}</div><div id="lb"></div><p style="text-align:center;color:var(--mute);font-size:13px">Всего побед: <b>${st.wins}</b></p>`);
    if (Platform.leaderboard.available) Platform.leaderboard.top('wins').then(es => { if (!es || !es.length || !$('lb')) return; $('lb').innerHTML = '<h3 style="text-align:center;margin:12px 0 4px">Лучшие игроки</h3>' + es.slice(0, 5).map(e => `<div class="setrow"><span>${e.rank}. ${esc((e.player && e.player.publicName) || 'Игрок')}</span><b>🏆 ${e.score}</b></div>`).join(''); });
  }
  /* ---------- common leaderboard (js/lb.js) ---------- */
  let lbView = { tab: 'day', len: 3 };
  function openLeaders(tab, len) {
    if (!window.LB) return;
    lbView = { tab: tab || lbView.tab, len: len || (G ? G.len : st.len) };
    modal(`<h2>🏆 Лидеры</h2>
      <div class="lbTabs" id="lbTabs">${[['day', '☀️ Сегодня'], ['wins', '🏆 Победы'], ['streaks', '🔥 Серии']].map(([k, t]) => `<button data-t="${k}">${t}</button>`).join('')}</div>
      <div class="lbLens" id="lbLens">${LENS.map(n => `<button data-l="${n}">${n}</button>`).join('')}</div>
      <div id="lbNick"></div><div id="lbBody" class="lbBody"></div><div id="lbStatus" class="lbStatus"></div>`);
    $('lbTabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; Sound.click(); lbView.tab = b.dataset.t; lbLoad(); };
    $('lbLens').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; Sound.click(); lbView.len = +b.dataset.l; lbLoad(); };
    lbNick(); lbLoad();
  }
  function lbNick(edit) {
    const el = $('lbNick'); if (!el) return;
    if (LB.name && !edit) { el.innerHTML = `<div class="lbMe">Вы в таблице как <b>${esc(LB.name)}</b> <button id="lbEdit" aria-label="Сменить ник">✏️</button><button class="lbDel" id="lbDel">Удалить меня из таблицы</button></div>`; $('lbEdit').onclick = () => { Sound.click(); lbNick(true); };
      $('lbDel').onclick = async () => { if (!confirm('Удалить ваш ник и результаты из общей таблицы?')) return; const r = await LB.forget(); toast(r.ok ? 'Вы удалены из таблицы' : r.msg); if (r.ok) { lbNick(); lbLoad(); } }; return; }
    const pre = LB.name || (Platform.playerName ? Platform.playerName() : '') || '';
    el.innerHTML = `<div class="lbForm"><p>${LB.name ? 'Новый ник:' : 'Укажите ник, чтобы результаты <b>задачи дня</b> попали в общую таблицу (сайт, Android и Яндекс Игры).'}</p>
      <div class="lbRow"><input id="lbIn" maxlength="16" autocomplete="nickname" enterkeyhint="done" placeholder="Ваш ник" value="${esc(pre)}"><button class="act gold" id="lbSave">Сохранить</button></div>
      <small>2–16 символов. Ник и результаты хранятся на сервере PirogovLab и видны другим игрокам.</small><div id="lbErr" class="lbErr"></div></div>`;
    const go = async () => { const v = $('lbIn').value; $('lbSave').disabled = true; const r = await LB.setName(v); if (!$('lbNick')) return; $('lbSave') && ($('lbSave').disabled = false);
      if (r.ok) { toast('Ник сохранён'); lbNick(); lbLoad(); } else $('lbErr').textContent = r.msg; };
    $('lbSave').onclick = () => { Sound.click(); go(); };
    $('lbIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); };
  }
  async function lbLoad() {
    const v = lbView; if (!$('lbBody')) return;
    $('lbTabs').querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === v.tab));
    $('lbLens').hidden = v.tab !== 'day'; $('lbLens').querySelectorAll('[data-l]').forEach(b => b.classList.toggle('on', +b.dataset.l === v.len));
    $('lbBody').innerHTML = '<p class="lbEmpty">Загрузка…</p>';
    const { j, offline } = await LB.board(v.len);
    if (!$('lbBody') || lbView !== v) return;
    const pend = LB.pending;
    $('lbStatus').textContent = (offline ? (j ? `Нет связи — таблица от ${new Date(j.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. ` : 'Нет связи с сервером. ') : '') +
      (pend ? (LB.name ? `Результатов ждут отправки: ${pend}, отправятся сами.` : `Сыграно задач дня: ${pend} — укажите ник, и они попадут в таблицу.`) : '');
    if (!j) { $('lbBody').innerHTML = '<p class="lbEmpty">Таблица появится, когда будет связь.</p>'; return; }
    const sec = v.tab === 'day' ? j.daily : v.tab === 'wins' ? j.wins : j.streaks;
    const cell = e => v.tab === 'day' ? (e.w ? `<b class="ok">${e.g}/6</b>` : '<b class="no">✗</b>') : v.tab === 'wins' ? `<b>🏆 ${e.wins}</b>` : `<b>🔥 ${e.cur}</b><small>лучшая ${e.best}</small>`;
    const row = e => `<div class="lbR${e.me ? ' me' : ''}"><span class="rk">${e.r <= 3 ? ['🥇', '🥈', '🥉'][e.r - 1] : e.r}</span><span class="nm">${esc(e.n)}</span>${cell(e)}</div>`;
    const head = v.tab === 'day' ? `<div class="lbH">Задача дня №${j.no} · ${v.len} ${plural(v.len)} · игроков: ${sec.total}</div>` : v.tab === 'wins' ? '<div class="lbH">Победы в задачах дня за всё время</div>' : '<div class="lbH">Серия — дни подряд с победой в задаче дня</div>';
    let h = sec.top.length ? sec.top.map(row).join('') : `<p class="lbEmpty">${v.tab === 'day' ? 'Сегодня здесь ещё никого нет. Будьте первым!' : 'Пока пусто.'}</p>`;
    if (sec.me && sec.me.r > sec.top.length) h += '<div class="lbGap">…</div>' + row(sec.me);
    $('lbBody').innerHTML = head + h;
  }

  function openSettings() {
    const sw = (k, t, sub) => `<div class="setrow" data-set="${k}"><div>${t}${sub ? `<small>${sub}</small>` : ''}</div><button class="sw ${st.set[k] === true || st.set[k] === 'light' ? 'on' : ''}"></button></div>`;
    const priv = Platform.links ? '<a href="https://pirogovlab.ru/mari-wordle/privacy/" target="_blank" rel="noopener" style="color:inherit">Политика конфиденциальности</a>' : 'Политика конфиденциальности';
    modal(`<h2>Настройки</h2>${sw('theme', 'Светлая тема', 'выключите для тёмной темы')}${sw('hc', 'Высокий контраст', 'оранжевый и синий вместо зелёного и жёлтого')}${sw('hard', 'Сложный режим', 'открытые буквы нужно использовать в следующих попытках')}${sw('sound', 'Звук')}${sw('vib', 'Вибрация')}
      <button class="big" id="sRules">❓ Правила</button><button class="big" id="sTut">🎓 Как играть (обучение)</button><button class="big" id="sReset" style="color:var(--red)">Сбросить прогресс</button>
      <div class="csrc">Марий мут 1.0.0 · Разработал Михаил Пирогов, PirogovLab.<br>Словарь: «Марий йылме мутер» / «Словарь марийского языка» в 10 т. (МарНИИЯЛИ, 1990–2005); Васильев В.М., Учаев З.В. «Марийско-русский словарь» (2003); частотный словарь Зориной и др.; марийская Википедия.<br>${priv}</div>`);
    $('sheet').querySelectorAll('[data-set]').forEach(r => r.onclick = () => {
      const k = r.dataset.set; if (k === 'theme') st.set.theme = st.set.theme === 'light' ? 'dark' : 'light'; else st.set[k] = !st.set[k];
      if (k === 'hard' && G.r.g.length && !G.r.done) { st.set.hard = !st.set.hard; return toast('Сложный режим меняется только в начале раунда'); }
      save(); applySettings(); r.querySelector('.sw').classList.toggle('on'); Sound.click();
    });
    $('sRules').onclick = openRules;
    $('sReset').onclick = () => { if (!confirm('Сбросить статистику и сыгранные раунды?')) return; const keep = { set: st.set, tut: st.tut }; st = Object.assign(fresh(), keep); save(); closeModal(); start('daily', 3); toast('Прогресс сброшен'); }; $('sTut').onclick = () => { closeModal(); tutReplay(); };
  }
  function applySettings() {
    document.documentElement.dataset.theme = st.set.theme; document.documentElement.dataset.hc = st.set.hc ? 'on' : 'off';
    Sound.enabled = st.set.sound; $('bSound').textContent = st.set.sound ? '🔊' : '🔇';
    document.querySelector('meta[name=theme-color]').content = st.set.theme === 'light' ? '#fbf7f1' : '#18204a';
  }
  function haptic(ms) { if (st.set.vib) Platform.haptic(ms); }
  $('bMenu').onclick = () => { Sound.click(); openRules(); };
  $('bStats').onclick = () => { Sound.click(); openStats(); };
  $('bLeaders').onclick = () => { Sound.click(); openLeaders(); };
  if (!window.LB) $('bLeaders').hidden = true;
  $('bSettings').onclick = () => { Sound.click(); openSettings(); };
  $('bSound').onclick = () => { st.set.sound = !st.set.sound; save(); applySettings(); Sound.click(); };
  $('bLen').onclick = () => { if (G.mode === 'tut') return; Sound.click(); openLen(); };
  $('segMode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b || G.mode === 'tut') return; Sound.click(); start(b.dataset.mode, st.len); });

  /* ---------- confetti ---------- */
  function confetti() {
    const c = $('fx'), x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
    const cols = ['#d23a44', '#f8c94f', '#3fae5f', '#ffffff', '#4a8cf0'];
    const ps = Array.from({ length: 110 }, () => ({ x: innerWidth / 2, y: innerHeight * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 3, s: 4 + Math.random() * 5, c: cols[Math.floor(Math.random() * 5)], a: 1, r: Math.random() * 6 }));
    (function f() { x.clearRect(0, 0, c.width, c.height); let alive = 0; ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.a -= .011; p.r += .2; if (p.a > 0) { alive++; x.globalAlpha = p.a; x.fillStyle = p.c; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); } }); if (alive) requestAnimationFrame(f); else x.clearRect(0, 0, c.width, c.height); })();
  }

  /* ---------- interactive tutorial ---------- */
  const TUT = [
    { el: '#board', text: 'Угадайте <b>марийское слово</b> за 6 попыток. Начнём с тренировочного слова из 3 букв.', next: true },
    { el: '#kb', text: `Наберите на клавиатуре слово <b>${TUT_GUIDE.toUpperCase()}</b> (огонь). Марийские буквы Ӓ Ӧ Ӱ Ӹ Ҥ — в верхнем ряду.`, wait: 'typed' },
    { el: '#k_ENTER', text: 'Нажмите <b>ВВОД</b>, чтобы проверить слово.', wait: 'submit' },
    { el: '#grid .row:first-child', text: '🟩 <b>У</b> — есть в слове и на своём месте.<br>🟨 <b>Т</b> — есть в слове, но в другом месте.<br>⬛ <b>Л</b> — этой буквы нет. Клавиатура тоже окрашивается.', next: true },
    { el: '#bHint', text: '🎬 <b>Открыть букву</b> — подсказка за просмотр рекламы. А если 6 попыток кончатся, можно получить <b>седьмую</b>. Реклама появится только после обучения.', next: true, hint: true },
    { el: '#board', text: 'Теперь сами! Подсказка: загадано слово «<b>слово</b>». Набирайте слова и нажимайте ВВОД.', next: true, play: true },
    { el: null, wait: 'cardClosed' },
    { el: '#modes', text: '☀️ <b>Задача дня</b> — одно слово для всех на день. ♾️ <b>Практика</b> — сколько угодно слов.', next: true },
    { el: '#bLen', text: 'Здесь выбирается длина слова: от 3 до 8 букв.', next: true },
    { el: '#bLeaders', text: '🏆 <b>Лидеры</b> — общая таблица задачи дня, побед и серий. Чтобы попасть в неё, укажите ник.', next: true },
    { el: '#bStats', text: '📊 Статистика и серии побед. ⚙️ Рядом — настройки: тема, контраст, сложный режим, звук.', next: true, last: true },
  ];
  function tutActive() { return !st.tut.done; }
  function tutVisible() { return !$('tut').hidden; }
  function tutBlocks(k) {
    if (G.mode !== 'tut') return false;
    const s = st.tut.step;
    if (s === 1) { if (k === 'DEL' || k === 'ENTER') return true; if (k !== TUT_GUIDE[cur.length]) { toast(`Нажмите «${TUT_GUIDE[cur.length].toUpperCase()}»`); return true; } return false; }
    if (s === 2) return k !== 'ENTER';
    return s !== 5 && s !== 6;
  }
  function tutShow() {
    const s = TUT[st.tut.step]; if (!s) return tutFinish();
    $('bHint').hidden = s.hint ? false : !(adsOk() && G && !G.r.done && Platform.ads.rewardedAvailable());
    $('bHint').disabled = !!s.hint; fit();
    if (!s.text) { $('tut').hidden = true; gp(); return; }
    $('tut').hidden = false; $('tutText').innerHTML = s.text; $('tutNext').hidden = !s.next; $('tutNext').textContent = s.last ? 'Играть!' : 'Далее';
    tutPlace(); gp();
  }
  function tutPlace() {
    const s = TUT[st.tut.step]; if (!s || !s.el || $('tut').hidden) return;
    const el = document.querySelector(s.el); if (!el) return; const r = el.getBoundingClientRect(), p = 6, h = $('tutHole'), box = $('tutBox');
    Object.assign(h.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
    const bh = box.offsetHeight; let top = r.bottom + 14; if (top + bh > innerHeight - 8) top = Math.max(8, r.top - bh - 14);
    box.style.top = top + 'px';
  }
  function tutGo(i) { st.tut.step = i; save(); tutShow(); }
  function tutEvent(ev) {
    if (!tutActive() || !G || G.mode !== 'tut') return;
    const s = TUT[st.tut.step]; if (!s) return;
    if (ev === 'type' && s.wait === 'typed' && cur === TUT_GUIDE) tutGo(st.tut.step + 1);
    else if (ev === 'submit' && s.wait === 'submit') setTimeout(() => tutGo(st.tut.step + 1), 100);
    else if (ev === 'cardClosed' && st.tut.step >= 5) tutGo(7);
  }
  $('tutNext').onclick = () => { Sound.click(); const s = TUT[st.tut.step]; if (s.last) return tutFinish(); if (s.play) { tutGo(6); return; } tutGo(st.tut.step + 1); };
  $('tutSkip').onclick = () => { Sound.click(); tutFinish(); };
  function tutFinish() { st.tut = { done: true, step: 0 }; delete st.tutRound; $('tut').hidden = true; save(); updBanner(); if (G && G.mode === 'tut') start('daily', st.len); gp(); }
  function tutReplay() { st.tut = { done: false, step: 0 }; st.tutRound = null; save(); updBanner(); $('tut').hidden = false; start('tut'); tutShow(); }

  /* ---------- lifecycle ---------- */
  addEventListener('resize', () => { fit(); tutPlace(); });
  document.addEventListener('visibilitychange', gp);
  window.__appBack = function () { if (!$('modal').hidden) { closeModal(); return true; } return false; };

  (async function init() {
    applySettings();
    try { await Platform.init(); } catch (e) {}
    if (Platform.cloud.available) { try { const remote = await Platform.cloud.pull(); if (remote && remote.v === 1 && (remote.ts || 0) > (st.ts || 0)) { st = Object.assign(fresh(), remote); st.set = Object.assign(fresh().set, remote.set); Platform.storage.save(KEY, st); applySettings(); } } catch (e) {} }
    if (!Platform.links) { const b = $('brand'); b.textContent = 'PirogovLab · Михаил Пирогов'; }
    const m = /[?&]w=([^&]+)/.exec(location.search);
    if (tutActive()) { $('tut').hidden = false; start('tut'); tutShow(); }
    else if (m && Platform.links) { const w = decodeWord(decodeURIComponent(m[1])); if (w && isValid(w)) { st.free[w.length] = newFree(w.length, w); start('free', w.length); } else start(st.mode, st.len); try { history.replaceState({}, '', location.pathname); } catch (e) {} }
    else start(st.mode === 'tut' ? 'daily' : st.mode, st.len);
    updBanner();
    Platform.gameReady();
    Platform.onPause(() => Platform.audio.suspend('hidden'));
    Platform.onResume(() => Platform.audio.resume('hidden'));
  })();

  if (!window.RELEASE) window.mutTushto = { st: () => st, G: () => G, score, isValid, dailyWord, mskDay, dailyNo, hardViolation, keyFromEvent, input, shareText, tutStep: () => st.tut.step, DAY0, openLeaders };
})();
