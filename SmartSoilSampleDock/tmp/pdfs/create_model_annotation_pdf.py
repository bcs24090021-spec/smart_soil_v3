from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "stl" / "07_integrated_open_soil_station.stl"
ASSET_DIR = ROOT / "tmp" / "pdfs" / "model_annotation_assets"
OUTPUT = ROOT / "output" / "pdf" / "Smart_Soil_3D_Model_Annotated_ZH.pdf"

GREEN = "#19734A"
DARK = "#17342A"
ORANGE = "#E9783A"
CLAY = "#C66B43"
SOIL = "#5A3828"
BOARD = "#2F7D5A"
PALE = colors.HexColor("#EAF4EE")
LIGHT = colors.HexColor("#F5F7F6")
LINE = colors.HexColor("#CAD7D1")
MID = colors.HexColor("#66756F")


def equal_axes(ax, bounds):
    mins, maxs = bounds
    center = (mins + maxs) / 2
    radius = max(maxs - mins) / 2 * 0.58
    ax.set_xlim(center[0] - radius, center[0] + radius)
    ax.set_ylim(center[1] - radius, center[1] + radius)
    ax.set_zlim(0, center[2] + radius * 0.72)
    ax.set_box_aspect((1, 0.72, 0.55))


def add_number(ax, xyz, text, color=GREEN):
    ax.text(
        *xyz,
        text,
        ha="center",
        va="center",
        color="white",
        fontsize=11,
        fontweight="bold",
        bbox=dict(boxstyle="circle,pad=0.33", fc=color, ec="white", lw=1.2),
        zorder=20,
    )


def render_isometric(mesh, output):
    fig = plt.figure(figsize=(10.8, 6.4), dpi=180, facecolor="white")
    ax = fig.add_subplot(111, projection="3d")
    poly = Poly3DCollection(mesh.triangles, facecolor=CLAY, edgecolor="#8F432A", linewidth=0.06)
    poly.set_alpha(1.0)
    ax.add_collection3d(poly)

    theta = np.linspace(0, 2 * np.pi, 100)
    soil_x = -35 + 38 * np.cos(theta)
    soil_y = 38 * np.sin(theta)
    soil_z = np.full_like(theta, 28.0)
    soil_surface = Poly3DCollection([list(zip(soil_x, soil_y, soil_z))], facecolor=SOIL, alpha=0.96)
    ax.add_collection3d(soil_surface)

    # Conceptual ESP32 board shown in the recessed electronics bay.
    board = [[(20, -18, 7.2), (70, -18, 7.2), (70, 18, 7.2), (20, 18, 7.2)]]
    ax.add_collection3d(Poly3DCollection(board, facecolor=BOARD, edgecolor="white", linewidth=0.8))

    equal_axes(ax, mesh.bounds)
    ax.view_init(elev=29, azim=-53)
    ax.set_axis_off()

    add_number(ax, (-35, -4, 55), "1")
    add_number(ax, (44, 1, 51), "2")
    add_number(ax, (-35, 41, 79), "3")
    add_number(ax, (7, 3, 55), "4", ORANGE)
    add_number(ax, (85, 0, 14), "5", ORANGE)
    add_number(ax, (5, 28, 59), "6", ORANGE)
    ax.set_title("INTEGRATED OPEN-TOP SMART SOIL STATION", fontsize=13, color=DARK, pad=0)
    fig.subplots_adjust(left=0.01, right=0.99, top=0.94, bottom=0.01)
    fig.savefig(output, bbox_inches="tight", pad_inches=0.08, facecolor="white")
    plt.close(fig)


