"""Render a quick assembly preview of the V7 square tray and removable bridge."""
from pathlib import Path
import math

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "square-soil-v7"
tray = trimesh.load(OUT / "V7_02_integrated_square_soil_tray.stl")
bridge = trimesh.load(OUT / "V7_05_wide_probe_bridge.stl")
bridge.apply_translation((0, 0, 17))  # Exploded view only; printable STL is unchanged.


def font(size, bold=False):
    suffix = "Arial Bold.ttf" if bold else "Arial.ttf"
    return ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/" + suffix, size
    )


angle = math.radians(-48)
elevation = math.radians(28)


def project(vertices):
    x = vertices[:, 0] * math.cos(angle) - vertices[:, 1] * math.sin(angle)
    y = vertices[:, 0] * math.sin(angle) + vertices[:, 1] * math.cos(angle)
    return np.column_stack((x, vertices[:, 2] * math.cos(elevation)
                            - y * math.sin(elevation))), (
        vertices[:, 2] * math.sin(elevation) + y * math.cos(elevation)
    )


meshes = [(tray, np.array([101, 157, 141])),
          (bridge, np.array([238, 174, 91]))]
all_points = np.vstack([project(mesh.vertices)[0] for mesh, _ in meshes])
low = all_points.min(axis=0)
high = all_points.max(axis=0)
scale = min(720 / (high[0] - low[0]), 540 / (high[1] - low[1]))
center = (low + high) / 2

canvas = Image.new("RGB", (1280, 780), "#F1F5F3")
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((34, 112, 826, 721), radius=8,
                       fill="#FFFFFF", outline="#C6D3CF", width=2)
draw.text((48, 34), "SMART SOIL / SQUARE SOIL TRAY V7",
          fill="#14332F", font=font(34, True))
draw.text((50, 82), "Exploded preview: removable sensor bridge above the soil box",
          fill="#5D7771", font=font(17))

faces = []
for mesh, base in meshes:
    points, depth = project(mesh.vertices)
    points = (points - center) * scale
    points[:, 1] *= -1
    points += (430, 410)
    for index, face in enumerate(mesh.faces):
        shade = 0.72 + 0.25 * max(0, float(mesh.face_normals[index, 2]))
        color = tuple(int(min(255, channel * shade)) for channel in base)
        faces.append((depth[face].mean(), [tuple(points[i]) for i in face], color))
for _, polygon, color in sorted(faces, key=lambda item: item[0]):
    draw.polygon(polygon, fill=color, outline="#55716A")

draw.rounded_rectangle((850, 112, 1244, 721), radius=8,
                       fill="#FFFFFF", outline="#C6D3CF", width=2)
draw.text((884, 150), "SOIL BOX", fill="#14332F", font=font(25, True))
draw.text((884, 197), "Outer: 120 x 72.5 x 66 mm", fill="#526D67", font=font(18))
draw.text((884, 229), "Inside: 114 x 56 x 62 mm", fill="#526D67", font=font(18))
draw.text((884, 261), "~350 mL below rim", fill="#247A65", font=font(20, True))
draw.line((884, 317, 1206, 317), fill="#D7E2DE", width=2)
draw.text((884, 349), "SENSOR BRIDGE", fill="#14332F", font=font(25, True))
draw.text((884, 394), "pH opening: 34 mm", fill="#526D67", font=font(18))
draw.text((884, 426), "Capacitive: 32 x 7 mm", fill="#526D67", font=font(18))
draw.text((884, 458), "DS18B20: 12 mm", fill="#526D67", font=font(18))
draw.line((884, 515, 1206, 515), fill="#D7E2DE", width=2)
draw.text((884, 548), "PRINT FIT GAUGES FIRST", fill="#A16921", font=font(19, True))
draw.text((884, 583), "26 / 30 / 34 mm pH holes", fill="#526D67", font=font(18))
draw.text((884, 615), "32 x 7 mm probe slot", fill="#526D67", font=font(18))
draw.text((48, 739), "Preview only. Re-slice the STL files before printing; FDM water tightness is unverified.",
          fill="#5D7771", font=font(17))

path = OUT / "square_soil_v7_preview.png"
canvas.save(path)
print(path)
