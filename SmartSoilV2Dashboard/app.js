import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js";
import { DEFAULT_READING, EXAMPLE_READING, buildResult } from "./soilLogic.js";

const form = document.querySelector("#reading-form");
const readingCards = document.querySelector("#reading-cards");
const payloadPreview = document.querySelector("#payload-preview");
const diagnosisTags = document.querySelector("#diagnosis-tags");
const diagnosisAdvice = document.querySelector("#diagnosis-advice");
const validationAlert = document.querySelector("#validation-alert");
const cropList = document.querySelector("#crop-list");
const adviceCard = document.querySelector("#advice-card");
let currentResult;
let currentLanguage = "en";
let selectedCropId;
let simDays = 35;
let simTimer;
let simOrbit = 0;

const plantModels = {
  rice: { maturity: 120, maxHeight: 1.05, leafColor: "#5e9f4b", darkLeaf: "#2f6d43" },
  banana: { maturity: 300, maxHeight: 3.2, leafColor: "#6da84f", darkLeaf: "#356d43" },
  taro: { maturity: 180, maxHeight: 1.15, leafColor: "#5f9b67", darkLeaf: "#315f50" },
  maize: { maturity: 100, maxHeight: 2.1, leafColor: "#78a94b", darkLeaf: "#3e713f" },
  chili: { maturity: 110, maxHeight: 0.8, leafColor: "#5c9c4d", darkLeaf: "#2f7043" },
  cucumber: { maturity: 75, maxHeight: 0.75, leafColor: "#70a95b", darkLeaf: "#356e47" },
};

const plantCanvas = document.querySelector("#plant-canvas");
const plantContext = null;
const simCropPicker = document.querySelector("#sim-crop-picker");
const growthRange = document.querySelector("#growth-days");
const growthDaysOutput = document.querySelector("#growth-days-output");
const playGrowthButton = document.querySelector("#play-growth");
const simLoadError = document.querySelector("#sim-load-error");
const rootsToggle = document.querySelector("#roots-toggle");
let showRoots = false;

function simClamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function simulationState(result) {
  if (!result?.crops?.length) return null;
  if (!result.crops.some((crop) => crop.id === selectedCropId)) selectedCropId = result.crops[0].id;
  const crop = result.crops.find((item) => item.id === selectedCropId) || result.crops[0];
  const model = plantModels[crop.id] || plantModels.rice;
  const scoreFactor = 0.72 + crop.score / 100 * 0.28;
  const progress = simClamp(simDays / model.maturity * scoreFactor, 0, 1);
  const height = model.maxHeight * (0.04 + progress * 0.96);
  const stage = progress < 0.14 ? "Seedling" : progress < 0.5 ? "Vegetative" : progress < 0.82 ? "Maturing" : "Harvest-ready";
  const stressed = crop.score < 70 || (result.tags.includes("waterlogged") && !crop.waterTolerant) || (result.tags.includes("heat_stress_risk") && !crop.heatTolerant);
  return { crop, model, progress, height, stage, stressed };
}

function drawLeaf(ctx, x, y, length, angle, width, light, dark) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const gradient = ctx.createLinearGradient(0, 0, length, 0);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(0.42, light);
  gradient.addColorStop(1, "rgba(255,255,255,.2)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.3, -width, length * 0.82, -width * 0.36);
  ctx.quadraticCurveTo(length, 0, length * 0.82, width * 0.25);
  ctx.quadraticCurveTo(length * 0.3, width * 0.65, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(27,80,53,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length * .9, 0); ctx.stroke();
  ctx.restore();
}

function drawRice(ctx, state, scale) {
  const count = 5;
  for (let index = 0; index < count; index += 1) {
    const x = (index - 2) * scale * 0.16;
    const top = -scale * (0.32 + state.progress * 0.63) * (0.9 + index % 2 * .08);
    ctx.strokeStyle = state.model.darkLeaf;
    ctx.lineWidth = Math.max(1.2, scale * .012);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x - 4, top * .55, x + (index - 2) * 3, top); ctx.stroke();
    drawLeaf(ctx, x, top * .72, scale * (.4 + state.progress * .42), -1.75 + index * .15, scale * .055, state.model.leafColor, state.model.darkLeaf);
    drawLeaf(ctx, x, top * .55, scale * (.32 + state.progress * .3), -.55 + index * .16, scale * .05, state.model.leafColor, state.model.darkLeaf);
    if (state.progress > .55) drawLeaf(ctx, x, top, scale * .15, -.1 + index * .05, scale * .08, "#d8c56b", "#8b8750");
  }
}

