import * as THREE from "three";
import { materials, PALETTE } from "@/game3d/models/ProceduralGeometries";

type Projectile = {
  id: string;
  kind: "flame" | "bolt" | "shell";
  mesh: THREE.Object3D;
  start: THREE.Vector3;
  target: THREE.Vector3;
  progress: number;
  speed: number;
  apex: number;
  onHit?: () => void;
};

type Shockwave = {
  mesh: THREE.Mesh;
  maxRadius: number;
  radius: number;
  speed: number;
  mat: THREE.MeshBasicMaterial;
};

type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  rotSpeed: THREE.Vector3;
};

export class VFXSystem {
  public group: THREE.Group;
  private projectiles: Projectile[] = [];
  private shockwaves: Shockwave[] = [];
  private particles: Particle[] = [];

  // Reusable projectile geometries
  private flameGeo = new THREE.SphereGeometry(0.18, 6, 6);
  private boltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5);
  private shellGeo = new THREE.DodecahedronGeometry(0.25, 0);

  // Spark / Bone particle geometries
  private sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  private boneChunkGeo = new THREE.BoxGeometry(0.12, 0.16, 0.12);

  constructor() {
    this.group = new THREE.Group();
    this.boltGeo.rotateX(Math.PI / 2);
  }

  public spawnProjectile(
    id: string,
    kind: "flame" | "bolt" | "shell",
    start: THREE.Vector3,
    target: THREE.Vector3,
    durationSeconds: number,
    onHit?: () => void,
  ) {
    let mesh: THREE.Object3D;
    let apex = 0;

    if (kind === "flame") {
      mesh = new THREE.Mesh(this.flameGeo, materials.flameGlow);
      apex = 0.5;
    } else if (kind === "bolt") {
      mesh = new THREE.Mesh(this.boltGeo, materials.bone);
      mesh.lookAt(target);
    } else {
      // Shell (Pyre mortar)
      mesh = new THREE.Mesh(this.shellGeo, materials.ironDark);
      apex = 3.5; // high mortar arc!
    }

    mesh.position.copy(start);
    this.group.add(mesh);

    this.projectiles.push({
      id,
      kind,
      mesh,
      start: start.clone(),
      target: target.clone(),
      progress: 0,
      speed: 1 / Math.max(0.1, durationSeconds),
      apex,
      onHit,
    });
  }

  public spawnExplosion(pos: THREE.Vector3, radius: number = 2.0, color: number = PALETTE.glowFlame) {
    // 1. Shockwave ring on ground
    const ringGeo = new THREE.RingGeometry(0.2, 0.5, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, 0.08, pos.z);
    this.group.add(ring);

    this.shockwaves.push({
      mesh: ring,
      maxRadius: radius,
      radius: 0.5,
      speed: radius * 3.5,
      mat: ringMat,
    });

    // 2. Fire & Debris Sparks
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(this.sparkGeo, materials.flameGlow);
      p.position.copy(pos);
      this.group.add(p);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        mesh: p,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          3 + Math.random() * 3,
          Math.sin(angle) * speed,
        ),
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        rotSpeed: new THREE.Vector3(Math.random() * 5, Math.random() * 5, 0),
      });
    }
  }

  public spawnBellToll(pos: THREE.Vector3, radius: number = 4.0) {
    // Dirge spectral shockwave
    const ringGeo = new THREE.RingGeometry(0.3, 0.7, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.glowSoul,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, 0.08, pos.z);
    this.group.add(ring);

    this.shockwaves.push({
      mesh: ring,
      maxRadius: radius,
      radius: 0.7,
      speed: radius * 2.2,
      mat: ringMat,
    });
  }

  public spawnBoneScatter(pos: THREE.Vector3) {
    // When an enemy dies, bones burst and scatter
    for (let i = 0; i < 8; i++) {
      const bone = new THREE.Mesh(this.boneChunkGeo, materials.bone);
      bone.position.copy(pos);
      this.group.add(bone);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.5;
      this.particles.push({
        mesh: bone,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          2.5 + Math.random() * 2,
          Math.sin(angle) * speed,
        ),
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        rotSpeed: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      });
    }
  }

  public update(dt: number) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += p.speed * dt;

      if (p.progress >= 1.0) {
        p.mesh.position.copy(p.target);
        if (p.onHit) p.onHit();
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Parabolic Arc: y = 4 * apex * t * (1 - t)
      const t = p.progress;
      p.mesh.position.lerpVectors(p.start, p.target, t);
      p.mesh.position.y += 4 * p.apex * t * (1 - t);

      if (p.kind === "shell") {
        p.mesh.rotation.x += dt * 8;
        p.mesh.rotation.z += dt * 6;
      }
    }

    // 2. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed * dt;
      const scale = s.radius;
      s.mesh.scale.set(scale, scale, 1);
      s.mat.opacity = Math.max(0, 1 - s.radius / s.maxRadius);

      if (s.radius >= s.maxRadius) {
        this.group.remove(s.mesh);
        this.shockwaves.splice(i, 1);
      }
    }

    // 3. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.life -= dt;
      if (part.life <= 0) {
        this.group.remove(part.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      // Gravity
      part.vel.y -= 9.8 * dt;
      part.mesh.position.x += part.vel.x * dt;
      part.mesh.position.y += part.vel.y * dt;
      part.mesh.position.z += part.vel.z * dt;

      // Ground bounce
      if (part.mesh.position.y < 0.05) {
        part.mesh.position.y = 0.05;
        part.vel.y *= -0.4;
        part.vel.x *= 0.6;
        part.vel.z *= 0.6;
      }

      part.mesh.rotation.x += part.rotSpeed.x * dt;
      part.mesh.rotation.y += part.rotSpeed.y * dt;
      part.mesh.rotation.z += part.rotSpeed.z * dt;
    }
  }

  public clear() {
    for (const p of this.projectiles) this.group.remove(p.mesh);
    for (const s of this.shockwaves) this.group.remove(s.mesh);
    for (const part of this.particles) this.group.remove(part.mesh);
    this.projectiles = [];
    this.shockwaves = [];
    this.particles = [];
  }
}
