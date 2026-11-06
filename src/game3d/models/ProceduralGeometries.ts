import * as THREE from "three";
import type { EnemyId, TowerId } from "@/game/data";

// Shared Materials & Palettes
export const PALETTE = {
  bone: 0xf2ece2,
  boneDark: 0xb5ad9e,
  stone: 0x646c75,
  stoneDark: 0x3d434a,
  stoneMoss: 0x485c50,
  iron: 0x3a4047,
  ironDark: 0x22262b,
  brass: 0xd4b25e,
  bronze: 0xa88746,
  woodDark: 0x4a3c32,
  glowFlame: 0xff7722,
  glowSoul: 0x38e8ff,
  glowNecro: 0x66ff44,
  glowBlood: 0xff3333,
  clothDark: 0x2e3542,
};

// Reusable standard materials
export const materials = {
  stone: new THREE.MeshStandardMaterial({ color: PALETTE.stone, roughness: 0.75, metalness: 0.1 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: PALETTE.stoneDark, roughness: 0.8, metalness: 0.1 }),
  stoneMoss: new THREE.MeshStandardMaterial({ color: PALETTE.stoneMoss, roughness: 0.85, metalness: 0.05 }),
  bone: new THREE.MeshStandardMaterial({ color: PALETTE.bone, roughness: 0.5, metalness: 0.1 }),
  boneDark: new THREE.MeshStandardMaterial({ color: PALETTE.boneDark, roughness: 0.6, metalness: 0.1 }),
  iron: new THREE.MeshStandardMaterial({ color: PALETTE.iron, roughness: 0.35, metalness: 0.8 }),
  ironDark: new THREE.MeshStandardMaterial({ color: PALETTE.ironDark, roughness: 0.5, metalness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.3, metalness: 0.7 }),
  bronze: new THREE.MeshStandardMaterial({ color: PALETTE.bronze, roughness: 0.45, metalness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: PALETTE.woodDark, roughness: 0.8, metalness: 0.0 }),
  cloth: new THREE.MeshStandardMaterial({ color: PALETTE.clothDark, roughness: 0.85, metalness: 0.0 }),
  flameGlow: new THREE.MeshBasicMaterial({ color: PALETTE.glowFlame }),
  soulGlow: new THREE.MeshBasicMaterial({ color: PALETTE.glowSoul }),
  necroGlow: new THREE.MeshBasicMaterial({ color: PALETTE.glowNecro }),
  bloodGlow: new THREE.MeshBasicMaterial({ color: PALETTE.glowBlood }),
};

/* -------------------------------------------------------------
 * TOWERS
 * ----------------------------------------------------------- */

