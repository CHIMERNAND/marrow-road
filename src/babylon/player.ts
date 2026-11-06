import * as BABYLON from "@babylonjs/core";
import type { PlayerWeaponStats } from "@/helmsdeep/types";
import type { BabylonZombie } from "./horde";

export interface BabylonArrowProjectile {
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  vel: BABYLON.Vector3;
  damage: number;
  pierceLeft: number;
  isCrit: boolean;
  dead: boolean;
}

export class BabylonHelmsPlayer {
  public scene: BABYLON.Scene;
  public camera: BABYLON.FreeCamera;
  public weaponRoot: BABYLON.TransformNode;
  public projectiles: BabylonArrowProjectile[] = [];

  public currentX = 0; // Strafe along the rampart (-30 to +30)
  public currentY = 26.5; // High Watchtower vantage point overlooking gate & entire gorge
  public pitch = -0.46; // Looking down over the gatehouse (Z = -28) and canyon road
  public yaw = 0;
  public isAiming = false;

  public stats: PlayerWeaponStats = {
    damage: 52,
    critMul: 2.5,
    fireRate: 2.5,
    arrowSpeed: 105,
    pierce: 1,
    explosiveRadius: 0,
  };

  private cooldown = 0;
  private recoilZ = 0;
  private boltMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // Commanding Watchtower Camera at Y = 26.0, Z = -7.4 (Right in front of the wall lip so 0 floor occlusion!)
    this.camera = new BABYLON.FreeCamera(
      "defenderCamera",
      new BABYLON.Vector3(this.currentX, this.currentY, -7.4),
      scene,
    );
    this.camera.minZ = 0.15;
    this.camera.maxZ = 420;
    this.camera.fov = (62 * Math.PI) / 180;
    this.camera.inputs.clear(); // We handle pointer-lock mouse & WASD directly

    this.boltMat = new BABYLON.StandardMaterial("playerBoltMat", scene);
    this.boltMat.emissiveColor = new BABYLON.Color3(1.0, 0.85, 0.25);
    this.boltMat.disableLighting = true;

    this.weaponRoot = this.buildCrossbowMesh();
    this.weaponRoot.parent = this.camera;
    this.updateCamera();
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

    // Carved Dark Walnut Arbalest Stock (Tucked neatly in lower-right)
    const stock = BABYLON.MeshBuilder.CreateBox(
      "cbStock",
      { width: 0.048, height: 0.062, depth: 0.56 },
      this.scene,
    );
    stock.position.set(0.34, -0.31, -0.58);
    stock.material = woodMat;
    stock.parent = root;

    // Steel Flight Groove Rail on top of Stock
    const rail = BABYLON.MeshBuilder.CreateBox(
      "cbRail",
      { width: 0.024, height: 0.012, depth: 0.52 },
      this.scene,
    );
    rail.position.set(0.34, -0.275, -0.6);
    rail.material = steelMat;
    rail.parent = root;

    // Brass Nut & Trigger Lock Housing
    const housing = BABYLON.MeshBuilder.CreateBox(
      "cbHousing",
      { width: 0.058, height: 0.068, depth: 0.12 },
      this.scene,
    );
    housing.position.set(0.34, -0.305, -0.52);
    housing.material = goldMat;
    housing.parent = root;

    // Heavy Forged-Steel Bow Prod (Swept Horizontal Limbs)
    for (const side of [-1, 1]) {
      const limb = BABYLON.MeshBuilder.CreateBox(
        `cbLimb_${side}`,
        { width: 0.26, height: 0.022, depth: 0.036 },
        this.scene,
      );
      limb.rotation.y = side * -0.28;
      limb.position.set(0.34 + side * 0.13, -0.285, -0.82);
      limb.material = steelMat;
      limb.parent = root;
    }

    // Iron Binding Bridle securing the Prod to the Stock
    const bridle = BABYLON.MeshBuilder.CreateBox(
      "cbBridle",
      { width: 0.072, height: 0.076, depth: 0.055 },
      this.scene,
    );
    bridle.position.set(0.34, -0.295, -0.84);
    bridle.material = goldMat;
    bridle.parent = root;

    // Braided Hemp Bowstring
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

    // Wooden Quarrel Bolt Shaft + Forged Bodkin Broadhead Tip
    const shaft = BABYLON.MeshBuilder.CreateCylinder(
      "cbBoltShaft",
      { diameter: 0.012, height: 0.4, tessellation: 8 },
      this.scene,
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0.34, -0.26, -0.68);
    shaft.material = woodMat;
    shaft.parent = root;

    const broadhead = BABYLON.MeshBuilder.CreateCylinder(
      "cbBroadhead",
      { diameterTop: 0.002, diameterBottom: 0.026, height: 0.09, tessellation: 4 },
      this.scene,
    );
    broadhead.rotation.x = -Math.PI / 2;
    broadhead.position.set(0.34, -0.26, -0.91);
    broadhead.material = this.boltMat;
    broadhead.parent = root;

    return root;
  }

  public updateCamera() {
    this.camera.position.set(this.currentX, this.currentY, -7.4);

    // Right-handed quaternion from yaw and pitch
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
    }
  }

  public look(dx: number, dy: number) {
    const sens = this.isAiming ? 0.0016 : 0.0028;
    // In right-handed system, negative dx rotates right, negative dy pitches down
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
    this.recoilZ = 0.18;

    const forward = this.camera.getDirection(new BABYLON.Vector3(0, 0, -1)).normalize();
    const muzzle = this.camera.position.add(forward.scale(1.2));
    muzzle.y -= 0.15;

    const boltMesh = BABYLON.MeshBuilder.CreateCylinder(
      "flyingBolt",
      { diameterTop: 0.02, diameterBottom: 0.09, height: 1.5, tessellation: 8 },
      this.scene,
    );
    boltMesh.position.copyFrom(muzzle);
    boltMesh.rotationQuaternion = this.camera.rotationQuaternion?.clone() ?? null;
    boltMesh.rotate(BABYLON.Axis.X, -Math.PI / 2, BABYLON.Space.LOCAL);
    boltMesh.material = this.boltMat;

    const proj: BabylonArrowProjectile = {
      mesh: boltMesh,
      pos: muzzle,
      vel: forward.scale(this.stats.arrowSpeed),
      damage: this.stats.damage,
      pierceLeft: this.stats.pierce,
      isCrit: false,
      dead: false,
    };

    this.projectiles.push(proj);
    return proj;
  }

  public update(
    dt: number,
    zombies: BabylonZombie[],
    onHit: (
      zombie: BabylonZombie,
      dmg: number,
      isHeadshot: boolean,
      hitPos: BABYLON.Vector3,
    ) => void,
  ) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoilZ = Math.max(0, this.recoilZ - dt * 1.4);
    this.updateCamera();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      p.vel.y -= 3.8 * dt;
      p.pos.addInPlace(p.vel.scale(dt));
      p.mesh.position.copyFrom(p.pos);

      for (const z of zombies) {
        if (z.dead) continue;

        const headWorldPos = z.headMesh.getAbsolutePosition();
        const distHead = BABYLON.Vector3.Distance(p.pos, headWorldPos);

        if (distHead <= z.headRadius * 1.35) {
          p.isCrit = true;
          onHit(z, p.damage * this.stats.critMul, true, p.pos.clone());
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
          onHit(z, p.damage, false, p.pos.clone());
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
