#!/usr/bin/env python3
"""Generate printable STL parts for the Smart Soil Sample Dock V0."""

from pathlib import Path
import math

import trimesh


OUT = Path(__file__).resolve().parent / "stl"


def box(size, center=(0, 0, 0)):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(center)
    return mesh


def cylinder(radius, height, center=(0, 0, 0), sections=128):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    mesh.apply_translation(center)
    return mesh


def difference(base, cutters):
    return trimesh.boolean.difference([base, *cutters], engine="manifold")


def union(parts):
    return trimesh.boolean.union(parts, engine="manifold")


def export(mesh, name):
    mesh.remove_unreferenced_vertices()
    path = OUT / name
    mesh.export(path)
    print(
        f"{name}: watertight={mesh.is_watertight}, "
        f"size={mesh.extents.round(2).tolist()}, faces={len(mesh.faces)}"
    )


def make_sample_cup():
    # 74 mm inner diameter and 58 mm fill height gives about 250 mL.
    outer = cylinder(39.5, 65.0, center=(0, 0, 32.5))
    cavity = cylinder(37.0, 63.0, center=(0, 0, 34.5))
    cup = difference(outer, [cavity])

    # A tactile internal ring marks the repeatable 250 mL fill level.
    marker_outer = cylinder(37.0, 1.2, center=(0, 0, 61.0))
    marker_inner = cylinder(36.3, 1.4, center=(0, 0, 61.0))
    marker = difference(marker_outer, [marker_inner])
    return union([cup, marker])


def make_sensor_lid():
    plate = cylinder(42.0, 4.0, center=(0, 0, 2.0))
    skirt_outer = cylinder(42.0, 7.0, center=(0, 0, 7.5))
    skirt_inner = cylinder(39.8, 7.4, center=(0, 0, 7.5))
    skirt = difference(skirt_outer, [skirt_inner])
    lid = union([plate, skirt])

    # Adjustable slots fit the two rods of common analog 3-in-1 soil meters.
    cutters = [
        box((6.5, 28.0, 14.0), center=(-9.0, 5.0, 5.0)),
        box((6.5, 28.0, 14.0), center=(9.0, 5.0, 5.0)),
        # Capacitive soil moisture board slot.
        box((19.0, 4.8, 14.0), center=(0.0, -22.0, 5.0)),
        # Waterproof DS18B20 probe hole.
        cylinder(3.8, 14.0, center=(25.0, -15.0, 5.0), sections=64),
    ]
    return difference(lid, cutters)


def make_sensor_fit_test():
    plate = box((72.0, 48.0, 3.0), center=(0, 0, 1.5))
    cutters = [
        box((6.5, 28.0, 6.0), center=(-9.0, 4.0, 1.5)),
        box((6.5, 28.0, 6.0), center=(9.0, 4.0, 1.5)),
        box((19.0, 4.8, 6.0), center=(0.0, -18.0, 1.5)),
        cylinder(3.8, 6.0, center=(27.0, -13.0, 1.5), sections=48),
    ]
    return difference(plate, cutters)


def make_electronics_case():
    outer = box((90.0, 62.0, 32.0), center=(0, 0, 16.0))
    cavity = box((84.0, 56.0, 30.0), center=(0, 0, 18.0))
    shell = difference(outer, [cavity])

    # Cable exit toward the sensor cup and USB access on the opposite wall.
    cable_exit = box((8.0, 16.0, 12.0), center=(-44.0, 0, 24.0))
    usb_port = box((8.0, 14.0, 9.0), center=(44.0, 0, 8.0))
    shell = difference(shell, [cable_exit, usb_port])

    # Four low posts suit a typical 52 x 28 mm ESP32 DevKit footprint.
    posts = []
    holes = []
    for x in (-26.0, 26.0):
        for y in (-15.0, 15.0):
            posts.append(cylinder(3.2, 4.0, center=(x, y, 5.0), sections=48))
            holes.append(cylinder(1.25, 5.0, center=(x, y, 5.5), sections=48))
    mounted = union([shell, *posts])
    return difference(mounted, holes)


def make_electronics_lid():
    plate = box((91.0, 63.0, 2.4), center=(0, 0, 1.2))
    lip_outer = box((84.0, 56.0, 1.8), center=(0, 0, 3.3))
    lip_inner = box((80.0, 52.0, 2.2), center=(0, 0, 3.3))
    lip = difference(lip_outer, [lip_inner])
    return union([plate, lip])


