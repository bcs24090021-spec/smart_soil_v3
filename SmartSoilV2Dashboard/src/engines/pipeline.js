import { normalizeReading, validateReading, missingSensors } from "./validate.js";
import { rankCrops } from "./crops.js";
import { calculatePlantHealth } from "./health.js";
import { buildAlerts } from "./alerts.js";
import { predictRisks } from "./prediction.js";
import { generateAdvice } from "./aiAdvice.js";

export function computeConfidence(reading, source = "sim") {
  let confidence = 100;
  const missing = missingSensors(reading);
  confidence -= missing.length * 8;
  if (reading.nitrogen == null && reading.phosphorus == null && reading.potassium == null) confidence -= 10;
  if (source === "sim") confidence -= 15;
  const validation = validateReading(reading);
  if (!validation.valid) confidence -= 25;
  return Math.max(30, Math.min(100, confidence));
}

export function buildPipeline(input, options = {}) {
  const source = options.source || "sim";
  const reading = normalizeReading(input);
  const { warnings, valid } = validateReading(reading);

  const cropResult = rankCrops(reading);
  const diagnosis = {
    tags: cropResult.tags,
    tagDetails: cropResult.tagDetails,
    advice: cropResult.advice,
    summary: cropResult.summary,
    summaryZh: cropResult.summaryZh,
  };

  const health = calculatePlantHealth(reading);
  const alerts = buildAlerts({ tags: cropResult.tags, warnings });
  const predictions = predictRisks(reading);
  const adviceEn = generateAdvice(
    { reading, diagnosis, crops: cropResult.crops, alerts, predictions, health },
    "en"
  );
  const adviceZh = generateAdvice(
    { reading, diagnosis, crops: cropResult.crops, alerts, predictions, health },
    "zh"
  );

  const result = {
    timestamp: new Date().toISOString(),
    source,
    reading,
    warnings,
    valid,
    missingSensors: missingSensors(reading),
    diagnosis,
    health,
    crops: cropResult.crops,
    allCrops: cropResult.allCrops,
    alerts,
    predictions,
    advice: { en: adviceEn, zh: adviceZh },
    confidence: computeConfidence(reading, source),
    disclaimer: true,
  };

  return result;
}