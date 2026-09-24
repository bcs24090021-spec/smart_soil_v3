import { renderSensorGrid, renderTopCrops, tagPills } from "./shared.js";
import { createDigitalTwin } from "../digitaltwin.js";
import { greeting, levelPill, formatTime, dayNightEmoji, esc } from "../fmt.js";
import { drawLineChart } from "../charts.js";
import { DEMO_SCENARIOS } from "../../engines/validate.js";

const dashChartState = new WeakMap();

const FIELD_NAMES_ZH = { "demo-field": "演示农田", "probe-field": "探针农田" };

function fieldLabel(location, lang) {
  return lang === "zh" && FIELD_NAMES_ZH[location] ? FIELD_NAMES_ZH[location] : location;
}

function slider(reading, key, min, max, step, label, unit, prefix = "", disabled = false) {
  const id = `${prefix}s-${key}`;
  return `
  <div class="slider-row">
    <div class="sr-head"><label for="${id}">${label}</label><output data-${prefix}out="${key}">${disabled ? "—" : `${reading[key]}${unit}`}</output></div>
    <input id="${id}" type="range" data-${prefix}reg="${key}" min="${min}" max="${max}" step="${step}" value="${reading[key]}" ${disabled ? "disabled" : ""} />
  </div>`;
}

function npkInput(reading, key, label, disabled = false) {
  const id = `n-${key}`;
  return `
  <div class="slider-row">
    <div class="sr-head"><label for="${id}">${label}</label><output data-nout="${key}">${disabled ? "—" : `${reading[key] ?? ""}`}</output></div>
    <input id="${id}" class="input" type="number" data-npk="${key}" min="0" max="200" step="1" value="${reading[key] ?? ""}" placeholder="—" style="max-width:120px" ${disabled ? "disabled" : ""} />
  </div>`;
}

function hwProvided(app) {
  return app.state.result?.source === "esp32" ? app.state.probe?.provided || null : null;
}

function fieldShown(app, field, reading, unit) {
  const provided = hwProvided(app);
  return provided && !provided[field] ? "-" : `${reading[field]}${unit}`;
}

function probeStatusHTML(app) {
  const t = app.t;
  const probe = app.state.probe || {};
  if (app.state.result?.source === "esp32" && probe.connected) {
    const port = probe.port ? ` · ${probe.port}` : "";
    const stamp = probe.lastScan ? ` · ${formatTime(new Date(probe.lastScan).toISOString(), app.state.lang)}` : "";
    return `<span class="hw-badge live">🟢 ${t("probe.connectBadge")}</span><span class="probe-meta">${port}${stamp}</span>`;
  }
  return `<span class="hw-badge">⏳ ${t("probe.awaiting")}</span>`;
}

function scanButtonHTML(app) {
  const t = app.t;
  const probing = Boolean(app.state.probe?.scanning);
  return `<button class="btn primary small" data-action="scan" id="sp-scan" ${probing ? "disabled" : ""}>${probing ? "⏳ " + t("probe.scanning") : "🔍 " + t("probe.scan")}</button>`;
}

function nextPageButtonHTML(app) {
  const t = app.t;
  const connected = Boolean(app.state.probe?.connected);
  return `<button class="btn ghost small" data-action="next-page" ${connected ? "" : "disabled"}>➡️ ${t("probe.next")}</button>`;
}

function emptyHint(text) {
  return `<div class="empty-hint">${text}</div>`;
}

