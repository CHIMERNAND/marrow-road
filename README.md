# Marrow Road

A first-person zombie siege defense. You hold a huge fortress wall at night while the dead come up the valley. You fight with a heavy crossbow and spend the gold from your kills on wall turrets.

- **Engine:** Unity 6 (6000.3.26f1), URP, in [`HelmsDeep/`](HelmsDeep/)
- **Design & roadmap:** [`Design/DESIGN.md`](Design/DESIGN.md)
- **Asset pipeline:** [`Design/ASSET_PIPELINE.md`](Design/ASSET_PIPELINE.md)
- **Frozen feature backlog:** [`Design/BACKLOG.md`](Design/BACKLOG.md)

## Open

Open `HelmsDeep/` from Unity Hub (Add → project from disk), or:

```powershell
unity projects open "D:\Dev\marrow-road\HelmsDeep"
```

The project builds its world at runtime from `GameBootstrap`, so press Play in any scene. An authored graybox scene replaces this in M1.

## Build + autopilot smoke test

Build `StandaloneWindows64` to `HelmsDeep/Builds/Windows/HelmsDeep.exe`, then copy the scripts from `HelmsDeep/BuildScripts/` next to the exe and run `AutopilotSmoke.ps1`. Recording needs `ffmpeg` on PATH or at `HelmsDeep/Tools/ffmpeg.exe`; it isn't committed.

## History

The earlier browser prototypes (2D Marrow Road TD and the Babylon.js Helms Deep) are kept on the [`archive/web-prototype`](../../tree/archive/web-prototype) branch. The old web build still deploys from `gh-pages`.
