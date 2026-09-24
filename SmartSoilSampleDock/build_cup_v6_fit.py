"""Build a smaller replacement cup and a cheap fit gauge for the V5 dock."""

from pathlib import Path
import json

from generate_models import cylinder, difference


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "cup-v6-reduced-fit"
OUT.mkdir(parents=True, exist_ok=True)

CUP_CENTER_Y = 33.0
CUP_OUTER_RADIUS = 32.0
CUP_INNER_RADIUS = 29.0
CUP_HEIGHT = 58.0
CUP_BOTTOM = 4.0


def annulus(height: float, bottom: float):
    center_z = bottom + height / 2
    outer = cylinder(CUP_OUTER_RADIUS, height, (0, CUP_CENTER_Y, center_z))
    inner = cylinder(CUP_INNER_RADIUS, height + 2, (0, CUP_CENTER_Y, center_z))
    return difference(outer, [inner])


cup_outer = cylinder(CUP_OUTER_RADIUS, CUP_HEIGHT,
                     (0, CUP_CENTER_Y, CUP_HEIGHT / 2))
cup_cavity = cylinder(CUP_INNER_RADIUS, CUP_HEIGHT - CUP_BOTTOM + 2,
                      (0, CUP_CENTER_Y, CUP_BOTTOM + (CUP_HEIGHT - CUP_BOTTOM + 2) / 2))
cup = difference(cup_outer, [cup_cavity])
fit_gauge = annulus(8.0, 0.0)

parts = {
    "V6_03_smaller_soil_cup_64mm.stl": cup,
    "V6_00_cup_fit_gauge_64mm.stl": fit_gauge,
}
for filename, mesh in parts.items():
    mesh.remove_unreferenced_vertices()
    assert mesh.is_watertight, filename
    mesh.export(OUT / filename)

# V5 dock: front joining wall ends at y=-1; rear wall begins at y=67.
front_gap = (CUP_CENTER_Y - CUP_OUTER_RADIUS) - (-1.0)
rear_gap = 67.0 - (CUP_CENTER_Y + CUP_OUTER_RADIUS)
receiver_gap = 37.2 - (CUP_OUTER_RADIUS + abs(CUP_CENTER_Y - 32.0))
assert min(front_gap, rear_gap, receiver_gap) >= 2.0

report = {
    "replacement_for": "V5_03_CUP_51G.gcode; do not print the old cup again",
    "cup_outer_diameter_mm": 2 * CUP_OUTER_RADIUS,
    "cup_inner_diameter_mm": 2 * CUP_INNER_RADIUS,
    "cup_wall_mm": CUP_OUTER_RADIUS - CUP_INNER_RADIUS,
    "cup_height_mm": CUP_HEIGHT,
    "cup_bottom_mm": CUP_BOTTOM,
    "cup_center_y_mm": CUP_CENTER_Y,
    "dock_clearance_nominal_mm": {
        "front_joining_wall": front_gap,
        "rear_wall": rear_gap,
        "receiver_bore_minimum_radial": receiver_gap,
    },
    "fit_gauge_height_mm": 8.0,
    "stl_watertight": True,
    "note": "Nominal CAD dimensions only. Print the 8 mm gauge and check physical fit first.",
}
(OUT / "dimensions.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
