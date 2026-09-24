export function timeAgo(iso, lang = "en") {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return lang === "zh" ? "刚刚" : "just now";
  if (seconds < 60) return lang === "zh" ? `${seconds} 秒前` : `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  return lang === "zh" ? `${minutes} 分钟前` : `${minutes} min ago`;
}

export function greeting(lang = "en") {
  const hour = new Date().getHours();
  if (hour < 12) return lang === "zh" ? "早上好" : "Good morning";
  if (hour < 18) return lang === "zh" ? "下午好" : "Good afternoon";
  return lang === "zh" ? "晚上好" : "Good evening";
}

export function formatTime(iso, lang = "en") {
  try {
    return new Date(iso).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function dayNightEmoji(iso) {
  try {
    const hour = new Date(iso).getHours();
    return hour >= 6 && hour < 18 ? "☀️" : "🌙";
  } catch {
    return "🌙";
  }
}

export function riskLabel(level) {
  return level === "HIGH" ? "高" : level === "MEDIUM" ? "中" : "低";
}

export function levelPill(level, lang) {
  const label = lang === "zh" ? riskLabel(level) : level;
  return `<span class="level-pill ${level}">${label}</span>`;
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

export function gaugeClass(score) {
  return score >= 80 ? "ok" : score >= 60 ? "warn" : "danger";
}