export function createTowerModel(type: TowerId): {
  root: THREE.Group;
  turret?: THREE.Group;
  animTarget?: THREE.Object3D;
  flameMesh?: THREE.Mesh;
} {
  const root = new THREE.Group();
  root.name = `tower_${type}`;

  // Common circular stone dais
  const daisGeo = new THREE.CylinderGeometry(0.9, 1.05, 0.2, 8);
  const dais = new THREE.Mesh(daisGeo, materials.stoneDark);
  dais.position.y = 0.1;
  dais.castShadow = true;
  dais.receiveShadow = true;
  root.add(dais);

  // Decorative ring
  const ringGeo = new THREE.TorusGeometry(0.85, 0.05, 6, 12);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, materials.iron);
  ring.position.y = 0.21;
  root.add(ring);

  switch (type) {
    case "wick": {
      // Iron tripod brazier with glowing lantern
      const legGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 5);
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(legGeo, materials.iron);
        const ang = (i * Math.PI * 2) / 3;
        leg.position.set(Math.cos(ang) * 0.45, 0.6, Math.sin(ang) * 0.45);
        leg.rotation.z = Math.sin(ang) * 0.25;
        leg.rotation.x = -Math.cos(ang) * 0.25;
        leg.castShadow = true;
        root.add(leg);
      }

      // Brazier basket
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.35, 6), materials.ironDark);
      basket.position.y = 1.15;
      basket.castShadow = true;
      root.add(basket);

      // Rotating glowing flame cage (turret)
      const turret = new THREE.Group();
      turret.position.y = 1.35;

      const flameGeo = new THREE.ConeGeometry(0.2, 0.5, 5);
      flameGeo.rotateX(Math.PI);
      const flame = new THREE.Mesh(flameGeo, materials.flameGlow);
      flame.position.y = 0.15;
      turret.add(flame);

      const cageGeo = new THREE.IcosahedronGeometry(0.3, 0);
      const cage = new THREE.Mesh(cageGeo, materials.brass);
      cage.scale.set(0.9, 1.2, 0.9);
      turret.add(cage);

      root.add(turret);
      return { root, turret, flameMesh: flame };
    }

    case "ashbow": {
      // Skeletal ballista
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 6), materials.stone);
      post.position.y = 0.5;
      post.castShadow = true;
      root.add(post);

      const turret = new THREE.Group();
      turret.position.y = 0.95;

      // Ballista body / stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 1.1), materials.wood);
      stock.position.set(0, 0, 0.15);
      stock.castShadow = true;
      turret.add(stock);

      // Rib bow limbs
      const limbGeo = new THREE.TorusGeometry(0.55, 0.05, 4, 10, Math.PI * 0.85);
      limbGeo.rotateX(Math.PI / 2);
      limbGeo.rotateZ(Math.PI * 0.57);
      const bow = new THREE.Mesh(limbGeo, materials.bone);
      bow.position.set(0, 0.05, -0.3);
      bow.castShadow = true;
      turret.add(bow);

      // Ethereal bone arrow on top
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), materials.boneDark);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(0, 0.14, -0.1);
      turret.add(bolt);

      root.add(turret);
      return { root, turret, animTarget: stock };
    }

    case "pyre": {
      // Crypt gargoyle mortar
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.9), materials.stoneDark);
      base.position.y = 0.35;
      base.castShadow = true;
      root.add(base);

      // Corner skulls
      const skullGeo = new THREE.DodecahedronGeometry(0.12, 0);
      for (let sx of [-0.35, 0.35]) {
        for (let sz of [-0.35, 0.35]) {
          const sk = new THREE.Mesh(skullGeo, materials.bone);
          sk.position.set(sx, 0.55, sz);
          sk.castShadow = true;
          root.add(sk);
        }
      }

      const turret = new THREE.Group();
      turret.position.y = 0.6;

      // Mortar cannon barrel angled up ~45 deg
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.85, 7), materials.iron);
      barrel.rotation.x = Math.PI / 3.5;
      barrel.position.set(0, 0.25, 0.1);
      barrel.castShadow = true;
      turret.add(barrel);

      // Inside magma glow
      const magma = new THREE.Mesh(new THREE.CircleGeometry(0.24, 7), materials.flameGlow);
      magma.rotation.x = -Math.PI / 3.5 - Math.PI / 2;
      magma.position.set(0, 0.55, -0.1);
      turret.add(magma);

      root.add(turret);
      return { root, turret, animTarget: barrel };
    }

    case "dirge": {
      // Cathedral belltower archway suspending a swinging cracked bell
      const pillarGeo = new THREE.BoxGeometry(0.18, 1.4, 0.22);
      const leftPillar = new THREE.Mesh(pillarGeo, materials.stoneDark);
      leftPillar.position.set(-0.55, 0.8, 0);
      leftPillar.castShadow = true;
      root.add(leftPillar);

      const rightPillar = new THREE.Mesh(pillarGeo, materials.stoneDark);
      rightPillar.position.set(0.55, 0.8, 0);
      rightPillar.castShadow = true;
      root.add(rightPillar);

      // Arch top
      const arch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.28), materials.stoneDark);
      arch.position.set(0, 1.5, 0);
      arch.castShadow = true;
      root.add(arch);

      // Center cross on arch
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), materials.iron);
      crossV.position.set(0, 1.72, 0);
      root.add(crossV);

      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.08), materials.iron);
      crossH.position.set(0, 1.76, 0);
      root.add(crossH);

      // Bell pivot (animTarget)
      const bellPivot = new THREE.Group();
      bellPivot.position.set(0, 1.35, 0);

      // Bell geometry
      const bellGeo = new THREE.CylinderGeometry(0.18, 0.42, 0.65, 8, 1, true);
      const bell = new THREE.Mesh(bellGeo, materials.bronze);
      bell.position.y = -0.32;
      bell.castShadow = true;
      bellPivot.add(bell);

      // Clapper
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 5), materials.iron);
      clapper.position.y = -0.6;
      bellPivot.add(clapper);

      // Spectral rune aura ring under the bell
      const aura = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 12), materials.soulGlow);
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = -0.62;
      bellPivot.add(aura);

      root.add(bellPivot);
      return { root, animTarget: bellPivot };
    }
  }
}

