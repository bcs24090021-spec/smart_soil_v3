import { CROP_PROFILES } from "../data/crops.js";
import { diagnoseSoil } from "./diagnosis.js";
import { clamp } from "./validate.js";

// Keep the browser recommendation order identical to the ESP32 photo list.
// The prototype only has reliable readings for temperature, soil wetness and pH.
const HARDWARE_CROP_ORDER = [
  "rice", "maize", "sweetpotato", "yam", "sugarcane", "sagopalm", "oilpalm",
  "pepper", "rubber", "coconut", "durian", "dabai", "rambutan", "langsat",
  "cempedak", "chili", "ladyfinger", "longbean", "eggplant", "kangkung", "onion",
  "bittergourd", "pumpkin", "kailan", "cucumber", "mango", "guava", "banana",
  "papaya", "dragonfruit",
];

const HARDWARE_CROP_INDEX = new Map(HARDWARE_CROP_ORDER.map((id, index) => [id, index]));

function moistureBand(index) {
  return index < 30 ? 0 : index < 70 ? 1 : 2;
}

function cropMoistureBand([min, max]) {
  const midpoint = min + max;
  return midpoint <= 60 ? 0 : midpoint <= 88 ? 1 : 2;
}

function inRange(value, [min, max]) {
  return value >= min && value <= max;
}

function hardwareMoistureScore(reading, profile) {
  const distance = Math.abs(moistureBand(reading.soilMoisture) - cropMoistureBand(profile.moisture));
  return distance === 0 ? 2 : distance === 1 ? 1 : 0;
}