function drawBanana(ctx, state, scale) {
  const top = -scale * (.22 + state.progress * .7);
  const trunk = ctx.createLinearGradient(-scale * .07, 0, scale * .07, 0);
  trunk.addColorStop(0, "#547b47"); trunk.addColorStop(.5, "#9cae59"); trunk.addColorStop(1, "#3e6843");
  ctx.fillStyle = trunk;
  ctx.beginPath(); ctx.moveTo(-scale*.06, 0); ctx.quadraticCurveTo(-scale*.12, top*.55, -scale*.08, top); ctx.lineTo(scale*.1, top); ctx.quadraticCurveTo(scale*.12, top*.55, scale*.06, 0); ctx.fill();
  const leaves = 4 + Math.round(state.progress * 3);
  for (let i = 0; i < leaves; i += 1) {
    const angle = -2.7 + i * (5.4 / Math.max(leaves - 1, 1));
    drawLeaf(ctx, 0, top + (i % 2) * scale * .035, scale * (.38 + state.progress * .42), angle, scale * .16, state.model.leafColor, state.model.darkLeaf);
  }
}

function drawTaro(ctx, state, scale) {
  const leaves = 3 + Math.round(state.progress * 3);
  for (let i = 0; i < leaves; i += 1) {
    const angle = -2.7 + i * (5.4 / Math.max(leaves - 1, 1));
    const top = -scale * (.2 + state.progress * .54) * (0.88 + (i % 2) * .08);
    ctx.strokeStyle = state.model.darkLeaf; ctx.lineWidth = Math.max(1.4, scale * .018);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * scale * .2, top); ctx.stroke();
    drawLeaf(ctx, Math.cos(angle) * scale * .2, top, scale * (.3 + state.progress * .38), angle, scale * .2, state.model.leafColor, state.model.darkLeaf);
  }
}

function drawGenericPlant(ctx, state, scale) {
  const top = -scale * (.16 + state.progress * .72);
  ctx.strokeStyle = state.model.darkLeaf; ctx.lineWidth = Math.max(2, scale * .025);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(scale*.05, top*.5, 0, top); ctx.stroke();
  for (let i = 0; i < 4; i += 1) drawLeaf(ctx, 0, top * (.25 + i * .16), scale * (.25 + state.progress * .24), i % 2 ? -.35 : 3.48, scale * .09, state.model.leafColor, state.model.darkLeaf);
}

function drawPlantCanvas(result) {
  const state = simulationState(result);
  if (!state) return;
  const width = plantCanvas.clientWidth || 600;
  const height = plantCanvas.clientHeight || 330;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (plantCanvas.width !== Math.round(width * dpr) || plantCanvas.height !== Math.round(height * dpr)) {
    plantCanvas.width = Math.round(width * dpr); plantCanvas.height = Math.round(height * dpr);
  }
  const ctx = plantContext;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#7bb6a7"); sky.addColorStop(.63, "#d8e6ca"); sky.addColorStop(.64, "#6e9b5c"); sky.addColorStop(1, "#4f7549");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,239,181,.82)"; ctx.beginPath(); ctx.arc(width * .82, height * .18, 28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(49,108,78,.27)"; ctx.beginPath(); ctx.moveTo(0, height*.59); ctx.quadraticCurveTo(width*.24, height*.48, width*.5, height*.59); ctx.quadraticCurveTo(width*.76, height*.47, width, height*.59); ctx.lineTo(width, height*.72); ctx.lineTo(0, height*.72); ctx.fill();
  const groundY = height * .68;
  ctx.fillStyle = "#5a7b4b"; ctx.fillRect(0, groundY, width, height-groundY);
  ctx.fillStyle = "#795c3f"; ctx.fillRect(0, groundY + 18, width, height-groundY-18);
  ctx.fillStyle = "rgba(45,42,28,.25)"; ctx.fillRect(0, groundY + 48, width, 2);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  for (let i = 0; i < 24; i += 1) { const x = (i * 97) % width; const y = groundY + 25 + ((i * 31) % 80); ctx.fillRect(x, y, 2, 2); }
  ctx.fillStyle = "rgba(32,55,32,.28)"; ctx.beginPath(); ctx.ellipse(width/2, groundY + 4, 72 + state.progress*26, 13, 0, 0, Math.PI*2); ctx.fill();
  const scale = Math.min(width * .34, height * .73) * (0.88 + state.progress * .04);
  ctx.save();
  ctx.translate(width / 2, groundY + 4);
  const depth = .84 + Math.abs(Math.cos(simOrbit)) * .16;
  ctx.scale(depth, 1);
  if (state.crop.id === "rice") drawRice(ctx, state, scale);
  else if (state.crop.id === "banana") drawBanana(ctx, state, scale);
  else if (state.crop.id === "taro") drawTaro(ctx, state, scale);
  else drawGenericPlant(ctx, state, scale);
  ctx.restore();
  if (state.stressed && state.progress > .2) { ctx.fillStyle = "rgba(217,128,61,.9)"; ctx.font = "500 10px 'DM Mono'"; ctx.fillText("stress risk", 16, height - 17); }
}

