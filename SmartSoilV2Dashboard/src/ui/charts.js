export function drawLineChart(canvas, points, options = {}) {
  const opts = {
    color: "#24905c",
    label: "",
    unit: "",
    min: null,
    max: null,
    xFormat: (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ...options,
  };
  if (!canvas || !points.length) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.parentElement.getBoundingClientRect();
  let height = Number(canvas.dataset.logicalHeight);
  if (!height) {
    height = Number(canvas.getAttribute("height")) || 260;
    canvas.dataset.logicalHeight = String(height);
  }
  const width = Math.floor(canvas.clientWidth || rect.width || 600);
  height = Math.floor(height);
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 16, bottom: 36, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map((p) => p.value);
  const min = opts.min ?? Math.floor(Math.min(...values, 0));
  const max = opts.max ?? Math.ceil(Math.max(...values, 10));
  const range = Math.max(max - min, 1);
  const timestamps = points.map((p) => new Date(p.timestamp).getTime());
  const tMin = Math.min(...timestamps);
  const tMax = Math.max(...timestamps);
  const tSpan = Math.max(tMax - tMin, 1);

  const x = (p) => pad.left + ((p.timestampMs ?? new Date(p.timestamp).getTime()) - tMin) / tSpan * plotW;
  const y = (v) => pad.top + (1 - (v - min) / range) * plotH;

  // grid + y labels
  ctx.font = "13px 'DM Mono', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgba(120,130,120,0.18)";
  ctx.fillStyle = "rgba(18,28,24,0.95)";
  ctx.lineWidth = 1;
  const ticks = 4;
  for (let i = 0; i <= ticks; i += 1) {
    const value = min + (range / ticks) * i;
    const yy = y(value);
    ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(width - pad.right, yy); ctx.stroke();
    ctx.fillText(opts.unit ? `${Math.round(value)}${opts.unit}` : String(Math.round(value)), pad.left - 8, yy);
  }

  // x labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 4; i += 1) {
    const t = tMin + (tSpan / 4) * i;
    ctx.fillText(opts.xFormat(t), pad.left + (tSpan / 4 * i) / tSpan * plotW, height - pad.bottom + 8);
  }

  // fill + line
  const lineX = points.map((p) => ({ x: x(p), y: y(p.value), raw: p }));
  ctx.beginPath();
  lineX.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.lineTo(lineX[lineX.length - 1].x, pad.top + plotH);
  ctx.lineTo(lineX[0].x, pad.top + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, opts.color + "44");
  grad.addColorStop(1, opts.color + "00");
  ctx.fillStyle = grad;
  ctx.fill();

  // last value dot
  const last = lineX[lineX.length - 1];
  ctx.beginPath(); ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = opts.color; ctx.fill();
  ctx.beginPath(); ctx.arc(last.x, last.y, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = opts.color + "33"; ctx.fill();

  // hover
  canvas.dataset.chartData = JSON.stringify(lineX.map((p) => ({ x: p.x, y: p.y, v: p.raw.value, t: p.raw.timestamp })));
  canvas.parentElement.style.position = "relative";
  bindHover(canvas, opts);
}

function bindHover(canvas, opts) {
  let tooltip = canvas.parentElement.querySelector(".chart-tip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tip";
    tooltip.style.cssText = "position:absolute;pointer-events:none;background:rgba(20,35,27,.92);color:#fff;font:600 14px 'DM Mono';padding:6px 10px;border-radius:8px;transform:translate(-50%,-130%);display:none;white-space:nowrap;z-index:5;";
    canvas.parentElement.appendChild(tooltip);
  }
  const points = JSON.parse(canvas.dataset.chartData || "[]");
  if (!points.length) return;
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    let nearest = points[0];
    let dist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.x - px);
      if (d < dist) { dist = d; nearest = p; }
    }
    tooltip.style.display = "block";
    tooltip.style.left = `${nearest.x}px`;
    tooltip.style.top = `${nearest.y}px`;
    tooltip.textContent = `${new Date(nearest.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · ${opts.unit ? `${nearest.v}${opts.unit}` : nearest.v}`;
  };
  canvas.onmouseleave = () => { tooltip.style.display = "none"; };
}

export function sparkline(canvas, data, color = "#24905c") {
  if (!canvas || !data.length) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || 120;
  const height = canvas.clientHeight || 34;
  if (canvas.width !== Math.floor(width * dpr)) { canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const values = data.map(Number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  ctx.beginPath();
  values.forEach((v, i) => {
    const xx = (i / (values.length - 1)) * width;
    const yy = height - 3 - ((v - min) / range) * (height - 6);
    i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}