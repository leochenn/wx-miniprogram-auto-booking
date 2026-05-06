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
//var allViews = className("android.view.View").find();

// 输出总数
//log("一共找到了 " + allViews.length + " 个 android.view.View 元素");

// 如果你想看这些元素分别是什么（辅助调试）
//if (allViews.length > 0) {
//    log("第一个元素的坐标是: " + allViews[0].bounds());
//}

function getOcrResult(region) {
    let img = captureScreen();
    try {
        let options = region ? { region: region } : {};        
        return gmlkit.ocr(img, "zh", options);
    } finally {        
        // 无论 OCR 是否成功，无论代码是否报错，
        // 都会执行 finally 里的回收逻辑
        if (img) {
            img.recycle();
            log("img.recycle")
        }
    }
}

// 保存截图到手机根目录，文件名为 debug_screen.png
// var path = "/sdcard/debug_screen1.png";
// images.save(img, path);
// log("截图已保存至：" + path);
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
if (targetBtn) {
    log("找到目标按钮1: " + targetBtn.text);
    let cx = targetBtn.bounds.centerX();
    let cy = targetBtn.bounds.centerY();
    log("点击坐标: " + cx + ", " + cy);
    
    // 执行点击（尝试两种方式）
    // click(cx, cy);
    press(cx, cy, 20);
    log("点击坐标完成");
    // 如果上面不跳转，尝试下面这种长按 200ms 的方式
    // press(cx, cy, 200); 
}
sleep(100);
if (targetBtn2) {
    log("找到目标按钮2: " + targetBtn2.text);
    let cx2 = targetBtn2.bounds.centerX();
    let cy2 = targetBtn2.bounds.centerY();
    log("点击坐标: " + cx2 + ", " + cy2);
    
    // 执行点击（尝试两种方式）
    // click(cx2, cy2);
    press(cx2, cy2, 20);
    log("点击坐标完成");
}
sleep(100);
press(305, 1105, 20);//点击 第一个展馆
sleep(500);
press(270, 1150, 20);//点击 普通预约

sleep(1500);
log("检查登录");

//登录确认
function a() {
    // 用户确认登录
    // 阅读
    let img2 = captureScreen()
    let start2 = new Date()
    log("OCR识别")
    let result = gmlkit.ocr(img2, "zh");
    log('OCR识别耗时：' + (new Date() - start2) + 'ms')
    img2.recycle();
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
        if (txt.indexOf("阅读") != -1) {
            targetBtn = item;
        }
        if (txt.indexOf("用户确认") != -1) {
            targetBtn2 = item;
        }
        if (targetBtn && targetBtn2) {
            log("OCR识别找到俩个目标")
            break;
        }
    }
    log("所有识别到的文字: " + JSON.stringify(allTexts));
    if (targetBtn) {
        log("找到目标按钮1: " + targetBtn.text);
        // 获取左上角坐标
        let lx = targetBtn.bounds.left;
        let ly = targetBtn.bounds.top;
        
        // 技巧：为了防止点击在边缘导致系统判定无效，通常建议向内偏移 5-10 个像素
        let offset = 10; 
        let finalX = lx + offset;
        let finalY = ly + offset;

        log("点击左上角坐标: " + finalX + ", " + finalY);
        
        // 执行极速点击
        press(finalX, finalY, 20);
        log("左上角点击完成");
    }
    sleep(100);
    if (targetBtn2) {
        log("找到目标按钮2: " + targetBtn2.text);
        let cx2 = targetBtn2.bounds.centerX();
        let cy2 = targetBtn2.bounds.centerY();
        log("点击坐标: " + cx2 + ", " + cy2);
        
        // 执行点击（尝试两种方式）
        // click(cx2, cy2);
        press(cx2, cy2, 20);
        log("点击坐标完成");
    }    
}

a()
sleep(500);

toastLog("运行结束....")