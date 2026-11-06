import * as BABYLON from "@babylonjs/core";
import { type TurretType, TURRET_SPECS } from "@/helmsdeep/types";
import type { BabylonZombie } from "./horde";
import type { BabylonHelmsVFX } from "./vfx";
import type { HelmsAudio } from "@/helmsdeep/audio";

export interface BabylonTurretProjectile {
  type: TurretType;
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  vel: BABYLON.Vector3;
  damage: number;
  pierce: number;
  radius: number;
  isArc: boolean;
  isFlaming?: boolean;
  dead: boolean;
}

export interface BabylonActiveTurret {
  socketId: number;
  type: TurretType;
  level: number;
  pos: BABYLON.Vector3;
  root: BABYLON.TransformNode;
  pivot: BABYLON.TransformNode;
  cooldown: number;
  range: number;
  damage: number;
  rate: number;
}

export class BabylonTurretManager {
  public scene: BABYLON.Scene;
  public turrets: Map<number, BabylonActiveTurret> = new Map();
  public projectiles: BabylonTurretProjectile[] = [];

  private woodMat: BABYLON.StandardMaterial;
  private ironMat: BABYLON.StandardMaterial;
  private goldMat: BABYLON.StandardMaterial;
  private fireMat: BABYLON.StandardMaterial;
  private boltMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.woodMat = new BABYLON.StandardMaterial("turretWoodMat", scene);
    this.woodMat.diffuseColor = new BABYLON.Color3(0.42, 0.28, 0.16);
    this.woodMat.emissiveColor = new BABYLON.Color3(0.08, 0.05, 0.02);

    this.ironMat = new BABYLON.StandardMaterial("turretIronMat", scene);
    this.ironMat.diffuseColor = new BABYLON.Color3(0.32, 0.36, 0.42);
    this.ironMat.emissiveColor = new BABYLON.Color3(0.08, 0.1, 0.12);
    this.ironMat.specularColor = new BABYLON.Color3(0.75, 0.8, 0.88);

    this.goldMat = new BABYLON.StandardMaterial("turretGoldMat", scene);
    this.goldMat.diffuseColor = new BABYLON.Color3(0.88, 0.68, 0.22);
    this.goldMat.emissiveColor = new BABYLON.Color3(0.22, 0.16, 0.04);

    this.fireMat = new BABYLON.StandardMaterial("turretFireMat", scene);
    this.fireMat.emissiveColor = new BABYLON.Color3(1.0, 0.48, 0.08);
    this.fireMat.disableLighting = true;

