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
    woodMat.diffuseColor = new BABYLON.Color3(0.36, 0.22, 0.11);
    woodMat.specularColor = new BABYLON.Color3(0.12, 0.08, 0.05);

    const steelMat = new BABYLON.StandardMaterial("cbSteelMat", this.scene);
    steelMat.diffuseColor = new BABYLON.Color3(0.28, 0.32, 0.38);
    steelMat.specularColor = new BABYLON.Color3(0.65, 0.7, 0.78);

    const goldMat = new BABYLON.StandardMaterial("cbGoldMat", this.scene);
    goldMat.diffuseColor = new BABYLON.Color3(0.78, 0.58, 0.16);
    goldMat.specularColor = new BABYLON.Color3(0.85, 0.7, 0.3);

    const stringMat = new BABYLON.StandardMaterial("cbStringMat", this.scene);
    stringMat.diffuseColor = new BABYLON.Color3(0.42, 0.38, 0.32);

    // Sleek Rounded Crossbow Tiller (Lower-Right of view, compact & non-obstructive)
    const tiller = BABYLON.MeshBuilder.CreateCapsule(
      "cbTiller",
      { radius: 0.028, height: 0.52, tessellation: 12 },
      this.scene,
    );
    tiller.rotation.x = Math.PI / 2;
    tiller.position.set(0.36, -0.32, -0.58);
    tiller.material = woodMat;
    tiller.parent = root;

    // Brass Trigger Housing
    const housing = BABYLON.MeshBuilder.CreateCylinder(
      "cbHousing",
      { diameter: 0.068, height: 0.14, tessellation: 12 },
      this.scene,
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0.36, -0.3, -0.55);
    housing.material = goldMat;
    housing.parent = root;

    // Curved Steel Bow Limbs (Swept Horizontal Arcs)
    for (const side of [-1, 1]) {
      const limb = BABYLON.MeshBuilder.CreateCapsule(
        `cbLimb_${side}`,
        { radius: 0.014, height: 0.26, tessellation: 10 },
        this.scene,
      );
      limb.rotation.z = Math.PI / 2;
      limb.rotation.y = side * -0.32;
      limb.position.set(0.36 + side * 0.12, -0.3, -0.78);
      limb.material = steelMat;
      limb.parent = root;
    }

    // Bowstring
    const bowstring = BABYLON.MeshBuilder.CreateCylinder(
      "cbString",
      { diameter: 0.005, height: 0.42, tessellation: 6 },
      this.scene,
    );
    bowstring.rotation.z = Math.PI / 2;
    bowstring.position.set(0.36, -0.3, -0.7);
    bowstring.material = stringMat;
    bowstring.parent = root;

    // Loaded Glowing Siege Bolt
    const bolt = BABYLON.MeshBuilder.CreateCylinder(
      "cbLoadedBolt",
      { diameterTop: 0.004, diameterBottom: 0.016, height: 0.42, tessellation: 8 },
      this.scene,
    );
    bolt.rotation.x = -Math.PI / 2;
    bolt.position.set(0.36, -0.28, -0.72);
    bolt.material = this.boltMat;
    bolt.parent = root;

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
