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
  public shadowGenerator!: BABYLON.ShadowGenerator;
  public turretSockets: TurretSocket[] = [];

  private torchLights: BABYLON.PointLight[] = [];
  private flameMeshes: BABYLON.Mesh[] = [];
  private bannerMeshes: BABYLON.Mesh[] = [];
  private lightningLight!: BABYLON.DirectionalLight;
  private lightningTimer = 11;
  private rainLines: BABYLON.Mesh[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // 1. Cinematic ACES Tone Mapping & Atmospheric Grading
    scene.clearColor = new BABYLON.Color4(0.03, 0.05, 0.09, 1.0);
    scene.ambientColor = new BABYLON.Color3(0.24, 0.29, 0.36);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.05, 0.08, 0.13);
    scene.fogDensity = 0.0042;

    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.15;
    scene.imageProcessingConfiguration.contrast = 1.22;
    scene.imageProcessingConfiguration.vignetteEnabled = true;
    scene.imageProcessingConfiguration.vignetteWeight = 1.8;
    scene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0.01, 0.02, 0.04, 1);

    // Subtle Realistic Bloom/Glow for Fire & Embers
    const glow = new BABYLON.GlowLayer("glow", scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 32,
    });
    glow.intensity = 0.38;

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
    gorgeLight.intensity = 0.85;
    gorgeLight.diffuse = new BABYLON.Color3(0.95, 0.76, 0.55);

    this.lightningLight = new BABYLON.DirectionalLight(
      "lightningLight",
      new BABYLON.Vector3(0, -1, 0.2),
      scene,
    );
    this.lightningLight.intensity = 0;
    this.lightningLight.diffuse = new BABYLON.Color3(0.85, 0.92, 1.0);

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

    const ironMat = new BABYLON.StandardMaterial("ironMat", scene);
    ironMat.diffuseColor = new BABYLON.Color3(0.18, 0.2, 0.23);
    ironMat.specularColor = new BABYLON.Color3(0.72, 0.76, 0.82);
    ironMat.specularPower = 64;

    const brassMat = new BABYLON.StandardMaterial("brassMat", scene);
    brassMat.diffuseColor = new BABYLON.Color3(0.68, 0.5, 0.18);
    brassMat.specularColor = new BABYLON.Color3(0.95, 0.82, 0.45);
    brassMat.specularPower = 48;

    const valleyMat = new BABYLON.StandardMaterial("valleyMat", scene);
    valleyMat.diffuseTexture = cliffDiff;
    valleyMat.bumpTexture = cliffNorm;
    valleyMat.specularColor = new BABYLON.Color3(0.16, 0.19, 0.22); // Wet rain sheen on rock
    valleyMat.specularPower = 20;

    const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
    roadMat.diffuseTexture = roadDiff;
    roadMat.bumpTexture = roadNorm;
    roadMat.specularColor = new BABYLON.Color3(0.38, 0.42, 0.48); // Wet rain-slick cobblestone reflection
    roadMat.specularPower = 36;

    // 4. Night Sky Dome, Moon & Distant Horizon Mountains
    this.buildSkyAndHorizon(valleyMat);

    // 5. Build the Realistic Hornburg Fortress, Portcullis & Machicolations
    this.buildFortress(wallMat, trimMat, slateRoofMat, woodMat, ironMat);

    // 6. Build the Sculpted Canyon Floor, Causeway & Boulders
    this.buildCanyonAndRoad(valleyMat, roadMat, trimMat);

    // 7. Build Roadside & Battlement Flaming Braziers
    this.buildBraziers(ironMat);

    // 8. Build Turret Emplacement Sockets
    this.buildTurretSockets(brassMat, trimMat);

    // 9. Atmospheric Rain Streaks
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

        // Weathering streaks & stone grain inside each block
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
    // Neutral tangent-space normal (#8080ff)
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
        // Bevel highlights & shadows in normal map channels
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
    // Dark wet mud/mortar base
    ctx.fillStyle = "#1f1d1a";
    ctx.fillRect(0, 0, 512, 512);

    // Interlocking irregular stone cobbles in staggered courses
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

        // Highlight edge on stone
        ctx.strokeStyle = `rgba(160, 155, 145, 0.22)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Subtle wheel-rut darkening along the road tracks
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

    // Fine-grained layered rock strata & lichen
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
    // Glowing Full Moon high in the night sky beyond the gorge
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

    // Distant Jagged Mountain Horizon closing off the far end of the valley so it never looks cut off
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

    // Walkway Deck surface along the rampart
    const walkway = BABYLON.MeshBuilder.CreateBox(
      "walkway",
      { width: 96, height: 0.4, depth: 5.4 },
      this.scene,
    );
    walkway.position.set(0, this.wallParapetY + 0.2, -4.2);
    walkway.material = trimMat;
    walkway.receiveShadows = true;

    // Stone Buttresses & Machicolations along the Wall Face
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
    bannerMat.diffuseColor = new BABYLON.Color3(0.45, 0.1, 0.1);
    bannerMat.specularColor = new BABYLON.Color3(0.1, 0.05, 0.05);

    for (const side of [-1, 1]) {
      const gx = side * 9.8;
      // Octagonal/Cylindrical Fortress Gatehouse Drum Towers with Crenellated Parapets
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

      // Crenellation teeth around top of each Gatehouse Drum Tower
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

      // Crimson Royal War-Banners hanging on the Gatehouse Drum Towers
      const banner = BABYLON.MeshBuilder.CreatePlane(
        `banner_${side}`,
        { width: 1.2, height: 3.6, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
        this.scene,
      );
      banner.position.set(gx, 5.5, this.gateZ - 2.35);
      banner.material = bannerMat;
      this.bannerMeshes.push(banner);

      // Barbican Wing Wall with Stone Crenellations connecting Main Wall to Gatehouse Drum
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

    // Stone Gatehouse Archway Lintel & Machicolations over the Gate Doors at Z = -28.0
    const gateLintel = BABYLON.MeshBuilder.CreateBox(
      "gateLintel",
      { width: 17.5, height: 2.0, depth: 2.6 },
      this.scene,
    );
    gateLintel.position.set(0, 7.4, this.gateZ);
    gateLintel.material = trimMat;
    this.shadowGenerator.addShadowCaster(gateLintel);

    // Iron Portcullis Grate (Vertical & Horizontal Iron Bars over the Gatehouse Arch)
    for (let px = -5.0; px <= 5.0; px += 1.25) {
      const bar = BABYLON.MeshBuilder.CreateCylinder(
        `portcullisV_${px}`,
        { diameter: 0.16, height: 6.8, tessellation: 8 },
        this.scene,
      );
      bar.position.set(px, 3.4, this.gateZ - 0.55);
      bar.material = ironMat;
    }

    // Double Timber & Iron-Bound Gate Doors at Z = -28.0
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

    // Overhead Warm Spotlight illuminating the Gatehouse Courtyard & Approach
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
  ) {
    // Valley Ground Plane with organic jagged crags flanking the central road
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

    // Wide 20m Wet Cobblestone Approach Road
    const road = BABYLON.MeshBuilder.CreateGround(
      "siegeRoad",
      { width: 20, height: 205, subdivisions: 8 },
      this.scene,
    );
    road.position.set(0, 0.08, -115);
    road.material = roadMat;
    road.receiveShadows = true;

    // Weathered Stone Parapet Curbs & Rugged Boulders along the road edges
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

    // Scattered Craggy Boulders & Rock Outcrops along the Canyon Sides
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

  private buildBraziers(ironMat: BABYLON.StandardMaterial) {
    const flameMat = new BABYLON.StandardMaterial("brazierFlameMat", this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.48, 0.08);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.65, 0.15);

    const emberMat = new BABYLON.StandardMaterial("brazierEmberMat", this.scene);
    emberMat.emissiveColor = new BABYLON.Color3(0.95, 0.25, 0.02);

    const brazierCoords = [
      // Battlement Braziers
      { x: -20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      // Gatehouse & Roadside Torches lighting the entire canyon approach
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
      // Tripod iron pillar + bowl
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

      // Multi-tongue sculpted fire
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
    rainMat.alpha = 0.22;
    rainMat.disableLighting = true;

    for (let i = 0; i < 95; i++) {
      const drop = BABYLON.MeshBuilder.CreateCylinder(
        `rain_${i}`,
        { diameter: 0.025, height: 2.1, tessellation: 4 },
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
  }

  public update(dt: number) {
    const time = performance.now() * 0.006;

    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      const s = 0.88 + Math.sin(time * 2.5 + i * 1.3) * 0.16;
      f.scaling.set(s, 0.85 + Math.cos(time * 3.2 + i) * 0.22, s);
    }
    for (let i = 0; i < this.torchLights.length; i++) {
      this.torchLights[i].intensity = 1.25 + Math.sin(time * 2.2 + i) * 0.22;
    }
    for (let i = 0; i < this.bannerMeshes.length; i++) {
      this.bannerMeshes[i].rotation.x = Math.sin(time * 0.8 + i) * 0.08;
    }

    for (const r of this.rainLines) {
      r.position.y -= 62 * dt;
      if (r.position.y < 1) {
        r.position.y = 42 + Math.random() * 8;
        r.position.x = (Math.random() - 0.5) * 90;
        r.position.z = -Math.random() * 130 - 10;
      }
    }

    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 2.0;
      this.lightningTimer = 10 + Math.random() * 12;
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
