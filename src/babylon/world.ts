import * as BABYLON from "@babylonjs/core";

export interface TurretSocket {
  id: number;
  name: string;
  pos: BABYLON.Vector3;
  type: string | null;
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
  public culvertHealth = 400;
  public maxCulvertHealth = 400;
  public culvertBreached = false;
  public culvertPos = new BABYLON.Vector3(-24.0, 1.2, -4.5);
  public culvertGrateNode?: BABYLON.TransformNode;

  public gateLeftDoor!: BABYLON.Mesh;
  public gateRightDoor!: BABYLON.Mesh;
  public shadowGenerator!: BABYLON.ShadowGenerator;
  public pipeline?: BABYLON.DefaultRenderingPipeline;
  public turretSockets: TurretSocket[] = [];
  public powderBarrels: PowderBarrel[] = [];
  public garrisonArchers: GarrisonArcher[] = [];
  public justStruckLightning = false;

  private torchLights: BABYLON.PointLight[] = [];
  private flameMeshes: BABYLON.Mesh[] = [];
  private bannerMeshes: BABYLON.Mesh[] = [];
  private mistClouds: BABYLON.Mesh[] = [];
  private lightningLight!: BABYLON.DirectionalLight;
  private lightningBoltMesh!: BABYLON.Mesh;
  private lightningTimer = 7.5;
  private rainLines: BABYLON.Mesh[] = [];
  private rainRipples: BABYLON.Mesh[] = [];

