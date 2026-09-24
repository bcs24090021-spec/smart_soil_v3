function level(match) {
  if (match >= 0.65) return "HIGH";
  if (match >= 0.35) return "MEDIUM";
  return "LOW";
}

export function predictRisks(input) {
  const reading = input?.reading || input;

  const waterRisk = level(clamp01((35 - reading.soilMoisture) / (35 - 15)));
  const heatRisk = level((reading.soilTemperature - 30) / (38 - 30));
  const fungalRisk = level((reading.airHumidity - 75) / (88 - 75));

  const risks = [
    {
      key: "waterStress",
      en: "Water Stress",
      zh: "水分胁迫",
      level: waterRisk,
      message: {
        en:
          reading.soilMoisture < 35
            ? "Soil moisture is low; without irrigation water stress may rise by tomorrow."
            : "Soil moisture is adequate, so water stress is unlikely tomorrow.",
        zh:
          reading.soilMoisture < 35
            ? "土壤湿度偏低；若不灌溉，明天可能出现水分胁迫。"
            : "土壤湿度适宜，明天水分胁迫可能性低。",
      },
    },
    {
      key: "heatStress",
      en: "Heat Stress",
      zh: "高温胁迫",
      level: heatRisk,
      message: {
        en:
          reading.soilTemperature >= 35
            ? "Soil temperature is above the preferred range. A warm afternoon may increase heat stress."
            : "Soil temperature is within range for the forecast window.",
        zh:
          reading.soilTemperature >= 35
            ? "土壤温度高于适宜范围，白天升温可能加重高温胁迫。"
            : "土壤温度在当前预报窗口内处于适宜范围。",
      },
    },
    {
      key: "fungal",
      en: "Fungal Risk",
      zh: "真菌风险",
      level: fungalRisk,
      message: {
        en:
          reading.airHumidity >= 85
            ? "Based on current conditions, prolonged high humidity may increase environmental fungal risk."
            : "Humidity is moderate, so fungal risk is likely low tomorrow.",
        zh:
          reading.airHumidity >= 85
            ? "根据当前条件，持续高湿可能增加真菌病害风险。"
            : "当前湿度适中，明天真菌风险预计较低。",
      },
    },
  ];

  return risks;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}