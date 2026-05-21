/*
 * OpenAutoJS 微信小程序自动预约脚本
 *
 * 运行环境：Android OpenAutoJS / Auto.js，需开启无障碍服务和截图权限。
 * 缓存策略：优先实时采集，其次复用同尺寸缓存，异常时才使用 1440x3040 截图比例降级。
 */

// ==================== 配置区 ====================
var CONFIG = {
    appShortcutName: "侵华日军南京大屠杀遇难同胞纪念馆参观预约", // 桌面快捷方式名称；第一轮启动小程序时用于无障碍查找图标
    visitDate: "0521", // MMDD，例如 0505；日期网格按当前周周日到下周六两行显示
    period: "上午", // 可选："上午"、"下午"
    visitorCount: 2, // 1-5
    startTime: "8:00:00.5", // 第二轮正式抢票触发时间；支持 HH:mm:ss 或 HH:mm:ss.SSS，已过该时间时会在第一轮后立即执行第二轮
    prepareOnly: false, // true 时只执行第一轮，不等待 startTime，也不执行第二轮
    useCache: true, // 是否读取已有坐标缓存；第一轮关键采集项仍会由 preferRealtimeInPrepare 控制而优先实时刷新
    preferRealtimeInPrepare: true, // 第一轮对关键采集项优先实时识别，避免低可信缓存污染
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking", // 主输出目录；保存日志、缓存、诊断截图
    cachePath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json", // 主缓存路径；第一轮采集后写入，第二轮和 Mock 测试读取
    backupCachePath: "/sdcard/nanjing_booking_cache.json", // 备用缓存路径；主缓存读取/写入失败时兜底
    logPath: "/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_run_latest.log", // latest 日志路径；每次启动会清理后重新写入
    backupLogPath: "/sdcard/nanjing_booking_run.log", // 备用日志路径；主日志写入失败时兜底
    version: "2026-04-29.v1", // 缓存版本标记；写入缓存用于复盘，不直接控制流程
    baseScreen: { width: 1440, height: 3040 }, // 坐标缩放基准屏幕；截图比例兜底和 scaleX/scaleY 都按它换算
    pressDuration: 20, // 常规点击按压时长；用于第一轮采集、登录、弹窗等非极速链路
    fastPressDuration: 10, // 第二轮普通预约、日期、时段、确认按钮的快速点击按压时长；越小越快但过低可能丢点击
    visitorPressDuration: 50, // 第二轮勾选游客的专用按压时长；游客列表在滚动容器内，单独加长以提高点击生效率
    afterAudienceScrollMs: 700, // 第二轮滑动到观众信息后的等待时间；等 WebView/小程序滚动停稳后再点游客，这个值会影响滑动后的点击
    visitorIntervalMs: 80, // 第二轮连续勾选多个游客之间的间隔；避免游客卡片状态更新时吞掉后续点击
    afterConfirmCaptchaWaitMs: 800, // 第二轮点击确认预约后等待验证码弹窗渲染的时间；与 Mock 测试脚本保持一致
    noticePressDuration: 20, // 预约须知、登录协议等提示弹窗按钮的点击按压时长
    pageWaitInterval: 250, // OCR 等待循环的轮询间隔；页面识别未命中时每隔该时间重试
    finalToastHoldMs: 2200, // 脚本结束最后 toast 的保留等待时间；仅影响结束提示，不影响抢票链路
    preRushLoginProbeLeadMs: 20000, // 第一轮结束后若时间充足，在抢票前 20 秒探测并提前处理可能出现的登录
    diagnostics: {
        saveScreenshots: true,       // 只在抢票结束后或异常时截图，不插入抢票点击链路
        ocrAfterRush: true,          // 点击确认预约后做一次全局 OCR 摘要，便于复盘结果
        ocrOnError: true             // 异常退出时做一次全局 OCR 摘要，便于定位现场
    },
    captcha: {
        enabled: true,
        moduleFileName: "nanjing_booking_captcha_solver.js",
        expressionRegion: { x: 455, y: 1160, w: 570, h: 200 },
        expressionRegions: [
            { name: "mockLargeText", x: 455, y: 1160, w: 570, h: 200, templateEnabled: true },
            { name: "wechatImageWide", x: 250, y: 820, w: 940, h: 300, templateEnabled: false },
            { name: "wechatImageStrip", x: 295, y: 860, w: 850, h: 150, templateEnabled: false }
        ],
        emptyOcrRetryWaitMs: 700,
        inputPoint: { x: 720, y: 1908 },
        // 自定义数字输入法通道：抢票前需要启用并切换到 OpenAutoJS 内置的验证码数字输入法。
        // 流程：点击验证码输入框 -> 等待 focusWaitMs -> 广播答案给 IME -> 等待 commitWaitMs -> 收起键盘 -> 点击确定。
        inputMethod: {
            enabled: true, // true 使用自定义 IME；false 则跳过 IME，进入人工兜底
            packageName: "", // 留空时使用当前 OpenAutoJS 包名；不要填 Mock App 或微信包名
            action: "org.openautojs.autojs.action.CAPTCHA_IME_SET_ANSWER", // OpenAutoJS 验证码输入法接收答案的广播 action
            extraAnswer: "answer", // 广播中携带验证码答案的 extra key
            focusWaitMs: 200, // 点击验证码输入框后等待焦点/输入连接建立；偶发不输入可调到 400-600
            afterBroadcastMs: 30, // 发送广播后给 receiver 一个极短处理窗口，一般无需调整
            commitWaitMs: 200, // 等待 IME commitText 完成；已验证 350ms 可完成，正式偶发不输入可调到 800-1200
        },
        submitPoint: { x: 720, y: 2216 },
        autoSubmitAfterInput: true,
        skipFinalSubmit: true, // true 时只完成验证码输入/滑块拖动，不点击弹窗最后的“确定”，用于正式前观察验证
        afterInputMs: 200, // IME 输入完成后、收起键盘前的缓冲；正式抢票建议 150-300，肉眼观察可临时调大
        afterKeyboardBackMs: 50, // back 收起键盘后的缓冲；若确定按钮被键盘遮挡或点击过早，可调到 400-600
        preferOcr: true,
        rawOcrEnabled: false, // false 时数学验证码不跑原图 OCR，直接走预处理 OCR；true 时恢复原图 OCR 优先机制
        usePreprocessedOcr: true,
        whiteThreshold: 245,
        templateGrid: { w: 24, h: 32 },
        minGlyphScore: 0.22,
        slider: {
            imageRegion: { x: 188, y: 883, w: 1064, h: 858 },
            trackProbeRegion: { x: 188, y: 1741, w: 1064, h: 24 },
            arrowProbeRegion: { x: 210, y: 1765, w: 150, h: 110 },
            handleStartPoint: { x: 263, y: 1818 },
            submitPoint: { x: 720, y: 2148 },
            dragDuration: 420,
            afterDragMs: 120,
            trackMinRatio: 0.12,
            arrowMinRatio: 0.08,
            arrowStrongMinRatio: 0.08,
            grayMin: 165,
            grayMax: 245,
            grayChromaMax: 24,
            scanStep: 6,
            minSide: 90,
            maxSide: 215,
            minColumnHits: 10,
            minArea: 3000
        }
    }
};

function bookingConfigScriptDir() {
    try {
        var source = engines.myEngine().source;
        var path = String(source || "");
        if (path.indexOf("file://") === 0) path = path.substring(7);
        var sep = path.lastIndexOf("/");
        if (sep >= 0) return path.substring(0, sep);
    } catch (e) {}
    try {
        return files.cwd();
    } catch (ignored) {}
    return "";
}

function bookingConfigPath() {
    var dir = bookingConfigScriptDir();
    if (!dir) return "nanjing_booking_config.json";
    return dir + (dir.charAt(dir.length - 1) === "/" ? "" : "/") + "nanjing_booking_config.json";
}

function applyExternalBookingConfig() {
    try {
        var path = bookingConfigPath();
        if (!files.exists(path)) return;
        var external = JSON.parse(files.read(path));
        if (!external) return;
        if (external.visitDate !== undefined) CONFIG.visitDate = String(external.visitDate);
        if (external.period !== undefined) CONFIG.period = String(external.period);
        if (external.visitorCount !== undefined) {
            var count = parseInt(external.visitorCount, 10);
            if (!isNaN(count)) CONFIG.visitorCount = count;
        }
        if (external.startTime !== undefined) CONFIG.startTime = String(external.startTime);
    } catch (ignored) {}
}

applyExternalBookingConfig();

var STAGE = "INIT";
var runtime = {
    cache: {},
    cachePath: CONFIG.cachePath,
    logPath: CONFIG.logPath,
    latestLogPath: CONFIG.logPath,
    lastPage: "",
    screen: { width: 0, height: 0 },
    ocrEnabled: true,
    freshPoints: {},
    freshVisitorPoints: false,
    captchaTemplates: null,
    captchaStats: null,
    captchaSolver: null
};

// ==================== 日志模块 ====================
function nowText() {
    var d = new Date();
    function pad(n, len) {
        n = String(n);
        while (n.length < len) n = "0" + n;
        return n;
    }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2) +
        " " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2) + ":" +
        pad(d.getSeconds(), 2) + "." + pad(d.getMilliseconds(), 3);
}

