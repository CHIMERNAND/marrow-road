import * as BABYLON from "@babylonjs/core";

export interface TurretSocket {
  id: number;
  name: string;
  pos: BABYLON.Vector3;
  type: string | null;
  ringMat?: BABYLON.StandardMaterial;
}

export interface PowderBarrel {
  id: number;
  root: BABYLON.TransformNode;
  pos: BABYLON.Vector3;
  radius: number;
  detonated: boolean;
  fuseMesh: BABYLON.Mesh;
}

export interface GarrisonArcher {
  root: BABYLON.TransformNode;
  bowArm: BABYLON.TransformNode;
  pos: BABYLON.Vector3;
  cooldown: number;
}

export class BabylonHelmsWorld {
  public scene: BABYLON.Scene;
  public wallParapetY = 22.0;
  public gateZ = -28.0;
  public gateHealth = 1000;
  public maxGateHealth = 1000;

  public gateLeftDoor!: BABYLON.Mesh;
  public gateRightDoor!: BABYLON.Mesh;
  public shadowGenerator!: BABYLON.ShadowGenerator;
  public turretSockets: TurretSocket[] = [];
  public powderBarrels: PowderBarrel[] = [];
  public garrisonArchers: GarrisonArcher[] = [];
  public justStruckLightning = false;

  private torchLights: BABYLON.PointLight[] = [];
  private flameMeshes: BABYLON.Mesh[] = [];
  private bannerMeshes: BABYLON.Mesh[] = [];
  private lightningLight!: BABYLON.DirectionalLight;
  private lightningBoltMesh!: BABYLON.Mesh;
  private lightningTimer = 7.5;
  private rainLines: BABYLON.Mesh[] = [];
  private rainRipples: BABYLON.Mesh[] = [];

