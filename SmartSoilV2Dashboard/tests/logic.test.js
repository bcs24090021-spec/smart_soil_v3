import assert from "node:assert/strict";
import { buildPipeline } from "../src/engines/pipeline.js";
import { validateReading, DEFAULT_READING, EXAMPLE_READING, DEMO_SCENARIOS } from "../src/engines/validate.js";
import { calculatePlantHealth } from "../src/engines/health.js";
import { predictRisks } from "../src/engines/prediction.js";
import { simulateScenario } from "../src/engines/simulation.js";
import { answerQuestion } from "../src/engines/aiAdvice.js";
import { t } from "../src/locales/index.js";

// Pipeline: healthy farm
const healthyInput = DEMO_SCENARIOS.healthy.reading;
const healthy = buildPipeline(healthyInput, { source: "sim" });
assert.equal(healthy.valid, true);
assert.ok((healthy.warnings || []).length === 0);
assert.equal(healthy.crops.length, 3);
assert.equal(healthy.allCrops.length, 30);
assert.ok(healthy.health.score >= 80, `healthy health score should be >= 80, got ${healthy.health.score}`);
assert.ok(healthy.crops[0].score >= healthy.crops[1].score, "crops should be ranked by score");
assert.ok(typeof healthy.confidence === "number" && healthy.confidence > 0);
assert.ok(healthy.diagnosis.tags.includes("good_ph"), "healthy pH should carry the good_ph tag");

// Pipeline: waterlogged (EXAMPLE_READING: moisture 82, humidity 88)
const wet = buildPipeline(EXAMPLE_READING, { source: "sim" });
assert.ok(wet.diagnosis.tags.includes("waterlogged"), "wet reading should be tagged waterlogged");
assert.ok(wet.diagnosis.tags.includes("fungal_risk"), "humid reading should carry fungal_risk");
assert.equal(wet.crops[0].id, "rice", "rice should rank #1 in wet conditions");
assert.ok(!wet.crops.some((crop) => crop.id === "chili"), "chili should not break the waterlogged top-3");
assert.equal(wet.alerts.filter((a) => a.severity === "danger" && a.cause === "waterlogged").length, 1);

// Pipeline: drought
const dry = buildPipeline({ ...DEFAULT_READING, soilMoisture: 20 }, { source: "sim" });
assert.ok(dry.diagnosis.tags.includes("dry_soil"), "low moisture should be tagged dry_soil");
assert.equal(dry.crops[0].id, "dragonfruit", "a drought-tolerant crop should rank #1 in dry soil");

// Validation warnings
const invalid = validateReading({ ...DEFAULT_READING, soilPH: 12, soilTemperature: 5 });
assert.equal(invalid.valid, false);
assert.equal(invalid.warnings.length, 2);

// Health
assert.ok(calculatePlantHealth(EXAMPLE_READING).score < calculatePlantHealth(healthyInput).score);
const wetHealth = calculatePlantHealth(EXAMPLE_READING);
assert.equal(typeof wetHealth.breakdown.water, "number");
assert.ok(Object.keys(wetHealth.breakdown).length === 5, "breakdown should include water/ph/temperature/humidity/nutrients");

// Predictions
const wetPredictions = predictRisks(EXAMPLE_READING);
const fungal = wetPredictions.find((p) => p.key === "fungal");
assert.equal(fungal.level, "HIGH", "humidity 88 should be HIGH fungal risk");
const dryPredictions = predictRisks({ ...DEFAULT_READING, soilMoisture: 20 });
const waterStress = dryPredictions.find((p) => p.key === "waterStress");
assert.equal(waterStress.level, "HIGH");

// Simulation (drought -> workable moisture)
const droughtInput = { ...DEMO_SCENARIOS.drought.reading, source: "sim" };
const simulation = simulateScenario(droughtInput, { soilMoisture: 60 });
assert.equal(simulation.after.soilMoisture, 60);
assert.ok(simulation.effects.includes("Reduced water stress"), "raising moisture should reduce water stress");
assert.ok(simulation.healthAfter.score > simulation.healthBefore.score, "moisture fix should improve health");
assert.equal(simulation.healthDelta, simulation.healthAfter.score - simulation.healthBefore.score);
assert.ok(Array.isArray(simulation.alerts), "simulation should return alerts");
assert.ok(Array.isArray(simulation.deltas) && simulation.deltas.length > 0);

// AI advice / chat
const chat = answerQuestion("Why is rice recommended?", wet, "en");
assert.ok(chat.answer.includes("Rice"), "rice question should answer about rice");
const zhChat = answerQuestion("为什么推荐水稻？", wet, "zh");
assert.ok(zhChat.answer.includes("水稻"), "chinese rice question should answer about 水稻");
const fallback = answerQuestion("what is the weather on mars", wet, "en");
assert.ok(typeof fallback.answer === "string" && fallback.answer.length > 0);

// Locales
assert.equal(t("en", "nav.recs"), "Crops");
assert.equal(t("zh", "nav.recs"), "作物");
assert.equal(t("en", "disclaimer").length > 0, true);
assert.equal(t("en", "missing.key.path"), "missing.key.path", "unknown keys fall back to the path");

console.log("logic tests passed");
