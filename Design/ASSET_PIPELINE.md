# Asset Pipeline: realistic, $0 budget

Goal: a photoreal night siege on an RTX 3060 6 GB laptop. The rule is **free first, then generate whatever we can't find**. Every asset goes into a license ledger.

## 1. Sources, in priority order

| Tier | Source | Use for | License notes |
|---|---|---|---|
| Free | **Fab, Free filter + Quixel Megascans starter set** | Cliffs, rocks, rubble, ground and wall surfaces, decals | Fab Standard License works in any engine, but the Megascans tree packs and scenes are **Unreal-only**. Check the badge on every listing. You may not redistribute the files on their own. |
| Free | **Fab Limited-Time Free** (rotates every ~2 weeks) | Opportunistic props and kits | Claim them while they're free and they stay in your library. |
| Free | **Poly Haven** | HDRI night skies, PBR textures, some props | CC0 |
| Free | **ambientCG** | PBR stone, mud, wood, metal | CC0 |
| Free | **Mixamo** | Zombie locomotion, attack, climb, hit-react and death animations, plus base characters | Free for use in games, can't be redistributed raw |
| Free | **Unity Asset Store, free packs** | Particle FX, rain, fog, tools | Asset Store EULA, case by case |
| Generate | **Local image→3D (Hunyuan3D-2mini / TRELLIS.2 low-VRAM forks)** | Hero props: siege ladders, battering ram, catapult, ballista, barrels, banners, braziers | Read the model license before shipping. Hunyuan's community license has territory and scale limits. |
| Generate | **AI concept images** | Reference boards, decals, banner art, UI art | We produce these ourselves |
| Hand-made | **Blender + ProBuilder** | Modular fortress wall kit (big, simple shapes dressed with Megascans materials) | Ours |

Characters: **don't** use AI image→3D for zombies, because the meshes come out unrigged and messy. Start from Mixamo or MakeHuman bodies, then add damage, decay materials and clothing variants in Blender.

## 2. Local generation on the G15 (RTX 3060 6 GB)

- **Shape:** Hunyuan3D-2mini needs roughly 5–6 GB VRAM for shape generation, which fits the 3060. The full shape+texture pipeline needs 12–16 GB, so we generate shape locally and texture it separately.
- **Texture:** project the source image or concept onto the mesh, or bake from tiling CC0/Megascans materials in Blender. That's usually better than generated textures for realism anyway.
- **TRELLIS.2:** officially 24 GB. Community low-VRAM forks claim it runs in 4–8 GB at a few minutes per mesh. Treat this as an experiment, not the main path.
- **Fallback:** if local runs are too slow, use the free tier of a hosted image→3D service for one-off hero props.

## 3. Pipeline stages (scripted)

```
pipeline/
  manifest.csv          # one row per asset: id, category, source, license, url, status, unity_path
  concepts/             # reference images (ours)
  raw/                  # downloads / generated meshes (git-ignored if licensed)
  scripts/
    blender_normalize.py  # headless: meters, pivot at base, clean, UV, LOD0-2, collision mesh, FBX export
    gen_hunyuan.ps1       # image → mesh on the G15
  out/                  # normalized FBX ready for Unity (git-ignored)
```

1. **Request:** add a row to `manifest.csv` (for example `prop_siege_ladder, prop, generate, ours, -, todo`).
2. **Acquire:** download a free source, or generate a concept image, then run image→3D.
3. **Normalize:** headless Blender script for scale (1 unit = 1 m), triangle budget per category, LODs, collider and FBX export.
4. **Import:** a Unity `AssetPostprocessor` applies import settings by folder (LOD groups, material remap to URP Lit, collider setup).
5. **Accept:** an automated capture of the asset in the graybox next to the 1.8 m scale dummy, and you approve or reject it.
6. **Ledger:** `manifest.csv` records the license and URL for every asset, and it feeds the in-game credits.

## 4. Public-repo constraint

`CHIMERNAND/marrow-road` is **public**. Fab, Asset Store and Mixamo files can't be redistributed, so they live in `HelmsDeep/Assets/ThirdParty/Licensed/`, which is git-ignored. `manifest.csv` lists the files needed to rebuild. CC0 and our own or generated assets can be committed through Git LFS.

The alternative is to make the repo private, which removes this constraint. GitHub Pages on a private repo needs a paid plan, but the old web build on `gh-pages` doesn't matter for the Unity game.

## 5. Budgets (realistic on a 3060 laptop, 1080p / 60 fps)

| Category | Tris (LOD0) | Texture |
|---|---|---|
| Wall module (10 m) | 5–15k | Shared trim sheets + Megascans tiling, 2K |
| Hero prop (ram, catapult) | 15–40k | 2K |
| Small prop | 1–5k | 1K / atlas |
| Zombie | 8–15k, 3 LODs | 2K body + shared decay detail |
| Horde | 200–400 on screen | GPU-instanced, baked animation for distant LODs |

Lighting: baked GI for the fortress, a moon directional light, at most ~8 real-time torch shadow casters near the player, volumetric-style fog through URP post or a cheap fog-card approach, and rain particles plus wet-surface shader variation.
