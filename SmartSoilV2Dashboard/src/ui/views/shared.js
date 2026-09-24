export function sensorCards(result, lang, provided = null) {
  const r = result.reading;
  const t = lang === "zh";
  const missing = (field) => provided != null && !provided[field];
  const na = (field, value) => (missing(field) ? "-" : value);
  const naUnit = (field, unit) => (missing(field) ? "" : unit);
  const naStatus = (field, status) => (missing(field) ? "—" : status);
  const naCls = (field, cls) => (missing(field) ? "na" : cls);
  return [
    {
      key: "soilPH", icon: "◒",
      label: t ? "土壤 pH" : "Soil pH",
      value: na("soilPH", r.soilPH.toFixed(1)), unit: naUnit("soilPH", ""),
      status: naStatus("soilPH", r.soilPH < 5.5 ? (t ? "酸性" : "Acidic") : r.soilPH > 7.5 ? (t ? "碱性" : "Alkaline") : t ? "适宜" : "Workable"),
      cls: naCls("soilPH", r.soilPH < 5.5 || r.soilPH > 7.5 ? "warn" : "ok"),
      est: false,
    },
    {
      key: "soilMoisture", icon: "◌",
      label: t ? "土壤湿度" : "Soil Moisture",
      value: na("soilMoisture", r.soilMoisture), unit: naUnit("soilMoisture", "%"),
      status: naStatus("soilMoisture", r.soilMoisture < 35 ? (t ? "偏干" : "Dry") : r.soilMoisture > 80 ? (t ? "过湿" : "Very wet") : t ? "良好" : "Good"),
      cls: naCls("soilMoisture", r.soilMoisture < 35 ? "danger" : r.soilMoisture > 80 ? "danger" : "ok"),
      est: false,
    },
    {
      key: "soilTemperature", icon: "⌁",
      label: t ? "土壤温度" : "Soil Temperature",
      value: na("soilTemperature", r.soilTemperature), unit: naUnit("soilTemperature", "°C"),
      status: naStatus("soilTemperature", r.soilTemperature > 35 ? (t ? "偏高" : "High") : t ? "适宜" : "Suitable"),
      cls: naCls("soilTemperature", r.soilTemperature > 35 ? "danger" : "ok"),
      est: false,
    },
    {
      key: "airHumidity", icon: "❂",
      label: t ? "空气湿度" : "Air Humidity",
      value: na("airHumidity", r.airHumidity), unit: naUnit("airHumidity", "%"),
      status: naStatus("airHumidity", r.airHumidity > 85 ? (t ? "过高" : "High") : r.airHumidity > 78 ? (t ? "较高" : "Moderately high") : t ? "适宜" : "Good"),
      cls: naCls("airHumidity", r.airHumidity > 85 ? "danger" : r.airHumidity > 78 ? "warn" : "ok"),
      est: false,
    },
    {
      key: "rainfall", icon: "⌇",
      label: t ? "降雨量" : "Rainfall",
      value: na("rainfall", r.rainfall), unit: naUnit("rainfall", " mm"),
      status: naStatus("rainfall", r.rainfall >= 15 ? (t ? "多雨" : "Wet conditions") : t ? "少量" : "Light"),
      cls: naCls("rainfall", r.rainfall >= 15 ? "warn" : "ok"),
      est: false,
    },
    {
      key: "npk", icon: "⛁",
      label: t ? "NPK 养分" : "NPK",
      value: na("npk", "N"), unit: "",
      status: missing("npk") ? "—" : `${r.nitrogen ?? "—"} / ${r.phosphorus ?? "—"} / ${r.potassium ?? "—"}`,
      cls: missing("npk") ? "na" : r.nitrogen == null && r.phosphorus == null ? "warn" : "ok",
      est: true,
    },
  ];
}

export function renderSensorGrid(result, lang, provided = null) {
  const cards = sensorCards(result, lang, provided);
  if (!result.reading) return "";
  return `<div class="sensor-grid">${cards
    .map(
      (card) => `
      <div class="sensor-card ${card.cls} ${card.est ? "est" : ""}" data-key="${card.key}">
        <span class="s-ico">${card.icon}</span>
        <div class="s-label">${card.label}</div>
        <div class="s-value">${card.value}${card.unit}</div>
        <span class="s-status">${card.status}</span>
      </div>`
    )
    .join("")}</div>`;
}

export function tagPills(tagDetails, lang) {
  return `<div class="tag-row">${tagDetails
    .map((tag) => `<span class="tag ${tag.severity}">${lang === "zh" ? tag.textZh || tag.text : tag.text}</span>`)
    .join("")}</div>`;
}

