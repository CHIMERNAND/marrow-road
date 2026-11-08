import * as THREE from "three";
import { HelmsWorld } from "./world";
import { ZombieHorde, type Zombie } from "./horde";
import { HelmsPlayer } from "./player";
import { TurretManager } from "./turrets";
import { HelmsVFX } from "./vfx";
import { HelmsAudio } from "./audio";
import {
  type TurretType,
  TURRET_SPECS,
  type BoltAmmoType,
  type CombatCallout,
  type FloatingDamage,
  type ReticleTargetInfo,
} from "./types";

export type AbilityId = "oil_dump" | "catapult_barrage" | "horn_of_helm" | "archer_volley";

export type AbilityState = {
  id: AbilityId;
  name: string;
  hotkey: string;
  cooldown: number;
  maxCooldown: number;
  ready: boolean;
};

export type HelmsGameState = {
  status: "idle" | "preparing" | "wave" | "victory" | "defeat";
  wave: number;
  totalWaves: number;
  waveCountdown: number;
  zombiesAlive: number;
  zombiesRemainingInWave: number;
  gateHp: number;
  maxGateHp: number;
  gold: number;
  kills: number;
  headshots: number;
  isAiming: boolean;
  hitmarker: "body" | "headshot" | "shield" | null;
  currentAmmo?: BoltAmmoType;
  weaponLevel?: number;
  weaponUpgradeCost?: number;
  combo?: number;
  comboTimer?: number;
  powderBarrelsRemaining?: number;
  bossHp?: number;
  bossMaxHp?: number;
  zoomLevel?: number;
  bulletTimeActive?: boolean;
  nightSightActive?: boolean;
  screenTraumaTimer?: number;
  bloodSplatterTimer?: number;
  chargeRatio?: number;
  breathStamina?: number;
  holdingBreath?: boolean;
  culvertHp?: number;
  maxCulvertHp?: number;
  culvertBreached?: boolean;
  reticleTarget?: ReticleTargetInfo | null;
  floatingDamages?: FloatingDamage[];
  callouts?: CombatCallout[];
  abilities: AbilityState[];
  selectedSocketId: number | null;
  turretSockets: Array<{
    id: number;
    name: string;
    pos: [number, number, number];
    turretType: TurretType | null;
    level: number;
  }>;
};

export class HelmsEngine {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public world: HelmsWorld;
  public horde: ZombieHorde;
  public player: HelmsPlayer;
  public turrets: TurretManager;
  public vfx: HelmsVFX;
  public audio: HelmsAudio;

  public state: HelmsGameState;
  private onStateChange?: (state: HelmsGameState) => void;

  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTime = 0;

  // Wave Management
  private wave = 1;
  private totalWaves = 10;
  private waveQueue: Array<{ type: "runner" | "shambler" | "brute" | "banshee"; delay: number }> = [];
  private waveTimer = 0;
  private intermissionTimer = 0;
  private hornStunTimer = 0;

  // Active Siege Abilities
  private abilities: AbilityState[] = [
    { id: "oil_dump", name: "Boiling Pitch Dump", hotkey: "1", cooldown: 0, maxCooldown: 16, ready: true },
    { id: "catapult_barrage", name: "Catapult Volley", hotkey: "2", cooldown: 0, maxCooldown: 22, ready: true },
    { id: "horn_of_helm", name: "Horn of Helm", hotkey: "3", cooldown: 0, maxCooldown: 30, ready: true },
  ];

  // Hitmarker fade
  private hitmarkerTimer = 0;
  private currentHitmarker: "body" | "headshot" | null = null;

  // Input states
  private keysDown: Set<string> = new Set();
  private isMouseDown = false;
  private selectedSocketId: number | null = null;

