log("开始");
auto.waitFor();
log("home");
// 1. 回到桌面
home();
log("回到桌面");
sleep(500); 
log("请求截图");
// 1. 请求截图权限（建议在脚本最开始执行一次）
if (!requestScreenCapture()) {
    log("请求截图权限失败");
    exit();
}
log("请求截图完成");
var appName = "侵华日军南京大屠杀遇难同胞纪念馆参观预约";
var found = false;
var maxTry = 3; // 最多尝试翻 3 页

for (var i = 0; i < maxTry; i++) {
    var icon = text(appName).findOne(500);

    if (icon) {
        var b = icon.bounds();
        // 检查坐标是否在当前屏幕内（非负且小于屏幕尺寸）
        if (b.centerX() > 0 && b.centerY() > 0 && b.centerX() < device.width && b.centerY() < device.height) {
            log("找到图标，坐标: " + b.centerX() + ", " + b.centerY());
            click(b.centerX(), b.centerY());
            found = true;
            break; 
        }
    }

    // 如果没找到或坐标在屏幕外，尝试向左滑动翻到下一页
    log("当前页面未找到可见图标，尝试翻页...");
    swipe(device.width * 0.8, device.height / 2, device.width * 0.2, device.height / 2, 500);
    sleep(1000); // 等待翻页动画
}

sleep(1000);
toastLog("正在寻找弹窗....")


let img = captureScreen()
let start = new Date()
log("OCR识别")
let result = gmlkit.ocr(img, "zh");
log('OCR识别耗时：' + (new Date() - start) + 'ms')
img.recycle();

let list = result.toArray(3); // 获取识别结果的 Java 数组
let allTexts = [];
let targetBtn = null;
let targetBtn2 = null;

log("正在分析识别结果，总计项目数: " + list.length);

for (let i = 0; i < list.length; i++) {
    let item = list[i];
    let txt = item.text;
    allTexts.push(txt);

    // 打印每个识别到的文字，方便调试
    // log("检测到文字: " + txt + " 坐标: " + item.bounds);

    // 模糊匹配：只要包含 "同意" 且 包含 "继续"
    if (txt.indexOf("我已阅") != -1) {
        targetBtn = item;
    }
    if (txt.indexOf("我已知晓") != -1) {
        targetBtn2 = item;
    }
    if (targetBtn && targetBtn2) {
        log("OCR识别找到俩个目标")
        break;
    }
}

log("所有识别到的文字: " + JSON.stringify(allTexts));
// 点击 预约时间段
press(951, 2100, 20);
sleep(500);

// let x = device.width / 2;
// let startY = device.height * 0.8;
// let endY = device.height * 0.2;
// swipe(x, startY, x, endY, 500); // 耗时500毫秒完成
// gesture(1500, [252, 1936], [252, 424], [252, 424]);
//将观众信息拖动到顶部
gesture(100, [252, 2454], [252, 424], [252, 424]);
// 点击游客
sleep(100);
let points = [[700, 830], [700, 1200], [700, 1530]];

// 方式 A：常规循环（最快顺序点击）
for (let i = 0; i < points.length; i++) {
    // 使用 press 替代 click，设置极短时长（如 1ms 或 10ms）
    press(points[i][0], points[i][1], 10); 
    sleep(50);
}


toastLog("运行结束....")