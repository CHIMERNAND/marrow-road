import { useEffect, useRef, useState, type RefObject } from "react";
import { Coins, Heart, Volume2, VolumeX, RotateCcw, ZoomIn, ZoomOut, Compass } from "lucide-react";
import { EARLY_BONUS, TOWER_LIST, TOWERS } from "@/game/data";
import { createGame3D, type Game3D } from "@/game/engine3d";
import type { Hud } from "@/game/engine";

type Game3DInstance = Game3D;

const EMPTY: Hud = {
  phase: "title",
  lives: 20,
  gold: 180,
  wave: 1,
  waveTotal: 12,
  boss: false,
  preview: "",
  prepLeft: 20,
  kills: 0,
  goldEarned: 0,
  leaked: 0,
  wavesCleared: 0,
  best: 0,
  speed: 1,
  muted: false,
  armed: null,
  selected: null,
  toast: "",
};

export function MarrowRoad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game3DInstance | null>(null);
  const hudRef = useRef<Hud>(EMPTY);
  const [hud, setHud] = useState<Hud>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  hudRef.current = hud;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let raf = 0;
    let game: Game3DInstance | null = null;

    try {
      game = createGame3D(canvas, setHud);
      gameRef.current = game;
      const loop = (t: number) => {
        game?.frame(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      setReady(true);
    } catch (err: unknown) {
      if (!dead) setError(err instanceof Error ? err.message : "The 3D graveyard failed to initialize");
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      game?.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game) return;
      const phase = hudRef.current.phase;
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "title") game.start();
        else if (phase === "prep") game.callWave();
        else if (phase === "victory" || phase === "defeat") game.restart();
      } else if (e.code === "Digit1") game.arm("wick");
      else if (e.code === "Digit2") game.arm("ashbow");
      else if (e.code === "Digit3") game.arm("pyre");
      else if (e.code === "Digit4") game.arm("dirge");
      else if (e.code === "Escape") game.clear();
      else if (e.code === "KeyR" && (phase === "victory" || phase === "defeat")) game.restart();
      else if (e.code === "KeyW" || e.code === "ArrowUp") game.pan(0, -1.2);
      else if (e.code === "KeyS" || e.code === "ArrowDown") game.pan(0, 1.2);
      else if (e.code === "KeyA" || e.code === "ArrowLeft") game.pan(-1.2, 0);
      else if (e.code === "KeyD" || e.code === "ArrowRight") game.pan(1.2, 0);
      else if (e.code === "KeyQ") game.rotate(-0.15, 0);
      else if (e.code === "KeyE") game.rotate(0.15, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <div className="play">
        <header className="hud">
          <div className="stat lives">
            <Heart size={16} aria-hidden />
            <b>{hud.lives}</b>
            <span>Lives</span>
          </div>
          <div className="stat gold">
            <Coins size={16} aria-hidden />
            <b>{hud.gold}</b>
            <span>Gold</span>
          </div>
          <div className="stat">
            <b>
              {hud.wave}
              <span>/{hud.waveTotal}</span>
            </b>
            <span>{hud.boss ? "Boss" : "Wave"}</span>
          </div>
          <div className="hud-actions">
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => gameRef.current?.toggleSpeed()}
              aria-label="Toggle speed"
            >
              {hud.speed}×
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => gameRef.current?.toggleMute()}
              aria-label={hud.muted ? "Unmute" : "Mute"}
            >
              {hud.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={hud.phase !== "prep"}
              onClick={() => gameRef.current?.callWave()}
            >
              {hud.phase === "prep"
                ? `Call wave ${hud.wave}`
                : hud.phase === "wave"
                  ? "Wave underway"
                  : "Hold"}
            </button>
          </div>
        </header>

        <p className="sr-only" aria-live="polite">
          {hud.phase === "prep"
            ? `Preparation. ${hud.preview}. ${Math.ceil(hud.prepLeft)} seconds.`
            : hud.phase === "wave"
              ? `Wave ${hud.wave}. ${hud.lives} lives. ${hud.gold} gold.`
              : hud.phase === "victory"
                ? "Victory. The chapel holds."
                : hud.phase === "defeat"
                  ? "Defeat. The dead reached the chapel."
                  : "Marrow Road 3D. Begin the watch."}
        </p>

        <div className="stage">
          <canvas
            ref={canvasRef}
            aria-label="3D Graveyard lane"
            onPointerDown={(e) => {
              canvasRef.current?.setPointerCapture(e.pointerId);
              gameRef.current?.pointer(e.clientX, e.clientY, "down", e.button);
            }}
            onPointerMove={(e) => gameRef.current?.pointer(e.clientX, e.clientY, "move", e.button)}
            onPointerUp={(e) => {
              try {
                canvasRef.current?.releasePointerCapture(e.pointerId);
              } catch {}
              gameRef.current?.pointer(e.clientX, e.clientY, "up", e.button);
            }}
            onPointerLeave={() => gameRef.current?.pointer(0, 0, "leave")}
            onWheel={(e) => {
              e.preventDefault();
              gameRef.current?.zoom(e.deltaY);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* 3D Camera Controls Toolbar */}
          <div className="camera-controls">
            <button
              type="button"
              className="btn-cam"
              title="Rotate Left (Q)"
              onClick={() => gameRef.current?.rotate(-0.25, 0)}
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className="btn-cam"
              title="Reset View"
              onClick={() => gameRef.current?.resetCamera()}
            >
              <Compass size={16} />
            </button>
            <button
              type="button"
              className="btn-cam"
              title="Zoom In"
              onClick={() => gameRef.current?.zoom(-200)}
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              className="btn-cam"
              title="Zoom Out"
              onClick={() => gameRef.current?.zoom(200)}
            >
              <ZoomOut size={16} />
            </button>
          </div>

          {hud.toast && ready && <div className="toast">{hud.toast}</div>}
          {hud.phase === "prep" && ready && (
            <div className="toast toast-sub">
              {hud.preview}
              {hud.boss ? " · boss" : ""} · {Math.ceil(hud.prepLeft)}s · +{EARLY_BONUS} if you call it
            </div>
          )}
          {(hud.selected || hud.armed) && ready && (
            <div className="inspector inspector-float">
              <Panel hud={hud} gameRef={gameRef} />
            </div>
          )}

          {hud.phase === "title" && ready && (
            <div className="overlay">
              <div className="card">
                <p className="eyebrow">3D Graveyard Defense</p>
                <h1>Marrow Road 3D</h1>
                <p className="lede">
                  The dead already know the lane. Spend what they drop. Do not let them reach the chapel.
                </p>
                <div className="rules">
                  <span>Watchtower Commander: elevated view overlooking the entire lane.</span>
                  <span>Click open grass to place towers • Click towers to inspect & upgrade.</span>
                  <span>Drag to pan • Right-click drag to orbit • Scroll to zoom • WASD to move.</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => gameRef.current?.start()}>
                  Begin the watch
                </button>
              </div>
            </div>
          )}

          {(hud.phase === "victory" || hud.phase === "defeat") && (
            <div className="overlay">
              <div className="card">
                <p className="eyebrow">{hud.phase === "victory" ? "Sanctuary" : "Desolation"}</p>
                <h2>{hud.phase === "victory" ? "The chapel held" : "The lane was lost"}</h2>
                <div className="stats-grid">
                  <div>
                    <b>{hud.wavesCleared}</b>
                    <span>Cleared</span>
                  </div>
                  <div>
                    <b>{hud.kills}</b>
                    <span>Kills</span>
                  </div>
                  <div>
                    <b>{hud.goldEarned}</b>
                    <span>Gold</span>
                  </div>
                </div>
                <p className="lede">
                  {hud.phase === "victory"
                    ? `${hud.lives} lives still on the door. Best watch: ${hud.best}.`
                    : `You held ${hud.wavesCleared} of ${hud.waveTotal}. Best watch: ${hud.best}.`}
                </p>
                <button type="button" className="btn btn-primary" onClick={() => gameRef.current?.restart()}>
                  Restart the watch
                </button>
              </div>
            </div>
          )}

          {!ready && !error && (
            <div className="overlay">
              <div className="card">
                <p className="eyebrow">Marrow Road 3D</p>
                <h2>Lighting the lane</h2>
                <p className="lede">Summoning the graveyard in 3D...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="overlay">
              <div className="card">
                <p className="eyebrow">Something failed</p>
                <h2>The lane is dark</h2>
                <p className="lede">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="dock">
        <div className="tower-row">
          {TOWER_LIST.map((id, index) => {
            const spec = TOWERS[id];
            const poor = hud.gold < spec.cost;
            return (
              <button
                key={id}
                type="button"
                className={`tower-card${hud.armed === id ? " is-on" : ""}${poor ? " is-poor" : ""}`}
                aria-pressed={hud.armed === id}
                onClick={() => gameRef.current?.arm(id)}
              >
                <img src={`/game/ui/${id}.png`} alt="" />
                <strong>
                  {index + 1}. {spec.name}
                </strong>
                <em>{spec.cost}</em>
              </button>
            );
          })}
        </div>
        <div className="inspector inspector-side">
          <Panel hud={hud} gameRef={gameRef} />
        </div>
      </aside>
    </div>
  );
}

function Panel({ hud, gameRef }: { hud: Hud; gameRef: RefObject<Game3DInstance | null> }) {
  const armed = hud.armed ? TOWERS[hud.armed] : null;
  if (hud.selected) {
    const tower = hud.selected;
    return (
      <>
        <h2>{tower.name}</h2>
        <p>
          {tower.line}. Targeting {tower.targetLabel.toLowerCase()}.
        </p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => gameRef.current?.cycleTarget()}>
            Aim: {tower.targetLabel}
          </button>
          <button
            type="button"
            className="btn"
            disabled={tower.dmgCost === null || hud.gold < (tower.dmgCost ?? 0)}
            onClick={() => gameRef.current?.upgrade("dmg")}
          >
            {tower.dmgCost === null ? "Damage maxed" : `Damage ${tower.dmgRank}/3 · ${tower.dmgCost}`}
          </button>
          <button
            type="button"
            className="btn"
            disabled={tower.rateCost === null || hud.gold < (tower.rateCost ?? 0)}
            onClick={() => gameRef.current?.upgrade("rate")}
          >
            {tower.rateCost === null ? "Tempo maxed" : `Tempo ${tower.rateRank}/3 · ${tower.rateCost}`}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => gameRef.current?.sell()}>
            Sell · {tower.sell}
          </button>
        </div>
      </>
    );
  }
  if (armed) {
    return (
      <>
        <h2>{armed.name}</h2>
        <p>{armed.blurb}</p>
        <p>
          Range {armed.range.toFixed(1)} · {armed.damage} damage · {armed.rate.toFixed(1)}/s · {armed.cost} gold
        </p>
        <p>Tap open grass to place. Drag / Right-click to rotate view. Space calls the wave.</p>
      </>
    );
  }
  return (
    <>
      <h2>The watch</h2>
      <p>Pick a tower, then tap open grass. Click an existing tower to inspect or upgrade it.</p>
      <p>Drag or right-click to orbit view • Mouse wheel to zoom • Sell returns 60% gold.</p>
    </>
  );
}
