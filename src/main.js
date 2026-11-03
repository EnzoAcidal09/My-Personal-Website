import * as THREE from "../vendor/three.module.js";
import { buildWorld, SKY_COLOR, WALK_BOUNDS } from "./world.js";
import { Player } from "./player.js";
import { PortfolioUI } from "./ui.js";
import { Chiptune } from "./audio.js";

// The floating 3D signs use the pixel font on a canvas, so make sure the
// local font files are ready before the world is built.
try {
  await Promise.all([
    document.fonts.load('32px "Press Start 2P"'),
    document.fonts.load('24px "VT323"'),
  ]);
} catch (error) {
  console.warn("Pixel fonts failed to load; falling back to system fonts.", error);
}

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 300);
const CAMERA_OFFSET = new THREE.Vector3(14, 17, 14);
const CAMERA_TARGET_Y = 0.95;

let viewWidth = 32;
let viewHeight = 18;

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  const frustumWidth = aspect >= 1 ? 17.5 * aspect : 15;
  const frustumHeight = frustumWidth / aspect;
  viewWidth = frustumWidth;
  viewHeight = frustumHeight;

  camera.left = -frustumWidth / 2;
  camera.right = frustumWidth / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.updateProjectionMatrix();

  const targetWidth = aspect >= 1 ? 640 : 360;
  const targetHeight = aspect >= 1 ? 360 : 640;
  renderer.setSize(targetWidth, targetHeight, false);
}

resize();
window.addEventListener("resize", resize);

/* Lights ------------------------------------------------------------------ */

const hemisphere = new THREE.HemisphereLight(0xdff6ff, 0x5a7a45, 1.55);
scene.add(hemisphere);

const ambient = new THREE.AmbientLight(0x9ec6d8, 0.35);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff1cf, 2.35);
sun.position.set(18, 27, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -32;
sun.shadow.camera.right = 32;
sun.shadow.camera.top = 32;
sun.shadow.camera.bottom = -32;
sun.shadow.camera.near = 4;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

/* World, player, UI ------------------------------------------------------- */

const world = buildWorld(scene);
const player = new Player(scene, { x: 0, z: 14.5 });
const audio = new Chiptune();
const ui = new PortfolioUI({ audio });

const visited = new Set();
let secretFound = false;
let started = false;
let introT = 0;
let orbitAngle = 2.2;
let elapsed = 0;
let promptId = null;
let activeInteractable = null;

ui.updateJournal(visited, secretFound);

const followTarget = new THREE.Vector3(player.group.position.x, CAMERA_TARGET_Y, player.group.position.z);
const desiredTarget = new THREE.Vector3();
const orbitPos = new THREE.Vector3();
const followPos = new THREE.Vector3();
const introPos = new THREE.Vector3();
const introTarget = new THREE.Vector3();
const camTarget = new THREE.Vector3(0, 1.2, 0);
const screenRight = new THREE.Vector3(1, 0, -1).normalize();
const screenUp = new THREE.Vector3(-1, 0, -1).normalize();
const moveVec = new THREE.Vector3();
const joystickVec = { x: 0, y: 0 };

camera.zoom = 0.52;
camera.updateProjectionMatrix();

ui.onStart = () => {
  started = true;
  orbitAngle = elapsed * 0.055 + 2.2;
  introT = 0;
  followTarget.set(player.group.position.x, CAMERA_TARGET_Y, player.group.position.z);
  window.setTimeout(() => {
    const touch = document.body.classList.contains("touch-mode");
    ui.toast(
      touch ? "USE THE JOYSTICK · TAP E TO INTERACT" : "WASD / ARROWS TO MOVE · E TO INTERACT",
      { icon: ">" },
    );
  }, 900);
};

ui.onAction = (item) => {
  if (item) interact(item);
};

function markVisited(id) {
  if (visited.has(id)) return;
  visited.add(id);
  ui.updateJournal(visited, secretFound);
  const label = id === "about" ? "THE COTTAGE" : id === "projects" ? "THE ARCADE" : id === "skills" ? "THE CRYSTALS" : "THE CAMPSITE";
  ui.toast(`JOURNAL +1 · ${label}`, { icon: "+" });
  if (visited.size === 4) {
    window.setTimeout(() => {
      ui.toast("ISLE COMPLETE · JOURNAL FULL", { icon: "!", variant: "secret" });
      ui.celebrate({ complete: true });
    }, 700);
  }
}

function interact(item) {
  if (item.kind === "zone") {
    ui.openZone(item.id);
    markVisited(item.id);
  } else if (item.kind === "help") {
    ui.openHelp();
  } else if (item.kind === "secret") {
    ui.openSecret();
    if (!secretFound) {
      secretFound = true;
      world.findDuck();
      ui.updateJournal(visited, secretFound);
      ui.toast("SECRET FOUND · QUACKERS", { icon: "*", variant: "secret" });
      window.setTimeout(() => {
        ui.celebrate({ sound: false });
        audio.sfx("secret");
      }, 300);
    }
  }
}

/* Input ------------------------------------------------------------------- */

const keys = new Set();
let joystickPointer = null;
const joystick = document.getElementById("joystick");
const knob = document.getElementById("joystick-knob");
const touchAction = document.getElementById("touch-action");
const touchRoot = document.getElementById("touch");

const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) {
  touchRoot.hidden = false;
  document.body.classList.add("touch-mode");
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (!started) return;
  if (ui.isOpen) {
    keys.clear();
    return;
  }
  if (event.repeat) return;

  if (event.code === "KeyM") {
    const muted = audio.toggle();
    ui.setSound(muted);
    if (!muted) audio.sfx("toggle");
    return;
  }
  if (event.code === "KeyH") {
    ui.openHelp();
    return;
  }
  if ((event.code === "KeyE" || event.code === "Space" || event.code === "Enter") && activeInteractable) {
    interact(activeInteractable);
    return;
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
});

