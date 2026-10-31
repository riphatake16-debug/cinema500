package ir.cinema500.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public class MainActivity extends Activity {
    private static final String SITE_URL = "https://riphatake16-debug.github.io/cinema500/";
    private static final String SITE_HOST = "riphatake16-debug.github.io";
    private static final int PICK_FILE_REQUEST = 101;
    private static final int SAVE_BACKUP_REQUEST = 102;
    private static final int MAX_BACKUP_SIZE = 5_000_000;

    private WebView webView;
    private LinearLayout offlinePanel;
    private ValueCallback<Uri[]> fileCallback;
    private String backupToSave;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setNavigationBarColor(Color.rgb(11, 13, 19));

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(11, 13, 19));

        webView = new WebView(this);
        container.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        offlinePanel = new LinearLayout(this);
        offlinePanel.setOrientation(LinearLayout.VERTICAL);
        offlinePanel.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        offlinePanel.setGravity(Gravity.CENTER);
        offlinePanel.setPadding(48, 48, 48, 48);
        offlinePanel.setBackgroundColor(Color.rgb(11, 13, 19));
        TextView message = new TextView(this);
        message.setText(R.string.offline_message);
        message.setTextColor(Color.WHITE);
        message.setTextSize(17f);
        message.setGravity(Gravity.CENTER);
        offlinePanel.addView(message);
        Button retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setOnClickListener(v -> webView.reload());
        offlinePanel.addView(retry);
        offlinePanel.setVisibility(View.GONE);
        container.addView(offlinePanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(container);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        // Unlike addJavascriptInterface, this bridge is restricted to the
        // expected HTTPS origin and the top-level frame.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                    webView,
                    "Cinema500Android",
                    Collections.singleton("https://" + SITE_HOST),
                    (view, messageData, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (!isMainFrame
                                || !"https".equalsIgnoreCase(sourceOrigin.getScheme())
                                || !SITE_HOST.equalsIgnoreCase(sourceOrigin.getHost())) {
                            return;
                        }
                        String raw = messageData.getData();
                        if (raw == null || raw.length() > MAX_BACKUP_SIZE) return;
                        try {
                            JSONObject command = new JSONObject(raw);
                            if (!"save-journal".equals(command.optString("kind"))) return;
                            String backup = command.optString("payload", "");
                            if (backup.length() > MAX_BACKUP_SIZE) return;
                            JSONObject journal = new JSONObject(backup);
                            if (!"cinema500-journal-v1".equals(journal.optString("format"))) return;
                            saveBackup(backup);
                        } catch (JSONException exception) {
                            toast(R.string.failed_backup);
                        }
                    });
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if (isSiteUrl(url)) return false;
                String scheme = url.getScheme();
                if ("https".equalsIgnoreCase(scheme)
                        || "mailto".equalsIgnoreCase(scheme)
                        || "tel".equalsIgnoreCase(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, url);
                        intent.addCategory(Intent.CATEGORY_BROWSABLE);
                        startActivity(intent);
                    } catch (ActivityNotFoundException exception) {
                        Toast.makeText(MainActivity.this, "برنامه‌ای برای باز کردن پیوند پیدا نشد.", Toast.LENGTH_SHORT).show();
                    }
                }
                // Keep all other schemes and outside sites out of this WebView.
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                offlinePanel.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) offlinePanel.setVisibility(View.VISIBLE);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = filePathCallback;
                try {
                    startActivityForResult(fileChooserParams.createIntent(), PICK_FILE_REQUEST);
                } catch (ActivityNotFoundException exception) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                }
                return true;
            }
        });

        if (state != null && webView.restoreState(state) != null) {
            return;
        }
        webView.loadUrl(SITE_URL);
    }

    private boolean isSiteUrl(Uri url) {
        String path = url.getPath();
        int port = url.getPort();
        return "https".equalsIgnoreCase(url.getScheme())
                && SITE_HOST.equalsIgnoreCase(url.getHost())
                && (port == -1 || port == 443)
                && path != null
                && (path.equals("/cinema500") || path.startsWith("/cinema500/"));
    }

    private void saveBackup(String backup) {
        backupToSave = backup;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, "cinema500-journal.json");
        try {
            startActivityForResult(intent, SAVE_BACKUP_REQUEST);
        } catch (ActivityNotFoundException exception) {
            backupToSave = null;
            toast(R.string.failed_backup);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE_REQUEST) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
        } else if (requestCode == SAVE_BACKUP_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && backupToSave != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new IOException("Document stream unavailable");
                    output.write(backupToSave.getBytes(StandardCharsets.UTF_8));
                    toast(R.string.saved_backup);
                } catch (IOException exception) {
                    toast(R.string.failed_backup);
                }
            }
            backupToSave = null;
        }
    }

    private void toast(int messageId) {
        Toast.makeText(this, messageId, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        // Cinema500 uses HTML dialogs rather than navigation for its main screens.
        webView.evaluateJavascript(
                "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",
                value -> {
                    if ("true".equals(value)) return;
                    if (webView.canGoBack()) webView.goBack();
                    else MainActivity.super.onBackPressed();
                });
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        webView.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
