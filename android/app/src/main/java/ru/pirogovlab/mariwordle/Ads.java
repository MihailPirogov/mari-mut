package ru.pirogovlab.mariwordle;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;

import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.YandexAds;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

/**
 * Yandex Mobile Ads SDK 8 wrapper: sticky banner (native view below the WebView, outside the game area),
 * interstitial and rewarded ads, preloaded and reloaded after each show.
 * Ad unit IDs: res/values/ads.xml (real units), demo units when R.bool.ads_demo is true (debug builds / -PadsDemo=true).
 * WHEN ads are shown is decided by the game (js/app.js): none before the tutorial ends, fullscreen only between levels,
 * rewarded only on the player's tap. All SDK calls happen on the main thread.
 */
final class Ads {
    interface Done { void run(boolean ok); }
    private static final String TAG = "MutTushtoAds";
    private static final int MAX_RETRIES = 5;
    private final MainActivity a;
    private final FrameLayout box;
    private final String bannerId, interId, rewId;
    private final Handler h = new Handler(Looper.getMainLooper());
    private InterstitialAdLoader iLoader;
    private RewardedAdLoader rLoader;
    private volatile InterstitialAd inter;
    private volatile RewardedAd rew;
    private BannerAdView banner;
    private boolean ready, bannerWanted, bannerLoaded, iLoading, rLoading, showing;
    private int iFails, rFails, bFails;

    Ads(MainActivity a, FrameLayout box) {
        this.a = a; this.box = box;
        boolean demo = a.getResources().getBoolean(R.bool.ads_demo);
        bannerId = a.getString(demo ? R.string.ad_banner_demo_id : R.string.ad_banner_id);
        interId = a.getString(demo ? R.string.ad_interstitial_demo_id : R.string.ad_interstitial_id);
        rewId = a.getString(demo ? R.string.ad_rewarded_demo_id : R.string.ad_rewarded_id);
        Log.i(TAG, "ad units " + (demo ? "DEMO" : "real") + ": " + bannerId + " / " + interId + " / " + rewId);
    }

    void init() {
        iLoader = new InterstitialAdLoader(a);
        rLoader = new RewardedAdLoader(a);
        YandexAds.setAgeRestricted(a.getResources().getBoolean(R.bool.ads_age_restricted));
        YandexAds.initialize(a, () -> {
            ready = true;
            loadInter(); loadRew();
            if (bannerWanted) showBanner();
        });
    }

    private void retry(Runnable r, int fails) {
        if (fails > MAX_RETRIES) return;  // SDK guidance: limit reload attempts after onAdFailedToLoad
        h.postDelayed(r, 20000L * fails);
    }

    // ---------------- interstitial ----------------
    private void loadInter() {
        if (!ready || inter != null || iLoading) return;
        iLoading = true;
        iLoader.loadAd(new AdRequest.Builder(interId).build(), new InterstitialAdLoadListener() {
            @Override public void onAdLoaded(InterstitialAd ad) { iLoading = false; inter = ad; iFails = 0; }
            @Override public void onAdFailedToLoad(AdRequestError e) { iLoading = false; Log.w(TAG, "interstitial: " + e); retry(Ads.this::loadInter, ++iFails); }
        });
    }

    boolean interstitialAvailable() { return inter != null; }

    void showInterstitial(Done done) {
        InterstitialAd ad = inter;
        if (ad == null || showing) { done.run(false); loadInter(); return; }
        inter = null; showing = true;
        final boolean[] fin = {false};
        final Runnable end = () -> { if (fin[0]) return; fin[0] = true; showing = false; ad.setAdEventListener(null); done.run(true); loadInter(); };
        ad.setAdEventListener(new InterstitialAdEventListener() {
            @Override public void onAdShown() {}
            @Override public void onAdFailedToShow(AdError e) { Log.w(TAG, "interstitial show: " + e.getDescription()); end.run(); }
            @Override public void onAdDismissed() { end.run(); }
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData d) {}
        });
        ad.show(a);
    }

    // ---------------- rewarded ----------------
    private void loadRew() {
        if (!ready || rew != null || rLoading) return;
        rLoading = true;
        rLoader.loadAd(new AdRequest.Builder(rewId).build(), new RewardedAdLoadListener() {
            @Override public void onAdLoaded(RewardedAd ad) { rLoading = false; rew = ad; rFails = 0; }
            @Override public void onAdFailedToLoad(AdRequestError e) { rLoading = false; Log.w(TAG, "rewarded: " + e); retry(Ads.this::loadRew, ++rFails); }
        });
    }

    boolean rewardedAvailable() { return rew != null; }

    void showRewarded(Done done) {
        RewardedAd ad = rew;
        if (ad == null || showing) { done.run(false); loadRew(); return; }
        rew = null; showing = true;
        final boolean[] got = {false}, fin = {false};
        final Runnable end = () -> { if (fin[0]) return; fin[0] = true; showing = false; ad.setAdEventListener(null); done.run(got[0]); loadRew(); };
        ad.setAdEventListener(new RewardedAdEventListener() {
            @Override public void onAdShown() {}
            @Override public void onAdFailedToShow(AdError e) { Log.w(TAG, "rewarded show: " + e.getDescription()); end.run(); }
            @Override public void onAdDismissed() { end.run(); }
            @Override public void onAdClicked() {}
            @Override public void onAdImpression(ImpressionData d) {}
            @Override public void onRewarded(Reward r) { got[0] = true; }
        });
        ad.show(a);
    }

    // ---------------- sticky banner ----------------
    void showBanner() {
        bannerWanted = true;
        if (!ready) return;
        if (banner == null) {
            banner = new BannerAdView(a);
            float d = a.getResources().getDisplayMetrics().density;
            int wDp = Math.round(a.getResources().getDisplayMetrics().widthPixels / d);
            banner.setAdSize(BannerAdSize.sticky(a, wDp));
            banner.setBannerAdEventListener(new BannerAdEventListener() {
                @Override public void onAdLoaded() { bannerLoaded = true; bFails = 0; box.setVisibility(bannerWanted ? View.VISIBLE : View.GONE); }
                @Override public void onAdFailedToLoad(AdRequestError e) {
                    Log.w(TAG, "banner: " + e);
                    if (!bannerLoaded) box.setVisibility(View.GONE);
                    retry(() -> { if (banner != null) banner.loadAd(new AdRequest.Builder(bannerId).build()); }, ++bFails);
                }
                @Override public void onAdClicked() {}
                @Override public void onImpression(ImpressionData d) {}
            });
            box.addView(banner, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT));
            banner.loadAd(new AdRequest.Builder(bannerId).build());
        } else if (bannerLoaded) box.setVisibility(View.VISIBLE);
    }

    void hideBanner() { bannerWanted = false; box.setVisibility(View.GONE); }

    void destroy() {
        h.removeCallbacksAndMessages(null);
        if (banner != null) { banner.destroy(); banner = null; }
    }
}
