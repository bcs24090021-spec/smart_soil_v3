"""Build a material-conscious prototype preserving the selected integrated layout."""
from pathlib import Path
import json
import math
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from generate_models import box, cylinder, difference, union

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "compact-modular-v5-clearance"
OUT.mkdir(parents=True, exist_ok=True)


def wedge_wall(x0, x1):
    # Front top z=32, rear top z=68. Bottom remains open for service access.
    v = np.array([
        [x0, -75, 0], [x1, -75, 0], [x1, -5, 0], [x0, -5, 0],
        [x0, -75, 28], [x1, -75, 28], [x1, -5, 62], [x0, -5, 62],
    ], dtype=float)
    f = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    ])
    return trimesh.Trimesh(vertices=v, faces=f, process=True)


def sloped_part(width, depth, thickness, z_offset=0):
    angle = math.atan2(34, 70)
    mesh = box((width, depth, thickness))
    transform = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])
    transform[:3, 3] = [0, -40, 45 + z_offset]
    mesh.apply_transform(transform)
    return mesh


def sloped_hole(x, local_y, radius):
    angle = math.atan2(34, 70)
    hole = cylinder(radius, 12, (x, local_y, 0), sections=64)
    transform = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])
    transform[:3, 3] = [0, -40, 45]
    hole.apply_transform(transform)
    return hole


def sloped_rect(width, depth, thickness, x=0, local_y=0, local_z=0):
    angle = math.atan2(34, 70)
    item = box((width, depth, thickness), (x, local_y, local_z))
    transform = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])
    transform[:3, 3] = [0, -40, 45]
    item.apply_transform(transform)
    return item


# Rear wet zone: a receiver dock and a separately printable watertight cup.
rear_floor = box((120, 75, 3), (0, 32.5, 1.5))
rear_walls = [
    box((3, 75, 59), (-58.5, 32.5, 32.5)),
    box((3, 75, 59), (58.5, 32.5, 32.5)),
    box((114, 3, 59), (0, 68.5, 32.5)),
]
receiver_outer = cylinder(39.5, 8, (0, 32, 7))
receiver_inner = cylinder(37.2, 10, (0, 32, 8))
receiver = difference(receiver_outer, [receiver_inner])
cup_outer = cylinder(36.5, 58, (0, 32, 29))
cup_inner = cylinder(33.5, 57, (0, 32, 33))  # 4 mm cup bottom
sample_cup = difference(cup_outer, [cup_inner])

# Dry zone: separate front module with solid wet/dry partition; bottom stays open.
side_walls = [wedge_wall(-60, -57), wedge_wall(57, 60)]
front_wall = box((114, 3, 28), (0, -73.5, 14))
partition = box((114, 4, 62), (0, -5, 31))

# Two rear-facing tongues join the dry module to the wet dock.
joining_tabs = [box((14, 9, 8), (x, 1.5, 12)) for x in (-49, 49)]
rear_mating_wall = box((114, 4, 30), (0, -3, 15))
tab_slots = [box((14.6, 10, 8.6), (x, -1, 12)) for x in (-49, 49)]
rear_mating_wall = difference(rear_mating_wall, tab_slots)

# Rails support a separately printed sloped face, eliminating a large support roof.
panel_rails = []
for x in (-55, 55):
    for offset in (-3, 3):
        rail = sloped_part(7, math.hypot(70, 34), 2, z_offset=offset)
        rail.apply_translation([x, 0, 0])
        panel_rails.append(rail)
for x in (-58, 58):
    rib = sloped_part(1.5, math.hypot(70, 34), 8)
    rib.apply_translation([x, 0, 0])
    panel_rails.append(rib)

# Paired rails create a 3 mm sliding channel for the vented service plate.
bottom_rails = []
for x in (-55, 55):
    bottom_rails.extend([
        box((4, 64, 2), (x, -40, 1)),
        box((4, 64, 2), (x, -40, 6)),
    ])

# Rear probe bridge retains the original three-guide arrangement.
bridge = union([box((92, 12, 6), (0, 55, 80)),
                box((92, 3, 6), (0, 62.5, 80))])
# Carry bridge loads to the floor; the former 18 mm stubs started in mid-air.
posts = [box((7, 12, 77), (x, 55, 41.5)) for x in (-43, 43)]
guides = [
    box((24.5, 5, 12), (-23, 55, 80)),
    cylinder(4.0, 12, (3, 55, 80)),
    cylinder(7.0, 12, (23, 55, 80)),
]

front_module = union([*side_walls, front_wall, partition, *joining_tabs,
                      *panel_rails, *bottom_rails])
usb_access = box((8, 20, 14), (59, -60, 12))
front_module = difference(front_module, [usb_access])
rear_dock = union([rear_floor, *rear_walls, rear_mating_wall, receiver, *posts])
sensor_bridge = difference(bridge, guides)

