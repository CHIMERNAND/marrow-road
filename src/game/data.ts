export const COLS = 8;
export const ROWS = 12;
export const CELL = 64;
export const START_GOLD = 180;
export const START_LIVES = 20;
export const PREP_SECONDS = 20;
export const EARLY_BONUS = 10;
export const SELL_REFUND = 0.6;

export const WAYPOINTS: Array<[number, number]> = [
  [0, 0],
  [6, 0],
  [6, 3],
  [1, 3],
  [1, 6],
  [6, 6],
  [6, 9],
  [1, 9],
  [1, 11],
  [7, 11],
];

const DECOR_CANDIDATES: Array<[number, number]> = [
  [2, 1],
  [4, 1],
  [7, 1],
  [3, 1],
  [0, 2],
  [3, 2],
  [5, 2],
  [7, 2],
  [2, 2],
  [2, 4],
  [4, 4],
  [7, 4],
  [0, 4],
  [0, 5],
  [3, 5],
  [5, 5],
  [7, 5],
  [2, 7],
  [4, 7],
  [7, 7],
  [0, 8],
  [3, 8],
  [5, 8],
  [7, 8],
  [4, 8],
  [0, 10],
  [2, 10],
  [4, 10],
  [6, 10],
  [5, 10],
  [3, 11],
  [5, 11],
];

export type TowerId = "wick" | "ashbow" | "pyre" | "dirge";
export type EnemyId = "shambler" | "runner" | "brute" | "warden";
export type TargetMode = "first" | "last" | "near" | "strong";

export type TowerSpec = {
  id: TowerId;
  name: string;
  cost: number;
  range: number;
  damage: number;
  rate: number;
  shot: "flame" | "bolt" | "shell";
  shotSpeed: number;
  splash: number;
  pierce: boolean;
  aura: boolean;
  blurb: string;
  sheet: number;
};

export type EnemySpec = {
  id: EnemyId;
  name: string;
  hp: number;
  speed: number;
  gold: number;
  leak: number;
  armor: number;
  scale: number;
  cols: number;
  rows: number;
};

export type WaveGroup = {
  type: EnemyId;
  count: number;
  interval: number;
  delay?: number;
};

export type Wave = {
  boss?: boolean;
  groups: WaveGroup[];
};

export const TOWERS: Record<TowerId, TowerSpec> = {
  wick: {
    id: "wick",
    name: "Wick",
    cost: 55,
    range: 2.15,
    damage: 9,
    rate: 2.45,
    shot: "flame",
    shotSpeed: 7.2,
    splash: 0,
    pierce: false,
    aura: false,
    blurb: "Fast lantern fire. Short reach. The cheap watch.",
    sheet: 0,
  },
  ashbow: {
    id: "ashbow",
    name: "Ashbow",
    cost: 100,
    range: 3.65,
    damage: 28,
    rate: 0.82,
    shot: "bolt",
    shotSpeed: 13,
    splash: 0,
    pierce: false,
    aura: false,
    blurb: "Long reach, heavy bolts. Armor shrugs them off.",
    sheet: 1,
  },
  pyre: {
    id: "pyre",
    name: "Pyre",
    cost: 165,
    range: 3.25,
    damage: 26,
    rate: 0.46,
    shot: "shell",
    shotSpeed: 3.1,
    splash: 1.2,
    pierce: true,
    aura: false,
    blurb: "A lobbed shell. Splashes. Burns straight through armor.",
    sheet: 2,
  },
  dirge: {
    id: "dirge",
    name: "Dirge",
    cost: 130,
    range: 2.3,
    damage: 6,
    rate: 1.2,
    shot: "flame",
    shotSpeed: 0,
    splash: 2.3,
    pierce: true,
    aura: true,
    blurb: "The bell. Slows the lane and chips every corpse inside.",
    sheet: 3,
  },
};

export const TOWER_LIST: TowerId[] = ["wick", "ashbow", "pyre", "dirge"];

export const ENEMIES: Record<EnemyId, EnemySpec> = {
  shambler: {
    id: "shambler",
    name: "Shambler",
    hp: 46,
    speed: 1.02,
    gold: 7,
    leak: 1,
    armor: 1,
    scale: 0.96,
    cols: 4,
    rows: 4,
  },
  runner: {
    id: "runner",
    name: "Runner",
    hp: 32,
    speed: 1.88,
    gold: 9,
    leak: 1,
    armor: 1,
    scale: 0.88,
    cols: 4,
    rows: 4,
  },
  brute: {
    id: "brute",
    name: "Brute",
    hp: 168,
    speed: 0.5,
    gold: 18,
    leak: 1,
    armor: 0.62,
    scale: 1.16,
    cols: 4,
    rows: 4,
  },
  warden: {
    id: "warden",
    name: "Warden",
    hp: 1400,
    speed: 0.38,
    gold: 100,
    leak: 5,
    armor: 0.7,
    scale: 1.42,
    cols: 2,
    rows: 2,
  },
};

