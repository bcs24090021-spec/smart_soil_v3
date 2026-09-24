# Capacitive Soil Sensor Reference Log

## 2026-09-18: Air reference (provisional)

- Condition: user confirms probe is in air, not inserted into soil.
- Probe: Capacitive Soil Moisture Sensor V2.0 / HW-390, analog output.
- Firmware: SmartSoilTFT; ESP32 GPIO35, 12-bit ADC, 11 dB attenuation.
- Source: Arduino IDE serial monitor, 115200 baud, visible records 18:34:59.733 through 18:35:41.728 (15 samples).
- Raw ADC range: 3017 to 3042; mean: approximately 3031.1.
- ADC voltage range: 2664.09 to 2680.03 mV; mean: approximately 2673.0 mV.
- Last five raw readings: 3030, 3017, 3018, 3020, 3020.
- Last visible reading: raw 3020, 2665.91 mV.
- Downward drift is visible; these are provisional observations, not a final dry calibration endpoint.
- Sensor supply voltage during this capture was not independently measured. Earlier supply troubleshooting may affect comparability.
- No wet reference captured yet. No moisture percentage or volumetric water content inferred.
- Other diagnostic observation: DS18B20 reports sensor_error in these records; DHT22 reports ok.

Keep the final supply, wiring, insertion depth and sample preparation consistent when collecting further references. Air is not equivalent to a representative dry-soil sample.

## 2026-09-18: Inserted into soil (provisional)

- Condition: user confirms probe inserted into soil. Water content, compaction and insertion depth not established; not labeled a dry or wet calibration endpoint.
- Source: serial monitor refreshed, records 18:53:17.600 through 18:53:26.590.
- Raw readings: 3077, 3076, 3073, 3073; mean 3074.75.
- Millivolt readings: 2699.53, 2698.72, 2698.53, 2699.34; mean 2699.03 mV.
- Readings are slightly above the earlier air reference, not evidence of a validated moisture response. Supply equivalence has not been verified, and device uptime indicates a restart since the earlier capture.
- DS18B20 now reports ok, 28.31 to 28.50 C; DHT22 reports ok.
- Next comparison: same powered setup and insertion depth, compare current soil with uniformly moistened soil. Do not assign moisture percentages from these observations.

## 2026-09-18: Soil after adding water (provisional)

- Condition: user confirms water added and probe reinserted. Water quantity and actual soil water content unknown.
- Source: refreshed serial monitor, 18:57:26.599 through 18:57:38.610 (5 samples).
- Raw readings: 2014, 2013, 2013, 2010, 2012; mean 2012.4; range 2010 to 2014.
- Millivolt readings: 1844.22, 1846.03, 1846.34, 1845.28, 1846.03; mean 1845.58 mV.
- Relative to the earlier soil mean 3074.75, raw ADC decreased approximately 1062 counts. This supports a qualitative response to wetting, assuming unchanged supply and comparable placement.
- Firmware uptime continued from the earlier soil capture, consistent with the same boot session; supply voltage and placement were not independently verified.
- DS18B20 reports ok at 28.87 C in all five samples; DHT22 reports ok.
- This is a wet-sample observation, not a verified saturated endpoint, absolute moisture percentage, or VWC calibration.

## 2026-09-18: User-confirmed dry soil, fresh capture

- User explicitly confirms current sample is dry soil. Dryness is user-described, not verified by a reference method.
- Refreshed serial monitor: 19:07:14.608 through 19:07:32.620, seven samples.
- Raw readings: 2646, 2646, 2645, 2648, 2647, 2645, 2647; mean approximately 2646.3.
- Millivolt readings: 2383.59, 2383.56, 2383.13, 2384.53, 2383.59, 2383.13, 2382.97; mean approximately 2383.5 mV.
- Earlier UI records at 18:57–18:58 (raw approximately 1979) were stale when the user reported switching to dry soil. They must not be labeled the current dry sample. Exact sample-switch time for those older records remains unknown.
- Current dry reading is about 634 counts above the captured wetted-soil mean 2012.4. Useful provisional dry/wet separation; repeat with matched soil and placement before establishing display endpoints.
- DS18B20 reports ok at 28.69 C; DHT22 reports ok.

## 2026-09-18: Water added after the user-confirmed dry sample

- User confirms current condition is after adding water. Quantity, saturation and placement not independently verified.
- Fresh serial capture: 19:09:29.594 through 19:09:44.613, six samples, readings 387–392.
- Raw readings: 1756, 1757, 1756, 1757, 1756, 1756; mean 1756.33; range 1756–1757.
- Millivolt readings: 1630.00, 1628.69, 1629.13, 1629.38, 1629.72, 1628.22; mean 1629.19 mV.
- Compared with user-confirmed dry mean 2646.3, signal decreased about 890 ADC counts; supports a clear qualitative wetting response, not absolute water content accuracy.
- Same boot session as preceding dry capture according to uptime. No restart observed in these six records.
- DS18B20 reports ok, 28.62–28.69 C; DHT22 reports ok.
- Keep this observation separate from the earlier wet sample around 2012. Different wet values need not indicate failure, because added water and sample contact were not standardized.
