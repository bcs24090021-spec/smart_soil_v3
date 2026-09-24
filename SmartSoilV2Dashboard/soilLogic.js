export const DEFAULT_READING = {
  deviceId: "probe-001",
  location: "demo-field",
  soilPH: 5.6,
  soilMoisture: 68,
  soilTemperature: 29,
  airHumidity: 82,
  rainfall: 12,
  nitrogen: 70,
  phosphorus: 45,
  potassium: 40,
};

export const EXAMPLE_READING = {
  ...DEFAULT_READING,
  soilMoisture: 82,
  airHumidity: 88,
};

export const CROP_PROFILES = [
  {
    id: "rice",
    name: "Rice",
    zhName: "水稻",
    emoji: "🌾",
    ph: [5.0, 7.0],
    moisture: [65, 100],
    temperature: [24, 35],
    rainfall: [8, 30],
    humidity: [60, 95],
    nutrients: { nitrogen: [60, 120], phosphorus: [30, 80], potassium: [30, 90] },
    waterTolerant: true,
    heatTolerant: true,
    acidSensitive: false,
  },
  {
    id: "banana",
    name: "Banana",
    zhName: "香蕉",
    emoji: "🍌",
    ph: [5.5, 7.5],
    moisture: [45, 85],
    temperature: [24, 32],
    rainfall: [5, 25],
    humidity: [60, 95],
    nutrients: { nitrogen: [70, 140], phosphorus: [30, 80], potassium: [40, 140] },
    waterTolerant: true,
    heatTolerant: true,
    acidSensitive: false,
  },
  {
    id: "taro",
    name: "Taro / water-tolerant crop",
    zhName: "芋头 / 耐湿作物",
    emoji: "🥔",
    ph: [5.5, 7.5],
    moisture: [60, 100],
    temperature: [22, 32],
    rainfall: [8, 40],
    humidity: [65, 95],
    nutrients: { nitrogen: [50, 110], phosphorus: [25, 70], potassium: [40, 100] },
    waterTolerant: true,
    heatTolerant: true,
    acidSensitive: false,
  },
  {
    id: "maize",
    name: "Maize",
    zhName: "玉米",
    emoji: "🌽",
    ph: [5.8, 7.0],
    moisture: [35, 70],
    temperature: [20, 32],
    rainfall: [5, 20],
    humidity: [50, 80],
    nutrients: { nitrogen: [80, 140], phosphorus: [35, 80], potassium: [40, 100] },
    waterTolerant: false,
    heatTolerant: true,
    acidSensitive: true,
  },
  {
    id: "chili",
    name: "Chili",
    zhName: "辣椒",
    emoji: "🌶️",
    ph: [6.0, 7.0],
    moisture: [35, 65],
    temperature: [20, 32],
    rainfall: [2, 15],
    humidity: [45, 75],
    nutrients: { nitrogen: [60, 120], phosphorus: [30, 75], potassium: [50, 110] },
    waterTolerant: false,
    heatTolerant: true,
    acidSensitive: true,
  },
  {
    id: "cucumber",
    name: "Cucumber",
    zhName: "黄瓜",
    emoji: "🥒",
    ph: [5.5, 7.0],
    moisture: [45, 75],
    temperature: [18, 30],
    rainfall: [5, 20],
    humidity: [50, 80],
    nutrients: { nitrogen: [60, 120], phosphorus: [30, 70], potassium: [50, 110] },
    waterTolerant: false,
    heatTolerant: false,
    acidSensitive: false,
  },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeReading(input = {}) {
  return {
    deviceId: String(input.deviceId || DEFAULT_READING.deviceId),
    location: String(input.location || DEFAULT_READING.location),
    soilPH: numeric(input.soilPH, DEFAULT_READING.soilPH),
    soilMoisture: numeric(input.soilMoisture, DEFAULT_READING.soilMoisture),
    soilTemperature: numeric(input.soilTemperature, DEFAULT_READING.soilTemperature),
    airHumidity: numeric(input.airHumidity, DEFAULT_READING.airHumidity),
    rainfall: numeric(input.rainfall, DEFAULT_READING.rainfall),
    nitrogen: input.nitrogen === "" || input.nitrogen == null ? null : numeric(input.nitrogen),
    phosphorus: input.phosphorus === "" || input.phosphorus == null ? null : numeric(input.phosphorus),
    potassium: input.potassium === "" || input.potassium == null ? null : numeric(input.potassium),
  };
}

export function validateReading(input) {
  const reading = normalizeReading(input);
  const warnings = [];
  const checks = [
    ["soilPH", 3, 10, "pH must be between 3 and 10."],
    ["soilMoisture", 0, 100, "Soil moisture must be between 0% and 100%."],
    ["soilTemperature", 10, 45, "Soil temperature must be between 10°C and 45°C."],
    ["airHumidity", 0, 100, "Air humidity must be between 0% and 100%."] ,
    ["rainfall", 0, 500, "Rainfall context must be between 0 and 500 mm."],
  ];

  for (const [field, min, max, message] of checks) {
    if (reading[field] < min || reading[field] > max) warnings.push(message);
  }

  for (const field of ["nitrogen", "phosphorus", "potassium"]) {
    if (reading[field] != null && (reading[field] < 0 || reading[field] > 200)) {
      warnings.push(`${field} should be between 0 and 200 when supplied.`);
    }
  }

  return { reading, warnings, valid: warnings.length === 0 };
}

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
    advice.push("Consider agricultural lime and organic matter; confirm the amendment with local agronomic guidance.");
  } else if (safe.soilPH <= 7.0) {
    tags.push("good_ph");
  } else if (safe.soilPH > 7.5) {
    tags.push("alkaline_soil");
    advice.push("Increase organic matter and avoid crops that need strongly acidic soil.");
  }

  if (safe.soilMoisture < 35) {
    tags.push("dry_soil");
    advice.push("Irrigate or wait for rain before planting.");
  } else if (safe.soilMoisture <= 75) {
    tags.push("workable_moisture");
  } else if (safe.soilMoisture > 80) {
    tags.push("waterlogged");
    advice.push("Improve drainage first; excess water can reduce oxygen around roots.");
  }

  if (safe.soilTemperature > 35) {
    tags.push("heat_stress_risk");
    advice.push("Avoid the hottest planting window and consider delaying sowing if needed.");
  }

  if (safe.airHumidity > 85) {
    tags.push("fungal_risk");
    advice.push("Monitor for fungal disease because the air is very humid.");
  }

  if (safe.soilPH >= 5.5 && safe.soilPH < 6.0) {
    tags.push("slightly_acidic");
  }

  return { reading: safe, warnings, tags, advice };
}