# Sloped TFT face: removable, but becomes one visual body when seated on the rails.
panel = sloped_part(110, math.hypot(70, 34) - 3, 3)
# Photos indicate a roughly 60-62 x 42-44 mm TFT PCB. The smaller front
# window retains the board; a shallow rear pocket receives the PCB.
screen_window = sloped_rect(43.5, 33.5, 8)
tft_rear_pocket = sloped_rect(65, 47, 2.2, local_z=-1.0)
# The supplied switches are 6 x 6 mm tactile buttons, not 12 mm panel buttons.
button_holes = [sloped_rect(7.4, 7.4, 8, x=43, local_y=y) for y in (-13, 13)]
panel = difference(panel, [screen_window, tft_rear_pocket, *button_holes])

# Electronics service plate only; no unverified screw pattern is claimed.
service_plate = box((108, 62, 2.4), (0, -40, 3.5))
# Generic board supports: PH4502C zone 47 x 64 mm, ESP32 zone 32 x 56 mm.
# Posts are intentionally not drilled; foam tape or small printed clamps can
# accommodate board-to-board variation without forcing incorrect hole spacing.
board_posts = []
for cx, zone_w, zone_d in [(-27, 47, 60), (31, 32, 56)]:
    for sx in (-1, 1):
        for sy in (-1, 1):
            board_posts.append(box((5, 5, 4),
                (cx + sx * (zone_w / 2 - 3), -40 + sy * (zone_d / 2 - 3), 6.7)))
electronics_carrier = union([service_plate, *board_posts])

# Separate open clip for a common DHT22 breakout, with generous ventilation.
dht_back = box((24, 34, 2), (0, 0, 1))
dht_sides = [box((2, 34, 10), (x, 0, 6)) for x in (-11, 11)]
dht_stop = box((20, 2, 10), (0, -16, 6))
dht_clip = union([dht_back, *dht_sides, dht_stop])

parts = {
    "01_front_electronics_module.stl": front_module,
    "02_rear_soil_dock.stl": rear_dock,
    "03_removable_sample_cup.stl": sample_cup,
    "04_TFT_face_6mm_TACT_BUTTONS.stl": panel,
    "05_probe_bridge.stl": sensor_bridge,
    "06_sliding_electronics_carrier_ESP32_PH.stl": electronics_carrier,
    "07_DHT22_ventilated_clip.stl": dht_clip,
}
report = {}
total_volume = 0.0
for name, mesh in parts.items():
    mesh.remove_unreferenced_vertices()
    mesh.export(OUT / name)
    volume = abs(float(mesh.volume))
    total_volume += volume
    report[name] = {
        "bounds_mm": [round(float(x), 2) for x in mesh.extents],
        "volume_cm3": round(volume / 1000, 1),
        "watertight_mesh": bool(mesh.is_watertight),
    }

# PLA density estimate only; slicer infill, walls, supports and purge determine reality.
report["estimate"] = {
    "combined_mesh_volume_cm3": round(total_volume / 1000, 1),
    "solid_PLA_equivalent_g_at_1.24": round(total_volume / 1000 * 1.24),
    "previous_compact_v2_solid_equivalent_g": 264,
    "note": "Prototype dimensions remain provisional; slice before printing.",
}
(OUT / "material_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

# Assembled preview for visual verification; the panel is shown seated on its rails.
fig = plt.figure(figsize=(11, 8), facecolor="#f6f8f7")
ax = fig.add_subplot(111, projection="3d", facecolor="#f6f8f7")
preview_parts = [(front_module, "#b8c8ca"), (rear_dock, "#c6d2d4"),
                 (sample_cup, "#d4e7e9"), (panel, "#4f9ca5"),
                 (sensor_bridge, "#879da1")]
triangles = np.concatenate([mesh.vertices[mesh.faces] for mesh, _ in preview_parts])
colors = [color for mesh, color in preview_parts for _ in mesh.faces]
ax.add_collection3d(Poly3DCollection(triangles, facecolor=colors,
                                     edgecolor="#52656a", linewidth=.08))
ax.set_xlim(-75, 75); ax.set_ylim(-90, 90); ax.set_zlim(0, 100)
ax.set_box_aspect((150, 180, 100)); ax.view_init(elev=28, azim=-55)
ax.set_axis_off()
fig.suptitle("SMART SOIL / CLEARANCE-FIRST MODULAR V5", fontsize=17, y=.95)
fig.text(.08, .06, "generous fit gaps | generic ESP32 + pH carrier | separate DHT22 clip", fontsize=10)
fig.text(.08, .035, "PROTOTYPE: verify TFT, probe and board dimensions before committing to a full print.", fontsize=9)
fig.savefig(OUT / "low_material_preview.png", dpi=180, bbox_inches="tight")
plt.close(fig)
print(json.dumps(report, indent=2))