function rangeMatch(value, [min, max]) {
  if (value < min || value > max) {
    const distance = value < min ? min - value : value - max;
    const span = Math.max(max - min, 1);
    return clamp(1 - distance / (span * 2), 0, 0.9);
  }
  const center = (min + max) / 2;
  const half = Math.max((max - min) / 2, 1);
  const proximity = 1 - Math.abs(value - center) / half;
  return 0.9 + 0.1 * proximity;
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

function buildReasons(profile, tags, components) {
  const reasons = [];
  const zh = [];
  const add = (en, zhs) => {
    reasons.push(en);
    zh.push(zhs);
  };
  if (components.pHMatch >= 0.85) add("pH is a suitable fit", "pH 适宜");
  if (components.moistureMatch >= 0.85) add(profile.waterTolerant ? "handles the current moisture level" : "moisture is workable for this crop", profile.waterTolerant ? "能适应当前湿度" : "湿度适宜该作物");
  if (components.temperatureMatch >= 0.85) add("temperature is suitable", "温度适宜");
  if (components.rainfallMatch >= 0.85) add("rainfall context is supportive", "降雨条件有利");
  if (tags.includes("waterlogged") && profile.waterTolerant) add("tolerates wetter soil", "耐涝，适合潮湿土壤");
  if (tags.includes("dry_soil") && !profile.waterTolerant) add("suited to drier, well-drained ground", "适合较干燥、排水良好的土壤");
  return { en: reasons, zh };
}

function buildRisks(profile, tags, reading) {
  const risks = [];
  const zh = [];
  const add = (en, zhs) => {
    risks.push(en);
    zh.push(zhs);
  };

  if (reading.soilPH < profile.ph[0]) add(`Soil pH ${reading.soilPH.toFixed(1)} is below this crop's preferred ${profile.ph[0]}–${profile.ph[1]} range`, `土壤 pH ${reading.soilPH.toFixed(1)} 低于该作物适宜范围 ${profile.ph[0]}–${profile.ph[1]}`);
  else if (reading.soilPH > profile.ph[1]) add(`Soil pH ${reading.soilPH.toFixed(1)} is above this crop's preferred ${profile.ph[0]}–${profile.ph[1]} range`, `土壤 pH ${reading.soilPH.toFixed(1)} 高于该作物适宜范围 ${profile.ph[0]}–${profile.ph[1]}`);

  if (reading.soilMoisture < profile.moisture[0]) add(`Moisture ${reading.soilMoisture}% is below this crop's ${profile.moisture[0]}–${profile.moisture[1]}% band`, `土壤湿度 ${reading.soilMoisture}% 低于该作物 ${profile.moisture[0]}–${profile.moisture[1]}% 区间`);
  else if (reading.soilMoisture > profile.moisture[1]) add(`Moisture ${reading.soilMoisture}% is above this crop's ${profile.moisture[0]}–${profile.moisture[1]}% band`, `土壤湿度 ${reading.soilMoisture}% 高于该作物 ${profile.moisture[0]}–${profile.moisture[1]}% 区间`);

  if (reading.soilTemperature < profile.temperature[0]) add(`Soil temperature ${reading.soilTemperature}°C is below this crop's ${profile.temperature[0]}–${profile.temperature[1]}°C band`, `土壤温度 ${reading.soilTemperature}°C 低于该作物 ${profile.temperature[0]}–${profile.temperature[1]}°C 区间`);
  else if (reading.soilTemperature > profile.temperature[1]) add(`Soil temperature ${reading.soilTemperature}°C is above this crop's ${profile.temperature[0]}–${profile.temperature[1]}°C band`, `土壤温度 ${reading.soilTemperature}°C 高于该作物 ${profile.temperature[0]}–${profile.temperature[1]}°C 区间`);

  if (profile.rainfall) {
    if (reading.rainfall < profile.rainfall[0]) add(`Rainfall is below this crop's ${profile.rainfall[0]}–${profile.rainfall[1]} mm context`, `降雨量低于该作物 ${profile.rainfall[0]}–${profile.rainfall[1]} mm 需求`);
    else if (reading.rainfall > profile.rainfall[1]) add(`Rainfall is above this crop's ${profile.rainfall[0]}–${profile.rainfall[1]} mm context`, `降雨量高于该作物 ${profile.rainfall[0]}–${profile.rainfall[1]} mm 需求`);
  }

  if (profile.nutrients) {
    if (reading.nitrogen != null && reading.nitrogen < profile.nutrients.nitrogen[0]) add("Nitrogen is below this crop's target", "氮素低于该作物目标值");
    if (reading.phosphorus != null && reading.phosphorus < profile.nutrients.phosphorus[0]) add("Phosphorus is below this crop's target", "磷素低于该作物目标值");
    if (reading.potassium != null && reading.potassium < profile.nutrients.potassium[0]) add("Potassium is below this crop's target", "钾素低于该作物目标值");
  }

  if (tags.includes("waterlogged") && !profile.waterTolerant) add("Waterlogging risk — needs drainage first", "水涝风险——需先改善排水");
  if (tags.includes("heat_stress_risk") && !profile.heatTolerant) add("Heat stress risk — avoid the hottest window", "高温风险——避开最热时段");
  if (tags.includes("fungal_risk") && !profile.waterTolerant) add("Fungal risk — monitor leaves and airflow", "真菌风险——注意叶片与通风");
  if (tags.includes("acidic_soil") && profile.acidSensitive) add("Acid-sensitive — check pH amendments", "怕酸——请确认 pH 改良措施");

  if (!risks.length) add("Low residual risk — monitor field conditions before sowing", "残余风险较低——播种前持续监测田间条件");
  return { en: risks, zh };
}

function buildActions(profile, tags, reading) {
  const actions = [];
  const zh = [];
  const add = (en, zhs) => {
    actions.push(en);
    zh.push(zhs);
  };
  if (tags.includes("waterlogged")) add(profile.waterTolerant ? "Maintain water level and monitor drainage" : "Improve drainage before planting", profile.waterTolerant ? "保持水位并监测排水" : "种植前改善排水");
  if (tags.includes("dry_soil")) add(profile.waterTolerant ? "Irrigate to bring moisture up" : "Irrigate before planting", profile.waterTolerant ? "灌溉以提升土壤湿度" : "种植前先灌溉");
  if (tags.includes("fungal_risk")) add("Monitor humidity and improve airflow", "监测湿度并改善通风");
  if (tags.includes("heat_stress_risk")) add("Pick the cooler planting window or delay sowing", "选择较凉爽时段种植或推迟播种");
  if (tags.includes("acidic_soil") || tags.includes("alkaline_soil")) add("Confirm pH amendment with local guidance", "结合当地建议确认 pH 改良措施");
  if (!actions.length) add("Continue monitoring conditions before planting", "种植前持续监测土壤条件");
  return { en: actions.slice(0, 3), zh: zh.slice(0, 3) };
}

function statusLabel(score) {
  if (score >= 85) return ["Highly suitable", "高度适宜"];
  if (score >= 70) return ["Suitable", "适宜"];
  return ["Possible with preparation", "需要准备后种植"];
}

function buildCropItem(reading, profile, tags) {
  const moistureScore = hardwareMoistureScore(reading, profile);
  const pHScore = inRange(reading.soilPH, profile.ph) ? 2 : 0;
  const temperatureScore = inRange(reading.soilTemperature, profile.temperature) ? 2 : 0;
  const hardwareScore = pHScore + moistureScore + temperatureScore;
  const components = {
    pHMatch: pHScore / 2,
    moistureMatch: moistureScore / 2,
    temperatureMatch: temperatureScore / 2,
    rainfallMatch: 0.5,
    nutrientMatch: 0.5,
    riskPenalty: 0,
  };

  // This is the same 6-point rule used by DemoRanking.h on the ESP32:
  // pH 2 + moisture band 2/1/0 + temperature 2.
  const score = Math.round((hardwareScore / 6) * 100);

  const status = statusLabel(score);
  const reasons = buildReasons(profile, tags, components);
  const risks = buildRisks(profile, tags, reading);
  const actions = buildActions(profile, tags, reading);

  return {
    ...profile,
    score,
    status: status[0],
    statusZh: status[1],
    reasons: reasons.en,
    reasonsZh: reasons.zh,
    risks: risks.en,
    risksZh: risks.zh,
    actions: actions.en,
    actionsZh: actions.zh,
    components: {
      pH: Math.round(components.pHMatch * 100),
      moisture: Math.round(components.moistureMatch * 100),
      temperature: Math.round(components.temperatureMatch * 100),
      rainfall: Math.round(components.rainfallMatch * 100),
      nutrients: Math.round(components.nutrientMatch * 100),
      penalty: Math.round(components.riskPenalty * 100),
    },
  };
}

export function rankCrops(input) {
  const diagnosis = diagnoseSoil(input);
  const { reading, tags } = diagnosis;

  const candidates = CROP_PROFILES.filter((profile) => HARDWARE_CROP_INDEX.has(profile.id));
  const ranked = candidates
    .map((profile) => buildCropItem(reading, profile, tags))
    .sort((a, b) => b.score - a.score || HARDWARE_CROP_INDEX.get(a.id) - HARDWARE_CROP_INDEX.get(b.id));

  return { ...diagnosis, allCrops: ranked, crops: ranked.slice(0, 3) };
}
