import * as BABYLON from "@babylonjs/core";
import { BabylonHelmsWorld, type PowderBarrel } from "./world";
import { BabylonZombieHorde, type BabylonZombie } from "./horde";
import { BabylonHelmsPlayer } from "./player";
import { BabylonTurretManager } from "./turrets";
import { BabylonHelmsVFX } from "./vfx";
import { HelmsAudio } from "@/helmsdeep/audio";
import {
  type TurretType,
  TURRET_SPECS,
  type BoltAmmoType,
  type ZombieType,
  type CombatCallout,
  type FloatingDamage,
} from "@/helmsdeep/types";
import type { AbilityId, AbilityState, HelmsGameState } from "@/helmsdeep/engine";

interface ActiveFloatingDamage extends FloatingDamage {
  worldPos: BABYLON.Vector3;
  age: number;
  maxAge: number;
}

interface EnemySiegeBolt {
  mesh: BABYLON.Mesh;
  pos: BABYLON.Vector3;
  targetPos: BABYLON.Vector3;
  vel: BABYLON.Vector3;
  age: number;
  maxLife: number;
  whizPlayed: boolean;
}

export class BabylonHelmsEngine {
  public engine: BABYLON.Engine;
  public scene: BABYLON.Scene;
  public world: BabylonHelmsWorld;
  public horde: BabylonZombieHorde;
  public player: BabylonHelmsPlayer;
  public turrets: BabylonTurretManager;
  public vfx: BabylonHelmsVFX;
  public audio: HelmsAudio;

  public state: HelmsGameState;
  private onStateChange?: (state: HelmsGameState) => void;

  private isRunning = false;
  private lastTime = 0;

  private wave = 1;
  private totalWaves = 10;
  private waveQueue: Array<{
    type: ZombieType;
    delay: number;
  }> = [];
  private waveTimer = 0;
  private intermissionTimer = 0;
  private hornStunTimer = 0;
  private bulletTimeTimer = 0;

  private combo = 0;
  private comboTimer = 0;
  private callouts: CombatCallout[] = [];
  private nextCalloutId = 1;
  private floatingDamages: ActiveFloatingDamage[] = [];
  private nextDamageId = 1;

  private abilities: AbilityState[] = [
    {
      id: "oil_dump",
      name: "Boiling Pitch Dump",
      hotkey: "1",
      cooldown: 0,
      maxCooldown: 15,
      ready: true,
    },
    {
      id: "catapult_barrage",
      name: "Catapult Volley",
      hotkey: "2",
      cooldown: 0,
      maxCooldown: 20,
      ready: true,
    },
    {
      id: "horn_of_helm",
      name: "Horn of Helm",
      hotkey: "3",
      cooldown: 0,
      maxCooldown: 28,
      ready: true,
    },
    {
      id: "archer_volley",
      name: "Elven Fire Volley",
      hotkey: "4",
      cooldown: 0,
      maxCooldown: 14,
      ready: true,
    },
  ];

  private hitmarkerTimer = 0;
  private currentHitmarker: "body" | "headshot" | "shield" | null = null;

  private enemySiegeBolts: EnemySiegeBolt[] = [];
  private enemyFireTimer = 4.5;
  private screenTraumaTimer = 0;
  private bloodSplatterTimer = 0;
  private warDrumTimer = 0;
  private emberSpawnTimer = 0;
  private heartbeatTimer = 0;
  private enemyBoltMat: BABYLON.StandardMaterial;

  private keysDown: Set<string> = new Set();
  private isMouseDown = false;
  private selectedSocketId: number | null = null;

  constructor(canvas: HTMLCanvasElement, onStateChange?: (state: HelmsGameState) => void) {
    this.onStateChange = onStateChange;

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.useRightHandedSystem = true;

    this.audio = new HelmsAudio();
    this.world = new BabylonHelmsWorld(this.scene);
    this.horde = new BabylonZombieHorde(this.scene, this.world.shadowGenerator);
    this.player = new BabylonHelmsPlayer(this.scene);
    this.world.setupPostPipeline(this.player.camera);
    this.turrets = new BabylonTurretManager(this.scene);
    this.vfx = new BabylonHelmsVFX(this.scene);

    this.enemyBoltMat = new BABYLON.StandardMaterial("enemySiegeBoltMat", this.scene);
    this.enemyBoltMat.emissiveColor = new BABYLON.Color3(1.0, 0.32, 0.06);
    this.enemyBoltMat.disableLighting = true;

    this.state = {
      status: "wave",
      wave: 1,
      totalWaves: this.totalWaves,
      waveCountdown: 0,
      zombiesAlive: 0,
      zombiesRemainingInWave: 0,
      gateHp: this.world.gateHealth,
      maxGateHp: this.world.maxGateHealth,
      gold: 280,
      kills: 0,
      headshots: 0,
      isAiming: false,
      hitmarker: null,
      currentAmmo: this.player.currentAmmo,
      weaponLevel: this.player.stats.weaponLevel,
      weaponUpgradeCost: this.getWeaponUpgradeCost(),
      combo: 0,
      comboTimer: 0,
      powderBarrelsRemaining: this.world.powderBarrels.filter((b) => !b.detonated).length,
      zoomLevel: this.player.zoomLevel,
      bulletTimeActive: false,
      nightSightActive: false,
      screenTraumaTimer: 0,
      bloodSplatterTimer: 0,
      reticleTarget: null,
      floatingDamages: [],
      callouts: [],
      abilities: this.abilities,
      selectedSocketId: null,
      turretSockets: this.getSocketsState(),
    };

    const leftBastion = this.world.turretSockets[1];
    if (leftBastion) {
      this.turrets.buildTurret(leftBastion.id, leftBastion.pos, "repeater");
      leftBastion.type = "repeater";
    }
    const rightBastion = this.world.turretSockets[2];
    if (rightBastion) {
      this.turrets.buildTurret(rightBastion.id, rightBastion.pos, "mortar");
      rightBastion.type = "mortar";
    }

    this.setupWave(1, true);
    this.emitState();
  }

