import * as BABYLON from "@babylonjs/core";
import type { ZombieType } from "@/helmsdeep/types";

export interface BabylonZombie {
  id: number;
  type: ZombieType;
  root: BABYLON.TransformNode;
  headMesh: BABYLON.Mesh;
  limbs: BABYLON.TransformNode[];
  shieldMesh?: BABYLON.Mesh;
  burnAuraMesh?: BABYLON.Mesh;
  frostAuraMesh?: BABYLON.Mesh;
  hpBarBg: BABYLON.Mesh;
  hpBarFill: BABYLON.Mesh;
  hpBarMat: BABYLON.StandardMaterial;
  pos: BABYLON.Vector3;
  targetPos: BABYLON.Vector3;
  speed: number;
  hp: number;
  maxHp: number;
  gold: number;
  damage: number;
  hasShield: boolean;
  shieldHp: number;
  burnTimer: number;
  burnDps: number;
  frostTimer: number;
  staggerTimer: number;
  ritualTimer: number;
  dyingTimer: number;
  attackTimer: number;
  walkTimer: number;
  isAttackingGate: boolean;
  dead: boolean;
  collapseProcessed: boolean;
  radius: number;
  headRadius: number;
  ragdollVel?: BABYLON.Vector3;
  ragdollSpin?: BABYLON.Vector3;
  isCulvertTarget?: boolean;
}

export class BabylonZombieHorde {
  public scene: BABYLON.Scene;
  public shadowGenerator?: BABYLON.ShadowGenerator;
  public zombies: BabylonZombie[] = [];
  private nextId = 1;

  private boneMat: BABYLON.PBRMaterial;
  private socketDarkMat: BABYLON.StandardMaterial;
  private fleshMat: BABYLON.PBRMaterial;
  private darkPlateMat: BABYLON.PBRMaterial;
  private rustedMailMat: BABYLON.PBRMaterial;
  private bruteHideMat: BABYLON.PBRMaterial;
  private leatherMat: BABYLON.PBRMaterial;
  private tatteredClothMat: BABYLON.PBRMaterial;
  private woodShieldMat: BABYLON.PBRMaterial;
  private eyeEmberMat: BABYLON.StandardMaterial;
  private eyeGoldMat: BABYLON.StandardMaterial;
  private sapperBombMat: BABYLON.StandardMaterial;
  private wraithCloakMat: BABYLON.StandardMaterial;
  private wraithCoreMat: BABYLON.StandardMaterial;
  private burnAuraMat: BABYLON.StandardMaterial;
  private frostAuraMat: BABYLON.StandardMaterial;
  private hpBgMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene, shadowGenerator?: BABYLON.ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;

    // 1. Physically-Based Dark-Fantasy PBR Armor, Bone & Flesh Materials
    this.boneMat = new BABYLON.PBRMaterial("zBoneMat", scene);
    this.boneMat.albedoColor = new BABYLON.Color3(0.72, 0.66, 0.55);
    this.boneMat.metallic = 0.05;
    this.boneMat.roughness = 0.58;