def render_top(mesh, output):
    fig, ax = plt.subplots(figsize=(10.8, 5.9), dpi=180, facecolor="white")

    # Main top-view silhouette.
    try:
        section = mesh.section(plane_origin=[0, 0, 69], plane_normal=[0, 0, 1])
        planar, _ = section.to_2D()
        for poly in planar.polygons_full:
            x, y = poly.exterior.xy
            ax.fill(x, y, color=CLAY, alpha=1.0, ec="#8F432A", lw=1.0)
            for ring in poly.interiors:
                rx, ry = ring.xy
                ax.fill(rx, ry, color="white")
    except Exception:
        pass

    # Explicit top map makes the intended cavities and hardware positions clear.
    soil_circle = plt.Circle((-35, 0), 40.5, fc=SOIL, ec="white", lw=2.0, alpha=0.96)
    ax.add_patch(soil_circle)
    electronics = plt.Rectangle((10, -40), 70, 80, fc="#DDE9E2", ec=DARK, lw=1.3)
    ax.add_patch(electronics)
    board = plt.Rectangle((20, -18), 50, 36, fc=BOARD, ec="white", lw=1.5)
    ax.add_patch(board)
    ax.text(45, 0, "ESP32", ha="center", va="center", color="white", fontsize=11, weight="bold")

    # Rear sensor bridge and its real apertures.
    ax.add_patch(plt.Rectangle((-74, 35), 78, 10, fc=CLAY, ec="#8F432A", lw=1.0))
    slots = [
        (-61, 40, "A", "rect"),
        (-44, 40, "B1", "rect"),
        (-26, 40, "B2", "rect"),
        (-9, 40, "C", "circle"),
    ]
    for x, y, label, shape in slots:
        if shape == "circle":
            patch = plt.Circle((x, y), 3.8, fc="white", ec=DARK, lw=1.1)
        else:
            width = 19 if label == "A" else 6.5
            patch = plt.Rectangle((x - width / 2, y - 3.3), width, 6.6, fc="white", ec=DARK, lw=1.1)
        ax.add_patch(patch)
        ax.text(x, y, label, ha="center", va="center", color=GREEN, fontsize=8, weight="bold")

    # ESP32 posts.
    for x in (25, 65):
        for y in (-15, 15):
            ax.add_patch(plt.Circle((x, y), 3.2, fc=ORANGE, ec="white", lw=0.8))

    ax.annotate("E  SOIL CHAMBER", xy=(-35, 0), xytext=(-88, -48), fontsize=10, color=DARK,
                arrowprops=dict(arrowstyle="->", color=GREEN, lw=1.5))
    ax.annotate("D  ESP32 + ADS1115", xy=(45, 0), xytext=(38, -53), fontsize=10, color=DARK,
                arrowprops=dict(arrowstyle="->", color=GREEN, lw=1.5))
    ax.annotate("F  5 mm PARTITION", xy=(7, 0), xytext=(-5, -55), fontsize=10, color=DARK,
                arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.5))

    ax.set_xlim(-88, 90)
    ax.set_ylim(-59, 53)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("TOP VIEW / SENSOR PLACEMENT", fontsize=13, color=DARK, pad=8)
    fig.subplots_adjust(left=0.02, right=0.98, top=0.91, bottom=0.03)
    fig.savefig(output, bbox_inches="tight", pad_inches=0.08, facecolor="white")
    plt.close(fig)


registerFont(UnicodeCIDFont("STSong-Light"))
styles = getSampleStyleSheet()
title = ParagraphStyle("TitleZH", parent=styles["Title"], fontName="STSong-Light", fontSize=22, leading=28, textColor=colors.HexColor(DARK), spaceAfter=3 * mm)
subtitle = ParagraphStyle("SubtitleZH", parent=styles["BodyText"], fontName="STSong-Light", fontSize=9.2, leading=14, textColor=MID)
heading = ParagraphStyle("HeadingZH", parent=styles["Heading2"], fontName="STSong-Light", fontSize=14, leading=18, textColor=colors.HexColor(DARK), spaceBefore=3 * mm, spaceAfter=2 * mm)
body = ParagraphStyle("BodyZH", parent=styles["BodyText"], fontName="STSong-Light", fontSize=9.2, leading=14, textColor=colors.HexColor(DARK))
cell = ParagraphStyle("CellZH", parent=body, fontSize=8.7, leading=12)
small = ParagraphStyle("SmallZH", parent=body, fontSize=7.7, leading=11, textColor=MID)