// Small dependency-free software 3D renderer. It projects low-poly meshes into the
// canvas, so the plant remains draggable and works offline without a 3D library.
let simYaw = 0.35;
let simPitch = 0.08;
let simPointerDown = false;
let simLastPointerX = 0;
let simLastPointerY = 0;

function rotate3D(point) {
  const yawCos = Math.cos(simYaw); const yawSin = Math.sin(simYaw);
  let x = point.x * yawCos - point.z * yawSin;
  let z = point.x * yawSin + point.z * yawCos;
  const pitchCos = Math.cos(simPitch); const pitchSin = Math.sin(simPitch);
  const y = point.y * pitchCos - z * pitchSin;
  z = point.y * pitchSin + z * pitchCos;
  return { x, y, z };
}

function project3D(point, width, height, groundY) {
  const rotated = rotate3D(point);
  const camera = 5.2;
  const scale = Math.min(width, height) * 0.62 / (camera + rotated.z);
  return { x: width / 2 + rotated.x * scale, y: groundY - rotated.y * scale, depth: rotated.z };
}

function shadeHex(hex, amount) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  const r = simClamp(Math.round((number >> 16) * amount), 0, 255);
  const g = simClamp(Math.round(((number >> 8) & 255) * amount), 0, 255);
  const b = simClamp(Math.round((number & 255) * amount), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawMesh3D(ctx, vertices, faces, color, width, height, groundY) {
  const projected = vertices.map((point) => project3D(point, width, height, groundY));
  faces.map((face, index) => ({ face, index, depth: face.reduce((sum, vertexIndex) => sum + projected[vertexIndex].depth, 0) / face.length }))
    .sort((a, b) => b.depth - a.depth)
    .forEach(({ face, index }) => {
      ctx.beginPath();
      face.forEach((vertexIndex, pointIndex) => {
        const point = projected[vertexIndex];
        if (pointIndex === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.fillStyle = shadeHex(color, .78 + (index % 4) * .09);
      ctx.fill();
      ctx.strokeStyle = "rgba(25,67,42,.13)";
      ctx.lineWidth = .6;
      ctx.stroke();
    });
}

function makeEllipsoid(rx, ry, rz, cy, segments = 24, rings = 7) {
  const vertices = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = Math.PI * ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const theta = Math.PI * 2 * segment / segments;
      vertices.push({ x: rx * Math.sin(phi) * Math.cos(theta), y: cy + ry * Math.cos(phi), z: rz * Math.sin(phi) * Math.sin(theta) });
    }
  }
  const faces = [];
  for (let ring = 0; ring < rings; ring += 1) for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments; const a = ring * segments + segment; const b = ring * segments + next; const c = (ring + 1) * segments + next; const d = (ring + 1) * segments + segment;
    faces.push([a, b, c, d]);
  }
  return { vertices, faces };
}

function makeCylinder(height, radius, centerX = 0, centerZ = 0, segments = 8) {
  const vertices = [];
  for (const y of [0.03, height]) for (let i = 0; i < segments; i += 1) {
    const angle = Math.PI * 2 * i / segments;
    vertices.push({ x: centerX + Math.cos(angle) * radius, y, z: centerZ + Math.sin(angle) * radius });
  }
  const faces = [];
  for (let i = 0; i < segments; i += 1) faces.push([i, (i + 1) % segments, segments + (i + 1) % segments, segments + i]);
  return { vertices, faces };
}

function makeLeaf(base, angle, length, width, lift, droop = 0) {
  const direction = { x: Math.cos(angle), y: lift - droop, z: Math.sin(angle) };
  const side = { x: -Math.sin(angle) * width, y: 0, z: Math.cos(angle) * width };
  const mid = { x: base.x + direction.x * length * .52, y: base.y + direction.y * length * .52, z: base.z + direction.z * length * .52 };
  const tip = { x: base.x + direction.x * length, y: base.y + direction.y * length, z: base.z + direction.z * length };
  return { vertices: [base, { x: mid.x + side.x, y: mid.y + side.y, z: mid.z + side.z }, tip, { x: mid.x - side.x, y: mid.y - side.y, z: mid.z - side.z }], faces: [[0, 1, 2], [0, 2, 3]] };
}

function drawRing3D(ctx, width, height, groundY) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const angle = Math.PI * 2 * i / 48; const point = project3D({ x: Math.cos(angle) * 1.35, y: .035, z: Math.sin(angle) * .78 }, width, height, groundY);
    if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = "#55f083"; ctx.lineWidth = 3; ctx.shadowColor = "rgba(85,240,131,.65)"; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
}

