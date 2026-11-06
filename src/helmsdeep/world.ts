import * as THREE from "three";

export class HelmsWorld {
  public group: THREE.Group;
  public wallParapetY = 14.0;
  public gateHealth = 1000;
  public maxGateHealth = 1000;
  public gateMesh: THREE.Mesh;
  public turretSockets: Array<{
    id: number;
    name: string;
    pos: THREE.Vector3;
    type: string | null;
    markerMesh?: THREE.Mesh;
  }>;
  public rainParticles: THREE.Points;
  private lightningLight: THREE.DirectionalLight;
  private lightningTimer = 8 + Math.random() * 8;
  private torchLights: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // 1. Clear Twilight Atmosphere (No black fog, clear crisp visibility of the gorge)
    scene.background = new THREE.Color(0x182433);
    scene.fog = new THREE.Fog(0x182433, 90, 240);

    // 2. Bright Multi-Light Rig
    // High ambient fill light so textures, shadows, and enemies are clearly illuminated
    const ambient = new THREE.AmbientLight(0x567294, 2.2);
    scene.add(ambient);

    // Moonlight from high overhead
    const moonlight = new THREE.DirectionalLight(0xdbe9ff, 3.6);
    moonlight.position.set(30, 65, -25);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.width = 2048;
    moonlight.shadow.mapSize.height = 2048;
    moonlight.shadow.camera.near = 5;
    moonlight.shadow.camera.far = 250;
    moonlight.shadow.camera.left = -75;
    moonlight.shadow.camera.right = 75;
    moonlight.shadow.camera.top = 75;
    moonlight.shadow.camera.bottom = -75;
    moonlight.shadow.bias = -0.0003;
    scene.add(moonlight);

    // Valley fill light shining up the road
    const valleyFill = new THREE.DirectionalLight(0x8da7c4, 1.8);
    valleyFill.position.set(-20, 25, -110);
    scene.add(valleyFill);

    // Lightning Flash Light
    this.lightningLight = new THREE.DirectionalLight(0xffffff, 0);
    this.lightningLight.position.set(0, 80, -60);
    scene.add(this.lightningLight);