function renderAwaitingScan(app) {
  const lang = app.state.lang;
  const t = app.t;
  const raw = app.raw;
  const presetKeys = Object.keys(DEMO_SCENARIOS);
  const idle = { soilPH: 0, soilMoisture: 0, soilTemperature: 0, airHumidity: 0, rainfall: 0, nitrogen: null, phosphorus: null, potassium: null, deviceId: "", location: t("probe.title") };
  const calls = [["-", t("dashboard.plantHealth")], ["-", t("dashboard.soilHealth")], ["-", t("dashboard.waterRisk")], ["-", t("dashboard.diseaseRisk")]];
  return `
  <header class="sp-head">
    <a class="brand" href="#"><span class="brand-mark">🌱</span><span><strong>${t("appName")}</strong><small style="display:block;color:var(--muted);font:500 10px var(--mono);letter-spacing:.16em">${t("dashboard.pageKicker")}</small></span></a>
    <div class="sp-actions">
      <span class="conn-pill" id="sp-conn"><span class="dot"></span><strong>${app.state.connected ? t("topbar.live") : t("topbar.offline")}</strong></span>
      <div class="lang-switch">
        <button class="${lang === "en" ? "active" : ""}" data-lang-btn="en">EN</button>
        <button class="${lang === "zh" ? "active" : ""}" data-lang-btn="zh">中文</button>
      </div>
      <button class="icon-btn" data-theme-btn title="${t("settings.theme")}">${app.state.theme === "dark" ? "☀️" : "🌙"}</button>
    </div>
  </header>

  <section class="ataglance">
    <div class="card glass-card a-hero" id="sp-hero">
      <span class="hero-kicker">${greeting(lang)} 👋</span>
      <h2 class="hero-title">${t("dashboard.fieldCondition")} <span class="hero-condition">${t("probe.awaiting")}</span></h2>
      <p class="muted" style="margin-top:6px">${t("probe.scanHint")}</p>
      <div class="hero-stats">
        ${calls.map(([num, lbl]) => `<div class="hero-stat"><span class="num">${num}</span><span class="lbl">${lbl}</span></div>`).join("")}
      </div>
    </div>

    <div class="card a-overview" id="sp-overview">
      <div class="card-head"><div><p class="eyebrow">${t("dashboard.fieldOverview")}</p><h3>${t("probe.title").toUpperCase()}</h3></div>
      <div class="gauge" style="--angle:0deg"><strong>—</strong><small>${t("common.of")} 100</small></div></div>
      <div style="display:grid;gap:8px;margin-top:8px">
        ${["soil", "moisture", "temperature"].map(() => `<div class="br-row"><span class="lbl">—</span><span class="bar"><i style="width:0%"></i></span><span class="val">—</span></div>`).join("")}
      </div>
    </div>

    <div class="card a-sensors" id="sp-sensors">
      <div class="card-head"><div><p class="eyebrow">${t("dashboard.liveSensors")}</p><h3>${t("probe.title")}</h3></div>${probeStatusHTML(app)}</div>
      ${renderSensorGrid({ reading: idle, diagnosis: { tagDetails: [] } }, lang, {})}
    </div>
  </section>

  <section class="ct-grid">
    <div class="card a-twin" id="sp-twin">
      <div class="card-head"><div><h3>${t("plant.title")}</h3></div></div>
      ${emptyHint(t("probe.emptyCard"))}
    </div>
    <div class="ct-right">
      <div class="card">
        <div class="card-head"><div><h3>${t("dashboard.soilCropRisk")}</h3></div></div>
        ${emptyHint(t("probe.scanHint"))}
      </div>
      <div class="card alerts-card" id="sp-alerts">
        <div class="card-head"><div><h3 class="alerts-title">${t("dashboard.alertsTitle")}</h3></div><h3>—</h3></div>
        <div class="alerts-list"><div class="empty-state">${t("probe.scanHint")}</div></div>
      </div>
    </div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.probCard")}</p><h3>${t("dashboard.probHint")}</h3></div></div>
    <div style="display:grid;gap:16px">
      <div style="display:grid;gap:12px">
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${presetKeys.map((key) => `<button class="btn small ghost" data-action="preset" data-preset="${key}">${lang === "zh" ? DEMO_SCENARIOS[key].zhName : DEMO_SCENARIOS[key].name}</button>`).join("")}
        </div>
        <div class="slider-cols">
          ${slider(idle, "soilMoisture", 0, 100, 1, t("sensors.soilMoisture"), "%", "", true)}
          ${slider(idle, "soilTemperature", 10, 45, 0.5, t("sensors.soilTemperature"), "°C", "", true)}
          ${slider(idle, "soilPH", 3, 10, 0.1, t("sensors.soilPH"), "", "", true)}
          ${slider(idle, "airHumidity", 0, 100, 1, t("sensors.airHumidity"), "%", "", true)}
          ${slider(idle, "rainfall", 0, 500, 1, t("sensors.rainfall"), " mm", "", true)}
        </div>
        <div class="npk-cols">
          ${npkInput(idle, "nitrogen", lang === "zh" ? "氮 N" : "Nitrogen N", true)}
          ${npkInput(idle, "phosphorus", lang === "zh" ? "磷 P" : "Phosphorus P", true)}
          ${npkInput(idle, "potassium", lang === "zh" ? "钾 K" : "Potassium K", true)}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        ${scanButtonHTML(app)}
        ${nextPageButtonHTML(app)}
        <button class="btn small" data-action="send" disabled title="${t("probe.awaiting")}">${t("probe.sendReading")}</button>
        <button class="btn ghost small" data-action="reset-demo">${lang === "zh" ? "重置演示" : "Reset demo"}</button>
        <label style="display:inline-flex;align-items:center;gap:8px;margin-left:auto;font-size:12px;font-weight:700;cursor:pointer">
          <span class="switch"><input type="checkbox" data-action="autosim" ${app.state.autoPlay ? "checked" : ""} /><span class="slider"></span></span>${t("dashboard.autoPlay")}
        </label>
      </div>
    </div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><h3>${t("dashboard.topCropsTitle")}</h3></div></div>
    <div id="sp-crops">${renderTopCrops([], lang, true)}</div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.advisorTitle")}</p><h3>${t("dashboard.yourField")}</h3></div></div>
    ${emptyHint(t("probe.emptyCard"))}
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.historyTitle")}</p><h3>${t("dashboard.historyHint")}</h3></div></div>
    <div class="chart-box">${emptyHint(t("probe.scanHint"))}</div>
  </section>
  `;
}

