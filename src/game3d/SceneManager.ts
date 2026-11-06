import * as THREE from "three";
import type { EnemyId, TowerId } from "@/game/data";
import {
  createEnemyModel,
  createTowerModel,
  PALETTE,
} from "@/game3d/models/ProceduralGeometries";
import { GraveyardWorld } from "@/game3d/world/GraveyardWorld";
import { VFXSystem } from "@/game3d/vfx/VFXSystem";
import { gridToWorld, simToWorld, worldToGrid } from "@/game3d/types";

export type TowerView = {
  id: number;
  type: TowerId;
  group: THREE.Group;
  turret?: THREE.Group;
  animTarget?: THREE.Object3D;
  flameMesh?: THREE.Mesh;
  lastRankDmg: number;
  lastRankRate: number;
};

export type EnemyView = {
  id: number;
  type: EnemyId;
  group: THREE.Group;
  limbs: THREE.Object3D[];
  head?: THREE.Object3D;
  aura?: THREE.Object3D;
  hpBar: THREE.Mesh;
  hpFill: THREE.Mesh;
  walkTimer: number;
};

export class SceneManager {
  public canvas: HTMLCanvasElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public world: GraveyardWorld;
  public vfx: VFXSystem;

  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();

  // Lighting
  private moonlight: THREE.DirectionalLight;
  private lightningLight: THREE.PointLight;
  private lightningTimer = 10 + Math.random() * 15;

  // Watchtower Perch Commander Camera
  private camCenter = new THREE.Vector3(0, 0, -1.0);
  private targetCenter = new THREE.Vector3(0, 0, -1.0);
  private camDistance = 33;
  private targetDist = 33;
  private camAngle = 0; // azimuth
  private targetAngle = 0;
  private camPitch = 0.78; // ~45 deg downward tilt
  private targetPitch = 0.78;

