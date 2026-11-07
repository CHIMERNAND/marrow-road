export type ZombieType =
  | "runner"
  | "shambler"
  | "brute"
  | "banshee"
  | "warlord"
  | "sapper";

export type BoltAmmoType = "bodkin" | "fire" | "frost" | "scatter";

export type BoltAmmoSpec = {
  type: BoltAmmoType;
  name: string;
  hotkey: string;
  desc: string;
  color: string;
};

export const BOLT_AMMO_SPECS: Record<BoltAmmoType, BoltAmmoSpec> = {
  bodkin: {
    type: "bodkin",
    name: "Bodkin Piercer",
    hotkey: "Q",
    desc: "High-velocity steel quarrel. 3x headshot crit & pierces multiple ranks.",
    color: "#fbbf24",
  },
  fire: {
    type: "fire",
    name: "Dragonfire Pitch",
    hotkey: "Q",
    desc: "Explodes on impact in a 4m fireball and ignites enemies for 5s.",
    color: "#f97316",
  },
  frost: {
    type: "frost",
    name: "Frostbite Runic",
    hotkey: "Q",
    desc: "Freezes and slows enemies by 55% for 4.5s. Shatters on headshot.",
    color: "#38bdf8",
  },
  scatter: {
    type: "scatter",
    name: "Triple Broadhead",
    hotkey: "Q",
    desc: "Looses 3 heavy broadhead bolts in a horizontal spread.",
    color: "#a855f7",
  },
};

export type TurretType = "repeater" | "oil" | "mortar" | "ballista";

export type TurretSpec = {
  type: TurretType;
  name: string;
  cost: number;
  damage: number;
  rate: number;
  range: number;
  blurb: string;
};

export const TURRET_SPECS: Record<TurretType, TurretSpec> = {
  repeater: {
    type: "repeater",
    name: "Wall Crossbow",
    cost: 100,
    damage: 24,
    rate: 2.6,
    range: 70,
    blurb: "Rapid automated bolts that thin out approaching runners.",
  },
  oil: {
    type: "oil",
    name: "Boiling Pitch Cauldron",
    cost: 160,
    damage: 80,
    rate: 0.65,
    range: 26,
    blurb: "Dumps flaming boiling oil directly onto enemies at the gate.",
  },
  mortar: {
    type: "mortar",
    name: "Deep Wall Catapult",
    cost: 220,
    damage: 155,
    rate: 0.48,
    range: 105,
    blurb: "Lobs heavy explosive brimstone into the center of the valley.",
  },
  ballista: {
    type: "ballista",
    name: "Heavy Harpoon Ballista",
    cost: 280,
    damage: 280,
    rate: 0.6,
    range: 120,
    blurb: "High-caliber harpoons that pierce through armored Brutes.",
  },
};

export type PlayerWeaponStats = {
  damage: number;
  critMul: number;
  fireRate: number;
  arrowSpeed: number;
  pierce: number;
  explosiveRadius: number;
  weaponLevel?: number;
};

export type CombatCallout = {
  id: number;
  text: string;
  subtext?: string;
  color: "gold" | "red" | "cyan" | "orange" | "purple";
};

export type FloatingDamage = {
  id: number;
  x: number; // Normalized 0..100 screen percentage
  y: number; // Normalized 0..100 screen percentage
  text: string;
  isCrit: boolean;
  color: string;
};

export type ReticleTargetInfo = {
  label: string;
  distance: number;
  hp?: number;
  maxHp?: number;
  isHazard?: boolean;
};