  constructor(canvas: HTMLCanvasElement, onStateChange?: (state: HelmsGameState) => void) {
    this.onStateChange = onStateChange;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. High-performance renderer with crisp shadow mapping
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 3. Audio & Subsystems
    this.audio = new HelmsAudio();
    this.world = new HelmsWorld(this.scene);
    this.horde = new ZombieHorde(this.scene);
    this.player = new HelmsPlayer(this.renderer.domElement.width / this.renderer.domElement.height);
    this.scene.add(this.player.camera);

    this.turrets = new TurretManager(this.scene);
    this.vfx = new HelmsVFX(this.scene);

    // Initial State
    this.state = {
      status: "wave",
      wave: 1,
      totalWaves: this.totalWaves,
      waveCountdown: 0,
      zombiesAlive: 0,
      zombiesRemainingInWave: 0,
      gateHp: this.world.gateHealth,
      maxGateHp: this.world.maxGateHealth,
      gold: 260,
      kills: 0,
      headshots: 0,
      isAiming: false,
      hitmarker: null,
      abilities: this.abilities,
      selectedSocketId: null,
      turretSockets: this.getSocketsState(),
    };

    // Pre-build two default turrets on the left and right bastions:
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

    // Start Wave 1 IMMEDIATELY with vanguard zombies advancing down the road
    this.setupWave(1, true);
    this.emitState();
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

    // Escalating wave composition
    const runnerCount = 4 + waveNum * 3;
    const shamblerCount = 6 + waveNum * 5;
    const bruteCount = Math.max(0, Math.floor((waveNum - 1) * 2));
    const bansheeCount = Math.max(0, Math.floor((waveNum - 2) * 1.5));

    const totalZombies = runnerCount + shamblerCount + bruteCount + bansheeCount;
    this.state.zombiesRemainingInWave = totalZombies;

    // If starting immediately, spawn an exciting vanguard brigade right down the road!
    if (startImmediately) {
      this.horde.spawn("runner", -26, 2.5);
      this.horde.spawn("shambler", -38, 3.5);
      this.horde.spawn("runner", -50, 4.0);
      this.horde.spawn("brute", -66, 3.0);
      this.horde.spawn("banshee", -82, 4.0);
    }

    // Schedule remaining zombies
    const waveDuration = Math.min(40, 16 + waveNum * 3.0);
    const step = waveDuration / Math.max(1, totalZombies - (startImmediately ? 4 : 0));

    let time = startImmediately ? 2.5 : 0;
    for (let i = startImmediately ? 2 : 0; i < runnerCount; i++) {
      this.waveQueue.push({ type: "runner", delay: time + Math.random() * 1.8 });
      time += step * 0.75;
    }
    for (let i = startImmediately ? 2 : 0; i < shamblerCount; i++) {
      this.waveQueue.push({ type: "shambler", delay: time + Math.random() * 2.2 });
      time += step;
    }
    for (let i = 0; i < bruteCount; i++) {
      this.waveQueue.push({ type: "brute", delay: time + Math.random() * 3 });
      time += step * 1.4;
    }
    for (let i = 0; i < bansheeCount; i++) {
      this.waveQueue.push({ type: "banshee", delay: time + Math.random() * 2 });
      time += step * 1.2;
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
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = () => {
    if (!this.isRunning) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render(this.scene, this.player.camera);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // 1. Player Strafe Input (A/D or Left/Right)
    if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) {
      this.player.strafe(-14 * dt);
    }
    if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) {
      this.player.strafe(14 * dt);
    }

    // 2. Firing weapon if mouse held
    if (this.isMouseDown && this.player.canShoot()) {
      const proj = this.player.shoot(this.scene);
      if (proj) {
        this.audio.playShoot(this.player.isAiming ? 1.3 : 1.0);
      }
    }

    // 3. Abilities Cooldowns
    for (const ab of this.abilities) {
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - dt);
        ab.ready = ab.cooldown <= 0;
      }
    }

    // 4. Horn Stun
    if (this.hornStunTimer > 0) {
      this.hornStunTimer -= dt;
    }

    // 5. Hitmarker
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) {
        this.currentHitmarker = null;
      }
    }

    // 6. World Environment (rain, torches, lightning)
    this.world.update(dt);

    // 7. Wave & Spawning
    if (this.state.status === "preparing") {
      this.intermissionTimer -= dt;
      this.state.waveCountdown = Math.max(0, Math.ceil(this.intermissionTimer));
      if (this.intermissionTimer <= 0) {
        this.state.status = "wave";
      }
    } else if (this.state.status === "wave") {
      this.waveTimer += dt;
      while (this.waveQueue.length > 0 && this.waveQueue[0].delay <= this.waveTimer) {
        const item = this.waveQueue.shift()!;
        this.horde.spawn(item.type, -120 - Math.random() * 20, 20);
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

    // 8. Zombie Horde Movement & Gate Attacks (if not stunned by horn)
    if (this.hornStunTimer <= 0) {
      this.horde.update(dt, (dmg) => {
        this.world.damageGate(dmg);
        this.audio.playGateHit();
        this.vfx.spawnHitSparks(new THREE.Vector3(0, 3.5, -16.0), 8);

        if (this.world.gateHealth <= 0) {
          this.state.status = "defeat";
          this.audio.playExplosion();
        }
      });
    }

    // 9. Ground Fires damage tick
    for (const gf of this.vfx.groundFires) {
      for (const z of this.horde.zombies) {
        if (z.dead) continue;
        if (gf.pos.distanceTo(z.pos) <= gf.radius) {
          z.hp -= gf.dps * dt;
          if (z.hp <= 0) {
            z.dead = true;
            this.handleZombieKill(z, false);
          }
        }
      }
    }

    // 10. Player Projectile Updates & Collision
    this.player.update(dt, this.scene, this.horde.zombies, (z, dmg, isHeadshot, hitPos) => {
      z.hp -= dmg;
      if (isHeadshot) {
        this.audio.playHeadshot();
        this.vfx.spawnHeadshotGore(hitPos);
        this.currentHitmarker = "headshot";
        this.hitmarkerTimer = 0.35;
      } else {
        this.audio.playHit();
        this.vfx.spawnHitSparks(hitPos, 6);
        this.currentHitmarker = "body";
        this.hitmarkerTimer = 0.2;
      }

      if (z.hp <= 0) {
        z.dead = true;
        this.handleZombieKill(z, isHeadshot);
      }
    });

    // Remove dead zombies
    for (let i = this.horde.zombies.length - 1; i >= 0; i--) {
      if (this.horde.zombies[i].dead) {
        this.horde.removeZombie(this.horde.zombies[i]);
      }
    }

    // 11. Wall Turrets Automated Defense
    this.turrets.update(dt, this.scene, this.horde.zombies, this.vfx, this.audio, (z) => {
      this.handleZombieKill(z, false);
    });

    // 12. VFX update
    this.vfx.update(dt);

    // 13. Sync State
    this.syncState();
  }

  private handleZombieKill(zombie: Zombie, isHeadshot: boolean) {
    this.state.kills += 1;
    let reward = zombie.gold;
    if (isHeadshot) {
      this.state.headshots += 1;
      reward = Math.round(reward * 1.5);
    }
    this.state.gold += reward;
    this.audio.playChime();
  }

  private syncState() {
    this.state.gateHp = Math.round(this.world.gateHealth);
    this.state.maxGateHp = this.world.maxGateHealth;
    this.state.zombiesAlive = this.horde.zombies.length;
    this.state.isAiming = this.player.isAiming;
    this.state.hitmarker = this.currentHitmarker;
    this.state.turretSockets = this.getSocketsState();
    this.state.selectedSocketId = this.selectedSocketId;
    this.emitState();
  }

  private emitState() {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state, abilities: [...this.abilities] });
    }
  }

  // --- Active Siege Abilities ---
  public useAbility(id: "oil_dump" | "catapult_barrage" | "horn_of_helm"): boolean {
    const ab = this.abilities.find((a) => a.id === id);
    if (!ab || !ab.ready) return false;

    if (id === "oil_dump") {
      this.audio.playOilSizzle();
      for (let x = -8; x <= 8; x += 4) {
        this.vfx.spawnGroundFire(new THREE.Vector3(x, 0, -16.5), 6.5, 9.0, 90);
      }
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "catapult_barrage") {
      this.audio.playExplosion();
      const zTargets = [-35, -55, -75];
      zTargets.forEach((tz, index) => {
        setTimeout(() => {
          const landPos = new THREE.Vector3((Math.random() - 0.5) * 14, 0, tz);
          this.vfx.spawnExplosion(landPos, 8.5);
          this.audio.playExplosion();

          for (const z of this.horde.zombies) {
            if (z.dead) continue;
            if (landPos.distanceTo(z.pos) <= 8.5) {
              z.hp -= 180;
              if (z.hp <= 0) {
                z.dead = true;
                this.handleZombieKill(z, false);
              }
            }
          }
        }, index * 400);
      });
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "horn_of_helm") {
      this.audio.playWarHorn();
      this.hornStunTimer = 4.5;
      const oldRate = this.player.stats.fireRate;
      this.player.stats.fireRate *= 1.6;
      setTimeout(() => {
        this.player.stats.fireRate = oldRate;
      }, 6000);
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    }
    return false;
  }

  // --- Sockets & Turret Management ---
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
    if (this.state.gold < 100 || this.world.gateHealth >= this.world.maxGateHealth) return false;
    this.state.gold -= 100;
    this.world.repairGate(250);
    this.audio.playChime();
    this.syncState();
    return true;
  }

  // --- Input Handlers ---
  public onKeyDown(code: string) {
    this.keysDown.add(code);

    if (code === "Digit1") this.useAbility("oil_dump");
    if (code === "Digit2") this.useAbility("catapult_barrage");
    if (code === "Digit3") this.useAbility("horn_of_helm");
    if (code === "KeyR") this.repairGate();
  }

  public onKeyUp(code: string) {
    this.keysDown.delete(code);
  }

  public onMouseMove(dx: number, dy: number) {
    this.player.look(dx, dy);
  }

  public onMouseDown(button: number) {
    this.audio.unlock();
    if (button === 0) {
      this.isMouseDown = true;
      if (this.player.canShoot()) {
        const proj = this.player.shoot(this.scene);
        if (proj) {
          this.audio.playShoot(this.player.isAiming ? 1.3 : 1.0);
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
      this.syncState();
    }
  }

  public resize(width: number, height: number) {
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height);
    this.player.resize(width / height);
  }

  public restart() {
    this.world.gateHealth = this.world.maxGateHealth;
    this.horde.clear();
    this.vfx.clear();
    this.player.clear(this.scene);
    this.turrets.clear(this.scene);

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

    this.state.gold = 260;
    this.state.kills = 0;
    this.state.headshots = 0;
    this.setupWave(1, true);
    this.start();
  }

  public destroy() {
    this.stop();
    this.horde.clear();
    this.vfx.clear();
    this.player.clear(this.scene);
    this.turrets.clear(this.scene);
    this.renderer.dispose();
  }
}
