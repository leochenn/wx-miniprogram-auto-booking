/*
 * WeChat mini program custom IME input smoke test.
 *
 * Flow:
 * 1. Wait 5s for manual switch to the target mini program.
 * 2. OCR locate the "请填写证件号码" input placeholder.
 * 3. Click the OCR target.
 * 4. Send one random digit to Captcha Number IME by broadcast.
 */

var CONFIG = {
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking",
    latestLogPath: "/sdcard/OpenAutoJS_NanjingBooking/wechat_miniapp_ime_input_test_latest.log",
    waitBeforeStartMs: 5000,
    ocrRetryMs: 500,
    ocrTimeoutMs: 6000,
    targetTexts: ["请填写证件号码", "填写证件号码", "证件号码"],
    pressDuration: 30,
    focusWaitMs: 300,
    commitWaitMs: 1500,
    inputMethod: {
        enabled: true,
        packageName: "",
        action: "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER",
        extraAnswer: "answer",
        afterBroadcastMs: 80
    }
};

var runtime = {
    logPath: CONFIG.latestLogPath
};

function ensureOutputDir() {
    files.ensureDir(CONFIG.outputDir + "/");
}

function nowText() {
    return new Date().toISOString();
}

function fileTimeText() {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) + "_" +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds()) + "_" +
        String(d.getMilliseconds() + 1000).substring(1);
}

function logx(message) {
    var line = "[IME_TEST][" + nowText() + "] " + message;
    log(line);
    try {
        files.append(runtime.logPath, line + "\n");
    } catch (e) {
        log("log append failed: " + e);
    }
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\s+/g, "")
        .replace(/[：:]/g, "")
        .replace(/[|｜]/g, "")
        .trim();
}

function itemRect(item) {
    var b = item.bounds;
    return {
        left: b.left,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
        cx: Math.round((b.left + b.right) / 2),
        cy: Math.round((b.top + b.bottom) / 2),
        width: b.right - b.left,
        height: b.bottom - b.top
    };
}

function wrapOcrItem(item) {
    if (!item || !item.text || !item.bounds) return null;
    var b = item.bounds;
    return {
        text: String(item.text),
        normalized: normalizeText(item.text),
        bounds: {
            left: b.left,
            top: b.top,
            right: b.right,
            bottom: b.bottom
        }
    };
}

