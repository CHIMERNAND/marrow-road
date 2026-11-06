import * as BABYLON from "@babylonjs/core";

export interface TurretSocket {
  id: number;
  name: string;
  pos: BABYLON.Vector3;
  type: string | null;
  ringMat?: BABYLON.StandardMaterial;
}

export class BabylonHelmsWorld {
  public scene: BABYLON.Scene;
  public wallParapetY = 22.0;
  public gateZ = -28.0;
  public gateHealth = 1000;
  public maxGateHealth = 1000;

  public gateLeftDoor!: BABYLON.Mesh;
  public gateRightDoor!: BABYLON.Mesh;
  public turretSockets: TurretSocket[] = [];

  private torchLights: BABYLON.PointLight[] = [];
  private flameMeshes: BABYLON.Mesh[] = [];
  private lightningLight!: BABYLON.DirectionalLight;
  private lightningTimer = 9;
  private rainLines: BABYLON.Mesh[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // 1. Crisp Moonlit Siege Atmosphere
    scene.clearColor = new BABYLON.Color4(0.06, 0.1, 0.17, 1.0);
    scene.ambientColor = new BABYLON.Color3(0.32, 0.38, 0.48);
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = new BABYLON.Color3(0.06, 0.1, 0.17);
    scene.fogStart = 130;
    scene.fogEnd = 250;

    // Subtle Glow Layer for torches, glowing zombie eyes, and fire
    const glow = new BABYLON.GlowLayer("glow", scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 24,
    });
    glow.intensity = 0.45;

    // 2. Balanced Multi-Light Rig (Clear visibility without washing out colors)
    const hemiLight = new BABYLON.HemisphericLight(
      "hemiLight",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    hemiLight.intensity = 0.85;
    hemiLight.diffuse = new BABYLON.Color3(0.68, 0.78, 0.95);
    hemiLight.groundColor = new BABYLON.Color3(0.22, 0.25, 0.3);

    const moonLight = new BABYLON.DirectionalLight(
      "moonLight",
      new BABYLON.Vector3(-0.38, -0.78, 0.48),
      scene,
    );
    moonLight.position = new BABYLON.Vector3(45, 95, -35);
    moonLight.intensity = 1.35;
    moonLight.diffuse = new BABYLON.Color3(0.88, 0.92, 1.0);

    // Gorge Fill Light shining towards the oncoming horde so front faces of zombies are well-lit
    const gorgeLight = new BABYLON.DirectionalLight(
      "gorgeLight",
      new BABYLON.Vector3(0.15, -0.5, -0.85),
      scene,
    );
    gorgeLight.intensity = 0.95;
    gorgeLight.diffuse = new BABYLON.Color3(0.95, 0.82, 0.68);

    // Lightning Flash
    this.lightningLight = new BABYLON.DirectionalLight(
      "lightningLight",
      new BABYLON.Vector3(0, -1, 0.2),
      scene,
    );
    this.lightningLight.intensity = 0;
    this.lightningLight.diffuse = new BABYLON.Color3(0.9, 0.95, 1.0);

    // 3. Procedural Textures (with WRAP_ADDRESSMODE enabled!)
    const stoneTex = this.createStoneTexture("stoneTex", "#687380", "#414952", 6, 3);
    const darkStoneTex = this.createStoneTexture("darkStoneTex", "#49525e", "#2b3138", 5, 3);
    const roadTex = this.createCobbleTexture("roadTex");
    const cliffTex = this.createCraggyRockTexture("cliffTex");

    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture = stoneTex;
    wallMat.specularColor = new BABYLON.Color3(0.12, 0.12, 0.15);

    const trimMat = new BABYLON.StandardMaterial("trimMat", scene);
    trimMat.diffuseTexture = darkStoneTex;
    trimMat.specularColor = new BABYLON.Color3(0.18, 0.18, 0.22);

    const slateRoofMat = new BABYLON.StandardMaterial("slateRoofMat", scene);
    slateRoofMat.diffuseColor = new BABYLON.Color3(0.18, 0.24, 0.32);
    slateRoofMat.specularColor = new BABYLON.Color3(0.25, 0.3, 0.35);

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.42, 0.26, 0.14);
    woodMat.specularColor = new BABYLON.Color3(0.15, 0.1, 0.06);

    const ironMat = new BABYLON.StandardMaterial("ironMat", scene);
    ironMat.diffuseColor = new BABYLON.Color3(0.26, 0.3, 0.35);
    ironMat.specularColor = new BABYLON.Color3(0.6, 0.65, 0.72);
    ironMat.specularPower = 32;

