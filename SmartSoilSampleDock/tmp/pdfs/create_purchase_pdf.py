from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "Smart_Soil_Prototype_Purchase_List_ZH.pdf"

registerFont(UnicodeCIDFont("STSong-Light"))

GREEN = colors.HexColor("#19734A")
DARK = colors.HexColor("#18332A")
PALE = colors.HexColor("#EAF4EE")
ORANGE = colors.HexColor("#E9783A")
LIGHT = colors.HexColor("#F5F7F6")
MID = colors.HexColor("#66756F")
LINE = colors.HexColor("#CAD7D1")

styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleZH",
    parent=styles["Title"],
    fontName="STSong-Light",
    fontSize=23,
    leading=29,
    textColor=DARK,
    alignment=TA_LEFT,
    spaceAfter=4 * mm,
)
subtitle = ParagraphStyle(
    "SubtitleZH",
    parent=styles["Normal"],
    fontName="STSong-Light",
    fontSize=9.5,
    leading=14,
    textColor=MID,
)
heading = ParagraphStyle(
    "HeadingZH",
    parent=styles["Heading2"],
    fontName="STSong-Light",
    fontSize=14,
    leading=18,
    textColor=DARK,
    spaceBefore=4 * mm,
    spaceAfter=2.5 * mm,
)
body = ParagraphStyle(
    "BodyZH",
    parent=styles["BodyText"],
    fontName="STSong-Light",
    fontSize=9.5,
    leading=15,
    textColor=DARK,
)
small = ParagraphStyle(
    "SmallZH",
    parent=body,
    fontSize=8,
    leading=11.5,
    textColor=MID,
)
white_center = ParagraphStyle(
    "WhiteCenter",
    parent=body,
    fontSize=9,
    leading=12,
    textColor=colors.white,
    alignment=TA_CENTER,
)
cell = ParagraphStyle(
    "CellZH",
    parent=body,
    fontSize=8.3,
    leading=11.2,
)
cell_center = ParagraphStyle(
    "CellCenterZH",
    parent=cell,
    alignment=TA_CENTER,
)