function rangeMatch(value, range) {
  const [min, max] = range;
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  const span = Math.max(max - min, 1);
  return clamp(1 - distance / (span * 2), 0, 1);
}

function nutrientMatch(reading, profile) {
  const fields = ["nitrogen", "phosphorus", "potassium"];
  const supplied = fields.filter((field) => reading[field] != null);
  if (supplied.length === 0) return 0.5;
  return supplied.reduce((total, field) => total + rangeMatch(reading[field], profile.nutrients[field]), 0) / supplied.length;
}

function riskPenalty(reading, profile, tags) {
  let penalty = 0;
  if (tags.includes("waterlogged") && !profile.waterTolerant) penalty += 0.2;
  if (tags.includes("heat_stress_risk") && !profile.heatTolerant) penalty += 0.1;
  if (tags.includes("fungal_risk") && !profile.waterTolerant) penalty += 0.04;
  if (tags.includes("acidic_soil") && profile.acidSensitive) penalty += 0.1;
  return penalty;
}

function shouldFilter(reading, profile, tags) {
  if (tags.includes("waterlogged") && !profile.waterTolerant) return true;
  if (tags.includes("acidic_soil") && profile.acidSensitive && reading.soilPH < 5) return true;
  return false;
}

export function rankCrops(input) {
  const diagnosis = diagnoseSoil(input);
  const { reading, tags } = diagnosis;
  const candidates = CROP_PROFILES.filter((profile) => !shouldFilter(reading, profile, tags));

  const ranked = candidates.map((profile) => {
    const pHMatch = rangeMatch(reading.soilPH, profile.ph);
    const moistureMatch = rangeMatch(reading.soilMoisture, profile.moisture);
    const temperatureMatch = rangeMatch(reading.soilTemperature, profile.temperature);
    const rainfallMatch = rangeMatch(reading.rainfall, profile.rainfall);
    const nutrientMatchValue = nutrientMatch(reading, profile);
    const penalty = riskPenalty(reading, profile, tags);
    const rawScore = 0.3 * pHMatch + 0.25 * moistureMatch + 0.2 * temperatureMatch + 0.15 * rainfallMatch + 0.1 * nutrientMatchValue - penalty;
    const score = Math.round(clamp(rawScore, 0, 1) * 100);

    const reasons = [];
    if (pHMatch >= 0.85) reasons.push("pH is a good fit");
    if (moistureMatch >= 0.85) reasons.push(profile.waterTolerant ? "handles the current moisture" : "moisture is workable");
    if (temperatureMatch >= 0.85) reasons.push("temperature is suitable");
    if (rainfallMatch >= 0.85) reasons.push("rainfall context is supportive");
    if (tags.includes("waterlogged") && profile.waterTolerant) reasons.push("tolerates wetter soil");
    if (tags.includes("waterlogged") && profile.id === "banana") reasons.push("drainage still needs checking");

    return { ...profile, score, reasons, components: { pHMatch, moistureMatch, temperatureMatch, rainfallMatch, nutrientMatch: nutrientMatchValue, penalty } };
  }).sort((a, b) => b.score - a.score);

  return { ...diagnosis, crops: ranked.slice(0, 3), allCrops: ranked };
}

