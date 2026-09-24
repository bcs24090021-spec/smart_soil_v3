from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "Smart_Soil_Concept_Brief_Detailed_ZH.pdf"
ISO_IMAGE = ROOT / "tmp" / "pdfs" / "model_annotation_assets" / "integrated_isometric.png"
TOP_IMAGE = ROOT / "tmp" / "pdfs" / "model_annotation_assets" / "integrated_top.png"
PH_IMAGE = Path("/var/folders/zy/68qqn2cs75v2yr1554tt69tc0000gn/T/codex-clipboard-4cb98e56-e1b9-4a69-af9b-f824cbb2fbb8.png")

registerFont(UnicodeCIDFont("STSong-Light"))

GREEN = colors.HexColor("#19734A")
DARK = colors.HexColor("#17342A")
ORANGE = colors.HexColor("#E9783A")
PALE = colors.HexColor("#EAF4EE")
LIGHT = colors.HexColor("#F5F7F6")
MID = colors.HexColor("#66756F")
LINE = colors.HexColor("#CAD7D1")
SOIL = colors.HexColor("#604333")
RED = colors.HexColor("#B8443C")
WHITE = colors.white

styles = getSampleStyleSheet()
cover_title = ParagraphStyle("CoverTitle", parent=styles["Title"], fontName="STSong-Light", fontSize=28, leading=35, textColor=DARK, alignment=TA_LEFT, spaceAfter=5 * mm)
title = ParagraphStyle("PageTitle", parent=styles["Title"], fontName="STSong-Light", fontSize=22, leading=28, textColor=DARK, alignment=TA_LEFT, spaceAfter=4 * mm)
heading = ParagraphStyle("Heading", parent=styles["Heading2"], fontName="STSong-Light", fontSize=14, leading=18, textColor=DARK, spaceBefore=3 * mm, spaceAfter=2 * mm)
subheading = ParagraphStyle("Subheading", parent=styles["Heading3"], fontName="STSong-Light", fontSize=11, leading=15, textColor=GREEN, spaceBefore=2 * mm, spaceAfter=1.5 * mm)
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="STSong-Light", fontSize=9.5, leading=15, textColor=DARK, spaceAfter=1.5 * mm)
small = ParagraphStyle("Small", parent=body, fontSize=7.8, leading=11.5, textColor=MID)
eyebrow = ParagraphStyle("Eyebrow", parent=small, fontSize=8, leading=10, textColor=GREEN, spaceAfter=2 * mm)
cell = ParagraphStyle("Cell", parent=body, fontSize=8.3, leading=11.5, spaceAfter=0)
cell_center = ParagraphStyle("CellCenter", parent=cell, alignment=TA_CENTER)
white_cell = ParagraphStyle("WhiteCell", parent=cell, textColor=WHITE, alignment=TA_CENTER)
quote = ParagraphStyle("Quote", parent=body, fontSize=14, leading=22, textColor=DARK, alignment=TA_CENTER)


def p(text, style=body):
    return Paragraph(text, style)


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 13 * mm, width - 17 * mm, 13 * mm)
    canvas.setFillColor(MID)
    canvas.setFont("STSong-Light", 7.5)
    canvas.drawString(17 * mm, 8.5 * mm, "Smart Soil 一体式土壤检测站 - Concept Brief")
    canvas.drawRightString(width - 17 * mm, 8.5 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def section_title(kicker, text):
    return [p(kicker, eyebrow), p(text, title)]


def info_box(text, accent=GREEN, background=PALE):
    return Table(
        [[p(text, body)]],
        colWidths=[175 * mm],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), background),
            ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
            ("BOX", (0, 0), (-1, -1), 0.45, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ],
    )


def clean_table(headers, rows, widths, font_size=8.3):
    header_style = ParagraphStyle("Header", parent=white_cell, fontSize=font_size)
    local_cell = ParagraphStyle("LocalCell", parent=cell, fontSize=font_size, leading=font_size + 3)
    data = [[p(h, header_style) for h in headers]]
    for row in rows:
        data.append([p(str(v), local_cell) for v in row])
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 2.3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.3 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
            ]
        )
    )
    return table


