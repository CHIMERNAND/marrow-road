import * as BABYLON from "@babylonjs/core";

export interface BabylonParticle {
  mesh: BABYLON.Mesh;
  vel: BABYLON.Vector3;
  life: number;
  maxLife: number;
  scaleSpeed: number;
}

export interface BabylonGroundFire {
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  radius: number;
  duration: number;
  dps: number;
}

export class BabylonHelmsVFX {
  public scene: BABYLON.Scene;
  private particles: BabylonParticle[] = [];
  public groundFires: BabylonGroundFire[] = [];

  private sparkMat: BABYLON.StandardMaterial;
  private bloodMat: BABYLON.StandardMaterial;
  private boneMat: BABYLON.StandardMaterial;
  private fireMat: BABYLON.StandardMaterial;
  private smokeMat: BABYLON.StandardMaterial;
  private groundFireMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.sparkMat = new BABYLON.StandardMaterial("vfxSparkMat", scene);
    this.sparkMat.emissiveColor = new BABYLON.Color3(1.0, 0.88, 0.35);
    this.sparkMat.disableLighting = true;

    this.bloodMat = new BABYLON.StandardMaterial("vfxBloodMat", scene);
    this.bloodMat.emissiveColor = new BABYLON.Color3(0.85, 0.12, 0.12);
    this.bloodMat.disableLighting = true;

    this.boneMat = new BABYLON.StandardMaterial("vfxBoneMat", scene);
    this.boneMat.emissiveColor = new BABYLON.Color3(0.92, 0.86, 0.72);
    this.boneMat.disableLighting = true;

    this.fireMat = new BABYLON.StandardMaterial("vfxFireMat", scene);
    this.fireMat.emissiveColor = new BABYLON.Color3(1.0, 0.45, 0.08);
    this.fireMat.disableLighting = true;

    this.smokeMat = new BABYLON.StandardMaterial("vfxSmokeMat", scene);
    this.smokeMat.diffuseColor = new BABYLON.Color3(0.25, 0.26, 0.3);
    this.smokeMat.emissiveColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    this.smokeMat.alpha = 0.65;

    this.groundFireMat = new BABYLON.StandardMaterial("vfxGroundFireMat", scene);
    this.groundFireMat.emissiveColor = new BABYLON.Color3(1.0, 0.36, 0.05);
    this.groundFireMat.alpha = 0.78;
    this.groundFireMat.disableLighting = true;
  }

  public spawnHitSparks(pos: BABYLON.Vector3, count = 6) {
    for (let i = 0; i < count; i++) {
      const m = BABYLON.MeshBuilder.CreateSphere(
        "spark",
        { diameter: 0.22, segments: 6 },
        this.scene,
      );
      m.position.copyFrom(pos);
      m.material = this.sparkMat;
      this.particles.push({
        mesh: m,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 7,
          Math.random() * 5 + 1.5,
          (Math.random() - 0.5) * 7,
        ),
        life: 0.35,
        maxLife: 0.35,
        scaleSpeed: -2.0,
      });
    }
  }

  public spawnHeadshotGore(pos: BABYLON.Vector3) {
    for (let i = 0; i < 12; i++) {
      const m = BABYLON.MeshBuilder.CreateSphere(
        "blood",
        { diameter: 0.28, segments: 6 },
        this.scene,
      );
      m.position.copyFrom(pos);
      m.material = i % 3 === 0 ? this.boneMat : this.bloodMat;
      this.particles.push({
        mesh: m,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 9,
          Math.random() * 7 + 2,
          (Math.random() - 0.5) * 9,
        ),
        life: 0.65,
        maxLife: 0.65,
        scaleSpeed: -0.9,
      });
    }
  }

  public spawnExplosion(pos: BABYLON.Vector3, _radius = 6) {
    for (let i = 0; i < 14; i++) {
      const m = BABYLON.MeshBuilder.CreateSphere(
        "expFire",
        { diameter: 0.9, segments: 8 },
        this.scene,
      );
      m.position.copyFrom(pos);
      m.material = i < 9 ? this.fireMat : this.smokeMat;
      this.particles.push({
        mesh: m,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 12,
          Math.random() * 10 + 2,
          (Math.random() - 0.5) * 12,
        ),
        life: 0.65,
        maxLife: 0.65,
        scaleSpeed: 2.2,
      });
    }
  }

  public spawnGroundFire(pos: BABYLON.Vector3, radius = 5.5, duration = 8, dps = 50) {
    const disc = BABYLON.MeshBuilder.CreateCylinder(
      "groundFireDisc",
      { diameter: radius * 2, height: 0.22, tessellation: 18 },
      this.scene,
    );
    disc.position.set(pos.x, 0.14, pos.z);
    disc.material = this.groundFireMat;

    this.groundFires.push({
      mesh: disc,
      pos: pos.clone(),
      radius,
      duration,
      dps,
    });
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addInPlace(p.vel.scale(dt));

      const s = Math.max(0.02, p.mesh.scaling.x + p.scaleSpeed * dt);
      p.mesh.scaling.setAll(s);

      if (p.life <= 0 || p.mesh.position.y < 0) {
        p.mesh.dispose();
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.groundFires.length - 1; i >= 0; i--) {
      const gf = this.groundFires[i];
      gf.duration -= dt;

      const pulse = 1 + Math.sin(gf.duration * 10) * 0.12;
      gf.mesh.scaling.set(pulse, 1, pulse);

      if (Math.random() < 0.22) {
        const fp = BABYLON.MeshBuilder.CreateSphere(
          "gfSpark",
          { diameter: 0.45, segments: 6 },
          this.scene,
        );
        fp.position.set(
          gf.pos.x + (Math.random() - 0.5) * gf.radius * 1.4,
          0.3,
          gf.pos.z + (Math.random() - 0.5) * gf.radius * 1.4,
        );
        fp.material = this.fireMat;
        this.particles.push({
          mesh: fp,
          vel: new BABYLON.Vector3(
            (Math.random() - 0.5) * 1.5,
            Math.random() * 4 + 2,
            (Math.random() - 0.5) * 1.5,
          ),
          life: 0.45,
          maxLife: 0.45,
          scaleSpeed: -0.9,
        });
      }

      if (gf.duration <= 0) {
        gf.mesh.dispose();
        this.groundFires.splice(i, 1);
      }
    }
  }

  public clear() {
    for (const p of this.particles) {
      p.mesh.dispose();
    }
    this.particles = [];

    for (const gf of this.groundFires) {
      gf.mesh.dispose();
    }
    this.groundFires = [];
  }
}
