@echo off
:: 切换代码页为 UTF-8
chcp 65001
adb push "C:\Users\Administrator\Desktop\wx-qp\project\." "/sdcard/脚本/"
pause