package com.mg.sdk.demo;

import android.content.Context;
import android.content.SharedPreferences;

final class CaptchaImeBridge {
    static final String ACTION_SET_ANSWER = "com.mg.sdk.demo.CAPTCHA_IME_SET_ANSWER";
    static final String EXTRA_ANSWER = "answer";

    private static final String PREFS_NAME = "captcha_number_ime";
    private static final String KEY_ANSWER = "answer";
    private static final String KEY_TIMESTAMP = "timestamp";
    private static final long MAX_PENDING_AGE_MS = 15000L;

    private CaptchaImeBridge() {
    }

    static void saveAnswer(Context context, String answer) {
        String sanitized = sanitizeAnswer(answer);
        if (sanitized.length() == 0) {
            clearAnswer(context);
            return;
        }
        prefs(context).edit()
                .putString(KEY_ANSWER, sanitized)
                .putLong(KEY_TIMESTAMP, System.currentTimeMillis())
                .apply();
    }

    static String getFreshAnswer(Context context) {
        SharedPreferences prefs = prefs(context);
        String answer = prefs.getString(KEY_ANSWER, "");
        long timestamp = prefs.getLong(KEY_TIMESTAMP, 0L);
        if (answer == null || answer.length() == 0) {
            return "";
        }
        if (System.currentTimeMillis() - timestamp > MAX_PENDING_AGE_MS) {
            clearAnswer(context);
            return "";
        }
        return answer;
    }

    static void clearAnswer(Context context) {
        prefs(context).edit()
                .remove(KEY_ANSWER)
                .remove(KEY_TIMESTAMP)
                .apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String sanitizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < answer.length(); i++) {
            char c = answer.charAt(i);
            if (c >= '0' && c <= '9') {
                builder.append(c);
            }
        }
        return builder.toString();
    }
}
