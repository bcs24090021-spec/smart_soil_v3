import { normalizeReading } from "./validate.js";
import { rankCrops } from "./crops.js";
import { calculatePlantHealth } from "./health.js";
import { buildAlerts } from "./alerts.js";
import { predictRisks } from "./prediction.js";

export function simulateScenario(baseReading, changes = {}) {
  const before = normalizeReading(baseReading);
  const after = normalizeReading({ ...before, ...changes });

  const deltas = Object.entries(changes)
    .filter(([key, value]) => value !== before[key] && value != null)
    .map(([key, value]) => ({
      field: key,
      label: fieldLabel(key),
      from: before[key],
      to: value,
    }));

  const beforeResult = rankCrops(before);
  const afterResult = rankCrops(after);
  const healthBefore = calculatePlantHealth(before);
  const healthAfter = calculatePlantHealth(after);

  const beforeTags = new Set(beforeResult.tags);
  const afterTags = new Set(afterResult.tags);
  const effects = [];
  if (beforeTags.has("dry_soil") && !afterTags.has("dry_soil")) effects.push("Reduced water stress");
  if (beforeTags.has("waterlogged") && !afterTags.has("waterlogged")) effects.push("Waterlogging resolved");
  if (!beforeTags.has("waterlogged") && afterTags.has("waterlogged")) effects.push("Waterlogging introduced");
  if (beforeTags.has("heat_stress_risk") && !afterTags.has("heat_stress_risk")) effects.push("Heat stress removed");
  if (!beforeTags.has("heat_stress_risk") && afterTags.has("heat_stress_risk")) effects.push("Heat stress introduced");
  if (beforeTags.has("fungal_risk") && !afterTags.has("fungal_risk")) effects.push("Fungal risk reduced");
  if (!beforeTags.has("fungal_risk") && afterTags.has("fungal_risk")) effects.push("Fungal risk increased");
  if (!effects.length) effects.push("No major condition change");

  return {
    before,
    after,
    deltas,
    effects,
    healthBefore,
    healthAfter,
    healthDelta: healthAfter.score - healthBefore.score,
    beforeResult: { tags: beforeTags, crops: beforeResult.crops },
    afterResult: { tags: afterTags, crops: afterResult.crops },
    alerts: buildAlerts({ tags: [...afterTags], warnings: afterResult.warnings }),
    predictions: predictRisks(after),
    warnings: afterResult.warnings,
  };
}

function fieldLabel(key) {
  const labels = {
    soilPH: "Soil pH",
    soilMoisture: "Soil moisture",
    soilTemperature: "Soil temperature",
    airHumidity: "Air humidity",
    rainfall: "Rainfall",
    nitrogen: "Nitrogen",
    phosphorus: "Phosphorus",
    potassium: "Potassium",
  };
  return labels[key] || key;
}