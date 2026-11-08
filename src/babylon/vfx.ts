import * as BABYLON from "@babylonjs/core";

export interface BabylonParticle {
  mesh: BABYLON.Mesh;
  vel: BABYLON.Vector3;
  rotVel?: BABYLON.Vector3;
  life: number;
  maxLife: number;
  scaleSpeed: number;
  bounces?: boolean;
}

export interface BabylonGroundFire {
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  radius: number;
  duration: number;
  dps: number;
}

export interface BabylonShockwave {
  mesh: BABYLON.Mesh;
  mat: BABYLON.StandardMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

export class BabylonHelmsVFX {
  public scene: BABYLON.Scene;
  private particles: BabylonParticle[] = [];
  public groundFires: BabylonGroundFire[] = [];
  private shockwaves: BabylonShockwave[] = [];
  private groundDecals: BABYLON.Mesh[] = [];

  private sparkMat: BABYLON.StandardMaterial;
  private bloodMat: BABYLON.StandardMaterial;
  private bloodPoolMat: BABYLON.StandardMaterial;
  private scorchMat: BABYLON.StandardMaterial;
  private boneMat: BABYLON.StandardMaterial;
  private ironDebrisMat: BABYLON.StandardMaterial;
  private woodDebrisMat: BABYLON.StandardMaterial;
  private fireMat: BABYLON.StandardMaterial;
  private frostMat: BABYLON.StandardMaterial;
  private smokeMat: BABYLON.StandardMaterial;
  private groundFireMat: BABYLON.StandardMaterial;
  private emberMat: BABYLON.StandardMaterial;
  private stoneMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.emberMat = new BABYLON.StandardMaterial("vfxEmberMat", scene);
    this.emberMat.emissiveColor = new BABYLON.Color3(1.0, 0.62, 0.15);
    this.emberMat.disableLighting = true;

    this.stoneMat = new BABYLON.StandardMaterial("vfxStoneMat", scene);
    this.stoneMat.diffuseColor = new BABYLON.Color3(0.38, 0.4, 0.44);
    this.stoneMat.specularColor = new BABYLON.Color3(0.1, 0.12, 0.15);

    this.sparkMat = new BABYLON.StandardMaterial("vfxSparkMat", scene);
    this.sparkMat.emissiveColor = new BABYLON.Color3(1.0, 0.88, 0.35);
    this.sparkMat.disableLighting = true;

    this.bloodMat = new BABYLON.StandardMaterial("vfxBloodMat", scene);
    this.bloodMat.emissiveColor = new BABYLON.Color3(0.75, 0.08, 0.08);
    this.bloodMat.disableLighting = true;

    this.bloodPoolMat = new BABYLON.StandardMaterial("vfxBloodPoolMat", scene);
    this.bloodPoolMat.diffuseColor = new BABYLON.Color3(0.28, 0.03, 0.03);
    this.bloodPoolMat.specularColor = new BABYLON.Color3(0.65, 0.25, 0.25);
    this.bloodPoolMat.specularPower = 48;
    this.bloodPoolMat.alpha = 0.82;

    this.scorchMat = new BABYLON.StandardMaterial("vfxScorchMat", scene);
    this.scorchMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    this.scorchMat.specularColor = BABYLON.Color3.Black();
    this.scorchMat.emissiveColor = new BABYLON.Color3(0.14, 0.04, 0.01);
    this.scorchMat.alpha = 0.85;

    this.boneMat = new BABYLON.StandardMaterial("vfxBoneMat", scene);
    this.boneMat.diffuseColor = new BABYLON.Color3(0.76, 0.7, 0.58);
    this.boneMat.specularColor = new BABYLON.Color3(0.12, 0.12, 0.1);
    this.boneMat.emissiveColor = new BABYLON.Color3(0.18, 0.15, 0.11);

