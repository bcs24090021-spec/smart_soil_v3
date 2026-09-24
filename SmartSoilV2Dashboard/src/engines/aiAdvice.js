export function generateAdvice(result, language = "en") {
  const reading = result.reading;
  const tags = result.diagnosis?.tags || [];
  const top = result.crops?.[0];
  const second = result.crops?.[1];

  const wet = tags.includes("waterlogged");
  const humid = tags.includes("fungal_risk");
  const hot = tags.includes("heat_stress_risk");
  const acidic = tags.includes("slightly_acidic") || tags.includes("acidic_soil");

  if (language === "zh") {
    const lead = wet
      ? `您的土壤目前比较潮湿${acidic ? "，且呈微酸性" : ""}。`
      : acidic
        ? "您当前的土壤呈微酸性，湿度处于可工作范围。"
        : "您当前的土壤处于适宜的工作范围。";
    const topAdvice = top
      ? `${top.emoji} ${top.zhName}（${top.score}%）最受当前条件支持，因为它可以适应当前的湿度和 pH。`
      : "目前没有足够可靠的候选作物，建议先改善土壤条件。";
    const steps = [
      wet ? "先监测水位并检查排水。" : "种植前继续观察土壤变化。",
      hot ? "选择较凉爽的时段种植或适当推迟。" : "保持正常的种植时间安排。",
      humid ? "注意空气湿度，加强通风以降低真菌风险。" : "继续关注湿度和温度变化。",
      "pH 数据需要校准，施肥建议请结合当地农艺指导确认。",
    ];
    return { summary: `${lead}${topAdvice}`, steps };
  }

  const lead = wet
    ? `Your soil is currently quite wet${acidic ? " and slightly acidic" : ""}.`
    : acidic
      ? "Your soil is slightly acidic with workable moisture."
      : "Your soil currently has workable moisture and a near-neutral pH.";
  const topAdvice = top
    ? `${top.emoji} ${top.name} (${top.score}%) is the most suitable crop because it fits your current moisture and pH conditions.`
    : "There is no reliable crop candidate yet — improve the soil conditions first.";
  const secondLine = second
    ? `${second.name} is also possible, but check drainage first.`
    : "";

  const steps = [
    wet ? "Monitor the water level." : "Keep monitoring the soil moisture.",
    hot ? "Avoid the hottest planting window or delay sowing." : "Follow your normal planting schedule.",
    humid ? "Monitor humidity and improve airflow because fungal risk is elevated." : "Continue monitoring humidity and temperature.",
    "pH readings require calibration; verify recommendations with local agronomic guidance.",
  ];

  return { summary: `${lead} ${topAdvice} ${secondLine}`.trim(), steps };
}

