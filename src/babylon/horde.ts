import * as BABYLON from "@babylonjs/core";
import type { ZombieType } from "@/helmsdeep/types";

export interface BabylonZombie {
  id: number;
  type: ZombieType;
  root: BABYLON.TransformNode;
  headMesh: BABYLON.Mesh;
  limbs: BABYLON.TransformNode[];
  hpBarFill: BABYLON.Mesh;
  hpBarMat: BABYLON.StandardMaterial;
  pos: BABYLON.Vector3;
  targetPos: BABYLON.Vector3;
  speed: number;
  hp: number;
  maxHp: number;
  gold: number;
  damage: number;
  attackTimer: number;
  walkTimer: number;
  isAttackingGate: boolean;
  dead: boolean;
  radius: number;
  headRadius: number;
}

export class BabylonZombieHorde {
  public scene: BABYLON.Scene;
  public zombies: BabylonZombie[] = [];
  private nextId = 1;

  private boneMat: BABYLON.StandardMaterial;
  private fleshMat: BABYLON.StandardMaterial;
  private armorMat: BABYLON.StandardMaterial;
  private bruteHideMat: BABYLON.StandardMaterial;
  private darkClothMat: BABYLON.StandardMaterial;
  private eyeRedMat: BABYLON.StandardMaterial;
  private eyeAmberMat: BABYLON.StandardMaterial;
  private wraithMat: BABYLON.StandardMaterial;
  private hpBgMat: BABYLON.StandardMaterial;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // Crisp 3D-shaded materials with directional highlights
    this.boneMat = new BABYLON.StandardMaterial("zBoneMat", scene);
    this.boneMat.diffuseColor = new BABYLON.Color3(0.82, 0.76, 0.65);
    this.boneMat.emissiveColor = new BABYLON.Color3(0.06, 0.05, 0.04);
    this.boneMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.2);

    this.fleshMat = new BABYLON.StandardMaterial("zFleshMat", scene);
    this.fleshMat.diffuseColor = new BABYLON.Color3(0.34, 0.48, 0.36);
    this.fleshMat.emissiveColor = new BABYLON.Color3(0.04, 0.07, 0.04);
    this.fleshMat.specularColor = new BABYLON.Color3(0.2, 0.28, 0.2);

    this.armorMat = new BABYLON.StandardMaterial("zArmorMat", scene);
    this.armorMat.diffuseColor = new BABYLON.Color3(0.26, 0.3, 0.36);
    this.armorMat.emissiveColor = new BABYLON.Color3(0.03, 0.04, 0.05);
    this.armorMat.specularColor = new BABYLON.Color3(0.65, 0.7, 0.78);
    this.armorMat.specularPower = 28;

    this.bruteHideMat = new BABYLON.StandardMaterial("zBruteHideMat", scene);
    this.bruteHideMat.diffuseColor = new BABYLON.Color3(0.42, 0.28, 0.22);
    this.bruteHideMat.emissiveColor = new BABYLON.Color3(0.05, 0.03, 0.02);
    this.bruteHideMat.specularColor = new BABYLON.Color3(0.25, 0.18, 0.14);

    this.darkClothMat = new BABYLON.StandardMaterial("zDarkClothMat", scene);
    this.darkClothMat.diffuseColor = new BABYLON.Color3(0.38, 0.14, 0.14);
    this.darkClothMat.emissiveColor = new BABYLON.Color3(0.04, 0.01, 0.01);

    this.eyeRedMat = new BABYLON.StandardMaterial("zEyeRedMat", scene);
    this.eyeRedMat.emissiveColor = new BABYLON.Color3(1.0, 0.15, 0.08);
    this.eyeRedMat.disableLighting = true;

    this.eyeAmberMat = new BABYLON.StandardMaterial("zEyeAmberMat", scene);
    this.eyeAmberMat.emissiveColor = new BABYLON.Color3(1.0, 0.72, 0.05);
    this.eyeAmberMat.disableLighting = true;

    this.wraithMat = new BABYLON.StandardMaterial("zWraithMat", scene);
    this.wraithMat.diffuseColor = new BABYLON.Color3(0.2, 0.85, 1.0);
    this.wraithMat.emissiveColor = new BABYLON.Color3(0.18, 0.68, 0.92);
    this.wraithMat.alpha = 0.82;

    this.hpBgMat = new BABYLON.StandardMaterial("zHpBgMat", scene);
    this.hpBgMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.1);
    this.hpBgMat.disableLighting = true;
  }

  public spawn(type: ZombieType, spawnZ = -110, spreadX = 6.5, gateZ = -22.0): BabylonZombie {
    const id = this.nextId++;
    const root = new BABYLON.TransformNode(`zombie_${id}`, this.scene);
    const limbs: BABYLON.TransformNode[] = [];
    let headMesh!: BABYLON.Mesh;

    let hp = 65;
    let speed = 7.2;
    let gold = 16;
    let damage = 18;
    let radius = 1.6;
    let headRadius = 0.85;
    let badgeHeight = 4.6;

    const startX = (Math.random() - 0.5) * spreadX * 2;
    const targetX = (Math.random() - 0.5) * 6.0;
    const targetPos = new BABYLON.Vector3(targetX, 0, gateZ - 1.2);

    if (type === "runner") {
      // 1. FERAL GHOUL HOUND-RUNNER (Organic crouched sprinter with curved spine & claws)
      hp = 42;
      speed = 13.5;
      gold = 14;
      damage = 11;
      radius = 1.45;
      headRadius = 0.8;
      badgeHeight = 4.0;

      // Sculpted Capsule Torso + Pelvis
      const pelvis = BABYLON.MeshBuilder.CreateCapsule(
        `pelvis_${id}`,
        { radius: 0.42, height: 1.2, tessellation: 12 },
        this.scene,
      );
      pelvis.position.set(0, 1.4, -0.15);
      pelvis.rotation.x = 0.45;
      pelvis.material = this.darkClothMat;
      pelvis.parent = root;

      const chest = BABYLON.MeshBuilder.CreateCapsule(
        `chest_${id}`,
        { radius: 0.56, height: 1.55, tessellation: 14 },
        this.scene,
      );
      chest.position.set(0, 2.15, 0.25);
      chest.rotation.x = 0.65;
      chest.material = this.fleshMat;
      chest.parent = root;

      // Dorsal Bone Spines along the back
      for (let s = 0; s < 3; s++) {
        const spineSpike = BABYLON.MeshBuilder.CreateCylinder(
          `spike_${id}_${s}`,
          { diameterTop: 0.02, diameterBottom: 0.22, height: 0.55, tessellation: 8 },
          this.scene,
        );
        spineSpike.position.set(0, 2.4 - s * 0.35, -0.2 - s * 0.18);
        spineSpike.rotation.x = -0.7;
        spineSpike.material = this.boneMat;
        spineSpike.parent = root;
      }

      // Sculpted Cranium & Jaw
      headMesh = BABYLON.MeshBuilder.CreateSphere(
        `head_${id}`,
        { diameterX: 1.05, diameterY: 1.1, diameterZ: 1.25, segments: 12 },
        this.scene,
      );
      headMesh.position.set(0, 2.95, 0.72);
      headMesh.material = this.boneMat;
      headMesh.parent = root;

      this.attachGlowingEyes(headMesh, id, 0.24, 0.1, 0.52, 0.22, this.eyeRedMat);

      // Articulated Capsule Limbs
      const armL = this.createCapsuleLimb(`armL_${id}`, 0.22, 1.65, this.fleshMat, root, -0.72, 2.2, 0.35);
      const armR = this.createCapsuleLimb(`armR_${id}`, 0.22, 1.65, this.fleshMat, root, 0.72, 2.2, 0.35);
      const legL = this.createCapsuleLimb(`legL_${id}`, 0.26, 1.55, this.boneMat, root, -0.38, 0.85, -0.1);
      const legR = this.createCapsuleLimb(`legR_${id}`, 0.26, 1.55, this.boneMat, root, 0.38, 0.85, -0.1);
      limbs.push(armL, armR, legL, legR);
    } else if (type === "brute") {
      // 2. MASSIVE ARMORED URUK SIEGE TROLL / BRUTE (Sculpted muscular giant with horned helm & spiked war-mace)
      hp = 270;
      speed = 5.0;
      gold = 45;
      damage = 50;
      radius = 2.6;
      headRadius = 1.25;
      badgeHeight = 6.9;

      // Huge Muscular Capsule Torso
      const abdomen = BABYLON.MeshBuilder.CreateCapsule(
        `abdomen_${id}`,
        { radius: 1.15, height: 2.8, tessellation: 16 },
        this.scene,
      );
      abdomen.position.set(0, 2.6, 0);
      abdomen.material = this.bruteHideMat;
      abdomen.parent = root;

      // Rounded Iron Cuirass & Shoulder Pauldrons
      const chestArmor = BABYLON.MeshBuilder.CreateCylinder(
        `cuirass_${id}`,
        { diameterTop: 2.7, diameterBottom: 2.2, height: 1.9, tessellation: 16 },
        this.scene,
      );
      chestArmor.position.set(0, 3.6, 0.08);
      chestArmor.material = this.armorMat;
      chestArmor.parent = root;

      for (const side of [-1, 1]) {
        const pauldron = BABYLON.MeshBuilder.CreateSphere(
          `pauldron_${id}_${side}`,
          { diameter: 1.45, slice: 0.6, segments: 12 },
          this.scene,
        );
        pauldron.position.set(side * 1.55, 4.15, 0);
        pauldron.rotation.z = side * -0.35;
        pauldron.material = this.armorMat;
        pauldron.parent = root;
      }

      // Brute Head + Horned Siege Helmet
      headMesh = BABYLON.MeshBuilder.CreateSphere(
        `head_${id}`,
        { diameterX: 1.5, diameterY: 1.55, diameterZ: 1.55, segments: 14 },
        this.scene,
      );
      headMesh.position.set(0, 5.15, 0.25);
      headMesh.material = this.bruteHideMat;
      headMesh.parent = root;

      const helmDome = BABYLON.MeshBuilder.CreateSphere(
        `helm_${id}`,
        { diameter: 1.62, slice: 0.55, segments: 12 },
        this.scene,
      );
      helmDome.position.y = 0.1;
      helmDome.material = this.armorMat;
      helmDome.parent = headMesh;

      // Curved Siege Horns on Helmet
      for (const side of [-1, 1]) {
        const horn = BABYLON.MeshBuilder.CreateCylinder(
          `horn_${id}_${side}`,
          { diameterTop: 0.04, diameterBottom: 0.34, height: 1.1, tessellation: 10 },
          this.scene,
        );
        horn.position.set(side * 0.78, 0.45, 0.1);
        horn.rotation.z = side * -0.65;
        horn.rotation.x = 0.3;
        horn.material = this.boneMat;
        horn.parent = headMesh;
      }

      this.attachGlowingEyes(headMesh, id, 0.32, 0.08, 0.7, 0.28, this.eyeAmberMat);

      // Massive Capsule Arms & Spiked Siege War-Mace
      const armL = this.createCapsuleLimb(`armL_${id}`, 0.46, 2.5, this.bruteHideMat, root, -1.75, 3.6, 0);
      const armR = this.createCapsuleLimb(`armR_${id}`, 0.46, 2.5, this.bruteHideMat, root, 1.75, 3.6, 0);

      const maceShaft = BABYLON.MeshBuilder.CreateCylinder(
        `maceShaft_${id}`,
        { diameter: 0.24, height: 3.0, tessellation: 10 },
        this.scene,
      );
      maceShaft.position.set(0, -1.2, 0.85);
      maceShaft.rotation.x = Math.PI / 3;
      maceShaft.material = this.armorMat;
      maceShaft.parent = armR;

      const maceHead = BABYLON.MeshBuilder.CreatePolyhedron(
        `maceHead_${id}`,
        { type: 1, size: 0.65 },
        this.scene,
      );
      maceHead.position.set(0, 1.35, 0);
      maceHead.material = this.armorMat;
      maceHead.parent = maceShaft;

      const legL = this.createCapsuleLimb(`legL_${id}`, 0.52, 2.2, this.darkClothMat, root, -0.78, 1.2, 0);
      const legR = this.createCapsuleLimb(`legR_${id}`, 0.52, 2.2, this.darkClothMat, root, 0.78, 1.2, 0);
      limbs.push(armL, armR, legL, legR);
    } else if (type === "banshee") {
      // 3. ETHEREAL BARROW-WRAITH / BANSHEE (Glowing spectral shroud, crown, and floating scythe arms)
      hp = 75;
      speed = 9.6;
      gold = 28;
      damage = 25;
      radius = 1.5;
      headRadius = 0.85;
      badgeHeight = 5.0;

      // Flowing Tapered Spectral Cloak
      const cloak = BABYLON.MeshBuilder.CreateCylinder(
        `cloak_${id}`,
        { diameterTop: 0.65, diameterBottom: 2.2, height: 3.3, tessellation: 16 },
        this.scene,
      );
      cloak.position.set(0, 2.0, 0);
      cloak.material = this.wraithMat;
      cloak.parent = root;

      // Orbiting Spirit Ring
      const auraRing = BABYLON.MeshBuilder.CreateTorus(
        `auraRing_${id}`,
        { diameter: 2.1, thickness: 0.1, tessellation: 20 },
        this.scene,
      );
      auraRing.position.set(0, 2.2, 0);
      auraRing.material = this.wraithMat;
      auraRing.parent = root;

      headMesh = BABYLON.MeshBuilder.CreateSphere(
        `head_${id}`,
        { diameter: 1.15, segments: 14 },
        this.scene,
      );
      headMesh.position.set(0, 3.85, 0.1);
      headMesh.material = this.boneMat;
      headMesh.parent = root;

      this.attachGlowingEyes(headMesh, id, 0.22, 0.08, 0.52, 0.24, this.wraithMat);

      const armL = this.createCapsuleLimb(`armL_${id}`, 0.2, 1.8, this.wraithMat, root, -0.85, 3.1, 0.25);
      const armR = this.createCapsuleLimb(`armR_${id}`, 0.2, 1.8, this.wraithMat, root, 0.85, 3.1, 0.25);
      limbs.push(armL, armR);
    } else {
      // 4. FALLEN WARRIOR SHAMBLER (Organic armored undead soldier with round shield & helm)
      hp = 68;
      speed = 6.8;
      gold = 16;
      damage = 18;
      radius = 1.5;
      headRadius = 0.85;
      badgeHeight = 4.6;

      const torso = BABYLON.MeshBuilder.CreateCapsule(
        `torso_${id}`,
        { radius: 0.62, height: 1.95, tessellation: 14 },
        this.scene,
      );
      torso.position.set(0, 2.2, 0);
      torso.material = this.fleshMat;
      torso.parent = root;

      // Rounded Breastplate & Pauldrons
      const breastplate = BABYLON.MeshBuilder.CreateCylinder(
        `breastplate_${id}`,
        { diameterTop: 1.4, diameterBottom: 1.15, height: 1.15, tessellation: 14 },
        this.scene,
      );
      breastplate.position.set(0, 2.45, 0.06);
      breastplate.material = this.armorMat;
      breastplate.parent = root;

      headMesh = BABYLON.MeshBuilder.CreateSphere(
        `head_${id}`,
        { diameterX: 1.05, diameterY: 1.12, diameterZ: 1.08, segments: 14 },
        this.scene,
      );
      headMesh.position.set(0, 3.55, 0.1);
      headMesh.material = this.boneMat;
      headMesh.parent = root;

      // Kettle Helm
      const kettleHelm = BABYLON.MeshBuilder.CreateCylinder(
        `kettleHelm_${id}`,
        { diameterTop: 0.55, diameterBottom: 1.35, height: 0.55, tessellation: 14 },
        this.scene,
      );
      kettleHelm.position.y = 0.42;
      kettleHelm.material = this.armorMat;
      kettleHelm.parent = headMesh;

      this.attachGlowingEyes(headMesh, id, 0.22, 0.06, 0.48, 0.2, this.eyeRedMat);

      const armL = this.createCapsuleLimb(`armL_${id}`, 0.24, 1.65, this.fleshMat, root, -0.82, 2.5, 0.1);
      const armR = this.createCapsuleLimb(`armR_${id}`, 0.24, 1.65, this.fleshMat, root, 0.82, 2.5, 0.1);

      // Round Wooden War-Shield on Left Arm
      const shield = BABYLON.MeshBuilder.CreateCylinder(
        `shield_${id}`,
        { diameter: 1.25, height: 0.14, tessellation: 16 },
        this.scene,
      );
      shield.rotation.z = Math.PI / 2;
      shield.position.set(-0.22, -0.5, 0.25);
      shield.material = this.darkClothMat;
      shield.parent = armL;

      // Crude Broadsword on Right Arm
      const sword = BABYLON.MeshBuilder.CreateCylinder(
        `sword_${id}`,
        { diameterTop: 0.03, diameterBottom: 0.14, height: 1.45, tessellation: 6 },
        this.scene,
      );
      sword.rotation.x = Math.PI / 2.5;
      sword.position.set(0, -0.65, 0.55);
      sword.material = this.armorMat;
      sword.parent = armR;

      const legL = this.createCapsuleLimb(`legL_${id}`, 0.28, 1.6, this.darkClothMat, root, -0.4, 0.9, 0);
      const legR = this.createCapsuleLimb(`legR_${id}`, 0.28, 1.6, this.darkClothMat, root, 0.4, 0.9, 0);
      limbs.push(armL, armR, legL, legR);
    }

    // Floating Billboard Health Bar above each zombie so every enemy is clearly trackable
    const hpBg = BABYLON.MeshBuilder.CreatePlane(
      `hpBg_${id}`,
      { width: 2.2, height: 0.28 },
      this.scene,
    );
    hpBg.position.set(0, badgeHeight, 0);
    hpBg.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    hpBg.material = this.hpBgMat;
    hpBg.parent = root;

    const hpBarMat = new BABYLON.StandardMaterial(`hpBarMat_${id}`, this.scene);
    hpBarMat.emissiveColor = new BABYLON.Color3(0.18, 0.92, 0.32);
    hpBarMat.disableLighting = true;

    const hpBarFill = BABYLON.MeshBuilder.CreatePlane(
      `hpFill_${id}`,
      { width: 2.08, height: 0.2 },
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
      hpBarFill,
      hpBarMat,
      pos: startPos,
      targetPos,
      speed,
      hp,
      maxHp: hp,
      gold,
      damage,
      attackTimer: 0,
      walkTimer: Math.random() * 10,
      isAttackingGate: false,
      dead: false,
      radius,
      headRadius,
    };

    this.zombies.push(zombie);
    return zombie;
  }

  private createCapsuleLimb(
    name: string,
    radius: number,
    height: number,
    mat: BABYLON.StandardMaterial,
    parent: BABYLON.TransformNode,
    x: number,
    y: number,
    z: number,
  ): BABYLON.TransformNode {
    const joint = new BABYLON.TransformNode(`${name}_joint`, this.scene);
    joint.position.set(x, y, z);
    joint.parent = parent;

    const capsule = BABYLON.MeshBuilder.CreateCapsule(
      name,
      { radius, height, tessellation: 10 },
      this.scene,
    );
    capsule.position.set(0, -height * 0.35, 0);
    capsule.material = mat;
    capsule.parent = joint;

    return joint;
  }

  private attachGlowingEyes(
    head: BABYLON.Mesh,
    id: number,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    size: number,
    mat: BABYLON.StandardMaterial,
  ) {
    for (const side of [-1, 1]) {
      const eye = BABYLON.MeshBuilder.CreateSphere(
        `eye_${id}_${side}`,
        { diameter: size, segments: 8 },
        this.scene,
      );
      eye.position.set(side * offsetX, offsetY, offsetZ);
      eye.material = mat;
      eye.parent = head;
    }
  }

  public update(dt: number, onGateAttack: (dmg: number) => void) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead) continue;

      z.walkTimer += dt * (z.speed * 0.85);

      // Update floating health bar fill & color
      const pct = Math.max(0.01, z.hp / z.maxHp);
      z.hpBarFill.scaling.x = pct;
      if (pct > 0.55) {
        z.hpBarMat.emissiveColor.set(0.18, 0.92, 0.32);
      } else if (pct > 0.25) {
        z.hpBarMat.emissiveColor.set(0.98, 0.72, 0.12);
      } else {
        z.hpBarMat.emissiveColor.set(0.95, 0.18, 0.15);
      }

      const distToGate = Math.abs(z.pos.z - z.targetPos.z);

      if (distToGate <= 1.1) {
        z.isAttackingGate = true;
        z.attackTimer += dt;
        // Swing weapon arms while bashing the gate
        if (z.limbs.length >= 2) {
          z.limbs[0].rotation.x = -0.8 + Math.sin(z.attackTimer * 7) * 0.75;
          z.limbs[1].rotation.x = -0.8 + Math.cos(z.attackTimer * 7) * 0.75;
        }
        if (z.attackTimer >= 1.2) {
          z.attackTimer = 0;
          onGateAttack(z.damage);
        }
      } else {
        const dx = z.targetPos.x - z.pos.x;
        const dz = z.targetPos.z - z.pos.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = dx / len;
        const nz = dz / len;

        z.pos.x += nx * z.speed * dt;
        z.pos.z += nz * z.speed * dt;

        // Lateral separation so zombies spread out across the road and never stack inside each other
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
        z.pos.x = Math.max(-8.2, Math.min(8.2, z.pos.x));

        z.root.position.copyFrom(z.pos);
        z.root.rotation.y = Math.atan2(nx, nz);

        // Organic stride animation (arms & legs counter-swing + torso bob)
        const swing = Math.sin(z.walkTimer) * 0.65;
        z.root.position.y = Math.abs(Math.cos(z.walkTimer)) * 0.18;
        if (z.limbs.length >= 4) {
          z.limbs[0].rotation.x = swing - 0.35;
          z.limbs[1].rotation.x = -swing - 0.35;
          z.limbs[2].rotation.x = -swing;
          z.limbs[3].rotation.x = swing;
        } else if (z.limbs.length >= 2) {
          z.limbs[0].rotation.x = swing * 0.5 - 0.5;
          z.limbs[1].rotation.x = -swing * 0.5 - 0.5;
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
