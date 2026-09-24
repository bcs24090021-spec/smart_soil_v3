import { clamp } from "./validate.js";

const OPTIMAL = {
  water: [40, 70],
  ph: [5.5, 7.0],
  temperature: [22, 34],
  humidity: [45, 75],
};

const WEIGHTS = { water: 0.25, ph: 0.2, temperature: 0.2, humidity: 0.15, nutrients: 0.2 };

function rangeMatch(value, [min, max]) {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  const span = Math.max(max - min, 1);
  return clamp(1 - distance / (span * 2), 0, 1);
}

function nutrientHealth(reading) {
  const fields = ["nitrogen", "phosphorus", "potassium"];
  const ranges = {
    nitrogen: [60, 120],
    phosphorus: [30, 80],
    potassium: [40, 120],
  };
  const supplied = fields.filter((field) => reading[field] != null);
  if (supplied.length === 0) return 0.6;
  return supplied.reduce((total, field) => total + rangeMatch(reading[field], ranges[field]), 0) / supplied.length;
}

export function calculatePlantHealth(input) {
  const reading = input?.reading || input;

  const water = rangeMatch(reading.soilMoisture, OPTIMAL.water);
  const ph = rangeMatch(reading.soilPH, OPTIMAL.ph);
  const temperature = rangeMatch(reading.soilTemperature, OPTIMAL.temperature);
  const humidity = rangeMatch(reading.airHumidity, OPTIMAL.humidity);
  const nutrients = nutrientHealth(reading);

  const breakdown = {
    water: Math.round(water * 100),
    ph: Math.round(ph * 100),
    temperature: Math.round(temperature * 100),
    humidity: Math.round(humidity * 100),
    nutrients: Math.round(nutrients * 100),
  };

  const score = Math.round(
    clamp(
      water * WEIGHTS.water + ph * WEIGHTS.ph + temperature * WEIGHTS.temperature + humidity * WEIGHTS.humidity + nutrients * WEIGHTS.nutrients,
      0,
      1
    ) * 100
  );

  const level = score >= 80 ? "Healthy" : score >= 60 ? "Needs attention" : "High risk";
  const levelZh = score >= 80 ? "健康" : score >= 60 ? "需关注" : "高风险";

  return { score, level, levelZh, breakdown };
}