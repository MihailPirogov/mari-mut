package ru.pirogovlab.mariwordle;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Марий мут — Android shell. The HTML5 game is bundled in assets/www and served from
 * https://appassets.androidplatform.net/ (same-origin, so fetch()/WebAudio and localStorage work offline).
 * JS talks to this class through window.AndroidBridge (see js/adapters/android.js).
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    private WebView web;
    private Ads ads;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#18204A"));
        // game WebView on top, sticky ad banner below it (outside the game area, hidden until the game asks for it)
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#18204A"));
        col.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        FrameLayout bannerBox = new FrameLayout(this);
        bannerBox.setVisibility(View.GONE);
        col.addView(bannerBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        ads = new Ads(this, bannerBox);
        ads.init();
        // Android 15+ draws edge-to-edge: keep the game inside the safe area (status bar, nav bar, cutout)
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " MutTushtoApp/" + BuildConfig.VERSION_NAME);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                android.util.Log.d("MutTushto", m.messageLevel() + " " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..")) return notFound();
                try {
                    InputStream in = getAssets().open("www" + path);
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    String mime = mime(path);
                    return new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json") ? "utf-8" : null, 200, "OK", h, in);
                } catch (IOException e) {
                    return notFound();
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                // WebView renderer crashed or was killed for memory: rebuild the activity instead of crashing the app
                android.util.Log.w("MutTushto", "renderer gone, crash=" + detail.didCrash());
                if (web == view) { ((ViewGroup) view.getParent()).removeView(view); view.destroy(); web = null; }
                recreate();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) { android.util.Log.d("MutTushto", "page finished " + url); }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u.toString());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");

        // back button: let the game close modals / go to the home screen first
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl(START);
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
    }

    static String mime(String p) {
        String e = p.substring(p.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (e) {
            case "html": return "text/html";
            case "js": return "application/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "mp3": return "audio/mpeg";
            case "webp": return "image/webp";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "svg": return "image/svg+xml";
            case "woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }

    private void handleBack() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("!!(window.__appBack && window.__appBack())", v -> {
            if (!"true".equals(v)) finish();
        });
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { handleBack(); } // Android < 13

    @Override
    protected void onPause() {
        // silence music/sfx immediately (also covers the ad/visibility logic in JS)
        if (web != null) {
            web.evaluateJavascript("window.Platform && Platform.audio && Platform.audio.suspend('app')", null);
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.Platform && Platform.audio && Platform.audio.resume('app')", null);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (ads != null) { ads.destroy(); ads = null; }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    void openExternal(String url) {
        if (!(url.startsWith("https://") || url.startsWith("http://"))) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignored) {}
    }

    void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    static String jsStr(String s) { return "'" + s.replaceAll("[^A-Za-z0-9_]", "") + "'"; }

    /** window.AndroidBridge */
    static class Bridge {
        private final MainActivity a;
        Bridge(MainActivity a) { this.a = a; }

        @JavascriptInterface
        public void vibrate(int ms) {
            Vibrator v = (Vibrator) a.getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || ms <= 0) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.min(ms, 500), VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(Math.min(ms, 500));
        }

        @JavascriptInterface
        public void share(String text) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            a.runOnUiThread(() -> a.startActivity(Intent.createChooser(i, a.getString(R.string.share_title))));
        }

        @JavascriptInterface
        public void shareImage(String b64, String filename, String text) {
            try {
                File dir = new File(a.getCacheDir(), "share");
                if (!dir.exists() && !dir.mkdirs()) return;
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                File f = new File(dir, "mut-tunya-card.png");
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(b64, Base64.DEFAULT)); }
                Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + f.getName());
                Intent i = new Intent(Intent.ACTION_SEND).setType("image/png")
                        .putExtra(Intent.EXTRA_STREAM, uri).putExtra(Intent.EXTRA_TEXT, text)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                i.setClipData(ClipData.newRawUri("card", uri));
                a.runOnUiThread(() -> a.startActivity(Intent.createChooser(i, a.getString(R.string.share_title))));
            } catch (Exception e) {
                share(text);
            }
        }

        @JavascriptInterface
        public void openUrl(String url) { a.runOnUiThread(() -> a.openExternal(url)); }

        // ---- Ads (Yandex Mobile Ads, see Ads.java). JS decides when; native only shows/loads. ----
        private String cb(String callback, String arg) { return "window[" + jsStr(callback) + "] && window[" + jsStr(callback) + "](" + arg + ")"; }

        @JavascriptInterface
        public boolean rewardedAvailable() { return a.ads != null && a.ads.rewardedAvailable(); }

        @JavascriptInterface
        public void showRewarded(String callback) {
            a.runOnUiThread(() -> { if (a.ads == null) { a.js(cb(callback, "false")); return; }
                a.ads.showRewarded(ok -> a.js(cb(callback, ok ? "true" : "false"))); });
        }

        @JavascriptInterface
        public boolean interstitialAvailable() { return a.ads != null && a.ads.interstitialAvailable(); }

        @JavascriptInterface
        public void showInterstitial(String callback) {
            a.runOnUiThread(() -> { if (a.ads == null) { a.js(cb(callback, "")); return; }
                a.ads.showInterstitial(ok -> a.js(cb(callback, ""))); });
        }

        @JavascriptInterface
        public boolean bannerAvailable() { return a.ads != null; }

        @JavascriptInterface
        public void showBanner() { a.runOnUiThread(() -> { if (a.ads != null) a.ads.showBanner(); }); }

        @JavascriptInterface
        public void hideBanner() { a.runOnUiThread(() -> { if (a.ads != null) a.ads.hideBanner(); }); }
    }
}
