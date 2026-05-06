package com.mg.sdk.demo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CaptchaAnswerReceiver extends BroadcastReceiver {
    private static final String TAG = "CaptchaNumberIme";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !CaptchaImeBridge.ACTION_SET_ANSWER.equals(intent.getAction())) {
            return;
        }
        String answer = intent.getStringExtra(CaptchaImeBridge.EXTRA_ANSWER);
        CaptchaImeBridge.saveAnswer(context, answer);
        Log.i(TAG, "received captcha answer");
        CaptchaNumberInputMethodService.commitPendingAnswerIfActive();
    }
}
