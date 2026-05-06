log("开始");
auto.waitFor();
sleep(1000); 
log("请求截图");
// 1. 请求截图权限（建议在脚本最开始执行一次）
if (!requestScreenCapture()) {
    log("请求截图权限失败");
    exit();
}
toastLog("请求截图完成");
sleep(3000); 

toastLog("正在寻找弹窗....")
sleep(10000); 

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
    log("检测到文字: " + txt + " 坐标: " + item.bounds);

}

log("所有识别到的文字: " + JSON.stringify(allTexts));
// 点击 预约时间段
toastLog("运行结束....")