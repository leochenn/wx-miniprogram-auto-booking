/*
 * 数学验证码离线图片批量测试脚本。
 *
 * 用法：
 * 1. 将本脚本与 nanjing_booking_captcha_solver.js 放在同一脚本目录，或保持仓库结构 project/ + 新需求截图/。
 * 2. 在 OpenAutoJS 中运行本脚本。
 * 3. 脚本会读取“新需求截图”目录下的 png/jpg/jpeg 图片，按文件名计算期望答案，并输出逐图识别结果。
 */

var CONFIG = {
    baseScreen: { width: 1440, height: 3040 },
    outputDir: "/sdcard/OpenAutoJS_NanjingBooking",
    captcha: {
        moduleFileName: "nanjing_booking_captcha_solver.js",
        expressionRegion: { x: 455, y: 1160, w: 570, h: 200 },
        expressionRegions: [
            { name: "mockLargeText", x: 455, y: 1160, w: 570, h: 200, templateEnabled: true },
            { name: "wechatImageWide", x: 250, y: 820, w: 940, h: 300, templateEnabled: false },
            { name: "wechatImageStrip", x: 295, y: 860, w: 850, h: 150, templateEnabled: false }
        ],
        preferOcr: true,
        rawOcrEnabled: false,
        usePreprocessedOcr: true,
        whiteThreshold: 245,
        templateGrid: { w: 24, h: 32 },
        minGlyphScore: 0.22,
        inputMethod: { enabled: false },
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

var runtime = {
    captchaTemplates: null,
    captchaStats: null
};

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

function logx(msg) {
    var line = "[" + nowText() + "][CAPTCHA_IMAGE_TEST] " + msg;
    log(line);
}

function clamp(v, min, max) {
    v = Math.round(v);
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

function joinPath(dir, name) {
    if (!dir) return name;
    return dir + (dir.charAt(dir.length - 1) === "/" ? "" : "/") + name;
}

function parentDir(path) {
    path = String(path || "");
    var i = path.lastIndexOf("/");
    if (i <= 0) return "";
    return path.substring(0, i);
}

function currentScriptDir() {
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

function addUniquePath(list, path) {
    if (!path) return;
    for (var i = 0; i < list.length; i++) {
        if (list[i] === path) return;
    }
    list.push(path);
}

function resolveCaptchaModulePath() {
    var name = CONFIG.captcha.moduleFileName;
    var dir = currentScriptDir();
    var parent = parentDir(dir);
    var candidates = [];
    addUniquePath(candidates, joinPath(dir, name));
    addUniquePath(candidates, joinPath(parent, "project/" + name));
    addUniquePath(candidates, joinPath(parent, name));
    try {
        addUniquePath(candidates, joinPath(files.cwd(), name));
        addUniquePath(candidates, joinPath(files.cwd(), "project/" + name));
    } catch (ignoredCwd) {}
    addUniquePath(candidates, name);
    addUniquePath(candidates, "project/" + name);
    for (var i = 0; i < candidates.length; i++) {
        try {
            if (files.exists(candidates[i])) return candidates[i];
        } catch (ignoredExists) {}
    }
    throw new Error("验证码模块未找到 candidates=" + candidates.join("|"));
}

function resolveSampleDir() {
    var dir = currentScriptDir();
    var parent = parentDir(dir);
    var candidates = [];
    addUniquePath(candidates, joinPath(parent, "新需求截图"));
    addUniquePath(candidates, joinPath(dir, "新需求截图"));
    try {
        addUniquePath(candidates, joinPath(files.cwd(), "新需求截图"));
    } catch (ignoredCwd) {}
    addUniquePath(candidates, "/sdcard/OpenAutoJS_NanjingBooking/新需求截图");
    addUniquePath(candidates, "/sdcard/新需求截图");
    addUniquePath(candidates, "新需求截图");
    for (var i = 0; i < candidates.length; i++) {
        try {
            if (files.exists(candidates[i]) && files.isDir(candidates[i])) return candidates[i];
        } catch (ignoredExists) {}
    }
    throw new Error("样本目录未找到 candidates=" + candidates.join("|"));
}

function loadCaptchaSolverForImageTest() {
    var modulePath = resolveCaptchaModulePath();
    var code = files.read(modulePath);
    var exposedReturn = "return { solveAfterConfirm: solveAfterConfirm, " +
        "__testRecognizeMath: function(img, regions) { return recognizeCaptchaAcrossRegions(img, regions); } };";
    var patched = code.replace(/return\s*\{\s*solveAfterConfirm:\s*solveAfterConfirm\s*\};/, exposedReturn);
    if (patched === code) {
        throw new Error("验证码模块测试接口注入失败，未匹配到 return solveAfterConfirm");
    }
    var factory = eval("(function(){ var module = { exports: null }; var exports = {}; " +
        patched + "\n; return module.exports || createNanjingBookingCaptchaSolver; })()");
    if (typeof factory !== "function") {
        throw new Error("验证码模块导出异常 path=" + modulePath);
    }
    logx("验证码模块已加载 path=" + modulePath);
    return factory({
        config: CONFIG,
        runtime: runtime,
        log: logx,
        notifyUser: function (msg) { logx("notify=" + msg); },
        fileTimeText: fileTimeText,
        scaleX: function (x) { return x; },
        scaleY: function (y) { return y; },
        clamp: clamp,
        pressPoint: function () { return false; },
        makePoint: function (x, y, source) {
            return { x: Math.round(x), y: Math.round(y), source: source || "" };
        }
    });
}

function imageWidth(img) {
    if (img && typeof img.getWidth === "function") return img.getWidth();
    if (img && typeof img.width === "number") return img.width;
    if (img && typeof img.getBitmap === "function") return img.getBitmap().getWidth();
    return 0;
}

function imageHeight(img) {
    if (img && typeof img.getHeight === "function") return img.getHeight();
    if (img && typeof img.height === "number") return img.height;
    if (img && typeof img.getBitmap === "function") return img.getBitmap().getHeight();
    return 0;
}

function buildImageRegions(img) {
    var w = imageWidth(img);
    var h = imageHeight(img);
    var regions = [];
    var source = CONFIG.captcha.expressionRegions;
    for (var i = 0; i < source.length; i++) {
        var cfg = source[i];
        var x = Math.round(cfg.x * w / CONFIG.baseScreen.width);
        var y = Math.round(cfg.y * h / CONFIG.baseScreen.height);
        var rw = Math.round(cfg.w * w / CONFIG.baseScreen.width);
        var rh = Math.round(cfg.h * h / CONFIG.baseScreen.height);
        regions.push({
            x: clamp(x, 0, w - 1),
            y: clamp(y, 0, h - 1),
            w: clamp(rw, 1, w - x),
            h: clamp(rh, 1, h - y),
            name: cfg.name || ("region" + (i + 1)),
            templateEnabled: cfg.templateEnabled !== false
        });
    }
    return regions;
}

function listImageFiles(dir) {
    var names = files.listDir(dir) || [];
    var result = [];
    for (var i = 0; i < names.length; i++) {
        var name = String(names[i]);
        if (/\.(png|jpg|jpeg)$/i.test(name)) {
            result.push(joinPath(dir, name));
        }
    }
    result.sort();
    return result;
}

function basename(path) {
    path = String(path || "");
    var slash = path.lastIndexOf("/");
    return slash >= 0 ? path.substring(slash + 1) : path;
}

function stripExt(name) {
    return String(name || "").replace(/\.[^.]+$/, "");
}

function expectedFromFileName(path) {
    var name = stripExt(basename(path));
    var expr = name
        .replace(/乘以/g, "×")
        .replace(/乘/g, "×")
        .replace(/[xX*]/g, "×")
        .replace(/[＋]/g, "+")
        .replace(/[－−]/g, "-");
    var m = expr.match(/^(\d{1,2})([+\-\u00d7\u00f7])(\d{1,2})$/);
    if (!m) return { ok: false, raw: name, reason: "filename_parse_failed" };
    var a = parseInt(m[1], 10);
    var b = parseInt(m[3], 10);
    var op = m[2];
    var answer;
    if (op === "+") answer = a + b;
    else if (op === "-") answer = a - b;
    else if (op === "×") answer = a * b;
    else if (op === "÷") answer = a / b;
    else return { ok: false, raw: name, reason: "unknown_operator" };
    if (Math.floor(answer) !== answer) return { ok: false, raw: name, reason: "non_integer_answer" };
    return {
        ok: true,
        raw: name,
        expression: String(a) + op + String(b),
        answer: String(answer)
    };
}

function csvCell(value) {
    value = String(value === undefined || value === null ? "" : value);
    return "\"" + value.replace(/"/g, "\"\"") + "\"";
}

function main() {
    var sampleDir = resolveSampleDir();
    var solver = loadCaptchaSolverForImageTest();
    if (!solver || typeof solver.__testRecognizeMath !== "function") {
        throw new Error("验证码测试接口不可用");
    }

    var imageFiles = listImageFiles(sampleDir);
    if (!imageFiles.length) {
        throw new Error("样本目录无图片 dir=" + sampleDir);
    }

    var reportPath = joinPath(CONFIG.outputDir, "captcha_image_batch_test_" + fileTimeText() + ".csv");
    files.ensureDir(reportPath);
    var lines = [
        ["file", "expectedExpression", "expectedAnswer", "pass", "recognizedExpression", "recognizedAnswer", "raw", "detail", "reason", "regions", "imageSize"]
            .map(csvCell).join(",")
    ];

    var pass = 0;
    var fail = 0;
    logx("开始批量测试 dir=" + sampleDir + " count=" + imageFiles.length + " rawOcrEnabled=" + CONFIG.captcha.rawOcrEnabled);
    for (var i = 0; i < imageFiles.length; i++) {
        var path = imageFiles[i];
        var img = null;
        var expected = expectedFromFileName(path);
        var result = null;
        var ok = false;
        var reason = "";
        var regionsText = "";
        var imageSize = "";
        try {
            img = images.read(path);
            if (!img) throw new Error("images.read returned null");
            imageSize = imageWidth(img) + "x" + imageHeight(img);
            var regions = buildImageRegions(img);
            regionsText = JSON.stringify(regions);
            runtime.captchaStats = null;
            result = solver.__testRecognizeMath(img, regions);
            ok = !!(expected.ok && result && result.ok && result.answer === expected.answer);
            reason = result && result.reason ? result.reason : "";
        } catch (e) {
            result = { ok: false, raw: "", expression: "", answer: "", detail: "", reason: String(e) };
            reason = String(e);
            ok = false;
        } finally {
            if (img) {
                try { img.recycle(); } catch (ignoredRecycle) {}
            }
        }

        if (ok) pass++;
        else fail++;

        var mark = ok ? "PASS" : "FAIL";
        var recognizedExpression = result && result.expression ? result.expression : "";
        var recognizedAnswer = result && result.answer ? result.answer : "";
        var raw = result && result.raw ? result.raw : "";
        var detail = result && result.detail ? result.detail : "";
        logx(mark +
            " file=" + basename(path) +
            " expected=" + (expected.expression || expected.raw) +
            " expectedAnswer=" + (expected.answer || "") +
            " recognized=" + recognizedExpression +
            " answer=" + recognizedAnswer +
            " raw=" + raw +
            " detail=" + detail +
            " reason=" + reason);

        lines.push([
            basename(path),
            expected.expression || expected.raw,
            expected.answer || "",
            mark,
            recognizedExpression,
            recognizedAnswer,
            raw,
            detail,
            reason,
            regionsText,
            imageSize
        ].map(csvCell).join(","));
    }

    files.write(reportPath, lines.join("\n"));
    logx("批量测试完成 pass=" + pass + " fail=" + fail + " total=" + imageFiles.length + " report=" + reportPath);
    toastLog("数学验证码样本测试完成：" + pass + "/" + imageFiles.length);
}

try {
    main();
} catch (e) {
    logx("批量测试异常 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
    toastLog("数学验证码样本测试异常：" + e);
}
