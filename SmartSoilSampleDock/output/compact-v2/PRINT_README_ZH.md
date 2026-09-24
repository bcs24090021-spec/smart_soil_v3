# Smart Soil 小型省料版 V2

外形约 `120 × 145 × 83 mm`，土样槽内径约 `70 mm`。TFT 开口仍按 `52 × 40 mm` 保留，没有按比例缩小。

## 四个打印件

- `01_compact_integrated_chassis.stl`：一体主机身与土样槽
- `02_compact_sloped_TFT_face.stl`：TFT 倾斜面板
- `03_compact_probe_bridge.stl`：探头横梁
- `04_compact_vented_service_plate.stl`：通风底板

## 建议设置

- Ender-3 V2、0.4 mm 喷嘴
- 0.24 mm 层高
- 3 壁；土样槽建议 4 壁
- 5 层顶底
- 10% Gyroid 填充
- 主机身 6 mm Brim
- 主机身土样槽朝上；其余零件最大平面贴床
- 默认先关闭支撑，切片预览后只给导轨局部增加“接触热床”支撑

屏幕、ESP32、pH 板和探头尚未用卡尺完成最终配合验证。网格封闭不等于打印后防水，首次使用前必须漏水测试；正式版本建议加独立内杯。
