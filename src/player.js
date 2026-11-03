import * as THREE from "../vendor/three.module.js";
import { WALK_BOUNDS } from "./world.js";

const SKIN = "#e8b796";
const HAIR = "#3b2b3b";
const HOODIE = "#38b764";
const HOODIE_DARK = "#257179";
const JEANS = "#29366f";
const SHOE = "#1a1c2c";
const BACKPACK = "#ef7d57";

function makeMat(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function part(parent, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class Player {
  constructor(scene, spawn = { x: 0, z: 14.5 }) {
    this.radius = 0.34;
    this.walkSpeed = 4.1;
    this.runSpeed = 6.4;
    this.stepInterval = 0.32;
    this.stepTimer = 0;
    this.stepped = false;
    this.walkCycle = 0;
    this.moveBlend = 0;
    this.facing = Math.PI;

    this.group = new THREE.Group();
    this.group.position.set(spawn.x, 0, spawn.z);
    this.group.rotation.y = this.facing;
    scene.add(this.group);

    // contact shadow blob
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 12),
      new THREE.MeshBasicMaterial({ color: "#1a1c2c", transparent: true, opacity: 0.18, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.group.add(blob);

    this.body = new THREE.Group();
    this.group.add(this.body);

    // legs (pivot at the hip so they swing)
    this.legL = new THREE.Group();
    this.legL.position.set(-0.135, 0.64, 0);
    this.body.add(this.legL);
    part(this.legL, 0.21, 0.58, 0.23, JEANS, 0, -0.29, 0);
    part(this.legL, 0.23, 0.16, 0.3, SHOE, 0, -0.59, 0.035);

    this.legR = new THREE.Group();
    this.legR.position.set(0.135, 0.64, 0);
    this.body.add(this.legR);
    part(this.legR, 0.21, 0.58, 0.23, JEANS, 0, -0.29, 0);
    part(this.legR, 0.23, 0.16, 0.3, SHOE, 0, -0.59, 0.035);

    // torso
    this.torso = new THREE.Group();
    this.body.add(this.torso);
    part(this.torso, 0.62, 0.64, 0.36, HOODIE, 0, 1.02, 0);
    part(this.torso, 0.4, 0.18, 0.03, HOODIE_DARK, 0, 0.88, 0.19);
    part(this.torso, 0.66, 0.12, 0.38, HOODIE_DARK, 0, 0.72, 0);
    // hood
    part(this.torso, 0.42, 0.15, 0.28, HOODIE_DARK, 0, 1.28, -0.14);

    // arms
    this.armL = new THREE.Group();
    this.armL.position.set(-0.4, 1.3, 0);
    this.body.add(this.armL);
    part(this.armL, 0.18, 0.5, 0.2, HOODIE, 0, -0.25, 0);
    part(this.armL, 0.16, 0.16, 0.18, SKIN, 0, -0.55, 0);

    this.armR = new THREE.Group();
    this.armR.position.set(0.4, 1.3, 0);
    this.body.add(this.armR);
    part(this.armR, 0.18, 0.5, 0.2, HOODIE, 0, -0.25, 0);
    part(this.armR, 0.16, 0.16, 0.18, SKIN, 0, -0.55, 0);

    // backpack
    part(this.body, 0.34, 0.42, 0.2, BACKPACK, 0, 1.04, -0.27);
    part(this.body, 0.28, 0.12, 0.06, "#c9613f", 0, 1.1, -0.38);

    // head
    this.head = new THREE.Group();
    this.head.position.y = 1.57;
    this.body.add(this.head);
    part(this.head, 0.5, 0.5, 0.5, SKIN, 0, 0, 0);
    part(this.head, 0.54, 0.18, 0.54, HAIR, 0, 0.27, 0);
    part(this.head, 0.54, 0.36, 0.14, HAIR, 0, 0.09, -0.23);
    part(this.head, 0.06, 0.22, 0.12, HAIR, -0.26, 0.04, 0.1);
    part(this.head, 0.06, 0.22, 0.12, HAIR, 0.26, 0.04, 0.1);
    // eyes + mouth (front face is +z)
    part(this.head, 0.06, 0.09, 0.02, "#1a1c2c", -0.11, 0.05, 0.255);
    part(this.head, 0.06, 0.09, 0.02, "#1a1c2c", 0.11, 0.05, 0.255);
    part(this.head, 0.08, 0.03, 0.02, "#b13e53", 0, -0.12, 0.255);

    // little nose / cheek pixel
    part(this.head, 0.06, 0.04, 0.02, "#d19a78", 0, -0.02, 0.256);
  }

  collides(x, z, colliders) {
    if (Math.abs(x) > WALK_BOUNDS || Math.abs(z) > WALK_BOUNDS) return true;
    for (const collider of colliders) {
      if (collider.type === "circle") {
        const dx = x - collider.x;
        const dz = z - collider.z;
        const min = collider.r + this.radius;
        if (dx * dx + dz * dz < min * min) return true;
      } else {
        const nearestX = Math.max(collider.minX, Math.min(x, collider.maxX));
        const nearestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
        const dx = x - nearestX;
        const dz = z - nearestZ;
        if (dx * dx + dz * dz < this.radius * this.radius) return true;
      }
    }
    return false;
  }

  update(dt, move, running, colliders) {
    this.stepped = false;

    const speed = running ? this.runSpeed : this.walkSpeed;
    const vx = move.x * speed;
    const vz = move.z * speed;
    const moving = move.lengthSq() > 0.0001;

    if (moving) {
      const nextX = this.group.position.x + vx * dt;
      if (!this.collides(nextX, this.group.position.z, colliders)) {
        this.group.position.x = nextX;
      }
      const nextZ = this.group.position.z + vz * dt;
      if (!this.collides(this.group.position.x, nextZ, colliders)) {
        this.group.position.z = nextZ;
      }

      // face the direction of travel (shortest turn)
      const target = Math.atan2(vx, vz);
      let diff = target - this.facing;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.facing += diff * Math.min(1, dt * 14);
      this.group.rotation.y = this.facing;

      this.walkCycle += dt * (running ? 13.5 : 9.5);
      this.moveBlend = Math.min(1, this.moveBlend + dt * 8);
      this.stepTimer += dt;
      const interval = running ? 0.24 : this.stepInterval;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        this.stepped = true;
      }
    } else {
      this.moveBlend = Math.max(0, this.moveBlend - dt * 8);
      this.stepTimer = 0;
    }

    const swing = Math.sin(this.walkCycle) * 0.72 * this.moveBlend;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;

    const idle = Math.sin(performance.now() * 0.0018);
    const bob = Math.abs(Math.sin(this.walkCycle)) * 0.045 * this.moveBlend;
    this.body.position.y = bob;
    this.head.rotation.z = idle * 0.015 * (1 - this.moveBlend);
    this.armL.rotation.z = 0.02 + idle * 0.01;
    this.armR.rotation.z = -0.02 - idle * 0.01;
    this.torso.rotation.y = Math.sin(this.walkCycle * 0.5) * 0.035 * this.moveBlend;
    this.head.rotation.y = Math.sin(this.walkCycle * 0.5) * 0.05 * this.moveBlend;
  }
}