  private barrelWoodMat!: BABYLON.StandardMaterial;
  private barrelIronMat!: BABYLON.StandardMaterial;
  private barrelBandMat!: BABYLON.StandardMaterial;
  private barrelSparkMat!: BABYLON.StandardMaterial;
  private nextBarrelId = 1;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // 1. Cinematic ACES Tone Mapping & Atmospheric Grading
    scene.clearColor = new BABYLON.Color4(0.03, 0.05, 0.09, 1.0);
    scene.ambientColor = new BABYLON.Color3(0.24, 0.29, 0.36);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.05, 0.08, 0.13);
    scene.fogDensity = 0.004;

    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.18;
    scene.imageProcessingConfiguration.contrast = 1.24;
    scene.imageProcessingConfiguration.vignetteEnabled = true;
    scene.imageProcessingConfiguration.vignetteWeight = 1.7;
    scene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0.01, 0.02, 0.04, 1);

    // Subtle Realistic Bloom/Glow for Fire, Runes & Lightning
    const glow = new BABYLON.GlowLayer("glow", scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 32,
    });
    glow.intensity = 0.42;

    // 2. Physically-Grounded Lighting Rig + Real-Time Shadow Mapping
    const hemiLight = new BABYLON.HemisphericLight(
      "hemiLight",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    hemiLight.intensity = 0.65;
    hemiLight.diffuse = new BABYLON.Color3(0.52, 0.64, 0.82);
    hemiLight.groundColor = new BABYLON.Color3(0.16, 0.18, 0.22);

    const moonLight = new BABYLON.DirectionalLight(
      "moonLight",
      new BABYLON.Vector3(-0.35, -0.78, 0.52),
      scene,
    );
    moonLight.position = new BABYLON.Vector3(50, 110, -85);
    moonLight.intensity = 1.65;
    moonLight.diffuse = new BABYLON.Color3(0.78, 0.86, 0.98);
    moonLight.specular = new BABYLON.Color3(0.85, 0.9, 1.0);

    // Real-time PCF Shadow Generator
    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, moonLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
    this.shadowGenerator.bias = 0.0008;
    this.shadowGenerator.normalBias = 0.02;

    // Warm Torch-Bounce Fill Light illuminating zombie front silhouettes
    const gorgeLight = new BABYLON.DirectionalLight(
      "gorgeLight",
      new BABYLON.Vector3(0.12, -0.45, -0.88),
      scene,
    );
    gorgeLight.intensity = 0.88;
    gorgeLight.diffuse = new BABYLON.Color3(0.95, 0.76, 0.55);

    this.lightningLight = new BABYLON.DirectionalLight(
      "lightningLight",
      new BABYLON.Vector3(0.1, -0.92, 0.35),
      scene,
    );
    this.lightningLight.intensity = 0;
    this.lightningLight.diffuse = new BABYLON.Color3(0.82, 0.92, 1.0);

    // 3. High-Detail Procedural Diffuse & Normal/Bump Textures
    const stoneDiff = this.createDetailedAshlarTexture("stoneDiff", "#5a636e", "#3a4048", 8, 4);
    const stoneNorm = this.createAshlarNormalMap("stoneNorm", 8, 4);
    const darkStoneDiff = this.createDetailedAshlarTexture("darkStoneDiff", "#3e454f", "#252a30", 6, 3);
    const darkStoneNorm = this.createAshlarNormalMap("darkStoneNorm", 6, 3);
    const roadDiff = this.createRealisticCobbleTexture("roadDiff");
    const roadNorm = this.createCobbleNormalMap("roadNorm");
    const cliffDiff = this.createGraniteCliffTexture("cliffDiff");
    const cliffNorm = this.createGraniteNormalMap("cliffNorm");
    const woodDiff = this.createWeatheredWoodTexture("woodDiff");

    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture = stoneDiff;
    wallMat.bumpTexture = stoneNorm;
    wallMat.specularColor = new BABYLON.Color3(0.22, 0.24, 0.28);
    wallMat.specularPower = 24;

    const trimMat = new BABYLON.StandardMaterial("trimMat", scene);
    trimMat.diffuseTexture = darkStoneDiff;
    trimMat.bumpTexture = darkStoneNorm;
    trimMat.specularColor = new BABYLON.Color3(0.28, 0.3, 0.35);
    trimMat.specularPower = 32;

    const slateRoofMat = new BABYLON.StandardMaterial("slateRoofMat", scene);
    slateRoofMat.diffuseColor = new BABYLON.Color3(0.14, 0.18, 0.24);
    slateRoofMat.bumpTexture = darkStoneNorm;
    slateRoofMat.specularColor = new BABYLON.Color3(0.35, 0.4, 0.48);
    slateRoofMat.specularPower = 40;

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseTexture = woodDiff;
    woodMat.specularColor = new BABYLON.Color3(0.14, 0.1, 0.07);
    woodMat.specularPower = 16;
    this.barrelWoodMat = woodMat;

    const ironMat = new BABYLON.StandardMaterial("ironMat", scene);
    ironMat.diffuseColor = new BABYLON.Color3(0.18, 0.2, 0.23);
    ironMat.specularColor = new BABYLON.Color3(0.72, 0.76, 0.82);
    ironMat.specularPower = 64;
    this.barrelIronMat = ironMat;

    this.barrelBandMat = new BABYLON.StandardMaterial("barrelBandMat", scene);
    this.barrelBandMat.diffuseColor = new BABYLON.Color3(0.65, 0.14, 0.1);
    this.barrelBandMat.emissiveColor = new BABYLON.Color3(0.22, 0.04, 0.02);

    this.barrelSparkMat = new BABYLON.StandardMaterial("barrelSparkMat", scene);
    this.barrelSparkMat.emissiveColor = new BABYLON.Color3(1.0, 0.65, 0.15);
    this.barrelSparkMat.disableLighting = true;

    const brassMat = new BABYLON.StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new BABYLON.Color3(0.68, 0.5, 0.18);
    brassMat.specularColor = new BABYLON.Color3(0.95, 0.82, 0.45);
    brassMat.specularPower = 48;

    const valleyMat = new BABYLON.StandardMaterial("valleyMat", scene);
    valleyMat.diffuseTexture = cliffDiff;
    valleyMat.bumpTexture = cliffNorm;
    valleyMat.specularColor = new BABYLON.Color3(0.16, 0.19, 0.22);
    valleyMat.specularPower = 20;

    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseTexture = roadDiff;
    roadMat.bumpTexture = roadNorm;
    roadMat.specularColor = new BABYLON.Color3(0.42, 0.46, 0.52);
    roadMat.specularPower = 38;

    // 4. Night Sky Dome, Moon, Lightning Fork & Distant Horizon Mountains
    this.buildSkyAndHorizon(valleyMat);

    // 5. Build the Realistic Hornburg Fortress, Portcullis & Machicolations
    this.buildFortress(wallMat, trimMat, slateRoofMat, woodMat, ironMat);

    // 6. Build the Sculpted Canyon Floor, Causeway, Barricades & Boulders
    this.buildCanyonAndRoad(valleyMat, roadMat, trimMat, woodMat, ironMat);

    // 7. Build Roadside & Battlement Flaming Braziers
    this.buildBraziers(ironMat);

    // 8. Build Turret Emplacement Sockets
    this.buildTurretSockets(brassMat, trimMat);

    // 9. Station Allied Royal Elven Sentinels on the Battlements
    this.buildGarrisonArchers(ironMat, brassMat, woodMat);

    // 10. Place Explosive Black-Powder Barrels along the Canyon Causeway
    this.spawnPowderBarrels();

    // 11. Atmospheric Rain Streaks & Wet Cobblestone Splash Ripples
    this.buildRain();
  }

  private hash(x: number, y: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  private createDetailedAshlarTexture(
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

    const rows = 10;
    const cols = 5;
    const rowH = 512 / rows;
    const colW = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const hVal = this.hash(r, c);
        ctx.fillStyle = baseHex;
        ctx.globalAlpha = 0.78 + hVal * 0.22;
        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

        for (let g = 0; g < 18; g++) {
          const gx = x + 4 + this.hash(r * 13 + g, c) * (colW - 10);
          const gy = y + 4 + this.hash(c * 17 + g, r) * (rowH - 10);
          ctx.fillStyle = g % 2 === 0 ? "#1f2429" : "#8b95a1";
          ctx.globalAlpha = 0.14;
          ctx.fillRect(gx, gy, 8 + (g % 10), 2 + (g % 4));
        }
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

  private createAshlarNormalMap(name: string, uScale: number, vScale: number): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, 512, 512);

    const rows = 10;
    const cols = 5;
    const rowH = 512 / rows;
    const colW = 512 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        ctx.fillStyle = "rgb(128, 185, 240)";
        ctx.fillRect(x + 2, y + 2, colW - 4, 3);
        ctx.fillStyle = "rgb(128, 70, 240)";
        ctx.fillRect(x + 2, y + rowH - 5, colW - 4, 3);
        ctx.fillStyle = "rgb(185, 128, 240)";
        ctx.fillRect(x + 2, y + 2, 3, rowH - 4);
        ctx.fillStyle = "rgb(70, 128, 240)";
        ctx.fillRect(x + colW - 5, y + 2, 3, rowH - 4);
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = uScale;
    tex.vScale = vScale;
    return tex;
  }

  private createRealisticCobbleTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#1f1d1a";
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const cols = 12;
    const cellW = 512 / cols;
    const cellH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h1 = this.hash(r, c);
        const h2 = this.hash(c + 19, r + 31);
        const cx = (c + 0.5 + (h1 - 0.5) * 0.25) * cellW;
        const cy = (r + 0.5 + (h2 - 0.5) * 0.25) * cellH;
        const rx = cellW * (0.36 + h1 * 0.1);
        const ry = cellH * (0.35 + h2 * 0.1);

        const shade = Math.floor(62 + h1 * 38);
        ctx.fillStyle = `rgb(${shade + 4}, ${shade}, ${shade - 5})`;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(rx, ry), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(160, 155, 145, 0.22)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(15, 14, 12, 0.32)";
    ctx.fillRect(110, 0, 55, 512);
    ctx.fillRect(345, 0, 55, 512);

    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 3.5;
    tex.vScale = 28;
    return tex;
  }

  private createCobbleNormalMap(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const cols = 12;
    const cellW = 512 / cols;
    const cellH = 512 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h1 = this.hash(r, c);
        const h2 = this.hash(c + 19, r + 31);
        const cx = (c + 0.5 + (h1 - 0.5) * 0.25) * cellW;
        const cy = (r + 0.5 + (h2 - 0.5) * 0.25) * cellH;
        const rad = Math.min(cellW, cellH) * 0.38;

        ctx.fillStyle = "rgb(165, 165, 245)";
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(95, 95, 245)";
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 2, rad * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 3.5;
    tex.vScale = 28;
    return tex;
  }

  private createGraniteCliffTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#1c2126";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1800; i++) {
      const h1 = this.hash(i, i * 3);
      const h2 = this.hash(i * 7, i + 11);
      const x = h1 * 512;
      const y = h2 * 512;
      const w = 6 + (i % 18);
      const h = 3 + (i % 8);
      const v = Math.floor(26 + h1 * 32);
      const moss = i % 7 === 0 ? 6 : 0;
      ctx.fillStyle = `rgb(${v}, ${v + 4 + moss}, ${v + 7})`;
      ctx.fillRect(x, y, w, h);
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 12;
    tex.vScale = 16;
    return tex;
  }

  private createGraniteNormalMap(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 1400; i++) {
      const x = this.hash(i, 13) * 512;
      const y = this.hash(i, 29) * 512;
      const nx = Math.floor(90 + this.hash(i, 41) * 76);
      const ny = Math.floor(90 + this.hash(i, 59) * 76);
      ctx.fillStyle = `rgb(${nx}, ${ny}, 245)`;
      ctx.fillRect(x, y, 8, 5);
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 12;
    tex.vScale = 16;
    return tex;
  }

  private createWeatheredWoodTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 256, height: 256 }, this.scene, false);
    const ctx = tex.getContext();
    ctx.fillStyle = "#332012";
    ctx.fillRect(0, 0, 256, 256);

    for (let p = 0; p < 8; p++) {
      const x = p * 32;
      ctx.fillStyle = p % 2 === 0 ? "#3b2515" : "#2e1c0f";
      ctx.fillRect(x + 1, 0, 30, 256);
      for (let g = 0; g < 24; g++) {
        ctx.fillStyle = "rgba(20, 10, 4, 0.35)";
        ctx.fillRect(x + 2 + (g % 26), (g * 37) % 256, 2, 28);
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private buildSkyAndHorizon(valleyMat: BABYLON.StandardMaterial) {
    const moonMat = new BABYLON.StandardMaterial("moonDiscMat", this.scene);
    moonMat.emissiveColor = new BABYLON.Color3(0.85, 0.9, 1.0);
    moonMat.disableLighting = true;

    const moon = BABYLON.MeshBuilder.CreateDisc(
      "fullMoon",
      { radius: 14, tessellation: 32 },
      this.scene,
    );
    moon.position.set(38, 88, -230);
    moon.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    moon.material = moonMat;

    // 3D Forked Lightning Bolt in the distant storm clouds (visible during thunder strikes)
    const boltMat = new BABYLON.StandardMaterial("skyLightningMat", this.scene);
    boltMat.emissiveColor = new BABYLON.Color3(0.8, 0.95, 1.0);
    boltMat.disableLighting = true;

    const boltPoints = [
      new BABYLON.Vector3(-18, 125, -210),
      new BABYLON.Vector3(-12, 98, -210),
      new BABYLON.Vector3(-20, 76, -210),
      new BABYLON.Vector3(-10, 52, -210),
      new BABYLON.Vector3(-15, 22, -210),
    ];
    this.lightningBoltMesh = BABYLON.MeshBuilder.CreateTube(
      "skyLightningFork",
      { path: boltPoints, radius: 0.65, tessellation: 6 },
      this.scene,
    );
    this.lightningBoltMesh.material = boltMat;
    this.lightningBoltMesh.visibility = 0;

    // Distant Jagged Mountain Horizon closing off the far end of the valley
    const horizonPeaks = [
      { x: -95, h: 95, r: 65, z: -225 },
      { x: -45, h: 78, r: 52, z: -230 },
      { x: 0, h: 62, r: 48, z: -235 },
      { x: 48, h: 82, r: 55, z: -230 },
      { x: 98, h: 98, r: 68, z: -225 },
    ];
    horizonPeaks.forEach((p, idx) => {
      const peak = BABYLON.MeshBuilder.CreateCylinder(
        `horizonPeak_${idx}`,
        { diameterTop: 2, diameterBottom: p.r, height: p.h, tessellation: 7 },
        this.scene,
      );
      peak.position.set(p.x, p.h / 2 - 4, p.z);
      peak.rotation.y = idx * 0.9;
      peak.material = valleyMat;
    });
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
    mainWall.receiveShadows = true;

    const walkway = BABYLON.MeshBuilder.CreateBox(
      "walkway",
      { width: 96, height: 0.4, depth: 5.4 },
      this.scene,
    );
    walkway.position.set(0, this.wallParapetY + 0.2, -4.2);
    walkway.material = trimMat;
    walkway.receiveShadows = true;

    for (let x = -40; x <= 40; x += 8.0) {
      if (Math.abs(x) < 10) continue;
      const buttress = BABYLON.MeshBuilder.CreateBox(
        `buttress_${x}`,
        { width: 1.6, height: this.wallParapetY, depth: 1.4 },
        this.scene,
      );
      buttress.position.set(x, this.wallParapetY / 2, -6.8);
      buttress.material = trimMat;
    }

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

    for (const side of [-1, 1]) {
      const tx = side * 36;
      const tower = BABYLON.MeshBuilder.CreateCylinder(
        `citadelTower_${side}`,
        { diameterTop: 11, diameterBottom: 13, height: 30, tessellation: 24 },
        this.scene,
      );
      tower.position.set(tx, 15, -5.5);
      tower.material = wallMat;
      this.shadowGenerator.addShadowCaster(tower);

      const towerRing = BABYLON.MeshBuilder.CreateTorus(
        `towerRing_${side}`,
        { diameter: 11.6, thickness: 0.8, tessellation: 24 },
        this.scene,
      );
      towerRing.position.set(tx, 29.5, -5.5);
      towerRing.material = trimMat;

      const spire = BABYLON.MeshBuilder.CreateCylinder(
        `towerSpire_${side}`,
        { diameterTop: 0, diameterBottom: 12.8, height: 11, tessellation: 24 },
        this.scene,
      );
      spire.position.set(tx, 35.5, -5.5);
      spire.material = slateRoofMat;
    }

    // THE HORNBURG GATEHOUSE at Z = -28.0
    const bannerMat = new BABYLON.StandardMaterial("gateBannerMat", this.scene);
    bannerMat.diffuseColor = new BABYLON.Color3(0.52, 0.1, 0.1);
    bannerMat.specularColor = new BABYLON.Color3(0.12, 0.05, 0.05);

    for (const side of [-1, 1]) {
      const gx = side * 9.8;
      const drum = BABYLON.MeshBuilder.CreateCylinder(
        `gateDrum_${side}`,
        { diameterTop: 5.0, diameterBottom: 6.0, height: 9.2, tessellation: 16 },
        this.scene,
      );
      drum.position.set(gx, 4.6, this.gateZ + 0.5);
      drum.material = wallMat;
      drum.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(drum);

      const drumRim = BABYLON.MeshBuilder.CreateTorus(
        `drumRim_${side}`,
        { diameter: 5.3, thickness: 0.5, tessellation: 16 },
        this.scene,
      );
      drumRim.position.set(gx, 9.2, this.gateZ + 0.5);
      drumRim.material = trimMat;

      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI * 2) / 8;
        const tooth = BABYLON.MeshBuilder.CreateBox(
          `drumTooth_${side}_${a}`,
          { width: 0.9, height: 0.75, depth: 0.5 },
          this.scene,
        );
        tooth.position.set(
          gx + Math.sin(ang) * 2.35,
          9.6,
          this.gateZ + 0.5 + Math.cos(ang) * 2.35,
        );
        tooth.rotation.y = ang;
        tooth.material = trimMat;
      }

      const banner = BABYLON.MeshBuilder.CreatePlane(
        `banner_${side}`,
        { width: 1.2, height: 3.6, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
        this.scene,
      );
      banner.position.set(gx, 5.5, this.gateZ - 2.35);
      banner.material = bannerMat;
      this.bannerMeshes.push(banner);

      const barbicanWall = BABYLON.MeshBuilder.CreateBox(
        `barbican_${side}`,
        { width: 2.2, height: 6.8, depth: 21.0 },
        this.scene,
      );
      barbicanWall.position.set(gx, 3.4, -17.0);
      barbicanWall.material = wallMat;
      barbicanWall.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(barbicanWall);
    }

    const gateLintel = BABYLON.MeshBuilder.CreateBox(
      "gateLintel",
      { width: 17.5, height: 2.0, depth: 2.6 },
      this.scene,
    );
    gateLintel.position.set(0, 7.4, this.gateZ);
    gateLintel.material = trimMat;
    this.shadowGenerator.addShadowCaster(gateLintel);

    // Murder-Hole Boiling Pitch Spouts mounted along the Gatehouse Lintel
    for (const sx of [-4.5, 0, 4.5]) {
      const cauldronSpout = BABYLON.MeshBuilder.CreateCylinder(
        `murderSpout_${sx}`,
        { diameterTop: 0.7, diameterBottom: 0.9, height: 1.1, tessellation: 10 },
        this.scene,
      );
      cauldronSpout.rotation.x = Math.PI / 3;
      cauldronSpout.position.set(sx, 8.1, this.gateZ - 1.2);
      cauldronSpout.material = ironMat;
    }

    for (let px = -5.0; px <= 5.0; px += 1.25) {
      const bar = BABYLON.MeshBuilder.CreateCylinder(
        `portcullisV_${px}`,
        { diameter: 0.16, height: 6.8, tessellation: 8 },
        this.scene,
      );
      bar.position.set(px, 3.4, this.gateZ - 0.55);
      bar.material = ironMat;
    }

    this.gateLeftDoor = BABYLON.MeshBuilder.CreateBox(
      "gateLeftDoor",
      { width: 5.4, height: 6.6, depth: 0.85 },
      this.scene,
    );
    this.gateLeftDoor.position.set(-2.75, 3.3, this.gateZ);
    this.gateLeftDoor.material = woodMat;
    this.gateLeftDoor.receiveShadows = true;

    this.gateRightDoor = BABYLON.MeshBuilder.CreateBox(
      "gateRightDoor",
      { width: 5.4, height: 6.6, depth: 0.85 },
      this.scene,
    );
    this.gateRightDoor.position.set(2.75, 3.3, this.gateZ);
    this.gateRightDoor.material = woodMat;
    this.gateRightDoor.receiveShadows = true;

    for (const sy of [1.4, 3.3, 5.2]) {
      const strap = BABYLON.MeshBuilder.CreateBox(
        `gateStrap_${sy}`,
        { width: 11.0, height: 0.38, depth: 1.0 },
        this.scene,
      );
      strap.position.set(0, sy, this.gateZ);
      strap.material = ironMat;
    }

    const gateSpot = new BABYLON.SpotLight(
      "gateSpot",
      new BABYLON.Vector3(0, 26, -8),
      new BABYLON.Vector3(0, -0.62, -0.78),
      Math.PI / 2.2,
      6,
      this.scene,
    );
    gateSpot.intensity = 2.8;
    gateSpot.diffuse = new BABYLON.Color3(1.0, 0.78, 0.45);
  }

  private buildCanyonAndRoad(
    valleyMat: BABYLON.StandardMaterial,
    roadMat: BABYLON.StandardMaterial,
    cliffMat: BABYLON.StandardMaterial,
    woodMat: BABYLON.StandardMaterial,
    ironMat: BABYLON.StandardMaterial,
  ) {
    const ground = BABYLON.MeshBuilder.CreateGround(
      "valleyGround",
      { width: 180, height: 230, subdivisions: 72, updatable: true },
      this.scene,
    );
    ground.position.set(0, 0, -110);

    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const distCenter = Math.abs(x);
        if (distCenter > 12.5) {
          const ridge = Math.pow((distCenter - 12.5) / 22, 1.6) * 18;
          const crag =
            Math.sin(z * 0.14 + x * 0.19) * 2.6 +
            Math.cos(z * 0.07 - x * 0.11) * 2.1 +
            Math.sin(x * 0.42 + z * 0.23) * 1.2;
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
    ground.receiveShadows = true;

    const road = BABYLON.MeshBuilder.CreateGround(
      "siegeRoad",
      { width: 20, height: 205, subdivisions: 8 },
      this.scene,
    );
    road.position.set(0, 0.08, -115);
    road.material = roadMat;
    road.receiveShadows = true;

    for (const side of [-1, 1]) {
      const curb = BABYLON.MeshBuilder.CreateBox(
        `roadCurb_${side}`,
        { width: 1.3, height: 0.7, depth: 195 },
        this.scene,
      );
      curb.position.set(side * 10.4, 0.35, -115);
      curb.material = cliffMat;
      curb.receiveShadows = true;
    }

    // Spiked Wooden Cheval-de-Frise Siege Barricades along the Road Margins
    const barricadeCoords = [
      { x: -8.2, z: -36, rotY: 0.25 },
      { x: 8.2, z: -36, rotY: -0.25 },
      { x: -8.4, z: -58, rotY: 0.18 },
      { x: 8.4, z: -58, rotY: -0.18 },
      { x: -8.2, z: -84, rotY: 0.22 },
      { x: 8.2, z: -84, rotY: -0.22 },
    ];
    barricadeCoords.forEach((bc, idx) => {
      const bRoot = new BABYLON.TransformNode(`barricade_${idx}`, this.scene);
      bRoot.position.set(bc.x, 0.85, bc.z);
      bRoot.rotation.y = bc.rotY;

      const beam = BABYLON.MeshBuilder.CreateCylinder(
        `bBeam_${idx}`,
        { diameter: 0.34, height: 3.2, tessellation: 8 },
        this.scene,
      );
      beam.rotation.z = Math.PI / 2;
      beam.material = woodMat;
      beam.parent = bRoot;

      for (let s = -1.1; s <= 1.1; s += 0.55) {
        const stake1 = BABYLON.MeshBuilder.CreateCylinder(
          `bStake1_${idx}_${s}`,
          { diameterTop: 0.03, diameterBottom: 0.18, height: 2.1, tessellation: 6 },
          this.scene,
        );
        stake1.position.set(s, 0.15, 0);
        stake1.rotation.x = 0.68;
        stake1.material = woodMat;
        stake1.parent = bRoot;

        const stake2 = BABYLON.MeshBuilder.CreateCylinder(
          `bStake2_${idx}_${s}`,
          { diameterTop: 0.03, diameterBottom: 0.18, height: 2.1, tessellation: 6 },
          this.scene,
        );
        stake2.position.set(s, 0.15, 0);
        stake2.rotation.x = -0.68;
        stake2.material = ironMat;
        stake2.parent = bRoot;
      }
    });

    for (let z = -32; z >= -195; z -= 14) {
      for (const side of [-1, 1]) {
        const h1 = this.hash(z, side);
        const boulder = BABYLON.MeshBuilder.CreatePolyhedron(
          `boulder_${side}_${z}`,
          { type: 2, sizeX: 2.5 + h1 * 2.5, sizeY: 1.8 + h1 * 2.2, sizeZ: 2.2 + h1 * 2.0 },
          this.scene,
        );
        boulder.position.set(side * (13.5 + h1 * 4.5), 1.0, z + h1 * 5);
        boulder.rotation.set(h1 * 2, h1 * 4, h1);
        boulder.material = valleyMat;
        boulder.receiveShadows = true;
      }
    }
  }

  private buildGarrisonArchers(
    ironMat: BABYLON.StandardMaterial,
    brassMat: BABYLON.StandardMaterial,
    woodMat: BABYLON.StandardMaterial,
  ) {
    const cloakMat = new BABYLON.StandardMaterial("sentinelCloakMat", this.scene);
    cloakMat.diffuseColor = new BABYLON.Color3(0.12, 0.2, 0.34);
    cloakMat.specularColor = new BABYLON.Color3(0.1, 0.12, 0.18);

    const archerXPositions = [-28, -19.5, -14.2, 14.2, 19.5, 28];

    archerXPositions.forEach((ax, idx) => {
      const root = new BABYLON.TransformNode(`sentinel_${idx}`, this.scene);
      const pos = new BABYLON.Vector3(ax, this.wallParapetY + 0.4, -6.1);
      root.position.copyFrom(pos);
      // Face slightly inward toward the central canyon road
      root.rotation.y = Math.PI + (ax > 0 ? 0.12 : -0.12);

      const torso = BABYLON.MeshBuilder.CreateCylinder(
        `sTorso_${idx}`,
        { diameterTop: 0.62, diameterBottom: 0.48, height: 1.15, tessellation: 10 },
        this.scene,
      );
      torso.position.y = 1.15;
      torso.material = ironMat;
      torso.parent = root;

      const cloak = BABYLON.MeshBuilder.CreateCylinder(
        `sCloak_${idx}`,
        { diameterTop: 0.55, diameterBottom: 0.85, height: 1.45, tessellation: 10 },
        this.scene,
      );
      cloak.position.set(0, 0.95, -0.12);
      cloak.material = cloakMat;
      cloak.parent = root;

      const helm = BABYLON.MeshBuilder.CreateCylinder(
        `sHelm_${idx}`,
        { diameterTop: 0.08, diameterBottom: 0.42, height: 0.65, tessellation: 10 },
        this.scene,
      );
      helm.position.y = 1.98;
      helm.material = brassMat;
      helm.parent = root;

      const bowArm = new BABYLON.TransformNode(`sBowArm_${idx}`, this.scene);
      bowArm.position.set(0.32, 1.45, 0.25);
      bowArm.rotation.x = 0.35; // Aiming down into the canyon
      bowArm.parent = root;

      const bow = BABYLON.MeshBuilder.CreateTorus(
        `sBow_${idx}`,
        { diameter: 1.15, thickness: 0.06, tessellation: 14 },
        this.scene,
      );
      bow.rotation.y = Math.PI / 2;
      bow.position.set(0, 0, 0.35);
      bow.material = woodMat;
      bow.parent = bowArm;

      this.garrisonArchers.push({
        root,
        bowArm,
        pos: pos.add(new BABYLON.Vector3(0, 1.6, -0.4)),
        cooldown: 1.2 + idx * 0.45,
      });
    });
  }

  public spawnPowderBarrels() {
    // Clear existing barrels first
    for (const b of this.powderBarrels) {
      b.root.dispose();
    }
    this.powderBarrels = [];

    const coords = [
      { x: -3.6, z: -36 },
      { x: 3.6, z: -36 },
      { x: 0.0, z: -49 },
      { x: -4.8, z: -63 },
      { x: 4.8, z: -63 },
      { x: 0.0, z: -79 },
      { x: -4.2, z: -96 },
      { x: 4.2, z: -96 },
    ];

    coords.forEach((c) => {
      const id = this.nextBarrelId++;
      const root = new BABYLON.TransformNode(`powderBarrel_${id}`, this.scene);
      const pos = new BABYLON.Vector3(c.x, 0, c.z);
      root.position.copyFrom(pos);

      const cask = BABYLON.MeshBuilder.CreateCylinder(
        `cask_${id}`,
        { diameterTop: 1.05, diameterBottom: 1.05, height: 1.45, tessellation: 14 },
        this.scene,
      );
      cask.position.y = 0.72;
      cask.material = this.barrelWoodMat;
      cask.parent = root;
      this.shadowGenerator.addShadowCaster(cask);

      // Crimson Alchemical Hazard Belly Band
      const band = BABYLON.MeshBuilder.CreateCylinder(
        `caskBand_${id}`,
        { diameterTop: 1.12, diameterBottom: 1.12, height: 0.38, tessellation: 14 },
        this.scene,
      );
      band.position.y = 0.72;
      band.material = this.barrelBandMat;
      band.parent = root;

      // Top & Bottom Iron Hoops
      for (const hy of [0.22, 1.22]) {
        const hoop = BABYLON.MeshBuilder.CreateTorus(
          `caskHoop_${id}_${hy}`,
          { diameter: 1.08, thickness: 0.08, tessellation: 14 },
          this.scene,
        );
        hoop.position.y = hy;
        hoop.material = this.barrelIronMat;
        hoop.parent = root;
      }

      // Glowing Fuse Ember on top so the player can snipe it from the watchtower
      const fuse = BABYLON.MeshBuilder.CreateSphere(
        `caskFuse_${id}`,
        { diameter: 0.32, segments: 8 },
        this.scene,
      );
      fuse.position.y = 1.58;
      fuse.material = this.barrelSparkMat;
      fuse.parent = root;

      this.powderBarrels.push({
        id,
        root,
        pos: new BABYLON.Vector3(c.x, 0.8, c.z),
        radius: 1.35,
        detonated: false,
        fuseMesh: fuse,
      });
    });
  }

  private buildBraziers(ironMat: BABYLON.StandardMaterial) {
    const flameMat = new BABYLON.StandardMaterial("brazierFlameMat", this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.48, 0.08);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.65, 0.15);

    const emberMat = new BABYLON.StandardMaterial("brazierEmberMat", this.scene);
    emberMat.emissiveColor = new BABYLON.Color3(0.95, 0.25, 0.02);

    const brazierCoords = [
      { x: -20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -11.0, y: 1.4, z: -30, range: 32 },
      { x: 11.0, y: 1.4, z: -30, range: 32 },
      { x: -11.0, y: 1.4, z: -52, range: 34 },
      { x: 11.0, y: 1.4, z: -52, range: 34 },
      { x: -11.0, y: 1.4, z: -76, range: 34 },
      { x: 11.0, y: 1.4, z: -76, range: 34 },
      { x: -11.0, y: 1.4, z: -102, range: 34 },
      { x: 11.0, y: 1.4, z: -102, range: 34 },
      { x: -11.0, y: 1.4, z: -130, range: 34 },
      { x: 11.0, y: 1.4, z: -130, range: 34 },
    ];

    brazierCoords.forEach((b, idx) => {
      const stand = BABYLON.MeshBuilder.CreateCylinder(
        `brazierStand_${idx}`,
        { diameterTop: 0.45, diameterBottom: 0.7, height: 1.4, tessellation: 10 },
        this.scene,
      );
      stand.position.set(b.x, b.y, b.z);
      stand.material = ironMat;
      this.shadowGenerator.addShadowCaster(stand);

      const bowl = BABYLON.MeshBuilder.CreateSphere(
        `brazierBowl_${idx}`,
        { diameter: 1.25, slice: 0.55, segments: 12 },
        this.scene,
      );
      bowl.rotation.x = Math.PI;
      bowl.position.set(b.x, b.y + 0.95, b.z);
      bowl.material = ironMat;

      const coals = BABYLON.MeshBuilder.CreateDisc(
        `brazierCoals_${idx}`,
        { radius: 0.52, tessellation: 10 },
        this.scene,
      );
      coals.rotation.x = Math.PI / 2;
      coals.position.set(b.x, b.y + 0.92, b.z);
      coals.material = emberMat;

      const flame = BABYLON.MeshBuilder.CreateCylinder(
        `brazierFlame_${idx}`,
        { diameterTop: 0.04, diameterBottom: 0.78, height: 1.35, tessellation: 8 },
        this.scene,
      );
      flame.position.set(b.x, b.y + 1.45, b.z);
      flame.material = flameMat;
      this.flameMeshes.push(flame);

      if (idx < 8) {
        const pt = new BABYLON.PointLight(
          `torchLight_${idx}`,
          new BABYLON.Vector3(b.x, b.y + 2.4, b.z),
          this.scene,
        );
        pt.diffuse = new BABYLON.Color3(1.0, 0.58, 0.18);
        pt.specular = new BABYLON.Color3(1.0, 0.65, 0.25);
        pt.intensity = 1.25;
        pt.range = b.range;
        this.torchLights.push(pt);
      }
    });
  }

  private buildTurretSockets(
    brassMat: BABYLON.StandardMaterial,
    trimMat: BABYLON.StandardMaterial,
  ) {
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
      pad.material = trimMat;

      const ringMat = new BABYLON.StandardMaterial(`socketRingMat_${s.id}`, this.scene);
      ringMat.diffuseColor = new BABYLON.Color3(0.75, 0.55, 0.15);
      ringMat.emissiveColor = new BABYLON.Color3(0.35, 0.24, 0.05);
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `socketRing_${s.id}`,
        { diameter: 3.1, thickness: 0.14, tessellation: 24 },
        this.scene,
      );
      ring.position.set(s.pos.x, s.pos.y + 0.2, s.pos.z);
      ring.material = brassMat;
      s.ringMat = ringMat;
    }
  }

  private buildRain() {
    const rainMat = new BABYLON.StandardMaterial("rainMat", this.scene);
    rainMat.emissiveColor = new BABYLON.Color3(0.48, 0.62, 0.78);
    rainMat.alpha = 0.24;
    rainMat.disableLighting = true;

    for (let i = 0; i < 105; i++) {
      const drop = BABYLON.MeshBuilder.CreateCylinder(
        `rain_${i}`,
        { diameter: 0.025, height: 2.2, tessellation: 4 },
        this.scene,
      );
      drop.position.set(
        (Math.random() - 0.5) * 90,
        Math.random() * 40 + 4,
        -Math.random() * 130 - 10,
      );
      drop.rotation.z = 0.08;
      drop.material = rainMat;
      this.rainLines.push(drop);
    }

    // Rain splash ripples on the wet cobblestone road
    const rippleMat = new BABYLON.StandardMaterial("rippleMat", this.scene);
    rippleMat.emissiveColor = new BABYLON.Color3(0.55, 0.68, 0.85);
    rippleMat.alpha = 0.28;
    rippleMat.disableLighting = true;

    for (let i = 0; i < 24; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `rainRipple_${i}`,
        { diameter: 0.45, thickness: 0.03, tessellation: 12 },
        this.scene,
      );
      ring.position.set(
        (Math.random() - 0.5) * 17,
        0.11,
        -28 - Math.random() * 95,
      );
      ring.scaling.setAll(Math.random());
      ring.material = rippleMat;
      this.rainRipples.push(ring);
    }
  }

  public update(dt: number) {
    const time = performance.now() * 0.006;
    this.justStruckLightning = false;

    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      const s = 0.88 + Math.sin(time * 2.5 + i * 1.3) * 0.16;
      f.scaling.set(s, 0.85 + Math.cos(time * 3.2 + i) * 0.22, s);
    }
    for (let i = 0; i < this.torchLights.length; i++) {
      this.torchLights[i].intensity = 1.25 + Math.sin(time * 2.2 + i) * 0.22;
    }
    for (let i = 0; i < this.bannerMeshes.length; i++) {
      this.bannerMeshes[i].rotation.x = Math.sin(time * 1.1 + i) * 0.11;
      this.bannerMeshes[i].rotation.z = Math.cos(time * 0.8 + i) * 0.04;
    }

    // Pulse powder barrel fuses
    for (const b of this.powderBarrels) {
      if (!b.detonated) {
        const p = 0.85 + Math.sin(time * 5 + b.id) * 0.3;
        b.fuseMesh.scaling.setAll(p);
      }
    }

    for (const r of this.rainLines) {
      r.position.y -= 64 * dt;
      if (r.position.y < 1) {
        r.position.y = 42 + Math.random() * 8;
        r.position.x = (Math.random() - 0.5) * 90;
        r.position.z = -Math.random() * 130 - 10;
      }
    }

    for (const rp of this.rainRipples) {
      const nextScale = rp.scaling.x + dt * 1.8;
      if (nextScale > 1.3) {
        rp.scaling.setAll(0.15);
        rp.position.x = (Math.random() - 0.5) * 17;
        rp.position.z = -28 - Math.random() * 95;
      } else {
        rp.scaling.setAll(nextScale);
      }
    }

    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 2.6;
      this.lightningBoltMesh.visibility = 1.0;
      this.lightningBoltMesh.position.x = (Math.random() - 0.5) * 70;
      this.lightningTimer = 9 + Math.random() * 11;
      this.justStruckLightning = true;
    }
    if (this.lightningLight.intensity > 0.02) {
      this.lightningLight.intensity *= Math.exp(-dt * 9);
      this.lightningBoltMesh.visibility = Math.min(1, this.lightningLight.intensity * 0.6);
    } else {
      this.lightningLight.intensity = 0;
      this.lightningBoltMesh.visibility = 0;
    }
  }

  public damageGate(amount: number) {
    this.gateHealth = Math.max(0, this.gateHealth - amount);
    const shake = (Math.random() - 0.5) * 0.32;
    this.gateLeftDoor.position.z = this.gateZ + shake;
    this.gateRightDoor.position.z = this.gateZ - shake;
  }

  public repairGate(amount: number) {
    this.gateHealth = Math.min(this.maxGateHealth, this.gateHealth + amount);
    this.gateLeftDoor.position.z = this.gateZ;
    this.gateRightDoor.position.z = this.gateZ;
  }
}
