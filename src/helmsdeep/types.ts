export type ZombieType = "runner" | "shambler" | "brute" | "banshee";

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
    damage: 22,
    rate: 2.5,
    range: 65,
    blurb: "Rapid automated bolts that thin out approaching runners.",
  },
  oil: {
    type: "oil",
    name: "Boiling Pitch Cauldron",
    cost: 160,
    damage: 75,
    rate: 0.6,
    range: 24,
    blurb: "Dumps flaming boiling oil directly onto enemies at the gate.",
  },
  mortar: {
    type: "mortar",
    name: "Deep Wall Catapult",
    cost: 220,
    damage: 140,
    rate: 0.45,
    range: 95,
    blurb: "Lobs heavy explosive brimstone into the center of the valley.",
  },
  ballista: {
    type: "ballista",
    name: "Heavy Harpoon Ballista",
    cost: 280,
    damage: 260,
    rate: 0.55,
    range: 110,
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
};