def workflow_table(items):
    cells = []
    for i, (name, detail) in enumerate(items, 1):
        cells.append(
            Table(
                [[p(str(i), ParagraphStyle("StepNo", parent=cell_center, fontSize=14, textColor=WHITE))], [p(name, ParagraphStyle("StepName", parent=cell_center, fontSize=9.5, textColor=DARK))], [p(detail, ParagraphStyle("StepDetail", parent=small, alignment=TA_CENTER))]],
                colWidths=[31 * mm],
                rowHeights=[10 * mm, 10 * mm, 19 * mm],
                style=[
                    ("BACKGROUND", (0, 0), (0, 0), GREEN),
                    ("BACKGROUND", (0, 1), (0, -1), LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
                ],
            )
        )
    row = []
    for i, cell_item in enumerate(cells):
        row.append(cell_item)
        if i < len(cells) - 1:
            row.append(p(">", ParagraphStyle("Arrow", parent=body, fontSize=16, textColor=ORANGE, alignment=TA_CENTER)))
    widths = []
    for i in range(len(row)):
        widths.append(31 * mm if i % 2 == 0 else 5 * mm)
    return Table([row], colWidths=widths, style=[("VALIGN", (0, 0), (-1, -1), "MIDDLE")])


def metric_card(label, value, note, color=GREEN):
    return Table(
        [[[p(label, ParagraphStyle("MetricLabel", parent=small, alignment=TA_CENTER)), p(value, ParagraphStyle("MetricValue", parent=body, fontSize=18, leading=23, textColor=color, alignment=TA_CENTER)), p(note, ParagraphStyle("MetricNote", parent=small, fontSize=7.3, alignment=TA_CENTER))]]],
        colWidths=[55 * mm],
        rowHeights=[29 * mm],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ],
    )


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title="Smart Soil Detailed Concept Brief",
        author="FarmSandbox AI Project Team",
    )
    story = []

    # Page 1 - cover
    story.extend(
        [
            p("FARMSANDBOX AI / HARDWARE CONCEPT", eyebrow),
            p("Smart Soil 一体式土壤检测站", cover_title),
            p("面向 Hackathon 的详细 Concept Brief", ParagraphStyle("CoverSub", parent=body, fontSize=13, leading=18, textColor=GREEN)),
            Spacer(1, 4 * mm),
            Image(str(ISO_IMAGE), width=176 * mm, height=104 * mm),
            Spacer(1, 2 * mm),
            info_box("<b>一句话概念：</b>用户把固定量泥土与固定量蒸馏水放入一体式测试容器，按下测试后，系统读取 pH、湿度和温度，并把结果转换成容易理解的土壤状态与改善建议。"),
            Spacer(1, 5 * mm),
            Table(
                [[metric_card("用户主要动作", "3 个", "加泥土 / 加水 / 开始"), metric_card("第一阶段参数", "3 项", "pH / Moisture / Temperature", ORANGE), metric_card("当前定位", "Prototype", "概念验证，不是实验室认证", DARK)]],
                colWidths=[58.3 * mm] * 3,
                style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm)],
            ),
            Spacer(1, 7 * mm),
            p("版本：Concept V1.1 | 语言：中文 | 适用对象：项目组员、导师与 Hackathon 评审", small),
        ]
    )

    # Page 2 - why and scope
    story.append(PageBreak())
    story.extend(section_title("01 / PRODUCT INTENT", "我们要解决什么问题"))
    story.extend(
        [
            p("很多农民或种植者能够看到泥土的外观，却难以快速判断泥土是否太酸、太湿、太干，或当前条件是否适合目标作物。传统检测可能需要多个仪器、重复取样和专业解释。"),
            p("本项目把样本容器、Sensor、ESP32 和结果界面整合为一个简单操作流程，让非技术用户也能完成基础土壤检查。"),
            p("目标用户体验", heading),
            p("“我只需要放入泥土、加入指定水量并按下测试，系统就告诉我目前土壤状况，以及下一步应该做什么。”", quote),
            p("第一阶段要做到", heading),
            clean_table(
                ["范围", "具体目标", "成功标准"],
                [
                    ("物理装置", "一体式开放泥土槽、电子舱和探针支架", "可重复放置相同体积样本"),
                    ("测量", "pH、泥土湿度、泥土温度", "读数稳定并附带可信度提示"),
                    ("操作", "加泥土、加水、按 Start Test", "组员无需了解接线即可测试"),
                    ("输出", "状态、警告、基础改善建议", "不直接展示难懂的原始电压"),
                ],
                [31 * mm, 82 * mm, 62 * mm],
            ),
            p("第一阶段暂时不做", heading),
            clean_table(
                ["不纳入", "原因"],
                [
                    ("实验室级土壤认证", "原型无法替代标准实验室分析"),
                    ("准确 NPK 浓度", "pH、湿度和 EC 不能识别具体氮磷钾离子"),
                    ("永久埋地监测", "PH4502C 玻璃电极不适合长期留在泥浆中"),
                    ("自动施肥或灌溉", "先验证测量和解释流程，再考虑执行机构"),
                ],
                [60 * mm, 115 * mm],
            ),
        ]
    )

    # Page 3 - user flow
    story.append(PageBreak())
    story.extend(section_title("02 / USER JOURNEY", "用户实际怎么操作"))
    story.extend(
        [
            workflow_table([
                ("取样", "取有代表性的泥土"),
                ("加泥土", "加入到 SOIL 刻度"),
                ("加水", "加入到 WATER 刻度"),
                ("等待", "搅拌并静置"),
                ("测试", "按 Start Test"),
            ]),
            p("建议的标准化样本流程", heading),
            clean_table(
                ["步骤", "用户动作", "系统或设计要求"],
                [
                    ("1", "取约 20 g 风干并去除石块的泥土", "样本来源和深度应尽量一致"),
                    ("2", "把泥土加入可拆卸 PP 内杯", "达到 SOIL 刻度线"),
                    ("3", "加入约 50 mL 蒸馏水", "形成约 1:2.5 soil:water 测试比例"),
                    ("4", "搅拌 30-60 秒并静置 5-10 分钟", "让可测液相形成；最终时间需实验确定"),
                    ("5", "把 pH 探针降入上层悬液", "玻璃头不能用来刺穿硬土"),
                    ("6", "按 Start Test", "系统检查稳定性并取得多次样本平均值"),
                    ("7", "查看结果并清洗容器和 pH 探针", "pH 探针清洗后放回 KCl 储存液"),
                ],
                [14 * mm, 74 * mm, 87 * mm],
            ),
            Spacer(1, 3 * mm),
            info_box("<b>蒸馏水怎样购买？</b> Hackathon 可以使用超市或药房出售、瓶身明确写 Distilled Water / Air Suling 且没有添加矿物质的产品。不要使用矿泉水或添加矿物质的饮用水。", ORANGE, colors.HexColor("#FFF1E8")),
            Spacer(1, 2 * mm),
            info_box("<b>为什么水量必须固定？</b> 同一块泥土加入不同水量，测出的 pH 与 EC 可能不同。固定泥土质量、固定水量、固定等待时间，才能比较不同样本。"),
            p("异常情况", heading),
            clean_table(
                ["情况", "系统提示"],
                [
                    ("样本太干或没有加水", "请加入指定水量后重新测试"),
                    ("pH 数值持续漂移", "检查校准、气泡、探针储存状态与接线"),
                    ("湿度读数超出合理范围", "重新插入探针并检查是否接触容器壁"),
                    ("温度变化过快", "等待样本与探针达到热平衡"),
                ],
                [66 * mm, 109 * mm],
            ),
        ]
    )

    # Page 4 - sensor roles
    story.append(PageBreak())
    story.extend(section_title("03 / SENSOR STRATEGY", "每一个 Sensor 到底测什么"))
    sensor_rows = [
        ("PH4502C + BNC pH 电极", "土壤悬液的酸碱度", "液体模拟输出", "需要 pH 4.00 / 7.00 校准；不可硬插干土"),
        ("Capacitive Soil Moisture v1.2", "相对含水状态", "模拟输出", "必须针对容器与泥土类型做 dry/wet calibration"),
        ("Waterproof DS18B20", "泥土或悬液温度", "1-Wire 数字", "需要 4.7 kΩ 上拉电阻"),
        ("EC Sensor - Phase 2", "整体溶解盐/离子导电性", "模拟或数字", "只能反映总体盐分，不能识别具体 NPK"),
    ]
    story.extend(
        [
            clean_table(["Sensor", "测量对象", "信号", "关键限制"], sensor_rows, [49 * mm, 40 * mm, 28 * mm, 58 * mm], 7.8),
            p("为什么不是直接 Focus 在所有 ions？", heading),
            p("pH 与氢离子活度有关；EC 反映溶液整体导电能力。要分别测量 NO3-、K+、NH4+ 或 PO4 等特定离子，需要 Ion-Selective Electrode（ISE）、专用放大电路、标准液和频繁校准，成本与维护难度远高于本阶段。"),
            info_box("<b>正确表述：</b>系统能够测量 pH、相对湿度与温度，并可在未来加入 EC 来判断总体盐分风险；系统不能仅凭这些参数宣称已经测出准确 NPK。", ORANGE, colors.HexColor("#FFF1E8")),
            p("PH4502C 套装在本项目中的角色", heading),
            Table(
                [[Image(str(PH_IMAGE), width=77 * mm, height=64 * mm), p("图片中的套装包含 BNC 玻璃 pH 电极与信号板，适合读取液体或土壤悬液。它比机械指针式 3-in-1 Soil Meter 更容易连接 ESP32，但仍属于原型级方案。<br/><br/><b>购买前确认：</b>是否包含探针、板、连接线、pH 4/7 校准液或校准粉，以及 KCl 储存液。", body)]],
                colWidths=[83 * mm, 92 * mm],
                style=[("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BACKGROUND", (0, 0), (-1, -1), LIGHT), ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)],
            ),
        ]
    )

    # Page 5 - pH process
    story.append(PageBreak())
    story.extend(section_title("04 / pH MEASUREMENT", "pH 测量为什么要这样做"))
    story.extend(
        [
            p("pH 电极实际上测量液相中的电化学响应。干土无法提供稳定的离子迁移与电极接触，因此本项目采用固定比例的 soil-water slurry（土壤悬液）方法。"),
            Table(
                [[metric_card("泥土样本", "20 g", "固定取样量", SOIL), metric_card("蒸馏水", "50 mL", "约 1:2.5 比例", GREEN), metric_card("初始等待", "5-10 min", "最终由实验确定", ORANGE)]],
                colWidths=[58.3 * mm] * 3,
                style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm)],
            ),
            p("每次测试前", heading),
            clean_table(
                ["检查", "要求"],
                [
                    ("两点校准", "使用 pH 4.00 与 pH 7.00 标准液建立转换关系"),
                    ("探针状态", "玻璃球完整、保持湿润，没有干燥结晶或明显污染"),
                    ("电路", "PH4502C 供电稳定；输出不超过 ESP32/ADS1115 安全输入范围"),
                    ("温度", "记录 DS18B20 温度；温差较大时等待稳定"),
                ],
                [46 * mm, 129 * mm],
            ),
            p("读数接受条件", heading),
            clean_table(
                ["条件", "建议规则"],
                [
                    ("稳定性", "连续多次读数变化小于预设阈值才接受"),
                    ("时间", "超过最大等待时间仍漂移则标记为 Low Confidence"),
                    ("范围", "超出合理 pH 范围时先要求重新校准，而不是直接给农业建议"),
                    ("重复测量", "同一样本至少进行 2-3 次验证，记录平均值与差异"),
                ],
                [46 * mm, 129 * mm],
            ),
            p("测试后维护", heading),
            p("用蒸馏水轻柔冲洗 pH 电极，不要擦拭玻璃球；按照电极要求放入 KCl 储存液。不能让探针长期留在泥浆中，也不能长期泡在蒸馏水里。"),
            info_box("Hackathon 展示时应说“标准化土壤悬液 pH 原型”，不要说“直接插土、即时实验室级检测”。这样的表述更可信。", ORANGE, colors.HexColor("#FFF1E8")),
        ]
    )

    # Page 6 - hardware architecture
    story.append(PageBreak())
    story.extend(section_title("05 / HARDWARE ARCHITECTURE", "硬件与信号怎样连接"))
    story.extend(
        [
            p("信号路径", heading),
            workflow_table([
                ("样本", "泥土 + 蒸馏水"),
                ("Sensor", "pH / 湿度 / 温度"),
                ("调理", "PH4502C + ADS1115"),
                ("ESP32", "采样、过滤、校准"),
                ("结果", "Dashboard / 建议"),
            ]),
            p("核心模块", heading),
            clean_table(
                ["模块", "主要连接", "设计注意"],
                [
                    ("ESP32 DevKit V1", "Wi-Fi、I2C、1-Wire、ADC", "所有模块必须共地；USB 负责供电与烧录"),
                    ("ADS1115", "I2C 接 ESP32", "用于较稳定地读取 pH 或湿度模拟电压"),
                    ("PH4502C", "5V 供电、模拟输出", "先实测输出范围；必要时用分压保护 ADC"),
                    ("Moisture Sensor", "3.3V、模拟输出", "不要让上方电子元件浸水"),
                    ("DS18B20", "3.3V、GPIO、4.7 kΩ", "采用防水金属探头版本"),
                ],
                [42 * mm, 55 * mm, 78 * mm],
            ),
            p("推荐采样逻辑", heading),
            clean_table(
                ["阶段", "动作"],
                [
                    ("Warm-up", "上电后等待 pH 模块与传感器稳定"),
                    ("Acquire", "每个参数连续采样多次，不采用单点瞬时读数"),
                    ("Filter", "去除异常值并计算平均值或中位数"),
                    ("Calibrate", "应用 pH 两点校准、湿度 dry/wet 校准和 ADC 修正"),
                    ("Validate", "检查范围、漂移、传感器断线与样本条件"),
                    ("Publish", "输出数值、状态标签、可信度与建议"),
                ],
                [45 * mm, 130 * mm],
            ),
            info_box("ESP32 内置 ADC 的参考电压存在芯片差异，也容易受噪声影响。若使用内置 ADC，应校准并进行多次采样；若使用 ADS1115，也仍需验证输入电压范围和接地。"),
        ]
    )

    # Page 7 - enclosure
    story.append(PageBreak())
    story.extend(section_title("06 / PHYSICAL DESIGN", "一体式 3D 结构与下一版修改"))
    story.extend(
        [
            Image(str(TOP_IMAGE), width=176 * mm, height=94 * mm),
            clean_table(
                ["区域", "当前功能", "V2 必须修改"],
                [
                    ("圆形开放槽", "放置测试泥土", "加入 20 g / 50 mL 或等效 SOIL/WATER 刻度"),
                    ("Sensor 横梁", "定位探针", "把旧 3-in-1 双槽改成 PH4502C 玻璃探针保护套"),
                    ("电子舱", "放置 ESP32 与 ADS1115", "增加防溅边、排线固定和可维修入口"),
                    ("隔墙", "分隔湿区与干区", "验证水位低于隔墙并增加密封处理"),
                    ("样本内杯", "当前仅概念要求", "加入可拆洗 PP 内杯及防旋转定位"),
                ],
                [40 * mm, 54 * mm, 81 * mm],
            ),
            p("设计原则", heading),
            p("湿区与电子区必须物理分开；玻璃 pH 电极只能垂直降入悬液，不能承担刺穿泥土的机械力；用户接触的操作点应清楚标识 SOIL、WATER、START 和 CLEAN。"),
            info_box("<b>当前状态：</b>现有 V1 STL 已验证能够在 Ender-3 V2 平台切片，但它仍是外形与空间概念模型。购买 PH4502C 实物并量尺寸后，才应完成可打印 V2。", ORANGE, colors.HexColor("#FFF1E8")),
        ]
    )

    # Page 8 - interpretation
    story.append(PageBreak())
    story.extend(section_title("07 / RESULT LOGIC", "系统怎样从读数变成建议"))
    story.extend(
        [
            p("系统不应直接把一个 Sensor 数字变成确定结论。正确流程是先验证数据，再结合目标作物与规则库进行解释。"),
            workflow_table([
                ("Raw", "原始电压与温度"),
                ("Calibrated", "换算 pH / 湿度"),
                ("Validated", "检查漂移与范围"),
                ("Classified", "Low / Good / High"),
                ("Advice", "解释与下一步"),
            ]),
            p("示例输出逻辑", heading),
            clean_table(
                ["观察", "可以给的建议", "不能直接宣称"],
                [
                    ("pH 偏低", "土壤偏酸；复测并参考目标作物 pH 范围", "一定需要加入多少石灰"),
                    ("pH 偏高", "土壤偏碱；确认水源和样本，再考虑改良", "确定缺少某一种养分"),
                    ("湿度偏低", "样本较干；补水后重新完成标准化测量", "整块农田都缺水"),
                    ("湿度偏高", "样本过湿；注意排水和根部缺氧风险", "已经发生根腐病"),
                    ("未来 EC 偏高", "可能存在盐分或肥料浓度过高风险", "准确知道是哪一种盐或肥料"),
                ],
                [43 * mm, 78 * mm, 54 * mm],
            ),
            p("Dashboard 最少要显示", heading),
            clean_table(
                ["显示项", "例子"],
                [
                    ("数值", "pH 5.4 / Moisture 62% / Temperature 28.3°C"),
                    ("状态", "偏酸 / 湿度正常 / 温度偏高"),
                    ("可信度", "High / Medium / Low，以及低可信度原因"),
                    ("建议", "重新校准、补水复测、参考目标作物范围"),
                    ("测试条件", "泥土量、水量、等待时间、测试日期"),
                ],
                [48 * mm, 127 * mm],
            ),
            info_box("AI 可以帮助解释和组织建议，但不能弥补错误的采样、未校准 Sensor 或缺失的养分数据。第一阶段应先把标准化测试流程做好。"),
        ]
    )

    # Page 9 - budget and variants
    story.append(PageBreak())
    story.extend(section_title("08 / BOM & BUDGET", "硬件预算与方案选择"))
    mvp_rows = [
        ("ESP32 DevKit V1", "1", "29.90"),
        ("Capacitive Soil Moisture Sensor v1.2", "1", "10.00"),
        ("Waterproof DS18B20", "1", "8.00"),
        ("ADS1115", "1", "10.00"),
        ("PH4502C 完整套装", "1", "69.99"),
        ("电阻、线材、洞洞板、USB", "1 套", "18.00"),
        ("M3 螺丝、PP 内杯、绝缘材料", "1 套", "12.00"),
    ]
    story.extend(
        [
            clean_table(["物品", "数量", "预算 RM"], mvp_rows, [107 * mm, 25 * mm, 43 * mm]),
            Spacer(1, 3 * mm),
            Table([[metric_card("当前完整原型", "RM157.89", "不含运费与打印材料", GREEN), metric_card("PH4502C 套装", "RM69.99", "按用户截图价格", ORANGE), metric_card("严格 RM100", "无法全买", "需复用模块或延后 pH", RED)]], colWidths=[58.3 * mm] * 3, style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm)]),
            p("三种选择", heading),
            clean_table(
                ["方案", "做法", "优点", "限制"],
                [
                    ("A - 推荐 MVP", "PH4502C + 湿度 + 温度", "较可信、可连接 ESP32", "必须加水、清洗和校准"),
                    ("B - 最低预算", "先做湿度 + 温度", "最快完成硬件", "暂时没有 pH"),
                    ("C - 直接插土", "RS485 Soil pH Probe", "用户操作最简单", "约 RM245，需 9-24V 和 RS485 模块"),
                ],
                [35 * mm, 54 * mm, 45 * mm, 41 * mm],
            ),
            info_box("采购决定：先向卖家确认 RM69.99 套装是否包含 BNC 电极、PH4502C 板、连接线、校准液/粉和储存液。缺少关键配件时不要下单。", ORANGE, colors.HexColor("#FFF1E8")),
        ]
    )

    # Page 10 - roadmap, roles, validation, references
    story.append(PageBreak())
    story.extend(section_title("09 / EXECUTION PLAN", "如何把 Concept 变成 Hackathon Demo"))
    story.extend(
        [
            p("实施阶段", heading),
            clean_table(
                ["阶段", "主要工作", "完成标准"],
                [
                    ("Phase 1 - Bench Test", "分别测试 pH、湿度和温度模块", "每个 Sensor 有稳定、可重复的读数"),
                    ("Phase 2 - Calibration", "pH 4/7 两点校准；湿度 dry/wet 校准", "记录校准参数和误差"),
                    ("Phase 3 - Mechanical V2", "量实物尺寸并修改一体式外壳", "探针安全、内杯可拆、电子区防溅"),
                    ("Phase 4 - Integration", "ESP32 同时读取并输出结果", "一次测试完成全部参数"),
                    ("Phase 5 - Demo", "加入简单结果页面和建议规则", "组员可在 3 分钟内完整演示"),
                ],
                [37 * mm, 82 * mm, 56 * mm],
            ),
            p("建议组员分工", heading),
            clean_table(
                ["角色", "责任"],
                [
                    ("Hardware", "接线、供电保护、Sensor 单体测试"),
                    ("Measurement", "样本 SOP、校准、重复性和误差记录"),
                    ("Mechanical", "PH4502C 实物量测、3D V2、防溅与可清洗设计"),
                    ("Firmware", "采样、过滤、校准、状态检查和数据输出"),
                    ("UX / Presentation", "用户流程、结果解释、Demo Script 和风险说明"),
                ],
                [48 * mm, 127 * mm],
            ),
            p("Demo 验证清单", heading),
            p("□ 同一缓冲液重复测量差异可接受　□ pH 4 与 pH 7 能正确区分　□ 湿度干/湿变化方向正确　□ DS18B20 与参考温度接近　□ 电子舱无进水　□ 用户能在无指导情况下完成流程　□ Dashboard 不夸大 NPK 或实验室精度"),
            p("参考资料", heading),
            p("1. DFRobot, Gravity Analog pH Meter Kit V2: https://www.dfrobot.com/product-1782.html", small),
            p("2. European Commission JRC, soil pH using a 1:2.5 soil-water ratio: https://publications.jrc.ec.europa.eu/repository/bitstream/JRC19558/EUR%2019052%20EN.pdf", small),
            p("3. UF/IFAS, Soil pH and Electrical Conductivity: https://ask.ifas.ufl.edu/publication/SS118", small),
            p("4. Espressif, ESP32 ADC Calibration Driver: https://docs.espressif.com/projects/esp-idf/en/v5.0/esp32/api-reference/peripherals/adc_calibration.html", small),
            p("5. USDA NRCS, Soil Electrical Conductivity Guide: https://cropwatch.unl.edu/sites/unl.edu.ianr.extension.cropwatch/files/media/file/USDA-NRCS-EC-guide.pdf", small),
            p("6. QQ Trading Malaysia, RS485 Soil pH Sensor: https://qqtrading.com.my/soil-ph-sensor-agricultural-rs485-modbus", small),
            Spacer(1, 4 * mm),
            info_box("<b>最终对外说法：</b>这是一个标准化、便携的一体式土壤样本检测原型。它降低了农民完成基础 pH、湿度和温度检查的操作门槛，并把读数转成可理解的状态与下一步建议。"),
        ]
    )

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