const QUESTION_MATCHERS = [
  {
    keys: ["rice", "水稻", "why", "推荐", "recommend"],
    answer: (result, lang) => {
      const crop = result.crops?.find((item) => item.id === "rice");
      if (!crop) return lang === "zh" ? "当前条件下水稻未被列入推荐，因为湿度或 pH 不匹配。" : "Rice is not currently recommended for these conditions.";
      const reasons = crop.reasons.slice(0, 3).map((r) => `• ${r}`).join("\n");
      return lang === "zh"
        ? `水稻得分 ${crop.score}%，因为：\n${(crop.reasonsZh || crop.reasons).slice(0, 3).map((r) => `• ${r}`).join("\n")}\n主要风险：${(crop.risksZh || crop.risks).join("；") || "无"}\n种植前建议：${(crop.actionsZh || crop.actions).join("；")}`
        : `Rice scored ${crop.score}% because:\n${reasons}\nMain risks: ${crop.risks.join("; ") || "none"}\nBefore planting: ${crop.actions.join("; ")}`;
    },
  },
  {
    keys: ["water alert", "irrigat", "moisture", "浇水", "灌溉", "排水", "drainage"],
    answer: (result, lang) => {
      const m = result.reading.soilMoisture;
      if (lang === "zh")
        return m < 35
          ? `当前土壤湿度仅 ${m}%，偏干，建议种植前适度灌溉以提升墒情。`
          : m > 80
            ? `当前土壤湿度为 ${m}%，含水量偏高，请优先检查排水，避免积水影响根系。`
            : `当前土壤湿度为 ${m}%，处于适宜范围，维持现有水分管理即可。`;
      return m < 35
        ? `Soil moisture is ${m}% — on the dry side. Consider light irrigation before planting.`
        : m > 80
          ? `Soil moisture is ${m}% — quite wet. Prioritize checking drainage to avoid waterlogging.`
          : `Soil moisture is ${m}% — within the workable range. Maintain current moisture management.`;
    },
  },
  {
    keys: ["fertiliz", "dose", "施肥", "肥料", "用量"],
    answer: (result, lang) => {
      const r = result.reading;
      const measured = r.nitrogen != null && r.phosphorus != null && r.potassium != null;
      if (lang === "zh")
        return measured
          ? `当前 NPK 读数为氮 ${r.nitrogen}、磷 ${r.phosphorus}、钾 ${r.potassium}。最终施肥用量请以当地土壤检测为准，此为初步建议。`
          : "当前尚未测量 NPK 养分，施肥建议仅为估算——请在实验室检测后结合当地农艺指导确定用量。";
      return measured
        ? `Current NPK reading: N ${r.nitrogen}, P ${r.phosphorus}, K ${r.potassium}. Confirm the final dose with a local lab test — this is preliminary guidance.`
        : "Nutrients are not measured, so fertilizer guidance is estimated. Verify the dose with a local soil test.";
    },
  },
  {
    keys: ["improve", "改进", "改善", "better"],
    answer: (result, lang) => {
      const actions = result.alerts.filter((alert) => alert.severity !== "info").map((alert) => `• ${alert.action.en}`).join("\n");
      if (lang === "zh") {
        const zh = result.alerts.filter((alert) => alert.severity !== "info").map((alert) => `• ${alert.action.zh}`).join("\n");
        return `根据当前读数，改进建议：\n${zh || "• 继续监测土壤湿度、温度与湿度变化。"}\n请结合当地农艺指导确认。`;
      }
      return `Based on the current readings, recommended improvements:\n${actions || "• Keep monitoring soil conditions and maintain drainage."}\nConfirm with local agronomic guidance.`;
    },
  },
  {
    keys: ["stressed", "stress", "胁迫", "压力"],
    answer: (result, lang) => {
      const risks = result.predictions.filter((p) => p.level !== "LOW").map((p) => `• ${p.en} (${p.level})`).join("\n");
      if (lang === "zh") {
        const zhRisks = result.predictions.filter((p) => p.level !== "LOW").map((p) => `• ${p.zh}（${p.level}）`).join("\n");
        return `当前植物可能面临的胁迫（预测，非最终结果）：\n${zhRisks || "• 近期无明显胁迫。"}\n${result.health.levelZh}，健康评分 ${result.health.score}。`;
      }
      return `Predicted stress drivers (prediction, not guaranteed):\n${risks || "• No major pressure expected soon."}\nOverall plant health is ${result.health.level.toLowerCase()} at ${result.health.score}/100.`;
    },
  },
  {
    keys: ["rainfall", "rain", "降雨", "雨水"],
    answer: (result, lang) => {
      const rainfall = result.reading.rainfall;
      if (lang === "zh")
        return `当前降雨量为 ${rainfall} mm。若降雨增多，土壤水分会上升${result.reading.soilMoisture >= 75 ? "，这会使水涝风险升高，建议优先排水" : "，可能从干燥转为可种植状态"}。`;
      return `Current rainfall context is ${rainfall} mm. If rainfall increases, soil moisture rises${result.reading.soilMoisture >= 75 ? ", which raises waterlogging risk — improve drainage first" : " and may move the field from dry toward workable"}.`;
    },
  },
  {
    keys: ["safe", "safer", "安全", "which", "哪个", "crop", "作物"],
    answer: (result, lang) => {
      const top = result.crops.slice(0, 3).map((crop) => `• ${lang === "zh" ? crop.zhName : crop.name} — ${crop.score}% (${lang === "zh" ? crop.statusZh : crop.status})`).join("\n");
      if (lang === "zh") return `当前最安全的候选作物（按匹配度排序）：\n${top}\n以上为初步建议，请结合当地农艺指导。`;
      return `Safer crop options for this soil right now (best fit first):\n${top}\nPreliminary recommendation only — confirm locally.`;
    },
  },
];

export function answerQuestion(question, result, language = "en") {
  const text = String(question || "").toLowerCase();
  const base = "I can only answer using the probe's structured diagnosis and recommendations — I do not invent sensor measurements.";
  const zhBase = "我只能基于探针的已有诊断与作物建议回答，不会臆造传感器数据。";

  for (const matcher of QUESTION_MATCHERS) {
    if (matcher.keys.some((key) => text.includes(key))) {
      return {
        fallback: language === "zh" ? zhBase : base,
        answer: matcher.answer(result, language),
      };
    }
  }

  const top = result.crops?.[0];
  const fallbackAnswer =
    language === "zh"
      ? `我可以回答关于当前土壤的问题。例如：为什么推荐${top ? top.zhName : "某种作物"}？如何改善土壤？为什么植物会受胁迫？降雨增多会发生什么？\n${zhBase}`
      : `I can answer questions about the current soil, such as: why is ${top ? top.name : "a crop"} recommended, how can I improve this soil, why is my plant stressed, what happens if rainfall increases?\n${base}`;

  return { fallback: fallbackAnswer, answer: fallbackAnswer };
}