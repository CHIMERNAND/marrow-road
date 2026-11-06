import * as THREE from "three";
import { type TurretType, TURRET_SPECS } from "./types";
import type { Zombie } from "./horde";
import type { HelmsVFX } from "./vfx";
import type { HelmsAudio } from "./audio";

export type TurretProjectile = {
  type: TurretType;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  targetPos: THREE.Vector3;
  damage: number;
  pierce: number;
  radius: number;
  isArc: boolean;
  dead: boolean;
};

export type ActiveTurret = {
  socketId: number;
  type: TurretType;
  level: number;
  pos: THREE.Vector3;
  mesh: THREE.Group;
  pivotMesh: THREE.Group;
  cooldown: number;
  range: number;
  damage: number;
  rate: number;
  kills: number;
};

export class TurretManager {
  public group: THREE.Group;
  public turrets: Map<number, ActiveTurret> = new Map();
  public projectiles: TurretProjectile[] = [];

  // Shared Geometries & Materials
  private woodMat = new THREE.MeshStandardMaterial({ color: 0x422f20, roughness: 0.8 });
  private ironMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.4, metalness: 0.8 });
  private goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xc89e3a, roughness: 0.3, metalness: 0.7 });
  private fireGlowMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

  // Projectile geometries
  private boltGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 5);
  private harpoonGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6);
  private rockGeo = new THREE.DodecahedronGeometry(0.55);
  private oilDropGeo = new THREE.SphereGeometry(0.35, 6, 6);

  private boltMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
  private harpoonMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.2 });
  private rockMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.boltGeo.rotateX(Math.PI / 2);
    this.harpoonGeo.rotateX(Math.PI / 2);
  }

  public buildTurret(socketId: number, pos: THREE.Vector3, type: TurretType): ActiveTurret {
    // If existing turret at socket, remove it
    this.destroyTurret(socketId);

    const spec = TURRET_SPECS[type];
    const turretGroup = new THREE.Group();
    turretGroup.position.copy(pos);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.y = 0.6;
    turretGroup.add(pivotGroup);

    // Build specific 3D model
    if (type === "repeater") {
      this.buildRepeaterModel(turretGroup, pivotGroup);
    } else if (type === "oil") {
      this.buildOilCauldronModel(turretGroup, pivotGroup);
    } else if (type === "mortar") {
      this.buildMortarModel(turretGroup, pivotGroup);
    } else if (type === "ballista") {
      this.buildBallistaModel(turretGroup, pivotGroup);
    }

    this.group.add(turretGroup);

    const turret: ActiveTurret = {
      socketId,
      type,
      level: 1,
      pos: pos.clone(),
      mesh: turretGroup,
      pivotMesh: pivotGroup,
      cooldown: 0,
      range: spec.range,
      damage: spec.damage,
      rate: spec.rate,
      kills: 0,
    };

    this.turrets.set(socketId, turret);
    return turret;
  }

  public upgradeTurret(socketId: number): boolean {
    const turret = this.turrets.get(socketId);
    if (!turret || turret.level >= 3) return false;

    turret.level += 1;
    turret.damage = Math.round(turret.damage * 1.45);
    turret.rate *= 1.2;

    // Visual upgrade indicator (gold crest / ring)
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 16), this.goldTrimMat);
    crest.rotation.x = Math.PI / 2;
    crest.position.y = 1.2 + turret.level * 0.2;
    turret.mesh.add(crest);

    return true;
  }

  public destroyTurret(socketId: number) {
    const turret = this.turrets.get(socketId);
    if (turret) {
      this.group.remove(turret.mesh);
      this.turrets.delete(socketId);
    }
  }

  private buildRepeaterModel(base: THREE.Group, pivot: THREE.Group) {
    // Tripod base
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(legGeo, this.ironMat);
      const angle = (i * Math.PI * 2) / 3;
      leg.position.set(Math.sin(angle) * 0.4, 0.45, Math.cos(angle) * 0.4);
      leg.rotation.z = Math.sin(angle) * 0.35;
      leg.rotation.x = Math.cos(angle) * 0.35;
      base.add(leg);
    }

    // Swivel mount
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), this.ironMat);
    pivot.add(mount);

    // Twin crossbow bows
    const bowGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6);
    const bowTop = new THREE.Mesh(bowGeo, this.woodMat);
    bowTop.position.set(0, 0.15, -0.4);
    bowTop.rotation.z = Math.PI / 2;
    pivot.add(bowTop);

    const bowBot = new THREE.Mesh(bowGeo, this.woodMat);
    bowBot.position.set(0, -0.05, -0.4);
    bowBot.rotation.z = Math.PI / 2;
    pivot.add(bowBot);

    // Stock & quiver
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.9), this.ironMat);
    stock.position.set(0, 0.05, -0.15);
    pivot.add(stock);
  }

  private buildOilCauldronModel(base: THREE.Group, pivot: THREE.Group) {
    // Heavy stone cradle extending over wall
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.4), this.ironMat);
    cradle.position.set(0, 0.2, -0.3);
    base.add(cradle);

    // Iron Cauldron
    const cauldronGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.8, 12);
    const cauldron = new THREE.Mesh(cauldronGeo, this.ironMat);
    cauldron.position.set(0, 0.5, -0.5);
    pivot.add(cauldron);

    // Glowing bubbling boiling tar inside
    const tar = new THREE.Mesh(new THREE.CircleGeometry(0.65, 12), this.fireGlowMat);
    tar.rotation.x = -Math.PI / 2;
    tar.position.set(0, 0.91, -0.5);
    pivot.add(tar);

    // Steam/flame light
    const caulLight = new THREE.PointLight(0xff5511, 2.0, 6);
    caulLight.position.set(0, 1.2, -0.5);
    pivot.add(caulLight);
  }

  private buildMortarModel(base: THREE.Group, pivot: THREE.Group) {
    // Wooden catapult chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.6), this.woodMat);
    chassis.position.y = 0.2;
    base.add(chassis);

    // Catapult throwing arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.4), this.woodMat);
    arm.position.set(0, 0.4, -0.2);
    arm.rotation.x = -0.35;
    pivot.add(arm);

    // Brimstone payload bowl
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 0.25, 8), this.ironMat);
    bowl.position.set(0, 0.7, -0.8);
    pivot.add(bowl);

    const rock = new THREE.Mesh(this.rockGeo, this.fireGlowMat);
    rock.scale.set(0.4, 0.4, 0.4);
    rock.position.set(0, 0.85, -0.8);
    pivot.add(rock);
  }

  private buildBallistaModel(base: THREE.Group, pivot: THREE.Group) {
    // Heavy Ballista frame
    const basePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.7, 8), this.ironMat);
    basePillar.position.y = 0.35;
    base.add(basePillar);

    // Ballista bed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 2.0), this.woodMat);
    bed.position.set(0, 0.15, -0.4);
    pivot.add(bed);

    // Giant steel prod/arms
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 1.8);
    const arms = new THREE.Mesh(armGeo, this.ironMat);
    arms.position.set(0, 0.2, -1.1);
    arms.rotation.y = Math.PI / 2;
    pivot.add(arms);

    // Giant Harpoon on rail
    const harpoon = new THREE.Mesh(this.harpoonGeo, this.harpoonMat);
    harpoon.position.set(0, 0.32, -0.6);
    pivot.add(harpoon);
  }

  public update(
    dt: number,
    scene: THREE.Scene,
    zombies: Zombie[],
    vfx: HelmsVFX,
    audio: HelmsAudio,
    onKill: (zombie: Zombie) => void,
  ) {
    // 1. Turret Logic (Targeting & Firing)
    for (const [, turret] of this.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - dt);

      // Find best target in range
      let bestTarget: Zombie | null = null;
      let closestDist = turret.range;

      for (const z of zombies) {
        if (z.dead) continue;
        const dist = turret.pos.distanceTo(z.pos);
        if (dist <= turret.range) {
          // If oil cauldron, prefer enemies close to the gate
          if (turret.type === "oil") {
            if (z.pos.z >= -16 && dist < closestDist) {
              closestDist = dist;
              bestTarget = z;
            }
          } else {
            // Prefer closest enemy or highest threat
            if (dist < closestDist) {
              closestDist = dist;
              bestTarget = z;
            }
          }
        }
      }

      if (bestTarget) {
        // Aim pivot towards target
        const dx = bestTarget.pos.x - turret.pos.x;
        const dz = bestTarget.pos.z - turret.pos.z;
        const targetAngle = Math.atan2(dx, dz) + Math.PI;
        turret.pivotMesh.rotation.y = THREE.MathUtils.lerp(
          turret.pivotMesh.rotation.y,
          targetAngle,
          0.15,
        );

        // Fire if ready!
        if (turret.cooldown <= 0) {
          turret.cooldown = 1 / turret.rate;
          this.fireTurret(turret, bestTarget, scene, vfx, audio);
        }
      }
    }

    // 2. Update Active Turret Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.isArc) {
        // Mortar arc trajectory
        p.vel.y -= 18 * dt; // High gravity arc
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += dt * 4;
        p.mesh.rotation.y += dt * 3;

        // Ground impact
        if (p.pos.y <= 0.2 || p.pos.z <= -160) {
          // EXPLODE!
          vfx.spawnExplosion(p.pos, p.radius);
          audio.playExplosion();

          // AOE Damage
          for (const z of zombies) {
            if (z.dead) continue;
            const dist = p.pos.distanceTo(z.pos);
            if (dist <= p.radius) {
              const falloff = 1 - dist / p.radius;
              const dmg = Math.round(p.damage * Math.max(0.35, falloff));
              z.hp -= dmg;
              if (z.hp <= 0) {
                z.dead = true;
                onKill(z);
              }
            }
          }

          scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        // Direct Line Projectiles (Bolts, Harpoons)
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos);

        // Check collision against zombies
        for (const z of zombies) {
          if (z.dead) continue;
          const dist = p.pos.distanceTo(new THREE.Vector3(z.pos.x, z.pos.y + 1, z.pos.z));
          if (dist <= z.radius + 0.3) {
            z.hp -= p.damage;
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

        if (p.pos.y <= 0 || p.pos.z <= -160 || p.dead) {
          scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  private fireTurret(
    turret: ActiveTurret,
    target: Zombie,
    scene: THREE.Scene,
    vfx: HelmsVFX,
    audio: HelmsAudio,
  ) {
    const muzzle = turret.pos.clone().add(new THREE.Vector3(0, 1.2, -0.6));

    if (turret.type === "repeater") {
      audio.playShoot(0.8);
      const dir = new THREE.Vector3().subVectors(target.pos.clone().add(new THREE.Vector3(0, 1, 0)), muzzle).normalize();
      const boltMesh = new THREE.Mesh(this.boltGeo, this.boltMat);
      boltMesh.position.copy(muzzle);
      boltMesh.quaternion.copy(turret.pivotMesh.quaternion);
      scene.add(boltMesh);

      this.projectiles.push({
        type: "repeater",
        mesh: boltMesh,
        pos: muzzle,
        vel: dir.multiplyScalar(65),
        targetPos: target.pos.clone(),
        damage: turret.damage,
        pierce: 1,
        radius: 0.5,
        isArc: false,
        dead: false,
      });
    } else if (turret.type === "oil") {
      // Pour boiling pitch directly down onto gate area
      audio.playOilSizzle();
      const pourPos = new THREE.Vector3(turret.pos.x, 0, -4.5);
      vfx.spawnGroundFire(pourPos, 5.5, 6.0, turret.damage);
    } else if (turret.type === "mortar") {
      audio.playExplosion();
      // Calculate arc velocity to land near target
      const travelTime = 1.6;
      const targetLanding = target.pos.clone().add(new THREE.Vector3(0, 0, -2));
      const vx = (targetLanding.x - muzzle.x) / travelTime;
      const vz = (targetLanding.z - muzzle.z) / travelTime;
      // y = vy*t - 0.5*g*t^2 => vy = (y - 0.5*(-18)*t^2) / t
      const vy = (0.2 - muzzle.y + 0.5 * 18 * travelTime * travelTime) / travelTime;

      const rockMesh = new THREE.Mesh(this.rockGeo, this.fireGlowMat);
      rockMesh.position.copy(muzzle);
      scene.add(rockMesh);

      this.projectiles.push({
        type: "mortar",
        mesh: rockMesh,
        pos: muzzle,
        vel: new THREE.Vector3(vx, vy, vz),
        targetPos: targetLanding,
        damage: turret.damage,
        pierce: 999,
        radius: 7.0,
        isArc: true,
        dead: false,
      });
    } else if (turret.type === "ballista") {
      audio.playShoot(1.4);
      const dir = new THREE.Vector3().subVectors(target.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), muzzle).normalize();
      const harpoonMesh = new THREE.Mesh(this.harpoonGeo, this.harpoonMat);
      harpoonMesh.position.copy(muzzle);
      scene.add(harpoonMesh);

      this.projectiles.push({
        type: "ballista",
        mesh: harpoonMesh,
        pos: muzzle,
        vel: dir.multiplyScalar(75),
        targetPos: target.pos.clone(),
        damage: turret.damage,
        pierce: 3 + turret.level,
        radius: 0.8,
        isArc: false,
        dead: false,
      });
    }
  }

  public clear(scene: THREE.Scene) {
    for (const [, t] of this.turrets) {
      this.group.remove(t.mesh);
    }
    this.turrets.clear();

    for (const p of this.projectiles) {
      scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