  // Screen shake
  private shakeMag = 0;
  private shakeOffset = new THREE.Vector3();

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151e28);
    this.scene.fog = new THREE.FogExp2(0x151e28, 0.011);

    // Camera (Watchtower Perch with 48 deg FOV)
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.5, 140);
    this.updateCameraPos();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;

    // Atmospheric Multi-Light Rig (Crisp moonlight with bright, soft fill)
    const hemiLight = new THREE.HemisphereLight(0xcfe2f7, 0x3f5446, 1.9);
    this.scene.add(hemiLight);

    this.moonlight = new THREE.DirectionalLight(0xe8f2ff, 3.4);
    this.moonlight.position.set(16, 28, 14);
    this.moonlight.castShadow = true;
    this.moonlight.shadow.mapSize.width = 2048;
    this.moonlight.shadow.mapSize.height = 2048;
    this.moonlight.shadow.camera.near = 1;
    this.moonlight.shadow.camera.far = 60;
    this.moonlight.shadow.camera.left = -20;
    this.moonlight.shadow.camera.right = 20;
    this.moonlight.shadow.camera.top = 22;
    this.moonlight.shadow.camera.bottom = -22;
    this.moonlight.shadow.bias = -0.0004;
    this.scene.add(this.moonlight);

    // Opposite angle fill light so shadows don't drop into blackness
    const fillLight = new THREE.DirectionalLight(0x7695ba, 1.6);
    fillLight.position.set(-16, 18, -12);
    this.scene.add(fillLight);

    // Occasional lightning flash
    this.lightningLight = new THREE.PointLight(0xddeeff, 0, 80);
    this.lightningLight.position.set(0, 25, 0);
    this.scene.add(this.lightningLight);

    // World & VFX
    this.world = new GraveyardWorld();
    this.scene.add(this.world.group);

    this.vfx = new VFXSystem();
    this.scene.add(this.vfx.group);
  }

  public resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public screenToGrid(clientX: number, clientY: number): { c: number; r: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const hits = this.raycaster.intersectObject(this.world.pickPlane);
    if (hits.length === 0) return null;

    const hit = hits[0].point;
    return worldToGrid(hit.x, hit.z);
  }

  public shake(mag: number) {
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  public pan(dx: number, dz: number) {
    const sinA = Math.sin(this.camAngle);
    const cosA = Math.cos(this.camAngle);
    this.targetCenter.x = THREE.MathUtils.clamp(
      this.targetCenter.x + dx * cosA - dz * sinA,
      -14,
      14,
    );
    this.targetCenter.z = THREE.MathUtils.clamp(
      this.targetCenter.z + dx * sinA + dz * cosA,
      -18,
      14,
    );
  }

  public zoom(delta: number) {
    this.targetDist = THREE.MathUtils.clamp(this.targetDist + delta * 0.025, 16, 46);
  }

  public rotate(deltaAngle: number, deltaPitch: number) {
    this.targetAngle += deltaAngle;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + deltaPitch, 0.45, 1.25);
  }

  public resetCamera() {
    this.targetCenter.set(0, 0, -1.0);
    this.targetAngle = 0;
    this.targetPitch = 0.78;
    this.targetDist = 33;
  }

  private updateCameraPos() {
    const x = this.camCenter.x + this.camDistance * Math.sin(this.camPitch) * Math.sin(this.camAngle);
    const y = this.camCenter.y + this.camDistance * Math.cos(this.camPitch);
    const z = this.camCenter.z + this.camDistance * Math.sin(this.camPitch) * Math.cos(this.camAngle);

    this.camera.position.set(
      x + this.shakeOffset.x,
      y + this.shakeOffset.y,
      z + this.shakeOffset.z,
    );
    this.camera.lookAt(this.camCenter);
  }

  /* -----------------------------------------------------------
   * SYNC ENTITIES
   * --------------------------------------------------------- */

  public syncTowers(towersData: Array<{
    id: number;
    type: TowerId;
    c: number;
    r: number;
    dmgRank: number;
    rateRank: number;
    angle: number;
    pulse: number;
  }>) {
    const seen = new Set<number>();

    for (const t of towersData) {
      seen.add(t.id);
      let view = this.towers.get(t.id);

      if (!view) {
        const model = createTowerModel(t.type);
        const pos = gridToWorld(t.c, t.r);
        model.root.position.set(pos.x, 0, pos.z);
        this.scene.add(model.root);

        view = {
          id: t.id,
          type: t.type,
          group: model.root,
          turret: model.turret,
          animTarget: model.animTarget,
          flameMesh: model.flameMesh,
          lastRankDmg: t.dmgRank,
          lastRankRate: t.rateRank,
        };
        this.towers.set(t.id, view);
      }

      // Update rotation toward target
      if (view.turret) {
        // Sim angle is in 2D radians where 0 is east (+x), pi/2 is south (+y)
        // In 3D: worldX is +x, worldZ is +z
        view.turret.rotation.y = -t.angle - Math.PI / 2;
      }

      // Tower specific dynamic animation
      if (view.flameMesh) {
        // Wick flame flicker
        view.flameMesh.rotation.y += 0.08;
        const s = 1.0 + Math.sin(Date.now() * 0.015) * 0.15;
        view.flameMesh.scale.set(s, s * 1.2, s);
      }

      if (view.type === "dirge" && view.animTarget) {
        // Bell swing on pulse
        if (t.pulse > 0.01) {
          view.animTarget.rotation.z = Math.sin(t.pulse * Math.PI * 4) * 0.35;
        } else {
          view.animTarget.rotation.z = 0;
        }
      }
    }

    // Remove deleted towers
    for (const [id, view] of this.towers.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(view.group);
        this.towers.delete(id);
      }
    }
  }

  public syncEnemies(enemiesData: Array<{
    id: number;
    type: EnemyId;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    slow: number;
    flash: number;
    vx: number;
    vy: number;
    gone: boolean;
  }>, dt: number) {
    const seen = new Set<number>();

    for (const e of enemiesData) {
      if (e.gone) continue;
      seen.add(e.id);
      let view = this.enemies.get(e.id);

      if (!view) {
        const model = createEnemyModel(e.type);
        this.scene.add(model.root);

        // 3D Floating Health Bar
        const barGeo = new THREE.PlaneGeometry(1.0, 0.12);
        barGeo.rotateX(-Math.PI / 4); // tilt toward camera
        const barBg = new THREE.Mesh(
          barGeo,
          new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }),
        );
        const fillGeo = new THREE.PlaneGeometry(0.96, 0.08);
        fillGeo.rotateX(-Math.PI / 4);
        const barFill = new THREE.Mesh(
          fillGeo,
          new THREE.MeshBasicMaterial({ color: PALETTE.glowBlood, side: THREE.DoubleSide }),
        );
        barFill.position.z = 0.01;
        barBg.add(barFill);
        barBg.position.y = 1.6;
        model.root.add(barBg);

        view = {
          id: e.id,
          type: e.type,
          group: model.root,
          limbs: model.limbs,
          head: model.head,
          aura: model.aura,
          hpBar: barBg,
          hpFill: barFill,
          walkTimer: Math.random() * 10,
        };
        this.enemies.set(e.id, view);
      }

      // Convert simulation (x, y) to 3D world (x, z)
      const wPos = simToWorld(e.x, e.y);
      view.group.position.set(wPos.x, 0, wPos.z);

      // Facing angle from velocity
      if (Math.hypot(e.vx, e.vy) > 0.01) {
        const targetAng = Math.atan2(e.vx, e.vy);
        view.group.rotation.y = targetAng;
      }

      // Update health bar fill
      const hpRatio = THREE.MathUtils.clamp(e.hp / Math.max(1, e.maxHp), 0, 1);
      view.hpFill.scale.x = hpRatio;
      view.hpFill.position.x = -(1 - hpRatio) * 0.48;

      // Walk cycle animation
      view.walkTimer += dt * (e.slow > 0 ? 3 : 7);
      if (view.limbs.length >= 2) {
        const swing = Math.sin(view.walkTimer) * 0.45;
        view.limbs[0].rotation.x = swing;
        view.limbs[1].rotation.x = -swing;
        if (view.limbs.length >= 4) {
          view.limbs[2].rotation.x = -swing;
          view.limbs[3].rotation.x = swing;
        }
      }

      if (view.type === "warden") {
        // Floating bobbing motion
        view.group.position.y = 0.25 + Math.sin(view.walkTimer * 0.5) * 0.15;
        if (view.aura) view.aura.rotation.y += dt * 2.5;
      }

      // Hit flash effect
      if (e.flash > 0) {
        view.group.position.x += (Math.random() - 0.5) * 0.08;
      }
    }

    // Remove dead enemies & spawn bone scatter
    for (const [id, view] of this.enemies.entries()) {
      if (!seen.has(id)) {
        this.vfx.spawnBoneScatter(view.group.position);
        this.scene.remove(view.group);
        this.enemies.delete(id);
      }
    }
  }

  /* -----------------------------------------------------------
   * RENDER FRAME
   * --------------------------------------------------------- */

  public frame(dt: number) {
    // 1. Smooth Camera Damping
    this.camCenter.lerp(this.targetCenter, Math.min(1, dt * 8));
    this.camDistance = THREE.MathUtils.damp(this.camDistance, this.targetDist, 6, dt);
    this.camAngle = THREE.MathUtils.damp(this.camAngle, this.targetAngle, 6, dt);
    this.camPitch = THREE.MathUtils.damp(this.camPitch, this.targetPitch, 6, dt);

    // Screen Shake decay
    if (this.shakeMag > 0.05) {
      this.shakeOffset.set(
        (Math.random() * 2 - 1) * this.shakeMag,
        (Math.random() * 2 - 1) * this.shakeMag,
        (Math.random() * 2 - 1) * this.shakeMag,
      );
      this.shakeMag *= Math.exp(-dt * 6);
    } else {
      this.shakeMag = 0;
      this.shakeOffset.set(0, 0, 0);
    }
    this.updateCameraPos();

    // 2. Lightning Flashes
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 4.5;
      this.lightningTimer = 12 + Math.random() * 18;
    }
    if (this.lightningLight.intensity > 0.1) {
      this.lightningLight.intensity *= Math.exp(-dt * 12);
    } else {
      this.lightningLight.intensity = 0;
    }

    // 3. VFX
    this.vfx.update(dt);

    // 4. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.renderer.dispose();
    this.vfx.clear();
  }
}
