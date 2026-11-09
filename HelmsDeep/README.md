# Helms Deep (Desktop)

Unity 6 desktop remake of the Helms Deep idea: a first-person **zombie siege defense** from the wall.

You hold the battlement. Waves of undead push the approach road. Gold from kills buys wall turrets. Abilities buy breathing room. If the gate hits zero, the Deep falls.

## Why Unity

| Engine | Verdict for this game |
|--------|------------------------|
| **Unity 6** | Chosen. FPS + wave defense + sockets fits Unity cleanly. Editor **6000.3.26f1** and Windows build support are already on this machine. |
| Godot | Strong indie option, not installed here; would slow the cutover. |
| Unreal 5.8 | Available locally, but heavier than this siege-TD scope needs right now. |

The old web prototype under `src/` (Babylon / Three / Marrow Road top-down) stays as reference. **This folder is the product.**

## Windows build

```text
d:\Dev\marrow-road\HelmsDeep\Builds\Windows\HelmsDeep.exe
```

Double-click that exe (keep the `_Data` folder beside it). Autopilot recordings/reports for the player land next to the exe:

```text
d:\Dev\marrow-road\HelmsDeep\Builds\Windows\Recordings\
d:\Dev\marrow-road\HelmsDeep\Builds\Windows\Recordings\runs\
```

Rebuild:

```powershell
unity build "d:\Dev\marrow-road\HelmsDeep" --target StandaloneWindows64 --output-path "d:\Dev\marrow-road\HelmsDeep\Builds\Windows\HelmsDeep.exe" --allow-dirty-build
```

## Open / play (Editor)

```powershell
unity projects open "d:\Dev\marrow-road\HelmsDeep"
```

In the Editor: open `Assets/Scenes/SampleScene.unity` and press Play.

## Gameplay recording (FFmpeg)

Press **F9** in-game to start/stop. Clips land in:

```text
d:\Dev\marrow-road\HelmsDeep\Recordings\helmsdeep_YYYYMMDD_HHMMSS.mp4
```

Each clip also gets a `.txt` sidecar (wave/gold/kills/events) for review.

Auto-record a session:

```powershell
$env:HELMS_RECORD = "1"
& "d:\Dev\marrow-road\HelmsDeep\Builds\Windows\HelmsDeep.exe" -record
```

Uses `Tools\ffmpeg.exe`, `FFMPEG_PATH`, or ffmpeg on PATH.

## Autopilot / automated playthroughs

Bot holds the wall, buys turrets, fires, uses abilities, and calls waves. Use it to smoke-test builds and produce reviewable recordings.

```powershell
# Fast smoke (first 2 waves, 2x speed, record, quit)
d:\Dev\marrow-road\HelmsDeep\Builds\Windows\AutopilotSmoke.ps1

# Full siege run
d:\Dev\marrow-road\HelmsDeep\Builds\Windows\AutopilotSmoke.ps1 -FullRun -MaxSeconds 900
```

Or raw flags on the exe:

```text
HelmsDeep.exe -autopilot -record -quit-after-end -max-waves 2 -max-seconds 180 -timescale 2
```

| Flag / env | Meaning |
|------------|---------|
| `-autopilot` / `HELMS_AUTOPILOT=1` | Enable bot |
| `-record` / `HELMS_RECORD=1` | FFmpeg capture |
| `-quit-after-end` | Exit when victory/defeat/timeout |
| `-max-waves N` | Stop after clearing N waves (smoke) |
| `-max-seconds N` | Hard timeout |
| `-timescale N` | Speed up simulation |

Exit codes: `0` victory/smoke ok, `1` defeat, `2` timeout, `3` incomplete.

Run reports (player): `HelmsDeep\Builds\Windows\Recordings\runs\run_*.json` (+ `.txt` + `.mp4`).

## Controls

| Input | Action |
|-------|--------|
| Click | Lock mouse / start siege |
| A / D | Strafe the wall |
| Mouse | Look |
| RMB | Aim |
| LMB | Fire bolt |
| Q | Cycle ammo (Bodkin / Fire / Frost / Scatter) |
| Tab | Select turret socket |
| Z X C V | Build Repeater / Oil / Mortar / Ballista |
| 1-4 | Abilities |
| Space | Call next wave early (+gold) |
| F9 | Start/stop gameplay recording |
| Esc | Free cursor |

Pass `-autopilot` on the exe (or use `AutopilotSmoke.ps1`) for unattended play.

## Vertical slice included

- Procedural wall, gate, valley road, 5 turret sockets
- Wave director (10 waves, escalating casts)
- FP defender with ammo types + headshots
- Gate HP win/lose
- Turret placement and auto-fire
- Abilities (oil, catapult, horn, volley)

Art is blockout on purpose. Next pass: real wall kit, enemy meshes, VFX, audio, polish HUD.