function captureAndOcr() {
    var img = null;
    var stamp = fileTimeText();
    var screenshotPath = CONFIG.outputDir + "/wechat_ime_ocr_" + stamp + ".png";
    var start = Date.now();
    try {
        img = captureScreen();
        images.save(img, screenshotPath);
        var result = gmlkit.ocr(img, "zh");
        var arr = result.toArray(3);
        var items = [];
        var texts = [];
        for (var i = 0; i < arr.length; i++) {
            var wrapped = wrapOcrItem(arr[i]);
            if (!wrapped) continue;
            items.push(wrapped);
            texts.push(wrapped.text);
        }
        var summary = texts.slice(0, 30).join("|");
        if (summary.length > 360) summary = summary.substring(0, 360) + "...";
        logx("OCR完成 cost=" + (Date.now() - start) + "ms count=" + items.length +
            " screenshot=" + screenshotPath + " text=" + summary);
        return items;
    } catch (e) {
        logx("OCR失败 cost=" + (Date.now() - start) + "ms err=" + e);
        return [];
    } finally {
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function matchesTarget(text) {
    var normalized = normalizeText(text);
    for (var i = 0; i < CONFIG.targetTexts.length; i++) {
        var keyword = normalizeText(CONFIG.targetTexts[i]);
        if (normalized.indexOf(keyword) >= 0) return true;
    }
    return false;
}

function scoreTargetItem(item) {
    var normalized = normalizeText(item.text);
    if (normalized.indexOf(normalizeText("请填写证件号码")) >= 0) return 100;
    if (normalized.indexOf(normalizeText("填写证件号码")) >= 0) return 80;
    if (normalized === normalizeText("证件号码")) return 20;
    if (normalized.indexOf(normalizeText("证件号码")) >= 0) return 10;
    return 0;
}

function findTargetItem(items) {
    var matched = [];
    for (var i = 0; i < items.length; i++) {
        var score = scoreTargetItem(items[i]);
        if (score > 0) {
            matched.push({ item: items[i], score: score });
        }
    }
    if (matched.length === 0) return null;
    matched.sort(function(a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return itemRect(b.item).cy - itemRect(a.item).cy;
    });
    return matched[0].item;
}

function clickRectForTarget(item) {
    var rect = itemRect(item);
    if (scoreTargetItem(item) >= 80) {
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            cx: rect.cx,
            cy: rect.cy,
            width: rect.width,
            height: rect.height,
            source: "placeholder"
        };
    }
    return {
        left: 0,
        top: rect.bottom,
        right: device.width,
        bottom: rect.bottom + Math.round(device.height * 0.08),
        cx: Math.round(device.width / 2),
        cy: rect.bottom + Math.round(device.height * 0.055),
        width: device.width,
        height: Math.round(device.height * 0.08),
        source: "label_below_fallback"
    };
}

function waitForTarget() {
    var start = Date.now();
    var lastItems = [];
    while (Date.now() - start <= CONFIG.ocrTimeoutMs) {
        var items = captureAndOcr();
        lastItems = items;
        var item = findTargetItem(items);
        if (item) {
            var rect = clickRectForTarget(item);
            logx("找到目标 text=" + item.text + " clickRect=" + JSON.stringify(rect));
            return { ok: true, item: item, rect: rect };
        }
        sleep(CONFIG.ocrRetryMs);
    }
    logx("未找到目标，占位文本=" + CONFIG.targetTexts.join("|") +
        " lastCount=" + lastItems.length);
    return { ok: false };
}

function sendAnswerToInputMethod(answer) {
    var cfg = CONFIG.inputMethod || {};
    if (!cfg.enabled) {
        return { ok: false, reason: "input_method_disabled" };
    }
    try {
        var action = String(cfg.action || "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER");
        var targetPackage = String(cfg.packageName || context.getPackageName());
        var intent = new android.content.Intent(action);
        if (targetPackage) {
            intent.setPackage(targetPackage);
        }
        intent.putExtra(String(cfg.extraAnswer || "answer"), String(answer));
        context.sendBroadcast(intent);
        logx("已发送输入法广播 answer=" + answer +
            " package=" + targetPackage + " action=" + action);
        if (cfg.afterBroadcastMs > 0) {
            sleep(cfg.afterBroadcastMs);
        }
        return { ok: true };
    } catch (e) {
        logx("发送输入法广播失败 err=" + e);
        return { ok: false, reason: String(e) };
    }
}

function pressTarget(rect) {
    press(rect.cx, rect.cy, CONFIG.pressDuration);
    logx("已点击目标输入框 x=" + rect.cx + " y=" + rect.cy +
        " duration=" + CONFIG.pressDuration + "ms");
}

function saveAfterScreenshot(answer) {
    var img = null;
    var path = CONFIG.outputDir + "/wechat_ime_after_input_" + answer + "_" + fileTimeText() + ".png";
    try {
        img = captureScreen();
        images.save(img, path);
        logx("已保存输入后截图 path=" + path);
    } catch (e) {
        logx("保存输入后截图失败 err=" + e);
    } finally {
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function main() {
    ensureOutputDir();
    files.write(runtime.logPath, "");
    logx("脚本启动，" + CONFIG.waitBeforeStartMs + "ms 内请手动切换到目标微信小程序页面");
    toast("5秒内切换到目标微信小程序页面");

    if (!requestScreenCapture()) {
        logx("请求截图权限失败");
        toast("请求截图权限失败");
        return;
    }

    sleep(CONFIG.waitBeforeStartMs);

    var target = waitForTarget();
    if (!target.ok) {
        toast("未找到证件号码输入框");
        return;
    }

    var answer = String(Math.floor(Math.random() * 10));
    pressTarget(target.rect);
    sleep(CONFIG.focusWaitMs);

    var sendResult = sendAnswerToInputMethod(answer);
    if (!sendResult.ok) {
        toast("发送输入法广播失败");
        return;
    }

    sleep(CONFIG.commitWaitMs);
    saveAfterScreenshot(answer);
    toast("已尝试输入随机数字：" + answer);
    logx("测试完成 answer=" + answer + " commitWaitMs=" + CONFIG.commitWaitMs);
}

main();