def make_integrated_open_soil_station():
    """One-piece open-top soil station with an integrated electronics bay."""
    soil_center_x = -35.0

    # The two outer shells overlap by 5 mm, forming one printable chassis.
    soil_outer = cylinder(45.0, 72.0, center=(soil_center_x, 0.0, 36.0))
    electronics_outer = box((80.0, 90.0, 70.0), center=(45.0, 0.0, 35.0))

    # A narrow rear bridge locates probes without covering the soil surface.
    sensor_bridge = box((78.0, 10.0, 6.0), center=(soil_center_x, 40.0, 75.0))
    bridge_posts = [
        box((7.0, 10.0, 72.0), center=(-69.0, 40.0, 36.0)),
        box((7.0, 10.0, 72.0), center=(-1.0, 40.0, 36.0)),
    ]
    outer = union([soil_outer, electronics_outer, sensor_bridge, *bridge_posts])

    # Open soil chamber: about 250 mL at the internal fill marker height.
    soil_cavity = cylinder(40.5, 70.0, center=(soil_center_x, 0.0, 39.0))

    # Open electronics pocket. The 5 mm partition keeps soil out of the bay.
    electronics_cavity = box((70.0, 80.0, 66.0), center=(45.0, 0.0, 39.0))

    cutters = [
        soil_cavity,
        electronics_cavity,
        # USB access and a high cable pass-through toward the probes.
        box((10.0, 16.0, 10.0), center=(84.0, 0.0, 14.0)),
        box((12.0, 12.0, 10.0), center=(5.0, 28.0, 58.0)),
        # Probe guides in the rear bridge.
        box((6.5, 8.0, 10.0), center=(-44.0, 40.0, 75.0)),
        box((6.5, 8.0, 10.0), center=(-26.0, 40.0, 75.0)),
        box((19.0, 4.8, 10.0), center=(-61.0, 40.0, 75.0)),
        cylinder(3.8, 10.0, center=(-9.0, 40.0, 75.0), sections=64),
    ]
    chassis = difference(outer, cutters)

    # Posts rise from the electronics bay floor for an ESP32 DevKit.
    posts = []
    holes = []
    for x in (25.0, 65.0):
        for y in (-15.0, 15.0):
            posts.append(cylinder(3.2, 5.0, center=(x, y, 7.5), sections=48))
            holes.append(cylinder(1.25, 6.0, center=(x, y, 8.0), sections=48))
    # A slim center rib reduces each sensor-bridge span to about 30 mm.
    bridge_rib = box((6.0, 8.0, 68.0), center=(soil_center_x, 39.0, 38.0))
    mounted = union([chassis, bridge_rib, *posts])
    return difference(mounted, holes)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fit_test = make_sensor_fit_test()
    cup = make_sample_cup()
    sensor_lid = make_sensor_lid()
    electronics_case = make_electronics_case()
    electronics_lid = make_electronics_lid()
    integrated_station = make_integrated_open_soil_station()

    export(fit_test, "00_sensor_fit_test.stl")
    export(cup.copy(), "01_sample_cup_250ml.stl")
    export(sensor_lid.copy(), "02_adjustable_sensor_lid.stl")
    export(electronics_case.copy(), "03_esp32_electronics_case.stl")
    export(electronics_lid.copy(), "04_electronics_case_lid.stl")
    export(integrated_station, "07_integrated_open_soil_station.stl")

    # Pre-arranged disconnected shells fit a 220 x 220 mm Ender-3 V2 bed.
    placements = [
        (cup, (-55.0, -55.0, 0.0)),
        (sensor_lid, (55.0, -55.0, 0.0)),
        (electronics_case, (-50.0, 55.0, 0.0)),
        (electronics_lid, (50.0, 55.0, 0.0)),
    ]
    arranged = []
    for part, translation in placements:
        placed = part.copy()
        placed.apply_translation(translation)
        arranged.append(placed)
    export(trimesh.util.concatenate(arranged), "SmartSoilDock_Ender3V2_print_plate.stl")

    # Assembled preview only: lids are flipped so their retaining lips face down.
    assembled_lid = sensor_lid.copy()
    assembled_lid.apply_transform(
        trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0))
    )
    assembled_lid.apply_translation((0.0, 0.0, 76.0))

    assembled_case = electronics_case.copy()
    assembled_case.apply_translation((105.0, 0.0, 0.0))
    assembled_case_lid = electronics_lid.copy()
    assembled_case_lid.apply_transform(
        trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0))
    )
    assembled_case_lid.apply_translation((105.0, 0.0, 36.2))

    assembly = trimesh.util.concatenate(
        [cup.copy(), assembled_lid, assembled_case, assembled_case_lid]
    )
    assembly.apply_translation((-54.25, 0.0, 0.0))
    export(assembly, "05_assembled_preview_not_for_print.stl")

    # Exploded preview shows how each lid mates with its enclosure.
    exploded_lid = sensor_lid.copy()
    exploded_lid.apply_transform(
        trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0))
    )
    exploded_lid.apply_translation((0.0, 0.0, 96.0))
    exploded_case_lid = electronics_lid.copy()
    exploded_case_lid.apply_transform(
        trimesh.transformations.rotation_matrix(math.pi, (1, 0, 0))
    )
    exploded_case_lid.apply_translation((105.0, 0.0, 56.2))
    exploded = trimesh.util.concatenate(
        [cup.copy(), exploded_lid, assembled_case, exploded_case_lid]
    )
    exploded.apply_translation((-54.25, 0.0, 0.0))
    export(exploded, "06_exploded_assembly_preview_not_for_print.stl")


if __name__ == "__main__":
    main()