// Non-WebGL 2D snapshot for the Soil Diagnosis viewport when the 3D engine
// is unavailable (WebGL disabled, GPU blocklisted, etc.).
function drawTwinSnapshot(canvas, result) {
  const health = result?.health?.score ?? 80;
  const reading = result?.reading ?? {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 380;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#cfe6da");
  sky.addColorStop(1, "#b8d8cd");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,241,201,.9)";
  ctx.beginPath();
  ctx.arc(w - 42, 44, 20, 0, Math.PI * 2);
  ctx.fill();
  const moist = reading.soilMoisture ?? 40;
  const soilTop = h * 0.58;
  const soilColor = moist < 25 ? "#a08058" : moist > 65 ? "#4e3a2e" : "#7a603c";
  ctx.fillStyle = soilColor;
  ctx.beginPath();
  ctx.ellipse(w / 2, soilTop + 34, w * 0.55, 44, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(0, soilTop, w, h - soilTop);
  const leaf = health >= 80 ? "#3f9e55" : health >= 60 ? "#8a9a42" : "#c08a3a";
  ctx.strokeStyle = "#2f6b3a";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(w / 2, soilTop - 4);
  ctx.quadraticCurveTo(w / 2 + 8, h * 0.4, w / 2 + 4, h * 0.24);
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) {
    const y = h * (0.3 + i * 0.095);
    const side = i % 2 === 0 ? 1 : -1;
    const size = 30 - i * 4;
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(w / 2 + side * 12, y, size, 11, side * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.fillRect(w * 0.28, soilTop + 16, w * 0.44, 9);
  ctx.fillStyle = moist > 65 ? "#2b6ea5" : moist < 25 ? "#d99230" : "#24905c";
  ctx.fillRect(w * 0.28, soilTop + 16, w * 0.44 * Math.min(moist / 100, 1), 9);
}

export function renderDashboard(app) {
  const lang = app.state.lang;
  const t = app.t;
  const raw = app.raw;
  const result = app.state.result;
  const reading = result?.reading;

  if (!result || !reading) {
    return renderAwaitingScan(app);
  }

  const health = result.health;
  const water = result.predictions?.find((p) => p.key === "waterStress");
  const disease = result.predictions?.find((p) => p.key === "fungal");
  const soilHealth = Math.round((health.breakdown.ph + health.breakdown.nutrients) / 2);
  const conditionLabel = health.score >= 80 ? t("common.healthy") : health.score >= 60 ? t("common.needsAttention") : t("common.highRisk");
  const activeCount = result.alerts.filter((a) => !a.dismissed).length;
  const form = app.state.form || reading;
  const presetKeys = Object.keys(DEMO_SCENARIOS);

  return `
  <header class="sp-head">
    <a class="brand" href="#"><span class="brand-mark">🌱</span><span><strong>${t("appName")}</strong><small style="display:block;color:var(--muted);font:500 10px var(--mono);letter-spacing:.16em">${t("dashboard.pageKicker")}</small></span></a>
    <div class="sp-actions">
      <span class="conn-pill" id="sp-conn"><span class="dot"></span><strong>${app.state.connected ? t("topbar.live") : t("topbar.offline")}</strong></span>
      <div class="lang-switch">
        <button class="${lang === "en" ? "active" : ""}" data-lang-btn="en">EN</button>
        <button class="${lang === "zh" ? "active" : ""}" data-lang-btn="zh">中文</button>
      </div>
      <button class="icon-btn" data-theme-btn title="${t("settings.theme")}">${app.state.theme === "dark" ? "☀️" : "🌙"}</button>
    </div>
  </header>

  <section class="ataglance">
    <!-- hero -->
    <div class="card glass-card a-hero" id="sp-hero">
      <span class="hero-kicker">${greeting(lang)} 👋</span>
      <h2 class="hero-title">${t("dashboard.fieldCondition")} <span class="hero-condition">${t("dashboard.moderatelyHealthy")}</span></h2>
<p class="muted" style="margin-top:6px">${dayNightEmoji(result.timestamp)} ${formatTime(result.timestamp, lang)} · ${fieldLabel(reading.location, lang)}</p>
      <div class="hero-stats">
        <div class="hero-stat"><span class="num">${health.score}%</span><span class="lbl">${t("dashboard.plantHealth")}</span></div>
        <div class="hero-stat"><span class="num">${soilHealth}%</span><span class="lbl">${t("dashboard.soilHealth")}</span></div>
        <div class="hero-stat"><span class="num"><span class="risk-tag ${water && water.level.toLowerCase()}">${water ? t(`common.${water.level.toLowerCase()}`) : "—"}</span></span><span class="lbl">${t("dashboard.waterRisk")}</span></div>
        <div class="hero-stat"><span class="num"><span class="risk-tag ${disease && disease.level.toLowerCase()}">${disease ? t(`common.${disease.level.toLowerCase()}`) : "—"}</span></span><span class="lbl">${t("dashboard.diseaseRisk")}</span></div>
      </div>
    </div>

    <!-- overview -->
    <div class="card a-overview" id="sp-overview">
      <div class="card-head"><div><p class="eyebrow">${t("dashboard.fieldOverview")}</p><h3>${fieldLabel(reading.location, lang).toUpperCase()}</h3></div>
      <div class="gauge ${health.score < 60 ? "danger" : health.score < 80 ? "warn" : ""}" style="--angle:${health.score * 3.6}deg"><strong>${health.score}</strong><small>${t("common.of")} 100</small></div></div>
      <div style="display:grid;gap:8px;margin-top:8px">
        ${["soil","moisture","temperature"].map((key) => {
          const labels = { soil: t("dashboard.soilHealth"), moisture: t("sensors.soilMoisture"), temperature: t("sensors.soilTemperature") };
          const vals = { soil: soilHealth, moisture: health.breakdown.water, temperature: health.breakdown.temperature };
          return `<div class="br-row"><span class="lbl">${labels[key]}</span><span class="bar"><i style="width:${vals[key]}%"></i></span><span class="val">${vals[key]}%</span></div>`;
        }).join("")}
      </div>
    </div>

    <div class="card a-sensors" id="sp-sensors">
      <div class="card-head"><div><p class="eyebrow">${t("dashboard.liveSensors")}</p><h3>${t("probe.title")}</h3></div>${result.source === "esp32" ? probeStatusHTML(app) : ""}</div>
      ${renderSensorGrid(result, lang, hwProvided(app))}
      <div style="margin-top:10px">${tagPills(result.diagnosis.tagDetails, lang)}</div>
    </div>
  </section>

  <section class="ct-grid">
    <!-- digital twin -->
    <div class="card a-twin" id="sp-twin">
      <div class="card-head"><div><h3>${t("plant.title")}</h3></div></div>
      <div class="twin-viewport">
        <canvas id="twin-canvas" aria-label="${t("plant.title")}"></canvas>
        <div class="twin-status" id="sp-twin-status"><span class="status-dot"></span>${conditionLabel} · ${t("plant.condition")}: ${result.diagnosis.tagDetails.slice(0, 3).map((tag) => (lang === "zh" ? tag.textZh : tag.text) || tag.text).join(" / ") || "—"}</div>
      </div>
      <div class="twin-vitals">
        ${[
          ["💧", t("sensors.soilMoisture"), "soilMoisture", "%"],
          ["🌡️", t("sensors.soilTemperature"), "soilTemperature", "°C"],
          ["⚗️", t("sensors.soilPH"), "soilPH", ""],
          ["💨", t("sensors.airHumidity"), "airHumidity", "%"],
          ["🌧️", t("sensors.rainfall"), "rainfall", " mm"]
        ].map(([ico, lbl, key, unit]) => `
          <div class="vital" title="${lbl}"><span class="v-ico">${ico}</span><div><small>${lbl}</small><strong>${fieldShown(app, key, reading, unit)}</strong></div></div>`).join("")}
      </div>
    </div>
    <div class="ct-right">
    <div class="card">
      <div class="card-head"><div><h3>${t("dashboard.soilCropRisk")}</h3></div></div>
      <div id="sp-predict" class="predict-grid">${result.predictions.map((p) => `
        <div class="predict-card">
<div style="display:flex;justify-content:space-between;align-items:center"><span class="p-lbl">${lang === "zh" ? p.zh : p.en}</span>${levelPill(p.level, lang)}</div>
          <p class="p-msg">${lang === "zh" ? p.message.zh : p.message.en}</p>
        </div>`).join("")}
      </div>
    </div>

    <!-- alerts -->
    <div class="card alerts-card" id="sp-alerts">
      <div class="card-head"><div><h3 class="alerts-title">${t("dashboard.alertsTitle")} 🔴</h3></div><h3>${activeCount}</h3></div>
      <div class="alerts-list">
        ${activeCount === 0 ? `<div class="empty-state">${t("alerts.none")}</div>` : result.alerts.filter((a) => !a.dismissed).map((alert) => `
          <div class="alert-item ${alert.severity === "danger" ? "danger" : alert.severity === "info" ? "info" : "warning"}" style="margin-bottom:10px">
<div style="flex:1"><strong>${alert.emoji || (alert.severity === "danger" ? "🚨" : "⚠️")} ${lang === "zh" ? alert.label.zh : alert.label.en}</strong>
            <div class="a-action">${lang === "zh" ? alert.action.zh : alert.action.en}</div></div>
            <button class="dismiss-x" data-action="dismiss" data-dismiss="${esc(alert.id)}" title="${t("alerts.dismiss")}">✕</button>
          </div>`).join("")}
      </div>
    </div>

    </div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.probCard")}</p><h3>${t("dashboard.probHint")}</h3></div></div>
    <div style="display:grid;gap:16px">
      <div style="display:grid;gap:12px">
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${presetKeys.map((key) => `<button class="btn small ghost" data-action="preset" data-preset="${key}">${lang === "zh" ? DEMO_SCENARIOS[key].zhName : DEMO_SCENARIOS[key].name}</button>`).join("")}
        </div>
        <div class="slider-cols">
          ${slider(form, "soilMoisture", 0, 100, 1, t("sensors.soilMoisture"), "%")}
          ${slider(form, "soilTemperature", 10, 45, 0.5, t("sensors.soilTemperature"), "°C")}
          ${slider(form, "soilPH", 3, 10, 0.1, t("sensors.soilPH"), "")}
          ${slider(form, "airHumidity", 0, 100, 1, t("sensors.airHumidity"), "%")}
          ${slider(form, "rainfall", 0, 500, 1, t("sensors.rainfall"), " mm")}
        </div>
        <div class="npk-cols">
          ${npkInput(form, "nitrogen", lang === "zh" ? "氮 N" : "Nitrogen N")}
          ${npkInput(form, "phosphorus", lang === "zh" ? "磷 P" : "Phosphorus P")}
          ${npkInput(form, "potassium", lang === "zh" ? "钾 K" : "Potassium K")}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        ${scanButtonHTML(app)}
        ${nextPageButtonHTML(app)}
        <button class="btn primary small" data-action="send">${t("dashboard.sendReading")}</button>
        <button class="btn ghost small" data-action="reset-demo">${lang === "zh" ? "重置演示" : "Reset demo"}</button>
        <label style="display:inline-flex;align-items:center;gap:8px;margin-left:auto;font-size:12px;font-weight:700;cursor:pointer">
          <span class="switch"><input type="checkbox" data-action="autosim" ${app.state.autoPlay ? "checked" : ""} /><span class="slider"></span></span>${t("dashboard.autoPlay")}
        </label>
      </div>
      <div class="probe-status" id="sp-probe-status">${probeStatusHTML(app)}</div>
    </div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><h3>${t("dashboard.topCropsTitle")}</h3></div></div>
    <div id="sp-crops">${renderTopCrops(result.crops, lang, true)}</div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.advisorTitle")}</p><h3>${t("dashboard.yourField")}</h3></div></div>
    <div class="advice-card" id="sp-advice">${result.advice[lang].summary}<ul class="advice-steps">${result.advice[lang].steps.map((step) => `<li>${step}</li>`).join("")}</ul></div>
    <div class="chat-log" id="chat-log"></div>
    <div class="chat-form">
      <input id="chat-input" class="input" type="text" placeholder="${t("advisor.placeholder")}" />
      <button class="btn primary small" data-action="ask">${t("advisor.send")}</button>
    </div>
    <div class="tag-row" style="margin-top:10px">
      ${raw("advisor.chips").map((q) => `<button class="chip-q" data-action="ask-chip" data-q="${esc(q)}">${q}</button>`).join("")}
    </div>
  </section>

  <section class="card panel-card">
    <div class="card-head"><div><p class="eyebrow">${t("dashboard.historyTitle")}</p><h3>${t("dashboard.historyHint")}</h3></div></div>
    <div class="chart-toolbar">
      <div class="tag-row">${[["1", t("analytics.range1h")], ["6", t("analytics.range6h")], ["24", t("analytics.range24h")], ["48", t("analytics.range48h")]].map(([v, lbl]) => `<button class="btn small ghost ${v === "6" ? "primary" : ""}" data-action="range" data-range="${v}">${lbl}</button>`).join("")}</div>
      <select class="input" data-action="metric" style="max-width:180px">
        <option value="soilMoisture">${t("sensors.soilMoisture")} %</option>
        <option value="soilTemperature">${t("sensors.soilTemperature")} °C</option>
        <option value="soilPH">${t("sensors.soilPH")}</option>
        <option value="airHumidity">${t("sensors.airHumidity")} %</option>
        <option value="rainfall">${t("sensors.rainfall")} mm</option>
      </select>
      <button class="btn small ghost" data-action="history-date" type="button" title="${t("dashboard.historyDate")}">📅 <span id="hist-date-label">${t("dashboard.seeHistory")}</span></button>
      <input id="hist-date" type="date" class="input" data-action="date" max="${new Date().toISOString().slice(0, 10)}" style="display:none" />
    </div>
    <div class="chart-box"><canvas id="hist-chart" height="260"></canvas></div>
    <div class="stat-strip" id="hist-stats" style="margin-top:12px"></div>
  </section>

  `;
}

export async function mountDashboard(root, app) {
  const t = app.t;

  // digital twin
  const canvas = root.querySelector("#twin-canvas");
  if (canvas && app.state.result) {
    try {
      const twin = await createDigitalTwin(canvas, app.state.result);
      app.twins = app.twins || new Map();
      app.twins.set("dashboard", twin);
      app.setDigitalTwinReading = app.setDigitalTwinReading || ((result) => {
        for (const instance of app.twins.values()) instance.setReading(result);
      });
    } catch (error) {
      console.error(error);
      drawTwinSnapshot(canvas, app.state.result);
      if (!document.querySelector(".twin-three-fallback")) {
        canvas.insertAdjacentHTML("afterend", `<div class="twin-three-fallback">🌱<br><span style="font-size:12px">${t("plant.loadError")}</span></div>`);
      }
    }
  }

  // analytics + event delegation — bind once (the #view element persists across re-renders)
  if (!root._spDelegated) {
    root._spDelegated = true;

    const state = { currentRange: 6, currentMetric: "soilMoisture", currentDate: "" };
    const metricUnits = { soilMoisture: "%", soilTemperature: "°C", soilPH: "", airHumidity: "%", rainfall: "mm" };
    const metricColors = { soilMoisture: "#3a6ea5", soilTemperature: "#cc4743", soilPH: "#24905c", airHumidity: "#6ba0d8", rainfall: "#d99230" };

    let chartSeq = 0;
    async function redrawChart() {
      const seq = ++chartSeq;
      const canvasEl = root.querySelector("#hist-chart");
      const statsEl = root.querySelector("#hist-stats");
      const range = state.currentRange;
      const metric = state.currentMetric;
      const date = state.currentDate;
      if (!app.state.result || !canvasEl?.isConnected) {
        if (statsEl) {
          statsEl.innerHTML = `
            <div class="st"><small>${t("common.minimum")}</small><strong>—</strong></div>
            <div class="st"><small>${t("common.average")}</small><strong>—</strong></div>
            <div class="st"><small>${t("common.maximum")}</small><strong>—</strong></div>
            <div class="st"><small>${t("common.trend")}</small><strong>—</strong></div>`;
        }
        return;
      }
      let history = [];
      try { history = await app.getHistory(range, date); } catch { history = []; }
      if (seq !== chartSeq || !canvasEl?.isConnected) return;
      const points = history.map((entry) => ({ timestamp: entry.timestamp, value: entry.reading?.[metric] ?? 0 }));
      drawLineChart(canvasEl, points, { unit: metricUnits[metric], color: metricColors[metric] });
      if (statsEl && points.length) {
        const values = points.map((p) => p.value);
        const min = Math.round(Math.min(...values) * 10) / 10;
        const max = Math.round(Math.max(...values) * 10) / 10;
        const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
        const trend = values[values.length - 1] - values[0];
        statsEl.innerHTML = `
          <div class="st ${trend >= 0 ? "up" : "down"}"><small>${t("common.minimum")}</small><strong>${min}${metricUnits[metric]}</strong></div>
          <div class="st ${trend >= 0 ? "up" : "down"}"><small>${t("common.average")}</small><strong>${avg}${metricUnits[metric]}</strong></div>
          <div class="st ${trend >= 0 ? "up" : "down"}"><small>${t("common.maximum")}</small><strong>${max}${metricUnits[metric]}</strong></div>
          <div class="st ${trend >= 0 ? "up" : "down"}"><small>${t("common.trend")}</small><strong>${trend >= 0 ? "+" : ""}${Math.round(trend * 10) / 10}${metricUnits[metric]}</strong></div>`;
      }
    }
    state.redraw = redrawChart;
    dashChartState.set(root, state);
    redrawChart();

    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      const act = action.getAttribute("data-action");
      if (act === "send") {
        event.preventDefault();
        app.sendReading({ ...app.state.form, source: app.state.source });
        return;
      }
      if (act === "reset-demo") {
        app.resetDemo();
        return;
      }
      if (act === "scan") {
        app.scanSoil();
        return;
      }
      if (act === "next-page") {
        app.nextHardwarePage();
        return;
      }
      if (act === "preset") {
        const key = action.getAttribute("data-preset");
        const preset = DEMO_SCENARIOS[key];
        if (preset) {
          app.state.form = { ...preset.reading };
          app.sendReading({ ...preset.reading }, "sim").then(() => app.renderDashboard());
        }
        return;
      }
      if (act === "dismiss") {
        const id = action.getAttribute("data-dismiss");
        app.dismissAlert(id);
        return;
      }
      if (act === "toggle-breakdown") {
        const target = root.querySelector(action.dataset.target);
        if (target) target.classList.toggle("hidden");
        action.textContent = target.classList.contains("hidden") ? t("recs.whyThisCrop") : t("recs.hide");
        return;
      }
      if (act === "ask" || act === "ask-chip") {
        event.preventDefault();
        const input = root.querySelector("#chat-input");
        const q = act === "ask-chip" ? action.dataset.q : input.value.trim();
        if (!q) return;
        input.value = "";
        const log = root.querySelector("#chat-log");
        log.insertAdjacentHTML("beforeend", `<div class="msg user">${esc(q)}</div>`);
        const thinking = document.createElement("div");
        thinking.className = "msg bot thinking";
        thinking.textContent = t("advisor.thinking");
        log.appendChild(thinking);
        log.scrollTop = log.scrollHeight;
        app.askAI(q).then((response) => {
          thinking.remove();
          log.insertAdjacentHTML("beforeend", `<div class="msg bot">${esc(response.answer)}</div>`);
          log.scrollTop = log.scrollHeight;
        }).catch(() => { thinking.remove(); });
        return;
      }
      if (act === "range") {
        state.currentRange = Number(action.dataset.range) || 6;
        root.querySelectorAll("[data-action='range']").forEach((b) => b.classList.toggle("primary", Number(b.dataset.range) === state.currentRange));
        redrawChart();
        return;
      }
      if (act === "history-date") {
        const input = root.querySelector("#hist-date");
        if (input) {
          if (typeof input.showPicker === "function") {
            try { input.showPicker(); return; } catch { /* fall through */ }
          }
          input.style.display = "inline-block";
          input.focus();
        }
        return;
      }
    });

    root.addEventListener("change", (event) => {
      const metric = event.target.closest("[data-action='metric']");
      if (metric) {
        state.currentMetric = metric.value;
        redrawChart();
        return;
      }
      const dateEl = event.target.closest("[data-action='date']");
      if (dateEl) {
        state.currentDate = dateEl.value || "";
        const label = root.querySelector("#hist-date-label");
        if (label) label.textContent = state.currentDate || t("dashboard.seeHistory");
        if (!dateEl.value) dateEl.style.display = "none";
        redrawChart();
        return;
      }
      const autosim = event.target.closest("[data-action='autosim']");
      if (autosim) {
        app.setState({ autoPlay: autosim.checked });
        if (autosim.checked && app.state.source === "sim") { app.startAutoSim(); } else { app.stopAutoSim(); }
        return;
      }
    });

    root.addEventListener("input", (event) => {
      const reg = event.target.closest("[data-reg]");
      if (reg) {
        const key = reg.dataset.reg;
        const val = Number(reg.value);
        app.state.form = { ...(app.state.form || {}), [key]: val };
        const out = root.querySelector(`[data-out="${key}"]`);
        const units = { soilMoisture: "%", soilTemperature: "°C", airHumidity: "%", rainfall: " mm" };
        if (out) out.textContent = `${val}${units[key] || ""}`;
        return;
      }
      const nreg = event.target.closest("[data-npk]");
      if (nreg) {
        const key = nreg.dataset.npk;
        const val = nreg.value === "" ? null : Number(nreg.value);
        app.state.form = { ...(app.state.form || {}), [key]: val };
        const out = root.querySelector(`[data-nout="${key}"]`);
        if (out) out.textContent = val ?? "";
        return;
      }
    });
  }

  // chat enter key — the input is recreated each render so rebind each time
  const chatForm = root.querySelector("#chat-input");
  if (chatForm) chatForm.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); root.querySelector("[data-action='ask']")?.click(); }
  });

  // re-draw the history chart on re-render (fresh canvas, kept selection state) and refit on resize
  const chartState = dashChartState.get(root);
  if (chartState) {
    const dateInput = root.querySelector("#hist-date");
    if (dateInput) {
      dateInput.value = chartState.currentDate || "";
      if (chartState.currentDate) dateInput.style.display = "inline-block";
      const label = root.querySelector("#hist-date-label");
      if (label) label.textContent = chartState.currentDate || t("dashboard.seeHistory");
    }
    if (chartState.chartRO) { chartState.chartRO.disconnect(); chartState.chartRO = null; }
    const box = root.querySelector("#hist-chart")?.parentElement;
    if (box && typeof ResizeObserver !== "undefined") {
      chartState.chartRO = new ResizeObserver(() => chartState.redraw());
      chartState.chartRO.observe(box);
    }
    chartState.redraw();
  }
}