export function generateAdvice(result, language = "en") {
  const { reading, crops, tags } = result;
  const top = crops[0];
  const names = crops.map((crop) => `${crop.name} (${crop.score}%)`).join(", ");
  const wet = tags.includes("waterlogged");
  const humid = tags.includes("fungal_risk");
  const acidic = tags.includes("slightly_acidic") || tags.includes("acidic_soil");

  if (language === "zh") {
    const pHText = acidic ? "pH 稍微偏酸" : tags.includes("alkaline_soil") ? "pH 偏碱" : "pH 在可接受范围";
    const lead = wet ? "这块土壤目前偏湿" : reading.soilMoisture < 35 ? "这块土壤目前偏干" : "这块土壤目前的湿度适中";
    const topReason = top ? `${top.zhName}（${top.score}%）最适合目前条件。` : "目前没有足够可靠的候选作物。";
    const action = wet ? "种植前先改善非水稻作物的排水，观察 1–2 天水位" : reading.soilMoisture < 35 ? "种植前先灌溉或等雨" : "种植前继续观察土壤变化";
    const disease = humid ? "同时注意高湿带来的真菌病害风险。" : "继续观察湿度和温度变化。";
    return `${lead}，${pHText}。${topReason}候选作物：${names}。建议${action}；${disease}这是初步建议，请结合当地农艺指导确认。`;
  }

  const pHText = acidic ? "the pH is slightly acidic" : tags.includes("alkaline_soil") ? "the pH is alkaline" : "the pH is within a workable range";
  const lead = wet ? "This soil is currently very wet" : reading.soilMoisture < 35 ? "This soil is currently dry" : "This soil has workable moisture";
  const topReason = top ? `${top.name} (${top.score}%) is the strongest fit.` : "There is no reliable crop candidate yet.";
  const action = wet ? "improve drainage for non-paddy crops and observe the water level for 1–2 days" : reading.soilMoisture < 35 ? "irrigate or wait for rain before planting" : "continue monitoring the soil before planting";
  const disease = humid ? "Watch for fungal disease because humidity is high." : "Continue monitoring humidity and temperature.";
  return `${lead}, and ${pHText}. ${topReason} Ranked options: ${names}. Before planting, ${action}. ${disease} Preliminary recommendation only; verify with local agronomic guidance.`;
}

export function buildResult(input) {
  const result = rankCrops(input);
  return {
    ...result,
    advice: { en: generateAdvice(result, "en"), zh: generateAdvice(result, "zh") },
  };
}
