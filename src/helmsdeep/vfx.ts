import * as THREE from "three";

export type Particle = {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scaleSpeed: number;
  fadeSpeed: number;
};

export type GroundFire = {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  pos: THREE.Vector3;
  radius: number;
  duration: number;
  dps: number;
};

export class HelmsVFX {
  public group: THREE.Group;
  private particles: Particle[] = [];
  public groundFires: GroundFire[] = [];

  // Shared geometries and materials
  private sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private bloodGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private smokeGeo = new THREE.SphereGeometry(0.35, 6, 6);
  private fireGeo = new THREE.SphereGeometry(0.5, 6, 6);

  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xffea75 });
  private bloodMat = new THREE.MeshBasicMaterial({ color: 0xaa1111 });
  private boneMat = new THREE.MeshBasicMaterial({ color: 0xddd2ba });
  private fireMat = new THREE.MeshBasicMaterial({ color: 0xff6611 });
  private smokeMat = new THREE.MeshBasicMaterial({
    color: 0x333338,
    transparent: true,
    opacity: 0.7,
  });

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  // Hit spark on armor / stone
  public spawnHitSparks(pos: THREE.Vector3, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 5 + 1,
        (Math.random() - 0.5) * 6,
      );
      this.group.add(p);
      this.particles.push({
        mesh: p,
        vel,
        life: 0.35,
        maxLife: 0.35,
        scaleSpeed: -2.0,
        fadeSpeed: 3.0,
      });
    }
  }

  // Headshot explosion - bone shards, gore, and flash
  public spawnHeadshotGore(pos: THREE.Vector3) {
    // Red blood bursts
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(this.bloodGeo, this.bloodMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 7 + 2,
        (Math.random() - 0.5) * 8,
      );
      this.group.add(p);
      this.particles.push({
        mesh: p,
        vel,
        life: 0.65,
        maxLife: 0.65,
        scaleSpeed: -0.8,
        fadeSpeed: 1.5,
      });
    }

    // Bone fragments
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(this.sparkGeo, this.boneMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 9,
      );
      this.group.add(p);
      this.particles.push({
        mesh: p,
        vel,
        life: 0.8,
        maxLife: 0.8,
        scaleSpeed: -0.4,
        fadeSpeed: 1.2,
      });
    }
  }

  // Large Mortar Fireball Explosion
  public spawnExplosion(pos: THREE.Vector3, radius = 6) {
    // Expanding fiery core
    for (let i = 0; i < 16; i++) {
      const p = new THREE.Mesh(this.fireGeo, this.fireMat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        Math.random() * 10 + 2,
        (Math.random() - 0.5) * 12,
      );
      this.group.add(p);
      this.particles.push({
        mesh: p,
        vel,
        life: 0.55,
        maxLife: 0.55,
        scaleSpeed: 2.5,
        fadeSpeed: 2.0,
      });
    }

    // Rising billowing smoke
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      p.position.set(
        pos.x + (Math.random() - 0.5) * 2,
        pos.y + 0.5,
        pos.z + (Math.random() - 0.5) * 2,
      );
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        Math.random() * 6 + 3,
        (Math.random() - 0.5) * 2.5,
      );
      this.group.add(p);
      this.particles.push({
        mesh: p,
        vel,
        life: 1.2,
        maxLife: 1.2,
        scaleSpeed: 1.8,
        fadeSpeed: 0.8,
      });
    }
  }

  // Boiling Pitch Ground Fire
  public spawnGroundFire(pos: THREE.Vector3, radius = 5, duration = 8, dps = 45) {
    const fireDiscGeo = new THREE.CylinderGeometry(radius, radius, 0.2, 12);
    const fireDiscMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.75,
    });
    const disc = new THREE.Mesh(fireDiscGeo, fireDiscMat);
    disc.position.set(pos.x, 0.1, pos.z);
    this.group.add(disc);

    const light = new THREE.PointLight(0xff5511, 3.5, radius * 2.5);
    light.position.set(pos.x, 1.5, pos.z);
    this.group.add(light);

    this.groundFires.push({
      mesh: disc,
      light,
      pos: pos.clone(),
      radius,
      duration,
      dps,
    });
  }

  public update(dt: number) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      // Gravity & velocity
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      // Scaling
      const s = Math.max(0.01, p.mesh.scale.x + p.scaleSpeed * dt);
      p.mesh.scale.set(s, s, s);

      if (p.life <= 0 || p.mesh.position.y < 0) {
        this.group.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // 2. Update Ground Fires
    for (let i = this.groundFires.length - 1; i >= 0; i--) {
      const gf = this.groundFires[i];
      gf.duration -= dt;

      // Sputter flame scale & light intensity
      const pulse = 1 + Math.sin(gf.duration * 12) * 0.15;
      gf.mesh.scale.set(pulse, 1, pulse);
      gf.light.intensity = 3.0 * pulse;

      // Spawn occasional rising fire particle
      if (Math.random() < 0.25) {
        const fp = new THREE.Mesh(this.fireGeo, this.fireMat);
        fp.position.set(
          gf.pos.x + (Math.random() - 0.5) * gf.radius * 1.4,
          0.3,
          gf.pos.z + (Math.random() - 0.5) * gf.radius * 1.4,
        );
        this.group.add(fp);
        this.particles.push({
          mesh: fp,
          vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 4 + 2, (Math.random() - 0.5) * 1.5),
          life: 0.45,
          maxLife: 0.45,
          scaleSpeed: -0.9,
          fadeSpeed: 2.0,
        });
      }

      if (gf.duration <= 0) {
        this.group.remove(gf.mesh);
        this.group.remove(gf.light);
        this.groundFires.splice(i, 1);
      }
    }
  }

  public clear() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
    }
    this.particles = [];

    for (const gf of this.groundFires) {
      this.group.remove(gf.mesh);
      this.group.remove(gf.light);
    }
    this.groundFires = [];
  }
}
