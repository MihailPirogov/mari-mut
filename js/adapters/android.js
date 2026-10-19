/* Android WebView adapter. Loaded only in the Android build (tools/build_release.py android).
 * The native shell (android/app/src/main/java/ru/pirogovlab/mariwordle/MainActivity.java) injects window.AndroidBridge:
 *   vibrate(ms), share(text), shareImage(base64png, filename, text), openUrl(url),
 *   rewardedAvailable() -> bool, showRewarded(callbackName) -> native later calls window[callbackName](true|false),
 *   interstitialAvailable() -> bool, showInterstitial(callbackName) -> native calls window[callbackName]()
 *   bannerAvailable() -> bool, showBanner(), hideBanner()  (native BannerAdView below the WebView, outside the game area)
 * Ads: Yandex Mobile Ads SDK in MainActivity; ad unit IDs live in android/app/src/main/res/values/ads.xml.
 * Lifecycle: native onPause/onResume call Platform.audio.suspend('app') / resume('app'); back button calls window.__appBack().
 */
(function () {
  const B = window.AndroidBridge; if (!B) return;
  let n = 0;
  const cb = fn => { const id = '__ab' + (++n) + '_' + Date.now(); window[id] = v => { delete window[id]; fn(v); }; return id; };
  Platform.use({
    name: 'android',
    links: true,
    haptic(ms) { try { B.vibrate(ms | 0); } catch (e) {} },
    share(text) { try { B.share(String(text)); } catch (e) {} return Promise.resolve(); },
    async shareImage({ blob, filename, title, text, url }) {
      try {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
        B.shareImage(b64, filename, url ? text + '\n' + url : text);
        return 'shared';
      } catch (e) { return 'cancelled'; }
    },
    ads: {
      rewardedAvailable() { try { return !!B.rewardedAvailable(); } catch (e) { return false; } },
      showRewarded() {
        return new Promise(res => {
          Platform.audio.suspend('ad');
          const id = cb(ok => { Platform.audio.resume('ad'); res(!!ok); });
          try { B.showRewarded(id); } catch (e) { window[id](false); }
        });
      },
      bannerAvailable() { try { return !!B.bannerAvailable(); } catch (e) { return false; } },
      showBanner() { try { B.showBanner(); } catch (e) {} },
      hideBanner() { try { B.hideBanner(); } catch (e) {} },
      interstitialAvailable() { try { return !!B.interstitialAvailable(); } catch (e) { return false; } },
      showInterstitial() {
        return new Promise(res => {
          Platform.audio.suspend('ad');
          const id = cb(() => { Platform.audio.resume('ad'); res(); });
          try { B.showInterstitial(id); } catch (e) { window[id](); }
        });
      },
    },
  });
  // external links open in the system browser
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="http"]');
    if (a) { e.preventDefault(); try { B.openUrl(a.href); } catch (err) {} }
  }, true);
})();