    // 3. Materials
    const stoneWallMat = new THREE.MeshStandardMaterial({
      color: 0x6e7882, // lighter weathered stone
      roughness: 0.75,
      metalness: 0.1,
    });
    const stoneDarkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x3d444b,
      roughness: 0.85,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x5a5348, // warm dirt/cobblestone
      roughness: 0.85,
    });
    const valleyEarthMat = new THREE.MeshStandardMaterial({
      color: 0x2e3834,
      roughness: 0.95,
    });
    const gateWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3c24,
      roughness: 0.7,
      metalness: 0.2,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.4,
      metalness: 0.85,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93c,
      roughness: 0.3,
      metalness: 0.75,
    });

    // 4. The Deep Wall (Hornburg Ramparts)
    // Wall foundation: depth 8m (Z = -4.5 to +3.5)
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-42, 0);
    wallShape.lineTo(42, 0);
    wallShape.lineTo(42, this.wallParapetY);
    wallShape.lineTo(-42, this.wallParapetY);
    wallShape.lineTo(-42, 0);
    const wallExtrudeSettings = { depth: 8, bevelEnabled: false };
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, wallExtrudeSettings);
    const wall = new THREE.Mesh(wallGeo, stoneWallMat);
    wall.position.set(0, 0, -0.5);
    wall.receiveShadow = true;
    wall.castShadow = true;
    this.group.add(wall);

    // Parapet Walkway floor
    const floorGeo = new THREE.BoxGeometry(84, 0.4, 7);
    const floor = new THREE.Mesh(floorGeo, stoneDarkTrimMat);
    floor.position.set(0, this.wallParapetY + 0.2, -0.5);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Outer crenellations (spaced out, leaving center X = -5 to +5 completely wide open for player view!)
    const crenelGeo = new THREE.BoxGeometry(2.2, 1.2, 0.7);
    for (let x = -38; x <= 38; x += 3.8) {
      if (Math.abs(x) < 5.5) continue; // Completely clear center gap!
      const crenel = new THREE.Mesh(crenelGeo, stoneDarkTrimMat);
      crenel.position.set(x, this.wallParapetY + 0.6, -4.2);
      crenel.castShadow = true;
      crenel.receiveShadow = true;
      this.group.add(crenel);
    }

    // Rear wall safety barrier
    const rearParapet = new THREE.Mesh(new THREE.BoxGeometry(84, 1.2, 0.6), stoneDarkTrimMat);
    rearParapet.position.set(0, this.wallParapetY + 0.6, 3.2);
    this.group.add(rearParapet);

    // 5. Left & Right Gatehouse Towers (Bastions at the gatehouse Z = -16)
    const towerGeo = new THREE.BoxGeometry(6.5, this.wallParapetY + 4, 8);
    const leftTower = new THREE.Mesh(towerGeo, stoneDarkTrimMat);
    leftTower.position.set(-8.0, (this.wallParapetY + 4) / 2, -16.0);
    leftTower.castShadow = true;
    leftTower.receiveShadow = true;
    this.group.add(leftTower);

    const rightTower = new THREE.Mesh(towerGeo, stoneDarkTrimMat);
    rightTower.position.set(8.0, (this.wallParapetY + 4) / 2, -16.0);
    rightTower.castShadow = true;
    rightTower.receiveShadow = true;
    this.group.add(rightTower);

    // Stone Causeway ramp linking the Deep Wall to the Gatehouse
    const causewayGeo = new THREE.BoxGeometry(10, 2.5, 12);
    const causeway = new THREE.Mesh(causewayGeo, stoneWallMat);
    causeway.position.set(0, 1.25, -10.0);
    causeway.receiveShadow = true;
    causeway.castShadow = true;
    this.group.add(causeway);

    // 6. The Massive Gatehouse Door (At Z = -16.0 - completely visible from battlements!)
    const gateGeo = new THREE.BoxGeometry(8.5, 8.5, 0.9);
    this.gateMesh = new THREE.Mesh(gateGeo, gateWoodMat);
    this.gateMesh.position.set(0, 4.25, -16.0);
    this.gateMesh.castShadow = true;
    this.gateMesh.receiveShadow = true;
    this.group.add(this.gateMesh);

    // Iron reinforcement straps on the gate
    for (const gy of [1.8, 4.25, 6.8]) {
      const ironBand = new THREE.Mesh(new THREE.BoxGeometry(8.7, 0.45, 1.1), ironMat);
      ironBand.position.set(0, gy, -16.0);
      this.group.add(ironBand);
    }

    // 7. Valley Floor & Approach Road
    // Ground extends from Z = 0 right up against the wall to Z = -200
    const valleyGeo = new THREE.PlaneGeometry(110, 200, 24, 48);
    valleyGeo.rotateX(-Math.PI / 2);
    const valleyPos = valleyGeo.attributes.position;
    for (let i = 0; i < valleyPos.count; i++) {
      const x = valleyPos.getX(i);
      const z = valleyPos.getZ(i);
      const distFromCenter = Math.abs(x);
      let y = 0;
      if (distFromCenter > 13) {
        y = Math.pow((distFromCenter - 13) / 25, 2) * 14;
      }
      valleyPos.setY(i, y);
    }
    valleyGeo.computeVertexNormals();

    const valley = new THREE.Mesh(valleyGeo, valleyEarthMat);
    valley.position.set(0, 0, -100);
    valley.receiveShadow = true;
    this.group.add(valley);

    // Cobblestone Approach Road leading from deep valley (Z = -190) directly to the gate (Z = -4.6)
    const roadGeo = new THREE.PlaneGeometry(16, 190, 8, 32);
    roadGeo.rotateX(-Math.PI / 2);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, 0.08, -99.6);
    road.receiveShadow = true;
    this.group.add(road);

    // Flanking Canyon Cliffs
    const cliffGeo = new THREE.BoxGeometry(32, 50, 200);
    const leftCliff = new THREE.Mesh(cliffGeo, stoneDarkTrimMat);
    leftCliff.position.set(-54, 22, -100);
    leftCliff.receiveShadow = true;
    this.group.add(leftCliff);

    const rightCliff = new THREE.Mesh(cliffGeo, stoneDarkTrimMat);
    rightCliff.position.set(54, 22, -100);
    rightCliff.receiveShadow = true;
    this.group.add(rightCliff);

    // Gate Front Spotlight: Illuminates enemies charging the gate from the battlements!
    const gateSpot = new THREE.SpotLight(0xffb855, 6.5, 60, Math.PI / 3.5, 0.4);
    gateSpot.position.set(0, this.wallParapetY + 2, -4);
    gateSpot.target.position.set(0, 0, -18);
    this.group.add(gateSpot);
    this.group.add(gateSpot.target);

    // 8. Torches & Braziers (Bright Warm Lighting)
    const brazierGeo = new THREE.CylinderGeometry(0.5, 0.35, 0.6, 6);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });

    const torchLocations = [
      // Wall Torches
      { x: -30, z: -3.5 },
      { x: -14, z: -3.5 },
      { x: 14, z: -3.5 },
      { x: 30, z: -3.5 },
      // Roadside Torches lighting up oncoming enemies!
      { x: -9, z: -15 },
      { x: 9, z: -15 },
      { x: -9, z: -40 },
      { x: 9, z: -40 },
      { x: -9, z: -70 },
      { x: 9, z: -70 },
      { x: -9, z: -105 },
      { x: 9, z: -105 },
    ];

    for (const t of torchLocations) {
      const isWall = t.z > -10;
      const y = isWall ? this.wallParapetY + 0.35 : 1.2;

      const brazier = new THREE.Mesh(brazierGeo, ironMat);
      brazier.position.set(t.x, y, t.z);
      this.group.add(brazier);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 6), flameMat);
      flame.position.set(t.x, y + 0.55, t.z);
      this.group.add(flame);

      const light = new THREE.PointLight(0xff8833, isWall ? 4.0 : 5.0, isWall ? 20 : 32);
      light.position.set(t.x, y + 1.2, t.z);
      this.group.add(light);
      this.torchLights.push(light);
    }

    // 9. 5 Turret Sockets (Positioned on Left & Right so Player's Center View is 100% UNBLOCKED!)
    this.turretSockets = [
      { id: 0, name: "Far West Rampart", pos: new THREE.Vector3(-25, this.wallParapetY + 0.2, -1.5), type: null },
      { id: 1, name: "West Gate Bastion", pos: new THREE.Vector3(-9.5, this.wallParapetY + 4.2, -1.0), type: null },
      { id: 2, name: "East Gate Bastion", pos: new THREE.Vector3(9.5, this.wallParapetY + 4.2, -1.0), type: null },
      { id: 3, name: "Far East Rampart", pos: new THREE.Vector3(25, this.wallParapetY + 0.2, -1.5), type: null },
      { id: 4, name: "Inner West Barbican", pos: new THREE.Vector3(-17, this.wallParapetY + 0.2, -1.5), type: null },
    ];

    // Brass Socket Discs with runic rings
    const discGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16);
    for (const s of this.turretSockets) {
      const disc = new THREE.Mesh(discGeo, brassMat);
      disc.position.copy(s.pos);
      this.group.add(disc);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.1, 1.45, 16),
        new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.pos.x, s.pos.y + 0.12, s.pos.z);
      this.group.add(ring);
      s.markerMesh = ring;
    }

    // 10. Atmospheric Rain
    const rainCount = 1200;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3 + 0] = (Math.random() - 0.5) * 90;
      rainPos[i * 3 + 1] = Math.random() * 45;
      rainPos[i * 3 + 2] = -Math.random() * 150 + 10;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x9bc0e6,
      size: 0.35,
      transparent: true,
      opacity: 0.4,
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.group.add(this.rainParticles);
  }

  public update(dt: number) {
    const pos = this.rainParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - 65 * dt;
      let z = pos.getZ(i) + 12 * dt;
      if (y < 0) {
        y = 42 + Math.random() * 6;
        z = -Math.random() * 150 + 10;
      }
      pos.setY(i, y);
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;

    // Torch flicker
    const time = performance.now() * 0.005;
    for (let i = 0; i < this.torchLights.length; i++) {
      const flicker = Math.sin(time + i * 1.5) * 0.4;
      this.torchLights[i].intensity = (i < 4 ? 4.0 : 5.0) + flicker;
    }

    // Lightning Flash
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 5.5;
      this.lightningTimer = 8 + Math.random() * 10;
    }
    if (this.lightningLight.intensity > 0.05) {
      this.lightningLight.intensity *= Math.exp(-dt * 12);
    } else {
      this.lightningLight.intensity = 0;
    }
  }

  public damageGate(amount: number) {
    this.gateHealth = Math.max(0, this.gateHealth - amount);
    if (this.gateMesh) {
      this.gateMesh.position.z = -16.0 + (Math.random() - 0.5) * 0.2;
    }
  }

  public repairGate(amount: number) {
    this.gateHealth = Math.min(this.maxGateHealth, this.gateHealth + amount);
  }
}