/* -------------------------------------------------------------
 * ENEMIES
 * ----------------------------------------------------------- */

export function createEnemyModel(type: EnemyId): {
  root: THREE.Group;
  limbs: THREE.Object3D[];
  head?: THREE.Object3D;
  aura?: THREE.Object3D;
} {
  const root = new THREE.Group();
  root.name = `enemy_${type}`;
  const limbs: THREE.Object3D[] = [];

  switch (type) {
    case "shambler": {
      // Hunched undead ghoul
      const body = new THREE.Group();
      body.position.y = 0.55;

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.22), materials.boneDark);
      torso.rotation.x = 0.25; // hunched forward
      torso.castShadow = true;
      body.add(torso);

      // Head with glowing eye sockets
      const head = new THREE.Group();
      head.position.set(0, 0.38, 0.12);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), materials.bone);
      skull.castShadow = true;
      head.add(skull);

      const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
      const eyeL = new THREE.Mesh(eyeGeo, materials.bloodGlow);
      eyeL.position.set(-0.06, 0.02, 0.13);
      const eyeR = new THREE.Mesh(eyeGeo, materials.bloodGlow);
      eyeR.position.set(0.06, 0.02, 0.13);
      head.add(eyeL, eyeR);
      body.add(head);

      // Reaching Arms
      const armGeo = new THREE.BoxGeometry(0.1, 0.45, 0.1);
      const armL = new THREE.Mesh(armGeo, materials.boneDark);
      armL.position.set(-0.25, 0.1, 0.15);
      armL.rotation.x = -Math.PI / 4;
      body.add(armL);
      limbs.push(armL);

      const armR = new THREE.Mesh(armGeo, materials.boneDark);
      armR.position.set(0.25, 0.1, 0.15);
      armR.rotation.x = -Math.PI / 3;
      body.add(armR);
      limbs.push(armR);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.12, 0.45, 0.12);
      const legL = new THREE.Mesh(legGeo, materials.boneDark);
      legL.position.set(-0.12, 0.22, 0);
      root.add(legL);
      limbs.push(legL);

      const legR = new THREE.Mesh(legGeo, materials.boneDark);
      legR.position.set(0.12, 0.22, 0);
      root.add(legR);
      limbs.push(legR);

      root.add(body);
      return { root, limbs, head };
    }

    case "runner": {
      // Four-legged bone hound / shadow beast
      const spine = new THREE.Group();
      spine.position.y = 0.38;

      // Ribcage torso
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.65), materials.bone);
      rib.castShadow = true;
      spine.add(rib);

      // Beast head
      const head = new THREE.Group();
      head.position.set(0, 0.08, 0.38);
      const snout = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 4), materials.boneDark);
      snout.rotation.x = Math.PI / 2;
      head.add(snout);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), materials.flameGlow);
      eye.position.set(-0.06, 0.06, 0.1);
      const eye2 = eye.clone();
      eye2.position.x = 0.06;
      head.add(eye, eye2);
      spine.add(head);

      // 4 Running limbs
      const limbGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
      const pos = [
        [-0.18, 0.18, 0.2],
        [0.18, 0.18, 0.2],
        [-0.18, 0.18, -0.2],
        [0.18, 0.18, -0.2],
      ];
      for (const [lx, ly, lz] of pos) {
        const leg = new THREE.Mesh(limbGeo, materials.boneDark);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        root.add(leg);
        limbs.push(leg);
      }

      root.add(spine);
      return { root, limbs, head };
    }

    case "brute": {
      // Massive Ossuary Golem made of stacked grave slabs and iron chains
      const rootScale = 1.35;
      root.scale.set(rootScale, rootScale, rootScale);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.45), materials.stoneDark);
      torso.position.y = 0.7;
      torso.castShadow = true;
      root.add(torso);

      // Glowing Necrotic Chest Core
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), materials.necroGlow);
      core.position.set(0, 0.75, 0.24);
      root.add(core);

      // Tombstone shoulder pauldrons
      const pauldronGeo = new THREE.BoxGeometry(0.3, 0.4, 0.35);
      const pL = new THREE.Mesh(pauldronGeo, materials.stone);
      pL.position.set(-0.48, 0.95, 0);
      pL.rotation.z = -0.25;
      pL.castShadow = true;
      root.add(pL);

      const pR = new THREE.Mesh(pauldronGeo, materials.stone);
      pR.position.set(0.48, 0.95, 0);
      pR.rotation.z = 0.25;
      pR.castShadow = true;
      root.add(pR);

      // Giant Stone Club Arms
      const clubGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
      const armL = new THREE.Mesh(clubGeo, materials.stoneDark);
      armL.position.set(-0.48, 0.45, 0.1);
      root.add(armL);
      limbs.push(armL);

      const armR = new THREE.Mesh(clubGeo, materials.stoneDark);
      armR.position.set(0.48, 0.45, 0.1);
      root.add(armR);
      limbs.push(armR);

      // Heavy Stomping Legs
      const legGeo = new THREE.BoxGeometry(0.26, 0.45, 0.26);
      const legL = new THREE.Mesh(legGeo, materials.stone);
      legL.position.set(-0.22, 0.22, 0);
      root.add(legL);
      limbs.push(legL);

      const legR = new THREE.Mesh(legGeo, materials.stone);
      legR.position.set(0.22, 0.22, 0);
      root.add(legR);
      limbs.push(legR);

      return { root, limbs, aura: core };
    }

    case "warden": {
      // Floating horned Lich / Necromancer Boss
      const rootScale = 1.45;
      root.scale.set(rootScale, rootScale, rootScale);

      // Floating Shroud / Robes (no legs)
      const shroud = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 7, 1, true), materials.cloth);
      shroud.position.y = 0.75;
      shroud.castShadow = true;
      root.add(shroud);

      // Horned skull head
      const head = new THREE.Group();
      head.position.set(0, 1.35, 0);

      const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), materials.bone);
      skull.castShadow = true;
      head.add(skull);

      // Giant curving horns
      const hornGeo = new THREE.CylinderGeometry(0.03, 0.08, 0.5, 4);
      const hornL = new THREE.Mesh(hornGeo, materials.boneDark);
      hornL.position.set(-0.22, 0.22, 0);
      hornL.rotation.z = -0.7;
      hornL.rotation.x = -0.2;
      head.add(hornL);

      const hornR = new THREE.Mesh(hornGeo, materials.boneDark);
      hornR.position.set(0.22, 0.22, 0);
      hornR.rotation.z = 0.7;
      hornR.rotation.x = -0.2;
      head.add(hornR);

      // Soul eyes
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 4, 4), materials.soulGlow);
      eyeL.position.set(-0.08, 0.04, 0.2);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.08;
      head.add(eyeL, eyeR);
      root.add(head);

      // Floating soul orbiters / aura
      const aura = new THREE.Group();
      const soulOrbGeo = new THREE.SphereGeometry(0.09, 5, 5);
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        const orb = new THREE.Mesh(soulOrbGeo, materials.soulGlow);
        orb.position.set(Math.cos(ang) * 0.65, 0.9, Math.sin(ang) * 0.65);
        aura.add(orb);
      }
      root.add(aura);

      return { root, limbs, head, aura };
    }
  }
}