function drawPlantCanvas3D(result) {
  const state = simulationState(result);
  if (!state) return;
  const width = plantCanvas.clientWidth || 600; const height = plantCanvas.clientHeight || 330; const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (plantCanvas.width !== Math.round(width * dpr) || plantCanvas.height !== Math.round(height * dpr)) { plantCanvas.width = Math.round(width * dpr); plantCanvas.height = Math.round(height * dpr); }
  const ctx = plantContext; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#eaf5fa"); sky.addColorStop(.66, "#f6faf7"); sky.addColorStop(.67, "#6d875c"); sky.addColorStop(1, "#617851"); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  const groundY = height * .69;
  ctx.fillStyle = "#6a8159"; ctx.beginPath(); ctx.moveTo(0, groundY + 3); ctx.quadraticCurveTo(width*.5, groundY - 46, width, groundY + 3); ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.arc(width*.8, height*.17, 23, 0, Math.PI*2); ctx.fill();
  const mound = makeEllipsoid(1.02, .34, .66, .2); drawMesh3D(ctx, mound.vertices, mound.faces, "#87663f", width, height, groundY);
  drawRing3D(ctx, width, height, groundY);
  const plantHeight = .17 + (state.height / 3.2) * 2.65; const stemRadius = state.crop.id === "banana" ? .075 : .035;
  const stem = makeCylinder(plantHeight, stemRadius, 0, 0, 9); drawMesh3D(ctx, stem.vertices, stem.faces, state.model.darkLeaf, width, height, groundY);
  const droop = state.stressed ? .18 : .03;
  const leafCount = Math.max(2, Math.round(3 + state.progress * 7));
  for (let i = 0; i < leafCount; i += 1) {
    const level = .27 + (i / leafCount) * .63; const angle = i * 2.399 + simOrbit * .03; let length; let leafWidth; let lift;
    if (state.crop.id === "banana") { length = .52 + state.progress * .85; leafWidth = .2 + state.progress * .15; lift = .16 - (i % 3) * .025; }
    else if (state.crop.id === "taro") { length = .42 + state.progress * .62; leafWidth = .24 + state.progress * .1; lift = .23; }
    else if (state.crop.id === "rice") { length = .38 + state.progress * .5; leafWidth = .06; lift = .4; }
    else { length = .36 + state.progress * .45; leafWidth = .11; lift = .25; }
    const base = { x: 0, y: plantHeight * level, z: 0 }; const leaf = makeLeaf(base, angle, length, leafWidth, lift, droop); drawMesh3D(ctx, leaf.vertices, leaf.faces, state.model.leafColor, width, height, groundY);
  }
  if (state.crop.id === "rice" && state.progress > .6) {
    for (let i = 0; i < 4; i += 1) { const grain = makeLeaf({ x: (i - 1.5) * .08, y: plantHeight * .92, z: 0 }, -1.4 + i * .3, .16, .09, .04); drawMesh3D(ctx, grain.vertices, grain.faces, "#d7bd68", width, height, groundY); }
  }
  if (state.stressed && state.progress > .18) { ctx.fillStyle = "rgba(159,83,42,.9)"; ctx.font = "500 10px 'DM Mono'"; ctx.fillText("stress risk", 16, height - 17); }
}

// Real WebGL 3D scene. The older canvas projection above is retained as a
// fallback reference, but the live simulation uses this Three.js scene.
const threeSceneState = { scene: null, camera: null, renderer: null, controls: null, plant: null, soil: null };

function createThreeLeaf(length, width, color, angle, droop = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(length * .24, width, length * .7, width * .48);
  shape.quadraticCurveTo(length, 0, length * .7, -width * .48);
  shape.quadraticCurveTo(length * .24, -width, 0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSegments: 1, bevelSize: .008, bevelThickness: .008 });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: 0, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  group.add(mesh);
  const veinMaterial = new THREE.LineBasicMaterial({ color: shadeHex(color, .58), transparent: true, opacity: .9 });
  const vein = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, .04), new THREE.Vector3(length * .48, 0, .04), new THREE.Vector3(length * .93, 0, .04)]), veinMaterial);
  group.add(vein);
  for (let i = 1; i <= 3; i += 1) {
    const x = length * (.18 + i * .18);
    const sideVein = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, .04), new THREE.Vector3(x + length * .12, width * .3, .04)]), veinMaterial);
    const otherSideVein = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, .04), new THREE.Vector3(x + length * .12, -width * .3, .04)]), veinMaterial);
    group.add(sideVein, otherSideVein);
  }
  group.rotation.y = angle;
  group.rotation.z = droop;
  return group;
}

