import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ============================================================
   Smart Soil — 3D crop model
   Low-poly, single crop plant growing from a translucent soil
   cross-section block. Roots, stem, leaves + veins all visible.
   Condition can be switched programmatically (healthy / wilted /
   dry / overwatered / nutrient / pest / disease / heat).
   ============================================================ */

const SOIL_TOP = 0.95;
const SOIL = { w: 2.2, h: 0.9, d: 1.6 };

// deterministic pseudo-random by seed (stable across rebuilds)
function rng(seed) {
  const s = Math.sin(seed * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
}
function pick(seed, arr) {
  return arr[Math.floor(rng(seed) * arr.length) % arr.length];
}

const CONDITIONS = {
  healthy: {
    label: "healthy",
    leaf: 0x3f9e55, leafVar: 0x56b268, dull: 0.0,
    vein: 0x1f6b35,
    stem: 0x2f7a3d,
    soil: 0x6b4f33, soilTop: 0x5f462b, soilGloss: 0,
    root: 0xb48150,
    droop: 0.05, curl: 0.0, bend: 0.02,
    spots: 0, holes: 0, bugs: 0, pale: 0, edge: 0,
  },
  wilted: {
    label: "wilted",
    leaf: 0x3a6b42, leafVar: 0x4a7a46, dull: 0.3,
    vein: 0x2a5233,
    stem: 0x2e5c33,
    soil: 0x8a744a, soilTop: 0x7d693f, soilGloss: 0,
    root: 0x9a7247,
    droop: 0.55, curl: 0.12, bend: 0.16,
    spots: 0, holes: 0, bugs: 0, pale: 0, edge: 0.2,
  },
  dry: {
    label: "dry",
    leaf: 0x8d8a4a, leafVar: 0x7d7e40, dull: 0.35,
    vein: 0x6b5f33,
    stem: 0x6a6a3a,
    soil: 0x9a7f4e, soilTop: 0x8c6f3f, soilGloss: 0,
    root: 0x8f704a,
    droop: 0.32, curl: 0.55, bend: 0.08,
    spots: 0, holes: 0, bugs: 0, pale: 0.4, edge: 0.7,
  },
  overwatered: {
    label: "overwatered",
    leaf: 0x3b7a46, leafVar: 0x9aab52, dull: 0.15,
    vein: 0x1f5c31,
    stem: 0x2c6a38,
    soil: 0x2e2620, soilTop: 0x241e18, soilGloss: 1,
    root: 0x5f3a2a,
    droop: 0.28, curl: 0.06, bend: 0.06,
    spots: 0, holes: 0, bugs: 0, pale: 0.35, edge: 0,
  },
  nutrient: {
    label: "nutrient",
    leaf: 0xb7c86a, leafVar: 0xc9cf7a, dull: 0.2,
    vein: 0x2f7a3d, // veins stay green -> chlorosis between veins
    stem: 0x6f8a3a,
    soil: 0x6f5a3a, soilTop: 0x635030, soilGloss: 0,
    root: 0x8f7a52,
    droop: 0.1, curl: 0.12, bend: 0.03,
    spots: 0, holes: 0, bugs: 0, pale: 0.8, edge: 0.3,
  },
  pest: {
    label: "pest",
    leaf: 0x5d8f4a, leafVar: 0x6f9a54, dull: 0.25,
    vein: 0x336b35,
    stem: 0x4d7a3c,
    soil: 0x7a5f3c, soilTop: 0x6f5534, soilGloss: 0,
    root: 0x8f6a44,
    droop: 0.08, curl: 0.05, bend: 0.03,
    spots: 0.6, holes: 0.45, bugs: 3, pale: 0.1, edge: 0,
  },
  disease: {
    label: "disease",
    leaf: 0x67734c, leafVar: 0x7a7a52, dull: 0.4,
    vein: 0x3a4a2b,
    stem: 0x4c5c36,
    soil: 0x6b4b2e, soilTop: 0x5c4030, soilGloss: 0,
    root: 0x6f4a34,
    droop: 0.2, curl: 0.18, bend: 0.08,
    spots: 1, holes: 0.2, bugs: 0, pale: 0.25, edge: 0.2,
  },
  heat: {
    label: "heat",
    leaf: 0xa8a14a, leafVar: 0x8f8a3f, dull: 0.3,
    vein: 0x7a6a35,
    stem: 0x7a6a38,
    soil: 0x9a7f4e, soilTop: 0x8c6f3f, soilGloss: 0,
    root: 0x8f704a,
    droop: 0.18, curl: 0.5, bend: 0.05,
    spots: 0, holes: 0, bugs: 0, pale: 0.4, edge: 0.8,
  },
};

// Priority order — first match wins, from reading values.
function plantCondition(reading) {
  const m = reading.soilMoisture ?? 50;
  const t = reading.soilTemperature ?? 25;
  const h = reading.airHumidity ?? 60;
  const npk = [reading.nitrogen, reading.phosphorus, reading.potassium];
  if (t >= 36) return "heat";
  if (m > 82) return "overwatered";
  if (m < 22) return "dry";
  if (m < 34) return "wilted";
  if (npk.some((n) => n != null && n < 18)) return "nutrient";
  if (h > 85) return "disease";
  if (h >= 75) return "pest";
  return "healthy";
}

function conditionSeverity(reading) {
  const m = reading.soilMoisture ?? 50;
  const t = reading.soilTemperature ?? 25;
  const h = reading.airHumidity ?? 60;
  let sev = 0;
  if (m < 14 || m > 92) sev += 2;
  else if (m < 28 || m > 84) sev += 1;
  if (t > 39) sev += 1;
  if (h > 90) sev += 1;
  return Math.min(sev, 3);
}

export class DigitalTwin {
  constructor(canvas) {
    this.canvas = canvas;
    this.disposed = false;
    this.leafNodes = [];
    this.condition = "healthy";
    this.severity = 0;
    this.health = 80;

    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 380;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb8d8cd);
    scene.fog = new THREE.Fog(0xb8d8cd, 10, 20);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
    camera.position.set(3.8, 2.7, 5.4);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enablePan = false;
    controls.minDistance = 3.6;
    controls.maxDistance = 10;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = 1.62;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.HemisphereLight(0xf5fff8, 0x6d7d5e, 2.0));
    const sun = new THREE.DirectionalLight(0xfff1c9, 3.0);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfe3ff, 0.7);
    fill.position.set(4, 2, -3);
    scene.add(fill);

    this.buildGround(scene);
    this.buildSoil(scene);

    this.plant = new THREE.Group();
    scene.add(this.plant);
    this.roots = new THREE.Group();
    scene.add(this.roots);

    // humidity mist FX
    const mistCount = 140;
    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i += 1) {
      mistPos[i * 3] = (Math.random() - 0.5) * 3.4;
      mistPos[i * 3 + 1] = 0.6 + Math.random() * 2.6;
      mistPos[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
    }
    mistGeo.setAttribute("position", new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.PointsMaterial({ color: 0xeaf7ef, size: 0.05, transparent: true, opacity: 0, depthWrite: false });
    const mist = new THREE.Points(mistGeo, mistMat);
    this.mist = mist;
    scene.add(mist);

    // rain FX
    const rainCount = 110;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i += 1) this.resetRain(i, rainPos);
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.045, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.Points(rainGeo, rainMat);
    this.rainMat = rainMat;
    this.rainPos = rainPos;
    this.rainTime = Math.random() * 3;
    scene.add(this.rain);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement || canvas);

    this.animating = true;
    this.animateId = requestAnimationFrame((t) => this.animate(t));
  }

  /* ---------- static field + soil environment ---------- */

  buildGround(scene) {
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x8a9a70, roughness: 1 })
    );
    field.rotation.x = -Math.PI / 2;
    field.position.y = 0;
    field.receiveShadow = true;
    scene.add(field);

    const furrowMat = new THREE.MeshStandardMaterial({ color: 0x6f7d55, roughness: 1 });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x77703f, roughness: 1 });
    for (let i = 0; i < 7; i += 1) {
      const furrow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 30), furrowMat);
      furrow.position.set(-9 + i * 3, 0.018, 0);
      furrow.rotation.y = (Math.random() - 0.5) * 0.06;
      scene.add(furrow);
    }
    for (let i = 0; i < 8; i += 1) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.6 + rng(i) * 0.6, 10), dirtMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(-12 + rng(i * 3) * 24, 0.012, -12 + rng(i * 7) * 24);
      scene.add(patch);
    }

    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4f7a45, roughness: 1 });
    const tuftMatDark = new THREE.MeshStandardMaterial({ color: 0x3f6a36, roughness: 1 });
    for (let i = 0; i < 40; i += 1) {
      const angle = (i / 40) * Math.PI * 2 + rng(i + 1) * 0.4;
      const radius = 1.6 + rng(i + 2) * 2.2;
      const tuft = new THREE.Mesh(
        new THREE.ConeGeometry(0.06 + rng(i + 3) * 0.05, 0.18 + rng(i + 4) * 0.2, 5),
        i % 3 ? tuftMat : tuftMatDark
      );
      tuft.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius);
      tuft.rotation.z = (rng(i + 5) - 0.5) * 0.25;
      tuft.castShadow = true;
      scene.add(tuft);
    }
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8374, roughness: 1 });
    for (let i = 0; i < 12; i += 1) {
      const angle = rng(i + 6) * Math.PI * 2;
      const radius = 1.2 + rng(i + 7) * 2.1;
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.035 + rng(i + 8) * 0.04, 6, 5), pebbleMat);
      pebble.scale.y = 0.5;
      pebble.position.set(Math.cos(angle) * radius, 0.03, Math.sin(angle) * radius);
      pebble.rotation.y = rng(i + 9) * Math.PI;
      scene.add(pebble);
    }
  }

  makeSoilTexture() {
    const size = 256;
    const canv = document.createElement("canvas");
    canv.width = size;
    canv.height = size;
    const ctx = canv.getContext("2d");
    ctx.fillStyle = "#6b4f33";
    ctx.fillRect(0, 0, size, size);
    const speckles = ["#5a422a", "#7d5f3d", "#8a6a44", "#4e381f"];
    for (let i = 0; i < 700; i += 1) {
      const r = rng(i * 11) * size;
      const g = rng(i * 13) * size;
      ctx.fillStyle = pick(i * 17, speckles);
      ctx.globalAlpha = 0.25 + rng(i * 19) * 0.4;
      ctx.beginPath();
      ctx.arc(r, g, 0.6 + rng(i * 23) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, "rgba(40,25,10,0.28)");
    grad.addColorStop(0.28, "rgba(40,25,10,0)");
    grad.addColorStop(1, "rgba(25,18,8,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  /* ---------- soil cross-section ---------- */

  buildSoil(scene) {
    this.soilMat = new THREE.MeshStandardMaterial({
      map: this.makeSoilTexture(),
      color: 0x6b4f33,
      roughness: 1,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const soil = new THREE.Mesh(new THREE.BoxGeometry(SOIL.w, SOIL.h, SOIL.d), this.soilMat);
    soil.position.y = SOIL.h / 2;
    soil.castShadow = true;
    scene.add(soil);

    // opaque top slab (solid planting surface)
    this.soilTopMat = new THREE.MeshStandardMaterial({
      map: this.makeSoilTexture(),
      color: 0xc0aaff,
      roughness: 1,
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(SOIL.w - 0.14, 0.07, SOIL.d - 0.14), this.soilTopMat);
    cap.position.y = SOIL.h + 0.035;
    cap.receiveShadow = true;
    scene.add(cap);

    this.clods = [];
    const clodMat = new THREE.MeshStandardMaterial({ map: this.makeSoilTexture(), color: 0xccbbbb, roughness: 1 });
    for (let i = 0; i < 6; i += 1) {
      const clod = new THREE.Mesh(new THREE.SphereGeometry(0.08 + rng(i + 3) * 0.06, 7, 6), clodMat);
      const a = (i / 6) * Math.PI * 2;
      clod.position.set(Math.cos(a) * 0.6 + (rng(i + 5) - 0.5) * 0.4, SOIL.h + 0.1, Math.sin(a) * 0.45 + (rng(i + 7) - 0.5) * 0.4);
      clod.scale.y = 0.55;
      clod.castShadow = true;
      scene.add(clod);
      this.clods.push(clod);
    }

    const capRim = new THREE.Mesh(
      new THREE.BoxGeometry(SOIL.w - 0.08, 0.03, SOIL.d - 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8a6b47, roughness: 0.9 })
    );
    capRim.position.y = SOIL.h + 0.02;
    scene.add(capRim);

    this.rootMat = new THREE.MeshStandardMaterial({ color: CONDITIONS.healthy.root, roughness: 1 });
  }

  resetRain(i, array) {
    array[i * 3] = (Math.random() - 0.5) * 3.6;
    array[i * 3 + 1] = Math.random() * 3.6;
    array[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
  }

  /* ---------- condition API ---------- */

  setReading(result) {
    const reading = result.reading;
    const name = plantCondition(reading);
    const severity = conditionSeverity(reading);
    this.applyCondition(name, severity, reading, result.health?.score);
  }

  // Programmatic switch — e.g. twin.setCondition("pest")
  setCondition(name, severity = 1, health = 60) {
    if (CONDITIONS[name]) this.applyCondition(name, severity, null, health);
  }

  applyCondition(name, severity, reading, health) {
    this.condition = name;
    this.severity = Math.min(severity || 0, 3);
    this.health = health || 60;
    const spec = CONDITIONS[name];

    this.soilMat.color.set(spec.soil);
    this.soilMat.roughness = spec.soilGloss ? 0.2 : 1;
    this.soilTopMat.color.set(spec.soilTop);
    for (const clod of this.clods) clod.material.color.set(spec.soilTop);
    this.rootMat.color.set(spec.root);

    const humidity = reading?.airHumidity ?? 60;
    this.mist.material.opacity = humidity > 85 ? 0.5 : humidity > 78 ? 0.24 : 0;
    this.rainMat.opacity = (reading?.rainfall ?? 0) >= 15 ? 0.7 : 0;

    this.buildPlant(spec, severity);
    this.buildRoots(spec);
  }

  /* ---------- plant ---------- */

  buildPlant(spec, severity) {
    this.clearGroup(this.plant);
    this.leafNodes = [];

    const stemGroup = new THREE.Group();
    stemGroup.rotation.z = spec.bend;
    stemGroup.rotation.x = -spec.bend * 0.4;
    this.plant.add(stemGroup);

    const stemMat = new THREE.MeshStandardMaterial({ color: spec.stem, roughness: 0.85 });
    const stemHeight = 2.15;
    const segs = 6;
    for (let i = 0; i < segs; i += 1) {
      const t = i / (segs - 1);
      const r = 0.068 - 0.03 * t;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.18, stemHeight / segs, 10), stemMat);
      const sway = Math.sin(t * Math.PI * 2.4) * 0.035;
      seg.position.set(Math.sin(t * Math.PI * 1.8) * 0.028 + sway * 0.4, SOIL_TOP + stemHeight * t, Math.cos(t * Math.PI * 1.5) * 0.03);
      seg.rotation.z = Math.sin(t * Math.PI * 1.8) * 0.05;
      seg.castShadow = true;
      stemGroup.add(seg);
    }

    // crown bud at the top
    const budMat = new THREE.MeshStandardMaterial({ color: 0x3f9e55, roughness: 0.7 });
    const bud = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 8), budMat);
    bud.position.y = SOIL_TOP + stemHeight + 0.02;
    stemGroup.add(bud);

    // 10 clearly separated leaves in 3 tiers (lower large -> upper small)
    const tiers = [
      { y: 0.34, count: 4, len: 1.3, wid: 0.55, droopMul: 1 },
      { y: 0.68, count: 3, len: 1.05, wid: 0.47, droopMul: 0.85 },
      { y: 1.02, count: 3, len: 0.8, wid: 0.4, droopMul: 0.7 },
    ];
    const severityScale = 1 - severity * 0.06;
    let leafIndex = 0;
    const leafObjects = [];
    for (const tier of tiers) {
      for (let i = 0; i < tier.count; i += 1) {
        const phi = (i / tier.count) * Math.PI * 2 + tier.y * 3.7;
        const len = tier.len * severityScale * (0.96 + (i % 2) * 0.05);
        const wid = tier.wid * (0.94 + (i % 3) * 0.05);
        const leaf = this.makeLeaf({ spec, len, wid, seed: leafIndex + 1 });
        leaf.position.y = SOIL_TOP + stemHeight * tier.y;
        const baseDroop = spec.droop * tier.droopMul * (0.7 + (leafIndex % 3) * 0.25);
        leaf.rotation.z = baseDroop + 0.12 * (leafIndex % 2 === 0 ? 1 : -1);
        leaf.rotation.y = phi;
        leaf.rotation.x = 0.12;
        const curlScale = 1 - spec.curl * (0.3 + (leafIndex % 3) * 0.22);
        leaf.scale.set(curlScale, 1, 1);
        stemGroup.add(leaf);
        this.leafNodes.push({ mesh: leaf, baseZ: leaf.rotation.z, baseX: leaf.rotation.x, phase: phi + leafIndex });
        leafObjects.push(leaf);
        leafIndex += 1;
      }
    }

    if (spec.bugs > 0) this.addBugs(leafObjects, spec);
  }

  makeLeaf({ spec, len, wid, seed }) {
    const leaf = new THREE.Group();

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(len * 0.25, wid, len * 0.6, wid * 0.55);
    shape.quadraticCurveTo(len * 0.85, wid * 0.3, len, 0);
    shape.quadraticCurveTo(len * 0.85, -wid * 0.3, len * 0.6, -wid * 0.55);
    shape.quadraticCurveTo(len * 0.25, -wid, 0, 0);

    const base = new THREE.Color(spec.leaf);
    const secondary = new THREE.Color(spec.leafVar);
    const perLeaf = lerpColor(base, secondary, rng(seed * 5));
    const color = perLeaf.clone();
    if (spec.pale) color.lerp(new THREE.Color(0xd5de9a), spec.pale * 0.35);
    color.multiplyScalar(1 - spec.dull * 0.25);

    const bladeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.72, side: THREE.DoubleSide });
    const blade = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.007, bevelThickness: 0.007 }),
      bladeMat
    );
    blade.castShadow = true;
    leaf.add(blade);

    // midrib vein
    const midribMat = new THREE.MeshStandardMaterial({ color: spec.vein, roughness: 0.8 });
    const midrib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, len * 0.72, 6), midribMat);
    midrib.rotation.z = -Math.PI / 2;
    midrib.position.set(len * 0.34, 0, 0.02);
    leaf.add(midrib);

    // side veins (visible herringbone pattern)
    const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.vein).offsetHSL(0, 0, -0.06), roughness: 0.8 });
    for (const frac of [0.42, 0.6]) {
      for (const dir of [1, -1]) {
        const a = 0.62 * dir;
        const vlen = wid * 0.42;
        const x0 = len * frac;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const vein = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, vlen, 5), sideMat);
        vein.rotation.z = Math.atan2(-dx, dy);
        vein.position.set(x0 + dx * vlen * 0.5, dy * vlen * 0.5, 0.02);
        leaf.add(vein);
      }
    }

    // condition decoration on the blade
    if (spec.spots > 0) this.addSpots(leaf, len, wid, seed, spec.spots, 0x44351f);
    if (spec.holes > 0) this.addHoles(leaf, len, wid, seed, 1 + (seed % 2));
    if (spec.edge > 0) this.addEdgeDry(leaf, len, wid, seed, spec.edge);

    return leaf;
  }

  addSpots(leaf, len, wid, seed, density, spotColor) {
    const mat = new THREE.MeshStandardMaterial({ color: spotColor, roughness: 0.9 });
    const n = Math.max(1, Math.round(density * (4 + (seed % 3))));
    for (let i = 0; i < n; i += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.018 + rng(seed * 3 + i) * 0.02, 6, 5), mat);
      const x = len * (0.12 + rng(seed * 11 + i) * 0.78);
      const half = wid * (0.55 - 0.3 * (x / len));
      const y = (rng(seed * 17 + i) - 0.5) * 2 * half;
      s.position.set(x, y, 0.05 + rng(seed * 23 + i) * 0.02);
      s.scale.set(1, 0.5, 0.4);
      leaf.add(s);
    }
  }

  addHoles(leaf, len, wid, seed, count) {
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x1c1810, roughness: 1 });
    for (let i = 0; i < count; i += 1) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02 + rng(seed * 7 + i) * 0.016, 0.02 + rng(seed * 9 + i) * 0.016, 0.06, 8), holeMat);
      const x = len * (0.16 + rng(seed * 29 + i) * 0.68);
      const half = wid * (0.5 - 0.28 * (x / len));
      const y = (rng(seed * 31 + i) - 0.5) * 2 * half;
      hole.position.set(x, y, 0.03);
      leaf.add(hole);
    }
  }

  addEdgeDry(leaf, len, wid, seed, intensity) {
    const dryMat = new THREE.MeshStandardMaterial({ color: 0xc9b45a, roughness: 0.95 });
    const n = 2 + Math.round(intensity * 2);
    for (let i = 0; i < n; i += 1) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.02 + rng(seed * 41 + i) * 0.02, 6, 5), dryMat);
      const x = len * (0.62 + rng(seed * 43 + i) * 0.35);
      const y = (rng(seed * 47 + i) - 0.5) * wid * (0.6 - 0.25 * (x / len)) * (rng(seed * 53 + i) > 0.5 ? 1 : -1);
      d.position.set(x, y, 0.05);
      d.scale.set(1, 0.45, 0.5);
      leaf.add(d);
    }
  }

  addBugs(leafObjects, spec) {
    const bugMat = new THREE.MeshStandardMaterial({ color: 0x3a3420, roughness: 0.6 });
    const bugMat2 = new THREE.MeshStandardMaterial({ color: 0x4c5a2a, roughness: 0.6 });
    for (let b = 0; b < spec.bugs && leafObjects.length; b += 1) {
      const leaf = leafObjects[b % leafObjects.length];
      const bug = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.045, 2, 6), b % 2 ? bugMat2 : bugMat);
      body.rotation.x = Math.PI / 2;
      bug.add(body);
      const legMat = b % 2 ? bugMat2 : bugMat;
      for (let i = 0; i < 3; i += 1) {
        for (const side of [1, -1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.028, 4), legMat);
          leg.position.set(0, side * 0.015, -0.02 + i * 0.02);
          leg.rotation.z = side * 0.5;
          bug.add(leg);
        }
      }
      bug.position.set(0.18 + rng(b * 3 + 1) * 0.5, 0.05, (rng(b * 5 + 2) - 0.5) * 0.28);
      bug.rotation.y = rng(b * 7 + 4) * Math.PI;
      leaf.add(bug);
    }
  }

  buildRoots(spec) {
    this.clearGroup(this.roots);
    const count = 9;
    for (let i = 0; i < count; i += 1) {
      const a = i * 2.399 + rng(i + 3) * 0.5;
      const reach = 0.75 + (i % 3) * 0.22;
      const depth = 0.72 + (i % 4) * 0.08;
      const points = [
        new THREE.Vector3(0, SOIL_TOP - 0.06, 0),
        new THREE.Vector3(Math.cos(a) * reach * 0.3, SOIL_TOP - depth * 0.4, Math.sin(a) * reach * 0.3),
        new THREE.Vector3(Math.cos(a) * reach * 0.7, SOIL_TOP - depth * 0.72, Math.sin(a) * reach * 0.7),
        new THREE.Vector3(Math.cos(a) * reach, SOIL_TOP - depth, Math.sin(a) * reach),
        new THREE.Vector3(Math.cos(a + 0.35) * reach * 1.22, SOIL_TOP - depth, Math.sin(a + 0.35) * reach * 1.22),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.02 + rng(i * 7) * 0.01, 5, false), this.rootMat);
      root.castShadow = true;
      this.roots.add(root);
    }
  }

  clearGroup(group) {
    while (group.children.length) {
      const child = group.children.pop();
      child.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (node.material.map) node.material.map.dispose();
          node.material.dispose();
        }
      });
    }
  }

  resize() {
    if (this.disposed) return;
    const parent = this.canvas.parentElement || this.canvas;
    const width = parent.clientWidth || 600;
    const height = parent.clientHeight || 380;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  animate(time) {
    if (this.disposed) return;
    if (this.animating && !document.hidden) {
      const dt = 0.016;
      if (this.rainMat.opacity > 0) {
        this.rainTime += dt * 3;
        const array = this.rainPos;
        for (let i = 0; i < 110; i += 1) {
          array[i * 3 + 1] -= dt * 2.2;
          if (array[i * 3 + 1] < 0) this.resetRain(i, array);
        }
        this.rain.geometry.attributes.position.needsUpdate = true;
      }
      for (const leaf of this.leafNodes) {
        leaf.mesh.rotation.z = leaf.baseZ + Math.sin(time * 0.0015 + leaf.phase) * 0.03;
        leaf.mesh.rotation.x = leaf.baseX + Math.sin(time * 0.0012 + leaf.phase * 2) * 0.018;
      }
      if (this.plant) this.plant.rotation.z = Math.sin(time * 0.0011) * 0.014;
      if (this.roots) this.roots.rotation.y = Math.sin(time * 0.0006) * 0.004;
      if (this.mist) this.mist.rotation.y = time * 0.00006;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
    this.animateId = requestAnimationFrame((t) => this.animate(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animateId);
    if (this.observer) this.observer.disconnect();
    this.clearGroup(this.plant);
    this.clearGroup(this.roots);
    this.scene.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (node.material.map) node.material.map.dispose();
        node.material.dispose();
      }
    });
    this.renderer.dispose();
    this.scene = null;
    this.renderer = null;
  }
}

function lerpColor(a, b, t) {
  return a.clone().lerp(b, t);
}