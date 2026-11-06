import * as BABYLON from "@babylonjs/core";
import { BabylonHelmsWorld } from "./world";
import { BabylonZombieHorde, type BabylonZombie } from "./horde";
import { BabylonHelmsPlayer } from "./player";
import { BabylonTurretManager } from "./turrets";
import { BabylonHelmsVFX } from "./vfx";
import { HelmsAudio } from "@/helmsdeep/audio";
import { type TurretType, TURRET_SPECS } from "@/helmsdeep/types";
import type { AbilityState, HelmsGameState } from "@/helmsdeep/engine";

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
    type: "runner" | "shambler" | "brute" | "banshee";
    delay: number;
  }> = [];
  private waveTimer = 0;
  private intermissionTimer = 0;
  private hornStunTimer = 0;

  private abilities: AbilityState[] = [
    {
      id: "oil_dump",
      name: "Boiling Pitch Dump",
      hotkey: "1",
      cooldown: 0,
      maxCooldown: 16,
      ready: true,
    },
    {
      id: "catapult_barrage",
      name: "Catapult Volley",
      hotkey: "2",
      cooldown: 0,
      maxCooldown: 22,
      ready: true,
    },
    {
      id: "horn_of_helm",
      name: "Horn of Helm",
      hotkey: "3",
      cooldown: 0,
      maxCooldown: 30,
      ready: true,
    },
  ];

  private hitmarkerTimer = 0;
  private currentHitmarker: "body" | "headshot" | null = null;

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
    this.horde = new BabylonZombieHorde(this.scene);
    this.player = new BabylonHelmsPlayer(this.scene);
    this.turrets = new BabylonTurretManager(this.scene);
    this.vfx = new BabylonHelmsVFX(this.scene);

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

    // Pre-build two default turrets on the West & East Gate Bastions
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

    const runnerCount = 4 + waveNum * 3;
    const shamblerCount = 6 + waveNum * 5;
    const bruteCount = Math.max(0, Math.floor((waveNum - 1) * 2));
    const bansheeCount = Math.max(0, Math.floor((waveNum - 2) * 1.5));

    const totalZombies = runnerCount + shamblerCount + bruteCount + bansheeCount;
    this.state.zombiesRemainingInWave = totalZombies;

    if (startImmediately) {
      // Spawn a clearly spaced vanguard formation across the 20m road so every enemy is visible!
      const vanguard: Array<{ type: "runner" | "shambler" | "brute" | "banshee"; x: number; z: number }> = [
        { type: "runner", x: -4.8, z: -38 },
        { type: "shambler", x: 4.5, z: -46 },
        { type: "runner", x: -1.6, z: -55 },
        { type: "brute", x: 1.8, z: -66 },
        { type: "shambler", x: -5.8, z: -78 },
        { type: "banshee", x: 5.2, z: -90 },
      ];
      for (const v of vanguard) {
        const z = this.horde.spawn(v.type, v.z, 0.5, this.world.gateZ);
        z.pos.x = v.x;
        z.root.position.x = v.x;
      }
    }

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
    this.engine.runRenderLoop(() => {
      if (!this.isRunning) return;
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      this.update(dt);
      this.scene.render();
    });
  }

  public stop() {
    this.isRunning = false;
    this.engine.stopRenderLoop();
  }

  private update(dt: number) {
    // 1. Strafe (A/D) & Elevation adjustment (W/S or Up/Down)
    if (this.keysDown.has("KeyA") || this.keysDown.has("ArrowLeft")) {
      this.player.strafe(-15 * dt);
    }
    if (this.keysDown.has("KeyD") || this.keysDown.has("ArrowRight")) {
      this.player.strafe(15 * dt);
    }
    if (this.keysDown.has("KeyW") || this.keysDown.has("ArrowUp")) {
      this.player.elevate(8 * dt);
    }
    if (this.keysDown.has("KeyS") || this.keysDown.has("ArrowDown")) {
      this.player.elevate(-8 * dt);
    }

    // 2. Firing Crossbow
    if (this.isMouseDown && this.player.canShoot()) {
      const proj = this.player.shoot();
      if (proj) {
        this.audio.playShoot(this.player.isAiming ? 1.3 : 1.0);
      }
    }

    // 3. Ability Cooldowns
    for (const ab of this.abilities) {
      if (ab.cooldown > 0) {
        ab.cooldown = Math.max(0, ab.cooldown - dt);
        ab.ready = ab.cooldown <= 0;
      }
    }

    if (this.hornStunTimer > 0) {
      this.hornStunTimer -= dt;
    }

    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) {
        this.currentHitmarker = null;
      }
    }

    this.world.update(dt);

    // 4. Wave Spawning
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
        this.horde.spawn(item.type, -115 - Math.random() * 25, 7.5, this.world.gateZ);
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

    // 5. Zombie Horde Movement
    if (this.hornStunTimer <= 0) {
      this.horde.update(dt, (dmg) => {
        this.world.damageGate(dmg);
        this.audio.playGateHit();
        this.vfx.spawnHitSparks(new BABYLON.Vector3(0, 3.5, this.world.gateZ - 0.5), 8);

        if (this.world.gateHealth <= 0) {
          this.state.status = "defeat";
          this.audio.playExplosion();
        }
      });
    }

    // 6. Ground Fires damage tick
    for (const gf of this.vfx.groundFires) {
      for (const z of this.horde.zombies) {
        if (z.dead) continue;
        if (BABYLON.Vector3.Distance(gf.pos, z.pos) <= gf.radius) {
          z.hp -= gf.dps * dt;
          if (z.hp <= 0) {
            z.dead = true;
            this.handleZombieKill(z, false);
          }
        }
      }
    }

    // 7. Player Projectiles
    this.player.update(dt, this.horde.zombies, (z, dmg, isHeadshot, hitPos) => {
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

    for (let i = this.horde.zombies.length - 1; i >= 0; i--) {
      if (this.horde.zombies[i].dead) {
        this.horde.removeZombie(this.horde.zombies[i]);
      }
    }

    // 8. Turret Defense
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

  public useAbility(id: "oil_dump" | "catapult_barrage" | "horn_of_helm"): boolean {
    const ab = this.abilities.find((a) => a.id === id);
    if (!ab || !ab.ready) return false;

    if (id === "oil_dump") {
      this.audio.playOilSizzle();
      for (let x = -7; x <= 7; x += 3.5) {
        this.vfx.spawnGroundFire(new BABYLON.Vector3(x, 0, this.world.gateZ - 2.0), 6.0, 9.0, 90);
      }
      ab.cooldown = ab.maxCooldown;
      ab.ready = false;
      return true;
    } else if (id === "catapult_barrage") {
      this.audio.playExplosion();
      const zTargets = [-38, -58, -80];
      zTargets.forEach((tz, index) => {
        setTimeout(() => {
          const landPos = new BABYLON.Vector3((Math.random() - 0.5) * 14, 0, tz);
          this.vfx.spawnExplosion(landPos, 8.5);
          this.audio.playExplosion();

          for (const z of this.horde.zombies) {
            if (z.dead) continue;
            if (BABYLON.Vector3.Distance(landPos, z.pos) <= 9.0) {
              z.hp -= 180;
              if (z.hp <= 0) {
                z.dead = true;
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

  public onKeyDown(code: string) {
    this.keysDown.add(code);

    if (code === "Digit1") this.useAbility("oil_dump");
    if (code === "Digit2") this.useAbility("catapult_barrage");
    if (code === "Digit3") this.useAbility("horn_of_helm");
    if (code === "KeyR") this.repairGate();
    if (code === "KeyV") {
      // Toggle between Watchtower Overlook (26m) and High Citadel Eagle Eye (32m)
      this.player.currentY = this.player.currentY > 29 ? 26.0 : 32.0;
    }
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
        const proj = this.player.shoot();
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
    this.engine.resize();
  }

  public restart() {
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
    this.player.clear();
    this.turrets.clear();
    this.scene.dispose();
    this.engine.dispose();
  }
}
