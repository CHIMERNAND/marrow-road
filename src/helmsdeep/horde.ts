import * as THREE from "three";
import type { ZombieType } from "./types";

export type Zombie = {
  id: number;
  type: ZombieType;
  mesh: THREE.Group;
  headMesh: THREE.Object3D;
  limbs: THREE.Object3D[];
  hpBarMesh?: THREE.Mesh;
  pos: THREE.Vector3;
  targetPos: THREE.Vector3;
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
};

export class ZombieHorde {
  public group: THREE.Group;
  public zombies: Zombie[] = [];
  private nextId = 1;

  // High-contrast textured materials
  private boneMat = new THREE.MeshStandardMaterial({
    color: 0xf0e4cc,
    roughness: 0.4,
  });
  private fleshMat = new THREE.MeshStandardMaterial({
    color: 0x4d6350, // rotting greenish grey
    roughness: 0.7,
  });
  private armorMat = new THREE.MeshStandardMaterial({
    color: 0x2d3748, // dark iron plates
    roughness: 0.35,
    metalness: 0.85,
  });
  private bruteSkinMat = new THREE.MeshStandardMaterial({
    color: 0x3d3128,
    roughness: 0.9,
  });

  // Bright glowing emissive materials for eyes & wraith aura
  private eyeRedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  private eyeYellowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  private ghostBlueMat = new THREE.MeshBasicMaterial({
    color: 0x44ddff,
    transparent: true,
    opacity: 0.8,
  });

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  public spawn(type: ZombieType, spawnZ = -100, spreadX = 14): Zombie {
    const group = new THREE.Group();
    const limbs: THREE.Object3D[] = [];
    let headMesh: THREE.Object3D;

    let hp = 55;
    let speed = 7.5;
    let gold = 12;
    let damage = 15;
    let radius = 1.4;
    let headRadius = 0.75;
    let totalHeight = 3.2;

    const startX = (Math.random() - 0.5) * spreadX * 2;
    const targetX = (Math.random() - 0.5) * 5.0;
    const targetPos = new THREE.Vector3(targetX, 0, -16.0);

    if (type === "runner") {
      // 1. FAST FERAL GHOUL / RUNNER
      hp = 40;
      speed = 13.5;
      gold = 14;
      damage = 10;
      radius = 1.2;
      headRadius = 0.65;
      totalHeight = 2.4;

      // Hunched sprinter torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 0.8), this.boneMat);
      torso.position.y = 1.3;
      torso.rotation.x = 0.55;
      torso.castShadow = true;
      group.add(torso);

      // Distinct head with glowing red eyes
      headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.85), this.boneMat);
      headMesh.position.set(0, 2.1, 0.45);
      headMesh.castShadow = true;
      group.add(headMesh);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), this.eyeRedMat);
      eyeL.position.set(-0.24, 0.08, 0.44);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.24;
      headMesh.add(eyeL, eyeR);

      // Arms
      const armGeo = new THREE.BoxGeometry(0.24, 1.4, 0.24);
      const armL = new THREE.Mesh(armGeo, this.boneMat);
      armL.position.set(-0.68, 1.3, 0.2);
      const armR = new THREE.Mesh(armGeo, this.boneMat);
      armR.position.set(0.68, 1.3, 0.2);
      group.add(armL, armR);
      limbs.push(armL, armR);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.28, 1.4, 0.28);
      const legL = new THREE.Mesh(legGeo, this.boneMat);
      legL.position.set(-0.35, 0.7, 0);
      const legR = new THREE.Mesh(legGeo, this.boneMat);
      legR.position.set(0.35, 0.7, 0);
      group.add(legL, legR);
      limbs.push(legL, legR);
    } else if (type === "brute") {
      // 2. MASSIVE ARMORED SIEGE BRUTE (5.5m Tall Juggernaut)
      hp = 260;
      speed = 5.0;
      gold = 45;
      damage = 50;
      radius = 2.4;
      headRadius = 1.1;
      totalHeight = 5.4;

      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 1.8), this.armorMat);
      torso.position.y = 3.0;
      torso.castShadow = true;
      group.add(torso);

      headMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.3), this.bruteSkinMat);
      headMesh.position.set(0, 4.7, 0.2);
      headMesh.castShadow = true;
      group.add(headMesh);

      // Spiked Iron Helm
      const helm = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.5, 1.45), this.armorMat);
      helm.position.y = 0.55;
      headMesh.add(helm);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), this.eyeYellowMat);
      eyeL.position.set(-0.35, 0.1, 0.68);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.35;
      headMesh.add(eyeL, eyeR);

      // Massive Arms & Giant Club
      const armGeo = new THREE.BoxGeometry(0.65, 2.6, 0.65);
      const armL = new THREE.Mesh(armGeo, this.bruteSkinMat);
      armL.position.set(-1.65, 2.8, 0);
      const armR = new THREE.Mesh(armGeo, this.bruteSkinMat);
      armR.position.set(1.65, 2.8, 0);

      const club = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.15, 3.2, 6), this.armorMat);
      club.position.set(0, -0.9, 0.6);
      club.rotation.x = Math.PI / 4;
      armR.add(club);

      group.add(armL, armR);
      limbs.push(armL, armR);

      const legGeo = new THREE.BoxGeometry(0.8, 2.0, 0.8);
      const legL = new THREE.Mesh(legGeo, this.bruteSkinMat);
      legL.position.set(-0.8, 1.0, 0);
      const legR = new THREE.Mesh(legGeo, this.bruteSkinMat);
      legR.position.set(0.8, 1.0, 0);
      group.add(legL, legR);
      limbs.push(legL, legR);
    } else if (type === "banshee") {
      // 3. GLOWING ETHEREAL WRAITH
      hp = 75;
      speed = 9.5;
      gold = 28;
      damage = 25;
      radius = 1.3;
      headRadius = 0.7;
      totalHeight = 3.6;

      const shroud = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.8, 8), this.ghostBlueMat);
      shroud.position.y = 2.0;
      group.add(shroud);

      headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), this.boneMat);
      headMesh.position.set(0, 3.3, 0);
      group.add(headMesh);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), this.ghostBlueMat);
      eyeL.position.set(-0.22, 0.1, 0.55);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.22;
      headMesh.add(eyeL, eyeR);

      const armGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
      const armL = new THREE.Mesh(armGeo, this.boneMat);
      armL.position.set(-0.9, 2.3, 0.3);
      armL.rotation.z = 0.55;
      const armR = new THREE.Mesh(armGeo, this.boneMat);
      armR.position.set(0.9, 2.3, 0.3);
      armR.rotation.z = -0.55;
      group.add(armL, armR);
      limbs.push(armL, armR);
    } else {
      // 4. ARMORED SHAMBLER (Standard Undead Warrior)
      hp = 65;
      speed = 6.8;
      gold = 16;
      damage = 18;
      radius = 1.3;
      headRadius = 0.7;
      totalHeight = 3.1;

      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.7), this.fleshMat);
      torso.position.y = 1.7;
      torso.castShadow = true;
      group.add(torso);

      // Iron armor breastplate
      const cuirass = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.8, 0.76), this.armorMat);
      cuirass.position.y = 0.2;
      torso.add(cuirass);

      headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.72), this.boneMat);
      headMesh.position.set(0, 2.7, 0);
      headMesh.castShadow = true;
      group.add(headMesh);

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.eyeRedMat);
      eyeL.position.set(-0.2, 0.08, 0.38);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.2;
      headMesh.add(eyeL, eyeR);

      // Arms
      const armGeo = new THREE.BoxGeometry(0.28, 1.4, 0.28);
      const armL = new THREE.Mesh(armGeo, this.fleshMat);
      armL.position.set(-0.78, 1.7, 0);
      const armR = new THREE.Mesh(armGeo, this.fleshMat);
      armR.position.set(0.78, 1.7, 0);
      group.add(armL, armR);
      limbs.push(armL, armR);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.32, 1.4, 0.32);
      const legL = new THREE.Mesh(legGeo, this.boneMat);
      legL.position.set(-0.36, 0.7, 0);
      const legR = new THREE.Mesh(legGeo, this.boneMat);
      legR.position.set(0.36, 0.7, 0);
      group.add(legL, legR);
      limbs.push(legL, legR);
    }

    const scale = type === "brute" ? 2.2 : 1.6;
    group.scale.set(scale, scale, scale);
    radius *= scale;
    headRadius *= scale;

    const startPos = new THREE.Vector3(startX, 0, spawnZ);
    group.position.copy(startPos);
    this.group.add(group);

    const zombie: Zombie = {
      id: this.nextId++,
      type,
      mesh: group,
      headMesh,
      limbs,
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

  public update(dt: number, onGateAttack: (dmg: number) => void) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead) continue;

      z.walkTimer += dt * (z.speed * 0.7);

      const distToGate = z.pos.z - z.targetPos.z;

      if (distToGate <= 0.8) {
        z.isAttackingGate = true;
        z.attackTimer += dt;
        if (z.attackTimer >= 1.2) {
          z.attackTimer = 0;
          onGateAttack(z.damage);
          z.mesh.position.z = z.targetPos.z - 0.25;
        } else {
          z.mesh.position.z = z.targetPos.z + Math.sin(z.attackTimer * 6) * 0.2;
        }
      } else {
        const dir = new THREE.Vector3().subVectors(z.targetPos, z.pos).normalize();
        z.pos.x += dir.x * z.speed * dt;
        z.pos.z += dir.z * z.speed * dt;
        z.mesh.position.copy(z.pos);

        z.mesh.rotation.y = Math.atan2(dir.x, dir.z);

        if (z.limbs.length >= 2) {
          const swing = Math.sin(z.walkTimer) * 0.6;
          z.limbs[0].rotation.x = swing;
          z.limbs[1].rotation.x = -swing;
        }
      }
    }
  }

  public removeZombie(zombie: Zombie) {
    this.group.remove(zombie.mesh);
    this.zombies = this.zombies.filter((item) => item.id !== zombie.id);
  }

  public clear() {
    for (const z of this.zombies) {
      this.group.remove(z.mesh);
    }
    this.zombies = [];
  }
}
