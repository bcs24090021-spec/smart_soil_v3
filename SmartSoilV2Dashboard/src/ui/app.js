import { t, raw } from "../locales/index.js";
import { buildPipeline } from "../engines/pipeline.js";
import { answerQuestion } from "../engines/aiAdvice.js";
import { EXAMPLE_READING } from "../engines/validate.js";
import { renderDashboard, mountDashboard, patchDashboard, cleanupDashboard } from "./views/dashboard.js";

let activeSerialPort = null;

const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(`ssp.${key}`);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`ssp.${key}`, JSON.stringify(value));
    } catch { /* ignore */ }
  },
};

const app = {
  state: {
    lang: storage.get("lang", "en"),
    theme: storage.get("theme", "light"),
    source: "sim",
    autoPlay: storage.get("autoPlay", true),
    connected: false,
    apiDown: false,
    result: null,
    zones: [],
    form: null,
    probe: { connected: false, scanning: false, error: null, port: null, provided: null, lastScan: null },
    cropFocus: 0,
  },
  twins: null,
  autotimer: null,
  lastCleanup: null,
};

app.t = (path, params = {}) => t(app.state.lang, path, params);
app.raw = (path) => raw(app.state.lang, path);
app.setState = (patch) => {
  Object.assign(app.state, patch);
  for (const key of ["lang", "theme", "autoPlay"]) {
    if (key in patch) storage.set(key, patch[key]);
  }
};

// ------- API -------
async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

app.apiGet = async (path) => {
  try {
    return await api(path);
  } catch {
    app.state.apiDown = true;
    app.state.connected = false;
    return null;
  }
};

app.apiPost = async (path, body, silent = false) => {
  try {
    return await api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    app.state.apiDown = true;
    app.state.connected = false;
    if (!silent) app.toast(app.t("common.serverDown"));
    return null;
  }
};

app.updateResult = (payload, source = "esp32") => {
  let result = payload?.result || null;
  if (!result) {
    const reading = payload?.reading || app.state.result?.reading;
    result = buildPipeline(reading, { source: payload?.source || source });
  }
  app.setState({ result, reading: result.reading, lastUpdate: result.timestamp, connected: true, source: result.source, cropFocus: 0 });
  if (!app.state.form) app.state.form = { ...result.reading };
  if (app.setDigitalTwinReading && app.twins?.size) app.setDigitalTwinReading(result);
  app.refreshLive();
};

app.sendReading = async (payload, source = app.state.source ?? "sim") => {
  const body = { source, ...payload };
  const response = await app.apiPost("/api/sensor/readings", body, true);
  if (response?.reading) {
    app.updateResult(response);
  } else {
    app.setState({ apiDown: true, connected: false });
    const result = buildPipeline({ ...payload, location: "demo-field" }, { source });
    app.setState({ result, lastUpdate: result.timestamp, source });
    app.refreshLive();
  }
};

app.setMode = async (mode) => {
  app.setState({ source: mode });
  await app.apiPost("/api/mode", { mode }, true);
  if (mode === "sim") {
    app.startAutoSim();
  } else {
    app.stopAutoSim();
  }
};

app.getHistory = async (hours, date = "") => {
  const query = new URLSearchParams({ hours: String(hours) });
  if (date) query.set("date", date);
  const response = await app.apiGet(`/api/sensor/history?${query.toString()}`);
  if (response?.series?.length) return response.series;
  const reading = app.state.result?.reading || EXAMPLE_READING;
  const points = Math.min(hours * 4, 480);
  const anchor = date ? new Date(`${date}T23:59:59`).getTime() : Date.now();
  const step = (hours * 60 * 60 * 1000) / Math.max(points, 1);
  const entries = [];
  for (let i = 0; i < points; i += 1) {
    const wave = Math.sin(i / 9) * 4;
    entries.push({
      timestamp: new Date(anchor - (points - i) * step).toISOString(),
      reading: {
        ...reading,
        soilPH: reading.soilPH + Math.sin(i / 14) * 0.12,
        soilMoisture: Math.min(100, Math.max(0, reading.soilMoisture + wave + (i % 11 === 0 ? -6 : 2))),
        soilTemperature: reading.soilTemperature + Math.sin(i / 6) * 1.4,
        airHumidity: Math.min(100, Math.max(0, reading.airHumidity + Math.sin(i / 8) * 5)),
        rainfall: Math.max(0, reading.rainfall + (i % 17 === 0 ? 8 : 0)),
      },
    });
  }
  return entries;
};

app.askAI = async (question) => {
  const response = await app.apiPost("/api/ai/chat", { question, language: app.state.lang }, true);
  const nested = response?.answer;
  if (typeof nested === "string") return { answer: nested };
  if (nested && typeof nested.answer === "string") return { answer: nested.answer };
  const result = app.state.result;
  const local = answerQuestion(question, result, app.state.lang);
  return { answer: local.answer || local.fallback || "" };
};

