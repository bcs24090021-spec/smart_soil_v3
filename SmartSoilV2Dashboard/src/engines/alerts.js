const RULES = [
  { tag: "dry_soil", severity: "warning", emoji: "💧", label: { en: "Soil moisture is too low", zh: "土壤湿度过低" }, action: { en: "Consider irrigation before planting.", zh: "建议种植前先灌溉。" } },
  { tag: "waterlogged", severity: "danger", emoji: "🌊", label: { en: "Waterlogging detected", zh: "检测到水涝" }, action: { en: "Check drainage before planting.", zh: "种植前先检查排水。" } },
  { tag: "heat_stress_risk", severity: "warning", emoji: "🌡️", label: { en: "Heat stress risk", zh: "高温胁迫风险" }, action: { en: "Delay planting to the cooler window.", zh: "建议推迟到较凉爽时段种植。" } },
  { tag: "fungal_risk", severity: "warning", emoji: "🍄", label: { en: "High fungal risk", zh: "真菌风险较高" }, action: { en: "Air humidity is above the recommended threshold. Improve airflow.", zh: "空气湿度过高，建议改善通风。" } },
  { tag: "acidic_soil", severity: "warning", emoji: "🧪", label: { en: "Soil is too acidic", zh: "土壤过酸" }, action: { en: "Amend with lime or organic matter after local confirmation.", zh: "请结合当地建议施用石灰或有机质。" } },
  { tag: "alkaline_soil", severity: "warning", emoji: "🧂", label: { en: "Soil is too alkaline", zh: "土壤过碱" }, action: { en: "Add organic matter and choose tolerant crops.", zh: "增加有机质并选择耐碱作物。" } },
  { tag: "low_nutrient_risk", severity: "info", emoji: "🔬", label: { en: "NPK not measured", zh: "未测量 NPK" }, action: { en: "Nutrient advice is estimated until a lab test is done.", zh: "在实验室检测前，养分建议仅为估算。" } },
];

export function buildAlerts(diagnosis) {
  const now = new Date().toISOString();
  const alerts = [];
  for (const rule of RULES) {
    if (diagnosis.tags.includes(rule.tag)) {
      alerts.push({
        id: "alert-" + rule.tag,
        severity: rule.severity,
        cause: rule.tag,
        emoji: rule.emoji,
        time: now,
        label: rule.label,
        action: rule.action,
        dismissed: false,
      });
    }
  }
  for (let index = 0; index < diagnosis.warnings.length; index += 1) {
    const warning = diagnosis.warnings[index];
    alerts.push({
      id: "alert-warn-" + index,
      severity: "danger",
      cause: "sensor",
      emoji: "⚠️",
      time: now,
      label: { en: warning, zh: "传感器读数异常" },
      action: { en: "Please check the probe connection and calibration.", zh: "请检查探针连接与校准。" },
      dismissed: false,
    });
  }
  return alerts;
}