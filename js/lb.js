/* Общая таблица лидеров «Марий мут» (web, Android, Яндекс Игры) -> https://pirogovlab.ru/api/mari-wordle/
 * Opt-in: nothing leaves the device until the player picks a nickname. Daily results are queued in localStorage and
 * retried (online event, every 2 min, on open), so offline play is fine. The server re-checks every result. */
(function () {
  'use strict';
  const API = window.LB_API || 'https://pirogovlab.ru/api/mari-wordle/';
  const K = 'mutTushto.lb';
  const hex = () => { const a = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };
  let s = null; try { s = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  if (!s || !/^[a-f0-9]{32}$/.test(s.pid || '') || !/^[a-f0-9]{32}$/.test(s.key || '')) s = { pid: hex(), key: hex(), name: null, q: [], cache: {} };
  s.q = s.q || []; s.cache = s.cache || {};
  const save = () => { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} };
  save();
  async function req(body, query) {
    const ctl = window.AbortController ? new AbortController() : null; const t = setTimeout(() => ctl && ctl.abort(), 8000);
    try {
      const r = await fetch(API + (query ? '?' + query : ''), body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal } : { signal: ctl && ctl.signal, cache: 'no-store' });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, j: j || {} };
    } catch (e) { return { status: 0, j: {} }; } finally { clearTimeout(t); }
  }
  let flushing = null, retryT = 0, backoff = 30e3;
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) {} });
  function flush() {   // returns the running flush, so callers can wait for queued results to land
    if (!s.name || !s.q.length) return Promise.resolve();
    if (!flushing) flushing = doFlush().finally(() => { flushing = null; });
    return flushing;
  }
  async function doFlush() {
    let netErr = false;
    {
      while (s.q.length) {
        const it = s.q[0];
        const { status, j } = await req({ a: 'submit', pid: s.pid, key: s.key, day: it.day, len: it.len, g: it.g, x: !!it.x });
        if (status === 200 || (status >= 400 && status < 500 && status !== 429 && j.err !== 'need_name')) { s.q.shift(); save(); continue; }  // done, or permanently invalid
        netErr = true; break;   // offline, 5xx, rate limit: keep and retry later
      }
    }
    clearTimeout(retryT);
    if (netErr) { retryT = setTimeout(flush, backoff); backoff = Math.min(backoff * 2, 10 * 60e3); } else backoff = 30e3;
    emit();
  }
  addEventListener('online', flush);
  setInterval(() => { if (!document.hidden && s.q.length) flush(); }, 120e3);
  window.LB = {
    get name() { return s.name; },
    get pending() { return s.q.length; },
    get pid() { return s.pid; },
    onChange(f) { listeners.push(f); },
    record(day, len, g, extra) {   // a finished daily round
      if (s.q.some(x => x.day === day && x.len === len) || (s.done || []).includes(day + ':' + len)) return;
      s.q.push({ day, len, g: g.slice(0, 7), x: !!extra }); if (s.q.length > 60) s.q.splice(0, s.q.length - 60);
      s.done = (s.done || []).concat(day + ':' + len).slice(-120); save(); flush();
    },
    async setName(name) {
      name = String(name || '').trim().replace(/\s+/g, ' ');
      const { status, j } = await req({ a: 'name', pid: s.pid, key: s.key, name });
      if (status === 200 && j.ok) { s.name = j.name; save(); await flush(); emit(); return { ok: true }; }
      return { ok: false, msg: j.msg || (status === 0 ? 'Нет связи с сервером. Попробуйте позже.' : status === 429 ? 'Слишком часто, попробуйте позже' : 'Не получилось сохранить ник') };
    },
    async forget() {   // delete my nickname and results on the server, start over with a new anonymous id
      const { status, j } = await req({ a: 'delete', pid: s.pid, key: s.key });
      if (status === 200 || status === 404) { s = { pid: hex(), key: hex(), name: null, q: [], cache: {}, done: s.done }; save(); emit(); return { ok: true }; }
      return { ok: false, msg: status === 0 ? 'Нет связи с сервером. Попробуйте позже.' : 'Не получилось удалить' };
    },
    async board(len) {
      await Promise.race([flush(), new Promise(r => setTimeout(r, 3000))]);
      const { status, j } = await req(null, 'a=board&len=' + len + '&pid=' + s.pid);
      if (status === 200 && j.ok) {
        if (j.me && j.me.n && j.me.n !== s.name) { s.name = j.me.n; }
        s.cache[len] = Object.assign(j, { at: Date.now() }); save(); return { j, offline: false };
      }
      return { j: s.cache[len] || null, offline: true };
    },
    flush,
  };
  flush();
})();
