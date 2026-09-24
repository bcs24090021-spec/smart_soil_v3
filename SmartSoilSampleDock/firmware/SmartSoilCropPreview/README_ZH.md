# 作物 + AI 同页彩屏预览

这是静态视觉预览，不读取传感器，不进行真实推荐，不调用 AI，也不保存历史。
番茄、pH 6.2 和解读均为示例；1/3 是版式占位，当前只展示一页。
中文与作物图片已转成 RGB565 位图放在 Flash 中，无需另装中文字体库。
植物图片直接由用户 Web 仓库 src/ui/three-plant.js 渲染，保留土壤方块和根系。
该模型是通用植物，不是番茄的专属模型；番茄名称仍为候选版式示例。
彩屏展示静态渲染图，不运行 Three.js，不支持实时旋转。

## 上传

用 Arduino IDE 打开 SmartSoilCropPreview.ino，保持 ScreenAsset.h 在同一文件夹。
选择 ESP32 Dev Module 和实际串口。需要 Adafruit GFX Library、Adafruit ST7735
and ST7789 Library 及其依赖。上传会替换板子当前程序，但不会改动原程序文件。
恢复检测时重新上传 ../SmartSoilTFT/SmartSoilTFT.ino。

## 接线与方向

沿用现有已工作接线：CS 25、DC 26、RST 33、SDA/MOSI 23、SCL/SCK 18；共地。
电源和 BL 沿用当前已验证的接法，本程序不要求改成 5V。
本预览横屏 320×240：左侧原 Web 模型，右侧作物名称和 AI 解读示例。
若上下颠倒，将 setRotation(1) 改为 setRotation(3)。

## 后续

正式版将把静态示例换成经过校准的检测数据、可靠规则筛选的候选及真实 AI 解读。
作物图片可继续预存，但动态中文需要字体与排版实现；本预览不代表这些已完成。
