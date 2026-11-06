import * as BABYLON from "@babylonjs/core";
import type { BoltAmmoType, PlayerWeaponStats } from "@/helmsdeep/types";
import type { BabylonZombie } from "./horde";
import type { PowderBarrel } from "./world";

export interface BabylonArrowProjectile {
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  vel: BABYLON.Vector3;
  ammoType: BoltAmmoType;
  damage: number;
  pierceLeft: number;
  isCrit: boolean;
  dead: boolean;
  hitIds: Set<number>;
}

export class BabylonHelmsPlayer {
  public scene: BABYLON.Scene;
  public camera: BABYLON.FreeCamera;
  public weaponRoot: BABYLON.TransformNode;
  public projectiles: BabylonArrowProjectile[] = [];

  public currentX = 0;
  public currentY = 26.5;
  public pitch = -0.46;
  public yaw = 0;
  public isAiming = false;
  public currentAmmo: BoltAmmoType = "bodkin";

  public stats: PlayerWeaponStats = {
    damage: 55,
    critMul: 2.8,
    fireRate: 2.6,
    arrowSpeed: 112,
    pierce: 1,
    explosiveRadius: 0,
    weaponLevel: 1,
  };

  private cooldown = 0;
  private recoilZ = 0;
  private shakeTrauma = 0;

  private limbL!: BABYLON.Mesh;
  private limbR!: BABYLON.Mesh;
  private loadedBoltGroup!: BABYLON.TransformNode;
  private loadedBroadhead!: BABYLON.Mesh;

  private bodkinMat: BABYLON.StandardMaterial;
  private fireBoltMat: BABYLON.StandardMaterial;
  private frostBoltMat: BABYLON.StandardMaterial;
  private scatterBoltMat: BABYLON.StandardMaterial;
  private woodShaftMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.camera = new BABYLON.FreeCamera(
      "defenderCamera",
      new BABYLON.Vector3(this.currentX, this.currentY, -7.4),
      scene,
    );
    this.camera.minZ = 0.15;
    this.camera.maxZ = 420;
    this.camera.fov = (62 * Math.PI) / 180;
    this.camera.inputs.clear();

    this.bodkinMat = new BABYLON.StandardMaterial("bodkinBoltMat", scene);
    this.bodkinMat.emissiveColor = new BABYLON.Color3(1.0, 0.85, 0.25);
    this.bodkinMat.disableLighting = true;

    this.fireBoltMat = new BABYLON.StandardMaterial("fireBoltMat", scene);
    this.fireBoltMat.emissiveColor = new BABYLON.Color3(1.0, 0.38, 0.05);
    this.fireBoltMat.disableLighting = true;

    this.frostBoltMat = new BABYLON.StandardMaterial("frostBoltMat", scene);
    this.frostBoltMat.emissiveColor = new BABYLON.Color3(0.25, 0.85, 1.0);
    this.frostBoltMat.disableLighting = true;

    this.scatterBoltMat = new BABYLON.StandardMaterial("scatterBoltMat", scene);
    this.scatterBoltMat.emissiveColor = new BABYLON.Color3(0.78, 0.38, 1.0);
    this.scatterBoltMat.disableLighting = true;

    this.woodShaftMat = new BABYLON.StandardMaterial("impaledShaftMat", scene);
    this.woodShaftMat.diffuseColor = new BABYLON.Color3(0.32, 0.2, 0.1);