app.dismissAlert = async (id) => {
  const result = app.state.result;
  if (result) {
    result.alerts = result.alerts.map((alert) => (alert.id === id ? { ...alert, dismissed: true } : alert));
    app.refreshLive();
  }
  await app.apiPost(`/api/alerts/${id}/dismiss`, {}, true);
};

app.resetDemo = async () => {
  await app.sendReading({ ...EXAMPLE_READING, source: "sim" });
  app.state.form = null;
  app.toast(app.t("common.demoReset"));
  app.renderDashboard();
};

// ------- hardware (Web Serial) -------
function parseSerialLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;
  let obj = null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") obj = parsed;
  } catch { /* not JSON */ }
  if (!obj) {
    const lower = {};
    const hasKeyed = text.split(/[,\s;]+/).filter(Boolean).some((part) => /^[a-zA-Z_][a-zA-Z_0-9]*\s*[:=]/.test(part));
    for (const part of text.split(/[,\s;]+/).filter(Boolean)) {
      const match = part.match(/^([a-zA-Z_][a-zA-Z_0-9]*)\s*[:=]{1,2}\s*(.+)$/);
      if (match) {
        const value = Number(String(match[2]).trim());
        if (Number.isFinite(value)) lower[match[1].toLowerCase()] = value;
      }
    }
    if (hasKeyed) {
      obj = lower;
    } else {
      const nums = text.split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n));
      if (nums.length >= 3) obj = { soilMoisture: nums[0], soilTemperature: nums[1], soilPH: nums[2] };
    }
  }
  if (!obj) return null;
  const lower = {};
  for (const [key, value] of Object.entries(obj)) lower[key.toLowerCase()] = value;
  const pick = (...names) => {
    for (const name of names) {
      const raw = lower[name];
      if (raw == null) continue;
      const value = Number(raw);
      if (Number.isFinite(value)) return value;
    }
    return undefined;
  };
  const value = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    provided: {
      soilPH: pick("soilph", "ph", "phvalue", "ph_value") != null,
      soilMoisture: pick("soilmoisture", "soil_moisture_pct", "soil_wetness_index", "moisture", "moist", "vwc", "capacitive") != null,
      soilTemperature: pick("soiltemperature", "sample_temperature_c", "soiltemp", "temperature", "temp") != null,
      airHumidity: pick("airhumidity", "air_humidity_pct", "humidity", "hum") != null,
      npk: false,
    },
    reading: {
      soilPH: value(pick("soilph", "ph", "phvalue", "ph_value")),
      soilMoisture: value(pick("soilmoisture", "soil_moisture_pct", "soil_wetness_index", "moisture", "moist", "vwc", "capacitive")),
      soilTemperature: value(pick("soiltemperature", "sample_temperature_c", "soiltemp", "temperature", "temp")),
      airHumidity: value(pick("airhumidity", "air_humidity_pct", "humidity", "hum")),
      deviceId: String(lower.deviceid || lower.device_id || "esp32-probe-001"),
      location: String(lower.location || lower.farm || "demo-field"),
    },
  };
}

app.scanSoil = async () => {
  if (app.state.probe?.scanning) return;
  if (activeSerialPort) {
    await activeSerialPort.close().catch(() => {});
    activeSerialPort = null;
  }
  app.setState({ probe: { ...(app.state.probe || {}), scanning: true, error: null } });
  app.renderDashboard();

  if (!("serial" in navigator)) {
    app.setState({ probe: { ...(app.state.probe || {}), scanning: false, error: "noserial" } });
    app.renderDashboard();
    app.toast(app.t("probe.noSerial"));
    return;
  }

  let portLabel = "USB";
  try {
    const port = await navigator.serial.requestPort();
    const info = port.getInfo ? port.getInfo() : {};
    portLabel = info.usbVendorId ? `vid#0x${info.usbVendorId.toString(16)}` : "serial";
    await port.open({ baudRate: 115200 });
    try {
      const writer = port.writable && port.writable.getWriter();
      if (writer) {
        writer.write(new TextEncoder().encode("SCAN\n")).catch(() => {});
        writer.releaseLock();
      }
    } catch { /* non-writable port is fine — probe streams anyway */ }

    const reader = port.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let line = null;
    let parsed = null;
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline && !parsed) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let index = buffer.indexOf("\n");
      while (index >= 0 && !parsed) {
        line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        parsed = line && parseSerialLine(line);
        index = buffer.indexOf("\n");
      }
    }
    reader.releaseLock();
    // Keep the USB port open so the Dashboard NEXT button can control the ESP32 page.
    activeSerialPort = port;

    if (!parsed) throw new Error("nodata");

    app.setState({ probe: { connected: true, scanning: false, error: null, port: portLabel, provided: parsed.provided, lastScan: Date.now() } });
    await app.sendReading(parsed.reading, "esp32");
    app.renderDashboard();
    app.toast(app.t("probe.scanDone"));
  } catch (error) {
    const denied = error && (error.name === "NotFoundError" || error.name === "SecurityError");
    app.setState({ probe: { ...(app.state.probe || {}), scanning: false, error: denied ? "denied" : "nohardware" } });
    app.renderDashboard();
    app.toast(denied ? app.t("probe.denied") : app.t("probe.noHardware"));
  }
};

