import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReading, validateReading } from "./src/engines/validate.js";
import { buildPipeline } from "./src/engines/pipeline.js";
import { simulateScenario } from "./src/engines/simulation.js";
import { generateAdvice, answerQuestion } from "./src/engines/aiAdvice.js";
import { calculatePlantHealth } from "./src/engines/health.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const state = {
  source: "sim",
  latestReading: null,
  history: seedHistory(),
  dismissedAlerts: new Set(),
  sseClients: new Set(),
};

seedLatest();

function seedHistory() {
  const entries = [];
  const now = Date.now();
  const step = 15 * 60 * 1000;
  const count = 30 * 24 * 4; // ~30 days of 15-minute readings
  let seed = 42;
  const rnd = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  for (let index = 0; index < count; index += 1) {
    const day = index / 96;
    const daily = Math.sin((index * 2 * Math.PI) / 96);
    const moisture = 62 + 14 * Math.sin(day / 9) + daily * 3 + (rnd() - 0.5) * 9;
    const rainfall = rnd() > 0.88 ? 15 + rnd() * 35 : 4 + rnd() * 6;
    const reading = {
      deviceId: "probe-001",
      location: "demo-field",
      soilPH: 5.9 + (rnd() - 0.5) * 0.5,
      soilMoisture: clamp(moisture, 18, 92),
      soilTemperature: 28.5 + daily * 2.4 + (rnd() - 0.5) * 2,
      airHumidity: 74 + (rnd() - 0.5) * 16,
      rainfall,
      nitrogen: 70,
      phosphorus: 45,
      potassium: 40,
    };
    entries.push({ reading, timestamp: new Date(now - (count - index) * step).toISOString() });
  }
  return entries;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seedLatest() {
  if (!state.latestReading && state.history.length) state.latestReading = state.history[state.history.length - 1].reading;
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) reject(new Error("Payload too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readJson(request, response) {
  try {
    return JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 400, { ok: false, error: "Invalid JSON body" });
    return null;
  }
}

function latestResult() {
  return buildPipeline(state.latestReading, { source: state.source });
}

function pushReading(body, source) {
  const { reading, warnings } = validateReading(body);
  state.latestReading = reading;
  state.source = source;
  state.history.push({ reading, timestamp: new Date().toISOString() });
  if (state.history.length > 5000) state.history.shift();
  const result = buildPipeline(reading, { source });
  return { reading, warnings, result };
}

function broadcast(payload) {
  const message = `event: reading\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of state.sseClients) {
    try {
      client.write(message);
    } catch {
      state.sseClients.delete(client);
    }
  }
}

function historyWindow(hours) {
  const ms = hours * 60 * 60 * 1000;
  const cutoff = Date.now() - ms;
  return state.history.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff);
}

function seriesFor(hours, date = "") {
  let entries;
  if (date) {
    const anchor = new Date(`${date}T23:59:59`).getTime();
    const cutoff = anchor - hours * 60 * 60 * 1000;
    entries = state.history.filter((entry) => {
      const t = new Date(entry.timestamp).getTime();
      return t >= cutoff && t <= anchor;
    });
  } else {
    entries = historyWindow(hours);
  }
  return entries.map((entry) => ({
    timestamp: entry.timestamp,
    reading: entry.reading,
    health: calculatePlantHealth(entry.reading),
  }));
}

function zonesPayload() {
  return [
    { id: "zone-a", name: "Zone A", farmId: "farm-1" },
    { id: "zone-b", name: "Zone B", farmId: "farm-1" },
    { id: "zone-c", name: "Zone C", farmId: "farm-1" },
  ];
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const path = url.pathname;
  const method = request.method;

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return response.end();
  }

  const api = path.startsWith("/api");

  if (api && method === "GET" && path === "/api/stream") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    response.write(`event: hello\ndata: {"hello":true}\n\n`);
    state.sseClients.add(response);
    request.on("close", () => state.sseClients.delete(response));
    return;
  }

  if (api && method === "GET" && path === "/api/dashboard") {
    const result = latestResult();
    return sendJson(response, 200, { zone: "zone-a", zones: zonesPayload(), reading: result.reading, result });
  }

  if (api && method === "GET" && path === "/api/sensor/latest") {
    const result = latestResult();
    return sendJson(response, 200, { reading: result.reading, result, source: state.source });
  }

  if (api && method === "GET" && path === "/api/sensor/history") {
    const hours = Number(url.searchParams.get("hours") || 24);
    const date = url.searchParams.get("date") || "";
    return sendJson(response, 200, { hours, date: date || null, series: seriesFor(hours, date) });
  }

  if (api && method === "POST" && (path === "/api/sensor/readings" || path === "/api/readings")) {
    const body = await readJson(request, response);
    if (!body) return;
    const source = body.source === "sim" ? "sim" : "esp32";
    const { reading, result } = pushReading(body, source);
    broadcast({ reading, result, source });
    return sendJson(response, 200, { ok: true, reading, result });
  }

  if (api && method === "GET" && path === "/api/diagnosis/latest") {
    const result = latestResult();
    return sendJson(response, 200, { reading: result.reading, diagnosis: result.diagnosis });
  }

  if (api && method === "POST" && path === "/api/diagnosis") {
    const body = await readJson(request, response);
    if (!body) return;
    const { reading, warnings } = validateReading(body);
    return sendJson(response, 200, { reading, diagnosis: buildPipeline(reading, { source: state.source }).diagnosis, warnings });
  }

  if (api && method === "GET" && path === "/api/crops/recommendations") {
    const result = latestResult();
    return sendJson(response, 200, { crops: result.crops, allCrops: result.allCrops, confidence: result.confidence });
  }

  if (api && method === "POST" && path === "/api/simulation") {
    const body = await readJson(request, response);
    if (!body) return;
    const simulation = simulateScenario(state.latestReading, body.changes || {});
    const afterResult = buildPipeline(simulation.after, { source: "sim" });
    return sendJson(response, 200, { simulation, afterResult });
  }

  if (api && method === "POST" && path === "/api/ai/advice") {
    const body = await readJson(request, response);
    if (!body) return;
    const result = latestResult();
    const language = body.language === "zh" ? "zh" : "en";
    const advice = body.simulated
      ? generateAdvice({ ...result, reading: body.simulated }, language)
      : result.advice[language];
    return sendJson(response, 200, { advice, language, disclaimer: true });
  }

  if (api && method === "POST" && path === "/api/ai/chat") {
    const body = await readJson(request, response);
    if (!body) return;
    const result = latestResult();
    const language = body.language === "zh" ? "zh" : "en";
    return sendJson(response, 200, { answer: answerQuestion(body.question || "", result, language) });
  }

  if (api && method === "GET" && path === "/api/alerts") {
    const result = latestResult();
    const alerts = result.alerts.map((alert) => ({ ...alert, dismissed: state.dismissedAlerts.has(alert.id) || alert.dismissed }));
    return sendJson(response, 200, { alerts });
  }

  if (api && method === "POST" && path.startsWith("/api/alerts/") && path.endsWith("/dismiss")) {
    const id = path.split("/")[3];
    state.dismissedAlerts.add(id);
    return sendJson(response, 200, { ok: true });
  }

  if (api && method === "GET" && path === "/api/zones") {
    return sendJson(response, 200, { zones: zonesPayload() });
  }

  if (api && method === "GET" && path === "/api/mode") {
    return sendJson(response, 200, { mode: state.source });
  }

  if (api && method === "POST" && path === "/api/mode") {
    const body = await readJson(request, response);
    if (!body) return;
    state.source = body.mode === "esp32" ? "esp32" : "sim";
    return sendJson(response, 200, { ok: true, mode: state.source });
  }

  if (api && method === "GET" && path === "/api/healthz") {
    return sendJson(response, 200, { ok: true, uptime: process.uptime() });
  }

  if (api) {
    return sendJson(response, 404, { error: "Not found" });
  }

  if (method !== "GET" && method !== "HEAD") {
    response.writeHead(405);
    return response.end();
  }

  const requested = path === "/" ? "/index.html" : path;
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  try {
    const file = await readFile(filePath);
    const headers = { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" };
    if ([".js", ".mjs", ".css", ".html", ".json"].includes(extname(filePath))) {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    }
    response.writeHead(200, headers);
    return method === "HEAD" ? response.end() : response.end(file);
  } catch {
    response.writeHead(404);
    return response.end("Not found");
  }
});

server.listen(port, () => console.log(`Smart Soil Probe AI running at http://localhost:${port}`));