# 当前阶段上下文

## 项目目标

本项目用于开发和验证南京纪念馆微信小程序预约自动化。正式抢票脚本运行在 OpenAutoJS 中；Android Mock App 用于复刻小程序页面、验证码弹窗和第二轮抢票链路，便于正式抢票前验证。

## 关键路径

- Android 工程：`app/template-project`
- Mock HTML：`app/template-project/app/src/main/assets/booking_mock/index.html`
- 正式 OpenAutoJS 脚本：`project/nanjing_booking_auto.js`
- 正式验证码模块：`project/nanjing_booking_captcha_solver.js`
- Mock 测试脚本：`project/nanjing_booking_mock_app_test.js`
- 微信小程序 IME 通道测试脚本：`project/wechat_miniapp_ime_input_test.js`
- 本地同步日志/截图目录：`OpenAutoJS_NanjingBooking/`
- 滑块正式截图样本目录：`新需求截图2/`

## 当前已完成

- 正式脚本已接入独立验证码模块 `project/nanjing_booking_captcha_solver.js`，只处理两类弹窗：数学题验证码和滑块验证码。
- 数学题验证码输入链路已切到 Mock App 内置自定义数字输入法 `Captcha Number IME`：
  - OpenAutoJS 点击输入框。
  - 通过广播把答案发送给 App 内 IME。
  - IME 使用 `commitText` 输入数字。
  - 输入完成后脚本收起键盘，再根据配置决定是否点击验证码弹窗“确定”。
- 自定义 IME 已在 Mock App 数学验证码和微信小程序普通输入框上验证可输入；正式验证码弹窗输入框仍需在真实抢票时继续观察。
- 已清理正式脚本中此前用于排查输入问题的多方案诊断代码：`inputDiagnostic`、剪贴板输入、shell input、focused/editable setText、AutoJS fallback 等不再保留。
- 已新增 `skipFinalSubmit` 配置开关：验证码流程完成后可跳过最后点击“确定”，并 toast/日志提示，便于正式前观察验证。
- 滑块验证码已优化为允许 `arrowStrongOk` 单独强命中，解决正式滑块截图中轨道区域命中弱导致不拖动的问题；`新需求截图2/` 中多张正式滑块截图均已离线验证可识别。
- 本轮数学验证码排查发现：最近两次失败不是滑块优化导致，日志中滑块探测均为 `ok=false`，流程正确进入数学 OCR。
- 本轮已优化数学题 OCR：
  - 当 OCR 把 `=?` 尾部误读为 `+2`、`-2` 等尾部噪声时，允许按前两个数字和第一个运算符计算。
  - 典型样例：`2X4+2` 按 `2×4` 得到 `8`；`16-11-2` 按 `16-11` 得到 `5`。
  - 新规则名：`ignore_tail_operator_digits_as_marker_noise`。
  - 可疑判定仍保留：只有这种明确的尾部“运算符+数字”噪声才跳过 `ocr_missing_tail_marker`。
- 本轮同时修正数学模板 Bitmap 创建兼容性：
  - 优先使用 `Bitmap.Config.ARGB_8888`。
  - 失败后兜底尝试 `Bitmap.Config.valueOf("ARGB_8888")`。

## 关键文件状态

- `project/nanjing_booking_auto.js`
  - 正式主流程脚本。
  - 第二轮确认预约后等待 `afterConfirmCaptchaWaitMs=500` 再进入验证码流程。
  - 验证码配置中有 `skipFinalSubmit`、`inputMethod`、数学 OCR 区域、滑块区域等参数。
- `project/nanjing_booking_captcha_solver.js`
  - 正式验证码总模块，同时包含数学题和滑块两条路径。
  - 本轮只针对数学 OCR 解析和模板 Bitmap 兼容做新增修改；没有新增滑块识别逻辑。
  - 若 git diff 中仍出现滑块相关变更，通常是前一轮滑块优化或 `skipFinalSubmit` 尚未提交的工作区改动。
- `project/nanjing_booking_mock_app_test.js`
  - Mock 第二轮测试脚本。
  - 数学 OCR 容错、模板 Bitmap 兼容、`skipFinalSubmit`、滑块参数需与正式第二轮保持一致。
- `app/template-project`
  - 已包含自定义数字输入法相关组件，用户负责安装和验证，不要主动运行 `run_app_rtn.bat`。

## 当前测试结论

- `node --check` 已通过：
  - `project/nanjing_booking_auto.js`
  - `project/nanjing_booking_captcha_solver.js`
  - `project/nanjing_booking_mock_app_test.js`
- 滑块验证码：用户最近实测反馈“似乎可以了”；离线样本也已验证通过。
- 数学验证码：最近两次失败的根因是 OCR 把 `=?` 误读成尾部 `+2`/`-2`，并被旧的 `ocr_missing_tail_marker` 安全规则拦截；本轮已针对该场景优化。
- 模板兜底：之前日志出现 `Invalid ID, must be in the range [0..16)`，本轮已加 Bitmap 创建兼容兜底，但仍需在 OpenAutoJS 真机环境验证是否彻底消失。

## 下一轮注意事项

- 回答和操作前继续先读取本文件。
- 不要主动编译或运行 Android App；用户负责安装和验证。
- 修改正式脚本第二轮链路时，必须同步检查 Mock 测试脚本是否需要保持一致。
- 数学验证码下次重点看日志：
  - 是否出现 `ignore_tail_operator_digits_as_marker_noise`。
  - 是否正确进入 IME 输入流程。
  - 是否还出现模板构建异常。
- 滑块逻辑当前已可用，除非新日志明确指向滑块问题，否则不要继续扩大滑块识别规则。
- `skipFinalSubmit=true` 只用于观察验证；正式抢票前如果需要自动提交验证码弹窗，需改回 `false`。
- 当前工作区可能存在未提交改动和本地日志/截图目录；不要误删用户日志、截图或 `.gitignore` 中与本轮无关的改动。