function addThreePlantLeaf(group, height, angle, length, width, color, droop) {
  const leaf = createThreeLeaf(length, width, color, angle, droop);
  leaf.position.y = height;
  group.add(leaf);
}

function clearThreeGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((node) => { if (node.geometry) node.geometry.dispose(); if (node.material) node.material.dispose(); });
  }
}

function createThreeRoots(progress, color = "#b27a45") {
  const roots = new THREE.Group();
  const rootMaterial = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity: .92 });
  const count = Math.round(5 + progress * 8);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.399;
    const reach = .2 + progress * .58 + (i % 3) * .06;
    const points = [
      new THREE.Vector3(0, .39, 0),
      new THREE.Vector3(Math.cos(angle) * reach * .35, .2, Math.sin(angle) * reach * .35),
      new THREE.Vector3(Math.cos(angle) * reach * .72, .04, Math.sin(angle) * reach * .72),
      new THREE.Vector3(Math.cos(angle) * reach, -.12 - progress * .12, Math.sin(angle) * reach),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, .014 + progress * .012, 5, false), rootMaterial);
    root.castShadow = true; roots.add(root);
  }
  return roots;
}

function addThreeStemJoints(group, baseY, height, color) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .9 });
  for (let i = 1; i < 5; i += 1) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), material);
    joint.position.y = baseY + height * i / 5; joint.scale.set(1, .55, 1); group.add(joint);
  }
}

function addThreeMatureDetails(group, state, baseY, height) {
  if (state.progress < .58) return;
  if (state.crop.id === "banana") {
    const fruitMaterial = new THREE.MeshStandardMaterial({ color: "#e6bd42", roughness: .72 });
    for (let i = 0; i < 5; i += 1) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), fruitMaterial);
      fruit.scale.set(.7, 1.35, .7); fruit.position.set((i - 2) * .1, baseY + height * .93 - (i % 2) * .1, (i % 2) * .07); fruit.castShadow = true; group.add(fruit);
    }
  } else if (state.crop.id === "taro") {
    const corm = new THREE.Mesh(new THREE.SphereGeometry(.3, 18, 12), new THREE.MeshStandardMaterial({ color: "#8f704d", roughness: 1 }));
    corm.scale.set(1, .65, .8); corm.position.y = .08; corm.castShadow = true; group.add(corm);
  } else if (state.crop.id !== "rice") {
    const flower = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), new THREE.MeshStandardMaterial({ color: state.crop.id === "chili" ? "#d95743" : "#e6cf62", roughness: .8 }));
    flower.position.set(.16, baseY + height * .88, .05); group.add(flower);
  }
}

function createThreePlant(result) {
  const state = simulationState(result);
  if (!state || !threeSceneState.scene) return;
  if (threeSceneState.plant) { clearThreeGroup(threeSceneState.plant); threeSceneState.scene.remove(threeSceneState.plant); }
  const plant = new THREE.Group();
  const health = calculateHealth(result);
  const baseY = .38;
  const height = .16 + (state.height / 3.2) * 2.4;
  const stemRadius = state.crop.id === "banana" ? .075 : .035;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(stemRadius * .9, stemRadius, height, 12), new THREE.MeshStandardMaterial({ color: state.model.darkLeaf, roughness: .9 }));
  stem.position.y = baseY + height / 2; stem.castShadow = true; plant.add(stem);
  addThreeStemJoints(plant, baseY, height, state.model.darkLeaf);
  const roots = createThreeRoots(state.progress);
  roots.visible = showRoots;
  plant.add(roots);
  const droop = state.stressed ? .3 : .08;
  const count = Math.max(2, Math.round(3 + state.progress * 8));
  for (let i = 0; i < count; i += 1) {
    const level = .24 + i / count * .66;
    const angle = i * 2.399;
    let length; let width; let lift;
    if (state.crop.id === "banana") { length = .55 + state.progress * .9; width = .23 + state.progress * .14; lift = .11 - (i % 3) * .025; }
    else if (state.crop.id === "taro") { length = .45 + state.progress * .62; width = .3 + state.progress * .08; lift = .2; }
    else if (state.crop.id === "rice") { length = .38 + state.progress * .5; width = .055; lift = .34; }
    else { length = .34 + state.progress * .5; width = .12; lift = .2; }
    const leaf = createThreeLeaf(length, width, state.model.leafColor, angle, droop + (1 - level) * .08);
    leaf.position.set(0, baseY + height * level, 0);
    leaf.rotation.x = -lift;
    plant.add(leaf);
  }
  if (state.crop.id === "rice" && state.progress > .58) {
    const grainMaterial = new THREE.MeshStandardMaterial({ color: "#d8bd68", roughness: 1 });
    for (let i = 0; i < 5; i += 1) {
      const grain = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), grainMaterial);
      grain.position.set((i - 2) * .07, baseY + height * .96 + (i % 2) * .05, 0); plant.add(grain);
    }
  }
  addThreeMatureDetails(plant, state, baseY, height);
  plant.userData.baseRotation = plant.rotation.z;
  threeSceneState.plant = plant;
  threeSceneState.scene.add(plant);
  if (threeSceneState.soil) {
    threeSceneState.soil.material.color.set(health < 65 ? "#765333" : health < 80 ? "#80603b" : "#8b6941");
    threeSceneState.soil.material.transparent = showRoots;
    threeSceneState.soil.material.opacity = showRoots ? .58 : 1;
    threeSceneState.soil.material.depthWrite = !showRoots;
  }
}