    this.boltMat = new BABYLON.StandardMaterial("turretBoltMat", scene);
    this.boltMat.emissiveColor = new BABYLON.Color3(1.0, 0.86, 0.25);
    this.boltMat.disableLighting = true;
  }

  public buildTurret(socketId: number, pos: BABYLON.Vector3, type: TurretType): BabylonActiveTurret {
    this.destroyTurret(socketId);

    const spec = TURRET_SPECS[type];
    const root = new BABYLON.TransformNode(`turret_${socketId}`, this.scene);
    root.position.copyFrom(pos);

    const pivot = new BABYLON.TransformNode(`turretPivot_${socketId}`, this.scene);
    pivot.position.y = 0.7;
    pivot.parent = root;

    const pedestal = BABYLON.MeshBuilder.CreateCylinder(
      `pedestal_${socketId}`,
      { diameterTop: 1.4, diameterBottom: 1.9, height: 0.7, tessellation: 14 },
      this.scene,
    );
    pedestal.position.y = 0.35;
    pedestal.material = this.ironMat;
    pedestal.parent = root;

    if (type === "repeater") {
      const body = BABYLON.MeshBuilder.CreateCapsule(
        `repBody_${socketId}`,
        { radius: 0.24, height: 1.5, tessellation: 10 },
        this.scene,
      );
      body.rotation.x = Math.PI / 2;
      body.material = this.woodMat;
      body.parent = pivot;

      const bow = BABYLON.MeshBuilder.CreateTorus(
        `repBow_${socketId}`,
        { diameter: 1.6, thickness: 0.14, tessellation: 18 },
        this.scene,
      );
      bow.position.set(0, 0.1, -0.5);
      bow.material = this.ironMat;
      bow.parent = pivot;
    } else if (type === "oil") {
      const cauldron = BABYLON.MeshBuilder.CreateSphere(
        `oilCauldron_${socketId}`,
        { diameter: 1.65, slice: 0.75, segments: 14 },
        this.scene,
      );
      cauldron.rotation.x = Math.PI;
      cauldron.position.set(0, 0.65, -0.35);
      cauldron.material = this.ironMat;
      cauldron.parent = pivot;

      const lava = BABYLON.MeshBuilder.CreateDisc(
        `oilLava_${socketId}`,
        { radius: 0.72, tessellation: 14 },
        this.scene,
      );
      lava.rotation.x = Math.PI / 2;
      lava.position.set(0, 0.55, -0.35);
      lava.material = this.fireMat;
      lava.parent = pivot;
    } else if (type === "mortar") {
      const frame = BABYLON.MeshBuilder.CreateCylinder(
        `mortarBarrel_${socketId}`,
        { diameterTop: 0.95, diameterBottom: 1.15, height: 1.7, tessellation: 14 },
        this.scene,
      );
      frame.rotation.x = -Math.PI / 4;
      frame.position.set(0, 0.55, -0.2);
      frame.material = this.ironMat;
      frame.parent = pivot;

      const payload = BABYLON.MeshBuilder.CreateSphere(
        `mortarCore_${socketId}`,
        { diameter: 0.7, segments: 10 },
        this.scene,
      );
      payload.position.set(0, 1.0, -0.65);
      payload.material = this.fireMat;
      payload.parent = pivot;
    } else {
      const rail = BABYLON.MeshBuilder.CreateCapsule(
        `balRail_${socketId}`,
        { radius: 0.28, height: 2.4, tessellation: 12 },
        this.scene,
      );
      rail.rotation.x = Math.PI / 2;
      rail.material = this.woodMat;
      rail.parent = pivot;

      const arms = BABYLON.MeshBuilder.CreateCapsule(
        `balArms_${socketId}`,
        { radius: 0.16, height: 2.3, tessellation: 10 },
        this.scene,
      );
      arms.rotation.z = Math.PI / 2;
      arms.position.set(0, 0.2, -0.85);
      arms.material = this.goldMat;
      arms.parent = pivot;
    }

    const turret: BabylonActiveTurret = {
      socketId,
      type,
      level: 1,
      pos: pos.clone(),
      root,
      pivot,
      cooldown: 0,
      range: spec.range,
      damage: spec.damage,
      rate: spec.rate,
    };

    this.turrets.set(socketId, turret);
    return turret;
  }

  public upgradeTurret(socketId: number): boolean {
    const turret = this.turrets.get(socketId);
    if (!turret || turret.level >= 3) return false;

    turret.level += 1;
    turret.damage = Math.round(turret.damage * 1.45);
    turret.rate *= 1.22;

    const halo = BABYLON.MeshBuilder.CreateTorus(
      `turretHalo_${socketId}_${turret.level}`,
      { diameter: 1.5 + turret.level * 0.25, thickness: 0.1, tessellation: 20 },
      this.scene,
    );
    halo.position.y = 1.4 + turret.level * 0.28;
    halo.material = this.goldMat;
    halo.parent = turret.root;
    return true;
  }

  public destroyTurret(socketId: number) {
    const t = this.turrets.get(socketId);
    if (t) {
      t.root.dispose();
      this.turrets.delete(socketId);
    }
  }

  public spawnDirectBolt(
    startPos: BABYLON.Vector3,
    target: BabylonZombie,
    damage: number,
    isFlaming = false,
  ) {
    const aimPoint = target.pos.add(
      new BABYLON.Vector3((Math.random() - 0.5) * 0.9, 2.0, (Math.random() - 0.5) * 0.9),
    );
    const dir = aimPoint.subtract(startPos).normalize();
    const bolt = BABYLON.MeshBuilder.CreateSphere(
      "sentinelArrow",
      { diameter: 0.3, segments: 6 },
      this.scene,
    );
    bolt.position.copyFrom(startPos);
    bolt.material = isFlaming ? this.fireMat : this.boltMat;

    this.projectiles.push({
      type: "repeater",
      mesh: bolt,
      pos: startPos.clone(),
      vel: dir.scale(75),
      damage,
      pierce: 1,
      radius: 0.65,
      isArc: false,
      isFlaming,
      dead: false,
    });
  }

  public update(
    dt: number,
    zombies: BabylonZombie[],
    vfx: BabylonHelmsVFX,
    audio: HelmsAudio,
    gateZ: number,
    onKill: (z: BabylonZombie) => void,
  ) {
    for (const [, turret] of this.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - dt);

      let bestTarget: BabylonZombie | null = null;
      let closestDist = turret.range;

      for (const z of zombies) {
        if (z.dead) continue;
        const d = BABYLON.Vector3.Distance(turret.pos, z.pos);
        if (d <= turret.range && d < closestDist) {
          closestDist = d;
          bestTarget = z;
        }
      }

      if (bestTarget) {
        const dx = bestTarget.pos.x - turret.pos.x;
        const dz = bestTarget.pos.z - turret.pos.z;
        turret.pivot.rotation.y = Math.atan2(dx, dz) + Math.PI;

        if (turret.cooldown <= 0) {
          turret.cooldown = 1 / turret.rate;
          this.fireTurret(turret, bestTarget, vfx, audio, gateZ);
        }
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.isArc) {
        p.vel.y -= 18 * dt;
        p.pos.addInPlace(p.vel.scale(dt));
        p.mesh.position.copyFrom(p.pos);

        if (p.pos.y <= 0.3 || p.pos.z <= -190) {
          vfx.spawnExplosion(p.pos, p.radius);
          audio.playExplosion();

          for (const z of zombies) {
            if (z.dead) continue;
            const d = BABYLON.Vector3.Distance(p.pos, z.pos);
            if (d <= p.radius) {
              const falloff = 1 - d / p.radius;
              z.hp -= Math.round(p.damage * Math.max(0.4, falloff));
              z.burnTimer = 3.5;
              z.burnDps = 18;
              if (z.hp <= 0) {
                z.dead = true;
                onKill(z);
              }
            }
          }

          p.mesh.dispose();
          this.projectiles.splice(i, 1);
        }
      } else {
        p.pos.addInPlace(p.vel.scale(dt));
        p.mesh.position.copyFrom(p.pos);

        for (const z of zombies) {
          if (z.dead) continue;
          const d = BABYLON.Vector3.Distance(
            p.pos,
            new BABYLON.Vector3(z.pos.x, z.pos.y + 1.8, z.pos.z),
          );
          if (d <= z.radius + 0.5) {
            z.hp -= p.damage;
            if (p.isFlaming) {
              z.burnTimer = 3.0;
              z.burnDps = 15;
            }
            vfx.spawnHitSparks(p.pos, 5);
            audio.playHit();

            if (z.hp <= 0) {
              z.dead = true;
              onKill(z);
            }

            p.pierce -= 1;
            if (p.pierce <= 0) {
              p.dead = true;
              break;
            }
          }
        }

        if (p.pos.y <= 0 || p.pos.z <= -190 || p.dead) {
          p.mesh.dispose();
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private fireTurret(
    turret: BabylonActiveTurret,
    target: BabylonZombie,
    vfx: BabylonHelmsVFX,
    audio: HelmsAudio,
    gateZ: number,
  ) {
    const muzzle = turret.pos.add(new BABYLON.Vector3(0, 1.3, -0.6));

    if (turret.type === "oil") {
      audio.playOilSizzle();
      const pourPos = new BABYLON.Vector3(turret.pos.x * 0.5, 0, gateZ - 2.0);
      vfx.spawnGroundFire(pourPos, 6.0, 6.5, turret.damage);
      return;
    }

    if (turret.type === "mortar") {
      audio.playExplosion();
      const travelTime = 1.45;
      const vx = (target.pos.x - muzzle.x) / travelTime;
      const vz = (target.pos.z - muzzle.z) / travelTime;
      const vy = (0.3 - muzzle.y + 0.5 * 18 * travelTime * travelTime) / travelTime;

      const orb = BABYLON.MeshBuilder.CreateSphere(
        "mortarBomb",
        { diameter: 0.9, segments: 8 },
        this.scene,
      );
      orb.position.copyFrom(muzzle);
      orb.material = this.fireMat;

      this.projectiles.push({
        type: "mortar",
        mesh: orb,
        pos: muzzle,
        vel: new BABYLON.Vector3(vx, vy, vz),
        damage: turret.damage,
        pierce: 99,
        radius: 7.5,
        isArc: true,
        dead: false,
      });
      return;
    }

    const aimPoint = target.pos.add(new BABYLON.Vector3(0, 1.8, 0));
    const dir = aimPoint.subtract(muzzle).normalize();
    const speed = turret.type === "ballista" ? 85 : 70;
    audio.playShoot(turret.type === "ballista" ? 1.35 : 0.85);

    const bolt = BABYLON.MeshBuilder.CreateSphere(
      "turretShot",
      { diameter: turret.type === "ballista" ? 0.38 : 0.24, segments: 6 },
      this.scene,
    );
    bolt.position.copyFrom(muzzle);
    bolt.material = this.boltMat;

    this.projectiles.push({
      type: turret.type,
      mesh: bolt,
      pos: muzzle,
      vel: dir.scale(speed),
      damage: turret.damage,
      pierce: turret.type === "ballista" ? 3 + turret.level : 1,
      radius: 0.6,
      isArc: false,
      dead: false,
    });
  }

  public clear() {
    for (const [, t] of this.turrets) {
      t.root.dispose();
    }
    this.turrets.clear();

    for (const p of this.projectiles) {
      p.mesh.dispose();
    }
    this.projectiles = [];
  }
}
