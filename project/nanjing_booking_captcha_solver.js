/*
 * 南京预约验证码处理模块。
 * 该文件由正式脚本在同一 OpenAutoJS 引擎内加载，复用已获取的截图权限、日志、坐标缩放和点击函数。当前支持两类弹窗：数学题验证码、滑块验证码。
 */

function createNanjingBookingCaptchaSolver(deps) {
    var CONFIG = deps.config;
    var runtime = deps.runtime;

    function logx(msg) {
        deps.log(msg);
    }

    function scaleX(x) {
        return deps.scaleX(x);
    }

    function scaleY(y) {
        return deps.scaleY(y);
    }

    function clamp(v, min, max) {
        return deps.clamp(v, min, max);
    }

    function basePoint(name, x, y) {
        return deps.makePoint(scaleX(x), scaleY(y), "captcha-ratio:" + name);
    }

    function scaledRegion(region) {
        var x = scaleX(region.x);
        var y = scaleY(region.y);
        return {
            x: clamp(x, 0, device.width - 1),
            y: clamp(y, 0, device.height - 1),
            w: clamp(scaleX(region.w), 1, device.width - x),
            h: clamp(scaleY(region.h), 1, device.height - y)
        };
    }

    function buildExpressionRegions() {
        var source = CONFIG.captcha.expressionRegions;
        if (!source || !source.length) {
            source = [CONFIG.captcha.expressionRegion];
        }
        var regions = [];
        for (var i = 0; i < source.length; i++) {
            var cfg = source[i];
            var region = scaledRegion(cfg);
            region.name = cfg.name || ("region" + (i + 1));
            region.templateEnabled = cfg.templateEnabled !== false;
            regions.push(region);
        }
        return regions;
    }

    function recognitionHasRaw(result) {
        return !!(result && result.raw && String(result.raw).length > 0);
    }

    function isEmptyRecognitionResult(result) {
        if (!result) return true;
        if (recognitionHasRaw(result)) return false;
        return String(result.reason || "").indexOf("raw=") >= 0 ||
            String(result.reason || "").indexOf("ocr_parse_failed") >= 0 ||
            String(result.reason || "").indexOf("glyph_count=0") >= 0;
    }

    function newCaptchaStats() {
        return {
            wait: 0,
            capture: 0,
            recognize: 0,
            ocrRaw: -1,
            preprocess: -1,
            ocrPreprocessed: -1,
            templateBuild: -1,
            glyphScan: -1,
            templateClassify: -1,
            input: 0,
            saveFailure: -1,
            raw: "",
            expression: "",
            answer: "",
            detail: "",
            captchaType: "",
            outcome: "unknown",
            reason: ""
        };
    }

    function captchaStatsText(stats, total) {
        if (!stats) return "stats=null";
        return "outcome=" + stats.outcome +
            " wait=" + stats.wait + "ms" +
            " capture=" + stats.capture + "ms" +
            " recognize=" + stats.recognize + "ms" +
            " ocrRaw=" + stats.ocrRaw + "ms" +
            " preprocess=" + stats.preprocess + "ms" +
            " ocrPreprocessed=" + stats.ocrPreprocessed + "ms" +
            " templateBuild=" + stats.templateBuild + "ms" +
            " glyphScan=" + stats.glyphScan + "ms" +
            " templateClassify=" + stats.templateClassify + "ms" +
            " input=" + stats.input + "ms" +
            " saveFailure=" + stats.saveFailure + "ms" +
            " total=" + total + "ms" +
            " raw=" + stats.raw +
            " expression=" + stats.expression +
            " answer=" + stats.answer +
            " type=" + stats.captchaType +
            " detail=" + stats.detail +
            " reason=" + stats.reason;
    }

    function imagePixel(img, x, y) {
        if (img && typeof img.pixel === "function") {
            return img.pixel(x, y);
        }
        return images.pixel(img, x, y);
    }

    function isWhiteCaptchaPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        return min >= CONFIG.captcha.whiteThreshold && (max - min) <= 28;
    }

    function saveCaptchaFailure(img, region, reason) {
        var saveStart = Date.now();
        var stamp = deps.fileTimeText();
        var fullPath = CONFIG.outputDir + "/captcha_fail_full_" + stamp + ".png";
        var cropPath = CONFIG.outputDir + "/captcha_fail_expr_" + stamp + ".png";
        var preprocessPath = CONFIG.outputDir + "/captcha_fail_preprocessed_" + stamp + ".png";
        var clip = null;
        var processed = null;
        try {
            images.save(img, fullPath);
            if (region) {
                clip = images.clip(img, region.x, region.y, region.w, region.h);
                images.save(clip, cropPath);
                processed = preprocessCaptchaClipForOcr(clip);
                if (processed) {
                    images.save(processed, preprocessPath);
                }
            }
            logx("验证码识别失败截图已保存 reason=" + reason + " full=" + fullPath +
                (region ? " crop=" + cropPath : "") +
                (processed ? " preprocessed=" + preprocessPath : ""));
        } catch (e) {
            logx("验证码识别失败截图保存异常 reason=" + reason + " err=" + e);
        } finally {
            if (runtime.captchaStats) {
                runtime.captchaStats.saveFailure = Date.now() - saveStart;
            }
            if (processed) {
                try { processed.recycle(); } catch (ignoredProcessed) {}
            }
            if (clip) {
                try { clip.recycle(); } catch (ignoredClip) {}
            }
        }
    }

    function preprocessCaptchaClipForOcr(clip) {
        var gray = null;
        var processed = null;
        var start = Date.now();
        try {
            gray = images.grayscale(clip);
            processed = images.threshold(gray, CONFIG.captcha.whiteThreshold, 255, "BINARY_INV");
            if (runtime.captchaStats) {
                runtime.captchaStats.preprocess = Date.now() - start;
            }
            return processed;
        } catch (e) {
            if (runtime.captchaStats) {
                runtime.captchaStats.preprocess = Date.now() - start;
            }
            if (processed) {
                try { processed.recycle(); } catch (ignoredProcessed) {}
            }
            logx("验证码预处理失败，将跳过预处理 OCR err=" + e);
            return null;
        } finally {
            if (gray) {
                try { gray.recycle(); } catch (ignoredGray) {}
            }
        }
    }

    function findCaptchaGlyphs(img, region) {
        var colCount = [];
        var x;
        var y;
        for (x = 0; x < region.w; x++) colCount[x] = 0;

        for (y = 0; y < region.h; y++) {
            for (x = 0; x < region.w; x++) {
                if (isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y))) {
                    colCount[x]++;
                }
            }
        }

        var glyphs = [];
        var inRun = false;
        var startX = 0;
        for (x = 0; x <= region.w; x++) {
            var active = x < region.w && colCount[x] >= 3;
            if (active && !inRun) {
                startX = x;
                inRun = true;
            } else if ((!active || x === region.w) && inRun) {
                var endX = x - 1;
                inRun = false;
                var box = refineGlyphBox(img, region, startX, endX);
                if (box && box.area >= 45 && box.w >= 4 && box.h >= 5) {
                    glyphs.push(box);
                }
            }
        }

        return mergeNarrowCaptchaGlyphs(glyphs);
    }

    function refineGlyphBox(img, region, leftX, rightX) {
        var minX = region.w;
        var minY = region.h;
        var maxX = -1;
        var maxY = -1;
        var area = 0;
        for (var y = 0; y < region.h; y++) {
            for (var x = leftX; x <= rightX; x++) {
                if (isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y))) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    area++;
                }
            }
        }
        if (maxX < minX || maxY < minY) return null;
        return {
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            area: area
        };
    }

    function mergeNarrowCaptchaGlyphs(glyphs) {
        if (glyphs.length <= 1) return glyphs;
        glyphs.sort(function (a, b) { return a.x - b.x; });
        var merged = [];
        for (var i = 0; i < glyphs.length; i++) {
            var g = glyphs[i];
            var last = merged.length ? merged[merged.length - 1] : null;
            var gap = last ? g.x - (last.x + last.w) : 999;
            var tiny = g.area < 80 || g.w < 8 || g.h < 12;
            if (last && tiny && gap <= 18) {
                var x1 = Math.min(last.x, g.x);
                var y1 = Math.min(last.y, g.y);
                var x2 = Math.max(last.x + last.w, g.x + g.w);
                var y2 = Math.max(last.y + last.h, g.y + g.h);
                last.x = x1;
                last.y = y1;
                last.w = x2 - x1;
                last.h = y2 - y1;
                last.area += g.area;
            } else if (!tiny) {
                merged.push(g);
            }
        }
        return merged;
    }

    function buildCaptchaTemplates() {
        if (runtime.captchaTemplates) return runtime.captchaTemplates;
        var start = Date.now();
        var chars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", "\u00d7", "\u00f7", "=", "?"];
        var templates = {};
        for (var i = 0; i < chars.length; i++) {
            var ch = chars[i];
            templates[ch] = renderTemplateGlyph(ch);
        }
        runtime.captchaTemplates = templates;
        if (runtime.captchaStats) {
            runtime.captchaStats.templateBuild = Date.now() - start;
        }
        return templates;
    }

    function renderTemplateGlyph(ch) {
        var Bitmap = android.graphics.Bitmap;
        var Canvas = android.graphics.Canvas;
        var Paint = android.graphics.Paint;
        var Color = android.graphics.Color;

        var paint = new Paint();
        paint.setAntiAlias(true);
        paint.setColor(Color.WHITE);
        paint.setTextSize(132);

        var width = 190;
        var height = 190;
        var bitmap = createTemplateBitmap(Bitmap, width, height);
        var canvas = new Canvas(bitmap);
        canvas.drawColor(Color.BLACK);
        canvas.drawText(String(ch), 25, 140, paint);

        var box = trimBitmapGlyph(bitmap);
        var grid = sampleBitmapGlyph(bitmap, box);
        try { bitmap.recycle(); } catch (ignored) {}
        return grid;
    }

    function createTemplateBitmap(Bitmap, width, height) {
        var lastError = null;
        try {
            return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        } catch (e1) {
            lastError = e1;
        }
        try {
            return Bitmap.createBitmap(width, height, Bitmap.Config.valueOf("ARGB_8888"));
        } catch (e2) {
            lastError = e2;
        }
        throw lastError;
    }

    function trimBitmapGlyph(bitmap) {
        var minX = bitmap.getWidth();
        var minY = bitmap.getHeight();
        var maxX = -1;
        var maxY = -1;
        for (var y = 0; y < bitmap.getHeight(); y++) {
            for (var x = 0; x < bitmap.getWidth(); x++) {
                if (isWhiteCaptchaPixel(bitmap.getPixel(x, y))) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < minX || maxY < minY) {
            return { x: 0, y: 0, w: bitmap.getWidth(), h: bitmap.getHeight() };
        }
        return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    function sampleBitmapGlyph(bitmap, box) {
        return sampleGlyphGrid(box, function (x, y) {
            return isWhiteCaptchaPixel(bitmap.getPixel(x, y));
        });
    }

    function sampleImageGlyph(img, region, box) {
        return sampleGlyphGrid(box, function (x, y) {
            return isWhiteCaptchaPixel(imagePixel(img, region.x + x, region.y + y));
        });
    }

    function sampleGlyphGrid(box, whiteAt) {
        var gridW = CONFIG.captcha.templateGrid.w;
        var gridH = CONFIG.captcha.templateGrid.h;
        var out = [];
        for (var gy = 0; gy < gridH; gy++) {
            for (var gx = 0; gx < gridW; gx++) {
                var x1 = box.x + Math.floor(gx * box.w / gridW);
                var x2 = box.x + Math.max(x1 - box.x + 1, Math.ceil((gx + 1) * box.w / gridW));
                var y1 = box.y + Math.floor(gy * box.h / gridH);
                var y2 = box.y + Math.max(y1 - box.y + 1, Math.ceil((gy + 1) * box.h / gridH));
                var total = 0;
                var hit = 0;
                for (var y = y1; y < y2; y++) {
                    for (var x = x1; x < x2; x++) {
                        total++;
                        if (whiteAt(x, y)) hit++;
                    }
                }
                out.push(hit > 0 && hit / total >= 0.04);
            }
        }
        return out;
    }

    function glyphScore(a, b) {
        var intersection = 0;
        var union = 0;
        for (var i = 0; i < a.length; i++) {
            if (a[i] || b[i]) union++;
            if (a[i] && b[i]) intersection++;
        }
        if (!union) return 0;
        return intersection / union;
    }

    function classifyCaptchaGlyph(img, region, glyph, templates) {
        var sample = sampleImageGlyph(img, region, glyph);
        var bestChar = "";
        var bestScore = -1;
        for (var ch in templates) {
            var score = glyphScore(sample, templates[ch]);
            if (score > bestScore) {
                bestScore = score;
                bestChar = ch;
            }
        }
        return { text: bestChar, score: bestScore };
    }

    function evaluateCaptchaExpression(text) {
        var normalizedResult = normalizeCaptchaOcrTextWithRules(text);
        var normalized = normalizedResult.text;
        var m = normalized.match(/(\d{1,2})([+\-\u00d7\u00f7])(\d{1,2})/);
        if (!m && !hasExplicitOperatorHint(normalized)) {
            var inferred = inferOcrMissingMultiply(normalized);
            if (inferred) {
                inferred.normalized = normalized;
                inferred.rules = normalizedResult.rules.concat([inferred.rule]);
                inferred.ruleText = inferred.rules.join("|");
                return inferred;
            }
        }
        if (!m) return null;
        var a = parseInt(m[1], 10);
        var op = m[2];
        var b = parseInt(m[3], 10);
        var answer;
        if (op === "+") answer = a + b;
        else if (op === "-") answer = a - b;
        else if (op === "\u00d7") answer = a * b;
        else if (op === "\u00f7") answer = a / b;
        else return null;
        if (op === "+" && answer > 99) {
            var divideInferred = inferPlusShouldBeDivide(a, b, normalized, normalizedResult.rules);
            if (divideInferred) return divideInferred;
        }
        if (Math.floor(answer) !== answer || answer < 0 || answer > 99) return null;
        var rules = normalizedResult.rules.length ? normalizedResult.rules.slice() : ["direct_parse"];
        var tail = normalized.substring(m.index + m[0].length);
        var tailNoiseIgnored = false;
        if (!/[=?]/.test(normalized) && /^[+\-\u00d7\u00f7]\d{1,2}$/.test(tail)) {
            rules.push("ignore_tail_operator_digits_as_marker_noise");
            tailNoiseIgnored = true;
        }
        return {
            expression: m[1] + op + m[3],
            answer: String(answer),
            normalized: normalized,
            rules: rules,
            ruleText: rules.join("|"),
            tailNoiseIgnored: tailNoiseIgnored,
            ignoredTail: tail
        };
    }

    function inferPlusShouldBeDivide(a, b, normalized, baseRules) {
        if (!b || a % b !== 0) return null;
        var answer = a / b;
        if (Math.floor(answer) !== answer || answer < 0 || answer > 99) return null;
        var rules = (baseRules || []).concat(["infer_plus_to_divide_when_sum_over_99"]);
        return {
            expression: String(a) + "\u00f7" + String(b),
            answer: String(answer),
            normalized: normalized,
            rules: rules,
            ruleText: rules.join("|")
        };
    }

    function getSuspiciousCaptchaOcrReason(raw, parsed) {
        if (!parsed) return "";
        var normalized = parsed.normalized || normalizeCaptchaOcrText(raw);
        if (/[A-Za-z]/.test(normalized)) {
            return "ocr_has_letter normalized=" + normalized;
        }
        if (!/[=?]/.test(normalized) && !parsed.tailNoiseIgnored) {
            return "ocr_missing_tail_marker normalized=" + normalized;
        }
        var residue = normalized.replace(/[0-9+\-\u00d7\u00f7=?:\uff1a\/]/g, "");
        if (residue.length > 0) {
            return "ocr_has_residue residue=" + residue + " normalized=" + normalized;
        }
        return "";
    }

    function normalizeCaptchaOcrText(text) {
        return normalizeCaptchaOcrTextWithRules(text).text;
    }

    function normalizeCaptchaOcrTextWithRules(text) {
        var value = String(text);
        var rules = [];
        var next = value.replace(/\s+/g, "");
        if (next !== value) {
            rules.push("strip_space");
            value = next;
        }
        next = value.replace(/[xX*]/g, "\u00d7");
        if (next !== value) {
            rules.push("operator_alias_to_multiply");
            value = next;
        }
        next = value.replace(/[\/]/g, "\u00f7");
        if (next !== value) {
            rules.push("operator_alias_to_divide");
            value = next;
        }
        next = value.replace(/(\d{1,2})[:\uff1a](\d{1,2})/g, "$1\u00f7$2");
        if (next !== value) {
            rules.push("colon_between_numbers_to_divide");
            value = next;
        }
        next = value.replace(/[\uff0d\u2212\u2010\u2011\u2012\u2013\u2014]/g, "-");
        if (next !== value) {
            rules.push("dash_alias_to_minus");
            value = next;
        }
        next = value.replace(/([=?])[\.\u3002\uff0e,，]+$/g, "$1");
        if (next !== value) {
            rules.push("strip_tail_punctuation_after_marker");
            value = next;
        }
        return {
            text: value,
            rules: rules
        };
    }

    function hasExplicitOperatorHint(text) {
        return /[+\-\u00d7\u00f7:：\/xX*]/.test(String(text));
    }

    function inferOcrMissingMultiply(text) {
        var beforeEqual = String(text).split("=")[0].replace(/\D/g, "");
        if (beforeEqual.length < 3 || beforeEqual.length > 5) return null;

        var candidates = [];
        function addCandidate(aText, bText) {
            if (!aText || !bText || aText.length > 2 || bText.length > 2) return;
            var a = parseInt(aText, 10);
            var b = parseInt(bText, 10);
            if (!a || !b) return;
            var answer = a * b;
            if (answer <= 99) {
                candidates.push({
                    expression: String(a) + "\u00d7" + String(b),
                    answer: String(answer),
                    rule: "infer_missing_multiply_from_zero"
                });
            }
        }

        if (beforeEqual.charAt(0) === "0") {
            var rest = beforeEqual.substring(1);
            for (var i = 1; i < rest.length; i++) {
                addCandidate(rest.substring(0, i), rest.substring(i));
            }
        }

        for (var z = 1; z < beforeEqual.length - 1; z++) {
            if (beforeEqual.charAt(z) === "0") {
                addCandidate(beforeEqual.substring(0, z), beforeEqual.substring(z + 1));
            }
        }

        if (candidates.length === 1) return candidates[0];
        return null;
    }

    function recognizeCaptchaExpression(img, region) {
        if (CONFIG.captcha.preferOcr) {
            var ocrFirst = recognizeCaptchaByOcr(img, region, "prefer_ocr region=" + (region.name || ""));
            if (ocrFirst.ok) return ocrFirst;
            if (CONFIG.captcha.usePreprocessedOcr) {
                var preprocessedFirst = recognizeCaptchaByPreprocessedOcr(img, region, "prefer_ocr_failed region=" + (region.name || "") + " raw=" + ocrFirst.raw);
                if (preprocessedFirst.ok) return preprocessedFirst;
                logx("验证码预处理 OCR 失败，切换模板识别 reason=" + preprocessedFirst.reason);
            }
            logx("验证码 OCR 主路径失败，切换模板识别 reason=" + ocrFirst.reason);
        }

        if (region.templateEnabled === false) {
            return {
                ok: false,
                reason: "template_disabled region=" + (region.name || "") +
                    " raw=" + ((ocrFirst && ocrFirst.raw) || ""),
                raw: (ocrFirst && ocrFirst.raw) || ""
            };
        }

        var templates;
        var templateStart = Date.now();
        try {
            templates = buildCaptchaTemplates();
        } catch (e) {
            if (runtime.captchaStats) {
                runtime.captchaStats.templateBuild = Date.now() - templateStart;
            }
            logx("验证码模板构建异常，尝试 OCR 兜底 err=" + e);
            return recognizeCaptchaByOcr(img, region, "template_exception region=" + (region.name || "") + " err=" + e);
        }

        var glyphStart = Date.now();
        var glyphs = findCaptchaGlyphs(img, region);
        if (runtime.captchaStats) {
            runtime.captchaStats.glyphScan = Date.now() - glyphStart;
        }
        logx("验证码候选字符数量=" + glyphs.length + " regionName=" + (region.name || "") + " region=" + JSON.stringify(region));
        if (glyphs.length < 3) {
            var ocrByCount = recognizeCaptchaByOcr(img, region, "glyph_count=" + glyphs.length + " region=" + (region.name || ""));
            if (ocrByCount.ok) return ocrByCount;
            return { ok: false, reason: "glyph_count=" + glyphs.length + " ocr=" + ocrByCount.reason, raw: ocrByCount.raw || "" };
        }

        var chars = [];
        var detail = [];
        var scores = [];
        var classifyStart = Date.now();
        for (var i = 0; i < glyphs.length; i++) {
            var item = classifyCaptchaGlyph(img, region, glyphs[i], templates);
            chars.push(item.text);
            scores.push(item.score);
            detail.push(item.text + ":" + item.score.toFixed(2));
        }
        if (runtime.captchaStats) {
            runtime.captchaStats.templateClassify = Date.now() - classifyStart;
        }

        var raw = chars.join("");
        var parsed = evaluateCaptchaExpression(raw);
        if (!parsed) {
            var ocrByParse = recognizeCaptchaByOcr(img, region, "parse_failed region=" + (region.name || "") + " raw=" + raw);
            if (ocrByParse.ok) return ocrByParse;
            return { ok: false, reason: "parse_failed detail=" + detail.join(",") + " ocr=" + ocrByParse.reason, raw: raw };
        }
        for (var j = 0; j < parsed.expression.length; j++) {
            if (scores[j] < CONFIG.captcha.minGlyphScore) {
                var ocrByScore = recognizeCaptchaByOcr(img, region, "low_score region=" + (region.name || "") + " raw=" + raw);
                if (ocrByScore.ok) return ocrByScore;
                return { ok: false, reason: "low_score detail=" + detail.join(",") + " ocr=" + ocrByScore.reason, raw: raw };
            }
        }
        return {
            ok: true,
            raw: raw,
            expression: parsed.expression,
            answer: parsed.answer,
            detail: "region=" + (region.name || "") + " " + detail.join(",")
        };
    }

    function recognizeCaptchaAcrossRegions(img, regions) {
        var reasons = [];
        var sawRaw = false;
        var best = null;
        for (var i = 0; i < regions.length; i++) {
            var region = regions[i];
            logx("数学题验证码尝试区域 name=" + region.name + " templateEnabled=" + region.templateEnabled +
                " region=" + JSON.stringify(region));
            var result = recognizeCaptchaExpression(img, region);
            result.region = region;
            if (result.ok) {
                result.detail = "region=" + region.name + " " + (result.detail || "");
                return result;
            }
            if (recognitionHasRaw(result)) {
                sawRaw = true;
                if (!best) best = result;
            }
            reasons.push(region.name + ":" + result.reason);
        }
        if (!best) {
            best = {
                ok: false,
                reason: reasons.join(" | "),
                raw: "",
                region: regions.length ? regions[0] : null
            };
        } else {
            best.reason = "all_regions_failed " + reasons.join(" | ");
        }
        best.emptyOcr = !sawRaw || isEmptyRecognitionResult(best);
        return best;
    }

    function recognizeCaptchaByOcr(img, region, reason) {
        var clip = null;
        var start = Date.now();
        try {
            clip = images.clip(img, region.x, region.y, region.w, region.h);
            var result = gmlkit.ocr(clip, "zh");
            var arr = result.toArray(3);
            var texts = [];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
            }
            var raw = texts.join("");
            var parsed = evaluateCaptchaExpression(raw);
            var cost = Date.now() - start;
            if (runtime.captchaStats) {
                runtime.captchaStats.ocrRaw = cost;
                runtime.captchaStats.raw = raw;
            }
            logx("验证码 OCR 兜底 reason=" + reason + " cost=" + cost + "ms raw=" + raw +
                " normalized=" + normalizeCaptchaOcrText(raw) +
                " rules=" + (parsed ? parsed.ruleText : "parse_failed"));
            if (!parsed) {
                return { ok: false, reason: "ocr_parse_failed reason=" + reason + " raw=" + raw, raw: raw };
            }
            if (parsed.ruleText !== "direct_parse") {
                logx("验证码 OCR 规则处理 source=raw_ocr rules=" + parsed.ruleText + " raw=" + raw +
                    " normalized=" + parsed.normalized + " expression=" + parsed.expression + " answer=" + parsed.answer);
            }
            var suspicious = getSuspiciousCaptchaOcrReason(raw, parsed);
            if (suspicious) {
                logx("验证码 OCR 结果可疑，拒绝直接提交 reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer);
                return { ok: false, reason: "ocr_suspicious reason=" + reason + " suspicious=" + suspicious + " raw=" + raw, raw: raw };
            }
            return {
                ok: true,
                raw: raw,
                expression: parsed.expression,
                answer: parsed.answer,
                detail: "ocr_fallback rules=" + parsed.ruleText
            };
        } catch (e) {
            logx("验证码 OCR 兜底异常 reason=" + reason + " err=" + e);
            return { ok: false, reason: "ocr_exception reason=" + reason + " err=" + e, raw: "" };
        } finally {
            if (clip) {
                try { clip.recycle(); } catch (ignored) {}
            }
        }
    }

    function recognizeCaptchaByPreprocessedOcr(img, region, reason) {
        var clip = null;
        var processed = null;
        var start = Date.now();
        try {
            clip = images.clip(img, region.x, region.y, region.w, region.h);
            processed = preprocessCaptchaClipForOcr(clip);
            if (!processed) {
                return { ok: false, reason: "preprocess_failed reason=" + reason, raw: "" };
            }
            var result = gmlkit.ocr(processed, "zh");
            var arr = result.toArray(3);
            var texts = [];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].text) texts.push(String(arr[i].text));
            }
            var raw = texts.join("");
            var parsed = evaluateCaptchaExpression(raw);
            var cost = Date.now() - start;
            if (runtime.captchaStats) {
                runtime.captchaStats.ocrPreprocessed = cost;
                runtime.captchaStats.raw = raw;
            }
            logx("验证码预处理 OCR reason=" + reason + " cost=" + cost + "ms raw=" + raw +
                " normalized=" + normalizeCaptchaOcrText(raw) +
                " rules=" + (parsed ? parsed.ruleText : "parse_failed"));
            if (!parsed) {
                return { ok: false, reason: "preprocessed_ocr_parse_failed reason=" + reason + " raw=" + raw, raw: raw };
            }
            if (parsed.ruleText !== "direct_parse") {
                logx("验证码预处理 OCR 规则处理 source=preprocessed_ocr rules=" + parsed.ruleText + " raw=" + raw +
                    " normalized=" + parsed.normalized + " expression=" + parsed.expression + " answer=" + parsed.answer);
            }
            var suspicious = getSuspiciousCaptchaOcrReason(raw, parsed);
            if (suspicious) {
                logx("验证码预处理 OCR 结果可疑，拒绝直接提交 reason=" + reason + " suspicious=" + suspicious +
                    " expression=" + parsed.expression + " answer=" + parsed.answer);
                return { ok: false, reason: "preprocessed_ocr_suspicious reason=" + reason + " suspicious=" + suspicious + " raw=" + raw, raw: raw };
            }
            return {
                ok: true,
                raw: raw,
                expression: parsed.expression,
                answer: parsed.answer,
                detail: "preprocessed_ocr rules=" + parsed.ruleText
            };
        } catch (e) {
            logx("验证码预处理 OCR 异常 reason=" + reason + " err=" + e);
            return { ok: false, reason: "preprocessed_ocr_exception reason=" + reason + " err=" + e, raw: "" };
        } finally {
            if (processed) {
                try { processed.recycle(); } catch (ignoredProcessed) {}
            }
            if (clip) {
                try { clip.recycle(); } catch (ignoredClip) {}
            }
        }
    }

    function sendCaptchaAnswerToInputMethod(answer) {
        var cfg = CONFIG.captcha.inputMethod || {};
        if (!cfg.enabled) {
            return { ok: false, skipped: true, reason: "captcha_ime_disabled" };
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
            logx("Captcha IME answer broadcast sent answer=" + answer +
                " package=" + targetPackage + " action=" + action);
            if (cfg.afterBroadcastMs > 0) {
                sleep(cfg.afterBroadcastMs);
            }
            return { ok: true };
        } catch (e) {
            logx("Captcha IME answer broadcast failed err=" + e);
            return { ok: false, reason: "captcha_ime_broadcast_failed err=" + e };
        }
    }

    function shouldSkipFinalSubmit() {
        return CONFIG.captcha && CONFIG.captcha.skipFinalSubmit === true;
    }

    function notifyFinalSubmitSkipped(type, detail) {
        var msg = "验证码流程已完成，按配置跳过最后点击确定 type=" + type +
            (detail ? " detail=" + detail : "");
        logx(msg);
        try {
            deps.notifyUser("验证码已完成，已跳过最后点击确定");
        } catch (ignored) {}
    }

    function finishCaptchaInput(answer, submitPoint, detail) {
        logx("验证码答案已填充 answer=" + answer +
            " autoSubmit=" + CONFIG.captcha.autoSubmitAfterInput + " detail=" + detail);
        sleep(CONFIG.captcha.afterInputMs);
        if (!CONFIG.captcha.autoSubmitAfterInput) {
            return { ok: true, submitted: false, detail: detail };
        }
        try {
            back();
            sleep(CONFIG.captcha.afterKeyboardBackMs);
        } catch (ignored) {}
        if (shouldSkipFinalSubmit()) {
            notifyFinalSubmitSkipped("math", detail);
            return { ok: true, submitted: false, finalSubmitSkipped: true, detail: detail };
        }
        logx("验证码答案填充后点击确定 x=" + submitPoint.x + " y=" + submitPoint.y);
        deps.pressPoint("验证码确定", submitPoint);
        return { ok: true, submitted: true, detail: detail };
    }

    function inputCaptchaAnswer(answer) {
        var inputPoint = basePoint("captchaInput", CONFIG.captcha.inputPoint.x, CONFIG.captcha.inputPoint.y);
        var submitPoint = basePoint("captchaSubmit", CONFIG.captcha.submitPoint.x, CONFIG.captcha.submitPoint.y);
        var imeCfg = CONFIG.captcha.inputMethod || {};
        deps.pressPoint("验证码输入框", inputPoint);
        if (imeCfg.focusWaitMs > 0) {
            sleep(imeCfg.focusWaitMs);
        }
        if (!imeCfg.enabled) {
            return { ok: false, manualFallback: true, reason: "captcha_ime_disabled" };
        }
        var imeResult = sendCaptchaAnswerToInputMethod(answer);
        sleep(imeCfg.commitWaitMs || CONFIG.captcha.afterInputMs);
        if (!imeResult.ok) {
            return {
                ok: false,
                manualFallback: true,
                reason: imeResult.reason || "captcha_ime_unavailable"
            };
        }
        return finishCaptchaInput(answer, submitPoint, "captcha_ime");
    }

    function isSliderGrayPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        var cfg = CONFIG.captcha.slider;
        return min >= cfg.grayMin && max <= cfg.grayMax && (max - min) <= cfg.grayChromaMax;
    }

    function isSliderTrackPixel(color) {
        var r = colors.red(color);
        var g = colors.green(color);
        var b = colors.blue(color);
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        return min >= 205 && max <= 235 && (max - min) <= 12;
    }

    function isSliderArrowPixel(color) {
        return colors.red(color) <= 55 && colors.green(color) <= 55 && colors.blue(color) <= 60;
    }

    function pixelRatioInRegion(img, region, step, predicate) {
        var total = 0;
        var hits = 0;
        for (var y = 0; y < region.h; y += step) {
            for (var x = 0; x < region.w; x += step) {
                total++;
                if (predicate(imagePixel(img, region.x + x, region.y + y))) {
                    hits++;
                }
            }
        }
        return {
            ratio: total ? hits / total : 0,
            hits: hits,
            total: total,
            region: region
        };
    }

    function detectSliderCaptchaByTrack(img) {
        var cfg = CONFIG.captcha.slider;
        var step = 4;
        var track = pixelRatioInRegion(img, scaledRegion(cfg.trackProbeRegion), step, isSliderTrackPixel);
        var arrow = pixelRatioInRegion(img, scaledRegion(cfg.arrowProbeRegion), step, isSliderArrowPixel);
        var trackOk = track.ratio >= cfg.trackMinRatio;
        var arrowOk = arrow.ratio >= cfg.arrowMinRatio;
        var arrowStrongMinRatio = cfg.arrowStrongMinRatio || cfg.arrowMinRatio || 0.08;
        var arrowStrongOk = arrow.ratio >= arrowStrongMinRatio;
        return {
            ok: (trackOk && arrowOk) || arrowStrongOk,
            ratio: track.ratio,
            hits: track.hits,
            total: track.total,
            arrowRatio: arrow.ratio,
            arrowHits: arrow.hits,
            arrowTotal: arrow.total,
            trackOk: trackOk,
            arrowOk: arrowOk,
            arrowStrongOk: arrowStrongOk,
            region: track.region
        };
    }

    function recognizeSliderCaptcha(img) {
        var cfg = CONFIG.captcha.slider;
        var region = scaledRegion(cfg.imageRegion);
        var step = cfg.scanStep || 2;
        var yStart = Math.round(region.h * 0.34);
        var yEnd = Math.round(region.h * 0.9);
        var colCount = [];
        var x;
        var y;
        for (x = 0; x <= region.w; x += step) {
            colCount[Math.floor(x / step)] = 0;
        }

        for (y = yStart; y < yEnd; y += step) {
            for (x = 0; x < region.w; x += step) {
                if (isSliderGrayPixel(imagePixel(img, region.x + x, region.y + y))) {
                    colCount[Math.floor(x / step)]++;
                }
            }
        }

        var runs = [];
        var inRun = false;
        var startSlot = 0;
        var quietSlots = 0;
        for (var slot = 0; slot <= colCount.length; slot++) {
            var active = slot < colCount.length && colCount[slot] >= cfg.minColumnHits;
            if (active && !inRun) {
                inRun = true;
                startSlot = slot;
                quietSlots = 0;
            } else if (!active && inRun) {
                quietSlots++;
                if (quietSlots > 3 || slot === colCount.length) {
                    runs.push({ x1: startSlot * step, x2: Math.min(region.w - 1, (slot - quietSlots + 1) * step) });
                    inRun = false;
                    quietSlots = 0;
                }
            } else if (active) {
                quietSlots = 0;
            }
        }

        var minSide = scaleX(cfg.minSide);
        var maxSide = scaleX(cfg.maxSide);
        var boxes = [];
        for (var i = 0; i < runs.length; i++) {
            var run = runs[i];
            var runW = run.x2 - run.x1 + 1;
            if (runW < minSide || runW > maxSide) continue;
            boxes.push({
                x: region.x + run.x1,
                y: region.y + yStart,
                w: runW,
                h: runW,
                area: runW * runW,
                centerX: region.x + run.x1 + runW / 2,
                centerY: region.y + yStart + runW / 2
            });
        }

        if (boxes.length < 2) {
            return { ok: false, reason: "slider_gray_boxes=" + boxes.length + " runs=" + runs.length, boxes: boxes };
        }
        boxes.sort(function (a, b) { return b.w - a.w; });
        var pair = boxes.slice(0, 2);
        pair.sort(function (a, b) { return a.w - b.w; });
        var target = pair[0];
        return {
            ok: true,
            region: region,
            target: target,
            boxes: pair,
            detail: "small=(" + Math.round(target.centerX) + "," + Math.round(target.centerY) + "," +
                Math.round(target.w) + "x" + Math.round(target.h) + ") large=(" +
                Math.round(pair[1].centerX) + "," + Math.round(pair[1].centerY) + "," +
                Math.round(pair[1].w) + "x" + Math.round(pair[1].h) + ")"
        };
    }

    function dragSliderCaptcha(sliderResult) {
        var cfg = CONFIG.captcha.slider;
        var start = basePoint("sliderHandleStart", cfg.handleStartPoint.x, cfg.handleStartPoint.y);
        var submitPoint = basePoint("sliderCaptchaSubmit", cfg.submitPoint.x, cfg.submitPoint.y);
        var endX = Math.round(sliderResult.target.centerX);
        var endY = start.y;
        logx("滑块验证码拖动 start=(" + start.x + "," + start.y + ") end=(" + endX + "," + endY + ") " + sliderResult.detail);
        try {
            gesture(cfg.dragDuration, [start.x, start.y], [Math.round((start.x + endX) / 2), endY], [endX, endY]);
        } catch (e) {
            logx("滑块验证码 gesture 失败，降级 swipe err=" + e);
            swipe(start.x, start.y, endX, endY, cfg.dragDuration);
        }
        sleep(cfg.afterDragMs);
        if (shouldSkipFinalSubmit()) {
            notifyFinalSubmitSkipped("slider", sliderResult.detail);
            return { ok: true, submitted: false, finalSubmitSkipped: true, detail: sliderResult.detail };
        }
        deps.pressPoint("滑块验证码确定", submitPoint);
        return { ok: true, submitted: true, detail: sliderResult.detail };
    }

    function solveAfterConfirm() {
        var allStart = Date.now();
        var stats = newCaptchaStats();
        runtime.captchaStats = stats;
        logx("验证码阶段开始，等待弹窗渲染 " + CONFIG.afterConfirmCaptchaWaitMs + "ms");
        sleep(CONFIG.afterConfirmCaptchaWaitMs);
        var waitCost = Date.now() - allStart;
        stats.wait = waitCost;

        var img = null;
        var captureStart = Date.now();
        var captureCost = 0;
        var recognizeStart = 0;
        var recognizeCost = 0;
        var inputStart = 0;
        var inputCost = 0;
        var regions = buildExpressionRegions();
        var failureRegion = regions.length ? regions[0] : scaledRegion(CONFIG.captcha.expressionRegion);
        try {
            logx("验证码开始截图 regions=" + JSON.stringify(regions));
            img = captureScreen();
            captureCost = Date.now() - captureStart;
            stats.capture = captureCost;
            logx("验证码截图完成 capture=" + captureCost + "ms");

            recognizeStart = Date.now();
            var trackProbe = detectSliderCaptchaByTrack(img);
            logx("验证码类型探测 sliderTrack ratio=" + trackProbe.ratio.toFixed(3) +
                " hits=" + trackProbe.hits + "/" + trackProbe.total +
                " arrowRatio=" + trackProbe.arrowRatio.toFixed(3) +
                " arrowHits=" + trackProbe.arrowHits + "/" + trackProbe.arrowTotal +
                " trackOk=" + trackProbe.trackOk +
                " arrowOk=" + trackProbe.arrowOk +
                " arrowStrongOk=" + trackProbe.arrowStrongOk +
                " ok=" + trackProbe.ok);
            if (trackProbe.ok) {
                var sliderResult = recognizeSliderCaptcha(img);
                if (sliderResult.ok) {
                    recognizeCost = Date.now() - recognizeStart;
                    stats.recognize = recognizeCost;
                    stats.captchaType = "slider";
                    failureRegion = sliderResult.region;

                    inputStart = Date.now();
                    var dragResult = dragSliderCaptcha(sliderResult);
                    inputCost = Date.now() - inputStart;
                    stats.input = inputCost;
                    stats.outcome = "success";
                    stats.raw = "slider";
                    stats.expression = "slider";
                    stats.answer = "";
                    stats.detail = sliderResult.detail;

                    logx("滑块验证码识别成功 " + sliderResult.detail +
                        " wait=" + waitCost + "ms capture=" + captureCost +
                        "ms recognize=" + recognizeCost + "ms input=" + inputCost + "ms total=" + (Date.now() - allStart) + "ms");
                    logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                    return {
                        ok: true,
                        type: "slider",
                        detail: sliderResult.detail,
                        finalSubmitSkipped: dragResult && dragResult.finalSubmitSkipped === true,
                        stats: stats
                    };
                }
                logx("滑块轨道已命中但灰块识别失败，进入数学题 OCR reason=" + sliderResult.reason);
            } else {
                logx("未识别为滑块验证码，进入数学题 OCR");
            }

            var result = recognizeCaptchaAcrossRegions(img, regions);
            if (!result.ok && result.emptyOcr && CONFIG.captcha.emptyOcrRetryWaitMs > 0) {
                var retryWait = CONFIG.captcha.emptyOcrRetryWaitMs;
                logx("数学题验证码 OCR 为空，等待 " + retryWait + "ms 后重新截图识别");
                sleep(retryWait);
                stats.wait += retryWait;
                if (img) {
                    try { img.recycle(); } catch (ignoredRetryRecycle) {}
                    img = null;
                }
                var retryCaptureStart = Date.now();
                img = captureScreen();
                var retryCaptureCost = Date.now() - retryCaptureStart;
                stats.capture += retryCaptureCost;
                logx("验证码重试截图完成 capture=" + retryCaptureCost + "ms totalCapture=" + stats.capture + "ms");
                result = recognizeCaptchaAcrossRegions(img, regions);
            }
            recognizeCost = Date.now() - recognizeStart;
            stats.recognize = recognizeCost;
            stats.captchaType = "math";
            if (!result.ok) {
                failureRegion = result.region || failureRegion;
                saveCaptchaFailure(img, failureRegion, result.reason + " raw=" + result.raw);
                stats.outcome = "fail";
                stats.raw = result.raw || stats.raw;
                stats.reason = result.reason;
                logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                return {
                    ok: false,
                    manualFallback: true,
                    type: "math",
                    reason: "验证码识别失败：" + result.reason + " raw=" + result.raw,
                    stats: stats
                };
            }

            inputStart = Date.now();
            var inputResult = inputCaptchaAnswer(result.answer);
            inputCost = Date.now() - inputStart;
            stats.input = inputCost;
            if (inputResult && inputResult.manualFallback) {
                stats.outcome = "fail";
                stats.raw = result.raw;
                stats.expression = result.expression;
                stats.answer = result.answer;
                stats.detail = result.detail;
                stats.reason = inputResult.reason;
                logx("验证码输入未完成，保留页面给人工兜底 reason=" + inputResult.reason);
                logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
                return {
                    ok: false,
                    manualFallback: true,
                    type: "math",
                    reason: "验证码输入未完成：" + inputResult.reason,
                    stats: stats
                };
            }
            stats.outcome = "success";
            stats.raw = result.raw;
            stats.expression = result.expression;
            stats.answer = result.answer;
            stats.detail = result.detail;

            logx("验证码识别成功 raw=" + result.raw + " expression=" + result.expression + " answer=" + result.answer +
                " detail=" + result.detail + " wait=" + stats.wait + "ms capture=" + stats.capture +
                "ms recognize=" + recognizeCost + "ms input=" + inputCost + "ms total=" + (Date.now() - allStart) + "ms");
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            return {
                ok: true,
                type: "math",
                raw: result.raw,
                expression: result.expression,
                answer: result.answer,
                detail: result.detail,
                finalSubmitSkipped: inputResult && inputResult.finalSubmitSkipped === true,
                stats: stats
            };
        } catch (e) {
            stats.outcome = stats.outcome === "fail" ? stats.outcome : "exception";
            stats.reason = stats.reason || String(e);
            logx("验证码阶段异常 err=" + e + " stack=" + (e && e.stack ? e.stack : ""));
            if (img) {
                saveCaptchaFailure(img, failureRegion, "exception=" + e);
            }
            logx("验证码耗时汇总 " + captchaStatsText(stats, Date.now() - allStart));
            return {
                ok: false,
                manualFallback: true,
                type: stats.captchaType || "",
                reason: "验证码阶段异常：" + e,
                stats: stats
            };
        } finally {
            runtime.captchaStats = null;
            if (img) {
                try { img.recycle(); } catch (ignoredRecycle) {}
            }
        }
    }

    return {
        solveAfterConfirm: solveAfterConfirm
    };
}

if (typeof module !== "undefined") {
    module.exports = createNanjingBookingCaptchaSolver;
}
