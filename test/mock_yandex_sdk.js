// Minimal mock of the Yandex Games SDK for local tests (NOT shipped).
(function () {
  const log = []; window.__ya = { log, data: window.__yaPreset || null };
  const L = (...a) => log.push(a.join(' '));
  const handlers = {};
  const ysdk = {
    environment: { i18n: { lang: window.__yaLang || 'ru', tld: 'ru' } },
    features: { LoadingAPI: { ready: () => L('LoadingAPI.ready') }, GameplayAPI: { start: () => L('GameplayAPI.start'), stop: () => L('GameplayAPI.stop') } },
    on(e, f) { (handlers[e] = handlers[e] || []).push(f); L('on', e); }, off() {},
    _emit(e) { (handlers[e] || []).forEach(f => f()); },
    adv: {
      showRewardedVideo({ callbacks: c }) { L('adv.showRewardedVideo'); setTimeout(() => { c.onOpen && c.onOpen(); window.__ya.duringAd = { musicPaused: window.Sound && Sound.blocked }; setTimeout(() => { c.onRewarded && c.onRewarded(); c.onClose && c.onClose(); }, 300); }, 50); },
      showBannerAdv() { L('adv.showBannerAdv'); return Promise.resolve({ stickyAdvIsShowing: true }); },
      hideBannerAdv() { L('adv.hideBannerAdv'); return Promise.resolve({ stickyAdvIsShowing: false }); },
      getBannerAdvStatus() { return Promise.resolve({ stickyAdvIsShowing: false }); },
      showFullscreenAdv({ callbacks: c }) { L('adv.showFullscreenAdv'); setTimeout(() => { c.onOpen && c.onOpen(); window.__ya.duringFs = { musicPaused: window.Sound && Sound.blocked }; setTimeout(() => c.onClose && c.onClose(true), 300); }, 50); },
    },
    async getPlayer() { L('getPlayer'); return { getMode: () => 'lite', async getData() { return window.__ya.data ? { save: window.__ya.data } : {}; }, async setData(d) { L('player.setData'); window.__ya.data = d.save; } }; },
    async isAvailableMethod(m) { return false; },
    leaderboards: { async setScore() { L('lb.setScore'); }, async getEntries() { return { entries: [] }; } },
  };
  if (window.__yaNoBanner) { delete ysdk.adv.showBannerAdv; delete ysdk.adv.hideBannerAdv; }  // store screenshots: no banner at all
  window.YaGames = { init: () => { L('YaGames.init'); window.__ysdk = ysdk; return Promise.resolve(ysdk); } };
})();
