/* Platform adapter layer. The game only talks to window.Platform.
 * Default = offline web (localStorage, no ads). Adapters for Yandex Games / Android WebView live in js/adapters/
 * and register themselves via Platform.use(adapter) before the game starts (see README "Platforms").
 */
(function () {
  'use strict';
  const LS = {
    load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
    save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} },
  };
  const base = {
    name: 'web',
    async init() {},
    gameReady() {},                       // call when first screen is interactive (Yandex: ysdk.features.LoadingAPI.ready())
    gameplay: { start() {}, stop() {} },  // gameplay markup (Yandex GameplayAPI); app calls on change only
    links: true,                          // external links allowed in UI (Yandex Games: false — rule 8.4.2)
    shareUrl: 'https://pirogovlab.ru/mari-wordle/',  // URL put on shared word cards; null = none
    storage: LS,                          // sync local save; cloud sync is separate
    cloud: {                              // optional cloud save (Yandex player.setData / Play Games Saved Games)
      available: false,
      async pull() { return null; },
      async push(data) {},
    },
    ads: {                                // rewarded video only gives extra hints; never required to progress
      rewardedAvailable() { return false; },
      async showRewarded() { return false; },  // resolves true if reward earned
      interstitialAvailable() { return false; },  // fullscreen ads between levels (Yandex); off on plain web
      async showInterstitial() {},
      bannerAvailable() { return false; },        // sticky banner outside the game area (Yandex console / native Android view)
      showBanner() {},
      hideBanner() {},
    },
    leaderboard: { available: false, async submit(name, score) {}, async top(name) { return []; } },
    haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} },
    lang() { return (navigator.language || 'ru').slice(0, 2); },
    playerName() { return ''; },          // optional nickname suggestion for the common leaderboard (Yandex: player name)
    onPause(cb) { document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); }); },
    onResume(cb) { document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); }); },
    // audio interruptions (ads, system): adapters call Platform.audio.suspend('ad') / resume('ad'); music & sfx listen via on()
    audio: (function () { const ls = []; return { on(fn) { ls.push(fn); }, suspend(r) { ls.forEach(f => f(false, r || 'platform')); }, resume(r) { ls.forEach(f => f(true, r || 'platform')); } }; })(),
    share(text) { if (navigator.share) return navigator.share({ text }).catch(() => {}); return Promise.resolve(); },
    // share an image (word card). Returns 'shared' | 'downloaded' | 'cancelled'. Adapters (Yandex/Android) may override.
    async shareImage({ blob, filename, title, text, url }) {
      try {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title, text: url ? text + '\n' + url : text }); return 'shared';
        }
      } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      try { await navigator.clipboard.writeText(url ? text + '\n' + url : text); } catch (e) {}
      return 'downloaded';
    },
  };
  const Platform = Object.assign({}, base, {
    use(adapter) {   // shallow-merge an adapter over the defaults
      for (const k of Object.keys(adapter)) {
        if (adapter[k] && typeof adapter[k] === 'object' && !Array.isArray(adapter[k]) && base[k] && typeof base[k] === 'object')
          Platform[k] = Object.assign({}, base[k], adapter[k]);
        else Platform[k] = adapter[k];
      }
      return Platform;
    },
  });
  window.Platform = Platform;

  /* Ad SIMULATION for the plain web test build only: open the page with ?adsim=1.
   * Never active in release builds (window.RELEASE) — there is no ad network on the plain web. */
  if (!window.RELEASE && /[?&]adsim=1\b/.test(location.search)) {
    const log = window.__adsim = [];
    const sim = (kind, reward) => new Promise(res => {
      log.push(kind); Platform.audio.suspend('ad');
      const d = document.createElement('div'); d.className = 'adSim';
      d.innerHTML = '<div><b>Тестовая реклама</b><small>' + (reward ? 'с вознаграждением' : 'полноэкранная') + ' · симуляция</small><button>✕</button></div>';
      document.body.appendChild(d);
      let done = false; const fin = ok => { if (done) return; done = true; d.remove(); Platform.audio.resume('ad'); res(ok); };
      d.querySelector('button').onclick = () => fin(!reward);  // closing a rewarded ad early = no reward
      setTimeout(() => fin(true), 1400);
    });
    Platform.use({ ads: {
      rewardedAvailable() { return true; }, showRewarded() { return sim('rewarded', true); },
      interstitialAvailable() { return true; }, async showInterstitial() { await sim('interstitial', false); },
      bannerAvailable() { return true; },
      showBanner() { log.push('banner+'); if (document.getElementById('adSimBanner')) return; const b = document.createElement('div'); b.id = 'adSimBanner'; b.textContent = 'Тестовый баннер (симуляция)'; document.body.appendChild(b); document.documentElement.classList.add('withBanner'); },
      hideBanner() { log.push('banner-'); const b = document.getElementById('adSimBanner'); if (b) b.remove(); document.documentElement.classList.remove('withBanner'); },
    } });
  }
})();
