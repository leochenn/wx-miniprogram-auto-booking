log("开始");
auto.waitFor();
function waitForExactTime(hour, minute, second) {
    let target = new Date();
    target.setHours(hour, minute, second, 0); // 毫秒设为0
    
    let targetTime = target.getTime();
    let nowTime = Date.now();
    
    if (nowTime >= targetTime) {
        log("警告：设定的时间已过！");
        return;
    }
    
    let diff = targetTime - nowTime;
    log("目标时间: " + target.toString());
    log("距离执行还有 " + (diff / 1000).toFixed(2) + " 秒");
    
    // 1. 粗略等待：如果相差大于 1 秒，先用 sleep 休眠到提前 1 秒的位置
    if (diff > 1000) {
        let sleepTime = diff - 1000;
        log("系统休眠 " + sleepTime + " 毫秒...");
        sleep(sleepTime);
    }
    
    log("提前醒来，进入毫秒级精准自旋轮询...");
    
    // 2. 极限轮询：在最后的 1 秒内死循环，不让 CPU 休息，消除唤醒延迟
    while (Date.now() < targetTime) {
        // 里面什么都不写，狂跑 CPU
    }
    
    // 循环跳出的一瞬间，代表时间刚好到达目标毫秒！
    log("准点触发！当前毫秒误差: " + (Date.now() - targetTime) + "ms");
}

// ============ 使用示例 ============

// 设定目标时间为 14点20分00秒
waitForExactTime(14, 26, 0);

log("执行");
home()
log("回到桌面");
toastLog("运行结束....")