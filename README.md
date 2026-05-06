# wx-booking-bot

基于 OpenAutoJS 的微信小程序自动预约脚本，用于在安卓手机上自动化完成纪念馆参观预约。

## 功能特性

- **两轮预约流程**：第一轮预热采集页面坐标，第二轮在放票时间极速完成预约
- **验证码自动处理**：支持数学题验证码（OCR 识别 + 自定义 IME 输入）和滑块验证码（图像识别 + 自动拖动）
- **坐标缓存机制**：第一轮采集的坐标写入缓存，第二轮直接复用，减少 OCR 调用提升速度
- **Mock 测试环境**：内置 Android Mock App，可在非放票时段模拟测试完整抢票流程
- **详细日志系统**：运行日志、诊断截图、OCR 结果一应俱全，便于调试和复盘

## 技术架构

```
┌─────────────────────────────────────────────┐
│            OpenAutoJS 自动化脚本             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ 主脚本           │  │ 验证码处理模块    │  │
│  │ nanjing_booking  │  │ captcha_solver   │  │
│  │ _auto.js         │  │ .js              │  │
│  └────────┬────────┘  └────────┬─────────┘  │
│           │                    │             │
│  ┌────────▼────────────────────▼─────────┐  │
│  │        OCR + 坐标推算 + 模拟操作        │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Android Mock App（测试）           │
│  ┌──────────────────────────────────────┐   │
│  │  WebView + 自定义数字输入法（IME）     │   │
│  │  模拟小程序预约界面 + 验证码弹窗       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## 环境要求

| 项目 | 要求 |
|------|------|
| 安卓手机 | Android 5.0+（API 21+） |
| OpenAutoJS | 已安装并开启无障碍服务 |
| 截图权限 | OpenAutoJS 需获取屏幕截图权限 |
| 微信 | 已安装，且已登录 |
| 小程序快捷方式 | 桌面已创建目标小程序快捷方式 |

## 快速开始

### 1. 安装 OpenAutoJS

在安卓手机上安装 OpenAutoJS App，并授予以下权限：
- 无障碍服务权限
- 屏幕截图权限
- 悬浮窗权限（可选，用于调试）

### 2. 准备微信小程序

1. 打开微信，搜索并进入目标小程序
2. 将小程序添加到桌面快捷方式
3. 确认快捷方式名称与脚本配置中的 `appShortcutName` 一致

### 3. 配置脚本

编辑 `project/nanjing_booking_auto.js` 顶部的 `CONFIG` 区域，修改以下关键配置：

```javascript
var CONFIG = {
    visitDate: "0509",        // 目标日期，MMDD 格式
    period: "上午",            // 时段："上午" 或 "下午"
    visitorCount: 2,           // 游客人数（1-5）
    startTime: "8:00:00.5",   // 抢票触发时间，支持毫秒
    // ... 其他配置见下方详细说明
};
```

### 4. 运行脚本

1. 将 `project/` 目录下的脚本文件复制到手机
2. 在 OpenAutoJS 中打开 `nanjing_booking_auto.js`
3. 点击运行

### 5. Mock 测试（可选）

如需在非放票时段测试：

1. 编译安装 Mock App（`app/template-project`）
2. 在 OpenAutoJS 中运行 `nanjing_booking_mock_app_test.js`

## 配置说明

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `appShortcutName` | string | `"侵华日军南京大屠杀遇难同胞纪念馆参观预约"` | 桌面快捷方式名称，用于无障碍查找图标 |
| `visitDate` | string | `"0509"` | 目标日期，MMDD 格式，如 `0505`、`0515` |
| `period` | string | `"上午"` | 时段选择：`"上午"` 或 `"下午"` |
| `visitorCount` | number | `2` | 游客人数，1-5 |
| `startTime` | string | `"8:00:00.5"` | 第二轮抢票触发时间，支持 `HH:mm:ss` 或 `HH:mm:ss.SSS` |

### 流程控制

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `prepareOnly` | boolean | `false` | `true` 时只执行第一轮预热，不等待也不执行第二轮 |
| `useCache` | boolean | `true` | 是否读取已有坐标缓存 |
| `preferRealtimeInPrepare` | boolean | `true` | 第一轮对关键采集项优先实时识别，避免低可信缓存污染 |

### 性能调优

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pressDuration` | number | `20` | 常规点击按压时长（ms） |
| `fastPressDuration` | number | `10` | 第二轮快速点击按压时长（ms），越小越快但过低可能丢点击 |
| `visitorPressDuration` | number | `50` | 第二轮勾选游客的专用按压时长（ms） |
| `afterAudienceScrollMs` | number | `700` | 滑动到观众信息后的等待时间（ms） |
| `visitorIntervalMs` | number | `80` | 连续勾选多个游客之间的间隔（ms） |
| `afterConfirmCaptchaWaitMs` | number | `800` | 点击确认预约后等待验证码弹窗的时间（ms） |
| `pageWaitInterval` | number | `250` | OCR 等待循环的轮询间隔（ms） |