/* -------------------------------------------------------------
 * ENVIRONMENT & PROPS
 * ----------------------------------------------------------- */

export function createTombstone(variant: number): THREE.Group {
  const group = new THREE.Group();
  const v = variant % 3;

  if (v === 0) {
    // Cross tombstone
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.1), materials.stone);
    post.position.y = 0.4;
    post.castShadow = true;
    group.add(post);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.1), materials.stone);
    cross.position.y = 0.6;
    cross.castShadow = true;
    group.add(cross);
  } else if (v === 1) {
    // Arched slab
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.6, 6), materials.stoneMoss);
    slab.position.y = 0.3;
    slab.scale.set(1, 1, 0.35);
    slab.castShadow = true;
    group.add(slab);
  } else {
    // Ancient cracked obelisk
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.9, 4), materials.stoneDark);
    obelisk.position.y = 0.45;
    obelisk.castShadow = true;
    group.add(obelisk);
  }

  // Slight crooked tilt
  group.rotation.z = (Math.random() - 0.5) * 0.18;
  group.rotation.x = (Math.random() - 0.5) * 0.18;
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

export function createDeadTree(): THREE.Group {
  const tree = new THREE.Group();
  // Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.26, 1.8, 5), materials.wood);
  trunk.position.y = 0.9;
  trunk.rotation.z = 0.1;
  trunk.castShadow = true;
  tree.add(trunk);

  // Twisted branches
  const branchGeo = new THREE.CylinderGeometry(0.05, 0.1, 0.8, 4);
  const b1 = new THREE.Mesh(branchGeo, materials.wood);
  b1.position.set(-0.25, 1.4, 0.1);
  b1.rotation.set(0.3, 0, 0.7);
  b1.castShadow = true;
  tree.add(b1);

  const b2 = new THREE.Mesh(branchGeo, materials.wood);
  b2.position.set(0.25, 1.5, -0.1);
  b2.rotation.set(-0.4, 0.2, -0.8);
  b2.castShadow = true;
  tree.add(b2);

  return tree;
}

