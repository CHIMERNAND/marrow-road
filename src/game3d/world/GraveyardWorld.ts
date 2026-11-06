import * as THREE from "three";
import { buildWorld, TOWERS, type TowerId } from "@/game/data";
import { gridToWorld, GRID_COLS, GRID_ROWS, TILE_SIZE } from "@/game3d/types";
import {
  createChapel,
  createCryptGate,
  createDeadTree,
  createTombstone,
  createWatchtowerBattlement,
  materials,
} from "@/game3d/models/ProceduralGeometries";

export class GraveyardWorld {
  public group: THREE.Group;
  public worldData: ReturnType<typeof buildWorld>;
  public pickPlane: THREE.Mesh;
  public hoverRing: THREE.Mesh;
  public hoverRangeDisc: THREE.Mesh;
  public selectRing: THREE.Mesh;
  public selectRangeDisc: THREE.Mesh;

  private validMat = new THREE.MeshBasicMaterial({
    color: 0x00ffaa,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  private invalidMat = new THREE.MeshBasicMaterial({
    color: 0xff2244,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  private selectMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  constructor() {
    this.group = new THREE.Group();
    this.worldData = buildWorld();

    // 1. Base Graveyard Ground Slab
    const groundW = GRID_COLS * TILE_SIZE + 4;
    const groundH = GRID_ROWS * TILE_SIZE + 4;
    const groundGeo = new THREE.BoxGeometry(groundW, 0.4, groundH);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x223027, // visible crypt moss
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // 2. Large Invisible Pick Plane for Raycasting
    const pickGeo = new THREE.PlaneGeometry(120, 120);
    const pickMat = new THREE.MeshBasicMaterial({ visible: false });
    this.pickPlane = new THREE.Mesh(pickGeo, pickMat);
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = 0.01;
    this.group.add(this.pickPlane);

    // 3. Populate Tiles
    this.buildTiles();

    // 4. Perimeter Iron Fence
    this.buildPerimeterFence(groundW, groundH);

    // 5. Gate & Chapel with Local Illumination
    const gatePos = gridToWorld(0, 0);
    const gate = createCryptGate();
    gate.position.set(gatePos.x - 0.2, 0, gatePos.z);
    gate.rotation.y = Math.PI / 2;
    this.group.add(gate);

    const gateLight = new THREE.PointLight(0x55ffaa, 2.5, 9);
    gateLight.position.set(gatePos.x, 1.6, gatePos.z);
    this.group.add(gateLight);

    const chapelPos = gridToWorld(7, 11);
    const chapel = createChapel();
    chapel.position.set(chapelPos.x + 0.3, 0, chapelPos.z);
    chapel.rotation.y = -Math.PI / 2;
    this.group.add(chapel);

    const chapelLight = new THREE.PointLight(0xffaa44, 3.8, 12);
    chapelLight.position.set(chapelPos.x, 2.0, chapelPos.z);
    this.group.add(chapelLight);

    // Watchtower Battlement (The Defender's Perch)
    const battlement = createWatchtowerBattlement();
    this.group.add(battlement.group);

    // 6. Hover & Selection Rings (Elevated at Y = 0.12 to always render cleanly over road/grass)
    const ringGeo = new THREE.RingGeometry(0.85, 1.08, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.hoverRing = new THREE.Mesh(ringGeo, this.validMat);
    this.hoverRing.position.y = 0.12;
    this.hoverRing.visible = false;
    this.group.add(this.hoverRing);

    const discGeo = new THREE.CircleGeometry(1, 36);
    discGeo.rotateX(-Math.PI / 2);
    this.hoverRangeDisc = new THREE.Mesh(discGeo, this.validMat);
    this.hoverRangeDisc.position.y = 0.10;
    this.hoverRangeDisc.visible = false;
    this.group.add(this.hoverRangeDisc);

    this.selectRing = new THREE.Mesh(ringGeo.clone(), this.selectMat);
    this.selectRing.position.y = 0.12;
    this.selectRing.visible = false;
    this.group.add(this.selectRing);

    this.selectRangeDisc = new THREE.Mesh(discGeo.clone(), this.selectMat);
    this.selectRangeDisc.position.y = 0.10;
    this.selectRangeDisc.visible = false;
    this.group.add(this.selectRangeDisc);
  }

  private buildTiles() {
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x565d66, // crisp, clear worn cobblestone slate
      roughness: 0.8,
      metalness: 0.15,
    });

    const grassTileMat = new THREE.MeshStandardMaterial({
      color: 0x2b3d31, // rich, visible cemetery lawn
      roughness: 0.85,
    });

    const pathBlockGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.08, TILE_SIZE * 0.96);
    const grassBlockGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.04, TILE_SIZE * 0.96);

    for (const cell of this.worldData.cells) {
      const pos = gridToWorld(cell.c, cell.r);

      if (cell.kind === "path") {
        const pathBlock = new THREE.Mesh(pathBlockGeo, pathMat);
        pathBlock.position.set(pos.x, 0.04, pos.z);
        pathBlock.receiveShadow = true;
        this.group.add(pathBlock);
      } else {
        const grassTile = new THREE.Mesh(grassBlockGeo, grassTileMat);
        grassTile.position.set(pos.x, 0.02, pos.z);
        grassTile.receiveShadow = true;
        this.group.add(grassTile);

        // Decor (Tombstones and occasional dead tree)
        if (cell.kind === "decor") {
          if (cell.prop === 0 || cell.prop === 5) {
            const tree = createDeadTree();
            tree.position.set(pos.x, 0, pos.z);
            this.group.add(tree);
          } else {
            const tomb = createTombstone(cell.prop);
            tomb.position.set(pos.x, 0, pos.z);
            this.group.add(tomb);
          }
        }
      }
    }
  }

  private buildPerimeterFence(w: number, h: number) {
    const fenceMat = materials.ironDark;
    const postGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    const railGeoH = new THREE.BoxGeometry(w * 0.98, 0.05, 0.05);
    const railGeoV = new THREE.BoxGeometry(0.05, 0.05, h * 0.98);

    const halfW = (GRID_COLS * TILE_SIZE) / 2 + 1.2;
    const halfH = (GRID_ROWS * TILE_SIZE) / 2 + 1.2;

    // Outer fence rails
    for (const y of [0.4, 0.75]) {
      const railTop = new THREE.Mesh(railGeoH, fenceMat);
      railTop.position.set(0, y, -halfH);
      const railBottom = new THREE.Mesh(railGeoH, fenceMat);
      railBottom.position.set(0, y, halfH);
      const railLeft = new THREE.Mesh(railGeoV, fenceMat);
      railLeft.position.set(-halfW, y, 0);
      const railRight = new THREE.Mesh(railGeoV, fenceMat);
      railRight.position.set(halfW, y, 0);

      this.group.add(railTop, railBottom, railLeft, railRight);
    }

    // Fence Posts
    for (let x = -halfW; x <= halfW; x += 2.0) {
      const p1 = new THREE.Mesh(postGeo, fenceMat);
      p1.position.set(x, 0.5, -halfH);
      p1.castShadow = true;
      const p2 = new THREE.Mesh(postGeo, fenceMat);
      p2.position.set(x, 0.5, halfH);
      p2.castShadow = true;
      this.group.add(p1, p2);
    }
    for (let z = -halfH; z <= halfH; z += 2.0) {
      const p1 = new THREE.Mesh(postGeo, fenceMat);
      p1.position.set(-halfW, 0.5, z);
      p1.castShadow = true;
      const p2 = new THREE.Mesh(postGeo, fenceMat);
      p2.position.set(halfW, 0.5, z);
      p2.castShadow = true;
      this.group.add(p1, p2);
    }
  }

  public updateHover(
    cell: { c: number; r: number } | null,
    armedType: TowerId | null,
    hasTower: boolean,
  ) {
    if (!cell || !armedType) {
      this.hoverRing.visible = false;
      this.hoverRangeDisc.visible = false;
      return;
    }

    const pos = gridToWorld(cell.c, cell.r);
    this.hoverRing.position.set(pos.x, 0.14, pos.z);
    this.hoverRangeDisc.position.set(pos.x, 0.12, pos.z);

    const key = `${cell.c},${cell.r}`;
    const isPath = this.worldData.path.has(key);
    const isDecor = this.worldData.decor.has(key);
    const isValid = !isPath && !isDecor && !hasTower;

    const mat = isValid ? this.validMat : this.invalidMat;
    this.hoverRing.material = mat;
    this.hoverRangeDisc.material = mat;

    const spec = TOWERS[armedType];
    const rangeInWorld = spec.range * TILE_SIZE;
    this.hoverRangeDisc.scale.set(rangeInWorld, rangeInWorld, 1);

    this.hoverRing.visible = true;
    this.hoverRangeDisc.visible = true;
  }

  public updateSelected(
    cell: { c: number; r: number } | null,
    type: TowerId | null,
  ) {
    if (!cell || !type) {
      this.selectRing.visible = false;
      this.selectRangeDisc.visible = false;
      return;
    }

    const pos = gridToWorld(cell.c, cell.r);
    this.selectRing.position.set(pos.x, 0.14, pos.z);
    this.selectRangeDisc.position.set(pos.x, 0.12, pos.z);

    const spec = TOWERS[type];
    const rangeInWorld = spec.range * TILE_SIZE;
    this.selectRangeDisc.scale.set(rangeInWorld, rangeInWorld, 1);

    this.selectRing.visible = true;
    this.selectRangeDisc.visible = true;
  }
}
