"""Render a labeled contact sheet for every printable V5 STL."""
from pathlib import Path
import math

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "output" / "compact-modular-v5-clearance"
OUTPUT = SOURCE / "all_7_printable_parts.png"

PARTS = [
    ("01_front_electronics_module.stl", "01  Front electronics module", "RE-SLICE", "#84A8AE"),
    ("02_rear_soil_dock.stl", "02  Rear soil dock", "RE-SLICE", "#9CB8A5"),
    ("03_removable_sample_cup.stl", "03  Removable soil cup", "50.57 g", "#62A9C2"),
    ("04_TFT_face_6mm_TACT_BUTTONS.stl", "04  TFT + two-button face", "43.85 g", "#E2A84A"),
    ("05_probe_bridge.stl", "05  Probe bridge", "RE-SLICE", "#A286B8"),
    ("06_sliding_electronics_carrier_ESP32_PH.stl", "06  ESP32 + pH carrier", "15.86 g", "#D27868"),
    ("07_DHT22_ventilated_clip.stl", "07  DHT22 ventilated clip", "3.81 g", "#7DBB74"),
]


def font(size: int, bold: bool = False):
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    path = Path("/System/Library/Fonts/Supplemental") / name
    return ImageFont.truetype(str(path), size=size)


def rgb(hex_color: str):
    value = hex_color.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def projected(mesh: trimesh.Trimesh):
    vertices = mesh.vertices - mesh.bounding_box.centroid
    azimuth = math.radians(-48)
    elevation = math.radians(25)

    x = vertices[:, 0] * math.cos(azimuth) - vertices[:, 1] * math.sin(azimuth)
    y = vertices[:, 0] * math.sin(azimuth) + vertices[:, 1] * math.cos(azimuth)
    sx = x
    sy = vertices[:, 2] * math.cos(elevation) - y * math.sin(elevation)
    depth = vertices[:, 2] * math.sin(elevation) + y * math.cos(elevation)
    return np.column_stack((sx, sy)), depth


def render_mesh(draw: ImageDraw.ImageDraw, mesh, box, color):
    points, depth = projected(mesh)
    min_xy = points.min(axis=0)
    max_xy = points.max(axis=0)
    extent = np.maximum(max_xy - min_xy, 1e-6)
    left, top, right, bottom = box
    scale = min((right - left) / extent[0], (bottom - top) / extent[1])
    center = (min_xy + max_xy) / 2
    target = np.array([(left + right) / 2, (top + bottom) / 2])
    screen = (points - center) * scale
    screen[:, 1] *= -1
    screen += target

    base = np.array(color)
    face_order = np.argsort(depth[mesh.faces].mean(axis=1))
    for face_index in face_order:
        face = mesh.faces[face_index]
        polygon = [tuple(screen[index]) for index in face]
        normal = mesh.face_normals[face_index]
        shade = 0.76 + 0.20 * max(0.0, float(normal[2]))
        fill = tuple(int(min(255, channel * shade)) for channel in base)
        draw.polygon(polygon, fill=fill, outline=(62, 76, 80))


canvas = Image.new("RGB", (1800, 1120), "#F4F7F6")
draw = ImageDraw.Draw(canvas)
draw.text((70, 42), "SMART SOIL V5 / ALL 3D PRINTABLE PARTS", fill="#10292A", font=font(38, True))
draw.text((72, 94), "Ender-3 V2  |  0.20 mm  |  3 walls  |  10% gyroid  |  total weight TBD",
          fill="#496366", font=font(22))

columns = 4
cell_width = 410
cell_height = 430
start_x = 70
start_y = 150

for index, (filename, label, grams, color_hex) in enumerate(PARTS):
    row, column = divmod(index, columns)
    x = start_x + column * cell_width
    y = start_y + row * cell_height
    draw.rectangle((x, y, x + 375, y + 390), fill="#FFFFFF", outline="#CAD5D3", width=2)
    mesh = trimesh.load_mesh(SOURCE / filename, process=False)
    render_mesh(draw, mesh, (x + 28, y + 32, x + 347, y + 285), rgb(color_hex))
    draw.line((x + 24, y + 304, x + 351, y + 304), fill="#D7E0DE", width=2)
    draw.text((x + 24, y + 320), label, fill="#173335", font=font(20, True))
    extents = mesh.extents
    dimensions = f"{extents[0]:.0f} x {extents[1]:.0f} x {extents[2]:.0f} mm"
    draw.text((x + 24, y + 353), dimensions, fill="#657B7D", font=font(17))
    weight_font = font(13 if grams == "RE-SLICE" else 18, True)
    weight_x = x + (285 if grams == "RE-SLICE" else 292)
    draw.text((weight_x, y + 353), grams, fill="#087F5B", font=weight_font)

draw.text((72, 1046), "Parts 01, 02 and 05 were revised; their weights and the total require a new slice.",
          fill="#496366", font=font(19))
canvas.save(OUTPUT, quality=95)
print(OUTPUT)
