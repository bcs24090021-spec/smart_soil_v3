# 作物土壤水分资料第一轮核对

`fao56_crop_moisture_v1.csv` 整理了 FAO Irrigation and Drainage Paper 56 第 8 章 Table 22 与 Word 作物表可直接对应的条目。覆盖 30 种作物中的 10 种（玉米分普通玉米和甜玉米，共 11 条来源记录）。没有找到直接对应条目的作物不填数值，不把同科作物或泛称棕榈树的数值当作特定作物数值。

这里的 `p_value` 是根区总可利用水（TAW）可以被耗去多少、而尚未出现水分胁迫的参考比例；FAO 表中的通常条件为作物蒸散量 ETc 约 5 mm/天。它**不是土壤体积含水率 VWC**，也不是 ESP32 电容探针目前的 0–100 相对湿润指数。稻米条目的脚注另写明 `p=0.20 of saturation`，因此标成 `saturation`，不能按其他作物的 TAW 公式套用。来源：https://www.fao.org/4/x0490e/x0490e0e.htm

对非稻米作物，如果未来测得该土壤的田间持水量 `theta_FC` 和永久萎蔫点 `theta_WP`，且根区、天气和生长阶段条件合适，可以估算接近开始胁迫时的 VWC：`theta_threshold = theta_FC - p * (theta_FC - theta_WP)`。这是从 FAO 的 TAW/RAW 关系推导的条件性阈值，不是“作物最佳 VWC 区间”，更不能直接从当前两点 ADC 湿润指数计算。来源：https://www.fao.org/4/x0490e/x0490e0e.htm

土壤差异很大。明尼苏达大学 Extension 建议用传感器测得的 VWC、该地的田间持水量和可利用水容量判断缺水；作物、生长阶段也会改变允许耗水比例。来源：https://extension.umn.edu/natural-resources/conservation/agricultural-soil-and-water/irrigation/soil-moisture-sensors-for-irrigation-scheduling

马来西亚 MPOB 对油棕种植土壤的研究也显示，不同土类的可利用水容量差别很大；因此不能把一个全国通用的 VWC 范围直接写进油棕行。来源：https://opb.mpob.gov.my/the-available-water-holding-capacity-of-oil-palm-soils-in-malaysia/

**V1 用法：**保留 Word 的 VWC 列但标记为未核实；新 FAO 表仅作为注明条件的研究资料。当前固件不把 `p_value` 当成湿润指数、也不凭它推荐前三作物。以后若要用于数值筛选，先确认土壤类型、实测 FC/WP 或可靠的 VWC 校准，以及作物品种和生长阶段。
