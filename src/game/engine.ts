import type { Art } from "@/game/assets";
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

export type Phase = "title" | "prep" | "wave" | "victory" | "defeat";

export type HudTower = {
  id: number;
  name: string;
  type: TowerId;
  dmgRank: number;
  rateRank: number;
  dmgCost: number | null;
  rateCost: number | null;
  sell: number;
  target: TargetMode;
  targetLabel: string;
  line: string;
};

export type Hud = {
  phase: Phase;
  lives: number;
  gold: number;
  wave: number;
  waveTotal: number;
  boss: boolean;
  preview: string;
  prepLeft: number;
  kills: number;
  goldEarned: number;
  leaked: number;
  wavesCleared: number;
  best: number;
  speed: 1 | 2;
  muted: boolean;
  armed: TowerId | null;
  selected: HudTower | null;
  toast: string;
};

export type Game = {
  frame: (t: number) => void;
  destroy: () => void;
  start: () => void;
  restart: () => void;
  callWave: () => void;
  arm: (id: TowerId) => void;
  upgrade: (kind: "dmg" | "rate") => void;
  sell: () => void;
  cycleTarget: () => void;
  toggleSpeed: () => void;
  toggleMute: () => void;
  pointer: (clientX: number, clientY: number, kind: "down" | "move" | "leave") => void;
  clear: () => void;
};

const MAP_W = COLS * CELL;
const MAP_H = ROWS * CELL;
const BEST_KEY = "marrow-road-best";
const BONE = "#e8e2d4";
const GOLD = "#c4a35a";
const BLOOD = "#c4503c";
const INK = "#141a16";

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

type Shot = {
  kind: "flame" | "bolt" | "shell";
  x: number;
  y: number;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  age: number;
  dur: number;
  speed: number;
  damage: number;
  splash: number;
  pierce: boolean;
  targetId: number;
  dead: boolean;
};

type Puff = { x: number; y: number; age: number; life: number };
type Floater = { x: number; y: number; text: string; age: number; life: number; gold: boolean };
type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  size: number;
};
type Spawn = { type: EnemyId; time: number };

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

function facingRow(vx: number, vy: number): number {
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 1 : 2;
  return vy >= 0 ? 0 : 3;
}

