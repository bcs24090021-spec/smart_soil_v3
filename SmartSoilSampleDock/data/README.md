# Crop reference V1

`crop_reference_v1.csv` is a direct transcription of the 30 crop ranges in the user-provided `agriculture (2).docx` ("Agriculture Soil Reference Table – Sarawak"). Its numeric ranges have not been independently validated. The source document does not cite references or describe how the ranges were derived. This is a provisional threshold table, not measured samples or AI training data.

Columns use inclusive lower and upper bounds. `soil_vwc_*_pct` means volumetric water content in percent, `soil_temp_*_c` means soil temperature in Celsius, and `soil_ph_*` is unitless. Images from the document are not included in this CSV.

Do not compare the firmware's `soil_wetness_index` (a 0–100 relative calibration between two sample readings) with VWC percentages. The firmware currently reports `soil_moisture_pct: null` and, until pH calibration is integrated, `ph: null`. The paddy rice VWC range in particular needs source and unit verification before use in recommendations. Many crops share identical ranges, so this table alone cannot justify a reliable ordered top-three result.

V1 status: the main `firmware/SmartSoilTFT/` sketch uses the Word temperature ranges and a coarse grouping derived from its unverified VWC ranges to show three **DEMO** candidates. This does not validate the ranges or make the current sensor index equivalent to VWC. pH is uncalibrated and excluded from the demo score. See that sketch's README for the exact scoring and button flow.

See `MOISTURE_RESEARCH_V1.md` for source-backed interpretation of soil moisture and air humidity. Air humidity is recorded separately by the DHT22 as `air_humidity_pct`; no crop-specific RH thresholds have been added to the CSV because the sources reviewed do not support one universal range per crop.

`fao56_crop_moisture_v1.csv` is a separate, source-linked lookup for crop water-depletion fractions from FAO 56. See `FAO56_MOISTURE_LOOKUP_ZH.md` for coverage, units, and why these values are not interchangeable with the Word VWC ranges or the current sensor index.

`demo_loam_moisture_v1.csv` and `DEMO_LOAM_MOISTURE_ZH.md` provide an explicitly hypothetical loam-soil calculation for a judge-facing prototype. Their percentages are illustrative stress-onset VWC values, not universal crop targets or live sensor readings.

The Word document's crop photos are extracted byte-for-byte into `crop_photos_v1/`, with one `manifest.csv` row per crop ID. Row 19 (Eggplant) has no embedded photo; the manifest leaves its filename empty. Run `extract_crop_photos.py <path-to-agriculture-docx>` to reproduce the extraction. `build_tft_crop_photos.py` converts them into a generated RGB565 header shared by the separate photo preview sketch and the main `firmware/SmartSoilTFT/` sensor sketch. The main sketch shows the selected demo candidates' photos. Verify photo usage rights before redistributing a public build.