export function patchDashboard(root, app) {
  const result = app.state.result;
  if (!result) return;
  const lang = app.state.lang;
  const reading = result.reading;
  const health = result.health;
  const water = result.predictions?.find((p) => p.key === "waterStress");
  const disease = result.predictions?.find((p) => p.key === "fungal");
  const soilHealth = Math.round((health.breakdown.ph + health.breakdown.nutrients) / 2);
  const conditionLabel = health.score >= 80 ? app.t("common.healthy") : health.score >= 60 ? app.t("common.needsAttention") : app.t("common.highRisk");
  const activeCount = result.alerts.filter((a) => !a.dismissed).length;

  const setHTML = (id, html) => { const el = root.querySelector(id); if (el) el.innerHTML = html; };

  setHTML("#sp-conn", `<span class="dot"></span><strong>${app.state.connected ? app.t("topbar.live") : app.t("topbar.offline")}</strong>`);
  setHTML("#sp-hero", `
    <span class="hero-kicker">${greeting(lang)} 👋</span>
    <h2 class="hero-title">${app.t("dashboard.fieldCondition")} <span class="hero-condition">${app.t("dashboard.moderatelyHealthy")}</span></h2>
<p class="muted" style="margin-top:6px">${dayNightEmoji(result.timestamp)} ${formatTime(result.timestamp, lang)} · ${fieldLabel(reading.location, lang)}</p>
    <div class="hero-stats">
      <div class="hero-stat"><span class="num">${health.score}%</span><span class="lbl">${app.t("dashboard.plantHealth")}</span></div>
      <div class="hero-stat"><span class="num">${soilHealth}%</span><span class="lbl">${app.t("dashboard.soilHealth")}</span></div>
      <div class="hero-stat"><span class="num"><span class="risk-tag ${water && water.level.toLowerCase()}">${water ? app.t(`common.${water.level.toLowerCase()}`) : "—"}</span></span><span class="lbl">${app.t("dashboard.waterRisk")}</span></div>
      <div class="hero-stat"><span class="num"><span class="risk-tag ${disease && disease.level.toLowerCase()}">${disease ? app.t(`common.${disease.level.toLowerCase()}`) : "—"}</span></span><span class="lbl">${app.t("dashboard.diseaseRisk")}</span></div>
    </div>`);
  setHTML("#sp-overview", `
    <div class="card-head"><div><p class="eyebrow">${app.t("dashboard.fieldOverview")}</p><h3>${fieldLabel(reading.location, lang).toUpperCase()}</h3></div>
    <div class="gauge ${health.score < 60 ? "danger" : health.score < 80 ? "warn" : ""}" style="--angle:${health.score * 3.6}deg"><strong>${health.score}</strong><small>${app.t("common.of")} 100</small></div></div>
    <div style="display:grid;gap:8px;margin-top:8px">
      ${["soil","moisture","temperature"].map((key) => {
        const labels = { soil: app.t("dashboard.soilHealth"), moisture: app.t("sensors.soilMoisture"), temperature: app.t("sensors.soilTemperature") };
        const vals = { soil: soilHealth, moisture: health.breakdown.water, temperature: health.breakdown.temperature };
        return `<div class="br-row"><span class="lbl">${labels[key]}</span><span class="bar"><i style="width:${vals[key]}%"></i></span><span class="val">${vals[key]}%</span></div>`;
      }).join("")}
    </div>`);
  setHTML("#sp-sensors", `
    <div class="card-head"><div><p class="eyebrow">${app.t("dashboard.liveSensors")}</p><h3>${app.t("probe.title")}</h3></div>${result.source === "esp32" ? probeStatusHTML(app) : ""}</div>
    ${renderSensorGrid(result, lang, hwProvided(app))}
    <div style="margin-top:10px">${tagPills(result.diagnosis.tagDetails, lang)}</div>`);
  setHTML("#sp-crops", renderTopCrops(result.crops, lang, true));
  setHTML("#sp-predict", result.predictions.map((p) => `
    <div class="predict-card">
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="p-lbl">${lang === "zh" ? p.zh : p.en}</span>${levelPill(p.level, lang)}</div>
      <p class="p-msg">${lang === "zh" ? p.message.zh : p.message.en}</p>
    </div>`).join(""));
  setHTML("#sp-alerts", `
    <div class="card-head"><div><h3 class="alerts-title">${app.t("dashboard.alertsTitle")} 🔴</h3></div><h3>${activeCount}</h3></div>
    <div class="alerts-list">
    ${activeCount === 0 ? `<div class="empty-state">${app.t("alerts.none")}</div>` : result.alerts.filter((a) => !a.dismissed).map((alert) => `
      <div class="alert-item ${alert.severity === "danger" ? "danger" : alert.severity === "info" ? "info" : "warning"}" style="margin-bottom:10px">
<div style="flex:1"><strong>${alert.emoji || (alert.severity === "danger" ? "🚨" : "⚠️")} ${lang === "zh" ? alert.label.zh : alert.label.en}</strong>
        <div class="a-action">${lang === "zh" ? alert.action.zh : alert.action.en}</div></div>
        <button class="dismiss-x" data-action="dismiss" data-dismiss="${esc(alert.id)}" title="${app.t("alerts.dismiss")}">✕</button>
      </div>`).join("")}
    </div>`);
  setHTML("#sp-advice", `${result.advice[lang].summary}<ul class="advice-steps">${result.advice[lang].steps.map((step) => `<li>${step}</li>`).join("")}</ul>`);
  setHTML("#sp-twin .twin-vitals", `
    ${[
      ["💧", app.t("sensors.soilMoisture"), "soilMoisture", "%"],
      ["🌡️", app.t("sensors.soilTemperature"), "soilTemperature", "°C"],
      ["⚗️", app.t("sensors.soilPH"), "soilPH", ""],
      ["💨", app.t("sensors.airHumidity"), "airHumidity", "%"],
      ["🌧️", app.t("sensors.rainfall"), "rainfall", " mm"]
    ].map(([ico, lbl, key, unit]) => `
      <div class="vital" title="${lbl}"><span class="v-ico">${ico}</span><div><small>${lbl}</small><strong>${fieldShown(app, key, reading, unit)}</strong></div></div>`).join("")}`);
  const twinStatus = root.querySelector("#sp-twin-status");
  if (twinStatus) twinStatus.innerHTML = `<span class="status-dot"></span>${conditionLabel} · ${app.t("plant.condition")}: ${result.diagnosis.tagDetails.slice(0, 3).map((tag) => (lang === "zh" ? tag.textZh : tag.text) || tag.text).join(" / ") || "—"}`;
}

export function cleanupDashboard(app) {
  if (app.twins) {
    const twin = app.twins.get("dashboard");
    if (twin) { twin.dispose(); app.twins.delete("dashboard"); }
  }
}