function updateJoystickFromEvent(event) {
  if (!joystick) return;
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const max = rect.width * 0.32;
  const length = Math.hypot(dx, dy);
  if (length > max) {
    dx = (dx / length) * max;
    dy = (dy / length) * max;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystickVec.x = dx / max;
  joystickVec.y = -dy / max;
}

if (isTouch && joystick) {
  joystick.addEventListener("pointerdown", (event) => {
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystickFromEvent(event);
  });
  joystick.addEventListener("pointermove", (event) => {
    if (joystickPointer !== event.pointerId) return;
    updateJoystickFromEvent(event);
  });
  const resetJoystick = (event) => {
    if (joystickPointer !== event.pointerId) return;
    joystickPointer = null;
    joystickVec.x = 0;
    joystickVec.y = 0;
    knob.style.transform = "translate(0px, 0px)";
  };
  joystick.addEventListener("pointerup", resetJoystick);
  joystick.addEventListener("pointercancel", resetJoystick);
}

if (touchAction) {
  touchAction.addEventListener("click", () => {
    if (ui.isOpen) return;
    if (activeInteractable) interact(activeInteractable);
  });
}

/* Main loop --------------------------------------------------------------- */

const clock = new THREE.Clock();

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function updateInput() {
  let x = 0;
  let y = 0;
  if (started && !ui.isOpen) {
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
    x += joystickVec.x;
    y += joystickVec.y;
  }
  moveVec.set(0, 0, 0);
  if (x !== 0 || y !== 0) {
    moveVec.addScaledVector(screenRight, x).addScaledVector(screenUp, y);
    if (moveVec.lengthSq() > 1) moveVec.normalize();
  }
  return keys.has("ShiftLeft") || keys.has("ShiftRight") || Math.hypot(joystickVec.x, joystickVec.y) > 0.75;
}

function updateCamera(dt) {
  const limitX = Math.max(0, WALK_BOUNDS - viewWidth / 2 + 3.2);
  const limitZ = Math.max(0, WALK_BOUNDS - viewHeight / 2 + 3.2);

  const desiredX = THREE.MathUtils.clamp(
    player.group.position.x + moveVec.x * 0.8,
    -limitX,
    limitX,
  );
  const desiredZ = THREE.MathUtils.clamp(
    player.group.position.z + moveVec.z * 0.8,
    -limitZ,
    limitZ,
  );
  desiredTarget.set(desiredX, CAMERA_TARGET_Y, desiredZ);
  const smoothing = 1 - Math.exp(-dt * 5.5);
  followTarget.lerp(desiredTarget, smoothing);

  if (!started) {
    orbitAngle = elapsed * 0.055 + 2.2;
    orbitPos.set(Math.cos(orbitAngle) * 31, 24, Math.sin(orbitAngle) * 31);
    camera.position.copy(orbitPos);
    camTarget.set(0, 1.1, 0);
    camera.zoom = 0.5;
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    return;
  }

  if (introT < 1) {
    introT = Math.min(1, introT + dt / 1.7);
    const ease = easeInOutCubic(introT);
    orbitPos.set(Math.cos(orbitAngle) * 31, 24, Math.sin(orbitAngle) * 31);
    followPos.copy(followTarget).add(CAMERA_OFFSET);
    introPos.lerpVectors(orbitPos, followPos, ease);
    introTarget.set(0, 1.1, 0).lerp(followTarget, ease);
    camera.position.copy(introPos);
    camera.zoom = 0.5 + 0.5 * ease;
    camera.lookAt(introTarget);
    camera.updateProjectionMatrix();
    return;
  }

  camera.zoom = 1;
  camTarget.lerp(followTarget, 1 - Math.exp(-dt * 8));
  camera.position.copy(camTarget).add(CAMERA_OFFSET);
  camera.lookAt(camTarget);
}

function frame() {
  window.requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  const running = updateInput();
  player.update(dt, moveVec, running, world.colliders);
  if (player.stepped) {
    audio.sfx("footstep");
    world.spawnDust(player.group.position);
  }

  world.update(elapsed, dt);
  updateCamera(dt);

  if (started && introT > 0.65 && !ui.isOpen) {
    activeInteractable = world.getInteractable(player.group.position);
    const nextId = activeInteractable ? activeInteractable.id : null;
    if (nextId !== promptId) {
      promptId = nextId;
      world.setActive(nextId);
      ui.setPrompt(activeInteractable);
    }
  } else {
    activeInteractable = null;
    if (promptId !== null) {
      promptId = null;
      world.setActive(null);
      ui.setPrompt(null);
    }
  }

  renderer.render(scene, camera);
}

/* Start the loop with a nice establishing shot */
camera.position.set(Math.cos(2.2) * 31, 24, Math.sin(2.2) * 31);
camera.lookAt(0, 1.1, 0);
camera.updateProjectionMatrix();
frame();

// Expose a little debug handle (handy when editing the world).
window.__isle = { scene, camera, renderer, world, player, ui, audio };