export function createGame(
  canvas: HTMLCanvasElement,
  art: Art,
  onHud: (hud: Hud) => void,
): Game {
  const ctxOrNull = canvas.getContext("2d");
  if (!ctxOrNull) throw new Error("Canvas is unavailable");
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const audio: GameAudio = createAudio();
  const world = buildWorld();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let phase: Phase = "title";
  let gold = START_GOLD;
  let lives = START_LIVES;
  let waveIndex = 0;
  let wavesCleared = 0;
  let best = readBest();
  let kills = 0;
  let goldEarned = 0;
  let leaked = 0;
  let speed: 1 | 2 = 1;
  let muted = false;
  let armed: TowerId | null = null;
  let selectedId: number | null = null;
  let prepLeft = PREP_SECONDS;
  let waveTime = 0;
  let nextId = 1;
  let toastText = "";
  let toastT = 0;
  let shakeMag = 0;
  let shakeX = 0;
  let shakeY = 0;
  let clock = 0;
  let hudAcc = 0;
  let danger = 0;
  let hover: { c: number; r: number } | null = null;
  let lastT = 0;
  let acc = 0;

  let enemies: Enemy[] = [];
  let towers: Tower[] = [];
  let shots: Shot[] = [];
  let puffs: Puff[] = [];
  let floaters: Floater[] = [];
  let bits: Bit[] = [];
  let spawns: Spawn[] = [];
  let spawnCursor = 0;

  const view = { w: 1, h: 1, dpr: 1, scale: 1, ox: 0, oy: 0 };

  function toast(msg: string) {
    toastText = msg;
    toastT = 1.7;
  }

  function noteBest() {
    if (wavesCleared > best) {
      best = wavesCleared;
      writeBest(best);
    }
  }

  function freshRun() {
    gold = START_GOLD;
    lives = START_LIVES;
    waveIndex = 0;
    wavesCleared = 0;
    kills = 0;
    goldEarned = 0;
    leaked = 0;
    armed = null;
    selectedId = null;
    prepLeft = PREP_SECONDS;
    waveTime = 0;
    enemies = [];
    towers = [];
    shots = [];
    puffs = [];
    floaters = [];
    bits = [];
    spawns = [];
    spawnCursor = 0;
    danger = 0;
  }

  function publish(force = false) {
    if (!force && hudAcc < 0.1) return;
    hudAcc = 0;
    const wave = WAVES[waveIndex];
    const selected = selectedTower();
    onHud({
      phase,
      lives,
      gold,
      wave: waveIndex + 1,
      waveTotal: WAVES.length,
      boss: Boolean(wave?.boss),
      preview: describeWave(waveIndex),
      prepLeft,
      kills,
      goldEarned,
      leaked,
      wavesCleared,
      best,
      speed,
      muted,
      armed,
      selected,
      toast: toastT > 0 ? toastText : "",
    });
  }

  function selectedTower(): HudTower | null {
    const tower = towers.find((item) => item.id === selectedId);
    if (!tower) return null;
    const spec = TOWERS[tower.type];
    const dmg = spec.damage * damageMul(tower.dmgRank);
    const rate = spec.rate * rateMul(tower.rateRank);
    return {
      id: tower.id,
      name: spec.name,
      type: tower.type,
      dmgRank: tower.dmgRank,
      rateRank: tower.rateRank,
      dmgCost: tower.dmgRank >= 3 ? null : upgradeCost(spec.cost, tower.dmgRank, "dmg"),
      rateCost: tower.rateRank >= 3 ? null : upgradeCost(spec.cost, tower.rateRank, "rate"),
      sell: Math.floor(tower.spent * SELL_REFUND),
      target: tower.target,
      targetLabel: TARGET_LABEL[tower.target],
      line: spec.aura
        ? `${dmg.toFixed(0)} in the ring · ${rate.toFixed(1)}/s`
        : `${dmg.toFixed(0)} damage · ${rate.toFixed(1)}/s`,
    };
  }

  function cellFromClient(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - view.ox) / view.scale;
    const y = (clientY - rect.top - view.oy) / view.scale;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return { c, r };
  }

  function cellKind(c: number, r: number) {
    return world.cells[r * COLS + c]?.kind ?? "path";
  }

  function burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      if (bits.length > 140) bits.shift();
      const a = Math.random() * Math.PI * 2;
      const s = 18 + Math.random() * 70;
      bits.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        age: 0,
        life: 0.35 + Math.random() * 0.3,
        color,
        size: 1.5 + Math.random() * 2.4,
      });
    }
  }

  function floater(x: number, y: number, text: string, goldish: boolean) {
    if (floaters.length > 24) floaters.shift();
    floaters.push({ x, y, text, age: 0, life: 0.85, gold: goldish });
  }

  function puff(x: number, y: number) {
    if (puffs.length > 32) puffs.shift();
    puffs.push({ x, y, age: 0, life: 0.28 });
  }

  function hurt(enemy: Enemy, amount: number, pierce: boolean) {
    if (enemy.gone) return;
    const dealt = pierce ? amount : amount * enemy.armor;
    enemy.hp -= dealt;
    enemy.flash = 0.08;
    if (enemy.hp <= 0) {
      enemy.gone = true;
      gold += enemy.gold;
      goldEarned += enemy.gold;
      kills += 1;
      floater(enemy.x, enemy.y - 20, `+${enemy.gold}`, true);
      burst(enemy.x, enemy.y, BONE, enemy.type === "warden" ? 18 : 8);
      puff(enemy.x, enemy.y);
      audio.kill();
    }
  }

  function leak(enemy: Enemy) {
    if (enemy.gone) return;
    enemy.gone = true;
    lives = Math.max(0, lives - enemy.leak);
    leaked += enemy.leak;
    burst(enemy.x, enemy.y, BLOOD, 12);
    shake(enemy.leak > 1 ? 9 : 6);
    audio.leak();
    toast(enemy.leak > 1 ? `The Warden reached the door (−${enemy.leak})` : "One slipped through");
    if (lives <= 0) {
      phase = "defeat";
      noteBest();
      audio.defeat();
      publish(true);
    }
  }

  function makeSpawns(index: number): Spawn[] {
    const wave = WAVES[index];
    const list: Spawn[] = [];
    if (!wave) return list;
    for (const group of wave.groups) {
      let t = group.delay ?? 0;
      for (let i = 0; i < group.count; i++) {
        list.push({ type: group.type, time: t });
        t += group.interval;
      }
    }
    list.sort((a, b) => a.time - b.time);
    return list;
  }

  function spawnEnemy(type: EnemyId) {
    const spec = ENEMIES[type];
    const scale = type === "warden" ? 1 : 1 + waveIndex * 0.085;
    const hp = Math.round(spec.hp * scale);
    const start = world.points[0];
    enemies.push({
      id: nextId++,
      type,
      x: start.x,
      y: start.y,
      vx: 1,
      vy: 0,
      seg: 1,
      dist: 0,
      hp,
      maxHp: hp,
      slow: 0,
      flash: 0,
      gone: false,
      leak: spec.leak,
      gold: type === "warden" ? spec.gold : spec.gold + Math.floor(waveIndex / 2),
      speed: spec.speed * CELL,
      armor: spec.armor,
      scale: spec.scale,
    });
  }

  function predict(enemy: Enemy, time: number) {
    let x = enemy.x;
    let y = enemy.y;
    let seg = enemy.seg;
    let left = time * enemy.speed * (enemy.slow > 0 ? 0.52 : 1);
    while (left > 0 && seg < world.points.length) {
      const point = world.points[seg];
      const dx = point.x - x;
      const dy = point.y - y;
      const len = Math.hypot(dx, dy);
      if (len > left || len < 0.001) {
        if (len < 0.001) break;
        return { x: x + (dx / len) * left, y: y + (dy / len) * left };
      }
      left -= len;
      x = point.x;
      y = point.y;
      seg += 1;
    }
    return { x, y };
  }

  function pickTarget(tower: Tower, rangePx: number): Enemy | null {
    let best: Enemy | null = null;
    let score = -Infinity;
    const range2 = rangePx * rangePx;
    for (const enemy of enemies) {
      if (enemy.gone) continue;
      const d2 = (enemy.x - tower.x) ** 2 + (enemy.y - tower.y) ** 2;
      if (d2 > range2) continue;
      let s = 0;
      if (tower.target === "first") s = enemy.dist;
      else if (tower.target === "last") s = -enemy.dist;
      else if (tower.target === "near") s = -d2;
      else s = enemy.hp;
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
    if (spec.shot === "shell") {
      const travel = Math.max(0.38, Math.hypot(enemy.x - tower.x, enemy.y - tower.y) / (spec.shotSpeed * CELL));
      const dest = predict(enemy, travel);
      shots.push({
        kind: "shell",
        x: tower.x,
        y: tower.y,
        sx: tower.x,
        sy: tower.y,
        dx: dest.x,
        dy: dest.y,
        age: 0,
        dur: travel,
        speed: spec.shotSpeed * CELL,
        damage,
        splash: spec.splash * CELL,
        pierce: true,
        targetId: enemy.id,
        dead: false,
      });
      audio.shot("shell");
    } else {
      shots.push({
        kind: spec.shot,
        x: tower.x,
        y: tower.y - 8,
        sx: tower.x,
        sy: tower.y,
        dx: enemy.x,
        dy: enemy.y,
        age: 0,
        dur: 2.4,
        speed: spec.shotSpeed * CELL,
        damage,
        splash: 0,
        pierce: spec.pierce,
        targetId: enemy.id,
        dead: false,
      });
      audio.shot(spec.shot === "bolt" ? "bolt" : "flame");
    }
    puff(tower.x, tower.y - 10);
  }

  function detonate(shot: Shot, x: number, y: number) {
    shot.dead = true;
    if (shot.splash > 0) {
      for (const enemy of enemies) {
        if (enemy.gone) continue;
        const d = Math.hypot(enemy.x - x, enemy.y - y);
        if (d <= shot.splash) {
          const fall = 1 - 0.4 * (d / shot.splash);
          hurt(enemy, shot.damage * fall, true);
        }
      }
      shake(4);
      audio.hit();
    } else {
      let victim = enemies.find((enemy) => enemy.id === shot.targetId && !enemy.gone);
      if (!victim) {
        let best = 22;
        for (const enemy of enemies) {
          if (enemy.gone) continue;
          const d = Math.hypot(enemy.x - x, enemy.y - y);
          if (d < best) {
            best = d;
            victim = enemy;
          }
        }
      }
      if (victim) {
        hurt(victim, shot.damage, shot.pierce);
        audio.hit();
      }
    }
    puff(x, y);
    burst(x, y, shot.kind === "shell" ? "#e2a15a" : BONE, shot.kind === "shell" ? 10 : 4);
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

  function step(dt: number) {
    toastT = Math.max(0, toastT - dt);
    for (const bit of bits) bit.age += dt;
    bits = bits.filter((bit) => bit.age < bit.life);
    for (const item of floaters) item.age += dt;
    floaters = floaters.filter((item) => item.age < item.life);
    for (const item of puffs) item.age += dt;
    puffs = puffs.filter((item) => item.age < item.life);
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

    danger = 0;
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
      if (enemy.dist / world.length > 0.82) danger = 1;
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

    for (const shot of shots) {
      if (shot.dead) continue;
      if (shot.kind === "shell") {
        shot.age += dt;
        const u = Math.min(1, shot.age / shot.dur);
        shot.x = shot.sx + (shot.dx - shot.sx) * u;
        shot.y = shot.sy + (shot.dy - shot.sy) * u;
        if (u >= 1) detonate(shot, shot.dx, shot.dy);
      } else {
        const target = enemies.find((enemy) => enemy.id === shot.targetId && !enemy.gone);
        if (target) {
          shot.dx = target.x;
          shot.dy = target.y;
        }
        const dx = shot.dx - shot.x;
        const dy = shot.dy - shot.y;
        const len = Math.hypot(dx, dy);
        if (len < 14) detonate(shot, shot.x, shot.y);
        else {
          shot.x += (dx / len) * shot.speed * dt;
          shot.y += (dy / len) * shot.speed * dt;
          shot.age += dt;
          if (shot.age > shot.dur) shot.dead = true;
        }
      }
    }
    shots = shots.filter((shot) => !shot.dead);
    enemies = enemies.filter((enemy) => !enemy.gone);

    if (spawnCursor >= spawns.length && enemies.length === 0 && phase === "wave") {
      finishWave();
    }
  }

  function tryPlace(c: number, r: number) {
    if (!armed) return;
    if (phase === "title" || phase === "victory" || phase === "defeat") return;
    if (cellKind(c, r) !== "build") {
      toast(cellKind(c, r) === "path" ? "The dead own that ground" : "A grave already stands there");
      publish(true);
      return;
    }
    if (towers.some((tower) => tower.c === c && tower.r === r)) {
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
    burst((c + 0.5) * CELL, (r + 0.5) * CELL, GOLD, 6);
    audio.place();
    publish(true);
  }

  function drawFrame(
    img: HTMLImageElement,
    cols: number,
    rows: number,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const fw = img.width / cols;
    const fh = img.height / rows;
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx!.drawImage(img, col * fw, row * fh, fw, fh, x, y, w, h);
  }

  function resize() {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    view.w = cssW;
    view.h = cssH;
    view.dpr = dpr;
    view.scale = Math.min(cssW / MAP_W, cssH / MAP_H);
    view.ox = (cssW - MAP_W * view.scale) / 2;
    view.oy = (cssH - MAP_H * view.scale) / 2;
  }

  function render() {
    resize();
    const { w, h, dpr, scale, ox, oy } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0c1210";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(ox + shakeX, oy + shakeY);
    ctx.scale(scale, scale);

    ctx.drawImage(art.grass, 0, 0, MAP_W, MAP_H);
    const dirtW = art.dirt.width;
    const dirtH = art.dirt.height;
    for (const cell of world.cells) {
      if (cell.kind !== "path") continue;
      const sw = dirtW / COLS;
      const sh = dirtH / ROWS;
      ctx.drawImage(
        art.dirt,
        cell.c * sw,
        cell.r * sh,
        sw + 1,
        sh + 1,
        cell.c * CELL,
        cell.r * CELL,
        CELL + 1,
        CELL + 1,
      );
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(8, 10, 8, 0.35)";
    for (const cell of world.cells) {
      if (cell.kind !== "path") continue;
      const x = cell.c * CELL;
      const y = cell.r * CELL;
      ctx.beginPath();
      if (!world.path.has(`${cell.c},${cell.r - 1}`)) ctx.rect(x, y, CELL, 2);
      if (!world.path.has(`${cell.c},${cell.r + 1}`)) ctx.rect(x, y + CELL - 2, CELL, 2);
      if (!world.path.has(`${cell.c - 1},${cell.r}`)) ctx.rect(x, y, 2, CELL);
      if (!world.path.has(`${cell.c + 1},${cell.r}`)) ctx.rect(x + CELL - 2, y, 2, CELL);
      ctx.fillStyle = "rgba(8, 10, 8, 0.35)";
      ctx.fill();
    }

    if (armed && phase !== "title") {
      const spec = TOWERS[armed];
      for (const cell of world.cells) {
        if (cell.kind !== "build") continue;
        if (towers.some((tower) => tower.c === cell.c && tower.r === cell.r)) continue;
        ctx.fillStyle = "rgba(196, 163, 90, 0.08)";
        ctx.fillRect(cell.c * CELL + 4, cell.r * CELL + 4, CELL - 8, CELL - 8);
      }
      if (hover) {
        const ok = cellKind(hover.c, hover.r) === "build" && !towers.some((t) => t.c === hover!.c && t.r === hover!.r);
        ctx.fillStyle = ok ? "rgba(196, 163, 90, 0.28)" : "rgba(196, 80, 60, 0.32)";
        ctx.fillRect(hover.c * CELL, hover.r * CELL, CELL, CELL);
        const hx = (hover.c + 0.5) * CELL;
        const hy = (hover.r + 0.5) * CELL;
        ctx.beginPath();
        ctx.arc(hx, hy, spec.range * CELL, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(196, 163, 90, 0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(196, 163, 90, 0.7)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    const selected = towers.find((tower) => tower.id === selectedId);
    if (selected) {
      const spec = TOWERS[selected.type];
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, spec.range * CELL, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(196, 163, 90, 0.1)";
      ctx.fill();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    for (const tower of towers) {
      if (TOWERS[tower.type].aura && tower.pulse > 0) {
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, TOWERS[tower.type].range * CELL * (1 - tower.pulse * 0.15), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(196, 163, 90, ${tower.pulse * 0.7})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    type Stamp = { y: number; draw: () => void };
    const stamps: Stamp[] = [];

    stamps.push({
      y: CELL * 0.85,
      draw: () => {
        const size = CELL * 1.35;
        drawFrame(art.gate, 1, 1, 0, CELL * 0.05, CELL * 0.02, size * 0.75, size);
      },
    });
    stamps.push({
      y: MAP_H - 8,
      draw: () => {
        const size = CELL * 1.55;
        drawFrame(art.chapel, 1, 1, 0, MAP_W - size * 0.92, MAP_H - size * 0.96, size, size);
      },
    });

    for (const cell of world.cells) {
      if (cell.kind !== "decor") continue;
      const size = CELL * 0.86;
      const x = cell.c * CELL + (CELL - size) / 2;
      const y = cell.r * CELL + CELL - size + 4;
      stamps.push({
        y: (cell.r + 1) * CELL,
        draw: () => drawFrame(art.props, 3, 3, cell.prop, x, y, size, size),
      });
    }

    for (const tower of towers) {
      const spec = TOWERS[tower.type];
      const size = CELL * (spec.id === "dirge" ? 1.05 : 1.12);
      stamps.push({
        y: tower.y + 10,
        draw: () => {
          ctx.save();
          ctx.translate(tower.x, tower.y + 4);
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.beginPath();
          ctx.ellipse(0, 10, 16, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          if (spec.id !== "dirge") ctx.rotate(tower.angle + Math.PI / 2);
          drawFrame(art.towers, 2, 2, spec.sheet, -size / 2, -size * 0.78, size, size);
          if (tower.dmgRank + tower.rateRank > 0) {
            ctx.fillStyle = GOLD;
            const pips = tower.dmgRank + tower.rateRank;
            for (let i = 0; i < pips; i++) {
              ctx.fillRect(-pips * 3 + i * 6, size * 0.18, 4, 4);
            }
          }
          ctx.restore();
        },
      });
    }

    for (const enemy of enemies) {
      const spec = ENEMIES[enemy.type];
      const row = facingRow(enemy.vx, enemy.vy);
      const frame =
        spec.cols === 4 ? row * 4 + (Math.floor(enemy.dist / (CELL * 0.34)) % 4) : row;
      const size = CELL * enemy.scale * 1.2;
      stamps.push({
        y: enemy.y,
        draw: () => {
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(enemy.x, enemy.y + 2, size * 0.18, size * 0.07, 0, 0, Math.PI * 2);
          ctx.fill();
          if (enemy.slow > 0) ctx.filter = "saturate(0.7) hue-rotate(40deg)";
          if (enemy.flash > 0) ctx.filter = "brightness(1.8)";
          const bob = spec.id === "warden" ? Math.sin(clock * 3 + enemy.id) * 1.5 : 0;
          const sheet =
            spec.id === "shambler"
              ? art.shambler
              : spec.id === "runner"
                ? art.runner
                : spec.id === "brute"
                  ? art.brute
                  : art.warden;
          drawFrame(sheet, spec.cols, spec.rows, frame, enemy.x - size / 2, enemy.y - size + 8 + bob, size, size);
          ctx.filter = "none";
          if (enemy.hp < enemy.maxHp) {
            const bw = spec.id === "warden" ? 46 : 28;
            const ratio = Math.max(0, enemy.hp / enemy.maxHp);
            ctx.fillStyle = INK;
            ctx.fillRect(enemy.x - bw / 2, enemy.y - size - 6, bw, 4);
            ctx.fillStyle = ratio < 0.35 ? BLOOD : GOLD;
            ctx.fillRect(enemy.x - bw / 2, enemy.y - size - 6, bw * ratio, 4);
          }
          ctx.restore();
        },
      });
    }

    stamps.sort((a, b) => a.y - b.y);
    for (const stamp of stamps) stamp.draw();

    for (const shot of shots) {
      if (shot.kind === "shell") {
        const u = Math.min(1, shot.age / shot.dur);
        const lift = Math.sin(u * Math.PI) * 72;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(shot.x, shot.y, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        drawFrame(art.shots, 2, 2, 2, shot.x - 14, shot.y - lift - 14, 28, 28);
      } else if (shot.kind === "bolt") {
        const ang = Math.atan2(shot.dy - shot.y, shot.dx - shot.x);
        ctx.save();
        ctx.translate(shot.x, shot.y);
        ctx.rotate(ang);
        drawFrame(art.shots, 2, 2, 1, -16, -8, 32, 16);
        ctx.restore();
      } else {
        const pulse = 16 + Math.sin(clock * 18) * 2;
        drawFrame(art.shots, 2, 2, 0, shot.x - pulse / 2, shot.y - pulse / 2, pulse, pulse);
      }
    }

    for (const item of puffs) {
      const frame = Math.min(3, Math.floor((item.age / item.life) * 4));
      const size = 36 + item.age * 40;
      ctx.globalAlpha = 1 - item.age / item.life;
      drawFrame(art.impact, 2, 2, frame, item.x - size / 2, item.y - size / 2, size, size);
      ctx.globalAlpha = 1;
    }

    for (const bit of bits) {
      const u = bit.age / bit.life;
      const x = bit.x + bit.vx * bit.age;
      const y = bit.y + bit.vy * bit.age + 40 * bit.age * bit.age;
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = bit.color;
      ctx.fillRect(x, y, bit.size, bit.size);
      ctx.globalAlpha = 1;
    }

    ctx.font = "600 14px Outfit, sans-serif";
    ctx.textAlign = "center";
    for (const item of floaters) {
      const u = item.age / item.life;
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = item.gold ? GOLD : BONE;
      ctx.fillText(item.text, item.x, item.y - u * 28);
      ctx.globalAlpha = 1;
    }

    if (armed && hover && phase !== "title" && phase !== "victory" && phase !== "defeat") {
      const spec = TOWERS[armed];
      const ok =
        cellKind(hover.c, hover.r) === "build" && !towers.some((t) => t.c === hover!.c && t.r === hover!.r);
      ctx.globalAlpha = ok ? 0.8 : 0.45;
      ctx.save();
      ctx.translate((hover.c + 0.5) * CELL, (hover.r + 0.5) * CELL);
      if (spec.id !== "dirge") ctx.rotate(clock * 0.4);
      const size = CELL * 1.05;
      drawFrame(art.towers, 2, 2, spec.sheet, -size / 2, -size * 0.72, size, size);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    if (danger && phase === "wave") {
      ctx.fillStyle = `rgba(196, 80, 60, ${0.05 + 0.06 * (0.5 + 0.5 * Math.sin(clock * 7))})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function shake(n: number) {
    if (reduce) return;
    shakeMag = Math.min(14, shakeMag + n);
  }

  function frame(t: number) {
    if (!lastT) lastT = t;
    const real = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (document.hidden) {
      render();
      return;
    }
    clock += real;
    const rate = phase === "wave" ? speed : 1;
    acc += real * rate;
    let guard = 0;
    while (acc >= 1 / 60 && guard < 6) {
      step(1 / 60);
      acc -= 1 / 60;
      guard += 1;
    }
    if (guard >= 6) acc = 0;
    hudAcc += real;
    if (shakeMag > 0.2) {
      shakeX = (Math.random() * 2 - 1) * shakeMag;
      shakeY = (Math.random() * 2 - 1) * shakeMag;
      shakeMag *= Math.exp(-real * 7);
    } else {
      shakeMag = 0;
      shakeX = 0;
      shakeY = 0;
    }
    render();
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
    pointer(clientX, clientY, kind) {
      if (kind === "leave") {
        hover = null;
        return;
      }
      const cell = cellFromClient(clientX, clientY);
      hover = cell;
      if (kind === "move" || !cell) return;
      const tower = towers.find((item) => item.c === cell.c && item.r === cell.r);
      if (tower) {
        selectedId = tower.id;
        armed = null;
        publish(true);
        return;
      }
      if (armed) tryPlace(cell.c, cell.r);
      else {
        selectedId = null;
        publish(true);
      }
    },
  };
}