    const brassMat = new BABYLON.StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new BABYLON.Color3(0.85, 0.64, 0.2);
    brassMat.emissiveColor = new BABYLON.Color3(0.15, 0.1, 0.02);
    brassMat.specularColor = new BABYLON.Color3(0.9, 0.8, 0.4);

    const valleyMat = new BABYLON.StandardMaterial("valleyMat", scene);
    valleyMat.diffuseTexture = cliffTex;
    valleyMat.specularColor = new BABYLON.Color3(0.05, 0.06, 0.06);

    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseTexture = roadTex;
    roadMat.specularColor = new BABYLON.Color3(0.18, 0.16, 0.14);

    // 4. Build the Curved & Cylindrical Hornburg Fortress
    this.buildFortress(wallMat, trimMat, slateRoofMat, woodMat, ironMat);

    // 5. Build the Sculpted Canyon Floor, Causeway & Cliffs
    this.buildCanyonAndRoad(valleyMat, roadMat, trimMat);

    // 6. Build Roadside & Battlement Flaming Braziers
    this.buildBraziers(ironMat);

    // 7. Build Turret Emplacement Sockets along the Battlements
    this.buildTurretSockets(brassMat);

    // 8. Atmospheric Rain Streaks
    this.buildRain();
  }

  private createStoneTexture(
    name: string,
    baseHex: string,
    mortarHex: string,
    uScale: number,
    vScale: number,
  ): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = mortarHex;
    ctx.fillRect(0, 0, 512, 512);

    const rows = 8;
    const cols = 4;
    const rowH = 512 / rows;
    const colW = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW / 2);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const shade = 0.85 + (Math.sin(r * 7 + c * 13) * 0.5 + 0.5) * 0.25;
        ctx.fillStyle = baseHex;
        ctx.globalAlpha = shade;
        ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
      }
    }
    ctx.globalAlpha = 1.0;
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = uScale;
    tex.vScale = vScale;
    return tex;
  }

  private createCobbleTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#36312b";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 320; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      const r = 11 + (i % 8);
      ctx.fillStyle = i % 3 === 0 ? "#595046" : i % 2 === 0 ? "#4a433a" : "#665c50";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 3;
    tex.vScale = 22;
    return tex;
  }

  private createCraggyRockTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#22292c";
    ctx.fillRect(0, 0, 512, 512);

    // Striated mountain slate & moss patches
    for (let i = 0; i < 400; i++) {
      const x = (i * 97) % 512;
      const y = (i * 53) % 512;
      const w = 24 + (i % 40);
      const h = 10 + (i % 22);
      ctx.fillStyle =
        i % 4 === 0 ? "#2d373b" : i % 3 === 0 ? "#1b2124" : i % 5 === 0 ? "#29332b" : "#343e42";
      ctx.fillRect(x, y, w, h);
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 10;
    tex.vScale = 14;
    return tex;
  }

  private buildFortress(
    wallMat: BABYLON.StandardMaterial,
    trimMat: BABYLON.StandardMaterial,
    slateRoofMat: BABYLON.StandardMaterial,
    woodMat: BABYLON.StandardMaterial,
    ironMat: BABYLON.StandardMaterial,
  ) {
    // Main Deep Wall Rampart (Z = -6.5 to -1.5, Height = 22m)
    const mainWall = BABYLON.MeshBuilder.CreateBox(
      "mainWall",
      { width: 96, height: this.wallParapetY, depth: 5.0 },
      this.scene,
    );
    mainWall.position.set(0, this.wallParapetY / 2, -4.0);
    mainWall.material = wallMat;

    // Walkway Deck surface along the rampart
    const walkway = BABYLON.MeshBuilder.CreateBox(
      "walkway",
      { width: 96, height: 0.4, depth: 5.4 },
      this.scene,
    );
    walkway.position.set(0, this.wallParapetY + 0.2, -4.2);
    walkway.material = trimMat;

    // Rounded Arched Crenellations along the left and right wings (X < -8.5 and X > +8.5)
    for (let x = -42; x <= 42; x += 4.2) {
      if (Math.abs(x) < 8.5) continue;
      const merlon = BABYLON.MeshBuilder.CreateBox(
        `merlon_${x}`,
        { width: 2.0, height: 1.2, depth: 0.65 },
        this.scene,
      );
      merlon.position.set(x, this.wallParapetY + 0.8, -6.6);
      merlon.material = trimMat;

      const cap = BABYLON.MeshBuilder.CreateCylinder(
        `merlonCap_${x}`,
        { diameter: 0.65, height: 2.0, tessellation: 12 },
        this.scene,
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.set(x, this.wallParapetY + 1.4, -6.6);
      cap.material = trimMat;
    }

    // Grand Cylindrical Flanking Citadel Towers at X = -36 and X = +36
    for (const side of [-1, 1]) {
      const tx = side * 36;
      const tower = BABYLON.MeshBuilder.CreateCylinder(
        `citadelTower_${side}`,
        { diameterTop: 11, diameterBottom: 13, height: 30, tessellation: 20 },
        this.scene,
      );
      tower.position.set(tx, 15, -5.5);
      tower.material = wallMat;

      const towerRing = BABYLON.MeshBuilder.CreateTorus(
        `towerRing_${side}`,
        { diameter: 11.6, thickness: 0.8, tessellation: 24 },
        this.scene,
      );
      towerRing.position.set(tx, 29.5, -5.5);
      towerRing.material = trimMat;

      const spire = BABYLON.MeshBuilder.CreateCylinder(
        `towerSpire_${side}`,
        { diameterTop: 0, diameterBottom: 12.8, height: 11, tessellation: 20 },
        this.scene,
      );
      spire.position.set(tx, 35.5, -5.5);
      spire.material = slateRoofMat;
    }

    // THE HORNBURG GATEHOUSE at Z = -28.0 (Clearly visible in the lower-middle of the player's view!)
    for (const side of [-1, 1]) {
      const gx = side * 9.5;
      const drum = BABYLON.MeshBuilder.CreateCylinder(
        `gateDrum_${side}`,
        { diameterTop: 4.5, diameterBottom: 5.4, height: 9.0, tessellation: 18 },
        this.scene,
      );
      drum.position.set(gx, 4.5, this.gateZ + 0.5);
      drum.material = trimMat;

      const drumRim = BABYLON.MeshBuilder.CreateTorus(
        `drumRim_${side}`,
        { diameter: 4.8, thickness: 0.45, tessellation: 18 },
        this.scene,
      );
      drumRim.position.set(gx, 9.0, this.gateZ + 0.5);
      drumRim.material = wallMat;

      // Low Barbican Wing Wall connecting Main Wall to Gatehouse Drum
      const barbicanWall = BABYLON.MeshBuilder.CreateBox(
        `barbican_${side}`,
        { width: 2.0, height: 6.5, depth: 21.0 },
        this.scene,
      );
      barbicanWall.position.set(gx, 3.25, -17.0);
      barbicanWall.material = wallMat;
    }

    // Stone Gatehouse Archway Lintel & Battlement Walk over the Gate Doors at Z = -28.0
    const gateLintel = BABYLON.MeshBuilder.CreateBox(
      "gateLintel",
      { width: 16.0, height: 1.6, depth: 2.2 },
      this.scene,
    );
    gateLintel.position.set(0, 7.2, this.gateZ);
    gateLintel.material = trimMat;

    // Double Timber & Iron-Bound Gate Doors at Z = -28.0 (Width 11m, Height 6.6m)
    this.gateLeftDoor = BABYLON.MeshBuilder.CreateBox(
      "gateLeftDoor",
      { width: 5.4, height: 6.6, depth: 0.85 },
      this.scene,
    );
    this.gateLeftDoor.position.set(-2.75, 3.3, this.gateZ);
    this.gateLeftDoor.material = woodMat;

    this.gateRightDoor = BABYLON.MeshBuilder.CreateBox(
      "gateRightDoor",
      { width: 5.4, height: 6.6, depth: 0.85 },
      this.scene,
    );
    this.gateRightDoor.position.set(2.75, 3.3, this.gateZ);
    this.gateRightDoor.material = woodMat;

    // Iron Straps on Gate Doors
    for (const sy of [1.4, 3.3, 5.2]) {
      const strap = BABYLON.MeshBuilder.CreateBox(
        `gateStrap_${sy}`,
        { width: 11.0, height: 0.38, depth: 1.0 },
        this.scene,
      );
      strap.position.set(0, sy, this.gateZ);
      strap.material = ironMat;
    }

    // Overhead Spotlight illuminating the Gatehouse Courtyard & Approach
    const gateSpot = new BABYLON.SpotLight(
      "gateSpot",
      new BABYLON.Vector3(0, 26, -8),
      new BABYLON.Vector3(0, -0.62, -0.78),
      Math.PI / 2.2,
      6,
      this.scene,
    );
    gateSpot.intensity = 3.2;
    gateSpot.diffuse = new BABYLON.Color3(1.0, 0.82, 0.5);
  }

  private buildCanyonAndRoad(
    valleyMat: BABYLON.StandardMaterial,
    roadMat: BABYLON.StandardMaterial,
    cliffMat: BABYLON.StandardMaterial,
  ) {
    // Valley Ground Plane with organic rolling craggy slopes flanking the central road
    const ground = BABYLON.MeshBuilder.CreateGround(
      "valleyGround",
      { width: 170, height: 220, subdivisions: 56, updatable: true },
      this.scene,
    );
    ground.position.set(0, 0, -105);

    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const distCenter = Math.abs(x);
        if (distCenter > 13.5) {
          const ridge = Math.pow((distCenter - 13.5) / 25, 1.65) * 16;
          const crag =
            Math.sin(z * 0.11 + x * 0.17) * 2.2 +
            Math.cos(z * 0.06 - x * 0.09) * 1.8 +
            Math.sin(x * 0.35) * 0.9;
          positions[i + 1] = Math.max(0, ridge + crag);
        } else {
          positions[i + 1] = 0;
        }
      }
      ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      const normals: number[] = [];
      BABYLON.VertexData.ComputeNormals(positions, ground.getIndices()!, normals);
      ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    }
    ground.material = valleyMat;

    // Wide 20m Cobblestone Approach Road from Z = -205 right up to the Gate Doors
    const road = BABYLON.MeshBuilder.CreateGround(
      "siegeRoad",
      { width: 20, height: 190, subdivisions: 4 },
      this.scene,
    );
    road.position.set(0, 0.08, -110);
    road.material = roadMat;

    // Raised Stone Curbs along the road
    for (const side of [-1, 1]) {
      const curb = BABYLON.MeshBuilder.CreateBox(
        `roadCurb_${side}`,
        { width: 1.2, height: 0.65, depth: 185 },
        this.scene,
      );
      curb.position.set(side * 10.4, 0.32, -110);
      curb.material = cliffMat;
    }

    // Grounded Craggy Mountain Peaks rising from the valley floor at X = ±42..55
    for (let z = -35; z >= -185; z -= 22) {
      for (const side of [-1, 1]) {
        const spireH = 28 + ((Math.abs(z * 7) + (side > 0 ? 11 : 3)) % 18);
        const spireR = 11 + (Math.abs(z) % 7);
        const rockSpire = BABYLON.MeshBuilder.CreateCylinder(
          `rockSpire_${side}_${z}`,
          {
            diameterTop: spireR * 0.3,
            diameterBottom: spireR * 2.1,
            height: spireH,
            tessellation: 7,
          },
          this.scene,
        );
        rockSpire.position.set(side * (42 + (Math.abs(z) % 8)), spireH / 2 - 1, z);
        rockSpire.rotation.y = z * 0.3;
        rockSpire.material = valleyMat;
      }
    }
  }

  private buildBraziers(ironMat: BABYLON.StandardMaterial) {
    const flameMat = new BABYLON.StandardMaterial("brazierFlameMat", this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.55, 0.1);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.68, 0.2);

    const brazierCoords = [
      // Battlement Braziers
      { x: -20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      // Gatehouse & Roadside Torches lighting the entire canyon approach!
      { x: -11.2, y: 1.5, z: -30, range: 30 },
      { x: 11.2, y: 1.5, z: -30, range: 30 },
      { x: -11.2, y: 1.5, z: -54, range: 32 },
      { x: 11.2, y: 1.5, z: -54, range: 32 },
      { x: -11.2, y: 1.5, z: -80, range: 32 },
      { x: 11.2, y: 1.5, z: -80, range: 32 },
      { x: -11.2, y: 1.5, z: -108, range: 32 },
      { x: 11.2, y: 1.5, z: -108, range: 32 },
      { x: -11.2, y: 1.5, z: -138, range: 32 },
      { x: 11.2, y: 1.5, z: -138, range: 32 },
    ];

    brazierCoords.forEach((b, idx) => {
      const stand = BABYLON.MeshBuilder.CreateCylinder(
        `brazierStand_${idx}`,
        { diameterTop: 1.1, diameterBottom: 0.55, height: 1.4, tessellation: 10 },
        this.scene,
      );
      stand.position.set(b.x, b.y, b.z);
      stand.material = ironMat;

      const flame = BABYLON.MeshBuilder.CreateCylinder(
        `brazierFlame_${idx}`,
        { diameterTop: 0.05, diameterBottom: 0.85, height: 1.25, tessellation: 8 },
        this.scene,
      );
      flame.position.set(b.x, b.y + 1.1, b.z);
      flame.material = flameMat;
      this.flameMeshes.push(flame);

      if (idx < 8) {
        const pt = new BABYLON.PointLight(
          `torchLight_${idx}`,
          new BABYLON.Vector3(b.x, b.y + 2.2, b.z),
          this.scene,
        );
        pt.diffuse = new BABYLON.Color3(1.0, 0.62, 0.22);
        pt.intensity = 1.15;
        pt.range = b.range;
        this.torchLights.push(pt);
      }
    });
  }

  private buildTurretSockets(brassMat: BABYLON.StandardMaterial) {
    // 5 Elevated Bastion & Rampart Turret Emplacements (Visible on Left & Right wings of the battlement!)
    this.turretSockets = [
      {
        id: 0,
        name: "Far West Rampart",
        pos: new BABYLON.Vector3(-24, this.wallParapetY + 0.3, -5.2),
        type: null,
      },
      {
        id: 1,
        name: "West Gate Bastion",
        pos: new BABYLON.Vector3(-11.0, this.wallParapetY + 0.3, -5.6),
        type: null,
      },
      {
        id: 2,
        name: "East Gate Bastion",
        pos: new BABYLON.Vector3(11.0, this.wallParapetY + 0.3, -5.6),
        type: null,
      },
      {
        id: 3,
        name: "Far East Rampart",
        pos: new BABYLON.Vector3(24, this.wallParapetY + 0.3, -5.2),
        type: null,
      },
      {
        id: 4,
        name: "Inner West Barbican",
        pos: new BABYLON.Vector3(-17.5, this.wallParapetY + 0.3, -5.2),
        type: null,
      },
    ];

    for (const s of this.turretSockets) {
      const pad = BABYLON.MeshBuilder.CreateCylinder(
        `socketPad_${s.id}`,
        { diameterTop: 3.0, diameterBottom: 3.4, height: 0.35, tessellation: 20 },
        this.scene,
      );
      pad.position.copyFrom(s.pos);
      pad.material = brassMat;

      const ringMat = new BABYLON.StandardMaterial(`socketRingMat_${s.id}`, this.scene);
      ringMat.emissiveColor = new BABYLON.Color3(0.95, 0.72, 0.18);
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `socketRing_${s.id}`,
        { diameter: 3.1, thickness: 0.14, tessellation: 24 },
        this.scene,
      );
      ring.position.set(s.pos.x, s.pos.y + 0.2, s.pos.z);
      ring.material = ringMat;
      s.ringMat = ringMat;
    }
  }

  private buildRain() {
    const rainMat = new BABYLON.StandardMaterial("rainMat", this.scene);
    rainMat.emissiveColor = new BABYLON.Color3(0.55, 0.72, 0.92);
    rainMat.alpha = 0.25;
    rainMat.disableLighting = true;

    for (let i = 0; i < 80; i++) {
      const drop = BABYLON.MeshBuilder.CreateCylinder(
        `rain_${i}`,
        { diameter: 0.035, height: 1.8, tessellation: 4 },
        this.scene,
      );
      drop.position.set(
        (Math.random() - 0.5) * 90,
        Math.random() * 40 + 4,
        -Math.random() * 130 - 10,
      );
      drop.material = rainMat;
      this.rainLines.push(drop);
    }
  }

  public update(dt: number) {
    const time = performance.now() * 0.006;

    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      const s = 0.9 + Math.sin(time * 2.2 + i * 1.3) * 0.18;
      f.scaling.set(s, 0.85 + Math.cos(time * 3 + i) * 0.22, s);
    }
    for (let i = 0; i < this.torchLights.length; i++) {
      this.torchLights[i].intensity = 1.15 + Math.sin(time * 2.0 + i) * 0.2;
    }

    for (const r of this.rainLines) {
      r.position.y -= 58 * dt;
      if (r.position.y < 1) {
        r.position.y = 42 + Math.random() * 8;
        r.position.x = (Math.random() - 0.5) * 90;
        r.position.z = -Math.random() * 130 - 10;
      }
    }

    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 2.2;
      this.lightningTimer = 9 + Math.random() * 11;
    }
    if (this.lightningLight.intensity > 0.02) {
      this.lightningLight.intensity *= Math.exp(-dt * 10);
    } else {
      this.lightningLight.intensity = 0;
    }
  }

  public damageGate(amount: number) {
    this.gateHealth = Math.max(0, this.gateHealth - amount);
    const shake = (Math.random() - 0.5) * 0.28;
    this.gateLeftDoor.position.z = this.gateZ + shake;
    this.gateRightDoor.position.z = this.gateZ - shake;
  }

  public repairGate(amount: number) {
    this.gateHealth = Math.min(this.maxGateHealth, this.gateHealth + amount);
  }
}