export function renderCropRow(crop, rank, lang, interactive = false) {
  const t = lang === "zh";
  const medals = ["🥇", "🥈", "🥉"];
  const rankLabel = rank < 3 ? `<span class="crop-medal">${medals[rank]}</span>` : `#${rank + 1}`;
  const expandId = `crop-detail-${crop.id}`;
  const reasonsList = t ? (crop.reasonsZh || crop.reasons) : crop.reasons;
  const risksList = t ? (crop.risksZh || crop.risks) : crop.risks;
  const actionsList = t ? (crop.actionsZh || crop.actions) : crop.actions;
  return `
  <article class="crop-card" data-crop="${crop.id}">
    <div class="crop-top">
      <span class="crop-rank">${rankLabel} <span style="opacity:.75">${t ? `第${rank + 1}名` : `TOP ${rank + 1}`}</span></span>
      <span class="crop-emoji">${crop.emoji}</span>
      <div class="crop-title">
        <strong>${t ? crop.zhName : crop.name}</strong>
        <span>${t ? crop.statusZh : `${crop.name} · ${crop.status}`}</span>
      </div>
      <div class="crop-score"><strong>${crop.score}%</strong><small>${t ? "适宜度" : "suitable"}</small></div>
    </div>
    <div class="score-bar" role="img" aria-label="${crop.score}%"><i style="width:${crop.score}%"></i></div>
    <div class="crop-meta">
      <div class="cm" style="grid-template-columns:92px 1fr"><b>${t ? "推荐理由" : "Reasons"}</b><ul class="cm-list ok">${reasonsList.slice(0, 3).map((reason) => `<li>${reason}</li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="cm" style="grid-template-columns:92px 1fr"><b>${t ? "当前风险" : "Risks"}</b><ul class="cm-list warn">${risksList.map((risk) => `<li>⚠ ${risk}</li>`).join("") || "<li>—</li>"}</ul></div>
      <div class="cm" style="grid-template-columns:92px 1fr"><b>${t ? "种植前改进" : "Improvements"}</b><ul class="cm-list">${actionsList.map((action) => `<li>${action}</li>`).join("") || "<li>—</li>"}</ul></div>
      ${interactive ? `
        <div class="crop-actions">
          <button class="btn small primary toggle-breakdown" data-action="toggle-breakdown" data-target="#${expandId}">${t ? "为什么推荐？" : "Why this crop?"}</button>
        </div>
        <div class="score-detail hidden" id="${expandId}">
          ${Object.entries(crop.components)
            .map(([key, value]) => `<div class="sd"><b>${componentLabel(key, t)}</b><i>${value}%</i></div>`)
            .join("")}
          ${(t ? crop.reasonsZh : crop.reasons)?.length
            ? `<div class="sd-summary"><b>${t ? "推荐摘要" : "Summary"}</b><p>${t ? (crop.reasonsZh || []).slice(0, 2).join("，") + "。" : (crop.reasons || []).slice(0, 2).join(", ") + ". "}${t ? `综合适宜度：${crop.score}%。` : `Overall suitability: ${crop.score}%.`}</p></div>`
            : ""}
        </div>` : ""}
    </div>
  </article>`;
}

function componentLabel(key, t) {
  const labels = { pH: "pH", moisture: t ? "湿度" : "Moisture", temperature: t ? "温度" : "Temperature", rainfall: t ? "降雨" : "Rainfall", nutrients: t ? "养分" : "Nutrients", penalty: t ? "风险扣分" : "Risk penalty" };
  return labels[key] || key;
}

export function renderTopCrops(crops, lang, interactive = false) {
  if (!crops || !crops.length) return `<div class="empty-state">${lang === "zh" ? "暂无推荐。" : "No recommendations yet."}</div>`;
  const list = cropListOrder(crops);
  return `<div class="crop-list">${list.map((crop, index) => renderCropRow(crop, index, lang, interactive)).join("")}</div>`;
}

function cropListOrder(crops) {
  return crops.map((crop) => crop.score).some((n, i, arr) => arr.indexOf(n) !== i)
    ? crops
    : crops;
}

export function confidenceBar(result, label) {
  return `
  <div class="card" style="box-shadow:none">
    <div class="s-label" style="color:var(--muted);font-weight:600;font-size:11px">${label || "Confidence"}</div>
    <div class="s-value" style="font:700 22px var(--mono)">${result.confidence}%</div>
    <div class="score-bar"><i style="width:${result.confidence}%"></i></div>
  </div>`;
}