    this.ironDebrisMat = new BABYLON.StandardMaterial("vfxIronDebrisMat", scene);
    this.ironDebrisMat.diffuseColor = new BABYLON.Color3(0.25, 0.28, 0.32);
    this.ironDebrisMat.specularColor = new BABYLON.Color3(0.8, 0.85, 0.92);

    this.woodDebrisMat = new BABYLON.StandardMaterial("vfxWoodDebrisMat", scene);
    this.woodDebrisMat.diffuseColor = new BABYLON.Color3(0.38, 0.24, 0.12);
    this.woodDebrisMat.specularColor = new BABYLON.Color3(0.05, 0.04, 0.03);

    this.fireMat = new BABYLON.StandardMaterial("vfxFireMat", scene);
    this.fireMat.emissiveColor = new BABYLON.Color3(1.0, 0.45, 0.08);
    this.fireMat.disableLighting = true;

    this.frostMat = new BABYLON.StandardMaterial("vfxFrostMat", scene);
    this.frostMat.emissiveColor = new BABYLON.Color3(0.3, 0.85, 1.0);
    this.frostMat.disableLighting = true;

    this.smokeMat = new BABYLON.StandardMaterial("vfxSmokeMat", scene);
    this.smokeMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    this.smokeMat.specularColor = BABYLON.Color3.Black();
    this.smokeMat.alpha = 0.42;
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
          (Math.random() - 0.5) * 8,
          Math.random() * 5.5 + 1.5,
          (Math.random() - 0.5) * 8,
        ),
        life: 0.35,
        maxLife: 0.35,
        scaleSpeed: -2.0,
      });
    }
  }

  public spawnHeadshotGore(pos: BABYLON.Vector3) {
    // Arterial blood & bone mist
    for (let i = 0; i < 14; i++) {
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
          (Math.random() - 0.5) * 10,
          Math.random() * 7.5 + 2.5,
          (Math.random() - 0.5) * 10,
        ),
        life: 0.7,
        maxLife: 0.7,
        scaleSpeed: -0.8,
      });
    }

    // Popped 3D Skull / Forged Helmet flying & bouncing onto the road!
    const helmDebris = BABYLON.MeshBuilder.CreateSphere(
      "poppedSkull",
      { diameter: 0.65, segments: 8 },
      this.scene,
    );
    helmDebris.position.copyFrom(pos);
    helmDebris.material = Math.random() > 0.45 ? this.boneMat : this.ironDebrisMat;
    this.particles.push({
      mesh: helmDebris,
      vel: new BABYLON.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 6 + 4.5,
        (Math.random() - 0.5) * 6,
      ),
      rotVel: new BABYLON.Vector3(
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
      ),
      life: 2.2,
      maxLife: 2.2,
      scaleSpeed: -0.1,
      bounces: true,
    });

    this.spawnBloodPool(new BABYLON.Vector3(pos.x, 0.1, pos.z));
  }

  public spawnShieldShatter(pos: BABYLON.Vector3) {
    for (let i = 0; i < 10; i++) {
      const plank = BABYLON.MeshBuilder.CreateBox(
        "shieldPlank",
        { width: 0.45, height: 0.18, depth: 0.08 },
        this.scene,
      );
      plank.position.copyFrom(pos);
      plank.material = i % 2 === 0 ? this.woodDebrisMat : this.ironDebrisMat;
      this.particles.push({
        mesh: plank,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 9,
          Math.random() * 6 + 2,
          (Math.random() - 0.5) * 9,
        ),
        rotVel: new BABYLON.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
        life: 1.4,
        maxLife: 1.4,
        scaleSpeed: -0.15,
        bounces: true,
      });
    }
  }

  public spawnFrostBurst(pos: BABYLON.Vector3) {
    for (let i = 0; i < 10; i++) {
      const crystal = BABYLON.MeshBuilder.CreatePolyhedron(
        "frostCrystal",
        { type: 1, size: 0.22 },
        this.scene,
      );
      crystal.position.copyFrom(pos);
      crystal.material = this.frostMat;
      this.particles.push({
        mesh: crystal,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 5 + 1.5,
          (Math.random() - 0.5) * 8,
        ),
        rotVel: new BABYLON.Vector3(8, 8, 8),
        life: 0.65,
        maxLife: 0.65,
        scaleSpeed: -0.5,
      });
    }
    this.spawnShockwave(new BABYLON.Vector3(pos.x, 0.25, pos.z), 4.2, new BABYLON.Color3(0.3, 0.85, 1.0));
  }

  public spawnStoneImpact(pos: BABYLON.Vector3) {
    // Sharp fractured stone chips flying off parapet
    for (let i = 0; i < 9; i++) {
      const chip = BABYLON.MeshBuilder.CreatePolyhedron(
        "stoneChip",
        { type: 1, size: 0.12 + Math.random() * 0.14 },
        this.scene,
      );
      chip.position.copyFrom(pos);
      chip.material = this.stoneMat;
      this.particles.push({
        mesh: chip,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 2.5,
          (Math.random() - 0.5) * 8,
        ),
        rotVel: new BABYLON.Vector3(Math.random() * 16, Math.random() * 16, Math.random() * 16),
        life: 0.85,
        maxLife: 0.85,
        scaleSpeed: -0.1,
        bounces: true,
      });
    }
    // Impact spark shower
    for (let i = 0; i < 8; i++) {
      const sp = BABYLON.MeshBuilder.CreateSphere(
        "stoneSpark",
        { diameter: 0.14, segments: 4 },
        this.scene,
      );
      sp.position.copyFrom(pos);
      sp.material = this.sparkMat;
      this.particles.push({
        mesh: sp,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 11,
          Math.random() * 8 + 3,
          (Math.random() - 0.5) * 11,
        ),
        life: 0.35,
        maxLife: 0.35,
        scaleSpeed: -0.6,
      });
    }
  }

  public spawnFrostShatter(pos: BABYLON.Vector3) {
    for (let i = 0; i < 14; i++) {
      const crystal = BABYLON.MeshBuilder.CreatePolyhedron(
        "iceShard",
        { type: 2, size: 0.28 + Math.random() * 0.2 },
        this.scene,
      );
      crystal.position.copyFrom(pos);
      crystal.material = this.frostMat;
      this.particles.push({
        mesh: crystal,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 10,
          Math.random() * 8 + 2.5,
          (Math.random() - 0.5) * 10,
        ),
        rotVel: new BABYLON.Vector3(12, 12, 12),
        life: 1.1,
        maxLife: 1.1,
        scaleSpeed: -0.2,
        bounces: true,
      });
    }
    this.spawnShockwave(new BABYLON.Vector3(pos.x, 0.4, pos.z), 5.5, new BABYLON.Color3(0.4, 0.9, 1.0));
  }

  public spawnEmber(pos: BABYLON.Vector3) {
    const em = BABYLON.MeshBuilder.CreateSphere(
      "canyonEmber",
      { diameter: 0.12, segments: 4 },
      this.scene,
    );
    em.position.copyFrom(pos);
    em.material = this.emberMat;
    this.particles.push({
      mesh: em,
      vel: new BABYLON.Vector3(
        (Math.random() - 0.3) * 3.5,
        Math.random() * 2.5 + 1.2,
        (Math.random() - 0.5) * 2.5,
      ),
      life: 1.6 + Math.random() * 1.2,
      maxLife: 2.8,
      scaleSpeed: -0.04,
    });
  }

  public spawnShockwave(pos: BABYLON.Vector3, maxRadius = 8, color = new BABYLON.Color3(1.0, 0.5, 0.1)) {
    const ring = BABYLON.MeshBuilder.CreateTorus(
      "shockwaveRing",
      { diameter: 1.0, thickness: 0.16, tessellation: 24 },
      this.scene,
    );
    ring.position.set(pos.x, Math.max(0.2, pos.y), pos.z);
    const mat = new BABYLON.StandardMaterial("shockwaveMat", this.scene);
    mat.emissiveColor = color;
    mat.alpha = 0.85;
    mat.disableLighting = true;
    ring.material = mat;

    this.shockwaves.push({
      mesh: ring,
      mat,
      life: 0.48,
      maxLife: 0.48,
      maxScale: maxRadius * 2,
    });
  }

  public spawnBloodPool(pos: BABYLON.Vector3) {
    const disc = BABYLON.MeshBuilder.CreateDisc(
      "bloodPool",
      { radius: 0.85 + Math.random() * 0.65, tessellation: 14 },
      this.scene,
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(pos.x, 0.095, pos.z);
    disc.material = this.bloodPoolMat;
    this.groundDecals.push(disc);
    if (this.groundDecals.length > 40) {
      const oldest = this.groundDecals.shift();
      oldest?.dispose();
    }
  }

  public spawnScorchCrater(pos: BABYLON.Vector3, radius = 3.2) {
    const disc = BABYLON.MeshBuilder.CreateDisc(
      "scorchCrater",
      { radius, tessellation: 16 },
      this.scene,
    );
    disc.rotation.x = Math.PI / 2;
    disc.position.set(pos.x, 0.1, pos.z);
    disc.material = this.scorchMat;
    this.groundDecals.push(disc);
    if (this.groundDecals.length > 40) {
      const oldest = this.groundDecals.shift();
      oldest?.dispose();
    }
  }

  public spawnExplosion(pos: BABYLON.Vector3, radius = 6) {
    for (let i = 0; i < 18; i++) {
      const isFire = i < 12;
      const m = BABYLON.MeshBuilder.CreatePolyhedron(
        "expFire",
        { type: 1, size: isFire ? 0.38 : 0.45 },
        this.scene,
      );
      m.position.copyFrom(pos);
      m.material = isFire ? this.fireMat : this.smokeMat;
      this.particles.push({
        mesh: m,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 14,
          Math.random() * 11 + 2.5,
          (Math.random() - 0.5) * 14,
        ),
        rotVel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
        ),
        life: isFire ? 0.55 : 0.7,
        maxLife: isFire ? 0.55 : 0.7,
        scaleSpeed: isFire ? -0.45 : 0.85,
      });
    }

    this.spawnShockwave(new BABYLON.Vector3(pos.x, 0.25, pos.z), radius * 1.15, new BABYLON.Color3(1.0, 0.55, 0.12));
    this.spawnScorchCrater(new BABYLON.Vector3(pos.x, 0.1, pos.z), Math.min(4.5, radius * 0.55));
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

  public spawnFlyingHelmet(pos: BABYLON.Vector3, hitDir: BABYLON.Vector3) {
    const helmet = BABYLON.MeshBuilder.CreateCylinder(
      "flyingHornedHelmet",
      { diameterTop: 0.15, diameterBottom: 0.55, height: 0.65, tessellation: 8 },
      this.scene,
    );
    helmet.position.copyFrom(pos);
    helmet.material = this.ironDebrisMat;

    const impulse = hitDir.normalize().scale(7 + Math.random() * 5);
    impulse.y = 8 + Math.random() * 5;
    impulse.x += (Math.random() - 0.5) * 5;

    this.particles.push({
      mesh: helmet,
      vel: impulse,
      rotVel: new BABYLON.Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
      ),
      life: 3.5,
      maxLife: 3.5,
      scaleSpeed: 0,
      bounces: true,
    });
  }

  public spawnBloodFountain(pos: BABYLON.Vector3) {
    for (let i = 0; i < 14; i++) {
      const drop = BABYLON.MeshBuilder.CreateSphere(
        "bloodFountain",
        { diameter: 0.18 + Math.random() * 0.14, segments: 4 },
        this.scene,
      );
      drop.position.set(
        pos.x + (Math.random() - 0.5) * 0.2,
        pos.y,
        pos.z + (Math.random() - 0.5) * 0.2,
      );
      drop.material = this.bloodMat;
      this.particles.push({
        mesh: drop,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 6 + 4,
          (Math.random() - 0.5) * 3,
        ),
        life: 0.85,
        maxLife: 0.85,
        scaleSpeed: -0.15,
        bounces: true,
      });
    }
  }

  public spawnCulvertBreachDebris(pos: BABYLON.Vector3) {
    for (let i = 0; i < 18; i++) {
      const stone = BABYLON.MeshBuilder.CreatePolyhedron(
        "culvertStone",
        { type: 1, size: 0.6 + Math.random() * 0.65 },
        this.scene,
      );
      stone.position.copyFrom(pos);
      stone.material = this.stoneMat;
      this.particles.push({
        mesh: stone,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 18,
          Math.random() * 12 + 6,
          (Math.random() - 0.5) * 18,
        ),
        rotVel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
        ),
        life: 4.0,
        maxLife: 4.0,
        scaleSpeed: 0,
        bounces: true,
      });
    }

    for (let i = 0; i < 8; i++) {
      const bar = BABYLON.MeshBuilder.CreateCylinder(
        "culvertIronBar",
        { diameter: 0.16, height: 1.8 + Math.random() * 1.2, tessellation: 6 },
        this.scene,
      );
      bar.position.copyFrom(pos);
      bar.material = this.ironDebrisMat;
      this.particles.push({
        mesh: bar,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 16,
          Math.random() * 10 + 5,
          (Math.random() - 0.5) * 16,
        ),
        rotVel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ),
        life: 4.0,
        maxLife: 4.0,
        scaleSpeed: 0,
        bounces: true,
      });
    }

    this.spawnExplosion(pos, 10);
  }

  public spawnArmorDebris(pos: BABYLON.Vector3) {
    for (let i = 0; i < 6; i++) {
      const scrap = BABYLON.MeshBuilder.CreateBox(
        "armorScrap",
        { width: 0.35, height: 0.45, depth: 0.08 },
        this.scene,
      );
      scrap.position.copyFrom(pos);
      scrap.material = Math.random() < 0.5 ? this.ironDebrisMat : this.woodDebrisMat;
      this.particles.push({
        mesh: scrap,
        vel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 9,
          Math.random() * 7 + 3,
          (Math.random() - 0.5) * 9,
        ),
        rotVel: new BABYLON.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
        ),
        life: 2.8,
        maxLife: 2.8,
        scaleSpeed: 0,
        bounces: true,
      });
    }
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addInPlace(p.vel.scale(dt));

      if (p.rotVel) {
        p.mesh.rotation.x += p.rotVel.x * dt;
        p.mesh.rotation.y += p.rotVel.y * dt;
        p.mesh.rotation.z += p.rotVel.z * dt;
      }

      if (p.bounces && p.mesh.position.y < 0.25 && p.vel.y < 0) {
        p.mesh.position.y = 0.25;
        p.vel.y *= -0.45;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      const s = Math.max(0.02, p.mesh.scaling.x + p.scaleSpeed * dt);
      p.mesh.scaling.setAll(s);

      if (p.life <= 0 || (!p.bounces && p.mesh.position.y < 0)) {
        p.mesh.dispose();
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - Math.max(0, sw.life / sw.maxLife);
      const scale = 1 + progress * sw.maxScale;
      sw.mesh.scaling.set(scale, 1, scale);
      sw.mat.alpha = Math.max(0, (1 - progress) * 0.85);
      if (sw.life <= 0) {
        sw.mesh.dispose();
        sw.mat.dispose();
        this.shockwaves.splice(i, 1);
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

    for (const sw of this.shockwaves) {
      sw.mesh.dispose();
      sw.mat.dispose();
    }
    this.shockwaves = [];

    for (const d of this.groundDecals) {
      d.dispose();
    }
    this.groundDecals = [];

    for (const gf of this.groundFires) {
      gf.mesh.dispose();
    }
    this.groundFires = [];
  }
}
