import * as THREE from "three";
import { createAudio, type GameAudio } from "@/game/audio";
import {
  CELL,
  COLS,
  EARLY_BONUS,
  ENEMIES,
  PREP_SECONDS,
  ROWS,
  SELL_REFUND,
  START_GOLD,
  START_LIVES,
  TARGET_LABEL,
  TARGET_ORDER,
  TOWERS,
  WAVES,
  buildWorld,
  damageMul,
  describeWave,
  rateMul,
  upgradeCost,
  type EnemyId,
  type TargetMode,
  type TowerId,
} from "@/game/data";
import { SceneManager } from "@/game3d/SceneManager";
import { gridToWorld, simToWorld } from "@/game3d/types";
import type { Game, Hud, HudTower, Phase } from "@/game/engine";

const BEST_KEY = "marrow-road-best";

type Enemy = {
  id: number;
  type: EnemyId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  seg: number;
  dist: number;
  hp: number;
  maxHp: number;
  slow: number;
  flash: number;
  gone: boolean;
  leak: number;
  gold: number;
  speed: number;
  armor: number;
  scale: number;
};

type Tower = {
  id: number;
  type: TowerId;
  c: number;
  r: number;
  x: number;
  y: number;
  dmgRank: number;
  rateRank: number;
  spent: number;
  cooldown: number;
  angle: number;
  target: TargetMode;
  pulse: number;
};

type Spawn = { type: EnemyId; time: number };

export type Game3D = Omit<Game, "pointer"> & {
  pointer: (clientX: number, clientY: number, kind: "down" | "move" | "up" | "leave", button?: number) => void;
  zoom: (delta: number) => void;
  rotate: (dx: number, dy: number) => void;
  pan: (dx: number, dz: number) => void;
  resetCamera: () => void;
};