def p(text, style=body):
    return Paragraph(text, style)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 13 * mm, 193 * mm, 13 * mm)
    canvas.setFont("STSong-Light", 7.5)
    canvas.setFillColor(MID)
    canvas.drawString(17 * mm, 8.5 * mm, "Smart Soil 一体式原型 - 采购清单")
    canvas.drawRightString(193 * mm, 8.5 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def budget_card(label, value, note, color):
    content = [
        p(label, ParagraphStyle("CardLabel", parent=small, textColor=MID, alignment=TA_CENTER)),
        p(value, ParagraphStyle("CardValue", parent=body, fontSize=18, leading=23, textColor=color, alignment=TA_CENTER)),
        p(note, ParagraphStyle("CardNote", parent=small, fontSize=7.3, alignment=TA_CENTER)),
    ]
    table = Table([[content]], colWidths=[55 * mm], rowHeights=[28 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    return table


items = [
    ("1", "ESP32 DevKit V1", "1", "29.90", "主处理器、Wi-Fi、读取 Sensor"),
    ("2", "Capacitive Soil Moisture Sensor v1.2", "1", "10.00", "泥土湿度读数"),
    ("3", "Waterproof DS18B20 温度探针", "1", "8.00", "泥土温度读数"),
    ("4", "ADS1115 16-bit ADC 模块", "1", "10.00", "提高模拟信号读取稳定性"),
    ("5", "3-in-1 Soil Meter", "1", "24.00", "pH / Moisture / Light 拆机验证"),
    ("6", "4.7 kΩ、10 kΩ 电阻小包", "1", "3.00", "上拉与输入保护"),
    ("7", "Dupont 连接线", "1 套", "5.00", "模块接线"),
    ("8", "Mini breadboard 或洞洞板", "1", "5.00", "固定及焊接电路"),
    ("9", "USB 数据线", "1", "5.00", "ESP32 供电及烧录"),
    ("10", "M3 螺丝、螺母及垫片", "1 套", "4.00", "固定 ESP32 和模块"),
    ("11", "可拆卸 PP 塑料内杯", "1-2", "3.00", "湿泥与打印外壳隔离"),
    ("12", "热缩管、绝缘胶带或中性硅胶", "1 份", "5.00", "绝缘和防溅水"),
]


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=17 * mm,
        rightMargin=17 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Smart Soil Prototype Purchase List",
        author="FarmSandbox AI Project",
    )

    story = [
        p("SMART SOIL / HARDWARE BOM", ParagraphStyle("Eyebrow", parent=small, fontSize=8, textColor=GREEN)),
        p("一体式土壤检测原型购买清单", title),
        p("适用于开放式泥土槽 + ESP32 电子舱的一体式 3D 打印版本。价格为马来西亚单件购买的预算预留，不包含运费和 3D 打印材料。", subtitle),
        Spacer(1, 6 * mm),
        Table(
            [[
                budget_card("全部重新购买", "RM111.90", "不含运费", GREEN),
                budget_card("Sensor + 处理器", "RM81.90", "核心电子元件", ORANGE),
                budget_card("接线与安装", "RM30.00", "耗材及 PP 内杯", DARK),
            ]],
            colWidths=[58.5 * mm] * 3,
            style=[("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm)],
        ),
        p("A. 必须购买", heading),
    ]

    data = [[p("#", white_center), p("物品", white_center), p("数量", white_center), p("预算 RM", white_center), p("用途", white_center)]]
    for idx, name, qty, price, purpose in items:
        data.append([p(idx, cell_center), p(name, cell), p(qty, cell_center), p(price, cell_center), p(purpose, cell)])

    table = Table(data, colWidths=[8 * mm, 61 * mm, 15 * mm, 22 * mm, 69 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 1.6 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 1.6 * mm),
                ("TEXTCOLOR", (3, 1), (3, 1), ORANGE),
            ]
        )
    )
    story.extend([table, Spacer(1, 3 * mm), p("预算合计：<b>RM111.90</b>，不包含运费和 3D 打印材料。", body)])

    story.extend(
        [
            PageBreak(),
            p("BUDGET NOTES", ParagraphStyle("Eyebrow2", parent=small, fontSize=8, textColor=GREEN)),
            p("预算优化与购买注意事项", title),
            p("B. 可以复用的物品", heading),
        ]
    )

    reuse = [
        [p("可复用物品", white_center), p("可省预算", white_center)],
        [p("手机 USB 充电器或 Power Bank", cell), p("RM15-30", cell_center)],
        [p("USB 数据线", cell), p("RM5", cell_center)],
        [p("Dupont 线、breadboard、电阻", cell), p("RM13", cell_center)],
        [p("M3 螺丝和绝缘材料", cell), p("RM9", cell_center)],
    ]
    reuse_table = Table(reuse, colWidths=[130 * mm, 45 * mm])
    reuse_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.extend(
        [
            reuse_table,
            Spacer(1, 4 * mm),
            p("若已有线材、USB 供电、螺丝和绝缘耗材，购买额可降低到约 <b>RM84.90</b>。若第一阶段暂时不进行 pH 拆机实验，可先不买 3-in-1 Soil Meter 与 ADS1115，再减少约 <b>RM34</b>。"),
            p("C. pH 功能的重要限制", heading),
            Table(
                [[p("普通指针式 3-in-1 Soil Meter 没有标准数字输出，不能保证拆开后可直接连接 ESP32，也不能当成实验室级 pH Sensor。它适合 Hackathon 概念验证。若最终需要可信、可校准的 pH 数据，应改用带 BNC 接口、放大板和 pH 4.00 / 7.00 校准液的电子探针，但这通常会明显超出 RM100 总预算。", body)]],
                colWidths=[175 * mm],
                style=[
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF1E8")),
                    ("BOX", (0, 0), (-1, -1), 0.8, ORANGE),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                    ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
                ],
            ),
            p("D. 建议购买顺序", heading),
            p("1. 先买 ESP32、湿度 Sensor、DS18B20 和基础线材，完成温度与湿度原型。"),
            p("2. 打印 Sensor 孔位测试片，核对实际探针尺寸。"),
            p("3. 再买 3-in-1 Soil Meter 和 ADS1115，单独验证是否能提取稳定模拟信号。"),
            Spacer(1, 6 * mm),
            p("参考价格来源：Einstronic ESP32 DevKit V1（RM29.90）；Rectronx 电容式土壤湿度 Sensor（RM8-12）；SHEIN Malaysia 3-in-1 Soil Meter（RM24）。价格和库存可能变化。", small),
        ]
    )

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
