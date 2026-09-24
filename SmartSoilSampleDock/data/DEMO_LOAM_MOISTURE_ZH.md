# 评委演示用土壤湿度参考场景

`demo_loam_moisture_v1.csv` 是**计算示例，不是实地测得的作物最佳湿度表**。它假设一份结构良好的壤土，其田间持水量 FC 为 25% VWC、永久萎蔫点 WP 为 12% VWC。这两个演示值落在明尼苏达大学 Extension 给出的壤土典型范围内（FC 20–30%、WP 8–17%）：https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/how-agricultural-drainage-works

对 FAO 56 Table 22 中能直接匹配的非稻米作物，以 `estimated_stress_onset_vwc_pct = FC - p * (FC - WP)` 计算**可能开始水分胁迫的示例阈值**。FAO 的 `p` 参考条件是作物蒸散量约 5 mm/天；不同天气、土壤及生长阶段会改变它：https://www.fao.org/4/x0490e/x0490e0e.htm

例如，普通玉米 `p=0.55`，在上述**假设壤土**中计算为 `25 - 0.55*(25-12) = 17.85%`，表中四舍五入成 17.9% VWC。这表示该示范条件下接近缺水胁迫的下界，**不是玉米的通用最佳湿度 17.9%**。甜玉米与普通玉米分开列出。

稻米没有放入本表：FAO 的稻米 `p=0.20` 脚注使用饱和度基准，不能照搬同一 TAW 公式；稻田还涉及积水和水位管理。其余缺乏直接来源匹配的作物也不填假数。稻田管理参考：https://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd

**硬件使用界线：**ESP32 当前的 `soil_wetness_index` 是两点 ADC 相对指数，不是真实 VWC，因此不能与本表的 17.9% 等数字直接比较。评委演示可以展示“公开资料 + 假设土壤 + 计算示例”，但实时硬件仍只显示其相对湿润程度。空气湿度来自 DHT22，是另一项环境观测，不等同土壤湿度。
