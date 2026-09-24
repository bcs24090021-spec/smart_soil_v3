# Smart Soil Probe / FarmSandbox AI 完整项目

## 先运行 Dashboard

进入 `SmartSoilV2Dashboard`：

### Windows

双击 `start_windows.bat`，然后打开 `http://localhost:4173/`。

### macOS

```bash
cd SmartSoilV2Dashboard
npm run serve
```

再打开 `http://localhost:4173/`。

## ESP32 固件

最新完整固件在：

`SmartSoilSampleDock/firmware/SmartSoilTFT/SmartSoilTFT.ino`

图片资源必须和它一起保留：

`SmartSoilSampleDock/firmware/SmartSoilCropPhotoPreview/CropPhotoAssets.h`

固件目前包含：

- TFT 横屏显示
- START / NEXT 页面控制
- DS18B20 温度
- DHT22 空气温湿度
- Capacitive Soil Moisture
- PH4502C + E201-C
- TOP 3 作物筛选
- 作物图片显示
- Web Dashboard 串口连接

## 当前屏幕逻辑

1. 开机封面
2. START 后读取传感器
3. NEXT 显示 TOP 3 作物名字
4. NEXT 显示对应作物名字和图片

屏幕不会显示推荐原因或传感器详细资料；详细资料放在 Dashboard。

## 硬件接线

完整接线说明在：

- `SmartSoilSampleDock/firmware/README_ZH.md`
- `SmartSoilSampleDock/firmware/SmartSoilTFT/README_ZH.md`
- `SmartSoilV2Dashboard/README_WINDOWS.md`

## 3D 打印

推荐先查看：

`SmartSoilSampleDock/output/compact-modular-v5-clearance/PRINT_README_ZH.md`

Ender 3 V2 的打印和 G-code 文件也放在 `output` 文件夹内。

## 注意事项

- 上传 ESP32 前关闭 Dashboard 的 Web Serial 连接。
- pH4502C 的 PO 输出必须经过分压，不能直接进入 ESP32 ADC。
- DS18B20 裸传感器需要 4.7kΩ 上拉电阻。
- 当前作物推荐是 MVP 初筛结果，不是实验室检测或正式农艺处方。
