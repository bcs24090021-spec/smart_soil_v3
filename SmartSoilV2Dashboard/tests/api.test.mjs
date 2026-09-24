import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 4181;
const base = `http://localhost:${port}`;

const server = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});

function waitForBoot() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not boot in time")), 10000);
    server.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("running at")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function json(path, options) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
}

let teardown = null;

try {
  await waitForBoot();

  const health = await json("/api/healthz");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);

  const dashboard = await json("/api/dashboard");
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.zone, "zone-a");
  assert.ok(dashboard.body.result.reading.soilMoisture >= 0);
  assert.equal(dashboard.body.result.crops.length, 3);
  assert.ok(dashboard.body.result.health.score >= 0);

  const history = await json("/api/sensor/history?hours=24");
  assert.equal(history.status, 200);
  assert.ok(history.body.series.length > 0);
  assert.ok(typeof history.body.series[0].health.score === "number");

  const sim = await json("/api/simulation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes: { soilMoisture: 45 } }),
  });
  assert.equal(sim.status, 200);
  assert.ok(sim.body.afterResult.crops.length === 3);

  const chat = await json("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "Which crop is safer?", language: "zh" }),
  });
  assert.equal(chat.status, 200);
  assert.ok(chat.body.answer.answer.length > 0);

  const postReading = await json("/api/readings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: "probe-001",
      soilPH: 5.6,
      soilMoisture: 82,
      soilTemperature: 29,
      airHumidity: 88,
      rainfall: 12,
      source: "esp32",
    }),
  });
  assert.equal(postReading.status, 200);
  assert.equal(postReading.body.reading.deviceId, "probe-001");
  assert.equal(postReading.body.result.source, "esp32");
  assert.ok(postReading.body.result.diagnosis.tags.includes("waterlogged"));

  const alerts = await json("/api/alerts");
  assert.equal(alerts.status, 200);
  assert.ok(Array.isArray(alerts.body.alerts));
  const firstId = alerts.body.alerts[0]?.id;
  if (firstId) {
    const dismiss = await json(`/api/alerts/${encodeURIComponent(firstId)}/dismiss`, { method: "POST" });
    assert.equal(dismiss.status, 200);
    const afterDismiss = await json("/api/alerts");
    assert.equal(afterDismiss.body.alerts.find((a) => a.id === firstId)?.dismissed, true);
  }

  const sse = await fetch(`${base}/api/stream`);
  const reader = sse.body.getReader();
  const { value } = await reader.read();
  const firstChunk = new TextDecoder().decode(value);
  assert.ok(firstChunk.includes("event: hello"), "SSE should emit a hello event");
  reader.cancel();

  console.log("api tests passed");
} finally {
  server.kill();
}