export const RANGES = {
  soilPH: [3, 10],
  soilMoisture: [0, 100],
  soilTemperature: [10, 45],
  airHumidity: [0, 100],
  rainfall: [0, 500],
  nitrogen: [0, 200],
  phosphorus: [0, 200],
  potassium: [0, 200],
};

export const SENSOR_FIELDS = ["soilPH", "soilMoisture", "soilTemperature", "airHumidity"];

export const DEFAULT_READING = {
  deviceId: "probe-001",
  location: "demo-field",
  soilPH: 5.8,
  soilMoisture: 62,
  soilTemperature: 29,
  airHumidity: 80,
  rainfall: 8,
  nitrogen: 70,
  phosphorus: 45,
  potassium: 40,
};

export const EXAMPLE_READING = {
  ...DEFAULT_READING,
  soilPH: 5.6,
  soilMoisture: 82,
  airHumidity: 88,
  rainfall: 12,
};

export const DEMO_SCENARIOS = {
  healthy: { name: "Healthy Farm", zhName: "健康农场", reading: { soilPH: 6.2, soilMoisture: 60, soilTemperature: 29, airHumidity: 70, rainfall: 6, nitrogen: 80, phosphorus: 45, potassium: 60 } },
  drought: { name: "Drought Stress", zhName: "干旱胁迫", reading: { soilPH: 6.0, soilMoisture: 20, soilTemperature: 34, airHumidity: 55, rainfall: 2, nitrogen: 55, phosphorus: 30, potassium: 40 } },
  waterlogged: { name: "Waterlogged", zhName: "水涝", reading: { soilPH: 5.6, soilMoisture: 82, soilTemperature: 29, airHumidity: 88, rainfall: 12, nitrogen: 70, phosphorus: 45, potassium: 40 } },
  heat: { name: "Heat Stress", zhName: "高温胁迫", reading: { soilPH: 6.1, soilMoisture: 45, soilTemperature: 38, airHumidity: 62, rainfall: 4, nitrogen: 70, phosphorus: 45, potassium: 40 } },
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function numeric(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeReading(input = {}) {
  return {
    deviceId: String(input?.deviceId || DEFAULT_READING.deviceId),
    location: String(input?.location || DEFAULT_READING.location),
    soilPH: numeric(input?.soilPH, DEFAULT_READING.soilPH),
    soilMoisture: numeric(input?.soilMoisture, DEFAULT_READING.soilMoisture),
    soilTemperature: numeric(input?.soilTemperature, DEFAULT_READING.soilTemperature),
    airHumidity: numeric(input?.airHumidity, DEFAULT_READING.airHumidity),
    rainfall: numeric(input?.rainfall, DEFAULT_READING.rainfall),
    nitrogen: input?.nitrogen === "" || input?.nitrogen == null ? null : numeric(input?.nitrogen),
    phosphorus: input?.phosphorus === "" || input?.phosphorus == null ? null : numeric(input?.phosphorus),
    potassium: input?.potassium === "" || input?.potassium == null ? null : numeric(input?.potassium),
  };
}

export function validateReading(input) {
  const reading = normalizeReading(input);
  const warnings = [];

  for (const [field, [min, max]] of Object.entries(RANGES)) {
    if (field === "nitrogen" || field === "phosphorus" || field === "potassium") {
      if (reading[field] != null && (reading[field] < min || reading[field] > max)) {
        warnings.push(`${field} reading should be between ${min} and ${max} when supplied.`);
      }
      continue;
    }
    if (!(field in reading)) continue;
    if (reading[field] < min || reading[field] > max) {
      warnings.push(`${field} reading ${reading[field]} is outside the supported range ${min}–${max}.`);
    }
  }

  return { reading, warnings, valid: warnings.length === 0 };
}

export function missingSensors(reading) {
  return SENSOR_FIELDS.filter((field) => reading[field] == null || !Number.isFinite(reading[field]));
}