function writeLogLine(line) {
    try {
        files.append(runtime.logPath, line + "\n");
        if (runtime.latestLogPath && runtime.latestLogPath !== runtime.logPath) {
            files.append(runtime.latestLogPath, line + "\n");
        }
    } catch (e) {
        if (runtime.logPath !== CONFIG.backupLogPath) {
            runtime.logPath = CONFIG.backupLogPath;
            try {
                files.append(runtime.logPath, line + "\n");
            } catch (ignored) {}
        }
    }
}

function fileTimeText() {
    var d = new Date();
    function pad(n, len) {
        n = String(n);
        while (n.length < len) n = "0" + n;
        return n;
    }
    return d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + "_" +
        pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2) + "_" +
        pad(d.getMilliseconds(), 3);
}

function logx(type, msg) {
    var line = "[" + nowText() + "][" + STAGE + "][" + type + "] " + msg;
    log(line);
    writeLogLine(line);
}

function notifyUser(msg, holdMs) {
    logx("TOAST", msg);
    try {
        toast(msg);
    } catch (e) {
        logx("TOAST", "toast 失败 err=" + e);
    }
    if (holdMs && holdMs > 0) {
        sleep(holdMs);
    }
}

function finalNotifyUser(msg) {
    logx("TOAST", msg);
    try {
        toastLog(msg);
    } catch (e) {
        try {
            toast(msg);
        } catch (ignoredToast) {}
        logx("TOAST", "toastLog 失败 err=" + e);
    }
    sleep(CONFIG.finalToastHoldMs);
}

function diagnosticPath(name, ext) {
    return CONFIG.outputDir + "/" + name + "_" + fileTimeText() + "." + ext;
}

function captureDiagnostics(name, includeOcr) {
    var img = null;
    var start = Date.now();
    try {
        img = captureScreen();
        if (CONFIG.diagnostics && CONFIG.diagnostics.saveScreenshots) {
            var imagePath = diagnosticPath(name, "png");
            images.save(img, imagePath);
            logx("DIAG", name + " 截图已保存 path=" + imagePath);
        }
        if (includeOcr) {
            var ocrStart = Date.now();
            var result = gmlkit.ocr(img, "zh");
            var arr = result.toArray(3);
            var texts = [];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
            }
            var summary = texts.slice(0, 30).join("|");
            if (summary.length > 500) summary = summary.substring(0, 500) + "...";
            logx("DIAG", name + " OCR cost=" + (Date.now() - ocrStart) + "ms count=" + texts.length + " result=" + summary);
        }
        logx("DIAG", name + " 完成 cost=" + (Date.now() - start) + "ms");
    } catch (e) {
        logx("DIAG", name + " 失败 err=" + e + " cost=" + (Date.now() - start) + "ms");
    } finally {
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function fail(msg) {
    notifyUser("脚本异常：" + msg + "，请查看日志");
    logx("ERROR", msg);
    throw new Error(msg);
}

function pointText(p) {
    if (!p) return "null";
    return "x=" + Math.round(p.x) + " y=" + Math.round(p.y) + (p.source ? " source=" + p.source : "");
}

function regionText(r) {
    if (!r) return "full";
    return "{x:" + Math.round(r[0]) + ",y:" + Math.round(r[1]) + ",w:" + Math.round(r[2]) + ",h:" + Math.round(r[3]) + "}";
}

// ==================== 基础工具 ====================
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function scaleX(x) {
    return Math.round(x * device.width / CONFIG.baseScreen.width);
}

function scaleY(y) {
    return Math.round(y * device.height / CONFIG.baseScreen.height);
}

function scaledPoint(name, x, y) {
    var p = { x: scaleX(x), y: scaleY(y), source: "screenshot-ratio:" + name };
    logx("COORD", name + " 使用截图比例降级 " + pointText(p));
    return p;
}

function makePoint(x, y, source) {
    return {
        x: Math.round(clamp(x, 1, device.width - 1)),
        y: Math.round(clamp(y, 1, device.height - 1)),
        source: source || "unknown"
    };
}

function centerOfBounds(bounds, source) {
    return makePoint(bounds.centerX(), bounds.centerY(), source);
}

function itemRect(item) {
    return {
        left: item.bounds.left,
        top: item.bounds.top,
        right: item.bounds.right,
        bottom: item.bounds.bottom,
        cx: item.bounds.centerX(),
        cy: item.bounds.centerY(),
        width: item.bounds.width ? item.bounds.width() : (item.bounds.right - item.bounds.left),
        height: item.bounds.height ? item.bounds.height() : (item.bounds.bottom - item.bounds.top)
    };
}

function simpleRectFromItem(item) {
    var r = itemRect(item);
    return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height),
        cx: Math.round(r.cx),
        cy: Math.round(r.cy)
    };
}

function safeSleep(ms) {
    if (ms > 0) sleep(ms);
}

