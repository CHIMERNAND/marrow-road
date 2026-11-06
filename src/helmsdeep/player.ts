import * as THREE from "three";
import type { PlayerWeaponStats } from "./types";
import type { Zombie } from "./horde";

export type ArrowProjectile = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  pierceLeft: number;
  isCrit: boolean;
  dead: boolean;
};

export class HelmsPlayer {
  public camera: THREE.PerspectiveCamera;
  public weaponMesh: THREE.Group;
  public projectiles: ArrowProjectile[] = [];
  public currentX = 0; // Strafe position along the rampart (-28 to +28)
  public pitch = -0.35; // Slightly higher view
  public yaw = 0;
  public isAiming = false; // Right-click zoom

  public stats: PlayerWeaponStats = {
    damage: 48,
    critMul: 2.5,
    fireRate: 2.4, // shots per sec
    arrowSpeed: 95,
    pierce: 1,
    explosiveRadius: 0,
  };

  private cooldown = 0;
  private weaponRecoil = 0;
  private recoilZ = 0;

  // Arrow Geometry & Material
  private arrowGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.4, 6);
  private arrowMat = new THREE.MeshBasicMaterial({ color: 0xffea55 });

  constructor(aspect: number) {
    this.arrowGeo.rotateX(Math.PI / 2);

    // First person camera: Elevated commanding view over the battlement
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.2, 400);
    this.updateCamera();

    // Sleek medieval crossbow parented to camera
    this.weaponMesh = this.buildWeaponMesh();
    this.camera.add(this.weaponMesh);
  }

  private buildWeaponMesh(): THREE.Group {
    const root = new THREE.Group();
    root.name = "player_weapon";

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a361c,
      roughness: 0.6,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.85,
      roughness: 0.3,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.35,
    });
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const arrowShaftMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });

    // Stock / Tiller (compact, neatly placed in lower-right)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.65), woodMat);
    stock.position.set(0.38, -0.34, -0.65);
    root.add(stock);

    // Brass Lock & Housing
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.16), brassMat);
    lock.position.set(0.38, -0.3, -0.62);
    root.add(lock);

    // Steel Bow Prods (Crossbow limbs - HORIZONTAL in X-Z plane!)
    const prodGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.38, 6);

    const prodL = new THREE.Mesh(prodGeo, steelMat);
    prodL.position.set(0.24, -0.31, -0.92);
    prodL.rotation.z = Math.PI / 2; // Horizontal across X
    prodL.rotation.y = 0.35; // Swept back
    root.add(prodL);

    const prodR = new THREE.Mesh(prodGeo, steelMat);
    prodR.position.set(0.52, -0.31, -0.92);
    prodR.rotation.z = -Math.PI / 2; // Horizontal across X
    prodR.rotation.y = -0.35; // Swept back
    root.add(prodR);

    // Bowstring
    const strGeo = new THREE.BoxGeometry(0.36, 0.008, 0.008);
    const bowString = new THREE.Mesh(strGeo, stringMat);
    bowString.position.set(0.38, -0.31, -0.84);
    root.add(bowString);

    // Loaded Glowing Bolt
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.55, 5), arrowShaftMat);
    bolt.rotateX(Math.PI / 2);
    bolt.position.set(0.38, -0.28, -0.86);
    root.add(bolt);

    // Front Sight Bead
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), brassMat);
    bead.position.set(0.38, -0.27, -0.96);
    root.add(bead);

    return root;
  }

  public resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  public updateCamera() {
    // Parapet position: standing at Y = 16.0, Z = -2.6 overlooking gate and gorge
    this.camera.position.set(this.currentX, 18.0, -2.6);

    // Rotation from yaw & pitch
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);

    // Smooth FOV transition for Iron-Sights Sniper Zoom
    const targetFov = this.isAiming ? 32 : 65;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.22);
      this.camera.updateProjectionMatrix();
    }

    // In-hand weapon position offset
    if (this.weaponMesh) {
      this.weaponMesh.position.z = -this.recoilZ;
      if (this.isAiming) {
        // Bring sights up to dead-center
        this.weaponMesh.position.x = THREE.MathUtils.lerp(this.weaponMesh.position.x, -0.36, 0.25);
        this.weaponMesh.position.y = THREE.MathUtils.lerp(this.weaponMesh.position.y, 0.04, 0.25);
      } else {
        this.weaponMesh.position.x = THREE.MathUtils.lerp(this.weaponMesh.position.x, 0, 0.25);
        this.weaponMesh.position.y = THREE.MathUtils.lerp(this.weaponMesh.position.y, 0, 0.25);
      }
    }
  }

  public look(dx: number, dy: number) {
    const sensitivity = this.isAiming ? 0.0016 : 0.003;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;

    // Clamp yaw to reasonable panorama (-85° to +85°)
    this.yaw = THREE.MathUtils.clamp(this.yaw, -1.48, 1.48);
    // Clamp pitch (-65° looking down at gate to +35° looking at mountains)
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.15, 0.6);
  }

  public strafe(dx: number) {
    this.currentX = THREE.MathUtils.clamp(this.currentX + dx, -28, 28);
  }

  public canShoot(): boolean {
    return this.cooldown <= 0;
  }

  public shoot(scene: THREE.Scene): ArrowProjectile | null {
    if (!this.canShoot()) return null;

    this.cooldown = 1 / this.stats.fireRate;
    this.recoilZ = 0.25;

    // Forward direction from camera
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    // Muzzle position
    const muzzle = this.camera.position.clone().add(dir.clone().multiplyScalar(1.4));
    muzzle.y -= 0.2;

    const arrowMesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    arrowMesh.position.copy(muzzle);
    arrowMesh.quaternion.copy(this.camera.quaternion);
    scene.add(arrowMesh);

    const projectile: ArrowProjectile = {
      mesh: arrowMesh,
      pos: muzzle,
      vel: dir.multiplyScalar(this.stats.arrowSpeed),
      damage: this.stats.damage,
      pierceLeft: this.stats.pierce,
      isCrit: false,
      dead: false,
    };

    this.projectiles.push(projectile);
    return projectile;
  }

  public update(
    dt: number,
    scene: THREE.Scene,
    zombies: Zombie[],
    onHit: (zombie: Zombie, dmg: number, isHeadshot: boolean, hitPos: THREE.Vector3) => void,
  ) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoilZ = Math.max(0, this.recoilZ - dt * 1.8);
    this.updateCamera();

    // Update active arrows
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Gravity drop
      p.vel.y -= 4.2 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.lookAt(p.pos.clone().add(p.vel));

      // Check collision with zombies
      for (const z of zombies) {
        if (z.dead) continue;

        // Headshot check
        const headWorldPos = new THREE.Vector3();
        z.headMesh.getWorldPosition(headWorldPos);
        const distToHead = p.pos.distanceTo(headWorldPos);

        if (distToHead <= z.headRadius * 1.15) {
          p.isCrit = true;
          onHit(z, p.damage * this.stats.critMul, true, p.pos.clone());
          p.pierceLeft -= 1;
          if (p.pierceLeft <= 0) {
            p.dead = true;
            break;
          }
          continue;
        }

        // Body hit check
        const bodyDist = p.pos.distanceTo(new THREE.Vector3(z.pos.x, z.pos.y + 1.2, z.pos.z));
        if (bodyDist <= z.radius * 1.1) {
          onHit(z, p.damage, false, p.pos.clone());
          p.pierceLeft -= 1;
          if (p.pierceLeft <= 0) {
            p.dead = true;
            break;
          }
        }
      }

      // Ground or Distance expiration
      if (p.pos.y <= 0 || p.pos.z <= -180 || p.pos.z >= 20 || p.dead) {
        scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  public clear(scene: THREE.Scene) {
    for (const p of this.projectiles) {
      scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