  private barrelWoodMat!: BABYLON.PBRMaterial;
  private barrelIronMat!: BABYLON.PBRMaterial;
  private barrelBandMat!: BABYLON.StandardMaterial;
  private barrelSparkMat!: BABYLON.StandardMaterial;
  private nextBarrelId = 1;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // 1. Cinematic ACES Tone Mapping & Stormy Atmosphere
    scene.clearColor = new BABYLON.Color4(0.02, 0.04, 0.08, 1.0);
    scene.ambientColor = new BABYLON.Color3(0.24, 0.29, 0.36);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.04, 0.07, 0.12);
    scene.fogDensity = 0.0036;

    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType =
      BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = 1.22;
    scene.imageProcessingConfiguration.contrast = 1.26;
    scene.imageProcessingConfiguration.vignetteEnabled = true;
    scene.imageProcessingConfiguration.vignetteWeight = 1.85;
    scene.imageProcessingConfiguration.vignetteColor = new BABYLON.Color4(0.01, 0.02, 0.04, 1);

    // Procedural Stormy Moonlit Environment CubeTexture for Realistic PBR Metal & Wet-Stone Reflections
    scene.environmentTexture = this.createStormEnvironmentCube();
    scene.environmentIntensity = 1.35;

    // Subtle GlowLayer for Embers, Runes & Lightning
    const glow = new BABYLON.GlowLayer("glow", scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 32,
    });
    glow.intensity = 0.36;

    // 2. Physically-Grounded Lighting Rig + Real-Time PCF Shadow Mapping
    const hemiLight = new BABYLON.HemisphericLight(
      "hemiLight",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    hemiLight.intensity = 0.62;
    hemiLight.diffuse = new BABYLON.Color3(0.52, 0.65, 0.85);
    hemiLight.groundColor = new BABYLON.Color3(0.15, 0.17, 0.22);

    const moonLight = new BABYLON.DirectionalLight(
      "moonLight",
      new BABYLON.Vector3(-0.35, -0.78, 0.52),
      scene,
    );
    moonLight.position = new BABYLON.Vector3(50, 110, -85);
    moonLight.intensity = 1.85;
    moonLight.diffuse = new BABYLON.Color3(0.78, 0.88, 1.0);
    moonLight.specular = new BABYLON.Color3(0.9, 0.95, 1.0);

    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, moonLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    this.shadowGenerator.bias = 0.0007;
    this.shadowGenerator.normalBias = 0.018;

    const gorgeLight = new BABYLON.DirectionalLight(
      "gorgeLight",
      new BABYLON.Vector3(0.12, -0.45, -0.88),
      scene,
    );
    gorgeLight.intensity = 0.92;
    gorgeLight.diffuse = new BABYLON.Color3(0.98, 0.78, 0.55);

    this.lightningLight = new BABYLON.DirectionalLight(
      "lightningLight",
      new BABYLON.Vector3(0.1, -0.92, 0.35),
      scene,
    );
    this.lightningLight.intensity = 0;
    this.lightningLight.diffuse = new BABYLON.Color3(0.85, 0.94, 1.0);

    // 3. Ultra-High-Resolution (1024x1024) Procedural PBR Textures & Normal Maps
    const stoneDiff = this.createDetailedAshlarTexture("stoneDiff", "#58626e", "#2d333b", 7, 3.5);
    const stoneNorm = this.createAshlarNormalMap("stoneNorm", 7, 3.5);
    const darkStoneDiff = this.createDetailedAshlarTexture("darkStoneDiff", "#3c434d", "#20252b", 5, 2.5);
    const darkStoneNorm = this.createAshlarNormalMap("darkStoneNorm", 5, 2.5);

    const roadDiff = this.createFlagstoneRoadTexture("roadDiff");
    const roadNorm = this.createFlagstoneNormalMap("roadNorm");

    const cliffDiff = this.createFracturedSlateCliffTexture("cliffDiff");
    const cliffNorm = this.createFracturedSlateNormalMap("cliffNorm");

    const woodDiff = this.createWeatheredWoodTexture("woodDiff");

    // PBR Fortress Masonry Material (wet rain-sheen stone)
    const wallMat = new BABYLON.PBRMaterial("wallMat", scene);
    wallMat.albedoTexture = stoneDiff;
    wallMat.bumpTexture = stoneNorm;
    wallMat.metallic = 0.08;
    wallMat.roughness = 0.62;

    const trimMat = new BABYLON.PBRMaterial("trimMat", scene);
    trimMat.albedoTexture = darkStoneDiff;
    trimMat.bumpTexture = darkStoneNorm;
    trimMat.metallic = 0.12;
    trimMat.roughness = 0.52;

    const slateRoofMat = new BABYLON.PBRMaterial("slateRoofMat", scene);
    slateRoofMat.albedoColor = new BABYLON.Color3(0.14, 0.18, 0.24);
    slateRoofMat.bumpTexture = darkStoneNorm;
    slateRoofMat.metallic = 0.22;
    slateRoofMat.roughness = 0.38;

    const woodMat = new BABYLON.PBRMaterial("woodMat", scene);
    woodMat.albedoTexture = woodDiff;
    woodMat.metallic = 0.04;
    woodMat.roughness = 0.72;
    this.barrelWoodMat = woodMat;

    const ironMat = new BABYLON.PBRMaterial("ironMat", scene);
    ironMat.albedoColor = new BABYLON.Color3(0.22, 0.25, 0.29);
    ironMat.metallic = 0.88;
    ironMat.roughness = 0.34;
    this.barrelIronMat = ironMat;

    const brassMat = new BABYLON.PBRMaterial("brassMat", scene);
    brassMat.albedoColor = new BABYLON.Color3(0.78, 0.58, 0.22);
    brassMat.metallic = 0.9;
    brassMat.roughness = 0.28;

    const valleyMat = new BABYLON.PBRMaterial("valleyMat", scene);
    valleyMat.albedoTexture = cliffDiff;
    valleyMat.bumpTexture = cliffNorm;
    valleyMat.metallic = 0.06;
    valleyMat.roughness = 0.58; // Rain-slicked mountain slate

    const roadMat = new BABYLON.PBRMaterial("roadMat", scene);
    roadMat.albedoTexture = roadDiff;
    roadMat.bumpTexture = roadNorm;
    roadMat.metallic = 0.14;
    roadMat.roughness = 0.32; // Wet rain-drenched flagstone reflections!

    this.barrelBandMat = new BABYLON.StandardMaterial("barrelBandMat", scene);
    this.barrelBandMat.diffuseColor = new BABYLON.Color3(0.7, 0.14, 0.1);
    this.barrelBandMat.emissiveColor = new BABYLON.Color3(0.28, 0.04, 0.02);

    this.barrelSparkMat = new BABYLON.StandardMaterial("barrelSparkMat", scene);
    this.barrelSparkMat.emissiveColor = new BABYLON.Color3(1.0, 0.68, 0.18);
    this.barrelSparkMat.disableLighting = true;

    // 4. Night Sky, Moon, Volumetric Moonlight God-Rays & Distant Mountains
    this.buildSkyAndHorizon(valleyMat);

    // 5. Realistic Hornburg Fortress, Arched Gatehouse, Portcullis & Chains
    this.buildFortress(wallMat, trimMat, slateRoofMat, woodMat, ironMat);

    // 5b. Deeping Wall Arched Culvert Drain Grate & Runoff Stream Channel
    this.buildCulvert(wallMat, trimMat, ironMat);

    // 6. Sculpted Canyon Floor, Wet Flagstone Causeway, Barricades & Mist
    this.buildCanyonAndRoad(valleyMat, roadMat, trimMat, woodMat, ironMat);

    // 7. Roadside & Battlement Flaming Braziers
    this.buildBraziers(ironMat);

    // 8. Turret Emplacement Sockets
    this.buildTurretSockets(brassMat, trimMat);

    // 9. Allied Royal Elven Sentinels on the Battlements
    this.buildGarrisonArchers(ironMat, brassMat, woodMat);

    // 10. Explosive Black-Powder Barrels along the Canyon Causeway
    this.spawnPowderBarrels();

    // 11. Atmospheric Rain Streaks & Wet Splash Ripples
    this.buildRain();
  }

  public setupPostPipeline(camera: BABYLON.Camera) {
    const pipeline = new BABYLON.DefaultRenderingPipeline(
      "helmsRenderPipeline",
      true,
      this.scene,
      [camera],
    );
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;

    // "ENHANCE" Crisp Optical Edge Sharpening
    pipeline.sharpenEnabled = true;
    pipeline.sharpen.edgeAmount = 0.42;
    pipeline.sharpen.colorAmount = 1.0;

    // Cinematic HDR Bloom on Torches, Flaming Bolts & Lightning
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.72;
    pipeline.bloomWeight = 0.42;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.5;

    // Dynamic Lens Chromatic Aberration (subtle at rest, pulses on zoom/explosions)
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 3.5;
    pipeline.chromaticAberration.radialIntensity = 0.8;

    // Subtle Dark-Fantasy Film Grain
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 5.0;
    pipeline.grain.animated = true;

    this.pipeline = pipeline;
  }

  private createStormEnvironmentCube(): BABYLON.RawCubeTexture {
    const size = 64;
    const faces: Uint8Array[] = [];

    for (let f = 0; f < 6; f++) {
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
        const v = y / (size - 1);
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          let r = 24;
          let g = 34;
          let b = 52;

          if (f === 2) {
            // +Y Top Sky Face (Moonlit indigo clouds)
            r = 48;
            g = 66;
            b = 98;
          } else if (f === 3) {
            // -Y Bottom Ground Face (Warm torchlit stone bounce)
            r = 42;
            g = 30;
            b = 22;
          } else {
            // Horizon faces: blend moonlit sky top to warm torchlit canyon bottom
            const skyMix = 1 - v;
            r = Math.round(38 * skyMix + 44 * v);
            g = Math.round(54 * skyMix + 34 * v);
            b = Math.round(82 * skyMix + 28 * v);
          }

          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
      faces.push(data);
    }

    return new BABYLON.RawCubeTexture(
      this.scene,
      faces,
      size,
      BABYLON.Engine.TEXTUREFORMAT_RGBA,
      BABYLON.Engine.TEXTURETYPE_UNSIGNED_INT,
      false,
    );
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
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = mortarHex;
    ctx.fillRect(0, 0, sz, sz);

    const rows = 12;
    const cols = 6;
    const rowH = sz / rows;
    const colW = sz / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const hVal = this.hash(r, c);
        ctx.fillStyle = baseHex;
        ctx.globalAlpha = 0.8 + hVal * 0.2;
        ctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);

        // Chiseled edge highlight
        ctx.strokeStyle = "rgba(180, 195, 215, 0.18)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, y + 4, colW - 8, rowH - 8);

        // Fine stone mineral streaks (smooth horizontal veining, zero blocky pixels)
        for (let g = 0; g < 14; g++) {
          const gx = x + 6 + this.hash(r * 13 + g, c) * (colW - 24);
          const gy = y + 6 + this.hash(c * 17 + g, r) * (rowH - 12);
          ctx.fillStyle = g % 2 === 0 ? "rgba(22, 26, 32, 0.16)" : "rgba(155, 170, 188, 0.12)";
          ctx.fillRect(gx, gy, 18 + (g % 18), 2);
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
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, sz, sz);

    const rows = 12;
    const cols = 6;
    const rowH = sz / rows;
    const colW = sz / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        ctx.fillStyle = "rgb(128, 190, 240)";
        ctx.fillRect(x + 3, y + 3, colW - 6, 4);
        ctx.fillStyle = "rgb(128, 68, 240)";
        ctx.fillRect(x + 3, y + rowH - 7, colW - 6, 4);
        ctx.fillStyle = "rgb(190, 128, 240)";
        ctx.fillRect(x + 3, y + 3, 4, rowH - 6);
        ctx.fillStyle = "rgb(68, 128, 240)";
        ctx.fillRect(x + colW - 7, y + 3, 4, rowH - 6);
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = uScale;
    tex.vScale = vScale;
    return tex;
  }

  private createFlagstoneRoadTexture(name: string): BABYLON.DynamicTexture {
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    // Dark wet mud/mortar base
    ctx.fillStyle = "#18191c";
    ctx.fillRect(0, 0, sz, sz);

    // Interlocking Irregular Medieval Flagstone Courses (Zero uniform polka-dots!)
    const rows = 20;
    const rowH = sz / rows;

    for (let r = 0; r < rows; r++) {
      let curX = -40 + (r % 2) * 32;
      while (curX < sz) {
        const slabW = 68 + Math.floor(this.hash(r, curX) * 58);
        const h1 = this.hash(curX, r * 7);
        const shade = Math.floor(54 + h1 * 34);
        const blueTint = Math.floor(shade * 1.08);

        // Beveled stone slab polygon with slight organic jitter
        ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${blueTint})`;
        ctx.beginPath();
        ctx.moveTo(curX + 3, r * rowH + 3);
        ctx.lineTo(curX + slabW - 3, r * rowH + 2 + (h1 - 0.5) * 3);
        ctx.lineTo(curX + slabW - 4, (r + 1) * rowH - 3);
        ctx.lineTo(curX + 4, (r + 1) * rowH - 2 - (h1 - 0.5) * 3);
        ctx.closePath();
        ctx.fill();

        // Chiseled top highlight
        ctx.strokeStyle = "rgba(165, 178, 195, 0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        curX += slabW;
      }
    }

    // Worn Dark Wheel Ruts & Rain Puddle Darkening along the Causeway
    const gradL = ctx.createLinearGradient(180, 0, 340, 0);
    gradL.addColorStop(0, "rgba(10, 12, 16, 0)");
    gradL.addColorStop(0.5, "rgba(10, 12, 16, 0.42)");
    gradL.addColorStop(1, "rgba(10, 12, 16, 0)");
    ctx.fillStyle = gradL;
    ctx.fillRect(180, 0, 160, sz);

    const gradR = ctx.createLinearGradient(680, 0, 840, 0);
    gradR.addColorStop(0, "rgba(10, 12, 16, 0)");
    gradR.addColorStop(0.5, "rgba(10, 12, 16, 0.42)");
    gradR.addColorStop(1, "rgba(10, 12, 16, 0)");
    ctx.fillStyle = gradR;
    ctx.fillRect(680, 0, 160, sz);

    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 2.5;
    tex.vScale = 22;
    return tex;
  }

  private createFlagstoneNormalMap(name: string): BABYLON.DynamicTexture {
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, sz, sz);

    const rows = 20;
    const rowH = sz / rows;
    for (let r = 0; r < rows; r++) {
      let curX = -40 + (r % 2) * 32;
      while (curX < sz) {
        const slabW = 68 + Math.floor(this.hash(r, curX) * 58);
        ctx.fillStyle = "rgb(128, 178, 245)";
        ctx.fillRect(curX + 3, r * rowH + 3, slabW - 6, 3);
        ctx.fillStyle = "rgb(128, 78, 245)";
        ctx.fillRect(curX + 3, (r + 1) * rowH - 6, slabW - 6, 3);
        ctx.fillStyle = "rgb(178, 128, 245)";
        ctx.fillRect(curX + 3, r * rowH + 3, 3, rowH - 6);
        curX += slabW;
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 2.5;
    tex.vScale = 22;
    return tex;
  }

  private createFracturedSlateCliffTexture(name: string): BABYLON.DynamicTexture {
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = "#1a2028";
    ctx.fillRect(0, 0, sz, sz);

    // Smooth Layered Geological Rock Strata & Diagonal Fault Ridges (Zero blocky squares!)
    for (let band = 0; band < 85; band++) {
      const baseY = (band / 85) * sz;
      const h = this.hash(band, 19);
      const v = Math.floor(26 + h * 28);
      ctx.strokeStyle = `rgba(${v}, ${v + 5}, ${v + 11}, 0.55)`;
      ctx.lineWidth = 6 + (band % 12);
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 64; x <= sz; x += 64) {
        const wave = Math.sin(x * 0.012 + band * 0.7) * 14 + (this.hash(x, band) - 0.5) * 10;
        ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }

    // Sharp Dark Rock Fissures & Crevices
    for (let f = 0; f < 45; f++) {
      let fx = this.hash(f, 3) * sz;
      let fy = this.hash(f, 9) * sz;
      ctx.strokeStyle = "rgba(8, 11, 15, 0.65)";
      ctx.lineWidth = 2 + (f % 3);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      for (let s = 0; s < 6; s++) {
        fx += 28 + this.hash(f + s, 21) * 35;
        fy += (this.hash(s, f * 5) - 0.35) * 42;
        ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }

    // Subtle Wet Rain-Runoff Vertical Sheen Streaks
    for (let w = 0; w < 60; w++) {
      const wx = this.hash(w, 77) * sz;
      const wy = this.hash(w, 91) * sz;
      ctx.fillStyle = "rgba(130, 155, 185, 0.06)";
      ctx.fillRect(wx, wy, 3, 90 + (w % 80));
    }

    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 6;
    tex.vScale = 8;
    return tex;
  }

  private createFracturedSlateNormalMap(name: string): BABYLON.DynamicTexture {
    const sz = 1024;
    const tex = new BABYLON.DynamicTexture(name, { width: sz, height: sz }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = "rgb(128, 128, 255)";
    ctx.fillRect(0, 0, sz, sz);

    for (let band = 0; band < 75; band++) {
      const baseY = (band / 75) * sz;
      ctx.strokeStyle = band % 2 === 0 ? "rgb(128, 175, 242)" : "rgb(128, 82, 242)";
      ctx.lineWidth = 4 + (band % 6);
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      for (let x = 64; x <= sz; x += 64) {
        const wave = Math.sin(x * 0.012 + band * 0.7) * 14;
        ctx.lineTo(x, baseY + wave);
      }
      ctx.stroke();
    }

    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.uScale = 6;
    tex.vScale = 8;
    return tex;
  }

  private createWeatheredWoodTexture(name: string): BABYLON.DynamicTexture {
    const tex = new BABYLON.DynamicTexture(name, { width: 512, height: 512 }, this.scene, true);
    const ctx = tex.getContext();
    ctx.fillStyle = "#2b1a0e";
    ctx.fillRect(0, 0, 512, 512);

    for (let p = 0; p < 8; p++) {
      const x = p * 64;
      ctx.fillStyle = p % 2 === 0 ? "#382213" : "#2c1a0e";
      ctx.fillRect(x + 2, 0, 60, 512);
      for (let g = 0; g < 36; g++) {
        ctx.fillStyle = "rgba(16, 8, 3, 0.35)";
        ctx.fillRect(x + 4 + (g % 54), (g * 43) % 512, 2, 48);
      }
    }
    tex.update();
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  private buildSkyAndHorizon(valleyMat: BABYLON.PBRMaterial) {
    const moonMat = new BABYLON.StandardMaterial("moonDiscMat", this.scene);
    moonMat.emissiveColor = new BABYLON.Color3(0.88, 0.94, 1.0);
    moonMat.disableLighting = true;

    const moon = BABYLON.MeshBuilder.CreateDisc(
      "fullMoon",
      { radius: 14, tessellation: 32 },
      this.scene,
    );
    moon.position.set(38, 88, -230);
    moon.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    moon.material = moonMat;

    // Soft Outer Moon Halo
    const haloMat = new BABYLON.StandardMaterial("moonHaloMat", this.scene);
    haloMat.emissiveColor = new BABYLON.Color3(0.35, 0.5, 0.72);
    haloMat.alpha = 0.22;
    haloMat.disableLighting = true;
    const moonHalo = BABYLON.MeshBuilder.CreateDisc(
      "moonHalo",
      { radius: 32, tessellation: 32 },
      this.scene,
    );
    moonHalo.position.set(38, 88, -232);
    moonHalo.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    moonHalo.material = haloMat;

    // Volumetric Moonlight God-Ray Shafts slicing diagonally across the canyon
    const rayMat = new BABYLON.StandardMaterial("godRayMat", this.scene);
    rayMat.emissiveColor = new BABYLON.Color3(0.32, 0.48, 0.72);
    rayMat.alpha = 0.022;
    rayMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    rayMat.disableLighting = true;
    rayMat.backFaceCulling = false;

    for (let i = 0; i < 3; i++) {
      const ray = BABYLON.MeshBuilder.CreateCylinder(
        `moonGodRay_${i}`,
        { diameterTop: 8, diameterBottom: 28, height: 155, tessellation: 16, cap: BABYLON.Mesh.NO_CAP },
        this.scene,
      );
      ray.position.set(18 - i * 16, 56, -72 - i * 38);
      ray.rotation.z = 0.34;
      ray.rotation.x = -0.15;
      ray.material = rayMat;
    }

    // 3D Forked Lightning Bolt in the distant storm clouds
    const boltMat = new BABYLON.StandardMaterial("skyLightningMat", this.scene);
    boltMat.emissiveColor = new BABYLON.Color3(0.85, 0.96, 1.0);
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
      { path: boltPoints, radius: 0.7, tessellation: 6 },
      this.scene,
    );
    this.lightningBoltMesh.material = boltMat;
    this.lightningBoltMesh.visibility = 0;

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
    wallMat: BABYLON.PBRMaterial,
    trimMat: BABYLON.PBRMaterial,
    slateRoofMat: BABYLON.PBRMaterial,
    woodMat: BABYLON.PBRMaterial,
    ironMat: BABYLON.PBRMaterial,
  ) {
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
    bannerMat.diffuseColor = new BABYLON.Color3(0.55, 0.1, 0.1);
    bannerMat.specularColor = new BABYLON.Color3(0.12, 0.05, 0.05);

    for (const side of [-1, 1]) {
      const gx = side * 9.8;
      const drum = BABYLON.MeshBuilder.CreateCylinder(
        `gateDrum_${side}`,
        { diameterTop: 5.2, diameterBottom: 6.2, height: 9.6, tessellation: 20 },
        this.scene,
      );
      drum.position.set(gx, 4.8, this.gateZ + 0.5);
      drum.material = wallMat;
      drum.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(drum);

      const drumRim = BABYLON.MeshBuilder.CreateTorus(
        `drumRim_${side}`,
        { diameter: 5.5, thickness: 0.55, tessellation: 20 },
        this.scene,
      );
      drumRim.position.set(gx, 9.5, this.gateZ + 0.5);
      drumRim.material = trimMat;

      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI * 2) / 8;
        const tooth = BABYLON.MeshBuilder.CreateBox(
          `drumTooth_${side}_${a}`,
          { width: 0.95, height: 0.85, depth: 0.55 },
          this.scene,
        );
        tooth.position.set(
          gx + Math.sin(ang) * 2.45,
          10.0,
          this.gateZ + 0.5 + Math.cos(ang) * 2.45,
        );
        tooth.rotation.y = ang;
        tooth.material = trimMat;
      }

      const banner = BABYLON.MeshBuilder.CreatePlane(
        `banner_${side}`,
        { width: 1.3, height: 3.8, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
        this.scene,
      );
      banner.position.set(gx, 5.6, this.gateZ - 2.5);
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

      // Hanging Iron Drawbridge / Portcullis Chains
      const chain = BABYLON.MeshBuilder.CreateCylinder(
        `gateChain_${side}`,
        { diameter: 0.14, height: 5.5, tessellation: 8 },
        this.scene,
      );
      chain.position.set(side * 5.6, 5.8, this.gateZ - 0.9);
      chain.rotation.x = 0.18;
      chain.material = ironMat;
    }

    // Layered Crenellated Gatehouse Bridge & Machicolation Gallery
    const gateLintel = BABYLON.MeshBuilder.CreateBox(
      "gateLintel",
      { width: 17.5, height: 2.2, depth: 2.8 },
      this.scene,
    );
    gateLintel.position.set(0, 7.5, this.gateZ);
    gateLintel.material = trimMat;
    this.shadowGenerator.addShadowCaster(gateLintel);

    // Battlement Merlons along top of Gatehouse Bridge
    for (let mx = -6.0; mx <= 6.0; mx += 2.4) {
      const gMerlon = BABYLON.MeshBuilder.CreateBox(
        `gateMerlon_${mx}`,
        { width: 1.35, height: 0.85, depth: 0.55 },
        this.scene,
      );
      gMerlon.position.set(mx, 9.0, this.gateZ - 1.1);
      gMerlon.material = wallMat;
    }

    // Murder-Hole Boiling Pitch Spouts
    for (const sx of [-4.5, 0, 4.5]) {
      const cauldronSpout = BABYLON.MeshBuilder.CreateCylinder(
        `murderSpout_${sx}`,
        { diameterTop: 0.7, diameterBottom: 0.95, height: 1.2, tessellation: 12 },
        this.scene,
      );
      cauldronSpout.rotation.x = Math.PI / 3;
      cauldronSpout.position.set(sx, 8.1, this.gateZ - 1.3);
      cauldronSpout.material = ironMat;
    }

    // Forged Iron Portcullis Bars + Spiked Bottom Teeth
    for (let px = -5.0; px <= 5.0; px += 1.25) {
      const bar = BABYLON.MeshBuilder.CreateCylinder(
        `portcullisV_${px}`,
        { diameter: 0.18, height: 6.8, tessellation: 8 },
        this.scene,
      );
      bar.position.set(px, 3.4, this.gateZ - 0.58);
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
    gateSpot.intensity = 3.0;
    gateSpot.diffuse = new BABYLON.Color3(1.0, 0.78, 0.45);
  }

  private buildCanyonAndRoad(
    valleyMat: BABYLON.PBRMaterial,
    roadMat: BABYLON.PBRMaterial,
    cliffMat: BABYLON.PBRMaterial,
    woodMat: BABYLON.PBRMaterial,
    ironMat: BABYLON.PBRMaterial,
  ) {
    const ground = BABYLON.MeshBuilder.CreateGround(
      "valleyGround",
      { width: 180, height: 230, subdivisions: 84, updatable: true },
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
      { width: 20, height: 205, subdivisions: 12 },
      this.scene,
    );
    road.position.set(0, 0.08, -115);
    road.material = roadMat;
    road.receiveShadows = true;

    for (const side of [-1, 1]) {
      const curb = BABYLON.MeshBuilder.CreateBox(
        `roadCurb_${side}`,
        { width: 1.35, height: 0.75, depth: 195 },
        this.scene,
      );
      curb.position.set(side * 10.4, 0.36, -115);
      curb.material = cliffMat;
      curb.receiveShadows = true;
    }

    // Spiked Wooden Cheval-de-Frise Siege Barricades
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

    // Rolling Low-Lying Canyon Ground Mist Banks
    const mistMat = new BABYLON.StandardMaterial("canyonMistMat", this.scene);
    mistMat.emissiveColor = new BABYLON.Color3(0.18, 0.28, 0.42);
    mistMat.alpha = 0.08;
    mistMat.disableLighting = true;

    for (let m = 0; m < 10; m++) {
      const mist = BABYLON.MeshBuilder.CreateDisc(
        `canyonMist_${m}`,
        { radius: 9 + (m % 4) * 2.5, tessellation: 16 },
        this.scene,
      );
      mist.rotation.x = Math.PI / 2;
      mist.position.set(((m % 2) - 0.5) * 8, 0.45 + (m % 3) * 0.25, -34 - m * 14);
      mist.material = mistMat;
      this.mistClouds.push(mist);
    }

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
        boulder.material = cliffMat;
        boulder.receiveShadows = true;
      }
    }
  }

  private buildGarrisonArchers(
    ironMat: BABYLON.PBRMaterial,
    brassMat: BABYLON.PBRMaterial,
    woodMat: BABYLON.PBRMaterial,
  ) {
    const cloakMat = new BABYLON.StandardMaterial("sentinelCloakMat", this.scene);
    cloakMat.diffuseColor = new BABYLON.Color3(0.12, 0.2, 0.34);
    cloakMat.specularColor = new BABYLON.Color3(0.1, 0.12, 0.18);

    const archerXPositions = [-28, -19.5, -14.2, 14.2, 19.5, 28];

    archerXPositions.forEach((ax, idx) => {
      const root = new BABYLON.TransformNode(`sentinel_${idx}`, this.scene);
      const pos = new BABYLON.Vector3(ax, this.wallParapetY + 0.4, -6.1);
      root.position.copyFrom(pos);
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
      bowArm.rotation.x = 0.35;
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
        { diameterTop: 1.05, diameterBottom: 1.05, height: 1.45, tessellation: 16 },
        this.scene,
      );
      cask.position.y = 0.72;
      cask.material = this.barrelWoodMat;
      cask.parent = root;
      this.shadowGenerator.addShadowCaster(cask);

      const band = BABYLON.MeshBuilder.CreateCylinder(
        `caskBand_${id}`,
        { diameterTop: 1.12, diameterBottom: 1.12, height: 0.38, tessellation: 16 },
        this.scene,
      );
      band.position.y = 0.72;
      band.material = this.barrelBandMat;
      band.parent = root;

      for (const hy of [0.22, 1.22]) {
        const hoop = BABYLON.MeshBuilder.CreateTorus(
          `caskHoop_${id}_${hy}`,
          { diameter: 1.08, thickness: 0.08, tessellation: 16 },
          this.scene,
        );
        hoop.position.y = hy;
        hoop.material = this.barrelIronMat;
        hoop.parent = root;
      }

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

  private buildBraziers(ironMat: BABYLON.PBRMaterial) {
    const flameMat = new BABYLON.StandardMaterial("brazierFlameMat", this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.5, 0.09);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.65, 0.15);

    const emberMat = new BABYLON.StandardMaterial("brazierEmberMat", this.scene);
    emberMat.emissiveColor = new BABYLON.Color3(0.95, 0.25, 0.02);

    const brazierCoords = [
      { x: -20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 9.5, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: 20, y: this.wallParapetY + 0.5, z: -6.2, range: 22 },
      { x: -11.0, y: 1.4, z: -30, range: 34 },
      { x: 11.0, y: 1.4, z: -30, range: 34 },
      { x: -11.0, y: 1.4, z: -52, range: 36 },
      { x: 11.0, y: 1.4, z: -52, range: 36 },
      { x: -11.0, y: 1.4, z: -76, range: 36 },
      { x: 11.0, y: 1.4, z: -76, range: 36 },
      { x: -11.0, y: 1.4, z: -102, range: 36 },
      { x: 11.0, y: 1.4, z: -102, range: 36 },
      { x: -11.0, y: 1.4, z: -130, range: 36 },
      { x: 11.0, y: 1.4, z: -130, range: 36 },
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
        pt.intensity = 1.35;
        pt.range = b.range;
        this.torchLights.push(pt);
      }
    });
  }

  private buildTurretSockets(brassMat: BABYLON.PBRMaterial, trimMat: BABYLON.PBRMaterial) {
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

      const ring = BABYLON.MeshBuilder.CreateTorus(
        `socketRing_${s.id}`,
        { diameter: 3.1, thickness: 0.14, tessellation: 24 },
        this.scene,
      );
      ring.position.set(s.pos.x, s.pos.y + 0.2, s.pos.z);
      ring.material = brassMat;
    }
  }

  private buildRain() {
    const rainMat = new BABYLON.StandardMaterial("rainMat", this.scene);
    rainMat.emissiveColor = new BABYLON.Color3(0.52, 0.68, 0.85);
    rainMat.alpha = 0.24;
    rainMat.disableLighting = true;

    for (let i = 0; i < 110; i++) {
      const drop = BABYLON.MeshBuilder.CreateCylinder(
        `rain_${i}`,
        { diameter: 0.024, height: 2.3, tessellation: 4 },
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

    const rippleMat = new BABYLON.StandardMaterial("rippleMat", this.scene);
    rippleMat.emissiveColor = new BABYLON.Color3(0.58, 0.72, 0.9);
    rippleMat.alpha = 0.26;
    rippleMat.disableLighting = true;

    for (let i = 0; i < 26; i++) {
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `rainRipple_${i}`,
        { diameter: 0.48, thickness: 0.03, tessellation: 14 },
        this.scene,
      );
      ring.position.set((Math.random() - 0.5) * 17, 0.11, -28 - Math.random() * 95);
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
      this.torchLights[i].intensity = 1.35 + Math.sin(time * 2.2 + i) * 0.24;
    }
    for (let i = 0; i < this.bannerMeshes.length; i++) {
      this.bannerMeshes[i].rotation.x = Math.sin(time * 1.1 + i) * 0.11;
      this.bannerMeshes[i].rotation.z = Math.cos(time * 0.8 + i) * 0.04;
    }

    // Drift canyon ground mist gently toward the fortress
    for (let i = 0; i < this.mistClouds.length; i++) {
      const m = this.mistClouds[i];
      m.position.x += Math.sin(time * 0.25 + i) * dt * 0.8;
      m.position.z += dt * 1.4;
      if (m.position.z > -26) {
        m.position.z = -175;
      }
    }

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
      if (nextScale > 1.35) {
        rp.scaling.setAll(0.15);
        rp.position.x = (Math.random() - 0.5) * 17;
        rp.position.z = -28 - Math.random() * 95;
      } else {
        rp.scaling.setAll(nextScale);
      }
    }

    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningLight.intensity = 2.8;
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

  public damageCulvert(amount: number): boolean {
    if (this.culvertBreached) return false;
    this.culvertHealth = Math.max(0, this.culvertHealth - amount);
    if (this.culvertHealth <= 0) {
      this.culvertBreached = true;
      if (this.culvertGrateNode) {
        this.culvertGrateNode.position.y = -12;
      }
      return true; // Just breached!
    }
    return false;
  }

  public repairCulvert(amount: number) {
    this.culvertHealth = Math.min(this.maxCulvertHealth, this.culvertHealth + amount);
    if (this.culvertHealth > 0 && this.culvertBreached) {
      this.culvertBreached = false;
      if (this.culvertGrateNode) {
        this.culvertGrateNode.position.y = 0;
      }
    }
  }

  private buildCulvert(
    wallMat: BABYLON.PBRMaterial,
    trimMat: BABYLON.PBRMaterial,
    ironMat: BABYLON.PBRMaterial,
  ) {
    const cx = this.culvertPos.x; // -24.0
    const cz = this.culvertPos.z; // -4.5

    // Archway Stone Lintel Portal
    const archTop = BABYLON.MeshBuilder.CreateTorus(
      "culvertArchTop",
      { diameter: 4.8, thickness: 1.15, tessellation: 20 },
      this.scene,
    );
    archTop.position.set(cx, 2.5, cz - 1.2);
    archTop.rotation.z = Math.PI / 2;
    archTop.material = trimMat;

    const archL = BABYLON.MeshBuilder.CreateBox(
      "culvertPillarL",
      { width: 1.3, height: 2.8, depth: 3.8 },
      this.scene,
    );
    archL.position.set(cx - 2.1, 1.4, cz - 0.8);
    archL.material = trimMat;

    const archR = BABYLON.MeshBuilder.CreateBox(
      "culvertPillarR",
      { width: 1.3, height: 2.8, depth: 3.8 },
      this.scene,
    );
    archR.position.set(cx + 2.1, 1.4, cz - 0.8);
    archR.material = trimMat;

    // Heavy Wrought-Iron Sewer Drainage Grate
    this.culvertGrateNode = new BABYLON.TransformNode("culvertGrateGroup", this.scene);
    this.culvertGrateNode.position.set(cx, 0, cz - 0.8);

    for (let bx = -1.6; bx <= 1.6; bx += 0.45) {
      const bar = BABYLON.MeshBuilder.CreateCylinder(
        `culvertBar_${bx}`,
        { diameter: 0.14, height: 2.8, tessellation: 8 },
        this.scene,
      );
      bar.position.set(bx, 1.4, 0);
      bar.material = ironMat;
      bar.parent = this.culvertGrateNode;
    }

    for (const by of [0.85, 1.95]) {
      const crossBar = BABYLON.MeshBuilder.CreateCylinder(
        `culvertCross_${by}`,
        { diameter: 0.13, height: 3.4, tessellation: 8 },
        this.scene,
      );
      crossBar.rotation.z = Math.PI / 2;
      crossBar.position.set(0, by, 0);
      crossBar.material = ironMat;
      crossBar.parent = this.culvertGrateNode;
    }

    // Murky Runoff Drainage Water Stream Channel
    const waterMat = new BABYLON.PBRMaterial("culvertWaterMat", this.scene);
    waterMat.albedoColor = new BABYLON.Color3(0.08, 0.14, 0.18);
    waterMat.metallic = 0.92;
    waterMat.roughness = 0.08;
    waterMat.alpha = 0.82;

    const stream = BABYLON.MeshBuilder.CreateGround(
      "culvertWaterStream",
      { width: 3.8, height: 28 },
      this.scene,
    );
    stream.position.set(cx, 0.06, -18.0);
    stream.material = waterMat;

    // Culvert Sconce Lantern Flame
    const sconceFlame = BABYLON.MeshBuilder.CreateCylinder(
      "culvertTorchFlame",
      { diameterTop: 0.02, diameterBottom: 0.35, height: 0.65, tessellation: 8 },
      this.scene,
    );
    sconceFlame.position.set(cx, 4.2, cz - 1.8);
    const flameMat = new BABYLON.StandardMaterial("culvertFlameMat", this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.52, 0.1);
    flameMat.disableLighting = true;
    sconceFlame.material = flameMat;
    this.flameMeshes.push(sconceFlame);
  }
}
