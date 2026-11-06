import type { EnemyId, TargetMode, TowerId } from "@/game/data";

export const TILE_SIZE = 2.5;
export const GRID_COLS = 8;
export const GRID_ROWS = 12;

export function gridToWorld(c: number, r: number): { x: number; y: number; z: number } {
  return {
    x: (c - (GRID_COLS - 1) / 2) * TILE_SIZE,
    y: 0,
    z: (r - (GRID_ROWS - 1) / 2) * TILE_SIZE,
  };
}

export function worldToGrid(x: number, z: number): { c: number; r: number } | null {
  const c = Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2);
  const r = Math.round(z / TILE_SIZE + (GRID_ROWS - 1) / 2);
  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return null;
  return { c, r };
}

export function simToWorld(simX: number, simY: number, cellPixels: number = 64): { x: number; y: number; z: number } {
  const c = simX / cellPixels - 0.5;
  const r = simY / cellPixels - 0.5;
  return {
    x: (c - (GRID_COLS - 1) / 2) * TILE_SIZE,
    y: 0,
    z: (r - (GRID_ROWS - 1) / 2) * TILE_SIZE,
  };
}

export type Enemy3DState = {
  id: number;
  type: EnemyId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  armor: number;
  slow: number;
  flash: number;
  speed: number;
  angle: number;
};

export type Tower3DState = {
  id: number;
  type: TowerId;
  c: number;
  r: number;
  dmgRank: number;
  rateRank: number;
  angle: number;
  target: TargetMode;
  pulse: number;
};

export type Shot3DState = {
  id: string;
  kind: "flame" | "bolt" | "shell";
  sx: number;
  sy: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  progress: number;
  damage: number;
  splash: number;
};