def p(text, style=body):
    return Paragraph(text, style)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(17 * mm, 13 * mm, 193 * mm, 13 * mm)
    canvas.setFillColor(MID)
    canvas.setFont("STSong-Light", 7.5)
    canvas.drawString(17 * mm, 8.5 * mm, "Smart Soil 一体式开放泥土槽 - 3D 模型标注")
    canvas.drawRightString(193 * mm, 8.5 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def annotation_table(rows):
    data = [[p("编号", cell), p("区域", cell), p("放置内容 / 功能", cell)]]
    for row in rows:
        data.append([p(row[0], cell), p(row[1], cell), p(row[2], cell)])
    table = Table(data, colWidths=[17 * mm, 48 * mm, 110 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(GREEN)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    return table


def build_pdf(iso_path, top_path):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=15 * mm, bottomMargin=18 * mm, title="Smart Soil 3D Model Annotated", author="FarmSandbox AI Project")
    overview_rows = [
        ("1", "开放式泥土槽", "放入固定体积的泥土样本；建议使用可拆卸 PP 内杯，避免湿泥直接接触 PLA。"),
        ("2", "一体式电子舱", "安装 ESP32 DevKit、ADS1115 和接线板；与泥土区域共用一个机身。"),
        ("3", "Sensor 定位横梁", "固定垂直插入泥土的探针，只覆盖泥土槽后缘，不需要泥土盖。"),
        ("4", "5 mm 隔墙", "分隔泥土槽与电子舱，降低泥土和溅水进入电子区域的风险。"),
        ("5", "USB 侧面开口", "连接 ESP32 USB 线，用于供电、烧录和调试。"),
        ("6", "Sensor 走线口", "把探针线从定位横梁方向引入电子舱。"),
    ]
    sensor_rows = [
        ("A", "电容式湿度槽", "放置 Capacitive Soil Moisture Sensor v1.2，感应部分插入泥土。"),
        ("B1/B2", "双探针槽", "放置 3-in-1 Soil Meter 的两根金属探针，用于 pH / Moisture / Light 概念验证。"),
        ("C", "圆形温度孔", "放置 Waterproof DS18B20 金属温度探针。"),
        ("D", "电子安装区", "ESP32、ADS1115、洞洞板及接线；橙色圆点代表安装柱。"),
        ("E", "泥土填充区", "放置测试泥土；不要让泥土或水越过隔墙进入电子舱。"),
        ("F", "隔离区域", "泥土槽和电子舱之间的 5 mm 实体壁。"),
    ]
    story = [
        p("SMART SOIL / 3D HARDWARE MAP", small),
        p("一体式 3D 模型结构标注", title),
        p("模型：SmartSoil Integrated OpenTop V1 | 打印机配置：Creality Ender-3 V2，0.4 mm nozzle", subtitle),
        Spacer(1, 2 * mm),
        Image(str(iso_path), width=176 * mm, height=99 * mm),
        p("整体区域说明", heading),
        annotation_table(overview_rows),
        Spacer(1, 3 * mm),
        Table([[p("注意：这是开放式泥土槽设计。主体是一件打印成型，但 PLA 本身不保证防水；湿土测试前应加入 PP 内杯或进行可靠密封处理。", body)]], colWidths=[175 * mm], style=[("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF1E8")), ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(ORANGE)), ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm), ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm), ("TOPPADDING", (0, 0), (-1, -1), 3 * mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm)]),
        PageBreak(),
        p("TOP VIEW / SENSOR PLACEMENT", small),
        p("顶部安装位置", title),
        p("泥土从圆形开放区域加入。Sensor 由后缘横梁定位，并垂直插入泥土；电子模块放在相邻的下沉式电子舱。", subtitle),
        Spacer(1, 2 * mm),
        Image(str(top_path), width=176 * mm, height=96 * mm),
        p("Sensor 与电子元件位置", heading),
        annotation_table(sensor_rows),
        p("建议装配顺序", heading),
        p("1. 先安装 ESP32、ADS1115 和内部接线，再连接 USB 线。", body),
        p("2. 把湿度、温度及 3-in-1 探针穿过对应孔位，线路经走线口进入电子舱。", body),
        p("3. 放入 PP 内杯和固定量泥土，最后把探针垂直插入泥土。", body),
        p("4. 加水测试时保持液面低于隔墙顶部，并避免水进入电子舱。", body),
    ]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    mesh = trimesh.load_mesh(MODEL, process=False)
    iso_path = ASSET_DIR / "integrated_isometric.png"
    top_path = ASSET_DIR / "integrated_top.png"
    render_isometric(mesh, iso_path)
    render_top(mesh, top_path)
    build_pdf(iso_path, top_path)
    print(OUTPUT)


if __name__ == "__main__":
    main()
