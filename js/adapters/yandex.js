/* Yandex Games adapter. Loaded only in the Yandex build (tools/build_release.py yandex):
 *   <script src="/sdk.js"></script> <script src="js/platform.js"></script> <script src="js/adapters/yandex.js"></script> ... js/app.js
 * - LoadingAPI.ready() when the home screen is interactive (Platform.gameReady)
 * - GameplayAPI.start/stop from the app's gameplay markup (game screen, no modal/ad, tab visible)
 * - audio + gameplay paused during fullscreen/rewarded ads and on game_api_pause
 * - cloud save in player data (works for guests too; synced across devices once logged in)
 * - leaderboard 'wins' (must be created in the console; silently ignored otherwise)
 * - no external links (rule 8.4.2): Platform.links = false, no URL on shared cards
 * - ads: fullscreen between levels, rewarded on tap only, sticky banner via API; none before the tutorial is finished
 */
(function () {
  if (!window.YaGames) return;
  let ysdk = null, player = null;
  const audioOff = r => { try { Platform.audio.suspend(r); } catch (e) {} };
  const audioOn = r => { try { Platform.audio.resume(r); } catch (e) {} };
  Platform.use({
    name: 'yandex',
    links: false,
    shareUrl: null,
    async init() {
      ysdk = await YaGames.init();
      window.ysdk = ysdk;
      try {
        ysdk.on('game_api_pause', () => audioOff('yapause'));
        ysdk.on('game_api_resume', () => audioOn('yapause'));
      } catch (e) {}
      try { player = await ysdk.getPlayer(); } catch (e) { player = null; }
    },
    gameReady() { try { ysdk.features.LoadingAPI.ready(); } catch (e) {} },
    gameplay: {
      start() { try { ysdk.features.GameplayAPI.start(); } catch (e) {} },
      stop() { try { ysdk.features.GameplayAPI.stop(); } catch (e) {} },
    },
    lang() { try { return ysdk.environment.i18n.lang; } catch (e) { return 'ru'; } },
    // optional: suggest the Yandex player name as nickname for the common leaderboard (the player can change it; guests get '')
    playerName() { try { return (player && player.getMode && player.getMode() !== 'lite' && player.getName()) || ''; } catch (e) { return ''; } },
    cloud: {
      available: true,
      async pull() { try { return player ? ((await player.getData(['save'])) || {}).save || null : null; } catch (e) { return null; } },
      async push(data) { try { if (player) await player.setData({ save: data }, false); } catch (e) {} },
    },
    ads: {
      rewardedAvailable() { return !!ysdk; },
      showRewarded() {
        return new Promise(res => {
          if (!ysdk) return res(false);
          let ok = false, done = false; const fin = v => { if (done) return; done = true; audioOn('ad'); res(v); };
          audioOff('ad');
          try {
            ysdk.adv.showRewardedVideo({ callbacks: {
              onOpen: () => audioOff('ad'),
              onRewarded: () => { ok = true; },
              onClose: () => fin(ok),
              onError: () => fin(false),
            } });
          } catch (e) { fin(false); }
        });
      },
      // sticky banner: enable it in the console (Реклама → Sticky-баннеры) AND switch on «Использовать API для показа sticky-баннера»,
      // so it is not shown before the tutorial ends; the platform draws it outside the game iframe
      bannerAvailable() { return !!(ysdk && ysdk.adv && typeof ysdk.adv.showBannerAdv === 'function'); },
      showBanner() { try { Promise.resolve(ysdk.adv.showBannerAdv()).catch(() => {}); } catch (e) {} },
      hideBanner() { try { Promise.resolve(ysdk.adv.hideBannerAdv()).catch(() => {}); } catch (e) {} },
      interstitialAvailable() { return !!ysdk; },
      showInterstitial() {
        return new Promise(res => {
          if (!ysdk) return res();
          let done = false; const fin = () => { if (done) return; done = true; audioOn('ad'); res(); };
          audioOff('ad');
          try {
            ysdk.adv.showFullscreenAdv({ callbacks: { onOpen: () => audioOff('ad'), onClose: () => fin(), onError: () => fin(), onOffline: () => fin() } });
          } catch (e) { fin(); }
        });
      },
    },
    leaderboard: {
      available: true,
      async submit(name, score) {
        try { if (ysdk && await ysdk.isAvailableMethod('leaderboards.setScore')) await ysdk.leaderboards.setScore(name, score); } catch (e) {}
      },
      async top(name) { try { return (await ysdk.leaderboards.getEntries(name, { quantityTop: 10 })).entries; } catch (e) { return []; } },
    },
  });
})();