export function createChapel(): THREE.Group {
  const chapel = new THREE.Group();
  chapel.name = "gothic_chapel";

  // Main hall
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 2.2), materials.stone);
  hall.position.y = 0.7;
  hall.castShadow = true;
  hall.receiveShadow = true;
  chapel.add(hall);

  // Pitched roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), materials.stoneDark);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.85;
  roof.scale.set(1.2, 1, 1.5);
  roof.castShadow = true;
  chapel.add(roof);

  // Steeple tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), materials.stoneDark);
  tower.position.set(0, 1.5, 0.8);
  tower.castShadow = true;
  chapel.add(tower);

  // Spire cone
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), materials.iron);
  spire.position.set(0, 3.2, 0.8);
  spire.castShadow = true;
  chapel.add(spire);

  // Golden cross atop spire
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), materials.brass);
  cross.position.set(0, 4.0, 0.8);
  chapel.add(cross);

  // Glowing stained glass rose window
  const windowGlow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), materials.flameGlow);
  windowGlow.position.set(0, 1.6, -1.11);
  windowGlow.rotation.y = Math.PI;
  chapel.add(windowGlow);

  return chapel;
}

export function createCryptGate(): THREE.Group {
  const gate = new THREE.Group();
  gate.name = "crypt_gate";

  // Left & Right Gothic Pillars
  const pillarGeo = new THREE.BoxGeometry(0.35, 1.8, 0.35);
  const pL = new THREE.Mesh(pillarGeo, materials.stoneDark);
  pL.position.set(-0.85, 0.9, 0);
  pL.castShadow = true;
  gate.add(pL);

  const pR = new THREE.Mesh(pillarGeo, materials.stoneDark);
  pR.position.set(0.85, 0.9, 0);
  pR.castShadow = true;
  gate.add(pR);

  // Gargoyles on pillars
  const gargoyleGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const gL = new THREE.Mesh(gargoyleGeo, materials.stone);
  gL.position.set(-0.85, 1.9, 0);
  gate.add(gL);

  const gR = new THREE.Mesh(gargoyleGeo, materials.stone);
  gR.position.set(0.85, 1.9, 0);
  gate.add(gR);

  // Arch Beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 0.4), materials.stoneDark);
  beam.position.set(0, 1.75, 0);
  beam.castShadow = true;
  gate.add(beam);

  // Iron spiked portcullis bars
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 4);
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(barGeo, materials.iron);
    bar.position.set(i * 0.2, 0.85, 0);
    bar.castShadow = true;
    gate.add(bar);
  }

  // Eerie portal mist glow
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), materials.necroGlow);
  mist.position.set(0, 0.8, -0.05);
  gate.add(mist);

  return gate;
}

