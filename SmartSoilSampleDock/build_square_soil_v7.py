"""Build a larger, single-wall square soil tray for the existing V5 front module."""
from pathlib import Path
import json

from generate_models import box, cylinder, difference, union


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "square-soil-v7"
OUT.mkdir(parents=True, exist_ok=True)

# The mating slots stay compatible with the V5 front-module tongues.
FLOOR_THICKNESS = 4.0
WALL_THICKNESS = 3.0
WALL_TOP = 66.0
TRAY_INNER_WIDTH = 114.0
TRAY_INNER_DEPTH = 56.0

floor = box((120, 72.5, FLOOR_THICKNESS), (0, 33.75, FLOOR_THICKNESS / 2))
side_walls = [box((WALL_THICKNESS, 72.5, 62), (x, 33.75, 35))
              for x in (-58.5, 58.5)]
rear_wall = box((114, WALL_THICKNESS, 62), (0, 68.5, 35))
# The front soil wall sits behind the existing V5 joining tongues.
soil_front_wall = box((114, WALL_THICKNESS, 62), (0, 9.5, 35))
outer_mating_wall = box((114, 4, 30), (0, 5, 15))
tongue_slots = [box((14.6, 6, 8.6), (x, 5, 12)) for x in (-49, 49)]
outer_mating_wall = difference(outer_mating_wall, tongue_slots)
square_tray = union([floor, *side_walls, rear_wall,
                     soil_front_wall, outer_mating_wall])

# A removable, flat bridge sits on the side walls. Larger holes accept the
# pH probe body without relying on the old 14 mm stem-only opening.
bridge_blank = box((120, 42, 4), (0, 45, 68))
capacitive_slot = box((32, 7, 8), (-33, 45, 68))
ds18b20_hole = cylinder(6, 8, (0, 45, 68), sections=64)
ph_hole = cylinder(17, 8, (27, 45, 68), sections=96)
probe_bridge = difference(bridge_blank,
                          [capacitive_slot, ds18b20_hole, ph_hole])

# Cheap gauges let the user verify the real probes before printing a full part.
ph_gauge_blank = box((120, 44, 3), (0, 0, 1.5))
ph_gauge_holes = [cylinder(radius, 7, (x, 0, 1.5), sections=96)
                  for x, radius in [(-38, 13), (0, 15), (38, 17)]]
ph_fit_gauge = difference(ph_gauge_blank, ph_gauge_holes)
capacitive_fit_gauge = difference(
    box((42, 17, 3), (0, 0, 1.5)),
    [box((32, 7, 7), (0, 0, 1.5))],
)
temperature_gauge_blank = box((64, 22, 3), (0, 0, 1.5))
temperature_gauge_holes = [cylinder(radius, 7, (x, 0, 1.5), sections=64)
                           for x, radius in [(-20, 4), (0, 5), (20, 6)]]
temperature_fit_gauge = difference(temperature_gauge_blank,
                                   temperature_gauge_holes)

parts = {
    "V7_02_integrated_square_soil_tray.stl": square_tray,
    "V7_05_wide_probe_bridge.stl": probe_bridge,
    "V7_00_pH_fit_gauge_26_30_34.stl": ph_fit_gauge,
    "V7_00_capacitive_fit_gauge_32x7.stl": capacitive_fit_gauge,
    "V7_00_DS18B20_fit_gauge_8_10_12.stl": temperature_fit_gauge,
}

report = {}
for name, mesh in parts.items():
    mesh.remove_unreferenced_vertices()
    components = len(mesh.split(only_watertight=False))
    assert mesh.is_watertight and components == 1, name
    mesh.export(OUT / name)
    report[name] = {
        "bounds_mm": [round(float(x), 2) for x in mesh.extents],
        "volume_cm3_solid_mesh": round(abs(float(mesh.volume)) / 1000, 1),
        "connected_components": components,
        "watertight_mesh": bool(mesh.is_watertight),
    }

report["soil_cavity"] = {
    "width_mm": TRAY_INNER_WIDTH,
    "depth_mm": TRAY_INNER_DEPTH,
    "height_mm": WALL_TOP - FLOOR_THICKNESS,
    "geometric_maximum_ml": round(
        TRAY_INNER_WIDTH * TRAY_INNER_DEPTH *
        (WALL_TOP - FLOOR_THICKNESS) / 1000
    ),
    "practical_fill_note": "Keep soil and slurry below the rim; this is not a tested capacity.",
}
report["material_comparison"] = {
    "old_v5_rear_dock_plus_cup_solid_mesh_cm3": 155.7,
    "old_v5_rear_dock_plus_reduced_v6_cup_solid_mesh_cm3": 145.5,
    "new_tray_solid_mesh_cm3": report[
        "V7_02_integrated_square_soil_tray.stl"
    ]["volume_cm3_solid_mesh"],
    "note": "Mesh volumes, not slicer filament mass. Re-slice before claiming grams saved.",
}
(OUT / "dimensions.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
