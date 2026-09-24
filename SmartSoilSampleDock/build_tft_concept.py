"""Generate a dimension-provisional TFT station and annotated mesh preview."""
from pathlib import Path
import json
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from generate_models import box, cylinder, difference, union

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "tft-concept"
OUT.mkdir(parents=True, exist_ok=True)

# Front dry bay has a roof rising toward the sample bowl.
vertices = [[x, y, z] for x in (-75, 75)
            for y, top in [(-90, 32), (-5, 68)] for z in (0, top)]
dry_outer = trimesh.Trimesh(vertices=vertices, faces=trimesh.creation.box().faces)
wet_outer = box((150, 95, 68), (0, 42.5, 34))
shell = union([dry_outer, wet_outer])
wet_cavity = cylinder(42, 70, (0, 43, 41))
inner_vertices = [[x, y, z] for x in (-70, 70)
                  for y in (-85, -10) for z in (-1, 32 + (y + 90) * 36 / 85 - 4)]
dry_cavity = trimesh.Trimesh(vertices=inner_vertices, faces=trimesh.creation.box().faces)

angle = np.arctan2(36, 85)
screen_transform = trimesh.transformations.rotation_matrix(angle, [1, 0, 0])
screen_transform[:3, 3] = [0, -48, 49.8]
screen_cut = box((52, 40, 14))
screen_cut.apply_transform(screen_transform)
usb_cut = box((14, 17, 12), (73, -57, 13))
body = difference(shell, [wet_cavity, dry_cavity, screen_cut, usb_cut])

# Rear guides sit above a clear open bowl, no sample lid.
bridge = box((108, 12, 6), (0, 68, 92))
posts = [box((8, 12, 24), (x, 68, 80)) for x in (-50, 50)]
guides = [box((25, 4, 12), (-26, 68, 92)),
          cylinder(3.5, 12, (4, 68, 92)),
          cylinder(6.5, 12, (27, 68, 92))]
body = difference(union([body, bridge, *posts]), guides)
body.export(OUT / "TFT_station_chassis_CONCEPT.stl")

# Separate bottom service plate; dimensions are provisional, no validated mounts.
plate = box((144, 74, 3), (0, 0, 1.5))
plate.export(OUT / "bottom_service_plate_CONCEPT.stl")

parts = [(body, "#b9c5c8", 1)]
screen = box((57, 45, 2))
screen.apply_transform(screen_transform)
screen.apply_translation([0, 0, 2])
parts.append((screen, "#172e31", 1))
glass = box((44, 33, 1))
glass.apply_transform(screen_transform)
glass.apply_translation([0, 0, 3.5])
parts.append((glass, "#35bdcf", 1))
soil = cylinder(40, 25, (0, 43, 20.5))
parts.append((soil, "#82745f", 1))
moisture = box((23, 2, 83), (-26, 68, 72))
parts.append((moisture, "#255e42", 1))
temp = cylinder(3, 58, (4, 68, 59))
parts.append((temp, "#d1dbdf", 1))
ph = cylinder(6, 100, (27, 68, 89))
parts.append((ph, "#2aabab", .85))

fig = plt.figure(figsize=(13, 9), facecolor="#f6f8fa")
ax = fig.add_subplot(111, projection="3d", facecolor="#f6f8fa")
triangles = np.concatenate([mesh.vertices[mesh.faces] for mesh, _, _ in parts])
colors = [color for mesh, color, _ in parts for _ in mesh.faces]
collection = Poly3DCollection(triangles, facecolor=colors, edgecolor="none", zsort="average")
ax.add_collection3d(collection)
ax.set_xlim(-110, 110)
ax.set_ylim(-115, 110)
ax.set_zlim(0, 155)
ax.set_box_aspect((220, 225, 155))
ax.view_init(elev=32, azim=-58)
ax.set_axis_off()
labels = [(0, 25, 72, "OPEN SAMPLE BOWL"),
          (-54, -65, 70, "TILTED TFT / DRY BAY BELOW"),
          (60, 8, 77, "SOLID WET / DRY PARTITION"),
          (-58, 75, 123, "SOIL MOISTURE"),
          (3, 80, 108, "DS18B20"),
          (31, 80, 145, "REMOVABLE pH PROBE"),
          (78, -53, 18, "USB ACCESS")]
for x, y, z, label in labels:
    ax.text(x, y, z, label, fontsize=8, color="#172e31")
fig.suptitle("SMART SOIL / INTEGRATED TFT STATION", fontsize=19, fontweight="bold", y=.96)
fig.text(.08, .08, "150 x 180 x 95 mm chassis | Open top | Bottom service access", fontsize=12)
fig.text(.08, .045, "CONCEPT ONLY: screen, probes and mounts require measurement. Printed bowl is not certified watertight.", fontsize=10)
fig.savefig(OUT / "TFT_station_preview.png", dpi=160)
plt.close(fig)

parents = list(range(len(body.faces)))
def find(i):
    while parents[i] != i:
        parents[i] = parents[parents[i]]
        i = parents[i]
    return i
for a, b in body.face_adjacency:
    parents[find(int(a))] = find(int(b))
shell_count = len({find(i) for i in range(len(parents))})
report = {"bounds_mm": body.extents.tolist(), "watertight_mesh": bool(body.is_watertight),
          "connected_shells": shell_count, "volume_mm3": float(body.volume),
          "status": "concept_not_fit_validated"}
(OUT / "mesh_check.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