/* -------------------------------------------------------------
 * WATCHTOWER BATTLEMENT (Flanking Fortress & Sentry Perch)
 * ----------------------------------------------------------- */

export function createWatchtowerBattlement(): {
  group: THREE.Group;
  leftBrazierLight: THREE.PointLight;
  rightBrazierLight: THREE.PointLight;
} {
  const group = new THREE.Group();
  group.name = "watchtower_battlement";

  // Fortress Wall placed well behind the cemetery boundary (Z >= 17.5)
  const wallGeo = new THREE.BoxGeometry(26, 4.5, 3.5);
  const wall = new THREE.Mesh(wallGeo, materials.stoneDark);
  wall.position.set(0, 2.25, 18.5);
  wall.receiveShadow = true;
  wall.castShadow = true;
  group.add(wall);

  // Left Flanking Watchtower
  const towerGeo = new THREE.BoxGeometry(4.0, 14, 4.0);
  const leftTower = new THREE.Mesh(towerGeo, materials.stone);
  leftTower.position.set(-11.5, 7.0, 18.5);
  leftTower.castShadow = true;
  leftTower.receiveShadow = true;
  group.add(leftTower);

  // Left Tower Spire / Roof
  const roofGeo = new THREE.ConeGeometry(2.8, 4.5, 4);
  roofGeo.rotateY(Math.PI / 4);
  const leftRoof = new THREE.Mesh(roofGeo, materials.ironDark);
  leftRoof.position.set(-11.5, 16.25, 18.5);
  leftRoof.castShadow = true;
  group.add(leftRoof);

  // Right Flanking Watchtower
  const rightTower = new THREE.Mesh(towerGeo, materials.stone);
  rightTower.position.set(11.5, 7.0, 18.5);
  rightTower.castShadow = true;
  rightTower.receiveShadow = true;
  group.add(rightTower);

  const rightRoof = new THREE.Mesh(roofGeo, materials.ironDark);
  rightRoof.position.set(11.5, 16.25, 18.5);
  rightRoof.castShadow = true;
  group.add(rightRoof);

  // Burning Watchtower Braziers on the flanking tower balconies
  const brazierGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.7, 6);
  const flameGeo = new THREE.ConeGeometry(0.4, 0.9, 5);
  flameGeo.rotateX(Math.PI);

  // Left Brazier
  const bL = new THREE.Mesh(brazierGeo, materials.iron);
  bL.position.set(-11.5, 14.5, 16.2);
  const fL = new THREE.Mesh(flameGeo, materials.flameGlow);
  fL.position.set(0, 0.6, 0);
  bL.add(fL);
  group.add(bL);

  const leftBrazierLight = new THREE.PointLight(0xff8833, 4.0, 18);
  leftBrazierLight.position.set(-11.5, 15.5, 16.2);
  group.add(leftBrazierLight);

  // Right Brazier
  const bR = new THREE.Mesh(brazierGeo, materials.iron);
  bR.position.set(11.5, 14.5, 16.2);
  const fR = new THREE.Mesh(flameGeo, materials.flameGlow);
  fR.position.set(0, 0.6, 0);
  bR.add(fR);
  group.add(bR);

  const rightBrazierLight = new THREE.PointLight(0xff8833, 4.0, 18);
  rightBrazierLight.position.set(11.5, 15.5, 16.2);
  group.add(rightBrazierLight);

  return { group, leftBrazierLight, rightBrazierLight };
}