function resizeThreeScene() {
  if (!threeSceneState.renderer) return;
  const width = plantCanvas.clientWidth || 600; const height = plantCanvas.clientHeight || 440;
  threeSceneState.renderer.setSize(width, height, false);
  threeSceneState.camera.aspect = width / height; threeSceneState.camera.updateProjectionMatrix();
}

function initThreeScene() {
  const width = plantCanvas.clientWidth || 600; const height = plantCanvas.clientHeight || 440;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeaf5fa); scene.fog = new THREE.Fog(0xeaf5fa, 7, 15);
  const camera = new THREE.PerspectiveCamera(34, width / height, .1, 30); camera.position.set(3.4, 2.5, 5.1);
  const renderer = new THREE.WebGLRenderer({ canvas: plantCanvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.15, 0); controls.enablePan = false; controls.minDistance = 3.1; controls.maxDistance = 7; controls.minPolarAngle = .55; controls.maxPolarAngle = 1.7; controls.enableDamping = true; controls.dampingFactor = .08;
  scene.add(new THREE.HemisphereLight(0xf5fff8, 0x65724c, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1c9, 3); sun.position.set(-3, 6, 4); sun.castShadow = true; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x6a8159, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true; scene.add(ground);
  const soil = new THREE.Mesh(new THREE.SphereGeometry(1.03, 32, 18), new THREE.MeshStandardMaterial({ color: 0x8b6941, roughness: 1 })); soil.scale.y = .36; soil.scale.z = .67; soil.position.y = .2; soil.castShadow = true; soil.receiveShadow = true; scene.add(soil);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.29, 1.33, 64), new THREE.MeshBasicMaterial({ color: 0x55f083, side: THREE.DoubleSide, transparent: true, opacity: .95 })); ring.rotation.x = -Math.PI / 2; ring.position.y = .035; scene.add(ring);
  threeSceneState.scene = scene; threeSceneState.camera = camera; threeSceneState.renderer = renderer; threeSceneState.controls = controls; threeSceneState.soil = soil;
  window.addEventListener("resize", resizeThreeScene);
}

function updateThreePlant(result) {
  try {
    if (!threeSceneState.renderer) initThreeScene();
    createThreePlant(result);
    simLoadError.hidden = true;
  } catch (error) {
    simLoadError.hidden = false;
    simLoadError.textContent = `3D engine error: ${error.message}`;
    console.error(error);
  }
}

function animateThreeScene(time) {
  if (threeSceneState.renderer) {
    if (threeSceneState.plant) threeSceneState.plant.rotation.z = Math.sin(time * .0012) * .012;
    threeSceneState.controls.update();
    threeSceneState.renderer.render(threeSceneState.scene, threeSceneState.camera);
  }
  requestAnimationFrame(animateThreeScene);
}

