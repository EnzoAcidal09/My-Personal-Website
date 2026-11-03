import * as THREE from "../vendor/three.module.js";
import {
  terrainTexture,
  labelTexture,
  glowTexture,
  dustTexture,
  createScreenTexture,
  mulberry32,
  makeTexture,
  WORLD_SIZE,
} from "./textures.js";

export const SKY_COLOR = "#8ecfe0";
const FOG_NEAR = 42;
const FOG_FAR = 92;
const ISLAND_HALF = WORLD_SIZE / 2;
export const WALK_BOUNDS = ISLAND_HALF - 1.6;

const COLORS = {
  grass: "#6daa54",
  trunk: "#7a5230",
  trunkDark: "#5e3f26",
  leafDark: "#3f7d3e",
  leaf: "#57a04b",
  leafLight: "#79bd5e",
  rock: "#8d99a6",
  rockDark: "#69737f",
  sand: "#e7d3a1",
  cream: "#f2e3c0",
  timber: "#5b3a29",
  roof: "#b13e53",
  navy: "#1a1c2c",
  navy2: "#29366f",
  plum: "#5d275d",
  blue: "#41a6f6",
  cyan: "#73eff7",
  yellow: "#ffcd75",
  orange: "#ef7d57",
  red: "#b13e53",
  green: "#38b764",
  lime: "#a7f070",
  white: "#f4f4f4",
  stone: "#94b0c2",
  stoneDark: "#5f6a7d",
};