app.nextHardwarePage = async () => {
  if (!("serial" in navigator)) {
    app.toast(app.t("probe.noSerial"));
    return;
  }
  try {
    let port = activeSerialPort;
    if (!port) {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      activeSerialPort = port;
    }
    const writer = port.writable?.getWriter();
    if (!writer) throw new Error("serial-not-writable");
    await writer.write(new TextEncoder().encode("NEXT\n"));
    writer.releaseLock();
    app.toast(app.t("probe.nextSent"));
  } catch (error) {
    activeSerialPort = null;
    app.toast(app.t("probe.noHardware"));
  }
};

// ------- rendering (single page) -------
app.renderDashboard = () => {
  if (app.lastCleanup) {
    try { app.lastCleanup(app); } catch { /* ignore */ }
    app.lastCleanup = null;
  }
  const view = document.querySelector("#view");
  view.innerHTML = renderDashboard(app);
  view.classList.remove("fade-in");
  void view.offsetWidth;
  view.classList.add("fade-in");
  app.attachHandlers();
  mountDashboard(view, app).catch((error) => console.error(error));
  app.lastCleanup = cleanupDashboard;
};

app.refreshLive = () => {
  const view = document.querySelector("#view");
  if (!view || !app.state.result) return;
  if (view.querySelector("#sp-hero")) {
    patchDashboard(view, app);
  } else {
    app.renderDashboard();
  }
};

app.setLang = (lang) => {
  app.setState({ lang });
  app.renderDashboard();
};

app.setTheme = (theme) => {
  app.setState({ theme });
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#101713" : "#f6f8f3");
  document.querySelector('[data-theme-btn]') ? (document.querySelector('[data-theme-btn]').textContent = theme === "dark" ? "☀️" : "🌙") : null;
};

app.toast = (message) => {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._tid);
  toast._tid = setTimeout(() => toast.classList.remove("show"), 2600);
};

// ------- global delegated handler -------
app.attachHandlers = () => {
  if (document.body._spHandlers) return;
  document.body._spHandlers = true;
  document.body.addEventListener("click", (event) => {
    const langBtn = event.target.closest("[data-lang-btn]");
    if (langBtn) {
      app.setLang(langBtn.getAttribute("data-lang-btn"));
      return;
    }
    const themeBtn = event.target.closest("[data-theme-btn]");
    if (themeBtn) {
      app.setTheme(app.state.theme === "dark" ? "light" : "dark");
      return;
    }
  });
};

// ------- auto simulation -------
app.startAutoSim = () => {
  if (app.autotimer || !app.state.autoPlay) return;
  app.autotimer = setInterval(() => {
    const reading = app.state.result?.reading;
    if (!reading || app.state.source !== "sim") return;
    const jitter = (value, spread) => Math.round((value + (Math.random() - 0.5) * spread) * 10) / 10;
    app.sendReading({
      ...reading,
      soilPH: Math.min(10, Math.max(3, jitter(reading.soilPH, 0.3))),
      soilMoisture: Math.min(100, Math.max(0, jitter(reading.soilMoisture, 4))),
      soilTemperature: Math.min(45, Math.max(10, jitter(reading.soilTemperature, 0.8))),
      airHumidity: Math.min(100, Math.max(0, jitter(reading.airHumidity, 3))),
      rainfall: Math.min(500, Math.max(0, jitter(reading.rainfall, 1))),
    }, "sim");
  }, 10000);
};

app.stopAutoSim = () => {
  if (app.autotimer) {
    clearInterval(app.autotimer);
    app.autotimer = null;
  }
};

app.subscribeSse = () => {
  if (!("EventSource" in window)) return;
  const sse = new EventSource("/api/stream");
  sse.addEventListener("reading", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.result) app.updateResult(payload.result, payload.source);
    } catch { /* ignore malformed frames */ }
  });
  sse.addEventListener("hello", () => {
    app.setState({ connected: true });
    app.refreshLive();
  });
  sse.onerror = () => {
    app.state.connected = false;
    app.refreshLive();
  };
};

// ------- initial load -------
app.boot = async () => {
  app.setTheme(app.state.theme);
  app.state.form = null;
  app.state.probe = { connected: false, scanning: false, error: null, port: null, provided: null, lastScan: null };

  app.attachHandlers();

  app.renderDashboard();

  await app.apiGet("/api/zones").then((response) => {
    if (response) app.state.zones = response.zones || [];
  }).catch(() => {});

  app.subscribeSse();
};

app.boot();

// expose for debugging / demo scripts
window.SmartSoilApp = app;