### 输出与日志

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `outputDir` | string | `"/sdcard/OpenAutoJS_NanjingBooking"` | 主输出目录，保存日志、缓存、诊断截图 |
| `cachePath` | string | `"/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json"` | 主缓存路径 |
| `logPath` | string | `"/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_run_latest.log"` | 日志路径 |
| `diagnostics.saveScreenshots` | boolean | `true` | 抢票结束后或异常时保存截图 |
| `diagnostics.ocrAfterRush` | boolean | `true` | 点击确认预约后做一次全局 OCR 摘要 |
| `diagnostics.ocrOnError` | boolean | `true` | 异常退出时做一次全局 OCR 摘要 |

### 验证码配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `captcha.enabled` | boolean | `true` | 是否启用验证码自动处理 |
| `captcha.expressionRegions` | array | 见代码 | 数学题 OCR 识别区域列表 |
| `captcha.inputMethod.enabled` | boolean | `true` | 是否使用自定义 IME 输入验证码答案 |
| `captcha.inputMethod.packageName` | string | `"com.leo.myapplication"` | Mock App 的 applicationId |
| `captcha.inputMethod.focusWaitMs` | number | `250` | 点击输入框后等待焦点建立的时间（ms） |
| `captcha.inputMethod.commitWaitMs` | number | `350` | 等待 IME commitText 完成的时间（ms） |
| `captcha.slider.*` | object | 见代码 | 滑块验证码的图像区域、拖动参数等 |
| `captcha.skipFinalSubmit` | boolean | `true` | 验证码流程完成后是否跳过点击"确定"，用于观察验证 |
| `captcha.autoSubmitAfterInput` | boolean | `true` | 输入完成后是否自动提交 |

## 项目结构

```
wx-qp/
├── project/                          # OpenAutoJS 脚本目录
│   ├── nanjing_booking_auto.js       # 正式抢票主脚本（核心）
│   ├── nanjing_booking_captcha_solver.js  # 验证码处理模块
│   ├── nanjing_booking_mock_app_test.js   # Mock App 测试脚本
│   └── wechat_miniapp_ime_input_test.js   # IME 输入测试脚本
│
├── app/template-project/             # Android Mock App 工程
│   ├── app/src/main/
│   │   ├── assets/booking_mock/
│   │   │   └── index.html            # Mock 预约页面
│   │   └── java/com/mg/sdk/demo/
│   │       ├── MainActivity.java     # 主 Activity
│   │       ├── CaptchaNumberInputMethodService.java  # 自定义数字输入法
│   │       ├── CaptchaAnswerReceiver.java  # 验证码答案广播接收器
│   │       └── CaptchaImeBridge.java       # IME 桥接
│   └── build.gradle                  # Gradle 配置
│
├── 脚本代码参考/                      # 参考脚本
├── 微信小程序示例图/                  # 页面截图
├── 新需求截图/                       # 需求截图
├── OpenAutoJS_NanjingBooking/        # 运行产物（日志、缓存）
├── AI开发需求说明.md                  # 详细需求文档
└── AGENTS.md                         # AI 协作说明
```

## 工作原理

### 第一轮：预热采集（PREP）

