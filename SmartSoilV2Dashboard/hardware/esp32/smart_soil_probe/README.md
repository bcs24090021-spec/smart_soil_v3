# Smart Soil Probe — ESP32 hardware guide

Wiring + firmware to stream live soil readings to the dashboard over USB serial.

## Sensors used

| Sensor | Connection | ESP32 pin |
|---|---|---|
| Capacitive soil moisture (v1.2) | AOUT → analog | `GPIO34` |
| Waterproof temperature (DS18B20) | DATA → analog, 4.7k pull-up to 3.3V | `GPIO4` |
| Soil pH (PH-4502C) | PO → analog | `GPIO35` |
| (Optional) DHT22/11 air humidity | DATA | `GPIO32` |

All sensors share GND; PH-4502C runs at 5 V (VCC), moisture sensor can use 3.3 V or 5 V.

## Flashing the firmware

1. Open `smart_soil_probe.ino` in Arduino IDE.
2. Install boards: `ESP32` by Espressif (Boards Manager). Install libraries: `OneWire`, `DallasTemperature`.
3. Select board `ESP32 Dev Module`, USB port, baud 115200, upload.
4. Open the Serial Monitor at 115200 — you should see one JSON line every 2 s:

```json
{"deviceId":"esp32-probe-001","location":"demo-field","soilMoisture":62.3,"soilTemperature":28.4,"soilPH":6.08,"airHumidity":74}
```

## Calibration

- **Moisture:** in `smart_soil_probe.ino`, set `MOISTURE_DRY_MV` to the number printed while the probe is held in air, and `MOISTURE_WET_MV` with the probe fully submerged in water.
- **pH:** put the probe in pH-7 buffer and turn the PH-4502C trimmer until the board's PO voltage is mid-scale (~2.5 V). Then adjust `PH_MID_POINT_MV` (should be ≈ 2500) and, if needed, `PH_MV_PER_PH` using a pH-4 buffer (176–180 is typical).

## Using the dashboard

1. Run the app: `npm run serve` → open `http://localhost:4173` in **Chrome or Edge**.
2. In the **Smart Probe** card press **🔍 Scan Soil**.
3. In the browser prompt, select the ESP32's USB serial port.
4. Live values (soil pH / moisture / temperature, and humidity if wired) appear in the sensor grid and digital-twin vitals. No scan → all sensor values remain `-`.

## Data format understood by the dashboard

`Scan Soil` accepts any of these line formats at 115200 baud:

- JSON: `{"soilMoisture":62.3,"soilTemperature":28.4,"soilPH":6.08,"airHumidity":74}`
- Key/value: `moisture:62.3,temp:28.4,ph:6.08,hum:74`
- Bare CSV: `62.3,28.4,6.08`

(Server-side JSON push still works too — POST to `/api/sensor/readings` with `"source":"esp32"`.)