function renderSimulation(result) {
  const state = simulationState(result);
  if (!state) return;
  simCropPicker.innerHTML = result.crops.map((crop) => `<button type="button" class="sim-crop-button ${crop.id === state.crop.id ? "active" : ""}" data-sim-crop="${crop.id}">${crop.emoji} ${crop.name.split(" /")[0]}</button>`).join("");
  growthRange.value = simDays;
  growthDaysOutput.textContent = `${simDays} day${simDays === 1 ? "" : "s"}`;
  document.querySelector("#sim-stage-label").textContent = state.stage;
  document.querySelector("#sim-height").textContent = `${state.height.toFixed(2)} m`;
  document.querySelector("#sim-stage").textContent = state.stage;
  document.querySelector("#sim-fit").textContent = `${state.crop.score}% · ${state.crop.name}`;
  document.querySelector("#sim-status").textContent = state.stressed ? "The model is showing slower growth because this field has a stress risk for this crop." : "This crop is tracking well for the current soil reading.";
  document.querySelectorAll(".growth-stages span").forEach((stage, index) => {
    stage.classList.toggle("stage-done", state.progress >= [0.08, 0.22, 0.52, 0.82][index]);
    stage.classList.toggle("stage-current", state.progress < [0.08, 0.22, 0.52, 0.82][index] && (index === 0 || state.progress >= [0.08, 0.22, 0.52, 0.82][index - 1]));
  });
  updateThreePlant(result);
}

const scenarios = {
  demo: { ...EXAMPLE_READING },
  dry: { ...DEFAULT_READING, soilPH: 6.3, soilMoisture: 24, soilTemperature: 31, airHumidity: 62, rainfall: 2, nitrogen: 55, phosphorus: 35, potassium: 45 },
  acidic: { ...DEFAULT_READING, soilPH: 4.8, soilMoisture: 52, soilTemperature: 27, airHumidity: 72, rainfall: 8, nitrogen: 48, phosphorus: 30, potassium: 35 },
};

const fields = [
  { key: "soilPH", label: "Soil pH", icon: "◒", unit: "" },
  { key: "soilMoisture", label: "Moisture", icon: "◌", unit: "%" },
  { key: "soilTemperature", label: "Soil temp", icon: "⌁", unit: "°C" },
  { key: "airHumidity", label: "Humidity", icon: "◌", unit: "%" },
  { key: "rainfall", label: "Rainfall", icon: "⌇", unit: " mm" },
];

function readForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    ...data,
    soilPH: Number(data.soilPH), soilMoisture: Number(data.soilMoisture), soilTemperature: Number(data.soilTemperature), airHumidity: Number(data.airHumidity), rainfall: Number(data.rainfall),
    nitrogen: data.nitrogen === "" ? null : Number(data.nitrogen), phosphorus: data.phosphorus === "" ? null : Number(data.phosphorus), potassium: data.potassium === "" ? null : Number(data.potassium),
  };
}

function setForm(reading) {
  for (const [key, value] of Object.entries(reading)) {
    const field = form.elements[key];
    if (field && value != null) field.value = value;
  }
  updateOutputs();
}

function updateOutputs() {
  const values = readForm();
  document.querySelector("#soilPH-output").textContent = Number(values.soilPH).toFixed(1);
  document.querySelector("#soilMoisture-output").textContent = `${values.soilMoisture}%`;
  document.querySelector("#soilTemperature-output").textContent = `${values.soilTemperature}°C`;
  document.querySelector("#airHumidity-output").textContent = `${values.airHumidity}%`;
  document.querySelector("#rainfall-output").textContent = `${values.rainfall} mm`;
}

