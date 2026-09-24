import { clamp, validateReading } from "./validate.js";

export const TAG_META = {
  good_ph: { en: "Good pH range", zh: "pH 适宜", severity: "good" },
  slightly_acidic: { en: "Slightly acidic", zh: "微酸性", severity: "warn" },
  acidic_soil: { en: "Acidic soil", zh: "酸性土壤", severity: "warn" },
  alkaline_soil: { en: "Alkaline soil", zh: "碱性土壤", severity: "warn" },
  dry_soil: { en: "Soil is too dry", zh: "土壤过干", severity: "warn" },
  workable_moisture: { en: "Workable moisture", zh: "湿度适宜", severity: "good" },
  waterlogged: { en: "Waterlogged", zh: "水涝", severity: "danger" },
  heat_stress_risk: { en: "Heat stress risk", zh: "高温胁迫风险", severity: "warn" },
  fungal_risk: { en: "Fungal risk", zh: "真菌风险", severity: "warn" },
  low_nutrient_risk: { en: "Nutrients not measured", zh: "养分未测量", severity: "info" },
};

export function diagnoseSoil(input) {
  const { reading, warnings } = validateReading(input);
  const safe = {
    ...reading,
    soilPH: clamp(reading.soilPH, 3, 10),
    soilMoisture: clamp(reading.soilMoisture, 0, 100),
    soilTemperature: clamp(reading.soilTemperature, 10, 45),
    airHumidity: clamp(reading.airHumidity, 0, 100),
    rainfall: Math.max(0, reading.rainfall),
  };

  const tags = [];
  const advice = [];

  if (safe.soilPH < 5.5) {
    tags.push("acidic_soil");
    advice.push("The soil is acidic. Agricultural lime or compost can help, but confirm with local agronomic guidance.");
  } else if (safe.soilPH <= 7.0) {
    tags.push("good_ph");
  } else if (safe.soilPH > 7.5) {
    tags.push("alkaline_soil");
    advice.push("The soil is alkaline. Add organic matter and prefer crops that tolerate higher pH.");
  } else {
    tags.push("good_ph");
  }
  if (safe.soilPH >= 5.5 && safe.soilPH < 6.0 && safe.soilPH >= 5.5) {
    tags.push("slightly_acidic");
  }

  if (safe.soilMoisture < 35) {
    tags.push("dry_soil");
    advice.push("The soil is too dry. Irrigate or wait for rain before planting.");
  } else if (safe.soilMoisture <= 75) {
    tags.push("workable_moisture");
  } else if (safe.soilMoisture > 80) {
    tags.push("waterlogged");
    advice.push("The soil is waterlogged. Improve drainage; excess water reduces oxygen around roots.");
  }

  if (safe.soilTemperature > 35) {
    tags.push("heat_stress_risk");
    advice.push("Soil temperature is high. Prefer the cooler planting window or delay sowing.");
  }

  if (safe.airHumidity > 85) {
    tags.push("fungal_risk");
    advice.push("The air is very humid, so fungal risk is elevated. Improve airflow and check drainage.");
  }

  if (safe.nitrogen == null && safe.phosphorus == null && safe.potassium == null) {
    tags.push("low_nutrient_risk");
    advice.push("NPK was not measured. Treat nutrient advice as estimated rather than laboratory-grade.");
  }

  const tagDetails = tags.map((id) => ({ id, ...TAG_META[id], text: TAG_META[id].en, textZh: TAG_META[id].zh }));

  const summary = buildSummary(safe, tags);
  const summaryZh = buildSummaryZh(safe, tags);

  return { reading: safe, warnings, tags, tagDetails, advice, summary, summaryZh };
}

function buildSummary(reading, tags) {
  if (tags.includes("waterlogged")) return "Your soil is currently very wet and the air is humid.";
  if (tags.includes("dry_soil")) return "Your soil is currently dry and may need irrigation.";
  const ph = tags.includes("acidic_soil") ? "slightly acidic" : tags.includes("alkaline_soil") ? "alkaline" : "near-neutral";
  return `Your soil is workable, ${ph}, with ${reading.airHumidity}% air humidity.`;
}

function buildSummaryZh(reading, tags) {
  if (tags.includes("waterlogged")) return "您的土壤目前偏湿，空气湿度也较高。";
  if (tags.includes("dry_soil")) return "您的土壤目前偏干，可能需要先灌溉。";
  const ph = tags.includes("acidic_soil") ? "微酸性" : tags.includes("alkaline_soil") ? "碱性" : "接近中性";
  return `您的土壤湿度适中、${ph}，空气湿度 ${reading.airHumidity}%。`;
}