import * as BABYLON from "@babylonjs/core";
import type {
  BoltAmmoType,
  PlayerWeaponStats,
  ReticleTargetInfo,
} from "@/helmsdeep/types";
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

const ZOMBIE_LABELS: Record<string, string> = {
  runner: "Feral Ghoul Berserker",
  shambler: "Shielded Footman",
  brute: "Armored Uruk Juggernaut",
  banshee: "Barrow-Wraith Necromancer",
  warlord: "Siege Warlord of Udûn",
  sapper: "Alchemist Bomb-Sapper",
};

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
  public zoomLevel = 2.4; // Adjustable 1.8x .. 4.5x when aiming!
  public nightSightActive = false; // Arcane Night-Sight Runic Optics
  public currentAmmo: BoltAmmoType = "bodkin";
  public holdingBreath = false; // Sniper Focus Steady Aim
  public breathStamina = 100; // 0..100% Stamina bar

  public stats: PlayerWeaponStats = {
    damage: 56,
    critMul: 2.8,
    fireRate: 2.6,
    arrowSpeed: 115,
    pierce: 1,
    explosiveRadius: 0,
    weaponLevel: 1,
  };

  private cooldown = 0;
  private recoilZ = 0;
  private shakeTrauma = 0;
  private breathTimer = 0;
  private ratchetTimer = 0;

  private limbL!: BABYLON.Mesh;
  private limbR!: BABYLON.Mesh;
  private crankWheelL!: BABYLON.Mesh;
  private crankWheelR!: BABYLON.Mesh;
  private loadedBoltGroup!: BABYLON.TransformNode;
  private loadedBroadhead!: BABYLON.Mesh;
  private loadedFlameMesh!: BABYLON.Mesh;
  private loadedFrostMesh!: BABYLON.Mesh;
  private loadedFinsMesh!: BABYLON.Mesh;
  private fpLeftArmNode!: BABYLON.TransformNode;
  private fpRightArmNode!: BABYLON.TransformNode;

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
    if (this.loadedFlameMesh) this.loadedFlameMesh.setEnabled(ammo === "fire");
    if (this.loadedFrostMesh) this.loadedFrostMesh.setEnabled(ammo === "frost");
    if (this.loadedFinsMesh) this.loadedFinsMesh.setEnabled(ammo === "scatter");
  }

  public setHoldingBreath(hold: boolean): boolean {
    if (hold && this.isAiming && this.breathStamina > 15) {
      this.holdingBreath = true;
      return true;
    }
    this.holdingBreath = false;
    return false;
  }

  public cycleAmmo(): BoltAmmoType {
    const order: BoltAmmoType[] = ["bodkin", "fire", "frost", "scatter"];
    const nextIdx = (order.indexOf(this.currentAmmo) + 1) % order.length;
    this.setAmmo(order[nextIdx]);
    return this.currentAmmo;
  }

  public adjustZoom(delta: number) {
    this.zoomLevel = Math.max(1.8, Math.min(4.5, Number((this.zoomLevel + delta).toFixed(1))));
  }

  public cycleEnhanceZoom() {
    if (!this.isAiming) {
      this.isAiming = true;
      this.zoomLevel = 2.4;
    } else if (this.zoomLevel < 3.4) {
      this.zoomLevel = 3.5;
    } else if (this.zoomLevel < 4.4) {
      this.zoomLevel = 4.5;
    } else {
      this.isAiming = false;
      this.zoomLevel = 2.4;
    }
  }

  public addCameraShake(amount: number) {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + amount);
  }

  public toggleNightSight(): boolean {
    this.nightSightActive = !this.nightSightActive;
    return this.nightSightActive;
  }

  private buildCrossbowMesh(): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode("crossbowRoot", this.scene);

    // PBR Oiled Walnut, Forged Damascus Steel & Brushed Brass
    const woodMat = new BABYLON.PBRMaterial("cbWoodMat", this.scene);
    woodMat.albedoColor = new BABYLON.Color3(0.26, 0.14, 0.07);
    woodMat.metallic = 0.05;
    woodMat.roughness = 0.45;

    const steelMat = new BABYLON.PBRMaterial("cbSteelMat", this.scene);
    steelMat.albedoColor = new BABYLON.Color3(0.32, 0.36, 0.42);
    steelMat.metallic = 0.92;
    steelMat.roughness = 0.24;

    const goldMat = new BABYLON.PBRMaterial("cbGoldMat", this.scene);
    goldMat.albedoColor = new BABYLON.Color3(0.82, 0.62, 0.22);
    goldMat.metallic = 0.9;
    goldMat.roughness = 0.26;

    const stringMat = new BABYLON.StandardMaterial("cbStringMat", this.scene);
    stringMat.diffuseColor = new BABYLON.Color3(0.42, 0.36, 0.28);

    // Carved Walnut Stock
    const stock = BABYLON.MeshBuilder.CreateBox(
      "cbStock",
      { width: 0.05, height: 0.064, depth: 0.58 },
      this.scene,
    );
    stock.position.set(0.34, -0.31, -0.58);
    stock.material = woodMat;
    stock.parent = root;

    // Steel Flight Groove Rail
    const rail = BABYLON.MeshBuilder.CreateBox(
      "cbRail",
      { width: 0.026, height: 0.012, depth: 0.54 },
      this.scene,
    );
    rail.position.set(0.34, -0.275, -0.6);
    rail.material = steelMat;
    rail.parent = root;

    // Brass Trigger Lock Housing + Optical Rangefinder Sight Ring
    const housing = BABYLON.MeshBuilder.CreateBox(
      "cbHousing",
      { width: 0.06, height: 0.07, depth: 0.13 },
      this.scene,
    );
    housing.position.set(0.34, -0.305, -0.52);
    housing.material = goldMat;
    housing.parent = root;

    const sightRing = BABYLON.MeshBuilder.CreateTorus(
      "cbSightRing",
      { diameter: 0.095, thickness: 0.0045, tessellation: 28 },
      this.scene,
    );
    sightRing.rotation.x = Math.PI / 2;
    sightRing.position.set(0.34, -0.232, -0.56);
    sightRing.material = goldMat;
    sightRing.parent = root;

    // Spinning Rear Windlass Ratchet Crank Wheels
    this.crankWheelL = BABYLON.MeshBuilder.CreateTorus(
      "cbCrankL",
      { diameter: 0.065, thickness: 0.008, tessellation: 14 },
      this.scene,
    );
    this.crankWheelL.rotation.z = Math.PI / 2;
    this.crankWheelL.position.set(0.305, -0.3, -0.36);
    this.crankWheelL.material = goldMat;
    this.crankWheelL.parent = root;

    this.crankWheelR = BABYLON.MeshBuilder.CreateTorus(
      "cbCrankR",
      { diameter: 0.065, thickness: 0.008, tessellation: 14 },
      this.scene,
    );
    this.crankWheelR.rotation.z = Math.PI / 2;
    this.crankWheelR.position.set(0.375, -0.3, -0.36);
    this.crankWheelR.material = goldMat;
    this.crankWheelR.parent = root;

    // Swept Forged-Steel Prod Limbs
    this.limbL = BABYLON.MeshBuilder.CreateBox(
      "cbLimbL",
      { width: 0.27, height: 0.022, depth: 0.036 },
      this.scene,
    );
    this.limbL.rotation.y = 0.28;
    this.limbL.position.set(0.205, -0.285, -0.82);
    this.limbL.material = steelMat;
    this.limbL.parent = root;

    this.limbR = BABYLON.MeshBuilder.CreateBox(
      "cbLimbR",
      { width: 0.27, height: 0.022, depth: 0.036 },
      this.scene,
    );
    this.limbR.rotation.y = -0.28;
    this.limbR.position.set(0.475, -0.285, -0.82);
    this.limbR.material = steelMat;
    this.limbR.parent = root;

    const bridle = BABYLON.MeshBuilder.CreateBox(
      "cbBridle",
      { width: 0.074, height: 0.078, depth: 0.058 },
      this.scene,
    );
    bridle.position.set(0.34, -0.295, -0.84);
    bridle.material = goldMat;
    bridle.parent = root;

    // Front Steel Foot-Stirrup Ring
    const stirrup = BABYLON.MeshBuilder.CreateTorus(
      "cbStirrup",
      { diameter: 0.095, thickness: 0.008, tessellation: 16 },
      this.scene,
    );
    stirrup.position.set(0.34, -0.295, -0.92);
    stirrup.material = steelMat;
    stirrup.parent = root;

    for (const side of [-1, 1]) {
      const halfString = BABYLON.MeshBuilder.CreateCylinder(
        `cbString_${side}`,
        { diameter: 0.005, height: 0.27, tessellation: 6 },
        this.scene,
      );
      halfString.rotation.z = Math.PI / 2;
      halfString.rotation.y = side * 0.52;
      halfString.position.set(0.34 + side * 0.11, -0.28, -0.71);
      halfString.material = stringMat;
      halfString.parent = root;
    }

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
      { diameterTop: 0.002, diameterBottom: 0.032, height: 0.11, tessellation: 4 },
      this.scene,
    );
    this.loadedBroadhead.rotation.x = -Math.PI / 2;
    this.loadedBroadhead.position.set(0.34, -0.26, -0.91);
    this.loadedBroadhead.material = this.bodkinMat;
    this.loadedBroadhead.parent = this.loadedBoltGroup;

    // First-Person Dragonfire Pitch Flame Tip (flickering orange flame)
    this.loadedFlameMesh = BABYLON.MeshBuilder.CreateSphere(
      "cbFlameTip",
      { diameter: 0.052, segments: 6 },
      this.scene,
    );
    this.loadedFlameMesh.position.set(0.34, -0.26, -0.96);
    this.loadedFlameMesh.material = this.fireBoltMat;
    this.loadedFlameMesh.parent = this.loadedBoltGroup;
    this.loadedFlameMesh.setEnabled(false);

    // First-Person Frostbite Runic Tip (sharp cyan crystal polyhedron)
    this.loadedFrostMesh = BABYLON.MeshBuilder.CreatePolyhedron(
      "cbFrostTip",
      { type: 1, size: 0.035 },
      this.scene,
    );
    this.loadedFrostMesh.position.set(0.34, -0.26, -0.96);
    this.loadedFrostMesh.material = this.frostBoltMat;
    this.loadedFrostMesh.parent = this.loadedBoltGroup;
    this.loadedFrostMesh.setEnabled(false);

    // First-Person Triple Broadhead Fins (wide razor wings)
    this.loadedFinsMesh = BABYLON.MeshBuilder.CreateBox(
      "cbFinsTip",
      { width: 0.082, height: 0.008, depth: 0.075 },
      this.scene,
    );
    this.loadedFinsMesh.position.set(0.34, -0.26, -0.91);
    this.loadedFinsMesh.material = this.scatterBoltMat;
    this.loadedFinsMesh.parent = this.loadedBoltGroup;
    this.loadedFinsMesh.setEnabled(false);

    // -------------------------------------------------------------
    // FIRST-PERSON ARMORED ELVEN DEFENDER GAUNTLETS & FOREARMS
    // -------------------------------------------------------------
    const gauntletPlateMat = new BABYLON.PBRMaterial("gauntletPlateMat", this.scene);
    gauntletPlateMat.albedoColor = new BABYLON.Color3(0.25, 0.28, 0.35);
    gauntletPlateMat.metallic = 0.92;
    gauntletPlateMat.roughness = 0.22;

    const gauntletTrimMat = new BABYLON.PBRMaterial("gauntletTrimMat", this.scene);
    gauntletTrimMat.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.22);
    gauntletTrimMat.metallic = 0.94;
    gauntletTrimMat.roughness = 0.24;

    const gloveLeatherMat = new BABYLON.PBRMaterial("gloveLeatherMat", this.scene);
    gloveLeatherMat.albedoColor = new BABYLON.Color3(0.16, 0.11, 0.08);
    gloveLeatherMat.metallic = 0.04;
    gloveLeatherMat.roughness = 0.68;

    // LEFT FOREARM & GAUNTLET (Cupping walnut fore-stock from underneath)
    this.fpLeftArmNode = new BABYLON.TransformNode("fpLeftArm", this.scene);
    this.fpLeftArmNode.parent = root;

    const leftVambrace = BABYLON.MeshBuilder.CreateCylinder(
      "leftVambrace",
      { diameterTop: 0.082, diameterBottom: 0.105, height: 0.32, tessellation: 14 },
      this.scene,
    );
    leftVambrace.rotation.x = 0.95;
    leftVambrace.rotation.y = 0.35;
    leftVambrace.rotation.z = -0.38;
    leftVambrace.position.set(0.23, -0.37, -0.52);
    leftVambrace.material = gauntletPlateMat;
    leftVambrace.parent = this.fpLeftArmNode;

    const leftVambraceTrim = BABYLON.MeshBuilder.CreateTorus(
      "leftVambraceTrim",
      { diameter: 0.098, thickness: 0.009, tessellation: 18 },
      this.scene,
    );
    leftVambraceTrim.rotation.x = 0.95;
    leftVambraceTrim.rotation.y = 0.35;
    leftVambraceTrim.rotation.z = -0.38;
    leftVambraceTrim.position.set(0.26, -0.34, -0.58);
    leftVambraceTrim.material = gauntletTrimMat;
    leftVambraceTrim.parent = this.fpLeftArmNode;

    const leftHandPalm = BABYLON.MeshBuilder.CreateBox(
      "leftHandPalm",
      { width: 0.068, height: 0.055, depth: 0.082 },
      this.scene,
    );
    leftHandPalm.position.set(0.32, -0.31, -0.64);
    leftHandPalm.rotation.set(0.12, 0.22, -0.12);
    leftHandPalm.material = gloveLeatherMat;
    leftHandPalm.parent = this.fpLeftArmNode;

    const leftKnuckles = BABYLON.MeshBuilder.CreateBox(
      "leftKnuckles",
      { width: 0.072, height: 0.026, depth: 0.068 },
      this.scene,
    );
    leftKnuckles.position.set(0.298, -0.31, -0.64);
    leftKnuckles.rotation.set(0.12, 0.22, -0.12);
    leftKnuckles.material = gauntletPlateMat;
    leftKnuckles.parent = this.fpLeftArmNode;

    const leftThumb = BABYLON.MeshBuilder.CreateCylinder(
      "leftThumb",
      { diameter: 0.02, height: 0.058, tessellation: 8 },
      this.scene,
    );
    leftThumb.rotation.z = Math.PI / 3;
    leftThumb.position.set(0.31, -0.265, -0.62);
    leftThumb.material = gauntletPlateMat;
    leftThumb.parent = this.fpLeftArmNode;

    // RIGHT FOREARM & GAUNTLET (Grip on walnut pistol stock and brass trigger)
    this.fpRightArmNode = new BABYLON.TransformNode("fpRightArm", this.scene);
    this.fpRightArmNode.parent = root;

    const rightVambrace = BABYLON.MeshBuilder.CreateCylinder(
      "rightVambrace",
      { diameterTop: 0.085, diameterBottom: 0.108, height: 0.34, tessellation: 14 },
      this.scene,
    );
    rightVambrace.rotation.x = 0.88;
    rightVambrace.rotation.y = -0.24;
    rightVambrace.rotation.z = 0.28;
    rightVambrace.position.set(0.44, -0.37, -0.36);
    rightVambrace.material = gauntletPlateMat;
    rightVambrace.parent = this.fpRightArmNode;

    const rightVambraceTrim = BABYLON.MeshBuilder.CreateTorus(
      "rightVambraceTrim",
      { diameter: 0.102, thickness: 0.009, tessellation: 18 },
      this.scene,
    );
    rightVambraceTrim.rotation.x = 0.88;
    rightVambraceTrim.rotation.y = -0.24;
    rightVambraceTrim.rotation.z = 0.28;
    rightVambraceTrim.position.set(0.40, -0.33, -0.42);
    rightVambraceTrim.material = gauntletTrimMat;
    rightVambraceTrim.parent = this.fpRightArmNode;

    const rightHandPalm = BABYLON.MeshBuilder.CreateBox(
      "rightHandPalm",
      { width: 0.065, height: 0.068, depth: 0.075 },
      this.scene,
    );
    rightHandPalm.position.set(0.362, -0.31, -0.45);
    rightHandPalm.rotation.set(-0.12, -0.18, 0.18);
    rightHandPalm.material = gloveLeatherMat;
    rightHandPalm.parent = this.fpRightArmNode;

    const rightKnuckles = BABYLON.MeshBuilder.CreateBox(
      "rightKnuckles",
      { width: 0.068, height: 0.028, depth: 0.068 },
      this.scene,
    );
    rightKnuckles.position.set(0.388, -0.31, -0.45);
    rightKnuckles.rotation.set(-0.12, -0.18, 0.18);
    rightKnuckles.material = gauntletPlateMat;
    rightKnuckles.parent = this.fpRightArmNode;

    const rightTriggerFinger = BABYLON.MeshBuilder.CreateCylinder(
      "rightTriggerFinger",
      { diameter: 0.018, height: 0.052, tessellation: 8 },
      this.scene,
    );
    rightTriggerFinger.rotation.x = Math.PI / 2.4;
    rightTriggerFinger.rotation.y = -0.28;
    rightTriggerFinger.position.set(0.346, -0.29, -0.505);
    rightTriggerFinger.material = gauntletPlateMat;
    rightTriggerFinger.parent = this.fpRightArmNode;

    return root;
  }

  public updateCamera(dt = 0.016) {
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.2);
    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.35;
    const sx = (Math.random() - 0.5) * shakeMag;
    const sy = (Math.random() - 0.5) * shakeMag;

    const isSteadying = this.isAiming && this.holdingBreath && this.breathStamina > 0;
    if (isSteadying) {
      this.breathStamina = Math.max(0, this.breathStamina - dt * 28);
      if (this.breathStamina <= 0) {
        this.holdingBreath = false;
      }
    } else {
      this.breathStamina = Math.min(100, this.breathStamina + dt * 24);
    }

    this.breathTimer += dt * (isSteadying ? 0 : this.isAiming ? 1.0 : 1.8);
    const breathX = isSteadying ? 0 : Math.sin(this.breathTimer * 0.8) * (this.isAiming ? 0.001 : 0.0035);
    const breathY = isSteadying ? 0 : Math.cos(this.breathTimer * 1.6) * (this.isAiming ? 0.001 : 0.0028);

    this.camera.position.set(this.currentX + sx + breathX, this.currentY + sy + breathY, -7.4);

    const q = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, this.pitch, 0);
    this.camera.rotationQuaternion = q;

    const adsLerp = Math.min(1, 1 - Math.exp(-22 * dt));
    const baseDeg = 62;
    const steadyZoomMul = isSteadying ? 1.15 : 1.0;
    const zoomedDeg = baseDeg / (this.zoomLevel * steadyZoomMul);
    const targetFov = ((this.isAiming ? zoomedDeg : baseDeg) * Math.PI) / 180;
    this.camera.fov += (targetFov - this.camera.fov) * adsLerp;

    if (this.weaponRoot) {
      const targetX = this.isAiming ? -0.34 : 0;
      const targetY = this.isAiming ? 0.232 : 0.065;
      this.weaponRoot.position.x += (targetX - this.weaponRoot.position.x) * adsLerp;
      this.weaponRoot.position.y += (targetY - this.weaponRoot.position.y) * adsLerp;
      this.weaponRoot.position.z = this.recoilZ;

      const reloadRatio = Math.min(1, this.cooldown * this.stats.fireRate);
      if (this.limbL && this.limbR) {
        const flex = (1 - reloadRatio) * 0.28 + 0.06;
        this.limbL.rotation.y = flex;
        this.limbR.rotation.y = -flex;
      }
      if (this.crankWheelL && this.crankWheelR && reloadRatio > 0) {
        this.crankWheelL.rotation.x += dt * 18;
        this.crankWheelR.rotation.x += dt * 18;
      }
      if (this.loadedBoltGroup) {
        this.loadedBoltGroup.position.z = -reloadRatio * 0.16;
      }
      if (this.loadedFlameMesh && this.currentAmmo === "fire") {
        const flicker = 1 + Math.sin(this.breathTimer * 20) * 0.22;
        this.loadedFlameMesh.scaling.set(flicker, flicker * 1.3, flicker);
      }
      if (this.loadedFrostMesh && this.currentAmmo === "frost") {
        this.loadedFrostMesh.rotation.z += dt * 3.2;
      }
    }
  }

  public scanReticleTarget(
    zombies: BabylonZombie[],
    barrels: PowderBarrel[],
  ): ReticleTargetInfo | null {
    const origin = this.camera.position;
    const forward = this.camera.getDirection(new BABYLON.Vector3(0, 0, -1)).normalize();

    let bestDist = 180;
    let bestInfo: ReticleTargetInfo | null = null;

    // Check Powder Barrels
    for (const b of barrels) {
      if (b.detonated) continue;
      const toB = b.pos.subtract(origin);
      const proj = BABYLON.Vector3.Dot(toB, forward);
      if (proj > 2 && proj < bestDist) {
        const closestPt = origin.add(forward.scale(proj));
        if (BABYLON.Vector3.Distance(closestPt, b.pos) <= b.radius * 1.45) {
          bestDist = proj;
          bestInfo = {
            label: "Black-Powder Cask [EXPLOSIVE]",
            distance: Math.round(proj),
            isHazard: true,
          };
        }
      }
    }

    // Check Zombies
    for (const z of zombies) {
      if (z.dead) continue;
      const center = new BABYLON.Vector3(z.pos.x, z.pos.y + 2.4, z.pos.z);
      const toZ = center.subtract(origin);
      const proj = BABYLON.Vector3.Dot(toZ, forward);
      if (proj > 2 && proj < bestDist) {
        const closestPt = origin.add(forward.scale(proj));
        if (BABYLON.Vector3.Distance(closestPt, center) <= z.radius * 1.5) {
          bestDist = proj;
          bestInfo = {
            label: ZOMBIE_LABELS[z.type] || "Undead",
            distance: Math.round(proj),
            hp: Math.max(0, Math.round(z.hp)),
            maxHp: z.maxHp,
            isHazard: z.type === "sapper" || z.type === "warlord",
          };
        }
      }
    }

    return bestInfo;
  }

  public look(dx: number, dy: number) {
    const sens = this.isAiming ? 0.0024 / Math.max(1, this.zoomLevel * 0.6) : 0.0028;
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
    this.recoilZ = this.isAiming ? 0.08 : 0.2;

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
        { diameterTop: 0.025, diameterBottom: 0.1, height: 1.85, tessellation: 8 },
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
          this.currentAmmo === "bodkin" ? (this.stats.pierce ?? 1) + 1 : (this.stats.pierce ?? 1),
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
            Math.round(p.damage * this.stats.critMul),
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
