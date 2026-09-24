# Smart Soil Probe AI

An MVP implementation of the Smart Soil Probe AI brief: a bilingual (EN / 中文) browser dashboard with a live **Digital Twin**, soil diagnosis, crop recommendations, a what-if simulator, an AI farmer advisor, history analytics, and alert management — fed by a real **ESP32** probe or the built-in simulation mode.

No build step, no npm dependencies, vanilla JS ES modules. The logic engines are shared between the Node server and the browser.

## Run it

From this directory:

```bash
npm test
npm run serve
```

Open `http://localhost:4173`.

- `npm test` runs engine unit tests (`tests/logic.test.js`) and an API smoke test (`tests/api.test.mjs`, spawns the server on port 4181).
- `npm run serve` starts `server.mjs` (default port 4173; override with `PORT=...`).

## Architecture

```
index.html                app shell (sidebar, topbar, views, bottom nav) + three.js importmap
styles.css                design system (light/dark, responsive, animations)
server.mjs                static file server + REST API + SSE live stream
src/
  data/crops.js           crop profiles shared with the ESP32 photo ranking list
  engines/                shared, framework-free business logic
    validate.js           sensor ranges, normalization, demo scenarios
    diagnosis.js          soil condition tags + en/zh summaries
    crops.js              crop scoring/ranking with explainable components
    health.js             plant health score + 5-factor breakdown
    alerts.js             rule-based alerts (stable ids) + suggested actions
    prediction.js         water/heat/fungal risk outlook
    simulation.js         before/after what-if simulation
    aiAdvice.js           farmer-facing advice + Q&A chat matchers
    pipeline.js           buildPipeline(input, {source}) -> full result object
  locales/                en.js / zh.js dictionaries + t(lang, path, params)
  ui/
    app.js                SPA controller: router, SSE, state, nav, auto-sim
    views/                dashboard, probe, plant(3D), recs, simulator,
                          advisor, analytics, alerts, settings, login
    charts.js             canvas line charts + sparklines
    three-plant.js        Three.js Digital Twin (plant/root/soil views)
firmware/                 ESP32 sketch -> POST /api/readings
tests/                    engine tests + API integration smoke test
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | latest result + zones |
| GET | `/api/sensor/latest` | latest reading + full result |
| GET | `/api/sensor/history?hours=24` | time series (each entry includes `health`) |
| POST | `/api/readings` (also `/api/sensor/readings`) | accept ESP32 reading; body `{deviceId, soilPH, soilMoisture, soilTemperature, airHumidity, rainfall, nitrogen?, phosphorus?, potassium?, source?}` |
| POST | `/api/simulation` | what-if with `{changes: {...}}` |
| POST | `/api/ai/chat` | question answering against the current result |
| POST | `/api/ai/advice` | generate advice for a language / simulated reading |
| GET | `/api/alerts` · POST | list alerts · `POST /api/alerts/:id/dismiss` |
| GET | `/api/zones` · `/api/mode` · POST `/api/mode` | zones · data-source mode (`sim` / `esp32`) |
| GET | `/api/stream` | SSE (`event: reading`) |
| GET | `/api/healthz` | liveness |

The ESP32 firmware posts to `http://<computer-ip>:4173/api/readings`; both devices must be on the same network.

## Engine behavior (brief drivers)

- Diagnosis thresholds: pH `3–10`, moisture `0–100%`, soil temperature `10–45°C`; tags for acidic/alkaline, dry/workable/waterlogged, heat stress, fungal risk, low nutrient confidence.
- Crop score (MVP): the same 6-point rule as the ESP32: `pH 2 + moisture-band 2/1/0 + soil-temperature 2`; the web and screen therefore show the same top three crops. Rainfall and NPK remain future features until those sensors/data sources are connected.
- Health score weights: water `.25`, pH `.20`, temperature `.20`, humidity `.15`, nutrients `.20`.
- Confidence starts at 100; −8/missing sensor, −10 if NPK missing, −15 in simulation mode, −25 on validation failure (floor 30).
- Advice and Q&A answers are generated from the structured diagnosis; answers fall back to a guarded message rather than inventing sensor values.

## Hardware notes

Priority order from the brief: ESP32 DevKit V1, capacitive moisture sensor, waterproof DS18B20, SHT31 or DHT22, analog pH kit (plus pH 4.01/6.86/9.18 buffers), power bank / waterproof enclosure, optional OLED. Calibrate pH before relying on it; verify the pH module output voltage is safe for the ESP32 ADC.

Wire the probe as documented in `firmware/esp32_smart_soil_probe.ino` and set `WIFI_SSID`, `WIFI_PASSWORD`, and `API_URL`.

## Disclaimers

Preliminary recommendation only. This is not a certified soil laboratory or agricultural prescription system. Validate with local agronomic guidance (Malaysia soil, climate, crops), calibrate pH, and treat cheap NPK probes as estimates. Production follow-ups in the brief: real NPK sensing, persistent storage, weather API integration, auth, mobile app, and a managed backend.
