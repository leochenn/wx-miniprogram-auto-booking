package com.mg.sdk.demo;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private static final String MOCK_URL = "file:///android_asset/booking_mock/index.html";

    private WebView webView;
    private FrameLayout startView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
        applyImmersiveFullscreen();
        showStartView();
    }

    private void applyImmersiveFullscreen() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void showStartView() {
        startView = new FrameLayout(this);
        startView.setBackgroundColor(0xFFF6F6F6);
        startView.setFitsSystemWindows(false);

        Button openButton = new Button(this);
        openButton.setText("打开模拟预约页面");
        openButton.setTextSize(20);
        openButton.setAllCaps(false);
        openButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showMockWebView();
            }
        });

        int width = (int) (getResources().getDisplayMetrics().widthPixels * 0.72f);
        int height = dp(58);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
        params.gravity = Gravity.CENTER;
        startView.addView(openButton, params);

        Button imeButton = new Button(this);
        imeButton.setText("Input Method Settings");
        imeButton.setTextSize(18);
        imeButton.setAllCaps(false);
        imeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openInputMethodSettings();
            }
        });

        FrameLayout.LayoutParams imeParams = new FrameLayout.LayoutParams(width, height);
        imeParams.gravity = Gravity.CENTER;
        imeParams.topMargin = dp(86);
        startView.addView(imeButton, imeParams);

        Button switchImeButton = new Button(this);
        switchImeButton.setText("Switch Input Method");
        switchImeButton.setTextSize(18);
        switchImeButton.setAllCaps(false);
        switchImeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showInputMethodPicker();
            }
        });

        FrameLayout.LayoutParams switchImeParams = new FrameLayout.LayoutParams(width, height);
        switchImeParams.gravity = Gravity.CENTER;
        switchImeParams.topMargin = dp(172);
        startView.addView(switchImeButton, switchImeParams);
        setContentView(startView);
    }

    private void openInputMethodSettings() {
        startActivity(new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS));
    }

    private void showInputMethodPicker() {
        try {
            InputMethodManager manager =
                    (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (manager != null) {
                manager.showInputMethodPicker();
            }
        } catch (Exception ignored) {
        }
    }

    private void showMockWebView() {
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setTextZoom(100);

        setContentView(webView);
        webView.loadUrl(MOCK_URL);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && event.getRepeatCount() == 0) {
            if (webView != null) {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    webView.destroy();
                    webView = null;
                    showStartView();
                }
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveFullscreen();
        }
    }
}