    this.socketDarkMat = new BABYLON.StandardMaterial("zSocketDarkMat", scene);
    this.socketDarkMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.05);
    this.socketDarkMat.specularColor = BABYLON.Color3.Black();

    this.fleshMat = new BABYLON.PBRMaterial("zFleshMat", scene);
    this.fleshMat.albedoColor = new BABYLON.Color3(0.32, 0.4, 0.31);
    this.fleshMat.metallic = 0.06;
    this.fleshMat.roughness = 0.48; // Rain-slick necrotic skin

    this.darkPlateMat = new BABYLON.PBRMaterial("zDarkPlateMat", scene);
    this.darkPlateMat.albedoColor = new BABYLON.Color3(0.24, 0.27, 0.32);
    this.darkPlateMat.metallic = 0.88;
    this.darkPlateMat.roughness = 0.28; // Gleaming forged dark steel in moonlight!

    this.rustedMailMat = new BABYLON.PBRMaterial("zRustedMailMat", scene);
    this.rustedMailMat.albedoColor = new BABYLON.Color3(0.32, 0.26, 0.22);
    this.rustedMailMat.metallic = 0.72;
    this.rustedMailMat.roughness = 0.46;

    this.bruteHideMat = new BABYLON.PBRMaterial("zBruteHideMat", scene);
    this.bruteHideMat.albedoColor = new BABYLON.Color3(0.36, 0.3, 0.25);
    this.bruteHideMat.metallic = 0.08;
    this.bruteHideMat.roughness = 0.55;

    this.leatherMat = new BABYLON.PBRMaterial("zLeatherMat", scene);
    this.leatherMat.albedoColor = new BABYLON.Color3(0.24, 0.16, 0.1);
    this.leatherMat.metallic = 0.08;
    this.leatherMat.roughness = 0.62;

    this.tatteredClothMat = new BABYLON.PBRMaterial("zTatteredClothMat", scene);
    this.tatteredClothMat.albedoColor = new BABYLON.Color3(0.45, 0.1, 0.09);
    this.tatteredClothMat.metallic = 0.02;
    this.tatteredClothMat.roughness = 0.85;

    this.woodShieldMat = new BABYLON.PBRMaterial("zWoodShieldMat", scene);
    this.woodShieldMat.albedoColor = new BABYLON.Color3(0.38, 0.24, 0.12);
    this.woodShieldMat.metallic = 0.06;
    this.woodShieldMat.roughness = 0.68;

    this.eyeEmberMat = new BABYLON.StandardMaterial("zEyeEmberMat", scene);
    this.eyeEmberMat.emissiveColor = new BABYLON.Color3(1.0, 0.22, 0.05);
    this.eyeEmberMat.disableLighting = true;

    this.eyeGoldMat = new BABYLON.StandardMaterial("zEyeGoldMat", scene);
    this.eyeGoldMat.emissiveColor = new BABYLON.Color3(1.0, 0.65, 0.1);
    this.eyeGoldMat.disableLighting = true;

    this.sapperBombMat = new BABYLON.StandardMaterial("zSapperBombMat", scene);
    this.sapperBombMat.emissiveColor = new BABYLON.Color3(1.0, 0.45, 0.08);
    this.sapperBombMat.diffuseColor = new BABYLON.Color3(0.95, 0.35, 0.05);

    this.wraithCloakMat = new BABYLON.StandardMaterial("zWraithCloakMat", scene);
    this.wraithCloakMat.diffuseColor = new BABYLON.Color3(0.08, 0.14, 0.18);
    this.wraithCloakMat.emissiveColor = new BABYLON.Color3(0.05, 0.18, 0.24);
    this.wraithCloakMat.alpha = 0.88;

    this.wraithCoreMat = new BABYLON.StandardMaterial("zWraithCoreMat", scene);
    this.wraithCoreMat.emissiveColor = new BABYLON.Color3(0.25, 0.82, 0.98);
    this.wraithCoreMat.alpha = 0.72;
    this.wraithCoreMat.disableLighting = true;

    this.burnAuraMat = new BABYLON.StandardMaterial("zBurnAuraMat", scene);
    this.burnAuraMat.emissiveColor = new BABYLON.Color3(1.0, 0.42, 0.05);
    this.burnAuraMat.alpha = 0.68;
    this.burnAuraMat.disableLighting = true;

    this.frostAuraMat = new BABYLON.StandardMaterial("zFrostAuraMat", scene);
    this.frostAuraMat.emissiveColor = new BABYLON.Color3(0.25, 0.82, 1.0);
    this.frostAuraMat.alpha = 0.72;
    this.frostAuraMat.disableLighting = true;

    this.hpBgMat = new BABYLON.StandardMaterial("zHpBgMat", scene);
    this.hpBgMat.emissiveColor = new BABYLON.Color3(0.04, 0.04, 0.05);
    this.hpBgMat.disableLighting = true;
  }

  public spawn(
    type: ZombieType,
    spawnZ = -110,
    spreadX = 6.5,
    gateZ = -28.0,
    targetOverride?: BABYLON.Vector3,
  ): BabylonZombie {
    const id = this.nextId++;
    const root = new BABYLON.TransformNode(`zombie_${id}`, this.scene);
    const limbs: BABYLON.TransformNode[] = [];
    let headMesh!: BABYLON.Mesh;
    let shieldMesh: BABYLON.Mesh | undefined;

    let hp = 68;
    let speed = 6.8;
    let gold = 16;
    let damage = 18;
    let radius = 1.5;
    let headRadius = 0.85;
    let badgeHeight = 4.3;
    let hasShield = false;
    let shieldHp = 0;

    const startX = (Math.random() - 0.5) * spreadX * 2;
    const targetX = (Math.random() - 0.5) * 6.5;
    const targetPos = targetOverride ? targetOverride.clone() : new BABYLON.Vector3(targetX, 0, gateZ - 1.2);
    const isCulvertTarget = targetOverride !== undefined && targetOverride.x < -15;

    if (type === "runner") {
      // 1. FERAL GHOUL BERSERKER
      hp = 44;
      speed = 13.8;
      gold = 15;
      damage = 12;
      radius = 1.4;
      headRadius = 0.82;
      badgeHeight = 3.7;

      const waist = BABYLON.MeshBuilder.CreateCapsule(
        `waist_${id}`,
        { radius: 0.34, height: 1.0, tessellation: 12 },
        this.scene,
      );
      waist.position.set(0, 1.35, -0.15);
      waist.rotation.x = 0.35;
      waist.material = this.leatherMat;
      waist.parent = root;

      const ribcage = BABYLON.MeshBuilder.CreateCapsule(
        `ribcage_${id}`,
        { radius: 0.48, height: 1.35, tessellation: 14 },
        this.scene,
      );
      ribcage.position.set(0, 2.05, 0.18);
      ribcage.rotation.x = 0.58;
      ribcage.material = this.fleshMat;
      ribcage.parent = root;

      for (let r = 0; r < 4; r++) {
        const rib = BABYLON.MeshBuilder.CreateTorus(
          `rib_${id}_${r}`,
          { diameter: 0.88 - r * 0.06, thickness: 0.07, tessellation: 12 },
          this.scene,
        );
        rib.position.set(0, 0.25 - r * 0.16, 0.04);
        rib.material = this.boneMat;
        rib.parent = ribcage;
      }

      headMesh = this.buildRealisticSkull(id, 0.82, this.boneMat, this.eyeEmberMat, false);
      headMesh.position.set(0, 2.75, 0.62);
      headMesh.rotation.x = 0.18;
      headMesh.parent = root;

      const armL = this.buildArticulatedArm(
        `armL_${id}`,
        0.18,
        1.5,
        this.fleshMat,
        this.leatherMat,
        root,
        -0.62,
        2.15,
        0.3,
        "cleaver",
      );
      const armR = this.buildArticulatedArm(
        `armR_${id}`,
        0.18,
        1.5,
        this.fleshMat,
        this.leatherMat,
        root,
        0.62,
        2.15,
        0.3,
        "cleaver",
      );
      const legL = this.buildArticulatedLeg(
        `legL_${id}`,
        0.22,
        1.45,
        this.leatherMat,
        this.darkPlateMat,
        root,
        -0.32,
        1.1,
        -0.12,
      );
      const legR = this.buildArticulatedLeg(
        `legR_${id}`,
        0.22,
        1.45,
        this.leatherMat,
        this.darkPlateMat,
        root,
        0.32,
        1.1,
        -0.12,
      );
      limbs.push(armL.shoulder, armR.shoulder, legL, legR);
    } else if (type === "brute" || type === "warlord") {
      // 2. ARMORED SIEGE TROLL / WARLORD CHAMPION
      const isWarlord = type === "warlord";
      const scale = isWarlord ? 1.18 : 1.0;
      hp = isWarlord ? 520 : 275;
      speed = isWarlord ? 5.6 : 5.0;
      gold = isWarlord ? 110 : 48;
      damage = isWarlord ? 75 : 50;
      radius = 2.4 * scale;
      headRadius = 1.22 * scale;
      badgeHeight = 6.3 * scale;
      hasShield = true;
      shieldHp = isWarlord ? 140 : 85;

      const pelvis = BABYLON.MeshBuilder.CreateCylinder(
        `pelvis_${id}`,
        { diameterTop: 1.55 * scale, diameterBottom: 1.75 * scale, height: 1.2 * scale, tessellation: 14 },
        this.scene,
      );
      pelvis.position.set(0, 2.1 * scale, 0);
      pelvis.material = this.leatherMat;
      pelvis.parent = root;

      const chest = BABYLON.MeshBuilder.CreateCylinder(
        `chest_${id}`,
        { diameterTop: 2.35 * scale, diameterBottom: 1.5 * scale, height: 2.1 * scale, tessellation: 16 },
        this.scene,
      );
      chest.position.set(0, 3.55 * scale, 0.08);
      chest.rotation.x = 0.12;
      chest.material = this.darkPlateMat;
      chest.parent = root;

      for (const side of [-1, 1]) {
        const pauldron = BABYLON.MeshBuilder.CreateSphere(
          `pauldron_${id}_${side}`,
          {
            diameterX: 1.25 * scale,
            diameterY: 1.0 * scale,
            diameterZ: 1.25 * scale,
            slice: 0.6,
            segments: 12,
          },
          this.scene,
        );
        pauldron.position.set(side * 1.38 * scale, 4.25 * scale, 0.08);
        pauldron.rotation.z = side * -0.35;
        pauldron.material = this.darkPlateMat;
        pauldron.parent = root;

        const spike = BABYLON.MeshBuilder.CreateCylinder(
          `pSpike_${id}_${side}`,
          { diameterTop: 0.02, diameterBottom: 0.22 * scale, height: 0.6 * scale, tessellation: 8 },
          this.scene,
        );
        spike.position.set(side * 1.55 * scale, 4.75 * scale, 0.08);
        spike.rotation.z = side * -0.25;
        spike.material = this.boneMat;
        spike.parent = root;

        if (isWarlord) {
          // Twin Back-Mounted Warlord Siege Standards
          const pole = BABYLON.MeshBuilder.CreateCylinder(
            `wPole_${id}_${side}`,
            { diameter: 0.08, height: 2.6, tessellation: 6 },
            this.scene,
          );
          pole.position.set(side * 0.75, 5.4 * scale, -0.45);
          pole.rotation.z = side * -0.15;
          pole.material = this.woodShieldMat;
          pole.parent = root;

          const flag = BABYLON.MeshBuilder.CreateBox(
            `wFlag_${id}_${side}`,
            { width: 0.75, height: 1.4, depth: 0.05 },
            this.scene,
          );
          flag.position.set(side * 0.85, 5.9 * scale, -0.45);
          flag.material = this.tatteredClothMat;
          flag.parent = root;
        }
      }

      const tabard = BABYLON.MeshBuilder.CreateBox(
        `tabard_${id}`,
        { width: 0.95 * scale, height: 1.6 * scale, depth: 0.12 },
        this.scene,
      );
      tabard.position.set(0, 1.85 * scale, 0.78 * scale);
      tabard.material = this.tatteredClothMat;
      tabard.parent = root;

      headMesh = this.buildRealisticSkull(
        id,
        1.25 * scale,
        this.bruteHideMat,
        isWarlord ? this.eyeEmberMat : this.eyeGoldMat,
        true,
      );
      headMesh.position.set(0, 4.95 * scale, 0.25);
      headMesh.parent = root;

      if (isWarlord) {
        // Blazing Iron Crown on the Siege Warlord
        const crown = BABYLON.MeshBuilder.CreateTorus(
          `wCrown_${id}`,
          { diameter: 1.15, thickness: 0.14, tessellation: 16 },
          this.scene,
        );
        crown.position.y = 0.55;
        crown.material = this.eyeGoldMat;
        crown.parent = headMesh;
      }

      const armL = this.buildArticulatedArm(
        `armL_${id}`,
        0.38 * scale,
        2.3 * scale,
        this.bruteHideMat,
        this.darkPlateMat,
        root,
        -1.55 * scale,
        4.0 * scale,
        0.1,
        "shield_heavy",
      );
      shieldMesh = armL.shieldMesh;
      const armR = this.buildArticulatedArm(
        `armR_${id}`,
        0.38 * scale,
        2.3 * scale,
        this.bruteHideMat,
        this.darkPlateMat,
        root,
        1.55 * scale,
        4.0 * scale,
        0.1,
        "warhammer",
      );
      const legL = this.buildArticulatedLeg(
        `legL_${id}`,
        0.44 * scale,
        2.0 * scale,
        this.leatherMat,
        this.darkPlateMat,
        root,
        -0.65 * scale,
        1.75 * scale,
        0,
      );
      const legR = this.buildArticulatedLeg(
        `legR_${id}`,
        0.44 * scale,
        2.0 * scale,
        this.leatherMat,
        this.darkPlateMat,
        root,
        0.65 * scale,
        1.75 * scale,
        0,
      );
      limbs.push(armL.shoulder, armR.shoulder, legL, legR);
    } else if (type === "banshee") {
      // 3. NAZGUL-STYLE HOODED BARROW-WRAITH NECROMANCER
      hp = 78;
      speed = 9.5;
      gold = 30;
      damage = 26;
      radius = 1.5;
      headRadius = 0.85;
      badgeHeight = 4.6;

      const outerRobe = BABYLON.MeshBuilder.CreateCylinder(
        `outerRobe_${id}`,
        { diameterTop: 0.75, diameterBottom: 1.95, height: 3.2, tessellation: 16 },
        this.scene,
      );
      outerRobe.position.set(0, 1.85, 0);
      outerRobe.material = this.wraithCloakMat;
      outerRobe.parent = root;

      const core = BABYLON.MeshBuilder.CreateCapsule(
        `wraithCore_${id}`,
        { radius: 0.28, height: 2.1, tessellation: 12 },
        this.scene,
      );
      core.position.set(0, 2.3, 0.05);
      core.material = this.wraithCoreMat;
      core.parent = root;

      headMesh = this.buildRealisticSkull(id, 0.88, this.boneMat, this.wraithCoreMat, false);
      headMesh.position.set(0, 3.65, 0.12);
      headMesh.parent = root;

      const hood = BABYLON.MeshBuilder.CreateCylinder(
        `hood_${id}`,
        { diameterTop: 0.12, diameterBottom: 1.15, height: 1.1, tessellation: 12 },
        this.scene,
      );
      hood.position.set(0, 0.25, -0.06);
      hood.rotation.x = -0.2;
      hood.material = this.wraithCloakMat;
      hood.parent = headMesh;

      const armL = this.buildArticulatedArm(
        `armL_${id}`,
        0.18,
        1.7,
        this.wraithCloakMat,
        this.boneMat,
        root,
        -0.75,
        3.1,
        0.2,
        "none",
      );
      const armR = this.buildArticulatedArm(
        `armR_${id}`,
        0.18,
        1.7,
        this.wraithCloakMat,
        this.boneMat,
        root,
        0.75,
        3.1,
        0.2,
        "scythe",
      );
      limbs.push(armL.shoulder, armR.shoulder);
    } else if (type === "sapper") {
      // 4. ALCHEMIST TORCHBEARER SAPPER (Carries a blazing black-powder bomb-pot high overhead!)
      hp = 52;
      speed = 11.8;
      gold = 35;
      damage = 160; // Massive breach explosion if he reaches the gate!
      radius = 1.45;
      headRadius = 0.95; // Shooting either his head or the overhead bomb-pot detonates him!
      badgeHeight = 4.6;

      const torso = BABYLON.MeshBuilder.CreateCylinder(
        `sapperTorso_${id}`,
        { diameterTop: 1.05, diameterBottom: 0.85, height: 1.5, tessellation: 12 },
        this.scene,
      );
      torso.position.set(0, 2.1, 0);
      torso.material = this.leatherMat;
      torso.parent = root;

      headMesh = this.buildRealisticSkull(id, 0.85, this.boneMat, this.eyeGoldMat, true);
      headMesh.position.set(0, 3.15, 0.15);
      headMesh.parent = root;

      // Blazing Alchemical Bomb-Pot held overhead!
      const bombPot = BABYLON.MeshBuilder.CreateSphere(
        `sapperPot_${id}`,
        { diameter: 1.05, segments: 12 },
        this.scene,
      );
      bombPot.position.set(0, 0.92, 0.1);
      bombPot.material = this.darkPlateMat;
      bombPot.parent = headMesh;

      const bombFlame = BABYLON.MeshBuilder.CreateSphere(
        `sapperFlame_${id}`,
        { diameter: 0.65, segments: 8 },
        this.scene,
      );
      bombFlame.position.set(0, 1.45, 0.1);
      bombFlame.material = this.sapperBombMat;
      bombFlame.parent = headMesh;

      const armL = this.buildArticulatedArm(
        `armL_${id}`,
        0.19,
        1.5,
        this.fleshMat,
        this.darkPlateMat,
        root,
        -0.68,
        2.75,
        0.15,
        "none",
      );
      armL.shoulder.rotation.x = -2.4; // Raised overhead holding the bomb-pot!
      const armR = this.buildArticulatedArm(
        `armR_${id}`,
        0.19,
        1.5,
        this.fleshMat,
        this.darkPlateMat,
        root,
        0.68,
        2.75,
        0.15,
        "none",
      );
      armR.shoulder.rotation.x = -2.4;

      const legL = this.buildArticulatedLeg(
        `legL_${id}`,
        0.22,
        1.45,
        this.leatherMat,
        this.darkPlateMat,
        root,
        -0.34,
        1.25,
        0,
      );
      const legR = this.buildArticulatedLeg(
        `legR_${id}`,
        0.22,
        1.45,
        this.leatherMat,
        this.darkPlateMat,
        root,
        0.34,
        1.25,
        0,
      );
      limbs.push(armL.shoulder, armR.shoulder, legL, legR);
    } else if (type === "ram") {
      // 5. HORNBURG IRON-PLATED BATTERING RAM
      hp = 680;
      speed = 3.6;
      gold = 140;
      damage = 195;
      radius = 3.0;
      headRadius = 1.35;
      badgeHeight = 4.8;
      hasShield = false;

      // Heavy Timber A-Frame Carriage
      const carriage = BABYLON.MeshBuilder.CreateBox(
        `ramCarriage_${id}`,
        { width: 3.2, height: 0.65, depth: 6.0 },
        this.scene,
      );
      carriage.position.set(0, 1.1, 0);
      carriage.material = this.woodShieldMat;
      carriage.parent = root;

      // 4 Heavy Spiked Forged Iron Wheels
      const wheelOffsets = [
        { x: -1.8, z: 1.9 },
        { x: 1.8, z: 1.9 },
        { x: -1.8, z: -1.9 },
        { x: 1.8, z: -1.9 },
      ];
      wheelOffsets.forEach((wo, wIdx) => {
        const wheel = BABYLON.MeshBuilder.CreateCylinder(
          `ramWheel_${id}_${wIdx}`,
          { diameter: 1.45, height: 0.35, tessellation: 16 },
          this.scene,
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wo.x, 0.72, wo.z);
        wheel.material = this.darkPlateMat;
        wheel.parent = root;
      });

      // Pitched Heavy Timber Roof Mantlet with Spikes
      for (const side of [-1, 1]) {
        const roof = BABYLON.MeshBuilder.CreateBox(
          `ramRoof_${id}_${side}`,
          { width: 2.2, height: 0.28, depth: 6.2 },
          this.scene,
        );
        roof.rotation.z = side * 0.65;
        roof.position.set(side * 0.95, 2.7, 0);
        roof.material = this.darkPlateMat;
        roof.parent = root;
      }

      // Suspended 5-Meter Heavy Oak Ram Beam
      const ramLog = BABYLON.MeshBuilder.CreateCylinder(
        `ramLog_${id}`,
        { diameter: 0.85, height: 6.6, tessellation: 12 },
        this.scene,
      );
      ramLog.rotation.x = Math.PI / 2;
      ramLog.position.set(0, 1.7, 0.4);
      ramLog.material = this.woodShieldMat;
      ramLog.parent = root;
      limbs.push(ramLog);

      // Forged Wrought-Iron Snarling Beast Ram Head (Head Hitbox for Crits!)
      headMesh = BABYLON.MeshBuilder.CreateBox(
        `ramHead_${id}`,
        { width: 1.35, height: 1.35, depth: 1.45 },
        this.scene,
      );
      headMesh.position.set(0, 1.7, 3.8);
      headMesh.material = this.darkPlateMat;
      headMesh.parent = root;

      // Curved Iron Horns
      for (const side of [-1, 1]) {
        const horn = BABYLON.MeshBuilder.CreateCylinder(
          `ramHorn_${id}_${side}`,
          { diameterTop: 0.08, diameterBottom: 0.38, height: 1.3, tessellation: 8 },
          this.scene,
        );
        horn.rotation.x = 0.85;
        horn.rotation.z = -side * 0.65;
        horn.position.set(side * 0.65, 0.45, 0.35);
        horn.material = this.darkPlateMat;
        horn.parent = headMesh;
      }

      // Pushing Uruk Crew inside Carriage
      for (const side of [-1, 1]) {
        for (const fz of [-1.1, 1.1]) {
          const crew = BABYLON.MeshBuilder.CreateCylinder(
            `ramCrew_${id}_${side}_${fz}`,
            { diameter: 0.58, height: 1.8, tessellation: 8 },
            this.scene,
          );
          crew.position.set(side * 0.95, 1.2, fz);
          crew.material = this.rustedMailMat;
          crew.parent = root;
        }
      }
    } else {
      // 5. ARMORED UNDEAD FOOTMAN / SHAMBLER (Shield Phalanx Infantry)
      hp = 72;
      speed = 6.8;
      gold = 18;
      damage = 18;
      radius = 1.5;
      headRadius = 0.85;
      badgeHeight = 4.2;
      hasShield = true;
      shieldHp = 42;

      const waist = BABYLON.MeshBuilder.CreateCylinder(
        `waist_${id}`,
        { diameterTop: 0.85, diameterBottom: 0.98, height: 0.9, tessellation: 12 },
        this.scene,
      );
      waist.position.set(0, 1.65, 0);
      waist.material = this.tatteredClothMat;
      waist.parent = root;

      const cuirass = BABYLON.MeshBuilder.CreateCylinder(
        `cuirass_${id}`,
        { diameterTop: 1.22, diameterBottom: 0.88, height: 1.25, tessellation: 14 },
        this.scene,
      );
      cuirass.position.set(0, 2.55, 0.05);
      cuirass.rotation.x = 0.1;
      cuirass.material = this.darkPlateMat;
      cuirass.parent = root;

      for (const side of [-1, 1]) {
        const pauldron = BABYLON.MeshBuilder.CreateSphere(
          `pauldron_${id}_${side}`,
          { diameter: 0.68, slice: 0.6, segments: 10 },
          this.scene,
        );
        pauldron.position.set(side * 0.72, 3.0, 0.05);
        pauldron.rotation.z = side * -0.35;
        pauldron.material = this.darkPlateMat;
        pauldron.parent = root;
      }

      headMesh = this.buildRealisticSkull(id, 0.86, this.boneMat, this.eyeEmberMat, true);
      headMesh.position.set(0, 3.45, 0.12);
      headMesh.parent = root;

      const armL = this.buildArticulatedArm(
        `armL_${id}`,
        0.2,
        1.55,
        this.rustedMailMat,
        this.darkPlateMat,
        root,
        -0.78,
        2.85,
        0.08,
        "shield",
      );
      shieldMesh = armL.shieldMesh;
      const armR = this.buildArticulatedArm(
        `armR_${id}`,
        0.2,
        1.55,
        this.rustedMailMat,
        this.darkPlateMat,
        root,
        0.78,
        2.85,
        0.08,
        "sword",
      );
      const legL = this.buildArticulatedLeg(
        `legL_${id}`,
        0.24,
        1.5,
        this.rustedMailMat,
        this.darkPlateMat,
        root,
        -0.36,
        1.3,
        0,
      );
      const legR = this.buildArticulatedLeg(
        `legR_${id}`,
        0.24,
        1.5,
        this.rustedMailMat,
        this.darkPlateMat,
        root,
        0.36,
        1.3,
        0,
      );
      limbs.push(armL.shoulder, armR.shoulder, legL, legR);
    }

    if (this.shadowGenerator) {
      for (const m of root.getChildMeshes()) {
        this.shadowGenerator.addShadowCaster(m);
      }
    }

    // Status Effect Auras (Hidden until Ignited or Frosted)
    const burnAuraMesh = BABYLON.MeshBuilder.CreateCylinder(
      `burnAura_${id}`,
      { diameterTop: 0.2, diameterBottom: radius * 1.15, height: 2.8, tessellation: 10 },
      this.scene,
    );
    burnAuraMesh.position.set(0, 2.0, 0);
    burnAuraMesh.material = this.burnAuraMat;
    burnAuraMesh.visibility = 0;
    burnAuraMesh.parent = root;

    const frostAuraMesh = BABYLON.MeshBuilder.CreateTorus(
      `frostAura_${id}`,
      { diameter: radius * 1.45, thickness: 0.14, tessellation: 16 },
      this.scene,
    );
    frostAuraMesh.position.set(0, 0.25, 0);
    frostAuraMesh.material = this.frostAuraMat;
    frostAuraMesh.visibility = 0;
    frostAuraMesh.parent = root;

    // Tactical Health Bar
    const hpBg = BABYLON.MeshBuilder.CreatePlane(
      `hpBg_${id}`,
      { width: type === "warlord" ? 2.4 : 1.5, height: type === "warlord" ? 0.22 : 0.15 },
      this.scene,
    );
    hpBg.position.set(0, badgeHeight, 0);
    hpBg.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    hpBg.material = this.hpBgMat;
    hpBg.parent = root;

    const hpBarMat = new BABYLON.StandardMaterial(`hpBarMat_${id}`, this.scene);
    hpBarMat.emissiveColor = new BABYLON.Color3(0.75, 0.18, 0.14);
    hpBarMat.disableLighting = true;

    const hpBarFill = BABYLON.MeshBuilder.CreatePlane(
      `hpFill_${id}`,
      { width: type === "warlord" ? 2.3 : 1.42, height: type === "warlord" ? 0.15 : 0.1 },
      this.scene,
    );
    hpBarFill.position.set(0, 0, -0.02);
    hpBarFill.material = hpBarMat;
    hpBarFill.parent = hpBg;

    const startPos = new BABYLON.Vector3(startX, 0, spawnZ);
    root.position.copyFrom(startPos);

    const zombie: BabylonZombie = {
      id,
      type,
      root,
      headMesh,
      limbs,
      shieldMesh,
      burnAuraMesh,
      frostAuraMesh,
      hpBarBg: hpBg,
      hpBarFill,
      hpBarMat,
      pos: startPos,
      targetPos,
      speed,
      hp,
      maxHp: hp,
      gold,
      damage,
      hasShield,
      shieldHp,
      burnTimer: 0,
      burnDps: 0,
      frostTimer: 0,
      staggerTimer: 0,
      ritualTimer: 3.5 + Math.random() * 3.0,
      dyingTimer: 0,
      attackTimer: 0,
      walkTimer: Math.random() * 10,
      isAttackingGate: false,
      dead: false,
      collapseProcessed: false,
      radius,
      headRadius,
      isCulvertTarget,
    };

    this.zombies.push(zombie);
    return zombie;
  }

  private buildRealisticSkull(
    id: number,
    scale: number,
    skullMat: BABYLON.Material,
    eyeMat: BABYLON.Material,
    withHelmet: boolean,
  ): BABYLON.Mesh {
    const cranium = BABYLON.MeshBuilder.CreateSphere(
      `head_${id}`,
      { diameterX: 0.78 * scale, diameterY: 0.85 * scale, diameterZ: 0.92 * scale, segments: 12 },
      this.scene,
    );
    cranium.material = skullMat;

    const jaw = BABYLON.MeshBuilder.CreateCylinder(
      `jaw_${id}`,
      {
        diameterTop: 0.56 * scale,
        diameterBottom: 0.42 * scale,
        height: 0.38 * scale,
        tessellation: 10,
      },
      this.scene,
    );
    jaw.position.set(0, -0.32 * scale, 0.12 * scale);
    jaw.material = skullMat;
    jaw.parent = cranium;

    const brow = BABYLON.MeshBuilder.CreateBox(
      `brow_${id}`,
      { width: 0.68 * scale, height: 0.12 * scale, depth: 0.25 * scale },
      this.scene,
    );
    brow.position.set(0, 0.12 * scale, 0.36 * scale);
    brow.material = skullMat;
    brow.parent = cranium;

    for (const side of [-1, 1]) {
      const socket = BABYLON.MeshBuilder.CreateSphere(
        `socket_${id}_${side}`,
        { diameter: 0.22 * scale, segments: 8 },
        this.scene,
      );
      socket.position.set(side * 0.18 * scale, 0.02 * scale, 0.38 * scale);
      socket.material = this.socketDarkMat;
      socket.parent = cranium;

      const pupil = BABYLON.MeshBuilder.CreateSphere(
        `pupil_${id}_${side}`,
        { diameter: 0.09 * scale, segments: 6 },
        this.scene,
      );
      pupil.position.set(side * 0.18 * scale, 0.02 * scale, 0.46 * scale);
      pupil.material = eyeMat;
      pupil.parent = cranium;
    }

    if (withHelmet) {
      const helmDome = BABYLON.MeshBuilder.CreateSphere(
        `helmDome_${id}`,
        {
          diameterX: 0.88 * scale,
          diameterY: 0.92 * scale,
          diameterZ: 0.98 * scale,
          slice: 0.55,
          segments: 12,
        },
        this.scene,
      );
      helmDome.position.y = 0.06 * scale;
      helmDome.material = this.darkPlateMat;
      helmDome.parent = cranium;

      const nasalBar = BABYLON.MeshBuilder.CreateBox(
        `nasal_${id}`,
        { width: 0.08 * scale, height: 0.42 * scale, depth: 0.1 * scale },
        this.scene,
      );
      nasalBar.position.set(0, 0.05 * scale, 0.48 * scale);
      nasalBar.material = this.darkPlateMat;
      nasalBar.parent = cranium;

      if (scale > 1.05) {
        for (const side of [-1, 1]) {
          const horn = BABYLON.MeshBuilder.CreateCylinder(
            `horn_${id}_${side}`,
            {
              diameterTop: 0.03 * scale,
              diameterBottom: 0.22 * scale,
              height: 0.85 * scale,
              tessellation: 10,
            },
            this.scene,
          );
          horn.position.set(side * 0.55 * scale, 0.35 * scale, 0.08 * scale);
          horn.rotation.z = side * -0.75;
          horn.rotation.x = 0.35;
          horn.material = this.boneMat;
          horn.parent = cranium;
        }
      }
    }

    return cranium;
  }

  private buildArticulatedArm(
    name: string,
    radius: number,
    length: number,
    upperMat: BABYLON.Material,
    lowerMat: BABYLON.Material,
    parent: BABYLON.TransformNode,
    x: number,
    y: number,
    z: number,
    weapon: "sword" | "shield" | "shield_heavy" | "cleaver" | "warhammer" | "scythe" | "none",
  ): { shoulder: BABYLON.TransformNode; shieldMesh?: BABYLON.Mesh } {
    const shoulder = new BABYLON.TransformNode(`${name}_shoulder`, this.scene);
    shoulder.position.set(x, y, z);
    shoulder.parent = parent;

    const upperLen = length * 0.52;
    const lowerLen = length * 0.52;

    const upperArm = BABYLON.MeshBuilder.CreateCapsule(
      `${name}_upper`,
      { radius, height: upperLen, tessellation: 10 },
      this.scene,
    );
    upperArm.position.set(0, -upperLen * 0.4, 0);
    upperArm.material = upperMat;
    upperArm.parent = shoulder;

    const forearm = BABYLON.MeshBuilder.CreateCapsule(
      `${name}_forearm`,
      { radius: radius * 0.88, height: lowerLen, tessellation: 10 },
      this.scene,
    );
    forearm.position.set(0, -upperLen * 0.82, lowerLen * 0.28);
    forearm.rotation.x = 0.65;
    forearm.material = lowerMat;
    forearm.parent = shoulder;

    let shieldMesh: BABYLON.Mesh | undefined;

    if (weapon === "sword" || weapon === "cleaver") {
      const bladeLen = weapon === "sword" ? 1.55 : 1.1;
      const blade = BABYLON.MeshBuilder.CreateBox(
        `${name}_blade`,
        { width: 0.05, height: bladeLen, depth: weapon === "cleaver" ? 0.24 : 0.14 },
        this.scene,
      );
      blade.position.set(0, -lowerLen * 0.45, bladeLen * 0.45);
      blade.rotation.x = Math.PI / 2.2;
      blade.material = this.darkPlateMat;
      blade.parent = forearm;

      const crossguard = BABYLON.MeshBuilder.CreateBox(
        `${name}_guard`,
        { width: 0.38, height: 0.08, depth: 0.1 },
        this.scene,
      );
      crossguard.position.set(0, -lowerLen * 0.4, 0.1);
      crossguard.material = this.rustedMailMat;
      crossguard.parent = forearm;
    } else if (weapon === "shield" || weapon === "shield_heavy") {
      const sz = weapon === "shield_heavy" ? 1.85 : 1.3;
      const shield = BABYLON.MeshBuilder.CreateCylinder(
        `${name}_shield`,
        { diameter: sz, height: 0.12, tessellation: 16 },
        this.scene,
      );
      shield.rotation.z = Math.PI / 2;
      shield.rotation.y = 0.35;
      shield.position.set(-0.22, -0.15, 0.25);
      shield.material = weapon === "shield_heavy" ? this.darkPlateMat : this.woodShieldMat;
      shield.parent = forearm;
      shieldMesh = shield;

      const boss = BABYLON.MeshBuilder.CreateSphere(
        `${name}_boss`,
        { diameter: sz * 0.28, segments: 8 },
        this.scene,
      );
      boss.position.set(0, 0.08, 0);
      boss.material = this.darkPlateMat;
      boss.parent = shield;
    } else if (weapon === "warhammer") {
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        `${name}_shaft`,
        { diameter: 0.18, height: 3.1, tessellation: 10 },
        this.scene,
      );
      shaft.position.set(0, -0.4, 0.95);
      shaft.rotation.x = Math.PI / 2.4;
      shaft.material = this.woodShieldMat;
      shaft.parent = forearm;

      const hammerHead = BABYLON.MeshBuilder.CreateBox(
        `${name}_hammerHead`,
        { width: 0.95, height: 0.55, depth: 0.58 },
        this.scene,
      );
      hammerHead.position.set(0, 1.35, 0);
      hammerHead.material = this.darkPlateMat;
      hammerHead.parent = shaft;
    } else if (weapon === "scythe") {
      const pole = BABYLON.MeshBuilder.CreateCylinder(
        `${name}_pole`,
        { diameter: 0.1, height: 2.6, tessellation: 8 },
        this.scene,
      );
      pole.position.set(0, -0.3, 0.65);
      pole.rotation.x = Math.PI / 2.6;
      pole.material = this.woodShieldMat;
      pole.parent = forearm;

      const scytheBlade = BABYLON.MeshBuilder.CreateBox(
        `${name}_scytheBlade`,
        { width: 0.05, height: 0.18, depth: 1.15 },
        this.scene,
      );
      scytheBlade.position.set(0, 1.2, 0.45);
      scytheBlade.rotation.x = 0.25;
      scytheBlade.material = this.wraithCoreMat;
      scytheBlade.parent = pole;
    }

    return { shoulder, shieldMesh };
  }

  private buildArticulatedLeg(
    name: string,
    radius: number,
    length: number,
    thighMat: BABYLON.Material,
    greaveMat: BABYLON.Material,
    parent: BABYLON.TransformNode,
    x: number,
    y: number,
    z: number,
  ): BABYLON.TransformNode {
    const hip = new BABYLON.TransformNode(`${name}_hip`, this.scene);
    hip.position.set(x, y, z);
    hip.parent = parent;

    const thigh = BABYLON.MeshBuilder.CreateCapsule(
      `${name}_thigh`,
      { radius, height: length * 0.58, tessellation: 10 },
      this.scene,
    );
    thigh.position.set(0, -length * 0.25, 0.05);
    thigh.rotation.x = -0.15;
    thigh.material = thighMat;
    thigh.parent = hip;

    const greave = BABYLON.MeshBuilder.CreateCapsule(
      `${name}_greave`,
      { radius: radius * 0.86, height: length * 0.58, tessellation: 10 },
      this.scene,
    );
    greave.position.set(0, -length * 0.68, -0.04);
    greave.rotation.x = 0.15;
    greave.material = greaveMat;
    greave.parent = hip;

    return hip;
  }

  public update(
    dt: number,
    onGateAttack: (dmg: number) => void,
    onBurnDeath?: (z: BabylonZombie) => void,
    onNecroPulse?: (pos: BABYLON.Vector3) => void,
    onCulvertAttack?: (dmg: number) => void,
  ) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      // Handle dramatic ragdoll tumble or death collapse animation before removal
      if (z.dead) {
        z.dyingTimer += dt;
        z.hpBarBg.visibility = 0;
        z.hpBarFill.visibility = 0;

        if (z.ragdollVel) {
          z.ragdollVel.y -= 19 * dt; // gravity
          z.pos.addInPlace(z.ragdollVel.scale(dt));
          z.root.position.copyFrom(z.pos);
          if (z.ragdollSpin) {
            z.root.rotation.x += z.ragdollSpin.x * dt;
            z.root.rotation.y += z.ragdollSpin.y * dt;
            z.root.rotation.z += z.ragdollSpin.z * dt;
          }
          if (z.pos.y <= 0.25) {
            z.pos.y = 0.25;
            z.ragdollVel.y *= -0.35;
            z.ragdollVel.x *= 0.65;
            z.ragdollVel.z *= 0.65;
          }
        } else {
          z.root.rotation.x = -Math.min(Math.PI / 2, z.dyingTimer * 4.2);
          z.root.position.y = Math.max(-0.4, -z.dyingTimer * 1.2);
        }

        if (z.dyingTimer >= (z.ragdollVel ? 1.4 : 0.42)) {
          this.removeZombie(z);
        }
        continue;
      }

      // 1. Burn DoT & Aura
      if (z.burnTimer > 0) {
        z.burnTimer -= dt;
        z.hp -= z.burnDps * dt;
        if (z.burnAuraMesh) {
          z.burnAuraMesh.visibility = 0.65 + Math.sin(performance.now() * 0.025) * 0.2;
        }
        if (z.hp <= 0) {
          z.dead = true;
          onBurnDeath?.(z);
          continue;
        }
      } else if (z.burnAuraMesh) {
        z.burnAuraMesh.visibility = 0;
      }

      // 2. Frost Slow & Aura
      let speedMul = 1.0;
      if (z.frostTimer > 0) {
        z.frostTimer -= dt;
        speedMul = 0.45;
        if (z.frostAuraMesh) {
          z.frostAuraMesh.visibility = 0.78;
          z.frostAuraMesh.rotation.y += dt * 2.5;
        }
      } else if (z.frostAuraMesh) {
        z.frostAuraMesh.visibility = 0;
      }

      // 3. Hit Stagger recovery
      if (z.staggerTimer > 0) {
        z.staggerTimer -= dt;
        speedMul *= 0.25;
        z.root.rotation.x = -0.28 * (z.staggerTimer / 0.22);
      } else {
        z.root.rotation.x = 0;
      }

      // 4. Necromancer Barrow-Wraith Ritual Pulse (heals & hastens nearby undead)
      if (z.type === "banshee") {
        z.ritualTimer -= dt;
        if (z.ritualTimer <= 0) {
          z.ritualTimer = 6.5;
          onNecroPulse?.(z.pos.clone());
          for (const ally of this.zombies) {
            if (!ally.dead && BABYLON.Vector3.Distance(z.pos, ally.pos) <= 11.0) {
              ally.hp = Math.min(ally.maxHp, ally.hp + 22);
            }
          }
        }
      }

      const effectiveSpeed = z.speed * speedMul;
      z.walkTimer += dt * (effectiveSpeed * 0.85);

      // Update tactical health bar
      const pct = Math.max(0.01, z.hp / z.maxHp);
      z.hpBarFill.scaling.x = pct;
      const isDamaged = pct < 0.99 || z.type === "warlord";
      z.hpBarBg.visibility = isDamaged ? 0.92 : 0.35;
      z.hpBarFill.visibility = isDamaged ? 0.98 : 0.45;

      if (z.type === "warlord") {
        z.hpBarMat.emissiveColor.set(0.95, 0.25, 0.85);
      } else if (pct > 0.55) {
        z.hpBarMat.emissiveColor.set(0.25, 0.78, 0.32);
      } else if (pct > 0.25) {
        z.hpBarMat.emissiveColor.set(0.92, 0.62, 0.12);
      } else {
        z.hpBarMat.emissiveColor.set(0.92, 0.18, 0.14);
      }

      const isCulvert = z.isCulvertTarget || z.targetPos.x < -15;
      const distToTarget = isCulvert
        ? Math.hypot(z.pos.x - z.targetPos.x, z.pos.z - z.targetPos.z)
        : Math.abs(z.pos.z - z.targetPos.z);
      const attackDist = z.type === "ram" ? 3.5 : isCulvert ? 2.5 : 1.2;

      if (distToTarget <= attackDist) {
        if (z.type === "sapper") {
          if (isCulvert) {
            onCulvertAttack?.(z.damage);
          } else {
            onGateAttack(z.damage);
          }
          z.hp = 0;
          z.dead = true;
          onBurnDeath?.(z);
          continue;
        }
        z.isAttackingGate = true;
        z.attackTimer += dt;
        if (z.type === "ram") {
          // Battering Ram timber beam piston slam
          const cycle = Math.sin(z.attackTimer * 3.5);
          if (z.limbs.length > 0) {
            z.limbs[0].position.z = 0.4 + cycle * 1.35;
          }
          if (z.headMesh) {
            z.headMesh.position.z = 3.8 + cycle * 1.35;
          }
          if (z.attackTimer >= 1.6) {
            z.attackTimer = 0;
            onGateAttack(z.damage);
          }
        } else {
          if (z.limbs.length >= 2) {
            z.limbs[0].rotation.x = -0.5 + Math.sin(z.attackTimer * 7) * 0.55;
            z.limbs[1].rotation.x = -0.85 + Math.cos(z.attackTimer * 7) * 0.95;
          }
          if (z.attackTimer >= 1.2) {
            z.attackTimer = 0;
            onGateAttack(z.damage);
          }
        }
      } else {
        const dx = z.targetPos.x - z.pos.x;
        const dz = z.targetPos.z - z.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        z.pos.x += nx * effectiveSpeed * dt;
        z.pos.z += nz * effectiveSpeed * dt;

        // Lateral crowd separation
        for (let j = 0; j < this.zombies.length; j++) {
          if (i === j) continue;
          const other = this.zombies[j];
          if (other.dead) continue;
          const sx = z.pos.x - other.pos.x;
          const sz = z.pos.z - other.pos.z;
          const dist = Math.hypot(sx, sz);
          const minSep = (z.radius + other.radius) * 1.15;
          if (dist > 0.01 && dist < minSep) {
            const push = (minSep - dist) * 2.5 * dt;
            z.pos.x += (sx / dist) * push;
            z.pos.z += (sz / dist) * push * 0.4;
          }
        }
        const minX = isCulvert ? -26.0 : -8.2;
        z.pos.x = Math.max(minX, Math.min(8.2, z.pos.x));

        z.root.position.copyFrom(z.pos);
        z.root.rotation.y = Math.atan2(nx, nz);

        const swing = Math.sin(z.walkTimer) * 0.58;
        z.root.position.y = Math.abs(Math.cos(z.walkTimer)) * 0.14;
        z.root.rotation.z = Math.sin(z.walkTimer) * 0.04;
        if (z.limbs.length >= 4) {
          if (z.type === "sapper") {
            z.limbs[0].rotation.x = -2.45 + swing * 0.12;
            z.limbs[1].rotation.x = -2.45 - swing * 0.12;
          } else {
            z.limbs[0].rotation.x = z.hasShield ? -0.55 : swing * 0.7 - 0.25;
            z.limbs[1].rotation.x = -swing * 0.7 - 0.35;
          }
          z.limbs[2].rotation.x = -swing;
          z.limbs[3].rotation.x = swing;
        } else if (z.limbs.length >= 2) {
          z.limbs[0].rotation.x = swing * 0.4 - 0.4;
          z.limbs[1].rotation.x = -swing * 0.4 - 0.4;
        }
      }
    }
  }

  public removeZombie(zombie: BabylonZombie) {
    zombie.root.dispose();
    this.zombies = this.zombies.filter((item) => item.id !== zombie.id);
  }

  public clear() {
    for (const z of this.zombies) {
      z.root.dispose();
    }
    this.zombies = [];
  }
}