1. **启动小程序**：通过无障碍服务查找桌面快捷方式并启动
2. **处理弹窗**：自动处理隐私协议、预约通知等弹窗
3. **登录准备**：检测并处理登录界面
4. **页面跳转**：进入预约入口页面
5. **坐标采集**：通过 OCR 识别页面关键元素（日期、时段、游客列表等），保存坐标到缓存
6. **等待放票**：停留在预约入口前的页面，等待第二轮触发时间

### 第二轮：正式抢票（RUSH）

1. **触发时机**：到达配置的 `startTime` 时自动触发
2. **进入预约页**：点击缓存的坐标快速进入预约界面
3. **选择日期**：直接点击第一轮缓存的日期坐标
4. **选择时段**：点击缓存的时段坐标
5. **勾选游客**：依次点击游客复选框
6. **确认预约**：点击确认按钮
7. **处理验证码**：自动识别并处理数学题或滑块验证码

### 坐标策略

- 优先使用实时 OCR 采集
- 其次复用同屏幕尺寸的缓存坐标
- 异常时使用 1440x3040 基准比例降级换算

## 验证码处理

### 数学题验证码

1. 截取验证码区域图像
2. 使用 OCR 识别数学表达式（如 `2×4+2`）
3. 计算表达式结果
4. 通过自定义 IME（`CaptchaNumberInputMethodService`）自动输入答案
5. 自动点击确定按钮

**特殊处理**：
- 支持 `×` 和 `*` 乘法符号
- 自动过滤 OCR 识别噪声（如 `=?` 尾部误读为 `+2`）
- 多区域识别策略，适配不同验证码样式

### 滑块验证码

1. 截取滑块图像区域
2. 识别滑块轨道和目标位置
3. 计算拖动距离
4. 模拟手势拖动滑块到目标位置
5. 自动点击确定按钮

**识别策略**：
- 轨道区域灰度扫描
- 箭头区域颜色匹配
- 支持强命中和弱命中两种模式

## 日志与调试

### 日志路径

- 主日志：`/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_run_latest.log`
- 备用日志：`/sdcard/nanjing_booking_run.log`
- 历史日志：`/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_run_*.log`

### 诊断截图

- 保存路径：`/sdcard/OpenAutoJS_NanjingBooking/`
- 文件名格式：`{诊断类型}_{时间戳}.png`
- 触发条件：抢票结束、异常退出、验证码失败

### 缓存文件

- 路径：`/sdcard/OpenAutoJS_NanjingBooking/nanjing_booking_cache.json`
- 内容：页面元素坐标、屏幕尺寸、采集时间戳
- 用途：第二轮直接复用，避免重复 OCR

## 常见问题

### Q: 脚本无法启动小程序？

A: 检查以下几点：
- 确认 OpenAutoJS 已开启无障碍服务
- 确认桌面快捷方式名称与 `appShortcutName` 配置一致
- 确认微信已登录且小程序可正常打开

### Q: OCR 识别不准确？

A: 尝试以下方法：
- 调整 `captcha.expressionRegions` 中的识别区域坐标
- 确认手机屏幕分辨率与 `baseScreen` 配置匹配
- 检查截图权限是否正常授予

### Q: 验证码输入失败？

A: 检查以下配置：
- 确认 Mock App 已安装且 `packageName` 配置正确
- 调整 `focusWaitMs` 和 `commitWaitMs` 参数
- 确认自定义输入法已启用并切换

### Q: 滑块验证码无法拖动？

A: 尝试以下方法：
- 检查 `slider` 配置中的区域坐标是否准确
- 调整 `dragDuration` 拖动时长
- 确认截图清晰度足够

### Q: 如何在非放票时段测试？

A: 使用 Mock App 测试：
1. 编译安装 `app/template-project`
2. 运行 `project/nanjing_booking_mock_app_test.js`
3. Mock App 会模拟完整的预约界面和验证码弹窗

## 免责声明

本项目仅供学习交流使用，不得用于任何商业用途。使用本项目产生的任何后果由使用者自行承担。

请遵守相关法律法规和平台规定，尊重他人权益。本项目作者不对因使用本项目而产生的任何损失或法律责任负责。

## 许可证

MIT License