export const WAVES: Wave[] = [
  { groups: [{ type: "shambler", count: 8, interval: 0.9 }] },
  { groups: [{ type: "shambler", count: 12, interval: 0.7 }] },
  {
    groups: [
      { type: "shambler", count: 8, interval: 0.68 },
      { type: "runner", count: 6, interval: 0.5 },
    ],
  },
  { groups: [{ type: "runner", count: 14, interval: 0.4 }] },
  {
    groups: [
      { type: "shambler", count: 10, interval: 0.55 },
      { type: "brute", count: 3, interval: 1.45, delay: 2 },
    ],
  },
  {
    groups: [
      { type: "runner", count: 8, interval: 0.42 },
      { type: "brute", count: 4, interval: 1.25 },
    ],
  },
  {
    groups: [
      { type: "shambler", count: 16, interval: 0.36 },
      { type: "runner", count: 8, interval: 0.36, delay: 1 },
    ],
  },
  { groups: [{ type: "brute", count: 7, interval: 1.05 }] },
  {
    groups: [
      { type: "runner", count: 12, interval: 0.32 },
      { type: "brute", count: 5, interval: 1.05, delay: 1.4 },
    ],
  },
  {
    groups: [
      { type: "shambler", count: 18, interval: 0.3 },
      { type: "brute", count: 6, interval: 0.95 },
    ],
  },
  {
    groups: [
      { type: "runner", count: 14, interval: 0.28 },
      { type: "brute", count: 7, interval: 0.78 },
    ],
  },
  {
    boss: true,
    groups: [
      { type: "shambler", count: 8, interval: 0.42 },
      { type: "warden", count: 1, interval: 1, delay: 5 },
      { type: "runner", count: 8, interval: 0.34, delay: 6.5 },
    ],
  },
];

export const TARGET_ORDER: TargetMode[] = ["first", "last", "near", "strong"];

export const TARGET_LABEL: Record<TargetMode, string> = {
  first: "First",
  last: "Last",
  near: "Nearest",
  strong: "Strongest",
};

export function describeWave(index: number): string {
  const wave = WAVES[index];
  if (!wave) return "";
  const parts = wave.groups.map((group) => {
    const name = ENEMIES[group.type].name;
    const label = group.count === 1 ? name : `${name}s`;
    return `${group.count} ${label}`;
  });
  return parts.join(" · ");
}

export function upgradeCost(base: number, rank: number, kind: "dmg" | "rate"): number {
  const table = kind === "dmg" ? [0.5, 0.9, 1.4] : [0.45, 0.8, 1.25];
  return Math.round(base * (table[rank] ?? table[table.length - 1]));
}

export function damageMul(rank: number): number {
  return 1 + rank * 0.42;
}

export function rateMul(rank: number): number {
  return 1 + rank * 0.3;
}

export type CellKind = "path" | "build" | "decor";

export type MapCell = {
  c: number;
  r: number;
  kind: CellKind;
  prop: number;
};

export type WorldMap = {
  cells: MapCell[];
  path: Set<string>;
  decor: Set<string>;
  points: Array<{ x: number; y: number }>;
  length: number;
};

function key(c: number, r: number): string {
  return `${c},${r}`;
}

export function buildWorld(): WorldMap {
  const path = new Set<string>();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const c = Math.round(a[0] + (b[0] - a[0]) * t);
      const r = Math.round(a[1] + (b[1] - a[1]) * t);
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) path.add(key(c, r));
    }
  }

  const decor = new Set<string>();
  for (const [c, r] of DECOR_CANDIDATES) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
    if (path.has(key(c, r))) continue;
    decor.add(key(c, r));
  }

  const cells: MapCell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = key(c, r);
      let kind: CellKind = "build";
      if (path.has(id)) kind = "path";
      else if (decor.has(id)) kind = "decor";
      cells.push({ c, r, kind, prop: (c * 3 + r * 5) % 9 });
    }
  }

  const points = WAYPOINTS.map(([c, r]) => ({
    x: (c + 0.5) * CELL,
    y: (r + 0.5) * CELL,
  }));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  return { cells, path, decor, points, length };
}