export function createGame3D(
  canvas: HTMLCanvasElement,
  onHud: (hud: Hud) => void,
): Game3D {
  const sceneMgr = new SceneManager(canvas);
  const audio: GameAudio = createAudio();
  const world = buildWorld();

  let phase: Phase = "title";
  let lives = START_LIVES;
  let gold = START_GOLD;
  let waveIndex = 0;
  let prepLeft = PREP_SECONDS;
  let kills = 0;
  let goldEarned = 0;
  let leaked = 0;
  let wavesCleared = 0;
  let speed: 1 | 2 = 1;
  let muted = false;
  let armed: TowerId | null = null;
  let selectedId: number | null = null;
  let toastText = "";
  let toastTimer = 0;

  let towers: Tower[] = [];
  let enemies: Enemy[] = [];
  let spawns: Spawn[] = [];
  let spawnCursor = 0;
  let waveTime = 0;
  let nextId = 1;

  let hoverCell: { c: number; r: number } | null = null;
  let isPointerDown = false;
  let pointerDownX = 0;
  let pointerDownY = 0;
  let hasDragged = false;
  let lastDragX = 0;
  let lastDragY = 0;
  let activeMouseButton = 0;

  let lastTime = performance.now();
  let acc = 0;
  let hudAcc = 0;

  function readBest(): number {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      const val = Number(raw);
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  }

  function noteBest() {
    try {
      const cur = readBest();
      if (wavesCleared > cur) localStorage.setItem(BEST_KEY, String(wavesCleared));
    } catch {}
  }

  function toast(msg: string) {
    toastText = msg;
    toastTimer = 2.4;
  }

  function freshRun() {
    lives = START_LIVES;
    gold = START_GOLD;
    waveIndex = 0;
    prepLeft = PREP_SECONDS;
    kills = 0;
    goldEarned = 0;
    leaked = 0;
    wavesCleared = 0;
    towers = [];
    enemies = [];
    spawns = [];
    spawnCursor = 0;
    waveTime = 0;
    armed = null;
    selectedId = null;
    toastText = "";
    toastTimer = 0;
    sceneMgr.vfx.clear();
  }

  function makeSpawns(idx: number): Spawn[] {
    const list: Spawn[] = [];
    const wave = WAVES[idx];
    if (!wave) return list;
    for (const group of wave.groups) {
      const base = group.delay ?? 0;
      for (let i = 0; i < group.count; i++) {
        list.push({ type: group.type, time: base + i * group.interval });
      }
    }
    list.sort((a, b) => a.time - b.time);
    return list;
  }

  function spawnEnemy(type: EnemyId) {
    const spec = ENEMIES[type];
    const p0 = world.points[0];
    enemies.push({
      id: nextId++,
      type,
      x: p0.x,
      y: p0.y,
      vx: 0,
      vy: 0,
      seg: 1,
      dist: 0,
      hp: spec.hp,
      maxHp: spec.hp,
      slow: 0,
      flash: 0,
      gone: false,
      leak: spec.leak,
      gold: spec.gold,
      speed: spec.speed * CELL,
      armor: spec.armor,
      scale: spec.scale,
    });
  }

  function hurt(enemy: Enemy, raw: number, ignoreArmor = false) {
    if (enemy.gone) return;
    const eff = ignoreArmor ? raw : raw * enemy.armor;
    enemy.hp -= eff;
    enemy.flash = 0.12;
    if (enemy.hp <= 0) {
      enemy.gone = true;
      kills += 1;
      gold += enemy.gold;
      goldEarned += enemy.gold;
      audio.kill();
    }
  }

  function leak(enemy: Enemy) {
    if (enemy.gone) return;
    enemy.gone = true;
    leaked += enemy.leak;
    lives = Math.max(0, lives - enemy.leak);
    sceneMgr.shake(6);
    audio.leak();
    if (lives <= 0) {
      phase = "defeat";
      noteBest();
      audio.defeat();
      toast("The chapel has fallen");
      publish(true);
    }
  }

  function beginWave(bonus: boolean) {
    if (phase !== "prep") return;
    if (bonus) {
      gold += EARLY_BONUS;
      goldEarned += EARLY_BONUS;
      toast(`Early call +${EARLY_BONUS}`);
    } else {
      toast(WAVES[waveIndex]?.boss ? "The Warden is on the lane" : `Wave ${waveIndex + 1}`);
    }
    phase = "wave";
    spawns = makeSpawns(waveIndex);
    spawnCursor = 0;
    waveTime = 0;
    audio.wave();
    publish(true);
  }

  function finishWave() {
    wavesCleared = waveIndex + 1;
    noteBest();
    if (waveIndex >= WAVES.length - 1) {
      phase = "victory";
      audio.victory();
      toast("The chapel holds");
    } else {
      waveIndex += 1;
      phase = "prep";
      prepLeft = PREP_SECONDS;
      toast("Lane clear");
    }
    publish(true);
  }

  function pickTarget(tower: Tower, rangePx: number): Enemy | null {
    let best: Enemy | null = null;
    let score = -Infinity;
    const r2 = rangePx * rangePx;
    for (const enemy of enemies) {
      if (enemy.gone) continue;
      const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
      if (d2 > r2) continue;
      let s = 0;
      if (tower.target === "first") s = enemy.dist;
      else if (tower.target === "last") s = -enemy.dist;
      else if (tower.target === "near") s = -Math.sqrt(d2);
      else if (tower.target === "strong") s = enemy.hp;
      if (s > score) {
        score = s;
        best = enemy;
      }
    }
    return best;
  }

  function fire(tower: Tower, enemy: Enemy) {
    const spec = TOWERS[tower.type];
    const damage = spec.damage * damageMul(tower.dmgRank);
    const aim = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
    tower.angle = aim;

    const start3D = gridToWorld(tower.c, tower.r);
    start3D.y = 1.0;
    const target3D = simToWorld(enemy.x, enemy.y);
    target3D.y = 0.5;

    const startVec = new THREE.Vector3(start3D.x, start3D.y, start3D.z);
    const targetVec = new THREE.Vector3(target3D.x, target3D.y, target3D.z);

    if (spec.shot === "shell") {
      const travel = Math.max(0.4, Math.hypot(enemy.x - tower.x, enemy.y - tower.y) / (spec.shotSpeed * CELL));
      sceneMgr.vfx.spawnProjectile(
        `shot_${nextId++}`,
        "shell",
        startVec,
        targetVec,
        travel,
        () => {
          // Detonate
          const splashPx = spec.splash * CELL;
          for (const e of enemies) {
            if (e.gone) continue;
            const d = Math.hypot(e.x - enemy.x, e.y - enemy.y);
            if (d <= splashPx) {
              const fall = 1 - 0.4 * (d / splashPx);
              hurt(e, damage * fall, true);
            }
          }
          sceneMgr.vfx.spawnExplosion(targetVec, 2.8);
          sceneMgr.shake(4);
          audio.hit();
        },
      );
      audio.shot("shell");
    } else {
      const travel = 0.25;
      sceneMgr.vfx.spawnProjectile(
        `shot_${nextId++}`,
        spec.shot === "bolt" ? "bolt" : "flame",
        startVec,
        targetVec,
        travel,
        () => {
          hurt(enemy, damage, false);
          audio.hit();
        },
      );
      audio.shot(spec.shot === "bolt" ? "bolt" : "flame");
    }
  }

  function step(dt: number) {
    toastTimer = Math.max(0, toastTimer - dt);
    for (const tower of towers) tower.pulse = Math.max(0, tower.pulse - dt * 1.6);

    if (phase === "title" || phase === "victory" || phase === "defeat") return;

    if (phase === "prep") {
      prepLeft -= dt;
      if (prepLeft <= 0) beginWave(false);
      return;
    }

    waveTime += dt;
    while (spawnCursor < spawns.length && spawns[spawnCursor].time <= waveTime) {
      spawnEnemy(spawns[spawnCursor].type);
      spawnCursor += 1;
    }

    for (const enemy of enemies) {
      if (enemy.gone) continue;
      enemy.slow = Math.max(0, enemy.slow - dt);
      enemy.flash = Math.max(0, enemy.flash - dt);
      const point = world.points[enemy.seg];
      if (!point) {
        leak(enemy);
        continue;
      }
      const dx = point.x - enemy.x;
      const dy = point.y - enemy.y;
      const len = Math.hypot(dx, dy);
      const stepPx = enemy.speed * (enemy.slow > 0 ? 0.52 : 1) * dt;
      if (len <= stepPx || len < 0.75) {
        enemy.dist += len;
        enemy.x = point.x;
        enemy.y = point.y;
        enemy.seg += 1;
        if (enemy.seg >= world.points.length) leak(enemy);
      } else {
        enemy.vx = dx / len;
        enemy.vy = dy / len;
        enemy.x += enemy.vx * stepPx;
        enemy.y += enemy.vy * stepPx;
        enemy.dist += stepPx;
      }
    }

    for (const tower of towers) {
      const spec = TOWERS[tower.type];
      const rangePx = spec.range * CELL;
      if (spec.aura) {
        tower.cooldown -= dt;
        if (tower.cooldown > 0) continue;
        let hit = false;
        const range2 = rangePx * rangePx;
        const amount = spec.damage * damageMul(tower.dmgRank);
        for (const enemy of enemies) {
          if (enemy.gone) continue;
          const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
          if (d2 <= range2) {
            hit = true;
            enemy.slow = 0.5;
            hurt(enemy, amount, true);
          }
        }
        if (hit) {
          tower.cooldown = 1 / (spec.rate * rateMul(tower.rateRank));
          tower.pulse = 1;
          const pos3D = gridToWorld(tower.c, tower.r);
          sceneMgr.vfx.spawnBellToll(new THREE.Vector3(pos3D.x, 0.1, pos3D.z), spec.range * 2.5);
          audio.shot("bell");
        }
        continue;
      }

      const target = pickTarget(tower, rangePx);
      if (!target) continue;
      const aim = Math.atan2(target.y - tower.y, target.x - tower.x);
      let da = aim - tower.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      tower.angle += da * Math.min(1, dt * 10);
      tower.cooldown -= dt;
      if (tower.cooldown <= 0) {
        tower.cooldown = 1 / (spec.rate * rateMul(tower.rateRank));
        fire(tower, target);
      }
    }

    enemies = enemies.filter((enemy) => !enemy.gone);

    if (spawnCursor >= spawns.length && enemies.length === 0 && phase === "wave") {
      finishWave();
    }
  }

  function tryPlace(c: number, r: number) {
    if (!armed) return;
    if (phase === "title" || phase === "victory" || phase === "defeat") return;
    const key = `${c},${r}`;
    if (world.path.has(key)) {
      toast("The dead own that ground");
      publish(true);
      return;
    }
    if (world.decor.has(key)) {
      toast("A grave already stands there");
      publish(true);
      return;
    }
    if (towers.some((t) => t.c === c && t.r === r)) {
      toast("Already built");
      publish(true);
      return;
    }
    const spec = TOWERS[armed];
    if (gold < spec.cost) {
      toast("Not enough gold");
      publish(true);
      return;
    }

    gold -= spec.cost;
    towers.push({
      id: nextId++,
      type: armed,
      c,
      r,
      x: (c + 0.5) * CELL,
      y: (r + 0.5) * CELL,
      dmgRank: 0,
      rateRank: 0,
      spent: spec.cost,
      cooldown: 0.15,
      angle: -Math.PI / 2,
      target: "first",
      pulse: 0,
    });
    const pos3D = gridToWorld(c, r);
    sceneMgr.vfx.spawnExplosion(new THREE.Vector3(pos3D.x, 0.5, pos3D.z), 1.2, 0xc4a35a);
    audio.place();
    publish(true);
  }

  function getSelectedHud(): HudTower | null {
    if (selectedId === null) return null;
    const t = towers.find((item) => item.id === selectedId);
    if (!t) return null;
    const spec = TOWERS[t.type];
    const dmgCost = t.dmgRank < 3 ? upgradeCost(spec.cost, t.dmgRank, "dmg") : null;
    const rateCost = t.rateRank < 3 ? upgradeCost(spec.cost, t.rateRank, "rate") : null;
    const sell = Math.floor(t.spent * SELL_REFUND);
    const line = `${spec.blurb} · ${Math.round(spec.damage * damageMul(t.dmgRank))} dmg · ${(spec.rate * rateMul(t.rateRank)).toFixed(1)}/s`;
    return {
      id: t.id,
      name: spec.name,
      type: t.type,
      dmgRank: t.dmgRank,
      rateRank: t.rateRank,
      dmgCost,
      rateCost,
      sell,
      target: t.target,
      targetLabel: TARGET_LABEL[t.target],
      line,
    };
  }

  function publish(immediate = false) {
    if (!immediate && hudAcc < 0.08) return;
    hudAcc = 0;
    const wave = WAVES[waveIndex];
    onHud({
      phase,
      lives,
      gold,
      wave: waveIndex + 1,
      waveTotal: WAVES.length,
      boss: Boolean(wave?.boss),
      preview: describeWave(waveIndex),
      prepLeft: Math.max(0, prepLeft),
      kills,
      goldEarned,
      leaked,
      wavesCleared,
      best: readBest(),
      speed,
      muted,
      armed,
      selected: getSelectedHud(),
      toast: toastTimer > 0 ? toastText : "",
    });
  }

  function frame(t: number) {
    const rawDt = Math.min(0.1, (t - lastTime) / 1000);
    lastTime = t;
    const scaled = rawDt * speed;
    acc += scaled;

    let guard = 0;
    while (acc >= 1 / 60 && guard < 6) {
      step(1 / 60);
      acc -= 1 / 60;
      guard += 1;
    }
    if (guard >= 6) acc = 0;
    hudAcc += rawDt;

    // Sync 3D Scene
    sceneMgr.syncTowers(towers);
    sceneMgr.syncEnemies(enemies, scaled);

    // Update 3D indicators
    const selTower = towers.find((item) => item.id === selectedId);
    sceneMgr.world.updateHover(
      hoverCell,
      armed,
      towers.some((item) => hoverCell && item.c === hoverCell.c && item.r === hoverCell.r),
    );
    sceneMgr.world.updateSelected(
      selTower ? { c: selTower.c, r: selTower.r } : null,
      selTower ? selTower.type : null,
    );

    // Render 3D frame
    sceneMgr.resize();
    sceneMgr.frame(scaled);

    publish(false);
  }

  const onVis = () => {
    if (!document.hidden) audio.resume();
  };
  document.addEventListener("visibilitychange", onVis);
  publish(true);

  return {
    frame,
    destroy() {
      document.removeEventListener("visibilitychange", onVis);
      sceneMgr.destroy();
    },
    start() {
      audio.unlock();
      freshRun();
      phase = "prep";
      prepLeft = PREP_SECONDS;
      toast("Place a watch, then call them");
      publish(true);
    },
    restart() {
      audio.unlock();
      freshRun();
      phase = "prep";
      prepLeft = PREP_SECONDS;
      toast("The lane is empty again");
      publish(true);
    },
    callWave() {
      audio.unlock();
      beginWave(true);
    },
    arm(id: TowerId) {
      armed = armed === id ? null : id;
      if (armed) selectedId = null;
      publish(true);
    },
    upgrade(kind: "dmg" | "rate") {
      const tower = towers.find((item) => item.id === selectedId);
      if (!tower) return;
      const spec = TOWERS[tower.type];
      const rank = kind === "dmg" ? tower.dmgRank : tower.rateRank;
      if (rank >= 3) return;
      const cost = upgradeCost(spec.cost, rank, kind);
      if (gold < cost) {
        toast("Not enough gold");
        publish(true);
        return;
      }
      gold -= cost;
      tower.spent += cost;
      if (kind === "dmg") tower.dmgRank += 1;
      else tower.rateRank += 1;
      audio.upgrade();
      toast(kind === "dmg" ? "Damage sharpened" : "Tempo raised");
      publish(true);
    },
    sell() {
      const tower = towers.find((item) => item.id === selectedId);
      if (!tower) return;
      const refund = Math.floor(tower.spent * SELL_REFUND);
      gold += refund;
      towers = towers.filter((item) => item.id !== tower.id);
      selectedId = null;
      audio.place();
      toast(`Sold for ${refund}`);
      publish(true);
    },
    cycleTarget() {
      const tower = towers.find((item) => item.id === selectedId);
      if (!tower) return;
      const idx = TARGET_ORDER.indexOf(tower.target);
      tower.target = TARGET_ORDER[(idx + 1) % TARGET_ORDER.length];
      publish(true);
    },
    toggleSpeed() {
      speed = speed === 1 ? 2 : 1;
      publish(true);
    },
    toggleMute() {
      muted = !muted;
      audio.unlock();
      audio.mute(muted);
      publish(true);
    },
    clear() {
      armed = null;
      selectedId = null;
      publish(true);
    },
    zoom(delta: number) {
      sceneMgr.zoom(delta);
    },
    rotate(dx: number, dy: number) {
      sceneMgr.rotate(dx, dy);
    },
    pan(dx: number, dz: number) {
      sceneMgr.pan(dx, dz);
    },
    resetCamera() {
      sceneMgr.resetCamera();
    },
    pointer(clientX, clientY, kind, button = 0) {
      if (kind === "leave") {
        hoverCell = null;
        isPointerDown = false;
        hasDragged = false;
        return;
      }

      if (kind === "down") {
        isPointerDown = true;
        hasDragged = false;
        pointerDownX = clientX;
        pointerDownY = clientY;
        lastDragX = clientX;
        lastDragY = clientY;
        activeMouseButton = button;
        const cell = sceneMgr.screenToGrid(clientX, clientY);
        hoverCell = cell;
        return;
      }

      if (kind === "move") {
        const cell = sceneMgr.screenToGrid(clientX, clientY);
        hoverCell = cell;

        if (isPointerDown) {
          const dist = Math.hypot(clientX - pointerDownX, clientY - pointerDownY);
          if (dist > 4) {
            hasDragged = true;
            const dx = clientX - lastDragX;
            const dy = clientY - lastDragY;
            if (activeMouseButton === 2 || activeMouseButton === 1) {
              sceneMgr.rotate(-dx * 0.007, -dy * 0.007);
            } else {
              sceneMgr.pan(-dx * 0.04, dy * 0.04);
            }
            lastDragX = clientX;
            lastDragY = clientY;
          }
        }
        return;
      }

      if (kind === "up") {
        const wasDragged = hasDragged;
        isPointerDown = false;
        hasDragged = false;

        if (!wasDragged) {
          // Clean click
          const cell = sceneMgr.screenToGrid(clientX, clientY);
          if (!cell) return;

          const tower = towers.find((item) => item.c === cell.c && item.r === cell.r);
          if (tower) {
            selectedId = tower.id;
            armed = null;
            publish(true);
            return;
          }

          if (armed) {
            tryPlace(cell.c, cell.r);
          } else {
            selectedId = null;
            publish(true);
          }
        }
      }
    },
  };
}