  public addCallout(
    text: string,
    subtext?: string,
    color: CombatCallout["color"] = "gold",
  ) {
    const id = this.nextCalloutId++;
    this.callouts = [{ id, text, subtext, color }, ...this.callouts].slice(0, 4);
    setTimeout(() => {
      this.callouts = this.callouts.filter((c) => c.id !== id);
    }, 2400);
  }

  private spawnFloatingDamage(
    worldPos: BABYLON.Vector3,
    text: string,
    isCrit: boolean,
    color = "#fde047",
  ) {
    const projected = this.projectToPercent(worldPos);
    if (!projected) return;
    this.floatingDamages.push({
      id: this.nextDamageId++,
      worldPos: worldPos.clone(),
      x: projected.x,
      y: projected.y,
      text,
      isCrit,
      color,
      age: 0,
      maxAge: 0.85,
    });
    if (this.floatingDamages.length > 14) {
      this.floatingDamages.shift();
    }
  }

  private projectToPercent(worldPos: BABYLON.Vector3): { x: number; y: number } | null {
    const w = this.engine.getRenderWidth();
    const h = this.engine.getRenderHeight();
    if (w <= 0 || h <= 0) return null;

    const screen = BABYLON.Vector3.Project(
      worldPos,
      BABYLON.Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      this.player.camera.viewport.toGlobal(w, h),
    );
    if (screen.z < 0 || screen.z > 1) return null;
    return {
      x: (screen.x / w) * 100,
      y: (screen.y / h) * 100,
    };
  }

  private triggerBulletTime(duration = 0.36) {
    this.bulletTimeTimer = Math.max(this.bulletTimeTimer, duration);
  }

  public getWeaponUpgradeCost(): number {
    return Math.round(120 * Math.pow(1.45, (this.player.stats.weaponLevel ?? 1) - 1));
  }

  public upgradeCrossbow(): boolean {
    const curLevel = this.player.stats.weaponLevel ?? 1;
    if (curLevel >= 5) return false;
    const cost = this.getWeaponUpgradeCost();
    if (this.state.gold < cost) return false;

    this.state.gold -= cost;
    this.player.stats.weaponLevel = curLevel + 1;
    this.player.stats.damage = Math.round(this.player.stats.damage * 1.25);
    this.player.stats.fireRate = Number((this.player.stats.fireRate * 1.15).toFixed(2));
    if (this.player.stats.weaponLevel % 2 === 0) {
      this.player.stats.pierce = (this.player.stats.pierce ?? 1) + 1;
    }

    this.audio.playChime();
    this.addCallout(
      `ARBALEST TIER ${this.player.stats.weaponLevel}!`,
      `Dmg ${this.player.stats.damage} • Pierce ${this.player.stats.pierce}`,
      "gold",
    );
    this.syncState();
    return true;
  }

  public setAmmo(ammo: BoltAmmoType) {
    this.player.setAmmo(ammo);
    if (ammo === "fire") this.audio.playIgnite();
    else if (ammo === "frost") this.audio.playFrostHum();
    else if (ammo === "bodkin") this.audio.playWindlassRatchet();
    else this.audio.playAmmoSwitch();
    this.syncState();
  }

  public cycleAmmo() {
    const ammo = this.player.cycleAmmo();
    if (ammo === "fire") this.audio.playIgnite();
    else if (ammo === "frost") this.audio.playFrostHum();
    else if (ammo === "bodkin") this.audio.playWindlassRatchet();
    else this.audio.playAmmoSwitch();
    this.syncState();
  }

  private getSocketsState() {
    return this.world.turretSockets.map((s) => {
      const turret = this.turrets.turrets.get(s.id);
      return {
        id: s.id,
        name: s.name,
        pos: [s.pos.x, s.pos.y, s.pos.z] as [number, number, number],
        turretType: (turret?.type as TurretType) ?? null,
        level: turret?.level ?? 0,
      };
    });
  }

  public setupWave(waveNum: number, startImmediately = false) {
    this.wave = waveNum;
    this.waveQueue = [];
    this.waveTimer = 0;
    this.intermissionTimer = startImmediately ? 0 : 8;
    this.state.status = startImmediately ? "wave" : "preparing";
    this.state.wave = waveNum;
    this.state.waveCountdown = this.intermissionTimer;

    this.world.spawnPowderBarrels();

    const runnerCount = 4 + waveNum * 3;
    const shamblerCount = 6 + waveNum * 5;
    const sapperCount = 1 + Math.floor(waveNum * 1.2);
    const bruteCount = Math.max(1, Math.floor((waveNum - 1) * 2));
    const bansheeCount = Math.max(1, Math.floor((waveNum - 1) * 1.5));
    const warlordCount = waveNum >= 2 ? 1 : 0;
    const ramCount = waveNum >= 1 ? 1 : 0;

    const totalZombies =
      runnerCount +
      shamblerCount +
      sapperCount +
      bruteCount +
      bansheeCount +
      warlordCount +
      ramCount;
    this.state.zombiesRemainingInWave = totalZombies;

    if (startImmediately) {
      const vanguard: Array<{ type: ZombieType; x: number; z: number }> = [
        { type: "runner", x: -4.8, z: -39 },
        { type: "shambler", x: 4.5, z: -47 },
        { type: "sapper", x: -1.6, z: -57 },
        { type: "brute", x: 2.2, z: -68 },
        { type: "shambler", x: -5.6, z: -79 },
        { type: "banshee", x: 5.2, z: -90 },
        { type: "warlord", x: 0.0, z: -104 },
        { type: "ram", x: 0.0, z: -120 },
      ];
      for (const v of vanguard) {
        const z = this.horde.spawn(v.type, v.z, 0.5, this.world.gateZ);
        z.pos.x = v.x;
        z.root.position.x = v.x;
      }
    }

    const waveDuration = Math.min(42, 16 + waveNum * 3.0);
    const step = waveDuration / Math.max(1, totalZombies - (startImmediately ? 5 : 0));

    let time = startImmediately ? 2.5 : 0;
    for (let i = startImmediately ? 1 : 0; i < runnerCount; i++) {
      this.waveQueue.push({ type: "runner", delay: time + Math.random() * 1.8 });
      time += step * 0.75;
    }
    for (let i = startImmediately ? 2 : 0; i < shamblerCount; i++) {
      this.waveQueue.push({ type: "shambler", delay: time + Math.random() * 2.2 });
      time += step;
    }
    for (let i = startImmediately ? 1 : 0; i < sapperCount; i++) {
      this.waveQueue.push({ type: "sapper", delay: time + Math.random() * 2.5 });
      time += step * 1.1;
    }
    for (let i = 0; i < bruteCount; i++) {
      this.waveQueue.push({ type: "brute", delay: time + Math.random() * 3 });
      time += step * 1.4;
    }
    for (let i = 0; i < bansheeCount; i++) {
      this.waveQueue.push({ type: "banshee", delay: time + Math.random() * 2 });
      time += step * 1.2;
    }
    if (warlordCount > 0) {
      this.waveQueue.push({ type: "warlord", delay: waveDuration * 0.65 });
    }
    if (ramCount > 0 && !startImmediately) {
      this.waveQueue.push({ type: "ram", delay: waveDuration * 0.45 });
    }

    this.waveQueue.sort((a, b) => a.delay - b.delay);
  }

