package com.mg.sdk.demo;

import android.inputmethodservice.InputMethodService;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.widget.FrameLayout;

public class CaptchaNumberInputMethodService extends InputMethodService {
    private static final String TAG = "CaptchaNumberIme";
    private static CaptchaNumberInputMethodService activeService;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable commitRunnable = new Runnable() {
        @Override
        public void run() {
            commitPendingAnswer("delayed");
        }
    };

    static void commitPendingAnswerIfActive() {
        CaptchaNumberInputMethodService service = activeService;
        if (service != null) {
            service.scheduleCommitAttempts();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        activeService = this;
    }

    @Override
    public void onDestroy() {
        if (activeService == this) {
            activeService = null;
        }
        handler.removeCallbacks(commitRunnable);
        super.onDestroy();
    }

    @Override
    public View onCreateInputView() {
        FrameLayout view = new FrameLayout(this);
        view.setMinimumHeight(1);
        return view;
    }

    @Override
    public void onStartInput(EditorInfo attribute, boolean restarting) {
        super.onStartInput(attribute, restarting);
        scheduleCommitAttempts();
    }

    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        scheduleCommitAttempts();
    }

    @Override
    public void onWindowShown() {
        super.onWindowShown();
        scheduleCommitAttempts();
    }

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    private void scheduleCommitAttempts() {
        handler.removeCallbacks(commitRunnable);
        commitPendingAnswer("immediate");
        handler.postDelayed(commitRunnable, 120L);
        handler.postDelayed(commitRunnable, 300L);
        handler.postDelayed(commitRunnable, 700L);
        handler.postDelayed(commitRunnable, 1200L);
    }

    private boolean commitPendingAnswer(String reason) {
        String answer = CaptchaImeBridge.getFreshAnswer(this);
        if (answer.length() == 0) {
            return false;
        }
        InputConnection connection = getCurrentInputConnection();
        if (connection == null) {
            Log.i(TAG, "no input connection reason=" + reason);
            return false;
        }
        boolean committed = connection.commitText(answer, 1);
        Log.i(TAG, "commit answer result=" + committed + " reason=" + reason);
        if (committed) {
            CaptchaImeBridge.clearAnswer(this);
        }
        return committed;
    }
}
