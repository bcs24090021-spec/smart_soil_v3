# Smart Soil Sample Dock V0

This is a first-fit 3D-printable enclosure for a repeatable soil-sample demo.
See `PURCHASE_LIST_ZH.md` for the complete prototype bill of materials.

## Parts

- `SmartSoilSampleDock_Ender3V2_CRPLA.3mf`: complete four-part Creality Print
  project configured for Ender-3 V2, 0.4 mm nozzle, CR-PLA, and 0.20 mm layers.
- `SensorFitTest_Ender3V2_CRPLA.3mf`: recommended first print, using the same
  printer and material profile.
- `SmartSoil_Integrated_OpenTop_V1_Ender3V2.3mf`: one-piece station with an
  open soil chamber, integrated electronics bay, sensor bridge, USB opening,
  and ESP32 mounting posts. No soil lid is required.

- `00_sensor_fit_test.stl`: low-material test coupon for checking actual sensor
  dimensions before printing the full lid.
- `01_sample_cup_250ml.stl`: removable soil cup, 74 mm internal diameter.
- `02_adjustable_sensor_lid.stl`: guide for a common analog two-rod soil meter,
  a capacitive moisture board, and a 6 mm DS18B20 probe.
- `03_esp32_electronics_case.stl`: dry enclosure for an ESP32 and ADS1115.
- `04_electronics_case_lid.stl`: friction-fit lid for the electronics case.
- `SmartSoilDock_Ender3V2_print_plate.stl`: all four parts pre-arranged for a
  220 x 220 mm Ender-3 V2 print bed.

## Suggested print settings

- Material: PETG preferred; PLA is acceptable for a dry indoor prototype.
- Nozzle: 0.4 mm.
- Layer height: 0.20 mm.
- Walls: 4.
- Top/bottom layers: 5.
- Infill: 20% gyroid or grid.
- Supports: off for all parts in their default orientation.
- Cup: add a 5 mm brim if bed adhesion is weak.

The printed cup is not assumed to be watertight. Use a thin removable PP cup
liner for wet soil. Keep all electronics in the separate enclosure.

For the integrated V1 station, line the soil chamber with a thin removable PP
cup or seal it with a food-safe coating before adding wet soil. The electronics
bay is physically separated by a 5 mm wall but is not certified waterproof.

## Fit status

V0 intentionally uses adjustable slots because the exact soil-meter dimensions
are not available yet. Measure the purchased meter before a final field print.

Both configured 3MF files were sliced successfully with Creality Print 7.2.1.
The fit test is approximately 7.6 g / 36 minutes. The complete plate is
approximately 115 g / 9 hours 34 minutes. These estimates can change with the
installed printer and filament profile.