  public startWaveNow() {
    this.intermissionTimer = 0;
    this.state.status = "wave";
    this.audio.playWarHorn();
    this.emitState();
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;
      const now = performance.now();
      const rawDt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      let timeScale = 1.0;
      if (this.bulletTimeTimer > 0) {
        this.bulletTimeTimer = Math.max(0, this.bulletTimeTimer - rawDt);
        timeScale = 0.34;
      }

      if (this.world.pipeline) {
        const targetAberration =
          this.bulletTimeTimer > 0 ? 18 : this.player.isAiming ? 6.5 : 3.2;
        this.world.pipeline.chromaticAberration.aberrationAmount +=
          (targetAberration - this.world.pipeline.chromaticAberration.aberrationAmount) * 0.2;
      }

      this.update(rawDt * timeScale, rawDt);
      this.scene.render();
    });
  }

  public stop() {
    this.isRunning = false;
    this.engine.stopRenderLoop();
  }

  private detonateSapperExplosion(pos: BABYLON.Vector3) {
    this.audio.playExplosion();
    this.player.addCameraShake(0.55);
    this.triggerBulletTime(0.32);
    this.vfx.spawnExplosion(pos, 9.0);
    this.vfx.spawnGroundFire(new BABYLON.Vector3(pos.x, 0, pos.z), 5.2, 6.0, 60);

    let chainKills = 0;
    for (const other of this.horde.zombies) {
      if (other.dead) continue;
      const d = BABYLON.Vector3.Distance(pos, other.pos);
      if (d <= 9.5) {
        const dmg = Math.round(240 * Math.max(0.45, 1 - d / 11));
        other.hp -= dmg;
        other.burnTimer = 4.5;
        other.burnDps = 22;
        other.staggerTimer = 0.35;
        this.spawnFloatingDamage(
          other.pos.add(new BABYLON.Vector3(0, 3.2, 0)),
          `${dmg}`,
          true,
          "#fb923c",
        );
        if (other.hp <= 0) {
          other.dead = true;
          const blastDir = other.pos.subtract(pos).normalize();
          other.ragdollVel = new BABYLON.Vector3(
            blastDir.x * 9 + (Math.random() - 0.5) * 4,
            Math.random() * 8 + 7,
            blastDir.z * 11 - 6,
          );
          other.ragdollSpin = new BABYLON.Vector3(Math.random() * 12, Math.random() * 8, Math.random() * 8);
          chainKills++;
          this.handleZombieKill(other, false);
        }
      }
    }

    this.addCallout(
      "SAPPER BOMB DETONATED!",
      chainKills > 0 ? `${chainKills} Nearby Undead Vaporized!` : "Horde Blasted!",
      "orange",
    );
  }

  private detonatePowderBarrel(barrel: PowderBarrel) {
    if (barrel.detonated) return;
    barrel.detonated = true;
    barrel.root.setEnabled(false);

    this.audio.playExplosion();
    this.player.addCameraShake(0.68);
    this.triggerBulletTime(0.36);
    this.vfx.spawnExplosion(barrel.pos, 10.5);
    this.vfx.spawnGroundFire(new BABYLON.Vector3(barrel.pos.x, 0, barrel.pos.z), 6.2, 7.0, 65);

    let killsFromBarrel = 0;
    for (const z of this.horde.zombies) {
      if (z.dead) continue;
      const d = BABYLON.Vector3.Distance(barrel.pos, z.pos);
      if (d <= 11.5) {
        const falloff = 1 - d / 13.0;
        const dmg = Math.round(280 * Math.max(0.45, falloff));
        z.hp -= dmg;
        z.burnTimer = 5.0;
        z.burnDps = 25;
        z.staggerTimer = 0.35;
        z.pos.z -= 2.2;
        this.spawnFloatingDamage(
          z.pos.add(new BABYLON.Vector3(0, 3.4, 0)),
          `${dmg} BOOM!`,
          true,
          "#fb923c",
        );

        if (z.hp <= 0) {
          z.dead = true;
          const blastDir = z.pos.subtract(barrel.pos).normalize();
          z.ragdollVel = new BABYLON.Vector3(
            blastDir.x * 10 + (Math.random() - 0.5) * 4,
            Math.random() * 9 + 8,
            blastDir.z * 12 - 7,
          );
          z.ragdollSpin = new BABYLON.Vector3(Math.random() * 12, Math.random() * 8, Math.random() * 8);
          killsFromBarrel++;
          this.handleZombieKill(z, false);
        }
      }
    }

    this.addCallout(
      "POWDER CASK DETONATION!",
      killsFromBarrel > 0 ? `${killsFromBarrel} Undead Obliterated` : "Massive Fireball!",
      "orange",
    );

    for (const other of this.world.powderBarrels) {
      if (!other.detonated && BABYLON.Vector3.Distance(barrel.pos, other.pos) <= 13.5) {
        setTimeout(() => {
          this.detonatePowderBarrel(other);
        }, 220);
      }
    }
  }

  private updateGarrisonArchers(dt: number) {
    if (this.horde.zombies.length === 0) return;

    for (const archer of this.world.garrisonArchers) {
      archer.cooldown -= dt;
      if (archer.cooldown <= 0) {
        archer.cooldown = 3.2 + Math.random() * 1.6;
        const alive = this.horde.zombies.filter((z) => !z.dead && z.pos.z > -110);
        if (alive.length > 0) {
          const target = alive[Math.floor(Math.random() * alive.length)];
          this.turrets.spawnDirectBolt(archer.pos, target, 22, true);
        }
      }
    }
  }

  private update(dt: number, realDt: number) {
    // Player camera & controls stay crisp even during bullet-time!
    if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) {
      this.player.strafe(-15 * realDt);
    }
    if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) {
      this.player.strafe(15 * realDt);
    }
    if (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp")) {
      this.player.elevate(8 * realDt);
    }
    if (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown")) {
      this.player.elevate(-8 * realDt);
    }

    if (this.isMouseDown && this.player.canShoot()) {
      const proj = this.player.shoot();
      if (proj) {
        this.audio.playShoot(this.player.isAiming ? 1.3 : 1.0);
        setTimeout(() => {
          this.audio.playWindlassRatchet();
        }, 160);
      }
    }

    for (const ab of this.abilities) {
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - realDt);
        ab.ready = ab.cooldown <= 0;
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - realDt);
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    if (this.hornStunTimer > 0) {
      this.hornStunTimer -= dt;
    }

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= realDt;
      if (this.hitmarkerTimer <= 0) {
        this.currentHitmarker = null;
      }
    }

    // Update Floating 3D Damage Numbers
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i];
      fd.age += realDt;
      fd.worldPos.y += realDt * 2.4;
      const p = this.projectToPercent(fd.worldPos);
      if (p) {
        fd.x = p.x;
        fd.y = p.y;
      }
      if (fd.age >= fd.maxAge) {
        this.floatingDamages.splice(i, 1);
      }
    }

    this.world.update(dt);
    if (this.world.justStruckLightning) {
      this.audio.playThunder();
    }

    // Update incoming enemy siege bolts
    for (let i = this.enemySiegeBolts.length - 1; i >= 0; i--) {
      const b = this.enemySiegeBolts[i];
      b.age += realDt;
      b.vel.y -= 8.5 * realDt;
      b.pos.addInPlace(b.vel.scale(realDt));
      b.mesh.position.copyFrom(b.pos);

      // Play whiz sound as it cuts close to defender
      const distToPlayer = BABYLON.Vector3.Distance(b.pos, this.player.camera.position);
      if (!b.whizPlayed && distToPlayer <= 16.0) {
        b.whizPlayed = true;
        this.audio.playIncomingSiegeWhiz();
      }

      // Parapet impact
      if (b.pos.z >= -7.2 || b.age >= b.maxLife) {
        this.vfx.spawnStoneImpact(b.pos);
        this.audio.playParapetImpact();
        if (distToPlayer <= 8.5) {
          this.player.addCameraShake(0.48);
          this.screenTraumaTimer = 0.4;
          this.addCallout("RAMPARTS UNDER FIRE!", "Enemy Siege Bolt Struck Parapet", "red");
        }
        b.mesh.dispose();
        this.enemySiegeBolts.splice(i, 1);
      }
    }

    // Spawn enemy counter-siege shots during wave
    if (this.state.status === "wave" && this.horde.zombies.length > 0) {
      this.enemyFireTimer -= realDt;
      if (this.enemyFireTimer <= 0) {
        this.enemyFireTimer = 5.5 + Math.random() * 5.0;
        const candidate = this.horde.zombies.find(
          (z) => !z.dead && (z.type === "banshee" || z.type === "brute" || z.type === "warlord" || z.pos.z < -45),
        );
        if (candidate) {
          const boltMesh = BABYLON.MeshBuilder.CreateCylinder(
            "enemySiegeBolt",
            { diameterTop: 0.04, diameterBottom: 0.12, height: 1.6, tessellation: 6 },
            this.scene,
          );
          boltMesh.material = this.enemyBoltMat;
          const origin = candidate.pos.clone();
          origin.y += 2.2;
          const target = new BABYLON.Vector3(
            this.player.currentX + (Math.random() - 0.5) * 6.0,
            this.player.currentY - 0.6,
            -7.0,
          );
          const flightTime = 1.7;
          const vx = (target.x - origin.x) / flightTime;
          const vz = (target.z - origin.z) / flightTime;
          const vy = (target.y - origin.y) / flightTime + 0.5 * 8.5 * flightTime;
          boltMesh.position.copyFrom(origin);
          boltMesh.rotation.x = Math.PI / 2;

          this.enemySiegeBolts.push({
            mesh: boltMesh,
            pos: origin,
            targetPos: target,
            vel: new BABYLON.Vector3(vx, vy, vz),
            age: 0,
            maxLife: flightTime + 0.3,
            whizPlayed: false,
          });
        }
      }
    }

    // Ambient floating embers rising from torches & battlements
    this.emberSpawnTimer += realDt;
    if (this.emberSpawnTimer >= 0.18) {
      this.emberSpawnTimer = 0;
      this.vfx.spawnEmber(
        new BABYLON.Vector3(
          (Math.random() - 0.5) * 32,
          25 + Math.random() * 3.0,
          -6.0 - Math.random() * 5.0,
        ),
      );
    }

    if (this.screenTraumaTimer > 0) {
      this.screenTraumaTimer = Math.max(0, this.screenTraumaTimer - realDt);
    }
    if (this.bloodSplatterTimer > 0) {
      this.bloodSplatterTimer = Math.max(0, this.bloodSplatterTimer - realDt);
    }

    if (this.state.status === "preparing") {
      this.intermissionTimer -= realDt;
      this.state.waveCountdown = Math.max(0, Math.ceil(this.intermissionTimer));
      if (this.intermissionTimer <= 0) {
        this.state.status = "wave";
      }
    } else if (this.state.status === "wave") {
      this.waveTimer += dt;
      if (this.horde.zombies.length > 0) {
        this.warDrumTimer += realDt;
        if (this.warDrumTimer >= 2.2) {
          this.warDrumTimer = 0;
          this.audio.playWarDrum();
        }
      }
      while (this.waveQueue.length > 0 && this.waveQueue[0].delay <= this.waveTimer) {
        const item = this.waveQueue.shift()!;
        if (item.type === "warlord") {
          this.audio.playWarHorn();
          this.addCallout("SIEGE WARLORD APPROACHING!", "Slay the Champion of Udûn!", "red");
        } else if (item.type === "ram") {
          this.audio.playWarHorn();
          this.addCallout("IRON BATTERING RAM ADVANCING!", "Destroy the Siege Engine Before Gate Breach!", "red");
        }
        let targetOverride: BABYLON.Vector3 | undefined = undefined;
        if (item.type === "sapper" && this.wave >= 2 && Math.random() < 0.45 && !this.world.culvertBreached) {
          targetOverride = this.world.culvertPos.clone();
          this.audio.playCulvertAlarm();
          this.addCallout(
            "TORCHBEARER SPRINTING FOR THE CULVERT!",
            "Snip him before the Deeping Wall is breached!",
            "orange",
          );
        }
        this.horde.spawn(item.type, -115 - Math.random() * 25, 7.5, this.world.gateZ, targetOverride);
      }

      if (this.waveQueue.length === 0 && this.horde.zombies.length === 0) {
        if (this.wave >= this.totalWaves) {
          this.state.status = "victory";
          this.audio.playChime();
        } else {
          this.setupWave(this.wave + 1, false);
        }
      }
    }

    // Steady Aim Breath Control: Pulse heartbeat audio
    if (this.player.holdingBreath) {
      this.heartbeatTimer += realDt;
      if (this.heartbeatTimer >= 0.82) {
        this.heartbeatTimer = 0;
        this.audio.playHeartbeat(this.player.breathStamina / 100);
      }
    } else {
      this.heartbeatTimer = 0;
    }

    if (this.hornStunTimer <= 0) {
      this.horde.update(
        dt,
        (dmg) => {
          this.world.damageGate(dmg);
          if (dmg >= 80) {
            this.player.addCameraShake(0.68);
            this.audio.playSiegeRamImpact();
            this.addCallout("GATE SHATTER THREAT!", `-${dmg} Gate Integrity`, "red");
          } else {
            this.player.addCameraShake(0.28);
            this.audio.playGateHit();
          }
          this.vfx.spawnHitSparks(new BABYLON.Vector3(0, 3.5, this.world.gateZ - 0.5), 8);

          if (this.world.gateHealth <= 0) {
            this.state.status = "defeat";
            this.audio.playExplosion();
          }
        },
        (burnedZombie) => {
          this.handleZombieKill(burnedZombie, false);
        },
        (necroPos) => {
          this.vfx.spawnShockwave(
            new BABYLON.Vector3(necroPos.x, 0.3, necroPos.z),
            6.5,
            new BABYLON.Color3(0.2, 0.95, 0.85),
          );
        },
        (culvertDmg) => {
          this.vfx.spawnCulvertBreachDebris(this.world.culvertPos);
          this.audio.playCulvertBreachExplosion();
          this.player.addCameraShake(0.85);
          this.screenTraumaTimer = 2.0;
          const breached = this.world.damageCulvert(culvertDmg);
          if (breached) {
            this.world.damageGate(260);
            this.addCallout(
              "CULVERT DRAIN BREACHED!",
              "Explosive Breach at Deeping Wall! -260 Gate Integrity",
              "red",
            );
          } else {
            this.addCallout(
              "CULVERT DRAIN DAMAGED!",
              `-${culvertDmg} Drain HP (${this.world.culvertHealth} Left)`,
              "orange",
            );
          }
        },
      );
    }

    for (const gf of this.vfx.groundFires) {
      for (const z of this.horde.zombies) {
        if (z.dead) continue;
        if (BABYLON.Vector3.Distance(gf.pos, z.pos) <= gf.radius) {
          z.hp -= gf.dps * dt;
          z.burnTimer = 2.5;
          z.burnDps = 20;
          if (z.hp <= 0) {
            z.dead = true;
            this.handleZombieKill(z, false);
          }
        }
      }
    }

    this.player.update(
      dt,
      this.horde.zombies,
      this.world.powderBarrels,
      (z, dmg, isHeadshot, hitPos, ammoType, pierceCount) => {
        let finalDmg = dmg;
        z.staggerTimer = 0.22;

        if (!isHeadshot && z.hasShield && z.shieldHp > 0 && ammoType !== "fire") {
          z.shieldHp -= dmg * 0.75;
          finalDmg = Math.round(dmg * 0.45);
          this.audio.playShieldClang();
          this.vfx.spawnHitSparks(hitPos, 10);
          this.currentHitmarker = "shield";
          this.hitmarkerTimer = 0.25;
          this.spawnFloatingDamage(hitPos, `${finalDmg} BLOCKED`, false, "#7dd3fc");

          if (z.shieldHp <= 0) {
            z.hasShield = false;
            z.shieldMesh?.dispose();
            this.audio.playShieldBreak();
            this.vfx.spawnShieldShatter(hitPos);
            this.addCallout("SHIELD SHATTERED!", "+20 Bonus Gold", "gold");
            this.state.gold += 20;
          }
        } else if (isHeadshot) {
          if (z.frostTimer > 0) {
            finalDmg = Math.round(finalDmg * 1.45);
            this.audio.playFrostShatter();
            this.vfx.spawnFrostBurst(hitPos);
            this.addCallout("FROST SHATTER CRIT!", `${finalDmg} Damage`, "cyan");
          } else {
            this.audio.playHeadshot();
          }
          this.vfx.spawnHeadshotGore(hitPos);
          this.currentHitmarker = "headshot";
          this.hitmarkerTimer = 0.35;
          this.player.addCameraShake(0.14);
          this.spawnFloatingDamage(hitPos, `${finalDmg} CRIT!`, true, "#f87171");

          const shotDist = Math.round(Math.abs(z.pos.z - this.player.camera.position.z));
          if (shotDist >= 65) {
            this.triggerBulletTime(0.32);
            this.addCallout(`EAGLE-EYE LONGSHOT! (${shotDist}m)`, "+25 Marksman Gold", "gold");
            this.state.gold += 25;
          }
        } else {
          this.audio.playHit();
          this.vfx.spawnHitSparks(hitPos, 6);
          this.currentHitmarker = "body";
          this.hitmarkerTimer = 0.2;
          this.spawnFloatingDamage(hitPos, `${finalDmg}`, false, "#fde047");
        }

        if (ammoType === "fire") {
          z.burnTimer = 5.0;
          z.burnDps = 26;
          this.vfx.spawnExplosion(hitPos, 3.8);
          for (const nearZ of this.horde.zombies) {
            if (!nearZ.dead && nearZ.id !== z.id && BABYLON.Vector3.Distance(hitPos, nearZ.pos) <= 4.2) {
              nearZ.hp -= Math.round(dmg * 0.45);
              nearZ.burnTimer = 4.0;
              nearZ.burnDps = 20;
              if (nearZ.hp <= 0) {
                nearZ.dead = true;
                this.handleZombieKill(nearZ, false);
              }
            }
          }
        } else if (ammoType === "frost") {
          z.frostTimer = 4.8;
          this.vfx.spawnFrostBurst(hitPos);
          for (const nearZ of this.horde.zombies) {
            if (!nearZ.dead && BABYLON.Vector3.Distance(hitPos, nearZ.pos) <= 3.8) {
              nearZ.frostTimer = 4.0;
            }
          }
        }

        if (pierceCount >= 2) {
          this.addCallout("SKEWER PIERCE!", `${pierceCount} Enemies Pierced`, "purple");
        }

        z.hp -= finalDmg;
        if (z.hp <= 0 && !z.dead) {
          z.dead = true;
          if (isHeadshot) {
            z.ragdollVel = new BABYLON.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 3.0, -8.5);
            z.ragdollSpin = new BABYLON.Vector3(-8, (Math.random() - 0.5) * 6, 0);

            // Flying horned iron helmet & arterial blood fountain
            const headPos = z.headMesh.absolutePosition.clone();
            const shotDir = z.pos.subtract(this.player.camera.position);
            this.vfx.spawnFlyingHelmet(headPos, shotDir);
            this.vfx.spawnBloodFountain(headPos);
            this.audio.playArmorShatter();
            z.headMesh.setEnabled(false);

            if (ammoType === "frost") {
              this.vfx.spawnFrostShatter(headPos);
            }

            const dist = BABYLON.Vector3.Distance(this.player.camera.position, z.pos);
            if (dist > 45 || z.type === "warlord" || Math.random() < 0.35) {
              this.triggerBulletTime(0.28);
              this.audio.playSlowMoImpact();
            }
          }
          this.handleZombieKill(z, isHeadshot);
          if (z.type === "sapper") {
            this.vfx.spawnArmorDebris(z.pos.clone());
            this.detonateSapperExplosion(z.pos.clone());
          }
        }
      },
      (barrel) => {
        this.detonatePowderBarrel(barrel);
      },
    );

    this.updateGarrisonArchers(dt);
    this.turrets.update(
      dt,
      this.horde.zombies,
      this.vfx,
      this.audio,
      this.world.gateZ,
      (z) => {
        this.handleZombieKill(z, false);
      },
    );

    this.vfx.update(dt);
    this.syncState();
  }

  private handleZombieKill(zombie: BabylonZombie, isHeadshot: boolean) {
    this.state.kills += 1;
    this.combo += 1;
    this.comboTimer = 5.5;

    const comboMul = Math.min(2.5, 1 + Math.floor(this.combo / 3) * 0.25);
    let reward = Math.round(zombie.gold * comboMul);
    if (isHeadshot) {
      this.state.headshots += 1;
      reward = Math.round(reward * 1.5);
    }
    this.state.gold += reward;
    this.audio.playChime();

    if (zombie.type === "warlord") {
      this.triggerBulletTime(0.45);
      this.addCallout("SIEGE WARLORD SLAIN!", `+${reward} Gold Bounty`, "red");
    } else if (zombie.type === "ram") {
      this.triggerBulletTime(0.45);
      this.vfx.spawnExplosion(zombie.pos, 11.5);
      this.vfx.spawnStoneImpact(zombie.pos);
      this.addCallout("BATTERING RAM DEMOLISHED!", `+${reward} Gold Siege Bounty`, "gold");
    } else if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
      this.addCallout(`${this.combo}x KILLSTREAK!`, `${comboMul.toFixed(2)}x Gold Multiplier`, "gold");
    }

    if (BABYLON.Vector3.Distance(zombie.pos, this.player.camera.position) <= 15.0) {
      this.bloodSplatterTimer = 2.4;
    }
  }

  private syncState() {
    this.state.gateHp = Math.round(this.world.gateHealth);
    this.state.maxGateHp = this.world.maxGateHealth;
    this.state.zombiesAlive = this.horde.zombies.filter((z) => !z.dead).length;
    this.state.isAiming = this.player.isAiming;
    this.state.zoomLevel = this.player.zoomLevel;
    this.state.bulletTimeActive = this.bulletTimeTimer > 0;
    this.state.nightSightActive = this.player.nightSightActive;
    this.state.screenTraumaTimer = this.screenTraumaTimer;
    this.state.bloodSplatterTimer = this.bloodSplatterTimer;
    this.state.breathStamina = Math.round(this.player.breathStamina);
    this.state.holdingBreath = this.player.holdingBreath;
    this.state.culvertHp = Math.round(this.world.culvertHealth);
    this.state.maxCulvertHp = this.world.maxCulvertHealth;
    this.state.culvertBreached = this.world.culvertBreached;
    this.state.reticleTarget = this.player.scanReticleTarget(
      this.horde.zombies,
      this.world.powderBarrels,
    );
    this.state.floatingDamages = this.floatingDamages.map((fd) => ({
      id: fd.id,
      x: fd.x,
      y: fd.y,
      text: fd.text,
      isCrit: fd.isCrit,
      color: fd.color,
    }));
    this.state.hitmarker = this.currentHitmarker;
    this.state.currentAmmo = this.player.currentAmmo;
    this.state.weaponLevel = this.player.stats.weaponLevel;
    this.state.weaponUpgradeCost = this.getWeaponUpgradeCost();
    this.state.combo = this.combo;
    this.state.comboTimer = this.comboTimer;
    this.state.powderBarrelsRemaining = this.world.powderBarrels.filter((b) => !b.detonated).length;
    const activeWarlord = this.horde.zombies.find((z) => !z.dead && z.type === "warlord");
    this.state.bossHp = activeWarlord ? Math.max(0, Math.round(activeWarlord.hp)) : 0;
    this.state.bossMaxHp = activeWarlord ? activeWarlord.maxHp : 0;
    this.state.callouts = this.callouts;
    this.state.turretSockets = this.getSocketsState();
    this.state.selectedSocketId = this.selectedSocketId;
    this.emitState();
  }

  private emitState() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state, abilities: [...this.abilities] });
    }
  }

  public useAbility(id: AbilityId): boolean {
    const ab = this.abilities.find((a) => a.id === id);
    if (!ab || !ab.ready) return false;

    if (id === "oil_dump") {
      this.audio.playOilSizzle();
      this.player.addCameraShake(0.35);
      for (let x = -7; x <= 7; x += 3.5) {
        this.vfx.spawnGroundFire(new BABYLON.Vector3(x, 0, this.world.gateZ - 2.2), 6.2, 9.5, 95);
      }
      this.addCallout("BOILING PITCH UNLEASHED!", "Gate Breach Engulfed", "orange");
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "catapult_barrage") {
      this.audio.playExplosion();
      this.addCallout("CATAPULT BRIMSTONE BARRAGE!", "Incoming Canyon Bombardment", "orange");
      const zTargets = [-38, -58, -80];
      zTargets.forEach((tz, index) => {
        setTimeout(() => {
          const landPos = new BABYLON.Vector3((Math.random() - 0.5) * 14, 0, tz);
          this.vfx.spawnExplosion(landPos, 9.0);
          this.player.addCameraShake(0.45);
          this.audio.playExplosion();

          for (const z of this.horde.zombies) {
            if (z.dead) continue;
            if (BABYLON.Vector3.Distance(landPos, z.pos) <= 9.5) {
              z.hp -= 190;
              z.burnTimer = 4.0;
              z.burnDps = 22;
              if (z.hp <= 0) {
                z.dead = true;
                const blastDir = z.pos.subtract(landPos).normalize();
                z.ragdollVel = new BABYLON.Vector3(
                  blastDir.x * 10 + (Math.random() - 0.5) * 4,
                  Math.random() * 9 + 8,
                  blastDir.z * 12 - 6,
                );
                z.ragdollSpin = new BABYLON.Vector3(Math.random() * 12, Math.random() * 8, Math.random() * 8);
                this.handleZombieKill(z, false);
              }
            }
          }
        }, index * 380);
      });
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "horn_of_helm") {
      this.audio.playWarHorn();
      this.player.addCameraShake(0.5);
      this.vfx.spawnShockwave(
        new BABYLON.Vector3(0, 1.0, this.world.gateZ - 5),
        28,
        new BABYLON.Color3(1.0, 0.82, 0.25),
      );
      this.hornStunTimer = 4.5;
      for (const z of this.horde.zombies) {
        if (!z.dead) {
          z.pos.z -= 3.5;
          z.staggerTimer = 0.5;
        }
      }
      const oldRate = this.player.stats.fireRate;
      this.player.stats.fireRate *= 1.65;
      setTimeout(() => {
        this.player.stats.fireRate = oldRate;
      }, 6500);
      this.addCallout("THE HORN OF HELM HAMMERHAND!", "Horde Stunned • +65% Reload Speed", "gold");
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "archer_volley") {
      this.audio.playArcherVolley();
      this.addCallout("ELVEN SENTINEL VOLLEY!", "18 Flaming Arrows Loosed", "cyan");
      const alive = this.horde.zombies.filter((z) => !z.dead);
      for (let i = 0; i < 18; i++) {
        setTimeout(() => {
          const archer =
            this.world.garrisonArchers[i % Math.max(1, this.world.garrisonArchers.length)];
          const startPos = archer
            ? archer.pos.clone()
            : new BABYLON.Vector3((Math.random() - 0.5) * 35, 24, -6.5);
          const target = alive.length > 0 ? alive[i % alive.length] : null;
          if (target && !target.dead) {
            this.turrets.spawnDirectBolt(startPos, target, 42, true);
          }
        }, i * 45);
      }
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    }
    return false;
  }

  public selectSocket(socketId: number | null) {
    this.selectedSocketId = socketId;
    this.syncState();
  }

  public purchaseTurret(socketId: number, type: TurretType): boolean {
    const spec = TURRET_SPECS[type];
    if (this.state.gold < spec.cost) return false;

    const socket = this.world.turretSockets.find((s) => s.id === socketId);
    if (!socket) return false;

    this.state.gold -= spec.cost;
    socket.type = type;
    this.turrets.buildTurret(socketId, socket.pos, type);
    this.audio.playChime();
    this.syncState();
    return true;
  }

  public upgradeTurret(socketId: number): boolean {
    const turret = this.turrets.turrets.get(socketId);
    if (!turret || turret.level >= 3) return false;

    const upgradeCost = Math.round(TURRET_SPECS[turret.type].cost * 0.85 * turret.level);
    if (this.state.gold < upgradeCost) return false;

    this.state.gold -= upgradeCost;
    this.turrets.upgradeTurret(socketId);
    this.audio.playChime();
    this.syncState();
    return true;
  }

  public repairGate(): boolean {
    if (this.state.gold < 100) return false;
    if (
      this.world.gateHealth >= this.world.maxGateHealth &&
      this.world.powderBarrels.every((b) => !b.detonated)
    ) {
      return false;
    }
    this.state.gold -= 100;
    this.world.repairGate(280);
    this.world.repairCulvert(200);
    this.world.spawnPowderBarrels();
    this.audio.playChime();
    this.addCallout("DEFENSES REPAIRED & BARRELS RESTOCKED!", "+280 Gate HP • +200 Culvert HP • 8 Powder Casks", "gold");
    this.syncState();
    return true;
  }

  public onKeyDown(code: string) {
    this.keysDown.add(code);

    if (code === "Space" || code === "ShiftLeft" || code === "ShiftRight") {
      if (this.player.isAiming && !this.player.holdingBreath) {
        const ok = this.player.setHoldingBreath(true);
        if (ok) {
          this.audio.playHeartbeat(this.player.breathStamina / 100);
          this.syncState();
        }
      }
    }

    if (code === "Digit1") this.useAbility("oil_dump");
    if (code === "Digit2") this.useAbility("catapult_barrage");
    if (code === "Digit3") this.useAbility("horn_of_helm");
    if (code === "Digit4") this.useAbility("archer_volley");
    if (code === "KeyQ" || code === "Tab") this.cycleAmmo();
    if (code === "KeyG") this.upgradeCrossbow();
    if (code === "KeyR") this.repairGate();
    if (code === "KeyZ") {
      this.player.cycleEnhanceZoom();
      this.audio.playAmmoSwitch();
      this.syncState();
    }
    if (code === "KeyT") {
      const active = this.player.toggleNightSight();
      this.audio.playNightVisionHum();
      this.addCallout(
        active ? "RUNIC NIGHT-SIGHT ENGAGED" : "RUNIC NIGHT-SIGHT OFF",
        active ? "Spectral Silhouette Highlighting" : "Standard Optical View",
        active ? "cyan" : "gold",
      );
      this.syncState();
    }
    if (code === "KeyV") {
      this.player.currentY = this.player.currentY > 29 ? 26.0 : 32.0;
    }
  }

  public onKeyUp(code: string) {
    this.keysDown.delete(code);

    if (code === "Space" || code === "ShiftLeft" || code === "ShiftRight") {
      if (this.player.holdingBreath) {
        this.player.setHoldingBreath(false);
        this.audio.playExhale();
        this.syncState();
      }
    }
  }

  public onMouseMove(dx: number, dy: number) {
    this.player.look(dx, dy);
  }

  public onWheel(deltaY: number) {
    if (!this.player.isAiming && deltaY < 0) {
      this.player.isAiming = true;
    }
    this.player.adjustZoom(deltaY < 0 ? 0.5 : -0.5);
    this.syncState();
  }

  public onMouseDown(button: number) {
    this.audio.unlock();
    if (button === 0) {
      this.isMouseDown = true;
      if (this.player.canShoot()) {
        const proj = this.player.shoot();
        if (proj) {
          this.audio.playShoot(this.player.isAiming ? 1.3 : 1.0);
          setTimeout(() => {
            this.audio.playWindlassRatchet();
          }, 160);
        }
      }
    } else if (button === 2) {
      this.player.isAiming = true;
      this.syncState();
    }
  }

  public onMouseUp(button: number) {
    if (button === 0) {
      this.isMouseDown = false;
    } else if (button === 2) {
      this.player.isAiming = false;
      if (this.player.holdingBreath) {
        this.player.setHoldingBreath(false);
        this.audio.playExhale();
      }
      this.syncState();
    }
  }

  public resize(width: number, height: number) {
    if (width === 0 || height === 0) return;
    this.engine.resize();
  }

  public restart() {
    for (const b of this.enemySiegeBolts) {
      b.mesh.dispose();
    }
    this.enemySiegeBolts = [];
    this.screenTraumaTimer = 0;

    this.world.gateHealth = this.world.maxGateHealth;
    this.horde.clear();
    this.vfx.clear();
    this.player.clear();
    this.turrets.clear();

    const leftBastion = this.world.turretSockets[1];
    if (leftBastion) {
      this.turrets.buildTurret(leftBastion.id, leftBastion.pos, "repeater");
      leftBastion.type = "repeater";
    }
    const rightBastion = this.world.turretSockets[2];
    if (rightBastion) {
      this.turrets.buildTurret(rightBastion.id, rightBastion.pos, "mortar");
      rightBastion.type = "mortar";
    }

    this.state.gold = 280;
    this.state.kills = 0;
    this.state.headshots = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.setupWave(1, true);
    this.start();
  }

  public destroy() {
    this.stop();
    for (const b of this.enemySiegeBolts) {
      b.mesh.dispose();
    }
    this.enemySiegeBolts = [];
    this.horde.clear();
    this.vfx.clear();
    this.player.clear();
    this.turrets.clear();
    this.scene.dispose();
    this.engine.dispose();
  }
}