const ZONES = {
  about: { x: -14, z: -12, label: "ABOUT", accent: COLORS.yellow, labelY: 5.85 },
  projects: { x: 14, z: -12, label: "PROJECTS", accent: COLORS.blue, labelY: 4.9 },
  skills: { x: -14, z: 12, label: "SKILLS", accent: COLORS.lime, labelY: 5.2 },
  contact: { x: 14, z: 12, label: "CONTACT", accent: COLORS.orange, labelY: 4.6 },
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const materialCache = new Map();

function mat(color, options = {}) {
  const key = `${color}|${options.emissive || ""}|${options.transparent ? options.opacity : ""}`;
  if (!options.transparent && !options.unique && materialCache.has(key)) {
    return materialCache.get(key);
  }
  const material = new THREE.MeshLambertMaterial({
    color,
    ...(options.emissive ? { emissive: options.emissive, emissiveIntensity: options.emissiveIntensity ?? 1 } : {}),
    ...(options.transparent ? { transparent: true, opacity: options.opacity ?? 1 } : {}),
    ...(options.basic ? { depthWrite: options.depthWrite ?? true } : {}),
  });
  if (!options.transparent && !options.unique) materialCache.set(key, material);
  return material;
}

function addBox(parent, { w = 1, h = 1, d = 1, color = COLORS.white, x = 0, y = 0, z = 0, ry = 0, material, cast = true, receive = true }) {
  const mesh = new THREE.Mesh(BOX, material || mat(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, { rTop, rBottom, h, color, x = 0, y = 0, z = 0, segments = 8, material, cast = true }) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  const mesh = new THREE.Mesh(geo, material || mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function circleCollider(x, z, r) {
  return { type: "circle", x, z, r };
}

function boxCollider(minX, maxX, minZ, maxZ) {
  return { type: "box", minX, maxX, minZ, maxZ };
}

function createWaterMaterial({ deep, shallow, amp = 0.07, speed = 1, foam = 0 }) {
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: amp },
    uSpeed: { value: speed },
    uDeep: { value: new THREE.Color(deep) },
    uShallow: { value: new THREE.Color(shallow) },
    uFoam: { value: foam },
    uFogColor: { value: new THREE.Color(SKY_COLOR) },
    uFogNear: { value: FOG_NEAR },
    uFogFar: { value: FOG_FAR },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uSpeed;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        vec3 p = position;
        float wave =
          sin(p.x * 0.55 + uTime * uSpeed * 1.2) * 0.55 +
          sin(p.y * 0.78 - uTime * uSpeed * 0.9) * 0.35 +
          sin((p.x + p.y) * 0.23 + uTime * uSpeed * 0.55) * 0.45;
        p.z += wave * uAmp;
        vWave = wave * uAmp;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      uniform float uSpeed;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform float uFoam;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vWorld;
      varying float vWave;
      void main() {
        float height = clamp(vWave / max(uAmp * 1.35, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uDeep, uShallow, smoothstep(0.18, 0.9, height));

        float dither = mod(floor(vWorld.x * 6.0) + floor(vWorld.z * 6.0), 2.0);
        color += dither * 0.012;

        float sparkle = step(
          0.985,
          sin(vWorld.x * 7.0 + uTime * uSpeed * 2.2) * sin(vWorld.z * 5.0 - uTime * uSpeed * 1.7)
        );
        color += sparkle * 0.12;

        if (uFoam > 0.5) {
          float shore = max(abs(vWorld.x), abs(vWorld.z));
          float band = smoothstep(22.0, 22.35, shore) * (1.0 - smoothstep(22.7, 24.0, shore));
          float ripple = sin(uTime * 1.9 + vWorld.x * 2.6 + vWorld.z * 2.1) * 0.5 + 0.5;
          color = mix(color, vec3(0.9, 0.96, 0.94), band * step(0.56, ripple) * 0.85);
        }

        float dist = distance(vWorld, cameraPosition);
        float fog = smoothstep(uFogNear, uFogFar, dist);
        color = mix(color, uFogColor, fog);

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function buildWorld(scene) {
  const rng = mulberry32(1337);
  const colliders = [];
  const interactables = [];
  const updaters = [];
  const canopies = [];
  const labels = new Map();
  const dustPool = [];
  const screens = [];
  const bulbs = [];
  const fireflies = [];
  const waterUniforms = [];
  const smokePuffs = [];
  let activeId = null;
  let duckGroup = null;
  let duckFound = false;
  let elapsed = 0;

  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR);

  /* ---------------------------------------------------------------------- */
  /* Island                                                                  */
  /* ---------------------------------------------------------------------- */

  const topTexture = terrainTexture();
  const sideMaterial = mat(COLORS.sand);
  const underside = mat("#8a6a45");
  const island = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_SIZE, 1.2, WORLD_SIZE),
    [sideMaterial, sideMaterial, new THREE.MeshLambertMaterial({ map: topTexture }), underside, sideMaterial, sideMaterial],
  );
  island.position.y = -0.6;
  island.receiveShadow = true;
  island.castShadow = true;
  scene.add(island);

  // Deep water around the island
  const oceanMaterial = createWaterMaterial({
    deep: "#2b6b7c",
    shallow: "#4fa6b8",
    amp: 0.075,
    speed: 1,
    foam: 1,
  });
  waterUniforms.push(oceanMaterial.uniforms);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(240, 240, 110, 110), oceanMaterial);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -0.46;
  ocean.receiveShadow = true;
  scene.add(ocean);

  updaters.push((time) => {
    waterUniforms.forEach((u) => {
      u.uTime.value = time;
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Shared helpers                                                          */
  /* ---------------------------------------------------------------------- */

  function addLabel(id, text, x, y, z, accent) {
    const texture = labelTexture(text, accent);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const height = 1.05;
    const aspect = texture.image.width / texture.image.height;
    sprite.scale.set(height * aspect, height, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 2;
    scene.add(sprite);
    labels.set(id, {
      sprite,
      baseY: y,
      baseScale: height,
      baseAspect: aspect,
      phase: rng() * Math.PI * 2,
    });
    updaters.push((time) => {
      const label = labels.get(id);
      if (!label) return;
      const active = activeId === id;
      const bob = Math.sin(time * 1.5 + label.phase) * 0.09;
      const pulse = active ? 1 + 0.07 * Math.sin(time * 9) : 1;
      label.sprite.position.y = label.baseY + bob;
      label.sprite.scale.set(
        label.baseScale * label.baseAspect * pulse,
        label.baseScale * pulse,
        1,
      );
      label.sprite.material.opacity = active ? 1 : 0.92;
    });
  }

  function addDustPool() {
    const texture = dustTexture();
    for (let i = 0; i < 20; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: "#e9d9b4",
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      sprite.scale.setScalar(0.2);
      scene.add(sprite);
      dustPool.push({ sprite, life: 0, maxLife: 0.6, vx: 0, vz: 0, vy: 0 });
    }
  }
  addDustPool();

  function spawnDust(position) {
    const item = dustPool.find((d) => d.life <= 0);
    if (!item) return;
    item.life = 0.5 + rng() * 0.2;
    item.maxLife = item.life;
    item.sprite.position.set(
      position.x + (rng() - 0.5) * 0.2,
      0.08,
      position.z + (rng() - 0.5) * 0.2,
    );
    item.vx = (rng() - 0.5) * 0.5;
    item.vz = (rng() - 0.5) * 0.5;
    item.vy = 0.45 + rng() * 0.35;
    item.sprite.visible = true;
    item.sprite.material.opacity = 0.75;
    item.sprite.scale.setScalar(0.18 + rng() * 0.08);
  }

  updaters.push((time, dt) => {
    dustPool.forEach((item) => {
      if (item.life <= 0) return;
      item.life -= dt;
      if (item.life <= 0) {
        item.sprite.visible = false;
        return;
      }
      const t = 1 - item.life / item.maxLife;
      item.sprite.position.x += item.vx * dt;
      item.sprite.position.z += item.vz * dt;
      item.sprite.position.y += item.vy * dt;
      item.sprite.material.opacity = (1 - t) * 0.65;
      item.sprite.scale.setScalar((0.18 + t * 0.24) + (item.maxLife % 0.06));
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Landmarks                                                               */
  /* ---------------------------------------------------------------------- */

  buildCottage();
  buildArcade();
  buildCrystals();
  buildCamp();
  buildPond();
  buildSignpost();
  scatterNature();

  /* ------------------------------ cottage ------------------------------- */

  function buildCottage() {
    const group = new THREE.Group();
    group.position.set(ZONES.about.x, 0, ZONES.about.z);
    scene.add(group);

    // foundation + walls
    addBox(group, { w: 6.5, h: 0.32, d: 5.3, color: COLORS.stoneDark, y: 0.16 });
    addBox(group, { w: 5.9, h: 2.75, d: 4.6, color: COLORS.cream, y: 1.68 });

    // timber frame
    const beam = mat(COLORS.timber);
    [-2.86, 2.86].forEach((x) => {
      [-2.2, 2.2].forEach((z) => {
        addBox(group, { w: 0.2, h: 2.8, d: 0.2, material: beam, x, y: 1.7, z });
      });
    });
    addBox(group, { w: 5.95, h: 0.16, d: 0.16, material: beam, y: 2.95, z: 2.25 });
    addBox(group, { w: 0.16, h: 0.16, d: 4.65, material: beam, x: 2.95, y: 2.95 });

    // roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.7, 2.35, 4), mat(COLORS.roof));
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
    const roofTrim = new THREE.Mesh(new THREE.ConeGeometry(4.78, 0.22, 4), mat("#8f2f42"));
    roofTrim.position.y = 3.14;
    roofTrim.rotation.y = Math.PI / 4;
    group.add(roofTrim);

    // door
    addBox(group, { w: 1.24, h: 2.02, d: 0.1, color: COLORS.timber, y: 1.33, z: 2.33 });
    addBox(group, { w: 1.02, h: 1.8, d: 0.1, color: "#8a5a3b", y: 1.25, z: 2.39 });
    addBox(group, { w: 0.09, h: 0.09, d: 0.06, color: COLORS.yellow, x: 0.32, y: 1.2, z: 2.46 });
    addBox(group, { w: 1.7, h: 0.16, d: 0.7, color: COLORS.stoneDark, y: 0.3, z: 2.6 });

    // windows (warm, glowing)
    [-1.8, 1.8].forEach((x) => {
      addBox(group, { w: 1.12, h: 1.12, d: 0.12, color: COLORS.timber, x, y: 1.9, z: 2.3 });
      const light = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshBasicMaterial({ color: COLORS.yellow }));
      light.position.set(x, 1.9, 2.37);
      group.add(light);
      addBox(group, { w: 0.08, h: 0.9, d: 0.06, color: COLORS.timber, x, y: 1.9, z: 2.39, cast: false });
      addBox(group, { w: 0.9, h: 0.08, d: 0.06, color: COLORS.timber, x, y: 1.9, z: 2.39, cast: false });
      addBox(group, { w: 1.26, h: 0.18, d: 0.3, color: COLORS.stone, x, y: 1.3, z: 2.4 });
    });

    // chimney + smoke
    addBox(group, { w: 0.72, h: 2.1, d: 0.72, color: "#8d6a55", x: 1.9, y: 4.15, z: -1.1 });
    addBox(group, { w: 0.9, h: 0.22, d: 0.9, color: COLORS.stoneDark, x: 1.9, y: 5.25, z: -1.1 });
    const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#dfe6e6", transparent: true, opacity: 0.3, depthWrite: false });
    for (let i = 0; i < 5; i += 1) {
      const puff = new THREE.Mesh(BOX, smokeMaterial.clone());
      puff.scale.setScalar(0.4);
      puff.position.set(1.9, 5.5, -1.1);
      group.add(puff);
      smokePuffs.push({ mesh: puff, offset: i / 5, drift: (rng() - 0.5) * 0.6 });
    }
    updaters.push((time) => {
      smokePuffs.forEach((puff) => {
        const t = (time * 0.17 + puff.offset) % 1;
        puff.mesh.position.y = 5.5 + t * 3.4;
        puff.mesh.position.x = 1.9 + Math.sin(time * 0.7 + puff.offset * 12) * 0.22 + puff.drift * t;
        puff.mesh.position.z = -1.1 + Math.cos(time * 0.5 + puff.offset * 9) * 0.16;
        puff.mesh.scale.setScalar(0.35 + t * 0.9);
        puff.mesh.material.opacity = (1 - t) * 0.32;
      });
    });

    // little garden + fence
    addBox(group, { w: 1.7, h: 0.18, d: 0.9, color: "#6b4a32", x: -2.2, y: 0.12, z: 2.9 });
    addBox(group, { w: 1.7, h: 0.18, d: 0.9, color: "#6b4a32", x: 2.2, y: 0.12, z: 2.9 });
    const fence = mat("#8a6a45");
    [-2.2, -1.7, 1.7, 2.2].forEach((x) => {
      addBox(group, { w: 0.14, h: 0.75, d: 0.14, material: fence, x, y: 0.38, z: 3.35 });
    });
    addBox(group, { w: 1.9, h: 0.1, d: 0.1, material: fence, x: -1.95, y: 0.58, z: 3.35 });
    addBox(group, { w: 1.9, h: 0.1, d: 0.1, material: fence, x: 1.95, y: 0.58, z: 3.35 });
    colliders.push(
      boxCollider(-17.3, -10.7, -14.7, -9.5),
      boxCollider(-16.5, -15.3, -9.05, -8.55),
      boxCollider(-12.7, -11.5, -9.05, -8.55),
    );

    // warm porch light
    const light = new THREE.PointLight(0xffb066, 16, 10, 2);
    light.position.set(0.9, 2.6, 2.9);
    group.add(light);
    updaters.push((time) => {
      light.intensity = 15 + Math.sin(time * 4.2) * 1.4;
    });

    addLabel("about", "ABOUT", ZONES.about.x, ZONES.about.labelY, ZONES.about.z, ZONES.about.accent);
    interactables.push({
      id: "about",
      kind: "zone",
      x: ZONES.about.x,
      z: -8.7,
      radius: 2.7,
      prompt: "ENTER THE COTTAGE",
      label: "ABOUT",
    });
  }

  /* ------------------------------- arcade ------------------------------- */

  function buildArcade() {
    const group = new THREE.Group();
    group.position.set(ZONES.projects.x, 0, ZONES.projects.z);
    scene.add(group);

    // platform
    addBox(group, { w: 7.6, h: 0.28, d: 5.2, color: COLORS.stoneDark, y: 0.14 });
    addBox(group, { w: 7.1, h: 0.1, d: 4.7, color: "#3d4560", y: 0.31, cast: false });

    const cabinetColors = [COLORS.plum, "#4a2f63", "#7a2f45"];
    const screenColors = ["#41a6f6", "#73eff7", "#ef7d57"];

    [-2.25, 0, 2.25].forEach((x, i) => {
      const body = addBox(group, { w: 1.5, h: 2.55, d: 1.05, color: cabinetColors[i], x, y: 1.55, z: 0.1 });
      body.castShadow = true;
      addBox(group, { w: 1.56, h: 0.34, d: 1.1, color: "#242638", x, y: 2.9, z: 0.1 });
      // marquee
      const marquee = new THREE.Mesh(
        new THREE.PlaneGeometry(1.24, 0.24),
        new THREE.MeshBasicMaterial({ color: screenColors[i] }),
      );
      marquee.position.set(x, 2.78, 0.66);
      group.add(marquee);
      // screen
      addBox(group, { w: 1.16, h: 0.94, d: 0.12, color: COLORS.navy, x, y: 1.9, z: 0.62 });
      const screen = createScreenTexture(screenColors[i], 30 + i * 7);
      const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.76), new THREE.MeshBasicMaterial({ map: screen.texture }));
      screenMesh.position.set(x, 1.9, 0.69);
      group.add(screenMesh);
      screens.push(screen);
      // control panel
      const panel = addBox(group, { w: 1.36, h: 0.16, d: 0.72, color: "#22293d", x, y: 1.12, z: 0.64 });
      panel.rotation.x = -0.22;
      addCylinder(group, { rTop: 0.035, rBottom: 0.035, h: 0.3, color: "#c0c6d4", x: x - 0.32, y: 1.3, z: 0.66, segments: 6 });
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(COLORS.red));
      knob.position.set(x - 0.32, 1.47, 0.66);
      group.add(knob);
      [
        [-0.02, COLORS.cyan],
        [0.2, COLORS.yellow],
        [0.4, COLORS.lime],
      ].forEach(([offset, color]) => {
        addCylinder(group, { rTop: 0.06, rBottom: 0.06, h: 0.06, color, x: x + offset + 0.15, y: 1.22, z: 0.68, segments: 8 });
      });
      // coin slot
      addBox(group, { w: 0.08, h: 0.2, d: 0.05, color: COLORS.yellow, x: x + 0.5, y: 0.9, z: 0.68 });
    });

    // string lights
    const postMat = mat("#6b4a32");
    [-3.35, 3.35].forEach((x) => {
      addBox(group, { w: 0.12, h: 3.0, d: 0.12, material: postMat, x, y: 1.5, z: -2.0 });
    });
    for (let i = 0; i < 13; i += 1) {
      const x = -3.2 + (i / 12) * 6.4;
      const color = i % 3 === 0 ? COLORS.yellow : i % 3 === 1 ? COLORS.cyan : COLORS.orange;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color }));
      bulb.position.set(x, 2.9 - Math.sin((i / 12) * Math.PI) * 0.45, -1.92);
      group.add(bulb);
      bulbs.push({ mesh: bulb, phase: i * 0.7 });
    }

    // carpet + stool
    const carpet = makeTexture(
      64,
      32,
      (ctx) => {
        ctx.fillStyle = "#29366f";
        ctx.fillRect(0, 0, 64, 32);
        for (let y = 0; y < 4; y += 1) {
          for (let x = 0; x < 8; x += 1) {
            if ((x + y) % 2 === 0) continue;
            ctx.fillStyle = (x + y) % 4 === 0 ? "#41a6f6" : "#5d275d";
            ctx.fillRect(x * 8, y * 8, 8, 8);
          }
        }
      },
      { smoothMin: false },
    );
    const carpetMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.2), new THREE.MeshLambertMaterial({ map: carpet }));
    carpetMesh.rotation.x = -Math.PI / 2;
    carpetMesh.position.set(0, 0.37, 1.9);
    carpetMesh.receiveShadow = true;
    group.add(carpetMesh);

    addBox(group, { w: 0.8, h: 0.5, d: 0.8, color: "#7a2f45", x: -3.9, y: 0.55, z: 0.4 });
    addBox(group, { w: 0.9, h: 0.18, d: 0.9, color: COLORS.red, x: -3.9, y: 0.86, z: 0.4 });

    // purple neon glow
    const light = new THREE.PointLight(0x8f6bff, 26, 13, 2);
    light.position.set(0, 2.4, 1.8);
    group.add(light);
    updaters.push((time) => {
      light.intensity = 24 + Math.sin(time * 3.1) * 3 + Math.sin(time * 7.7) * 2;
      bulbs.forEach((bulb) => {
        bulb.mesh.scale.setScalar(0.85 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2.4 + bulb.phase)));
      });
    });

    colliders.push(boxCollider(10.6, 17.4, -14.7, -9.4));
    addLabel("projects", "PROJECTS", ZONES.projects.x, ZONES.projects.labelY, ZONES.projects.z, ZONES.projects.accent);
    interactables.push({
      id: "projects",
      kind: "zone",
      x: ZONES.projects.x,
      z: -8.8,
      radius: 2.9,
      prompt: "BOOT THE ARCADE",
      label: "PROJECTS",
    });
  }

  /* ------------------------------- crystals ----------------------------- */

  function buildCrystals() {
    const group = new THREE.Group();
    group.position.set(ZONES.skills.x, 0, ZONES.skills.z);
    scene.add(group);

    addCylinder(group, { rTop: 2.15, rBottom: 2.4, h: 0.45, color: COLORS.stoneDark, y: 0.22, segments: 10 });
    addCylinder(group, { rTop: 2.0, rBottom: 2.05, h: 0.12, color: COLORS.stone, y: 0.5, segments: 10 });

    const crystalSpecs = [
      { x: 0, z: 0, h: 2.8, r: 0.75, color: COLORS.cyan },
      { x: -1.05, z: -0.4, h: 1.7, r: 0.42, color: COLORS.blue },
      { x: 0.95, z: -0.55, h: 1.4, r: 0.38, color: COLORS.lime },
      { x: 0.65, z: 0.85, h: 1.15, r: 0.32, color: COLORS.orange },
      { x: -0.8, z: 0.8, h: 0.95, r: 0.28, color: COLORS.yellow },
    ];

    crystalSpecs.forEach((spec, i) => {
      const geo = new THREE.OctahedronGeometry(spec.r, 0);
      const material = new THREE.MeshPhongMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 0.35,
        shininess: 90,
        flatShading: true,
        transparent: true,
        opacity: 0.94,
      });
      const crystal = new THREE.Mesh(geo, material);
      crystal.position.set(spec.x, 0.6 + spec.h / 2, spec.z);
      crystal.scale.set(1, spec.h / (spec.r * 2), 1);
      crystal.castShadow = true;
      crystal.receiveShadow = true;
      group.add(crystal);
      const baseY = crystal.position.y;
      const phase = i * 1.3;
      updaters.push((time) => {
        crystal.rotation.y = time * 0.5 + phase;
        crystal.position.y = baseY + Math.sin(time * 1.4 + phase) * 0.1;
        crystal.material.emissiveIntensity = 0.3 + 0.15 * (0.5 + 0.5 * Math.sin(time * 2.2 + phase));
      });
    });

    const rune = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.05, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.06;
    group.add(rune);
    updaters.push((time) => {
      rune.rotation.z = time * 0.12;
      rune.material.opacity = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(time * 1.7));
    });

    const light = new THREE.PointLight(0x73eff7, 22, 12, 2);
    light.position.set(0, 3.4, 0);
    group.add(light);
    updaters.push((time) => {
      light.intensity = 19 + Math.sin(time * 2.3) * 4;
    });

    // a few floating glints
    for (let i = 0; i < 8; i += 1) {
      const glint = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.07),
        new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.cyan : COLORS.yellow }),
      );
      const angle = (i / 8) * Math.PI * 2;
      const radius = 1.3 + (i % 3) * 0.4;
      glint.userData = { angle, radius, baseY: 0.9 + (i % 4) * 0.5, speed: 0.3 + (i % 3) * 0.12 };
      group.add(glint);
      updaters.push((time) => {
        const { angle: a, radius: r, baseY, speed } = glint.userData;
        glint.position.set(
          Math.cos(time * speed + a) * r,
          baseY + Math.sin(time * 1.6 + a) * 0.2,
          Math.sin(time * speed + a) * r,
        );
        glint.rotation.y = time * 2 + a;
      });
    }

    colliders.push(circleCollider(ZONES.skills.x, ZONES.skills.z, 2.45));
    addLabel("skills", "SKILLS", ZONES.skills.x, ZONES.skills.labelY, ZONES.skills.z, ZONES.skills.accent);
    interactables.push({
      id: "skills",
      kind: "zone",
      x: ZONES.skills.x,
      z: 9.1,
      radius: 2.7,
      prompt: "TOUCH THE CRYSTALS",
      label: "SKILLS",
    });
  }

  /* --------------------------------- camp ------------------------------- */

  function buildCamp() {
    const group = new THREE.Group();
    group.position.set(ZONES.contact.x, 0, ZONES.contact.z);
    scene.add(group);

    // A-frame tent
    const tentX = 2.4;
    const tentZ = 1.1;
    const tentW = 3.3;
    const tentD = 3.2;
    const tentH = 2.25;
    addBox(group, {
      w: tentW + 0.5,
      h: 0.16,
      d: tentD + 0.5,
      color: "#c9613f",
      x: tentX,
      y: 0.08,
      z: tentZ,
    });

    const slope = Math.hypot(tentW / 2, tentH);
    const slopeAngle = Math.atan2(tentH, tentW / 2);
    const roofGeo = new THREE.BoxGeometry(slope, 0.12, tentD + 0.12);
    const tentMat = mat(COLORS.orange);
    const leftRoof = new THREE.Mesh(roofGeo, tentMat);
    leftRoof.position.set(tentX - tentW / 4, tentH / 2 + 0.06, tentZ);
    leftRoof.rotation.z = slopeAngle;
    leftRoof.castShadow = true;
    leftRoof.receiveShadow = true;
    group.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofGeo, tentMat);
    rightRoof.position.set(tentX + tentW / 4, tentH / 2 + 0.06, tentZ);
    rightRoof.rotation.z = -slopeAngle;
    rightRoof.castShadow = true;
    rightRoof.receiveShadow = true;
    group.add(rightRoof);

    // triangular canvas ends
    const endShape = new THREE.Shape();
    endShape.moveTo(-tentW / 2, 0);
    endShape.lineTo(tentW / 2, 0);
    endShape.lineTo(0, tentH);
    endShape.lineTo(-tentW / 2, 0);
    const canvasMat = mat(COLORS.cream);
    [-1, 1].forEach((side) => {
      const end = new THREE.Mesh(new THREE.ShapeGeometry(endShape), canvasMat);
      end.position.set(tentX, 0.08, tentZ + side * (tentD / 2));
      end.rotation.y = side > 0 ? 0 : Math.PI;
      end.castShadow = true;
      group.add(end);
    });

    // dark doorway on the front canvas
    const doorShape = new THREE.Shape();
    const doorW = 1.05;
    doorShape.moveTo(-doorW / 2, 0.05);
    doorShape.lineTo(doorW / 2, 0.05);
    doorShape.lineTo(0, 1.3);
    doorShape.lineTo(-doorW / 2, 0.05);
    const door = new THREE.Mesh(
      new THREE.ShapeGeometry(doorShape),
      new THREE.MeshLambertMaterial({ color: "#3b2430" }),
    );
    door.position.set(tentX, 0, tentZ + tentD / 2 + 0.012);
    group.add(door);
    addBox(group, {
      w: 0.14,
      h: 1.32,
      d: 0.1,
      color: COLORS.yellow,
      x: tentX - doorW / 2 + 0.1,
      y: 0.75,
      z: tentZ + tentD / 2 + 0.03,
      ry: 0.18,
    });

    // ridge and flag pole
    addBox(group, {
      w: 0.12,
      h: 0.12,
      d: tentD + 0.2,
      color: COLORS.timber,
      x: tentX,
      y: tentH + 0.1,
      z: tentZ,
    });
    addBox(group, { w: 0.07, h: 1.2, d: 0.07, color: "#8a6a45", x: tentX, y: 2.95, z: tentZ });
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.45),
      new THREE.MeshLambertMaterial({ color: COLORS.yellow, side: THREE.DoubleSide }),
    );
    flag.position.set(tentX + 0.4, 3.35, tentZ);
    group.add(flag);
    updaters.push((time) => {
      flag.rotation.y = Math.sin(time * 2.1) * 0.35;
      flag.position.x = 2.8 - Math.abs(Math.sin(time * 2.1)) * 0.05;
    });

    // campfire
    const fireX = -1.0;
    const fireZ = 0.5;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      addBox(group, {
        w: 0.3,
        h: 0.24,
        d: 0.24,
        color: i % 2 ? COLORS.rock : "#7c8794",
        x: fireX + Math.cos(angle) * 0.85,
        y: 0.12,
        z: fireZ + Math.sin(angle) * 0.85,
        ry: angle,
      });
    }
    const logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.25, 6);
    const logMat = mat(COLORS.trunkDark);
    for (let i = 0; i < 3; i += 1) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI;
      log.position.set(fireX, 0.22, fireZ);
      log.castShadow = true;
      group.add(log);
    }
    const flames = [];
    [
      { w: 0.52, h: 0.85, d: 0.52, color: "#ef7d57", y: 0.75 },
      { w: 0.34, h: 0.55, d: 0.34, color: "#ffcd75", y: 0.95 },
      { w: 0.16, h: 0.3, d: 0.16, color: "#f4f4f4", y: 1.1 },
    ].forEach((spec, i) => {
      const flame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: spec.color }));
      flame.scale.set(spec.w, spec.h, spec.d);
      flame.position.set(fireX, spec.y, fireZ);
      group.add(flame);
      flames.push({ mesh: flame, baseY: spec.y, phase: i * 0.9 });
    });
    updaters.push((time) => {
      flames.forEach((flame, i) => {
        const s = 1 + Math.sin(time * 9 + flame.phase) * 0.12;
        flame.mesh.scale.y = (i === 0 ? 0.85 : i === 1 ? 0.55 : 0.3) * s;
        flame.mesh.position.y = flame.baseY + Math.sin(time * 11 + flame.phase) * 0.05;
        flame.mesh.rotation.y = time * (1.5 + i) + flame.phase;
      });
    });
    const fireLight = new THREE.PointLight(0xffa04d, 20, 11, 2);
    fireLight.position.set(fireX, 1.5, fireZ);
    group.add(fireLight);
    updaters.push((time) => {
      fireLight.intensity = 18 + Math.sin(time * 12.3) * 3 + Math.sin(time * 7.1) * 2;
      fireLight.position.x = fireX + Math.sin(time * 10) * 0.05;
    });

    // mailbox
    addBox(group, { w: 0.16, h: 1.3, d: 0.16, color: "#8a6a45", x: -3.0, y: 0.65, z: -1.1 });
    addBox(group, { w: 0.8, h: 0.55, d: 0.5, color: COLORS.blue, x: -3.0, y: 1.55, z: -1.1 });
    addBox(group, { w: 0.8, h: 0.1, d: 0.54, color: "#2f7f9e", x: -3.0, y: 1.85, z: -1.1 });
    addBox(group, { w: 0.08, h: 0.4, d: 0.08, color: COLORS.yellow, x: -2.52, y: 1.6, z: -1.1 });
    addBox(group, { w: 0.26, h: 0.08, d: 0.06, color: COLORS.yellow, x: -2.44, y: 1.75, z: -1.1 });

    // picnic blanket
    const blanketTex = makeTexture(32, 32, (ctx) => {
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#b13e53" : "#f4f4f4";
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }
    }, { smoothMin: false });
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), new THREE.MeshLambertMaterial({ map: blanketTex }));
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.set(2.6, 0.06, -1.9);
    blanket.receiveShadow = true;
    group.add(blanket);
    addBox(group, { w: 0.5, h: 0.24, d: 0.5, color: "#5d275d", x: 2.1, y: 0.18, z: -2.1 });
    addBox(group, { w: 0.5, h: 0.24, d: 0.5, color: COLORS.blue, x: 3.1, y: 0.18, z: -1.7 });

    colliders.push(
      boxCollider(14.2, 18.5, 11.0, 15.2),
      circleCollider(ZONES.contact.x - 1.0, ZONES.contact.z + 0.5, 1.1),
      circleCollider(ZONES.contact.x - 3.0, ZONES.contact.z - 1.1, 0.55),
    );

    addLabel("contact", "CONTACT", ZONES.contact.x, ZONES.contact.labelY, ZONES.contact.z + 0.4, ZONES.contact.accent);
    interactables.push({
      id: "contact",
      kind: "zone",
      x: ZONES.contact.x,
      z: 10.6,
      radius: 3.0,
      prompt: "SAY HELLO",
      label: "CONTACT",
    });
  }

  /* --------------------------------- pond ------------------------------- */

  function buildPond() {
    const group = new THREE.Group();
    group.position.set(16.0, 0, 5.8);
    scene.add(group);

    // sandy bowl
    addCylinder(group, { rTop: 3.9, rBottom: 4.0, h: 0.16, color: COLORS.sand, y: 0.08, segments: 18 });
    addCylinder(group, { rTop: 3.1, rBottom: 3.2, h: 0.08, color: "#c9b078", y: 0.15, segments: 18 });

    const pondMaterial = createWaterMaterial({
      deep: "#347f8f",
      shallow: "#72c9d2",
      amp: 0.022,
      speed: 0.7,
      foam: 0,
    });
    waterUniforms.push(pondMaterial.uniforms);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.05, 24), pondMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.225;
    group.add(water);

    // rim stones
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      addBox(group, {
        w: 0.55,
        h: 0.28,
        d: 0.4,
        color: i % 3 === 0 ? COLORS.stone : i % 3 === 1 ? COLORS.stoneDark : "#a3aeb8",
        x: Math.cos(angle) * 3.35,
        y: 0.18,
        z: Math.sin(angle) * 3.35,
        ry: angle,
      });
    }

    // reeds
    for (let i = 0; i < 7; i += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = 2.6 + rng() * 0.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = 0.7 + rng() * 0.6;
      addBox(group, { w: 0.06, h, d: 0.06, color: "#4d7c3e", x, y: 0.35 + h / 2, z, cast: false });
      addBox(group, { w: 0.13, h: 0.3, d: 0.13, color: "#6b4a32", x, y: 0.55 + h, z, cast: false });
    }

    // lily pads
    [
      [0.9, 0.7, 0.42],
      [-1.1, -0.5, 0.35],
      [0.2, -1.2, 0.3],
    ].forEach(([x, z, r], i) => {
      addCylinder(group, { rTop: r, rBottom: r, h: 0.05, color: i === 1 ? "#3f7d3e" : "#57a04b", x, y: 0.25, z, segments: 8, cast: false });
      if (i === 0) {
        addBox(group, { w: 0.16, h: 0.12, d: 0.16, color: "#f4a3c0", x, y: 0.33, z, cast: false });
        addBox(group, { w: 0.08, h: 0.1, d: 0.08, color: COLORS.yellow, x, y: 0.41, z, cast: false });
      }
    });

    // golden duck
    duckGroup = new THREE.Group();
    duckGroup.position.set(-1.3, 0.34, 0.2);
    const yellow = mat(COLORS.yellow);
    addBox(duckGroup, { w: 0.62, h: 0.32, d: 0.4, material: yellow, y: 0.12 });
    addBox(duckGroup, { w: 0.2, h: 0.2, d: 0.18, material: yellow, x: -0.32, y: 0.22, z: 0, ry: 0.4 });
    addBox(duckGroup, { w: 0.3, h: 0.3, d: 0.3, material: yellow, x: 0.24, y: 0.36 });
    addBox(duckGroup, { w: 0.12, h: 0.09, d: 0.14, color: COLORS.orange, x: 0.42, y: 0.32 });
    addBox(duckGroup, { w: 0.05, h: 0.05, d: 0.04, color: COLORS.navy, x: 0.36, y: 0.42, z: 0.09 });
    addBox(duckGroup, { w: 0.05, h: 0.05, d: 0.04, color: COLORS.navy, x: 0.36, y: 0.42, z: -0.09 });
    group.add(duckGroup);
    const duckBaseY = 0.34;
    updaters.push((time, dt) => {
      if (!duckGroup) return;
      if (duckFound) {
        duckGroup.rotation.y += dt * 2.6;
        duckGroup.position.y = duckBaseY + 0.25 + Math.sin(time * 6) * 0.12;
      } else {
        duckGroup.position.y = duckBaseY + Math.sin(time * 1.7) * 0.04;
        duckGroup.rotation.y = Math.sin(time * 0.5) * 0.4;
        duckGroup.rotation.z = Math.sin(time * 1.3) * 0.04;
      }
    });

    colliders.push(boxCollider(12.4, 19.6, 3.0, 8.6));
    interactables.push({
      id: "duck",
      kind: "secret",
      x: 12.0,
      z: 5.8,
      radius: 2.4,
      prompt: "INSPECT THE DUCK",
      label: "SECRET",
    });
  }

  /* ------------------------------- signpost ----------------------------- */

  function buildSignpost() {
    const group = new THREE.Group();
    group.position.set(-3.8, 0, 15.8);
    group.rotation.y = 0.25;
    scene.add(group);

    addBox(group, { w: 0.18, h: 2.2, d: 0.18, color: "#8a6a45", y: 1.1 });
    const boards = [
      { y: 1.95, dir: -1, color: COLORS.yellow, w: 1.5 },
      { y: 1.62, dir: 1, color: COLORS.blue, w: 1.3 },
      { y: 1.29, dir: -1, color: COLORS.lime, w: 1.2 },
    ];
    boards.forEach((board) => {
      addBox(group, {
        w: board.w,
        h: 0.26,
        d: 0.1,
        color: board.color,
        x: board.dir * (board.w / 2 + 0.1),
        y: board.y,
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 3), mat(board.color));
      tip.position.set(board.dir * (board.w + 0.18), board.y, 0);
      tip.rotation.z = board.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      tip.castShadow = true;
      group.add(tip);
    });
    addBox(group, { w: 0.7, h: 0.16, d: 0.16, color: COLORS.navy, y: 1.72, z: 0.06 });

    const question = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: labelTexture("?", COLORS.yellow),
        transparent: true,
        depthWrite: false,
      }),
    );
    question.scale.set(0.62, 0.62, 1);
    question.position.set(0, 2.85, 0);
    group.add(question);
    updaters.push((time) => {
      question.position.y = 2.85 + Math.sin(time * 2.2) * 0.08;
    });

    colliders.push(circleCollider(-3.8, 15.8, 0.55));
    interactables.push({
      id: "sign",
      kind: "help",
      x: -3.8,
      z: 14.8,
      radius: 2.1,
      prompt: "READ THE SIGNPOST",
      label: "HELP",
    });
  }

  /* ------------------------------- nature ------------------------------- */

  function decorBlocked(x, z) {
    if (Math.abs(x) > ISLAND_HALF - 2.4 || Math.abs(z) > ISLAND_HALF - 2.4) return true;
    if (Math.abs(x) < 3.3 || Math.abs(z) < 3.3) return true; // cross path
    if (Math.abs(Math.abs(x) - 14) < 2.7 && Math.abs(z) < 10.5) return true; // branches
    const avoid = [
      { x: ZONES.about.x, z: ZONES.about.z, r: 8.5 },
      { x: ZONES.projects.x, z: ZONES.projects.z, r: 8.0 },
      { x: ZONES.skills.x, z: ZONES.skills.z, r: 6.5 },
      { x: ZONES.contact.x, z: ZONES.contact.z, r: 7.6 },
      { x: 16.0, z: 5.8, r: 5.3 },
      { x: 0, z: 14.8, r: 6.5 },
      { x: -3.8, z: 15.8, r: 4.0 },
    ];
    return avoid.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r);
  }

  function scatterNature() {
    const placed = [];

    // trees
    const treeSpots = [];
    for (let i = 0; i < 300 && treeSpots.length < 26; i += 1) {
      const x = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      const z = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      if (decorBlocked(x, z)) continue;
      if (treeSpots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.7)) continue;
      treeSpots.push({ x, z, scale: 0.8 + rng() * 0.55 });
    }
    treeSpots.forEach((spot) => {
      const group = new THREE.Group();
      group.position.set(spot.x, 0, spot.z);
      group.scale.setScalar(spot.scale);
      group.rotation.y = rng() * Math.PI * 2;
      scene.add(group);

      addBox(group, { w: 0.34, h: 1.5, d: 0.34, color: COLORS.trunk, y: 0.75 });
      addBox(group, { w: 0.44, h: 0.2, d: 0.44, color: COLORS.trunkDark, y: 0.1 });

      const canopy = new THREE.Group();
      canopy.position.y = 1.4;
      group.add(canopy);
      addBox(canopy, { w: 2.1, h: 1.25, d: 2.1, color: COLORS.leafDark, y: 0.65, x: 0.08, z: -0.06 });
      addBox(canopy, { w: 1.55, h: 1.0, d: 1.55, color: COLORS.leaf, y: 1.42, x: -0.08 });
      addBox(canopy, { w: 0.95, h: 0.8, d: 0.95, color: COLORS.leafLight, y: 2.08, x: 0.04, z: 0.05 });
      if (rng() > 0.55) {
        for (let i = 0; i < 3; i += 1) {
          addBox(canopy, {
            w: 0.12,
            h: 0.12,
            d: 0.12,
            color: i % 2 ? COLORS.red : COLORS.orange,
            x: (rng() - 0.5) * 1.5,
            y: 0.7 + rng() * 1.2,
            z: 0.8,
            cast: false,
          });
        }
      }
      canopies.push({ group: canopy, phase: rng() * Math.PI * 2, amp: 0.018 + rng() * 0.02 });
      colliders.push(circleCollider(spot.x, spot.z, 0.55 * spot.scale));
      placed.push({ x: spot.x, z: spot.z });
    });

    // rocks
    for (let i = 0; i < 120; i += 1) {
      if (placed.length > 42) break;
      const x = (rng() * 2 - 1) * (ISLAND_HALF - 2.8);
      const z = (rng() * 2 - 1) * (ISLAND_HALF - 2.8);
      if (decorBlocked(x, z)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 1.7)) continue;
      const s = 0.4 + rng() * 0.55;
      const rock = new THREE.Group();
      rock.position.set(x, 0, z);
      rock.rotation.y = rng() * Math.PI;
      scene.add(rock);
      addBox(rock, { w: s, h: s * 0.8, d: s * 0.9, color: i % 2 ? COLORS.rock : COLORS.rockDark, y: s * 0.4 });
      if (rng() > 0.5) {
        addBox(rock, { w: s * 0.6, h: s * 0.5, d: s * 0.6, color: COLORS.rockDark, x: s * 0.5, y: s * 0.25 });
      }
      colliders.push(circleCollider(x, z, s * 0.55));
      placed.push({ x, z });
    }

    // bushes
    for (let i = 0; i < 120; i += 1) {
      if (placed.length > 56) break;
      const x = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      const z = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      if (decorBlocked(x, z)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6)) continue;
      const bush = new THREE.Group();
      bush.position.set(x, 0, z);
      scene.add(bush);
      const s = 0.45 + rng() * 0.35;
      addBox(bush, { w: s, h: s * 0.75, d: s, color: COLORS.leafDark, y: s * 0.35 });
      addBox(bush, { w: s * 0.7, h: s * 0.55, d: s * 0.7, color: COLORS.leaf, y: s * 0.7, x: s * 0.2 });
      if (rng() > 0.6) {
        addBox(bush, { w: 0.1, h: 0.1, d: 0.1, color: COLORS.red, x: -s * 0.2, y: s * 0.6, z: s * 0.45, cast: false });
      }
      placed.push({ x, z });
    }

    // mushrooms
    for (let i = 0; i < 10; i += 1) {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const x = (rng() * 2 - 1) * (ISLAND_HALF - 4);
        const z = (rng() * 2 - 1) * (ISLAND_HALF - 4);
        if (decorBlocked(x, z)) continue;
        addBox(scene, { w: 0.1, h: 0.22, d: 0.1, color: "#f0e2c4", x, y: 0.11, z, cast: false });
        addBox(scene, { w: 0.28, h: 0.14, d: 0.28, color: i % 3 === 0 ? COLORS.yellow : COLORS.red, x, y: 0.28, z, cast: false });
        break;
      }
    }

    // flowers (instanced)
    const flowerCount = 130;
    const stemGeo = new THREE.BoxGeometry(0.045, 0.34, 0.045);
    const headGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({ color: "#4d7c3e" }), flowerCount);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial({ color: "#ffffff" }), flowerCount);
    const flowerColors = [new THREE.Color("#ffcd75"), new THREE.Color("#f4f4f4"), new THREE.Color("#ef7d57"), new THREE.Color("#73eff7"), new THREE.Color("#b13e53")];
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let i = 0; i < 1200 && count < flowerCount; i += 1) {
      const x = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      const z = (rng() * 2 - 1) * (ISLAND_HALF - 3);
      if (decorBlocked(x, z)) continue;
      const s = 0.8 + rng() * 0.8;
      dummy.position.set(x, 0.17 * s, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = rng() * Math.PI;
      dummy.updateMatrix();
      stems.setMatrixAt(count, dummy.matrix);
      dummy.position.y = 0.37 * s;
      dummy.updateMatrix();
      heads.setMatrixAt(count, dummy.matrix);
      heads.setColorAt(count, flowerColors[Math.floor(rng() * flowerColors.length)]);
      count += 1;
    }
    stems.count = count;
    heads.count = count;
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    scene.add(stems, heads);
  }

  /* ---------------------------------------------------------------------- */
  /* Ambient life                                                           */
  /* ---------------------------------------------------------------------- */

  // fireflies
  const fireflyCount = 70;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyData = [];
  for (let i = 0; i < fireflyCount; i += 1) {
    const aroundPond = i < 30;
    const baseX = aroundPond ? 16 + (rng() - 0.5) * 11 : (rng() * 2 - 1) * 18;
    const baseZ = aroundPond ? 5.8 + (rng() - 0.5) * 11 : (rng() * 2 - 1) * 18;
    fireflyData.push({
      baseX,
      baseZ,
      baseY: 0.8 + rng() * 2.2,
      phase: rng() * Math.PI * 2,
      speed: 0.25 + rng() * 0.5,
      radius: 0.5 + rng() * 1.5,
    });
    fireflyPositions[i * 3] = baseX;
    fireflyPositions[i * 3 + 1] = 1.5;
    fireflyPositions[i * 3 + 2] = baseZ;
  }
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));
  const fireflyPoints = new THREE.Points(
    fireflyGeo,
    new THREE.PointsMaterial({
      map: glowTexture(),
      color: 0xffe2a8,
      size: 0.36,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  fireflyPoints.frustumCulled = false;
  scene.add(fireflyPoints);
  updaters.push((time) => {
    const attr = fireflyGeo.getAttribute("position");
    for (let i = 0; i < fireflyCount; i += 1) {
      const d = fireflyData[i];
      attr.array[i * 3] = d.baseX + Math.sin(time * d.speed + d.phase) * d.radius;
      attr.array[i * 3 + 1] = d.baseY + Math.sin(time * d.speed * 1.7 + d.phase * 2) * 0.35;
      attr.array[i * 3 + 2] = d.baseZ + Math.cos(time * d.speed * 0.8 + d.phase) * d.radius;
    }
    attr.needsUpdate = true;
    fireflyPoints.material.opacity = 0.65 + 0.25 * (0.5 + 0.5 * Math.sin(time * 0.8));
  });

  // tree sway
  updaters.push((time) => {
    canopies.forEach((canopy) => {
      canopy.group.rotation.z = Math.sin(time * 0.8 + canopy.phase) * canopy.amp;
      canopy.group.rotation.x = Math.cos(time * 0.63 + canopy.phase) * canopy.amp * 0.7;
    });
  });

  // arcade screens
  updaters.push((time) => {
    screens.forEach((screen) => screen.redraw(time));
  });

  // campfire embers are part of the point light flicker; done above.

  /* ---------------------------------------------------------------------- */
  /* Public API                                                             */
  /* ---------------------------------------------------------------------- */

  return {
    colliders,
    interactables,
    labels,
    getInteractable(position) {
      let best = null;
      let bestDist = Infinity;
      for (const item of interactables) {
        const dist = Math.hypot(position.x - item.x, position.z - item.z);
        if (dist <= item.radius && dist < bestDist) {
          best = item;
          bestDist = dist;
        }
      }
      return best;
    },
    setActive(id) {
      activeId = id;
    },
    findDuck() {
      duckFound = true;
    },
    spawnDust,
    update(time, dt) {
      elapsed = time;
      for (const update of updaters) update(time, dt);
    },
    get elapsed() {
      return elapsed;
    },
  };
}
