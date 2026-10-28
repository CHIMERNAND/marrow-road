import { useEffect, useRef, useState, type RefObject } from "react";
import { Coins, Heart, Volume2, VolumeX } from "lucide-react";
import { loadArt } from "@/game/assets";
import { EARLY_BONUS, TOWER_LIST, TOWERS } from "@/game/data";
import { createGame, type Game, type Hud } from "@/game/engine";

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
  const gameRef = useRef<Game | null>(null);
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
    let game: Game | null = null;
    loadArt()
      .then((art) => {
        if (dead) return;
        game = createGame(canvas, art, setHud);
        gameRef.current = game;
        const loop = (t: number) => {
          game?.frame(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!dead) setError(err instanceof Error ? err.message : "The lane wouldn't load");
      });
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
            <button type="button" className="btn btn-icon" onClick={() => gameRef.current?.toggleSpeed()} aria-label="Toggle speed">
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
                  : "Marrow Road. Begin the watch."}
        </p>
        <div className="stage">
          <canvas
            ref={canvasRef}
            aria-label="Graveyard lane"
            onPointerDown={(e) => {
              canvasRef.current?.setPointerCapture(e.pointerId);
              gameRef.current?.pointer(e.clientX, e.clientY, "down");
            }}
            onPointerMove={(e) => gameRef.current?.pointer(e.clientX, e.clientY, "move")}
            onPointerLeave={() => gameRef.current?.pointer(0, 0, "leave")}
            onContextMenu={(e) => e.preventDefault()}
          />
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
                <p className="eyebrow">Graveyard defense</p>
                <h1>Marrow Road</h1>
                <p className="lede">
                  The dead already know the lane. Spend what they drop. Do not let them reach the chapel.
                </p>
                <div className="rules">
                  <span>Four towers. Different reach, different price.</span>
                  <span>Each one upgrades damage and tempo, three ranks.</span>
                  <span>Twelve waves. A leak costs a life. Best watch: {hud.best}.</span>
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
                <p className="eyebrow">{hud.phase === "victory" ? "The lane is quiet" : "They reached the door"}</p>
                <h2>{hud.phase === "victory" ? "Chapel holds" : "The watch failed"}</h2>
                <div className="stats">
                  <div>
                    <b>{hud.wavesCleared}</b>
                    <span>Waves</span>
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
                <p className="eyebrow">Marrow Road</p>
                <h2>Lighting the lane</h2>
                <p className="lede">The graves are settling.</p>
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

function Panel({ hud, gameRef }: { hud: Hud; gameRef: RefObject<Game | null> }) {
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
        <p>Tap open grass. Keys 1–4 pick a tower. Space calls the wave.</p>
      </>
    );
  }
  return (
    <>
      <h2>The watch</h2>
      <p>Pick a tower, then tap grass that is not a grave and not the lane. Click a tower you own to upgrade it.</p>
      <p>First aim stops leaks. Strongest aim is for the Warden. Sell returns sixty percent.</p>
    </>
  );
}