    this.weaponRoot = this.buildCrossbowMesh();
    this.weaponRoot.parent = this.camera;
    this.updateCamera(0.016);
  }

  private getAmmoMaterial(ammo: BoltAmmoType): BABYLON.StandardMaterial {
    if (ammo === "fire") return this.fireBoltMat;
    if (ammo === "frost") return this.frostBoltMat;
    if (ammo === "scatter") return this.scatterBoltMat;
    return this.bodkinMat;
  }

  public setAmmo(ammo: BoltAmmoType) {
    this.currentAmmo = ammo;
    if (this.loadedBroadhead) {
      this.loadedBroadhead.material = this.getAmmoMaterial(ammo);
    }
  }

  public cycleAmmo(): BoltAmmoType {
    const order: BoltAmmoType[] = ["bodkin", "fire", "frost", "scatter"];
    const nextIdx = (order.indexOf(this.currentAmmo) + 1) % order.length;
    this.setAmmo(order[nextIdx]);
    return this.currentAmmo;
  }

  public addCameraShake(amount: number) {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  private buildCrossbowMesh(): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode("crossbowRoot", this.scene);

    const woodMat = new BABYLON.StandardMaterial("cbWoodMat", this.scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.24, 0.14, 0.08);
    woodMat.specularColor = new BABYLON.Color3(0.15, 0.1, 0.06);
    woodMat.specularPower = 24;

    const steelMat = new BABYLON.StandardMaterial("cbSteelMat", this.scene);
    steelMat.diffuseColor = new BABYLON.Color3(0.2, 0.23, 0.27);
    steelMat.specularColor = new BABYLON.Color3(0.75, 0.8, 0.88);
    steelMat.specularPower = 64;

    const goldMat = new BABYLON.StandardMaterial("cbGoldMat", this.scene);
    goldMat.diffuseColor = new BABYLON.Color3(0.58, 0.44, 0.15);
    goldMat.specularColor = new BABYLON.Color3(0.85, 0.7, 0.3);
    goldMat.specularPower = 48;

    const stringMat = new BABYLON.StandardMaterial("cbStringMat", this.scene);
    stringMat.diffuseColor = new BABYLON.Color3(0.32, 0.28, 0.22);

    const stock = BABYLON.MeshBuilder.CreateBox(
      "cbStock",
      { width: 0.048, height: 0.062, depth: 0.56 },
      this.scene,
    );
    stock.position.set(0.34, -0.31, -0.58);
    stock.material = woodMat;
    stock.parent = root;

    const rail = BABYLON.MeshBuilder.CreateBox(
      "cbRail",
      { width: 0.024, height: 0.012, depth: 0.52 },
      this.scene,
    );
    rail.position.set(0.34, -0.275, -0.6);
    rail.material = steelMat;
    rail.parent = root;

    const housing = BABYLON.MeshBuilder.CreateBox(
      "cbHousing",
      { width: 0.058, height: 0.068, depth: 0.12 },
      this.scene,
    );
    housing.position.set(0.34, -0.305, -0.52);
    housing.material = goldMat;
    housing.parent = root;

    // Animated Swept Steel Prod Limbs
    this.limbL = BABYLON.MeshBuilder.CreateBox(
      "cbLimbL",
      { width: 0.26, height: 0.022, depth: 0.036 },
      this.scene,
    );
    this.limbL.rotation.y = 0.28;
    this.limbL.position.set(0.21, -0.285, -0.82);
    this.limbL.material = steelMat;
    this.limbL.parent = root;

    this.limbR = BABYLON.MeshBuilder.CreateBox(
      "cbLimbR",
      { width: 0.26, height: 0.022, depth: 0.036 },
      this.scene,
    );
    this.limbR.rotation.y = -0.28;
    this.limbR.position.set(0.47, -0.285, -0.82);
    this.limbR.material = steelMat;
    this.limbR.parent = root;

    const bridle = BABYLON.MeshBuilder.CreateBox(
      "cbBridle",
      { width: 0.072, height: 0.076, depth: 0.055 },
      this.scene,
    );
    bridle.position.set(0.34, -0.295, -0.84);
    bridle.material = goldMat;
    bridle.parent = root;

    for (const side of [-1, 1]) {
      const halfString = BABYLON.MeshBuilder.CreateCylinder(
        `cbString_${side}`,
        { diameter: 0.005, height: 0.26, tessellation: 6 },
        this.scene,
      );
      halfString.rotation.z = Math.PI / 2;
      halfString.rotation.y = side * 0.52;
      halfString.position.set(0.34 + side * 0.11, -0.28, -0.71);
      halfString.material = stringMat;
      halfString.parent = root;
    }

    // Loaded Bolt Group (animates along the flight groove during reload)
    this.loadedBoltGroup = new BABYLON.TransformNode("loadedBoltGroup", this.scene);
    this.loadedBoltGroup.parent = root;

    const shaft = BABYLON.MeshBuilder.CreateCylinder(
      "cbBoltShaft",
      { diameter: 0.012, height: 0.4, tessellation: 8 },
      this.scene,
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0.34, -0.26, -0.68);
    shaft.material = woodMat;
    shaft.parent = this.loadedBoltGroup;

    this.loadedBroadhead = BABYLON.MeshBuilder.CreateCylinder(
      "cbBroadhead",
      { diameterTop: 0.002, diameterBottom: 0.03, height: 0.1, tessellation: 4 },
      this.scene,
    );
    this.loadedBroadhead.rotation.x = -Math.PI / 2;
    this.loadedBroadhead.position.set(0.34, -0.26, -0.91);
    this.loadedBroadhead.material = this.bodkinMat;
    this.loadedBroadhead.parent = this.loadedBoltGroup;

    return root;
  }

  public updateCamera(dt = 0.016) {
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.2);
    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.35;
    const sx = (Math.random() - 0.5) * shakeMag;
    const sy = (Math.random() - 0.5) * shakeMag;

    this.camera.position.set(this.currentX + sx, this.currentY + sy, -7.4);

    const q = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, this.pitch, 0);
    this.camera.rotationQuaternion = q;

    const targetFov = ((this.isAiming ? 32 : 62) * Math.PI) / 180;
    this.camera.fov += (targetFov - this.camera.fov) * 0.22;

    if (this.weaponRoot) {
      const targetX = this.isAiming ? -0.32 : 0;
      const targetY = this.isAiming ? 0.06 : 0;
      this.weaponRoot.position.x += (targetX - this.weaponRoot.position.x) * 0.25;
      this.weaponRoot.position.y += (targetY - this.weaponRoot.position.y) * 0.25;
      this.weaponRoot.position.z = this.recoilZ;

      // Animate steel prod limbs & bolt draw during reload
      const reloadRatio = Math.min(1, this.cooldown * this.stats.fireRate);
      if (this.limbL && this.limbR) {
        const flex = (1 - reloadRatio) * 0.28 + 0.06;
        this.limbL.rotation.y = flex;
        this.limbR.rotation.y = -flex;
      }
      if (this.loadedBoltGroup) {
        this.loadedBoltGroup.position.z = -reloadRatio * 0.16;
      }
    }
  }

  public look(dx: number, dy: number) {
    const sens = this.isAiming ? 0.0016 : 0.0028;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;

    this.yaw = Math.max(-1.45, Math.min(1.45, this.yaw));
    this.pitch = Math.max(-1.1, Math.min(0.45, this.pitch));
  }

  public strafe(dx: number) {
    this.currentX = Math.max(-30, Math.min(30, this.currentX + dx));
  }

  public elevate(dy: number) {
    this.currentY = Math.max(23.5, Math.min(34.0, this.currentY + dy));
  }

  public canShoot(): boolean {
    return this.cooldown <= 0;
  }

  public shoot(): BabylonArrowProjectile | null {
    if (!this.canShoot()) return null;

    this.cooldown = 1 / this.stats.fireRate;
    this.recoilZ = 0.2;

    const forward = this.camera.getDirection(new BABYLON.Vector3(0, 0, -1)).normalize();
    const right = this.camera.getDirection(new BABYLON.Vector3(1, 0, 0)).normalize();
    const muzzle = this.camera.position.add(forward.scale(1.2));
    muzzle.y -= 0.15;

    const angles = this.currentAmmo === "scatter" ? [-0.045, 0, 0.045] : [0];
    let firstProj: BabylonArrowProjectile | null = null;

    for (const spread of angles) {
      const dir = forward.add(right.scale(spread)).normalize();
      const boltMesh = BABYLON.MeshBuilder.CreateCylinder(
        "flyingBolt",
        { diameterTop: 0.025, diameterBottom: 0.095, height: 1.55, tessellation: 8 },
        this.scene,
      );
      boltMesh.position.copyFrom(muzzle);
      boltMesh.rotationQuaternion = this.camera.rotationQuaternion?.clone() ?? null;
      boltMesh.rotate(BABYLON.Axis.X, -Math.PI / 2, BABYLON.Space.LOCAL);
      boltMesh.material = this.getAmmoMaterial(this.currentAmmo);

      const proj: BabylonArrowProjectile = {
        mesh: boltMesh,
        pos: muzzle.clone(),
        vel: dir.scale(this.stats.arrowSpeed),
        ammoType: this.currentAmmo,
        damage:
          this.currentAmmo === "scatter"
            ? Math.round(this.stats.damage * 0.72)
            : this.stats.damage,
        pierceLeft:
          this.currentAmmo === "bodkin" ? this.stats.pierce + 1 : this.stats.pierce,
        isCrit: false,
        dead: false,
        hitIds: new Set(),
      };

      this.projectiles.push(proj);
      if (!firstProj) firstProj = proj;
    }

    return firstProj;
  }

  private stickBoltIntoZombie(z: BabylonZombie, isHeadshot: boolean) {
    const stuck = BABYLON.MeshBuilder.CreateCylinder(
      "impaledBolt",
      { diameter: 0.035, height: 0.95, tessellation: 6 },
      this.scene,
    );
    stuck.material = this.woodShaftMat;
    stuck.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.25;
    stuck.rotation.y = (Math.random() - 0.5) * 0.35;
    if (isHeadshot) {
      stuck.parent = z.headMesh;
      stuck.position.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.35);
    } else {
      stuck.parent = z.root;
      stuck.position.set((Math.random() - 0.5) * 0.45, 2.2 + (Math.random() - 0.5) * 0.6, 0.45);
    }
  }

  public update(
    dt: number,
    zombies: BabylonZombie[],
    powderBarrels: PowderBarrel[],
    onHit: (
      zombie: BabylonZombie,
      dmg: number,
      isHeadshot: boolean,
      hitPos: BABYLON.Vector3,
      ammoType: BoltAmmoType,
      pierceCount: number,
    ) => void,
    onBarrelDetonate: (barrel: PowderBarrel) => void,
  ) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoilZ = Math.max(0, this.recoilZ - dt * 1.5);
    this.updateCamera(dt);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      p.vel.y -= 3.6 * dt;
      p.pos.addInPlace(p.vel.scale(dt));
      p.mesh.position.copyFrom(p.pos);

      // 1. Check Powder Barrel Collisions
      for (const barrel of powderBarrels) {
        if (barrel.detonated) continue;
        if (BABYLON.Vector3.Distance(p.pos, barrel.pos) <= barrel.radius) {
          onBarrelDetonate(barrel);
          p.dead = true;
          break;
        }
      }
      if (p.dead) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // 2. Check Zombie Head & Body Collisions
      for (const z of zombies) {
        if (z.dead || p.hitIds.has(z.id)) continue;

        const headWorldPos = z.headMesh.getAbsolutePosition();
        const distHead = BABYLON.Vector3.Distance(p.pos, headWorldPos);

        if (distHead <= z.headRadius * 1.38) {
          p.isCrit = true;
          p.hitIds.add(z.id);
          this.stickBoltIntoZombie(z, true);
          onHit(
            z,
            p.damage * this.stats.critMul,
            true,
            p.pos.clone(),
            p.ammoType,
            p.hitIds.size,
          );
          p.pierceLeft -= 1;
          if (p.pierceLeft <= 0) {
            p.dead = true;
            break;
          }
          continue;
        }

        const bodyCenter = new BABYLON.Vector3(z.pos.x, z.pos.y + 2.0, z.pos.z);
        const distBody = BABYLON.Vector3.Distance(p.pos, bodyCenter);
        if (distBody <= z.radius * 1.25) {
          p.hitIds.add(z.id);
          this.stickBoltIntoZombie(z, false);
          onHit(z, p.damage, false, p.pos.clone(), p.ammoType, p.hitIds.size);
          p.pierceLeft -= 1;
          if (p.pierceLeft <= 0) {
            p.dead = true;
            break;
          }
        }
      }

      if (p.pos.y <= 0 || p.pos.z <= -195 || p.pos.z >= 15 || p.dead) {
        p.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  public clear() {
    for (const p of this.projectiles) {
      p.mesh.dispose();
    }
    this.projectiles = [];
  }
}