function pressPoint(name, p, duration) {
    if (!p) fail("缺少点击坐标：" + name);
    var start = Date.now();
    logx("CLICK", name + " " + pointText(p));
    press(Math.round(p.x), Math.round(p.y), duration || CONFIG.pressDuration);
    logx("CLICK", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function swipeLogged(name, x1, y1, x2, y2, duration) {
    var start = Date.now();
    logx("SWIPE", name + " from=(" + Math.round(x1) + "," + Math.round(y1) + ") to=(" + Math.round(x2) + "," + Math.round(y2) + ") duration=" + duration);
    swipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration);
    logx("SWIPE", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function gestureLogged(name, x1, y1, x2, y2, duration) {
    var start = Date.now();
    logx("GESTURE", name + " from=(" + Math.round(x1) + "," + Math.round(y1) + ") to=(" + Math.round(x2) + "," + Math.round(y2) + ") duration=" + duration);
    try {
        gesture(duration, [Math.round(x1), Math.round(y1)], [Math.round(x2), Math.round(y2)]);
    } catch (e) {
        logx("GESTURE", name + " gesture失败，降级swipe err=" + e);
        swipe(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), duration);
    }
    logx("GESTURE", name + " 完成 cost=" + (Date.now() - start) + "ms");
}

function joinLocalPath(dir, name) {
    if (!dir) return name;
    var last = dir.charAt(dir.length - 1);
    if (last === "/" || last === "\\") return dir + name;
    return dir + "/" + name;
}

function addUniquePath(list, path) {
    if (!path) return;
    for (var i = 0; i < list.length; i++) {
        if (list[i] === path) return;
    }
    list.push(path);
}

function currentScriptDir() {
    try {
        var source = engines.myEngine().source;
        var path = String(source || "");
        if (path.indexOf("file://") === 0) path = path.substring(7);
        var q = path.indexOf("?");
        if (q >= 0) path = path.substring(0, q);
        var idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
        if (idx > 0) return path.substring(0, idx);
    } catch (ignored) {}
    return "";
}

function resolveCaptchaModulePath() {
    var name = CONFIG.captcha && CONFIG.captcha.moduleFileName ? CONFIG.captcha.moduleFileName : "nanjing_booking_captcha_solver.js";
    var candidates = [];
    addUniquePath(candidates, joinLocalPath(currentScriptDir(), name));
    try {
        addUniquePath(candidates, joinLocalPath(files.cwd(), name));
    } catch (ignoredCwd) {}
    addUniquePath(candidates, name);
    addUniquePath(candidates, "project/" + name);

    for (var i = 0; i < candidates.length; i++) {
        try {
            if (files.exists(candidates[i])) return candidates[i];
        } catch (ignoredExists) {}
    }
    logx("CAPTCHA", "验证码模块未找到 candidates=" + candidates.join("|"));
    return "";
}

function loadCaptchaSolver() {
    if (runtime.captchaSolver) return runtime.captchaSolver;
    if (!CONFIG.captcha || !CONFIG.captcha.enabled) return null;

    var modulePath = resolveCaptchaModulePath();
    if (!modulePath) return null;

    try {
        var code = files.read(modulePath);
        var factory = eval("(function(){ var module = { exports: null }; var exports = {}; " +
            code + "\n; return module.exports || createNanjingBookingCaptchaSolver; })()");
        if (typeof factory !== "function") {
            logx("CAPTCHA", "验证码模块未导出 createNanjingBookingCaptchaSolver path=" + modulePath);
            return null;
        }
        runtime.captchaSolver = factory({
            config: CONFIG,
            runtime: runtime,
            log: function (msg) { logx("CAPTCHA", msg); },
            notifyUser: notifyUser,
            fileTimeText: fileTimeText,
            scaleX: scaleX,
            scaleY: scaleY,
            clamp: clamp,
            pressPoint: pressPoint,
            makePoint: makePoint
        });
        logx("CAPTCHA", "验证码模块已加载 path=" + modulePath);
        return runtime.captchaSolver;
    } catch (e) {
        logx("CAPTCHA", "验证码模块加载失败 path=" + modulePath + " err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
        return null;
    }
}

function solveCaptchaAfterConfirmForRush() {
    if (!CONFIG.captcha || !CONFIG.captcha.enabled) {
        logx("CAPTCHA", "验证码流程已关闭，跳过自动处理");
        return { ok: true, skipped: true, reason: "captcha_disabled" };
    }

    var solver = loadCaptchaSolver();
    if (!solver || typeof solver.solveAfterConfirm !== "function") {
        var missingReason = "验证码模块不可用，进入人工兜底";
        logx("CAPTCHA", missingReason);
        notifyUser(missingReason);
        captureDiagnostics("captcha_module_unavailable", CONFIG.diagnostics && CONFIG.diagnostics.ocrOnError);
        return { ok: false, manualFallback: true, reason: "captcha_module_unavailable" };
    }

    var result = solver.solveAfterConfirm();
    if (!result || !result.ok) {
        var reason = result && result.reason ? result.reason : "unknown";
        logx("CAPTCHA", "验证码自动处理未完成，保留页面给人工兜底 reason=" + reason);
        notifyUser("验证码需人工兜底，请查看页面和日志");
        return result || { ok: false, manualFallback: true, reason: reason };
    }
    logx("CAPTCHA", "验证码自动处理完成 type=" + (result.type || "") + " detail=" + (result.detail || ""));
    return result;
}

function goBackLogged(reason) {
    logx("NAV", "back: " + reason);
    back();
    sleep(700);
}

function requireCachedPoint(key, label) {
    var p = getCachedPoint(key);
    if (!p) fail("缺少缓存坐标：" + label + "(" + key + ")");
    return p;
}

// ==================== 缓存模块 ====================
function readJson(path) {
    try {
        if (!files.exists(path)) return null;
        var txt = files.read(path);
        if (!txt) return null;
        return JSON.parse(txt);
    } catch (e) {
        logx("CACHE", "读取失败 path=" + path + " err=" + e);
        return null;
    }
}

function writeJson(path, obj) {
    try {
        files.write(path, JSON.stringify(obj, null, 2));
        return true;
    } catch (e) {
        logx("CACHE", "写入失败 path=" + path + " err=" + e);
        return false;
    }
}

function loadCache() {
    runtime.cachePath = CONFIG.cachePath;
    var cache = null;
    if (CONFIG.useCache) {
        cache = readJson(CONFIG.cachePath);
        if (!cache) {
            cache = readJson(CONFIG.backupCachePath);
            if (cache) {
                logx("CACHE", "主缓存不存在，读取备用缓存作为种子，但后续仍写回主缓存 path=" + CONFIG.backupCachePath);
            }
        }
    }
    if (!cache) {
        logx("CACHE", "未命中缓存，将实时采集 path=" + CONFIG.cachePath + " backup=" + CONFIG.backupCachePath);
        notifyUser("未命中缓存，开始实时采集");
        cache = {};
    } else {
        logx("CACHE", "读取缓存 path=" + runtime.cachePath + " version=" + cache.version + " collectedAt=" + cache.collectedAt);
    }

    if (!cache.screen || cache.screen.width !== device.width || cache.screen.height !== device.height) {
        if (cache.screen) {
            logx("CACHE", "屏幕尺寸不一致，缓存坐标仅作低优先级参考 cache=" + cache.screen.width + "x" + cache.screen.height + " current=" + device.width + "x" + device.height);
            notifyUser("缓存屏幕尺寸不一致，将重新实时采集");
        }
        cache.__screenMatched = false;
    } else {
        cache.__screenMatched = true;
        logx("CACHE", "屏幕尺寸一致，可复用缓存坐标");
        notifyUser("缓存命中，屏幕尺寸一致");
    }
    runtime.cache = cache;
}

function saveCache() {
    runtime.cache.version = CONFIG.version;
    runtime.cache.screen = { width: device.width, height: device.height };
    runtime.cache.collectedAt = nowText();
    var ok = writeJson(runtime.cachePath, runtime.cache);
    if (!ok && runtime.cachePath !== CONFIG.backupCachePath) {
        runtime.cachePath = CONFIG.backupCachePath;
        ok = writeJson(runtime.cachePath, runtime.cache);
    }
    logx("CACHE", "保存缓存 " + (ok ? "成功" : "失败") + " path=" + runtime.cachePath);
}

function getCachedPoint(key) {
    if (!runtime.cache.points) return null;
    if (shouldSkipCacheInPrepare(key)) return null;
    var p = runtime.cache.points[key];
    if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
        logx("CACHE", key + " 缓存缺失");
        return null;
    }
    if (!CONFIG.useCache && !runtime.freshPoints[key]) {
        logx("CACHE", key + " 存在旧缓存但 useCache=false，跳过");
        return null;
    }
    if (!runtime.cache.__screenMatched && !runtime.freshPoints[key]) {
        logx("CACHE", key + " 存在但屏幕尺寸不一致，跳过旧缓存");
        return null;
    }
    logx("CACHE", key + " 命中 " + pointText(p));
    return makePoint(p.x, p.y, runtime.freshPoints[key] ? "fresh:" + key : "cache:" + key);
}

function shouldSkipCacheInPrepare(key) {
    if (!CONFIG.preferRealtimeInPrepare || STAGE !== "PREP") return false;
    if (runtime.freshPoints[key]) return false;
    var keys = {
        targetDate: true,
        homeExhibit: true,
        normalBooking: true,
        visitDateTitle: true,
        audienceTitle: true,
        periodTitle: true,
        periodMorning: true,
        periodAfternoon: true,
        confirmBooking: true
    };
    if (keys[key]) {
        logx("CACHE", key + " 第一轮优先实时采集，跳过旧缓存");
        return true;
    }
    return false;
}

function setCachedPoint(key, p) {
    if (!runtime.cache.points) runtime.cache.points = {};
    runtime.cache.points[key] = { x: Math.round(p.x), y: Math.round(p.y), source: p.source || "unknown" };
    runtime.freshPoints[key] = true;
    logx("CACHE", key + " 写入 " + pointText(runtime.cache.points[key]));
}

function setCacheValue(key, value) {
    runtime.cache[key] = value;
    logx("CACHE", key + " 写入 " + JSON.stringify(value));
}

function cachePointForPlan(key) {
    if (!runtime.cache.points || !runtime.cache.points[key]) return null;
    return runtime.cache.points[key];
}

function logRushPlan(reason) {
    var periodKey = CONFIG.period === "下午" ? "periodAfternoon" : "periodMorning";
    var plan = {
        reason: reason,
        config: {
            visitDate: CONFIG.visitDate,
            period: CONFIG.period,
            visitorCount: CONFIG.visitorCount,
            startTime: CONFIG.startTime
        },
        screen: { width: device.width, height: device.height },
        points: {
            normalBooking: cachePointForPlan("normalBooking"),
            targetDate: cachePointForPlan("targetDate"),
            period: cachePointForPlan(periodKey),
            confirmBooking: cachePointForPlan("confirmBooking")
        },
        visitorRushPoints: runtime.cache.visitorRushPoints || null,
        scrollStrategy: runtime.cache.scrollStrategy || null,
        cachePath: runtime.cachePath,
        collectedAt: runtime.cache.collectedAt || null
    };
    logx("PLAN", "二轮执行计划 " + JSON.stringify(plan));
    warnRiskyPoint("targetDate", plan.points.targetDate);
    warnRiskyPoint("period", plan.points.period);
    warnRiskyPoint("normalBooking", plan.points.normalBooking);
    warnRiskyPoint("confirmBooking", plan.points.confirmBooking);
}

function warnRiskyPoint(name, point) {
    if (!point) {
        logx("WARN", name + " 缺失，二轮可能触发降级识别或失败");
        return;
    }
    var source = String(point.source || "");
    if (source.indexOf("screenshot-ratio") >= 0 || source.indexOf("UnknownFallback") >= 0) {
        logx("WARN", name + " 来源为低可信降级坐标 " + pointText(point));
    }
}

// ==================== OCR 模块 ====================
function normalizeText(s) {
    if (!s) return "";
    return String(s)
        .replace(/\s+/g, "")
        .replace(/[“”"']/g, "")
        .replace(/丨/g, "川")
        .replace(/井/g, "并")
        .replace(/預/g, "预")
        .replace(/約/g, "约")
        .replace(/門/g, "门")
        .replace(/館/g, "馆")
        .replace(/：/g, ":")
        .replace(/[－–—]/g, "-");
}

function fuzzyContains(text, keyword) {
    var t = normalizeText(text);
    var k = normalizeText(keyword);
    if (t.indexOf(k) >= 0) return true;
    if (k === "阅读并同意") return t.indexOf("阅读") >= 0 && t.indexOf("同意") >= 0;
    if (k === "我已阅读并同意") return t.indexOf("我已") >= 0 && t.indexOf("同意") >= 0;
    if (k === "确认预约") return t.indexOf("确认") >= 0 && t.indexOf("预约") >= 0;
    if (k === "普通预约") return t.indexOf("普通") >= 0 && t.indexOf("预约") >= 0;
    if (k === "普通预约标题") return t.indexOf("普通") >= 0;
    if (k === "用户确认登录") return t.indexOf("用户") >= 0 && t.indexOf("登录") >= 0;
    if (k === "南京大屠杀") return t.indexOf("南京") >= 0 && t.indexOf("屠杀") >= 0;
    if (k === "参观日期") return t.indexOf("参观") >= 0 && t.indexOf("日期") >= 0;
    if (k === "观众信息") return t.indexOf("观众") >= 0 && t.indexOf("信息") >= 0;
    if (k === "选择时段") return t.indexOf("选择") >= 0 && t.indexOf("时段") >= 0;
    if (k === "我已知晓" || k === "已知晓" || k === "知晓") return t.indexOf("知晓") >= 0 || (t.indexOf("知") >= 0 && t.indexOf("晓") >= 0);
    return false;
}

function ocrRegion(stage, label, region) {
    var img = null;
    var ocrImg = null;
    var start = Date.now();
    try {
        img = captureScreen();
        var offsetX = 0;
        var offsetY = 0;
        if (region) {
            offsetX = Math.round(clamp(region[0], 0, device.width - 1));
            offsetY = Math.round(clamp(region[1], 0, device.height - 1));
            var w = Math.round(clamp(region[2], 1, device.width - offsetX));
            var h = Math.round(clamp(region[3], 1, device.height - offsetY));
            // 当前 OpenAutoJS 版本不支持 gmlkit.ocr(img, "zh", {region: ...})。
            // 所以先裁剪局部截图，再对裁剪图做两参数 OCR。
            ocrImg = images.clip(img, offsetX, offsetY, w, h);
        } else {
            ocrImg = img;
        }
        var result = gmlkit.ocr(ocrImg, "zh");
        var arr = result.toArray(3);
        var items = [];
        var texts = [];
        for (var i = 0; i < arr.length; i++) {
            var it = arr[i];
            if (!it || !it.text) continue;
            items.push(wrapOcrItem(it, offsetX, offsetY));
            texts.push(String(it.text));
        }
        var summary = texts.slice(0, 16).join("|");
        if (summary.length > 240) summary = summary.substring(0, 240) + "...";
        logx("OCR", label + " region=" + regionText(region) + " cost=" + (Date.now() - start) + "ms count=" + items.length + " result=" + summary);
        return items;
    } catch (e) {
        logx("OCR", label + " 失败 region=" + regionText(region) + " cost=" + (Date.now() - start) + "ms err=" + e);
        return [];
    } finally {
        if (ocrImg && ocrImg !== img) {
            try { ocrImg.recycle(); } catch (ignoredClip) {}
        }
        if (img) {
            try { img.recycle(); } catch (ignored) {}
        }
    }
}

function wrapOcrItem(item, offsetX, offsetY) {
    var b = item.bounds;
    var left = b.left + offsetX;
    var top = b.top + offsetY;
    var right = b.right + offsetX;
    var bottom = b.bottom + offsetY;
    return {
        text: String(item.text),
        bounds: {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            centerX: function() { return Math.round((left + right) / 2); },
            centerY: function() { return Math.round((top + bottom) / 2); },
            width: function() { return right - left; },
            height: function() { return bottom - top; }
        }
    };
}

function findTextItem(items, keywords, prefer) {
    if (typeof keywords === "string") keywords = [keywords];
    var matched = [];
    for (var i = 0; i < items.length; i++) {
        for (var j = 0; j < keywords.length; j++) {
            if (fuzzyContains(items[i].text, keywords[j])) {
                matched.push(items[i]);
                break;
            }
        }
    }
    if (matched.length === 0) return null;
    matched.sort(function(a, b) {
        var ra = itemRect(a);
        var rb = itemRect(b);
        if (prefer === "bottom") return rb.cy - ra.cy;
        if (prefer === "top") return ra.cy - rb.cy;
        if (prefer === "left") return ra.cx - rb.cx;
        if (prefer === "right") return rb.cx - ra.cx;
        return ra.cy - rb.cy;
    });
    return matched[0];
}

function findPointByText(label, keywords, region, prefer) {
    var items = ocrRegion(STAGE, "查找 " + label, region);
    var item = findTextItem(items, keywords, prefer);
    if (!item) {
        logx("OCR", label + " 未匹配");
        return null;
    }
    var p = centerOfBounds(item.bounds, "ocr:" + label);
    logx("OCR", label + " 匹配 text=" + item.text + " " + pointText(p));
    return p;
}

function waitForText(label, keywords, region, timeoutMs) {
    // 业务约束：预约须知只在小程序冷启动后由 handleStartupNoticeDialog()
    // 处理一次。后续页面按业务前提不会再弹出预约须知，因此这里不做
    // 通用弹窗处理，避免在采集/抢票链路中引入额外 OCR 和点击。
    var start = Date.now();
    var p = null;
    while (Date.now() - start < timeoutMs) {
        p = findPointByText(label, keywords, region, "top");
        if (p) {
            logx("WAIT", label + " 已出现 cost=" + (Date.now() - start) + "ms");
            return p;
        }
        sleep(CONFIG.pageWaitInterval);
    }
    logx("WAIT", label + " 超时 cost=" + (Date.now() - start) + "ms");
    return null;
}

// ==================== 页面坐标采集与推算 ====================
function getHomeExhibitPoint() {
    var cached = getCachedPoint("homeExhibit");
    if (cached) return cached;

    // 只在第一个展馆卡片区域内找“点击预约”，避免误点第二/第三个展馆。
    var firstCardRegion = [0, scaleY(760), device.width, scaleY(760)];
    var items = ocrRegion(STAGE, "首页查找南京大屠杀入口-第一卡片", firstCardRegion);
    if (findTextItem(items, "预约须知", "top")) {
        logx("PAGE", "首页第一卡片区域仍被预约须知覆盖，暂不推算首页入口");
        return null;
    }
    var bookingItems = [];
    for (var i = 0; i < items.length; i++) {
        if (fuzzyContains(items[i].text, "点击预约")) bookingItems.push(items[i]);
    }
    if (bookingItems.length > 0) {
        bookingItems.sort(function(a, b) { return itemRect(a).cy - itemRect(b).cy; });
        var p = centerOfBounds(bookingItems[0].bounds, "ocr:homeClickBooking");
        logx("COORD", "首页第一展馆按钮匹配 text=" + bookingItems[0].text + " " + pointText(p));
        setCachedPoint("homeExhibit", p);
        return p;
    }

    var titleItem = findTextItem(items, "南京大屠杀", "top");
    if (titleItem) {
        var r = itemRect(titleItem);
        var inferred = makePoint(scaleX(310), r.cy + scaleY(260), "infer:firstCardTitleBelowButton");
        logx("COORD", "首页第一展馆标题匹配 text=" + titleItem.text + " 推算按钮 " + pointText(inferred));
        setCachedPoint("homeExhibit", inferred);
        return inferred;
    }

    var fallback = scaledPoint("homeExhibitFirstCardButton", 310, 1320);
    setCachedPoint("homeExhibit", fallback);
    return fallback;
}

function findHomeExhibitPointOnCurrentPage(label) {
    var firstCardRegion = [0, scaleY(760), device.width, scaleY(760)];
    var items = ocrRegion(STAGE, label, firstCardRegion);
    if (findTextItem(items, "预约须知", "top")) return null;

    var bookingItems = [];
    for (var i = 0; i < items.length; i++) {
        if (fuzzyContains(items[i].text, "点击预约")) bookingItems.push(items[i]);
    }
    if (bookingItems.length > 0) {
        bookingItems.sort(function(a, b) { return itemRect(a).cy - itemRect(b).cy; });
        var p = centerOfBounds(bookingItems[0].bounds, "ocr:homeClickBookingAfterLogin");
        logx("COORD", label + " 匹配 text=" + bookingItems[0].text + " " + pointText(p));
        setCachedPoint("homeExhibit", p);
        return p;
    }

    var titleItem = findTextItem(items, "南京大屠杀", "top");
    if (titleItem) {
        var r = itemRect(titleItem);
        var inferred = makePoint(scaleX(310), r.cy + scaleY(260), "infer:firstCardTitleBelowButtonAfterLogin");
        logx("COORD", label + " 标题匹配 text=" + titleItem.text + " 推算按钮 " + pointText(inferred));
        setCachedPoint("homeExhibit", inferred);
        return inferred;
    }
    return null;
}

function getNormalBookingPoint() {
    var cached = getCachedPoint("normalBooking");
    if (cached) return cached;

    var region = [0, scaleY(700), device.width, scaleY(1700)];
    var p = findPointByText("普通预约", "普通预约", region, "top");
    if (p) {
        setCachedPoint("normalBooking", p);
        return p;
    }

    var fallback = scaledPoint("normalBookingCard", 720, 1180);
    setCachedPoint("normalBooking", fallback);
    return fallback;
}

function getConfirmButtonPoint() {
    var cached = getCachedPoint("confirmBooking");
    if (cached) return cached;

    var region = [0, Math.floor(device.height * 0.78), device.width, Math.floor(device.height * 0.2)];
    var p = findPointByText("确认预约", "确认预约", region, "bottom");
    if (p) {
        setCachedPoint("confirmBooking", p);
        return p;
    }

    var fallback = scaledPoint("confirmBookingBottomButton", 720, 2800);
    setCachedPoint("confirmBooking", fallback);
    return fallback;
}

function collectDatePoint() {
    var cached = getCachedPoint("targetDate");
    if (cached) return cached;

    var grid = buildVisibleDateGridFromToday();
    if (!grid.points[CONFIG.visitDate]) {
        fail("visitDate=" + CONFIG.visitDate + " 不在当前可见两周日期网格内：" + grid.rangeText);
    }
    setCacheValue("dateGridPoints", grid.points);
    var target = grid.points[CONFIG.visitDate];
    var point = makePoint(target.x, target.y, "dateGridByVisitDate:" + CONFIG.visitDate);
    logx("COORD", "目标日期按配置和星期网格推算 visitDate=" + CONFIG.visitDate + " row=" + target.row + " col=" + target.col + " " + pointText(point) + " visibleRange=" + grid.rangeText);
    setCachedPoint("targetDate", point);
    return point;
}

function buildVisibleDateGridFromToday() {
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start.setDate(start.getDate() - start.getDay());
    var xs = [scaleX(190), scaleX(365), scaleX(545), scaleX(720), scaleX(900), scaleX(1080), scaleX(1255)];
    var ys = [scaleY(980), scaleY(1210)];
    var points = {};
    var labels = [];
    for (var i = 0; i < 14; i++) {
        var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        var key = mmddText(d);
        var row = Math.floor(i / 7);
        var col = i % 7;
        points[key] = { x: xs[col], y: ys[row], row: row, col: col, source: "week-grid" };
        labels.push(key);
    }
    return { points: points, rangeText: labels[0] + "-" + labels[labels.length - 1] };
}

function mmddText(d) {
    return twoDigit(d.getMonth() + 1) + twoDigit(d.getDate());
}

function twoDigit(n) {
    var v = parseInt(n, 10);
    return v < 10 ? "0" + v : String(v);
}

function collectAudienceAndPeriodPoints() {
    collectBookingTitleAnchor();

    var detailItems = ocrRegion(STAGE, "查找 选择时段与观众信息标题", [0, scaleY(1000), device.width, scaleY(1700)]);
    var periodItem = findTextItem(detailItems, "选择时段", "top");
    var morningTimeItem = findTextItem(detailItems, "08:30-12:30", "left");
    var afternoonTimeItem = findTextItem(detailItems, "12:30-16:30", "right");
    var audienceItem = findTextItem(detailItems, "观众信息", "top");
    var periodTitle = null;
    var periodRect = null;
    var morningTimeRect = null;
    var afternoonTimeRect = null;
    var audienceTitle = null;
    var audienceRect = null;
    if (periodItem) {
        periodTitle = centerOfBounds(periodItem.bounds, "ocr:选择时段标题");
        periodRect = simpleRectFromItem(periodItem);
        logx("OCR", "选择时段标题 匹配 text=" + periodItem.text + " " + pointText(periodTitle) + " rect=" + JSON.stringify(periodRect));
        setCachedPoint("periodTitle", periodTitle);
        setCacheValue("periodTitleRect", periodRect);
    } else {
        logx("OCR", "选择时段标题 未匹配");
    }
    if (morningTimeItem) {
        morningTimeRect = simpleRectFromItem(morningTimeItem);
        logx("OCR", "上午时段文本 匹配 text=" + morningTimeItem.text + " rect=" + JSON.stringify(morningTimeRect));
    } else {
        logx("OCR", "上午时段文本 未匹配");
    }
    if (afternoonTimeItem) {
        afternoonTimeRect = simpleRectFromItem(afternoonTimeItem);
        logx("OCR", "下午时段文本 匹配 text=" + afternoonTimeItem.text + " rect=" + JSON.stringify(afternoonTimeRect));
    } else {
        logx("OCR", "下午时段文本 未匹配");
    }
    if (audienceItem) {
        audienceTitle = centerOfBounds(audienceItem.bounds, "ocr:观众信息标题");
        audienceRect = simpleRectFromItem(audienceItem);
        logx("OCR", "观众信息标题 匹配 text=" + audienceItem.text + " " + pointText(audienceTitle) + " rect=" + JSON.stringify(audienceRect));
        setCachedPoint("audienceTitle", audienceTitle);
        setCacheValue("audienceTitleRect", audienceRect);
    } else {
        logx("OCR", "观众信息标题 未匹配");
    }

    if (periodTitle || morningTimeRect || afternoonTimeRect) {
        setCacheValue("prepareDetailLayoutMode", "period-visible");
        if (periodTitle) {
            setPeriodPointsFromTitle(periodTitle, "ocr-prep-period-visible");
        } else {
            setPeriodPointsFromTimeRects(morningTimeRect, afternoonTimeRect, "ocr-prep-period-time-visible");
        }
        logx("COORD", "第一轮已显示选择时段，直接按已识别时段布局推算上午/下午；观众信息位置按当前实测布局复用");
    } else if (audienceRect) {
        setCacheValue("prepareDetailLayoutMode", "period-hidden");
        setPeriodPointsFromAudienceRect(audienceRect, "infer-from-audience-title");
        logx("COORD", "第一轮未显示选择时段，已按观众信息标题位置推算第二轮时段区域");
    } else {
        setCacheValue("prepareDetailLayoutMode", "fallback-period-title");
        var inferredTitle = makePoint(scaleX(220), scaleY(1850), "infer:periodTitleFromOpenedLayout");
        setCachedPoint("periodTitle", inferredTitle);
        setPeriodPointsFromTitle(inferredTitle, "infer-from-screenshot-layout");
        logx("COORD", "第一轮未找到观众信息标题，已按可预约截图布局推算时段区域");
    }

    collectVisitorPoints(audienceTitle);
    getConfirmButtonPoint();
    buildAudienceGestureScrollStrategy(audienceTitle);
}

function collectBookingTitleAnchor() {
    var cached = getCachedPoint("bookingTitle");
    if (cached) return cached;

    var title = findPointByText("预约详情页标题", "普通预约标题", [0, scaleY(120), device.width, scaleY(260)], "top");
    if (title) {
        setCachedPoint("bookingTitle", title);
        setCacheValue("bookingTitleAnchorY", Math.round(title.y));
        logx("COORD", "预约详情页标题锚点 " + pointText(title));
        return title;
    }

    var fallback = makePoint(device.width * 0.5, scaleY(235), "fallback:bookingTitle");
    setCachedPoint("bookingTitle", fallback);
    setCacheValue("bookingTitleAnchorY", Math.round(fallback.y));
    logx("COORD", "预约详情页标题未识别，使用兜底锚点 " + pointText(fallback));
    return fallback;
}

function getAudienceAlignTargetY() {
    var titleY = runtime.cache.bookingTitleAnchorY || (runtime.cache.points && runtime.cache.points.bookingTitle && runtime.cache.points.bookingTitle.y);
    if (!titleY) titleY = scaleY(235);
    // 目标不是把“观众信息”压到标题文字上，而是停在标题栏下方的安全可见区。
    return Math.round(clamp(titleY + scaleY(190), scaleY(320), scaleY(520)));
}

function isPreparePeriodVisibleLayout() {
    return runtime.cache.prepareDetailLayoutMode === "period-visible";
}

function estimateRushAudienceTitleY(audienceTitle) {
    var insertedPeriodOffsetY = isPreparePeriodVisibleLayout() ? 0 : scaleY(420);
    if (audienceTitle) {
        return Math.round(audienceTitle.y + insertedPeriodOffsetY);
    }
    if (runtime.cache.audienceTitleRect && runtime.cache.audienceTitleRect.cy) {
        return Math.round(runtime.cache.audienceTitleRect.cy + insertedPeriodOffsetY);
    }
    if (isPreparePeriodVisibleLayout() && runtime.cache.points && runtime.cache.points.periodTitle) {
        return Math.round(runtime.cache.points.periodTitle.y + scaleY(560));
    }
    return scaleY(2350);
}

function buildAudienceGestureScrollStrategy(audienceTitle) {
    var startX = Math.round(device.width * 0.5);
    var startY = Math.round(device.height * 0.78);
    var targetY = getAudienceAlignTargetY();
    var estimatedAudienceY = estimateRushAudienceTitleY(audienceTitle);
    var moveY = Math.round(clamp(estimatedAudienceY - targetY, scaleY(900), startY - scaleY(260)));
    var endY = Math.round(clamp(startY - moveY, scaleY(260), device.height - 1));
    var duration = Math.round(clamp(moveY * 0.16, 220, 360));

    setCacheValue("audienceAlignTargetY", targetY);
    setCacheValue("scrollStrategy", {
        name: "audienceAnchorGesture",
        type: "gesture",
        startX: startX,
        startY: startY,
        endX: startX,
        endY: endY,
        duration: 100,
        estimatedAudienceY: estimatedAudienceY,
        targetY: targetY,
        moveY: moveY,
        source: audienceTitle ? "audience-title-anchor" : "fallback-anchor"
    });
    logx("COORD", "观众信息手势滚动策略 estimatedAudienceY=" + estimatedAudienceY + " targetY=" + targetY + " moveY=" + moveY + " startY=" + startY + " endY=" + endY + " duration=" + duration);
}

function setPeriodPointsFromTitle(titlePoint, source) {
    var y = titlePoint.y + scaleY(210);
    var morning = makePoint(device.width * 0.28, y, source + ":morning");
    var afternoon = makePoint(device.width * 0.72, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标推算 morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + "依据：选择时段标题下方左右两块区域中心");
}

function setPeriodPointsFromTimeRects(morningRect, afternoonRect, source) {
    var y;
    if (morningRect && afternoonRect) {
        y = Math.round((morningRect.cy + afternoonRect.cy) / 2);
    } else if (morningRect) {
        y = morningRect.cy;
    } else {
        y = afternoonRect.cy;
    }
    var morningX = morningRect ? morningRect.cx : device.width * 0.28;
    var afternoonX = afternoonRect ? afternoonRect.cx : device.width * 0.72;
    var morning = makePoint(morningX, y, source + ":morning");
    var afternoon = makePoint(afternoonX, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标按时段文本推算 morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + " morningRect=" + JSON.stringify(morningRect) + " afternoonRect=" + JSON.stringify(afternoonRect));
}

function setPeriodPointsFromAudienceRect(audienceRect, source) {
    // 未放票页没有“选择时段”。实测放票后小程序会在第一轮“观众信息”
    // 所在位置下方插入上午/下午区域，并把第二轮“观众信息”整体下移。
    // 因此这里故意以第一轮 audienceRect.bottom 向下推算时段点击区域。
    var titleHeight = Math.max(audienceRect.height || 0, scaleY(70));
    var areaHeight = Math.max(titleHeight * 2, scaleY(150));
    var top = Math.round(audienceRect.bottom);
    var bottom = Math.round(clamp(top + areaHeight, 1, device.height - 1));
    var y = Math.round((top + bottom) / 2);
    var morning = makePoint(device.width * 0.25, y, source + ":morning");
    var afternoon = makePoint(device.width * 0.75, y, source + ":afternoon");
    setCachedPoint("periodMorning", morning);
    setCachedPoint("periodAfternoon", afternoon);
    logx("COORD", "时段坐标按观众信息标题推算 audienceRect=" + JSON.stringify(audienceRect) + " morning=" + pointText(morning) + " afternoon=" + pointText(afternoon) + " regionTop=" + top + " regionBottom=" + bottom);
}

function collectVisitorPoints(audienceTitle) {
    var existing = runtime.cache.visitorPrepPoints;
    if (!(CONFIG.preferRealtimeInPrepare && STAGE === "PREP") && CONFIG.useCache && runtime.cache.__screenMatched && existing && existing.length >= CONFIG.visitorCount) {
        logx("CACHE", "visitorPrepPoints 命中 count=" + existing.length);
        return existing;
    }

    var startY;
    if (audienceTitle) {
        startY = audienceTitle.y + scaleY(360);
    } else {
        startY = scaleY(2050);
        logx("COORD", "观众信息标题未识别，游客坐标使用截图比例推算起点");
    }
    var points = [];
    var gap = scaleY(365);
    for (var i = 0; i < 5; i++) {
        points.push(makePoint(scaleX(190), startY + i * gap, "infer:visitorList:" + (i + 1)));
    }
    runtime.cache.visitorPrepPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "visitorPrepPoints 写入 " + JSON.stringify(points));

    var rushPoints = inferRushVisitorPoints(makePoint(device.width * 0.5, getAudienceAlignTargetY(), "target:audienceAfterGesture"));
    runtime.cache.visitorRushPoints = rushPoints;
    logx("CACHE", "visitorRushPoints 写入 " + JSON.stringify(rushPoints));
    return points;
}

function inferRushVisitorPoints(audienceTitle) {
    var firstY;
    if (audienceTitle) {
        firstY = audienceTitle.y + scaleY(390);
    } else {
        firstY = scaleY(830);
    }
    var gap = scaleY(365);
    var points = [];
    for (var i = 0; i < 5; i++) {
        // 点击卡片中部比只点左侧空心圆容错更高，参考脚本已验证 x=700 可用。
        points.push(makePoint(scaleX(700), firstY + i * gap, "infer:rushVisitorPostScroll:" + (i + 1)));
    }
    return points;
}

function getPeriodPoint() {
    var key = CONFIG.period === "下午" ? "periodAfternoon" : "periodMorning";
    var p = getCachedPoint(key);
    if (p) return p;

    var title = findPointByText("选择时段标题", "选择时段", [0, scaleY(1200), device.width, scaleY(1100)], "top");
    if (title) {
        setPeriodPointsFromTitle(title, "ocr");
        return getCachedPoint(key) || runtime.cache.points[key];
    }
    var fallback = CONFIG.period === "下午" ? scaledPoint("periodAfternoon", 1045, 2095) : scaledPoint("periodMorning", 400, 2095);
    setCachedPoint(key, fallback);
    return fallback;
}

function getVisitorPointsForRush() {
    if (runtime.cache.visitorRushPoints && runtime.cache.visitorRushPoints.length >= CONFIG.visitorCount && (runtime.cache.__screenMatched || runtime.freshVisitorPoints)) {
        logx("CACHE", "visitorRushPoints 命中 count=" + runtime.cache.visitorRushPoints.length);
        return runtime.cache.visitorRushPoints;
    }
    var title = findPointByText("观众信息标题", "观众信息", [0, scaleY(250), device.width, scaleY(900)], "top");
    var points = inferRushVisitorPoints(title);
    runtime.cache.visitorRushPoints = points;
    runtime.freshVisitorPoints = true;
    logx("CACHE", "visitorRushPoints 实时推算写入 " + JSON.stringify(points));
    return points;
}

function scrollToAudienceForRush() {
    var scrollStrategy = runtime.cache.scrollStrategy || {
        name: "audienceAnchorGestureFallback",
        type: "gesture",
        startX: Math.round(device.width * 0.5),
        startY: Math.round(device.height * 0.78),
        endX: Math.round(device.width * 0.5),
        endY: Math.round(device.height * 0.18),
        duration: 240,
        source: "default-screen-ratio"
    };

    if (scrollStrategy.type === "gesture") {
        gestureLogged("滑动到观众信息", scrollStrategy.startX, scrollStrategy.startY, scrollStrategy.endX, scrollStrategy.endY, scrollStrategy.duration);
    } else {
        swipeLogged("滑动到观众信息", scrollStrategy.startX, scrollStrategy.startY, scrollStrategy.endX, scrollStrategy.endY, scrollStrategy.duration);
    }
}

// ==================== 页面识别与流程动作 ====================
function launchMiniProgram() {
    STAGE = "PREP";
    logx("NAV", "回到桌面");
    home();
    sleep(600);

    var found = false;
    for (var i = 0; i < 4; i++) {
        var icon = text(CONFIG.appShortcutName).findOne(600);
        if (icon) {
            var b = icon.bounds();
            if (b.centerX() > 0 && b.centerY() > 0 && b.centerX() < device.width && b.centerY() < device.height) {
                var p = makePoint(b.centerX(), b.centerY(), "accessibility:desktopShortcut");
                logx("NAV", "找到桌面快捷方式 " + pointText(p));
                pressPoint("桌面快捷方式", p, CONFIG.pressDuration);
                found = true;
                break;
            }
        }
        logx("NAV", "未找到桌面快捷方式，向左翻页 i=" + i);
        swipeLogged("桌面翻页", device.width * 0.82, device.height * 0.5, device.width * 0.18, device.height * 0.5, 450);
        sleep(800);
    }
    if (!found) fail("未找到桌面快捷方式：" + CONFIG.appShortcutName);
    sleep(1500);
}

function detectNoticeDialogOnce(label) {
    var items = ocrRegion(STAGE, label, null);
    var titleItem = findTextItem(items, "预约须知", "top");
    var readItem = findTextItem(items, ["我已阅", "我已阅读并同意", "阅读并同意"], "bottom");
    var knownItem = findTextItem(items, ["我已知晓", "已知晓", "知晓"], "bottom");
    return {
        found: !!(titleItem || readItem || knownItem),
        titleItem: titleItem,
        readItem: readItem,
        knownItem: knownItem
    };
}

function handleStartupNoticeDialog() {
    logx("PAGE", "冷启动后等待10秒再检测预约须知");
    sleep(10000);

    var dialog = detectNoticeDialogOnce("冷启动首次检查预约须知");
    if (!dialog.found) {
        logx("PAGE", "冷启动首次未检测到预约须知，等待3秒后复检");
        sleep(3000);
        dialog = detectNoticeDialogOnce("冷启动第二次检查预约须知");
    }

    if (!dialog.found) {
        // 业务约束：本脚本按“每次冷启动必出现预约须知”设计。
        // 如果启动后两次检测都未发现须知，说明当前冷启动状态不符合
        // 抢票前置条件，故意返回桌面并终止，避免继续采集错误坐标。
        logx("ERROR", "冷启动两次未检测到预约须知，返回桌面并结束流程");
        notifyUser("启动后未检测到预约须知，已返回桌面并结束流程", CONFIG.finalToastHoldMs);
        home();
        throw new Error("启动后两次未检测到预约须知");
    }

    notifyUser("检测到预约须知，正在处理");
    clickNoticeAgree(dialog.readItem);
    logx("PAGE", "预约须知已勾选，等待5秒后点击我已知晓");
    sleep(5000);

    var readyDialog = detectNoticeDialogOnce("冷启动等待5秒后查找我已知晓");
    if (!clickStartupNoticeKnownAndConfirmClosed(readyDialog.knownItem)) {
        logx("ERROR", "冷启动预约须知已勾选，但未能关闭弹窗，返回桌面并结束流程");
        home();
        finalNotifyUser("预约须知未能关闭，已返回桌面并结束流程");
        throw new Error("预约须知未能关闭");
    }
}

function clickStartupNoticeKnownAndConfirmClosed(knownItem) {
    if (knownItem) {
        pressPoint("预约须知-我已知晓-冷启动OCR中心", centerOfBounds(knownItem.bounds, "ocr:startupNoticeKnown"), CONFIG.noticePressDuration);
        if (waitNoticeGone(1800)) return true;
    } else {
        logx("PAGE", "冷启动固定等待后未识别到我已知晓，使用候选坐标重试");
    }

    var points = getNoticeKnownButtonCandidates();
    for (var i = 0; i < points.length; i++) {
        pressPoint("预约须知-我已知晓-冷启动候选" + (i + 1), points[i], CONFIG.noticePressDuration);
        if (waitNoticeGone(1800)) return true;
    }
    return false;
}

function clickNoticeAgree(readItem) {
    var p;
    if (readItem) {
        p = centerOfBounds(readItem.bounds, "ocr:noticeAgreeTextCenter");
        logx("PAGE", "按参考脚本点击“我已阅”OCR文本中心 text=" + readItem.text + " " + pointText(p));
    } else {
        p = getNoticeAgreePoint();
        logx("PAGE", "预约须知已出现，但未识别到勾选文字，使用兜底勾选坐标 " + pointText(p));
    }
    pressPoint("预约须知-我已阅读并同意", p, CONFIG.noticePressDuration);
}

function getNoticeAgreePoint() {
    return makePoint(scaleX(250), scaleY(2090), "fallback:noticeAgreeCheckbox");
}

function getNoticeKnownButtonPoint() {
    return makePoint(scaleX(720), scaleY(2385), "fallback:noticeKnownButton");
}

function getNoticeKnownButtonCandidates() {
    return [
        makePoint(device.width * 0.5, device.height * 0.88, "fallback:noticeKnownButton:lower"),
        makePoint(device.width * 0.5, device.height * 0.92, "fallback:noticeKnownButton:bottom"),
        getNoticeKnownButtonPoint(),
        makePoint(device.width * 0.5, device.height * 0.82, "fallback:noticeKnownButton:midLower")
    ];
}

function waitNoticeGone(timeoutMs) {
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        var items = ocrRegion(STAGE, "确认预约须知是否消失", null);
        var titleItem = findTextItem(items, "预约须知", "top");
        var readItem = findTextItem(items, ["我已阅", "我已阅读并同意", "阅读并同意"], "bottom");
        var knownItem = findTextItem(items, ["我已知晓", "已知晓", "知晓"], "bottom");
        if (!titleItem && !readItem && !knownItem) {
            logx("PAGE", "预约须知弹窗已消失 cost=" + (Date.now() - start) + "ms");
            return true;
        }
        sleep(250);
    }
    logx("PAGE", "预约须知弹窗仍存在 cost=" + (Date.now() - start) + "ms");
    return false;
}

function enterHomeExhibitionPage() {
    for (var attempt = 1; attempt <= 3; attempt++) {
        logx("PAGE", "进入第一展馆尝试 attempt=" + attempt);
        var p = getHomeExhibitPoint();
        if (!p) {
            logx("PAGE", "未获得第一展馆入口坐标");
            return false;
        }
        pressPoint("首页-南京大屠杀入口", p, CONFIG.pressDuration);
        var ok = waitForText("参观预约-普通预约", ["普通预约", "亲子预约", "优待预约"], [0, scaleY(600), device.width, scaleY(1700)], 6000);
        if (ok) return true;
        logx("PAGE", "点击首页入口后未确认展馆页 attempt=" + attempt);
    }
    return false;
}

function handleLoginIfNeeded() {
    var items = ocrRegion(STAGE, "检查登录页", [0, scaleY(500), device.width, scaleY(1900)]);
    var loginItem = findTextItem(items, ["用户确认登录", "确认登录"], "top");
    var readItem = findTextItem(items, ["阅读并同意", "阅读"], "bottom");
    if (!loginItem && !readItem) {
        logx("LOGIN", "未发现登录页");
        return false;
    }

    logx("LOGIN", "发现登录页，执行授权登录分支");
    if (readItem) {
        var r = itemRect(readItem);
        var agreePoint = makePoint(Math.max(scaleX(125), r.left + scaleX(20)), r.cy, "ocr:loginReadAgree");
        pressPoint("登录-阅读同意", agreePoint, CONFIG.pressDuration);
        sleep(250);
    }
    if (!loginItem) {
        loginItem = findTextItem(ocrRegion(STAGE, "刷新查找用户确认登录", [0, scaleY(900), device.width, scaleY(900)]), ["用户确认登录", "确认登录"], "top");
    }
    if (loginItem) {
        pressPoint("登录-用户确认登录", centerOfBounds(loginItem.bounds, "ocr:loginConfirm"), CONFIG.pressDuration);
        sleep(1500);
    }
    return true;
}

function waitForBookingPageOnly(timeoutMs) {
    var start = Date.now();
    while (Date.now() - start < timeoutMs) {
        var datePoint = findPointByText("预约页-参观日期", "参观日期", [0, scaleY(500), device.width, scaleY(900)], "top");
        if (datePoint) {
            logx("PAGE", "已确认进入预约页 cost=" + (Date.now() - start) + "ms");
            return true;
        }
        sleep(CONFIG.pageWaitInterval);
    }
    logx("PAGE", "等待普通预约详情页超时 cost=" + (Date.now() - start) + "ms");
    return false;
}

function reenterBookingPageAfterLogin() {
    logx("LOGIN", "登录后按固定路径重新进入预约页：首页 -> 南京大屠杀展馆 -> 普通预约");
    // 业务前提：授权登录完成后小程序会回到首页。
    // 因此不再用 OCR 检查是否仍在预约详情页，避免登录后首页场景被慢 OCR 拖住。

    if (!enterHomeExhibitionPage()) {
        logx("LOGIN", "登录后未能重新进入参观预约页");
        return false;
    }

    var p = getNormalBookingPoint();
    pressPoint("普通预约-登录后重进", p, CONFIG.pressDuration);
    sleep(1500);
    return waitForBookingPageOnly(12000);
}

function enterBookingPageForCollect() {
    var p = getNormalBookingPoint();
    pressPoint("普通预约", p, CONFIG.pressDuration);
    logx("LOGIN", "点击普通预约后等待2秒，再判断本轮是否需要授权登录");
    sleep(2000);

    var loginHandled = handleLoginIfNeeded();
    if (loginHandled) {
        logx("LOGIN", "本轮已完成授权登录，按登录后固定路径继续");
        sleep(1800);
        if (!reenterBookingPageAfterLogin()) {
            logx("PAGE", "登录后未确认进入预约页");
            return false;
        }
        return true;
    } else {
        logx("LOGIN", "点击普通预约后未出现授权登录，本轮按无需登录处理");
    }

    if (!waitForBookingPageOnly(25000)) {
        logx("PAGE", "未确认进入预约页");
        return false;
    }
    return true;
}

function returnToExhibitionPage() {
    for (var i = 0; i < 3; i++) {
        goBackLogged("第一轮采集完成，返回参观预约页");
        var p = waitForText("参观预约-普通预约", "普通预约", [0, scaleY(700), device.width, scaleY(1700)], 2500);
        if (p) {
            logx("PAGE", "已停留在参观预约页");
            return true;
        }
    }
    logx("PAGE", "返回参观预约页未确认");
    return false;
}

function prepareFlow() {
    STAGE = "PREP";
    notifyUser("第一轮开始：预热与采集");
    logx("FLOW", "第一轮预热与采集开始");
    launchMiniProgram();
    handleStartupNoticeDialog();
    if (!enterHomeExhibitionPage()) fail("未能进入参观预约页，请查看截图/OCR日志");
    if (!enterBookingPageForCollect()) fail("未能进入普通预约详情页，请查看截图/OCR日志");
    collectDatePoint();
    collectAudienceAndPeriodPoints();
    saveCache();
    if (!returnToExhibitionPage()) fail("第一轮采集后未能返回参观预约页");
    logx("FLOW", "第一轮预热与采集结束");
    notifyUser("第一轮完成：已返回参观预约页，开始等待抢票时间");
}

function parseStartTime() {
    var m = String(CONFIG.startTime).match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!m) fail("startTime 格式错误，应为 HH:mm:ss 或 HH:mm:ss.SSS");
    var hour = parseInt(m[1], 10);
    var minute = parseInt(m[2], 10);
    var second = parseInt(m[3], 10);
    var millisecond = m[4] ? parseInt((m[4] + "00").substring(0, 3), 10) : 0;
    if (hour < 0 || hour > 23 || minute > 59 || second > 59) {
        fail("startTime 时间值越界，应为 00:00:00 到 23:59:59.999");
    }
    var d = new Date();
    d.setHours(hour, minute, second, millisecond);
    return d;
}

function waitUntilPreRushProbeTime(target) {
    var probeAt = target.getTime() - CONFIG.preRushLoginProbeLeadMs;
    var diff = probeAt - Date.now();
    while (diff > 0) {
        var sleepMs = Math.min(diff, 30000);
        logx("TIME", "等待抢票前登录探测，剩余 " + Math.round(diff / 1000) + "s sleep=" + sleepMs + "ms");
        sleep(sleepMs);
        diff = probeAt - Date.now();
    }
}

function waitForNormalBookingListQuick(label, timeoutMs) {
    return waitForText(label, "普通预约", [0, scaleY(700), device.width, scaleY(1700)], timeoutMs);
}

function preRushLoginProbe() {
    STAGE = "PROBE";
    var start = Date.now();
    logx("FLOW", "抢票前登录探测开始");
    notifyUser("抢票前登录探测开始");

    pressPoint("登录探测-普通预约", requireCachedPoint("normalBooking", "普通预约"), CONFIG.fastPressDuration);
    sleep(2000);

    if (handleLoginIfNeeded()) {
        logx("LOGIN", "登录探测发现授权登录，已完成登录，按首页缓存入口返回参观预约页");
        sleep(1000);
        // 业务前提：抢票前探测轮完成授权登录后，小程序会回到首页。
        // 因此这里直接使用第一轮缓存的首页展馆入口坐标，避免额外页面分支和 OCR。
        pressPoint("登录探测-首页南京大屠杀入口", requireCachedPoint("homeExhibit", "首页南京大屠杀入口"), CONFIG.fastPressDuration);
        sleep(1100);
        waitForNormalBookingListQuick("登录探测-确认参观预约页", 1500);
    } else {
        logx("LOGIN", "登录探测未发现授权登录，返回参观预约页");
        goBackLogged("登录探测未出现登录，返回参观预约页");
        waitForNormalBookingListQuick("登录探测-确认返回参观预约页", 1200);
    }

    logx("FLOW", "抢票前登录探测结束 totalCost=" + (Date.now() - start) + "ms");
    notifyUser("抢票前登录探测完成，等待抢票时间");
}

function waitUntilStartTime() {
    STAGE = "WAIT";
    var target = parseStartTime();
    var diff = target.getTime() - Date.now();
    logx("TIME", "当前时间=" + nowText() + " 目标时间=" + target.toString() + " 剩余=" + diff + "ms");
    if (diff <= 0) {
        logx("TIME", "目标时间已到或已过，立即执行第二轮");
        logRushPlan("startTime已到或已过");
        notifyUser("目标时间已到，立即开始第二轮");
        return;
    }
    notifyUser("等待抢票时间：" + CONFIG.startTime);
    logRushPlan("进入等待阶段");

    if (diff > CONFIG.preRushLoginProbeLeadMs) {
        logx("TIME", "距离抢票超过登录探测提前量，计划在抢票前 " + Math.round(CONFIG.preRushLoginProbeLeadMs / 1000) + " 秒执行登录探测");
        waitUntilPreRushProbeTime(target);
        preRushLoginProbe();
        STAGE = "WAIT";
        diff = target.getTime() - Date.now();
        logRushPlan("登录探测完成，进入最终等待");
    } else {
        logx("TIME", "距离抢票不足或等于登录探测提前量，跳过登录探测 diff=" + diff + "ms lead=" + CONFIG.preRushLoginProbeLeadMs + "ms");
    }

    while (diff > 15000) {
        var sleepMs = Math.min(diff - 12000, 30000);
        logx("TIME", "等待中，剩余 " + Math.round(diff / 1000) + "s sleep=" + sleepMs + "ms");
        sleep(sleepMs);
        diff = target.getTime() - Date.now();
    }
    if (diff > 1200) {
        logx("TIME", "临近目标时间，休眠到提前 1.2s diff=" + diff + "ms");
        sleep(diff - 1200);
    }
    logRushPlan("进入最后轮询前");
    logx("TIME", "进入最后轮询");
    while (Date.now() < target.getTime()) {
        // 最后阶段不输出日志，减少耗时。
    }
    logx("TIME", "准点触发 误差=" + (Date.now() - target.getTime()) + "ms");
    notifyUser("抢票时间到，第二轮开始");
}

function rushFlow() {
    STAGE = "RUSH";
    var rushStart = Date.now();
    notifyUser("第二轮开始：正式抢票");
    logx("FLOW", "第二轮正式抢票开始");

    pressPoint("普通预约", getNormalBookingPoint(), CONFIG.fastPressDuration);
    sleep(650);

    var datePoint = getCachedPoint("targetDate");
    if (!datePoint) datePoint = collectDatePoint();
    pressPoint("目标日期 " + CONFIG.visitDate, datePoint, CONFIG.fastPressDuration);
    sleep(120);

    var periodPoint = getPeriodPoint();
    pressPoint("选择时段 " + CONFIG.period, periodPoint, CONFIG.fastPressDuration);
    sleep(120);

    scrollToAudienceForRush();
    sleep(CONFIG.afterAudienceScrollMs);

    var visitorPoints = getVisitorPointsForRush();
    for (var i = 0; i < CONFIG.visitorCount; i++) {
        var vp = visitorPoints[i];
        pressPoint("游客 " + (i + 1), vp, CONFIG.visitorPressDuration);
        sleep(CONFIG.visitorIntervalMs);
    }

    var confirm = getConfirmButtonPoint();
    pressPoint("确认预约", confirm, CONFIG.fastPressDuration);
    var captchaResult = solveCaptchaAfterConfirmForRush();
    if (captchaResult && captchaResult.manualFallback) {
        logx("FLOW", "第二轮已点击确认预约，验证码进入人工兜底 totalCost=" + (Date.now() - rushStart) + "ms reason=" + captchaResult.reason);
        return { ok: false, manualFallback: true, reason: captchaResult.reason };
    }
    logx("FLOW", "第二轮正式抢票结束 totalCost=" + (Date.now() - rushStart) + "ms");
    notifyUser("第二轮已完成确认后处理，请查看页面结果和日志");
    captureDiagnostics("rush_after_confirm", CONFIG.diagnostics && CONFIG.diagnostics.ocrAfterRush);
    return { ok: true, captcha: captchaResult };
}

function validateConfig() {
    if (!/^\d{4}$/.test(CONFIG.visitDate)) fail("visitDate 必须是四位 MMDD 字符串，例如 0505/0425");
    var m = parseInt(CONFIG.visitDate.substring(0, 2), 10);
    var d = parseInt(CONFIG.visitDate.substring(2, 4), 10);
    if (m < 1 || m > 12) fail("visitDate 月份无效：" + CONFIG.visitDate);
    var days = new Date(new Date().getFullYear(), m, 0).getDate();
    if (d < 1 || d > days) fail("visitDate 日期无效：" + CONFIG.visitDate);
    if (CONFIG.period !== "上午" && CONFIG.period !== "下午") fail("period 只能是 上午 或 下午");
    if (CONFIG.visitorCount < 1 || CONFIG.visitorCount > 5) fail("visitorCount 必须在 1 到 5 之间");
    parseStartTime();
}

function initRuntime() {
    auto.waitFor();
    runtime.screen = { width: device.width, height: device.height };
    runtime.latestLogPath = CONFIG.logPath;
    runtime.logPath = CONFIG.outputDir + "/nanjing_booking_run_" + fileTimeText() + ".log";
    try {
        files.ensureDir(CONFIG.logPath);
        files.ensureDir(runtime.logPath);
        files.ensureDir(CONFIG.cachePath);
    } catch (ignoredCreateDir) {}
    try {
        files.remove(runtime.latestLogPath);
    } catch (ignored) {}
    logx("INIT", "脚本启动 version=" + CONFIG.version);
    logx("INIT", "配置=" + JSON.stringify(CONFIG));
    logx("INIT", "屏幕=" + device.width + "x" + device.height);
    logx("INIT", "缓存路径 primary=" + CONFIG.cachePath + " backup=" + CONFIG.backupCachePath);
    logx("INIT", "本次日志路径=" + runtime.logPath + " latest日志路径=" + runtime.latestLogPath);
    notifyUser("预约脚本启动，正在请求截图权限");

    if (!requestScreenCapture()) {
        fail("请求截图权限失败");
    }
    logx("INIT", "截图权限已获取");
    notifyUser("截图权限已获取，开始读取缓存");
    loadCache();
}

function main() {
    var failed = false;
    try {
        validateConfig();
        initRuntime();
        prepareFlow();
        if (CONFIG.prepareOnly) {
            STAGE = "END";
            logx("FLOW", "prepareOnly=true，第一轮完成后直接退出，不等待 startTime，不执行第二轮");
            finalNotifyUser("仅第一轮模式：已完成采集并退出，请查看日志");
            return;
        }
        waitUntilStartTime();
        var rushResult = rushFlow();
        if (rushResult && rushResult.manualFallback) {
            finalNotifyUser("验证码已保留现场，等待人工兜底，请查看日志");
        } else {
            finalNotifyUser("预约脚本正常结束，请查看日志");
        }
    } catch (e) {
        failed = true;
        logx("FATAL", "脚本异常：" + e + " stack=" + (e && e.stack ? e.stack : ""));
        finalNotifyUser("预约脚本异常退出，请查看日志：" + e);
        captureDiagnostics("fatal_" + STAGE, CONFIG.diagnostics && CONFIG.diagnostics.ocrOnError);
    } finally {
        saveCache();
        logx("END", "日志路径=" + runtime.logPath + " 缓存路径=" + runtime.cachePath);
        finalNotifyUser((failed ? "异常日志已写入：" : "日志已写入：") + runtime.logPath);
    }
}

main();