function renderReading(result) {
  const { reading } = result;
  readingCards.innerHTML = fields.map((field) => `<div class="reading-card"><div class="icon">${field.icon}</div><div class="label">${field.label}</div><div class="value">${reading[field.key]}${field.unit}</div></div>`).join("");
  payloadPreview.textContent = JSON.stringify(reading, null, 2);
  document.querySelector("#reading-time").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function calculateHealth(result) {
  let score = 100;
  const deductions = { acidic_soil: 10, alkaline_soil: 8, dry_soil: 10, waterlogged: 12, heat_stress_risk: 10, fungal_risk: 5 };
  result.tags.forEach((tag) => { score -= deductions[tag] || 0; });
  score -= result.warnings.length * 12;
  return simClamp(Math.round(score), 0, 100);
}

function renderDiagnosis(result) {
  const tagNames = {
    acidic_soil: ["Acidic soil", "warn"], good_ph: ["Good pH range", ""], alkaline_soil: ["Alkaline soil", "warn"], dry_soil: ["Dry soil", "warn"], workable_moisture: ["Workable moisture", ""], waterlogged: ["Waterlogged", "warn"], heat_stress_risk: ["Heat stress risk", "warn"], fungal_risk: ["Fungal risk", "warn"], slightly_acidic: ["Slightly acidic", ""],
  };
  diagnosisTags.innerHTML = result.tags.map((tag) => `<span class="tag ${tagNames[tag]?.[1] || ""}">${tagNames[tag]?.[0] || tag}</span>`).join("");
  diagnosisAdvice.textContent = result.advice.length ? result.advice.join(" ") : "The current reading is within the MVP operating ranges. It can proceed to crop suitability scoring.";
  validationAlert.innerHTML = result.warnings.length ? `<div class="validation-alert">⚠ ${result.warnings.join(" ")}</div>` : "";
  const health = calculateHealth(result);
  document.querySelector("#health-score").textContent = health;
  document.querySelector("#health-label").textContent = health >= 80 ? "Healthy" : health >= 60 ? "Needs attention" : "High risk";
  document.querySelector("#topbar-health").textContent = `${health}/100 · ${health >= 80 ? "Healthy" : health >= 60 ? "Needs attention" : "High risk"}`;
  document.querySelector("#health-ring").style.setProperty("--health-angle", `${health * 3.6}deg`);
  const focus = result.advice[0] || "Current conditions are within the prototype operating range.";
  document.querySelector("#diagnosis-alert").innerHTML = `<strong>ⓘ ${result.tags.includes("waterlogged") ? "Waterlogged soil" : result.tags.includes("alkaline_soil") ? "Alkaline soil" : result.tags.includes("acidic_soil") ? "Acidic soil" : "Healthy soil"}</strong><span>${focus}</span>`;
}

function renderCrops(result) {
  cropList.innerHTML = result.crops.map((crop, index) => `<article class="crop-card"><div class="crop-rank">0${index + 1} / TOP ${index + 1}</div><div class="crop-name">${crop.emoji} ${crop.name}</div><div class="crop-zh">${crop.zhName}</div><div class="crop-score">${crop.score}%</div><div class="score-bar"><i style="width:${crop.score}%"></i></div><div class="crop-reasons">${crop.reasons.slice(0, 3).map((reason) => `<span>+ ${reason}</span>`).join("")}</div></article>`).join("");
}

function renderAdvice(result) {
  adviceCard.textContent = result.advice[currentLanguage];
}

function render() {
  currentResult = buildResult(readForm());
  renderReading(currentResult);
  renderDiagnosis(currentResult);
  renderCrops(currentResult);
  renderSimulation(currentResult);
  renderAdvice(currentResult);
  const lastUpdated = document.querySelector("#last-updated");
  if (lastUpdated) lastUpdated.textContent = "Updated just now";
}

form.addEventListener("input", () => { updateOutputs(); render(); });
form.addEventListener("change", render);
document.querySelectorAll(".scenario-btn").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".scenario-btn").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  setForm(scenarios[button.dataset.scenario]);
  render();
}));
document.querySelectorAll(".language-btn").forEach((button) => button.addEventListener("click", () => {
  currentLanguage = button.dataset.language;
  document.querySelectorAll(".language-btn").forEach((item) => item.classList.toggle("active", item === button));
  renderAdvice(currentResult);
}));

simCropPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sim-crop]");
  if (!button) return;
  selectedCropId = button.dataset.simCrop;
  renderSimulation(currentResult);
});

rootsToggle.addEventListener("change", () => {
  showRoots = rootsToggle.checked;
  updateThreePlant(currentResult);
});

growthRange.addEventListener("input", () => {
  simDays = Number(growthRange.value);
  renderSimulation(currentResult);
});

function stopGrowth() {
  clearInterval(simTimer);
  simTimer = undefined;
  playGrowthButton.textContent = "▶ Play growth";
}

playGrowthButton.addEventListener("click", () => {
  if (simTimer) { stopGrowth(); return; }
  if (simDays >= 120) simDays = 0;
  playGrowthButton.textContent = "Ⅱ Pause growth";
  simTimer = setInterval(() => {
    simDays += 1;
    if (simDays >= 120) { simDays = 120; stopGrowth(); }
    renderSimulation(currentResult);
  }, 180);
});

document.querySelector("#reset-growth").addEventListener("click", () => {
  stopGrowth();
  simDays = 0;
  renderSimulation(currentResult);
});

function animateSimulation(time) {
  simOrbit = time / 1700;
  animateThreeScene(time);
}

setForm(EXAMPLE_READING);
render();
requestAnimationFrame(animateSimulation);

// When the Node adapter is running, accept the latest payload posted by an ESP32.
// The static demo remains fully usable when this endpoint is unavailable.
fetch("/api/readings")
  .then((response) => response.ok ? response.json() : null)
  .then((payload) => {
    if (payload?.reading) {
      setForm(payload.reading);
      render();
    }
  })
  .catch(() => undefined);
