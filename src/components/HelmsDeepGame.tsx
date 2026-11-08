import { useEffect, useRef, useState } from "react";
import {
  ShieldAlert,
  Flame,
  Bomb,
  Volume2,
  VolumeX,
  RotateCcw,
  Crosshair,
  Skull,
  Coins,
  Wrench,
  Sparkles,
  Swords,
  ChevronUp,
  X,
  MousePointer,
  Zap,
  Snowflake,
  Shield,
} from "lucide-react";
import { type AbilityId, type HelmsGameState } from "@/helmsdeep/engine";
import { BabylonHelmsEngine } from "@/babylon/engine";
import {
  TURRET_SPECS,
  type TurretType,
  BOLT_AMMO_SPECS,
  type BoltAmmoType,
} from "@/helmsdeep/types";

export function HelmsDeepGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BabylonHelmsEngine | null>(null);

  const [gameState, setGameState] = useState<HelmsGameState | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedSocket, setSelectedSocket] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BabylonHelmsEngine(canvas, (nextState) => {
      setGameState(nextState);
    });
    engineRef.current = engine;
    (window as unknown as { __HELMS_ENGINE__?: BabylonHelmsEngine }).__HELMS_ENGINE__ = engine;
    engine.start();

    const handleResize = () => {
      if (containerRef.current && engineRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        engineRef.current.resize(clientWidth, clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    const handleLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setIsPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", handleLockChange);

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && engineRef.current) {
        engineRef.current.onMouseMove(e.movementX, e.movementY);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas && engineRef.current) {
        engineRef.current.onMouseDown(e.button);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (engineRef.current) {
        engineRef.current.onMouseUp(e.button);
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && engineRef.current?.state.status === "preparing") {
        engineRef.current.startWaveNow();
        e.preventDefault();
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
      }
      if (e.code === "Escape") {
        setSelectedSocket(null);
      }
      if (engineRef.current) {
        engineRef.current.onKeyDown(e.code);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (engineRef.current) {
        engineRef.current.onKeyUp(e.code);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    const handleWheel = (e: WheelEvent) => {
      if (document.pointerLockElement === canvas && engineRef.current) {
        engineRef.current.onWheel(e.deltaY);
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true });

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("pointerlockchange", handleLockChange);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      engine.destroy();
    };
  }, []);

  const requestLock = () => {
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };

  const handleToggleMute = () => {
    if (engineRef.current) {
      const muted = engineRef.current.audio.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleBuild = (socketId: number, type: TurretType) => {
    if (engineRef.current) {
      engineRef.current.purchaseTurret(socketId, type);
    }
  };

  const handleUpgrade = (socketId: number) => {
    if (engineRef.current) {
      engineRef.current.upgradeTurret(socketId);
    }
  };

  const handleRepair = () => {
    if (engineRef.current) {
      engineRef.current.repairGate();
    }
  };

  const handleRestart = () => {
    if (engineRef.current) {
      engineRef.current.restart();
    }
  };

  const handleAbility = (id: AbilityId) => {
    if (engineRef.current) {
      engineRef.current.useAbility(id);
    }
  };

  const handleSelectAmmo = (ammo: BoltAmmoType) => {
    if (engineRef.current) {
      engineRef.current.setAmmo(ammo);
    }
  };

  const handleUpgradeCrossbow = () => {
    if (engineRef.current) {
      engineRef.current.upgradeCrossbow();
    }
  };

  const gateHealthPercent = gameState
    ? Math.max(0, Math.round((gameState.gateHp / gameState.maxGateHp) * 100))
    : 100;

  const currentSocketData =
    selectedSocket !== null && gameState
      ? gameState.turretSockets.find((s) => s.id === selectedSocket)
      : null;

  const activeAmmo = gameState?.currentAmmo || "bodkin";
  const comboCount = gameState?.combo || 0;
  const comboMultiplier = Math.min(2.5, 1 + Math.floor(comboCount / 3) * 0.25);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden select-none bg-stone-950 font-sans text-stone-100"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onClick={requestLock}
        className="w-full h-full block cursor-crosshair focus:outline-none"
      />

      {/* Optical Zoom Vignette Mask when Aiming */}
      {gameState?.isAiming && (
        <div
          className={`pointer-events-none absolute inset-0 ring-2 transition-all duration-200 ${
            gameState.holdingBreath
              ? "bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.95)_72%)] ring-cyan-400/80 shadow-[inset_0_0_120px_rgba(0,0,0,0.95)]"
              : "bg-[radial-gradient(circle_at_center,transparent_36%,rgba(0,0,0,0.88)_84%)] ring-amber-400/50"
          }`}
        />
      )}

      {/* Arcane Runic Night-Sight Optics Filter */}
      {gameState?.nightSightActive && (
        <div className="pointer-events-none absolute inset-0 bg-cyan-950/20 mix-blend-screen ring-4 ring-inset ring-cyan-500/50 shadow-[inset_0_0_140px_rgba(6,182,212,0.38)]" />
      )}

      {/* Parapet Under Fire / Combat Trauma Vignette */}
      {(gameState?.screenTraumaTimer || 0) > 0 && (
        <div className="pointer-events-none absolute inset-0 ring-8 ring-inset ring-red-600/70 bg-red-950/25 animate-pulse transition-opacity duration-150" />
      )}

      {/* Visceral Blood Splatter on Visor / Camera Lens */}
      {(gameState?.bloodSplatterTimer || 0) > 0 && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-10"
          style={{ opacity: Math.min(1, (gameState?.bloodSplatterTimer || 0) / 1.5) }}
        >
          <div className="absolute top-12 left-16 w-36 h-28 rounded-full bg-red-950/70 blur-xs border border-red-900/60 rotate-12" />
          <div className="absolute top-20 left-28 w-12 h-18 rounded-full bg-red-900/80 -rotate-45" />
          <div className="absolute bottom-24 right-20 w-44 h-32 rounded-full bg-red-950/75 blur-xs rotate-6" />
          <div className="absolute bottom-36 right-40 w-16 h-24 rounded-full bg-red-900/80 -rotate-12" />
          <div className="absolute top-1/3 right-1/4 w-8 h-8 rounded-full bg-red-800/60" />
          <div className="absolute bottom-1/3 left-1/3 w-6 h-6 rounded-full bg-red-800/60" />
        </div>
      )}

      {/* Cinematic Storm Rain Droplets on Camera Lens */}
      <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-screen bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.4)_1px,transparent_2px),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.35)_1.5px,transparent_3px),radial-gradient(circle_at_40%_70%,rgba(255,255,255,0.3)_1px,transparent_2px),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.4)_2px,transparent_4px)]" />

      {/* Bullet-Time Slow-Motion Edge Highlight */}
      {gameState?.bulletTimeActive && (
        <div className="pointer-events-none absolute inset-0 ring-4 ring-inset ring-cyan-400/60 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(34,211,238,0.16)_100%)] transition-opacity" />
      )}

      {/* 3D World-Projected Floating Damage & Crit Numbers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {gameState?.floatingDamages?.map((fd) => (
          <div
            key={fd.id}
            style={{
              left: `${fd.x}%`,
              top: `${fd.y}%`,
              color: fd.color,
            }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 font-black tracking-wider drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${
              fd.isCrit ? "text-base scale-110" : "text-xs"
            }`}
          >
            {fd.text}
          </div>
        ))}
      </div>

      {/* Reticle / Crosshair + Optical Rangefinder Telemetry */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {gameState?.isAiming ? (
          <div className="relative w-52 h-52 flex items-center justify-center">
            {/* Tactical Etched Mil-Dot Glass Reticle */}
            <div
              className={`w-40 h-40 rounded-full border flex items-center justify-center transition-all ${
                gameState.nightSightActive
                  ? "border-cyan-400/80 shadow-[0_0_35px_rgba(6,182,212,0.4)]"
                  : "border-amber-400/65 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  gameState.nightSightActive
                    ? "bg-cyan-300 shadow-[0_0_10px_#22d3ee]"
                    : "bg-amber-300 shadow-[0_0_8px_#f59e0b]"
                }`}
              />
            </div>

            {/* Crosshair Spikes */}
            <div className={`absolute top-1 w-0.5 h-8 ${gameState.nightSightActive ? "bg-cyan-400/90" : "bg-amber-400/80"}`} />
            <div className={`absolute bottom-1 w-0.5 h-8 ${gameState.nightSightActive ? "bg-cyan-400/90" : "bg-amber-400/80"}`} />
            <div className={`absolute left-1 w-8 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/90" : "bg-amber-400/80"}`} />
            <div className={`absolute right-1 w-8 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/90" : "bg-amber-400/80"}`} />

            {/* Mil-Dot Hash Marks for Elevation & Range */}
            <div className={`absolute top-10 w-2.5 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/50" : "bg-amber-400/40"}`} />
            <div className={`absolute top-14 w-4 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/60" : "bg-amber-400/50"}`} />
            <div className={`absolute bottom-10 w-2.5 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/50" : "bg-amber-400/40"}`} />
            <div className={`absolute bottom-14 w-4 h-0.5 ${gameState.nightSightActive ? "bg-cyan-400/60" : "bg-amber-400/50"}`} />
            <div className={`absolute left-10 w-0.5 h-2.5 ${gameState.nightSightActive ? "bg-cyan-400/50" : "bg-amber-400/40"}`} />
            <div className={`absolute left-14 w-0.5 h-4 ${gameState.nightSightActive ? "bg-cyan-400/60" : "bg-amber-400/50"}`} />
            <div className={`absolute right-10 w-0.5 h-2.5 ${gameState.nightSightActive ? "bg-cyan-400/50" : "bg-amber-400/40"}`} />
            <div className={`absolute right-14 w-0.5 h-4 ${gameState.nightSightActive ? "bg-cyan-400/60" : "bg-amber-400/50"}`} />

            {/* Status & Zoom Chip */}
            <div
              className={`absolute -top-7 px-2.5 py-0.5 rounded text-[10px] tracking-widest font-mono font-bold uppercase whitespace-nowrap border ${
                gameState.nightSightActive
                  ? "bg-cyan-950/85 border-cyan-400/60 text-cyan-200"
                  : "bg-stone-950/75 border-amber-400/40 text-amber-300"
              }`}
            >
              ENHANCE {(gameState.zoomLevel || 2.4).toFixed(1)}x [SCROLL / Z] • {gameState.nightSightActive ? "RUNIC NIGHT-SIGHT [T]" : "OPTIC [T]"}
            </div>

            {/* Steady Aim Lung Stamina Gauge */}
            <div className="absolute -bottom-9 flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold tracking-widest uppercase">
                <span className={gameState.holdingBreath ? "text-cyan-300 animate-pulse" : "text-stone-400"}>
                  {gameState.holdingBreath ? "● STEADY AIM LOCKED" : "HOLD [SPACE / SHIFT] STEADY"}
                </span>
                <span className="text-amber-300">{gameState.breathStamina ?? 100}%</span>
              </div>
              <div className="w-28 h-1.5 rounded-full bg-stone-900/90 border border-stone-700/80 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-75 ${
                    gameState.holdingBreath
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_8px_#22d3ee]"
                      : "bg-gradient-to-r from-amber-600 to-amber-400"
                  }`}
                  style={{ width: `${gameState.breathStamina ?? 100}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div
              className="w-2 h-2 rounded-full shadow-[0_0_8px_gold]"
              style={{ backgroundColor: BOLT_AMMO_SPECS[activeAmmo].color }}
            />
            <div className="absolute -top-3 w-0.5 h-2 bg-amber-300/80" />
            <div className="absolute -bottom-3 w-0.5 h-2 bg-amber-300/80" />
            <div className="absolute -left-3 w-2 h-0.5 bg-amber-300/80" />
            <div className="absolute -right-3 w-2 h-0.5 bg-amber-300/80" />
          </div>
        )}

        {/* Live Crosshair Rangefinder & Target Vital Readout */}
        {gameState?.reticleTarget && (
          <div
            className={`absolute translate-y-24 px-2.5 py-1 rounded-lg border backdrop-blur-md text-[10px] font-mono font-bold tracking-wider uppercase shadow-lg flex items-center gap-2 whitespace-nowrap ${
              gameState.reticleTarget.isHazard
                ? "bg-orange-950/85 border-orange-400/80 text-orange-200"
                : "bg-stone-950/85 border-amber-400/50 text-amber-200"
            }`}
          >
            <span>{gameState.reticleTarget.label}</span>
            {gameState.reticleTarget.hp !== undefined && (
              <span className="text-red-300">
                {gameState.reticleTarget.hp}/{gameState.reticleTarget.maxHp} HP
              </span>
            )}
            <span className="text-sky-300">{gameState.reticleTarget.distance}m</span>
          </div>
        )}

        {/* Dynamic Hitmarkers */}
        {gameState?.hitmarker === "headshot" && (
          <div className="absolute flex flex-col items-center justify-center animate-ping text-red-500">
            <Skull className="w-12 h-12 text-red-500 drop-shadow-[0_0_16px_rgba(239,68,68,1)]" />
            <span className="text-xs font-black tracking-widest text-amber-300 drop-shadow-[0_0_10px_gold]">
              HEADSHOT CRIT!
            </span>
          </div>
        )}
        {gameState?.hitmarker === "shield" && (
          <div className="absolute flex flex-col items-center justify-center animate-pulse text-sky-300">
            <Shield className="w-9 h-9 text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
            <span className="text-[10px] font-black tracking-widest text-sky-200 mt-6">
              SHIELD BLOCKED
            </span>
          </div>
        )}
        {gameState?.hitmarker === "body" && (
          <div className="absolute w-8 h-8 flex items-center justify-center animate-pulse">
            <div className="absolute w-3 h-0.5 bg-amber-300 rotate-45 translate-x-2 translate-y-2" />
            <div className="absolute w-3 h-0.5 bg-amber-300 -rotate-45 -translate-x-2 translate-y-2" />
            <div className="absolute w-3 h-0.5 bg-amber-300 -rotate-45 translate-x-2 -translate-y-2" />
            <div className="absolute w-3 h-0.5 bg-amber-300 rotate-45 -translate-x-2 -translate-y-2" />
          </div>
        )}
      </div>

      {/* FLOATING COMBAT CALLOUT MEDALS (Right-side tactical feed) */}
      <div className="pointer-events-none absolute top-20 right-4 flex flex-col items-end gap-2 z-20">
        {gameState?.callouts?.map((c) => (
          <div
            key={c.id}
            className={`px-3.5 py-1.5 rounded-xl border backdrop-blur-md shadow-2xl flex flex-col items-end animate-in fade-in slide-in-from-right-4 ${
              c.color === "red"
                ? "bg-red-950/90 border-red-400 text-red-200"
                : c.color === "cyan"
                ? "bg-sky-950/90 border-sky-400 text-sky-200"
                : c.color === "orange"
                ? "bg-orange-950/90 border-orange-400 text-orange-200"
                : c.color === "purple"
                ? "bg-purple-950/90 border-purple-400 text-purple-200"
                : "bg-amber-950/90 border-amber-400 text-amber-200"
            }`}
          >
            <span className="text-xs font-black tracking-wider uppercase">{c.text}</span>
            {c.subtext && <span className="text-[10px] font-semibold opacity-90">{c.subtext}</span>}
          </div>
        ))}
      </div>

      {/* TOP HUD: Gate Health, Wave, Gold */}
      <div className="pointer-events-none absolute top-0 inset-x-0 p-4 flex items-start justify-between bg-gradient-to-b from-stone-950/85 via-stone-950/35 to-transparent">
        {/* Top Left: Wave Status, Kills & Marksman Combo */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-amber-600/40 border border-amber-400/60 text-amber-300 font-black tracking-wider text-sm uppercase shadow">
              Wave {gameState?.wave || 1} of {gameState?.totalWaves || 10}
            </span>
            {gameState?.status === "preparing" ? (
              <span className="px-2.5 py-0.5 rounded bg-blue-900/60 border border-blue-400 text-blue-200 text-xs font-bold animate-pulse">
                Next March: {gameState.waveCountdown}s
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-300 text-xs font-bold flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-red-400" />
                Horde Marching ({gameState?.zombiesAlive || 0})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-200 font-semibold drop-shadow">
            <span className="flex items-center gap-1">
              <Skull className="w-3.5 h-3.5 text-stone-300" />
              Kills: {gameState?.kills || 0} ({gameState?.headshots || 0} Headshots)
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-950/80 border border-orange-500/50 text-orange-300 text-[10px] uppercase tracking-wider font-bold">
              Powder Casks: {gameState?.powderBarrelsRemaining ?? 8}
            </span>
          </div>

          {/* Quiver Ammo Selector [Key Q] */}
          <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-stone-900/90 border border-stone-700/80 backdrop-blur-md shadow-lg w-fit mt-0.5">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider px-1.5">
              Bolts [Q]:
            </span>
            {(["bodkin", "fire", "frost", "scatter"] as BoltAmmoType[]).map((ammo) => {
              const spec = BOLT_AMMO_SPECS[ammo];
              const isSelected = activeAmmo === ammo;
              return (
                <button
                  key={ammo}
                  onClick={() => handleSelectAmmo(ammo)}
                  title={spec.desc}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.35)]"
                      : "bg-stone-950/70 border-stone-800 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {ammo === "bodkin" && <Crosshair className="w-3 h-3 text-amber-400" />}
                  {ammo === "fire" && <Flame className="w-3 h-3 text-orange-400" />}
                  {ammo === "frost" && <Snowflake className="w-3 h-3 text-sky-400" />}
                  {ammo === "scatter" && <Sparkles className="w-3 h-3 text-purple-400" />}
                  <span>{spec.name}</span>
                </button>
              );
            })}
          </div>

          {comboCount >= 2 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/70 text-amber-300 text-xs font-black w-fit shadow">
              <Zap className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
              <span>
                {comboCount}x KILLSTREAK ({comboMultiplier.toFixed(2)}x Gold)
              </span>
            </div>
          )}

          {gameState?.status === "preparing" && (
            <button
              onClick={() => engineRef.current?.startWaveNow()}
              className="pointer-events-auto mt-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-black rounded-lg shadow text-xs flex items-center gap-1.5 transition-all w-fit cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Sound War Horn (Advance Wave) [SPACE]
            </button>
          )}
        </div>

        {/* Top Center: Gate Health Bar */}
        <div className="flex flex-col items-center w-88 max-w-full">
          <div className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider mb-1 drop-shadow">
            <span className="flex items-center gap-1 text-stone-100">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Hornburg Deep Gate
            </span>
            <span
              className={
                gateHealthPercent < 30
                  ? "text-red-400 font-black animate-ping"
                  : "text-amber-300"
              }
            >
              {gameState?.gateHp} / {gameState?.maxGateHp} HP ({gateHealthPercent}%)
            </span>
          </div>
          <div className="w-full h-4 rounded-full bg-stone-900/90 border border-stone-600 p-0.5 overflow-hidden shadow-2xl">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                gateHealthPercent > 55
                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"
                  : gateHealthPercent > 25
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                  : "bg-gradient-to-r from-red-600 to-rose-500 animate-pulse"
              }`}
              style={{ width: `${gateHealthPercent}%` }}
            />
          </div>

          {/* Deeping Wall Culvert Drain Indicator */}
          <div className="w-full mt-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider drop-shadow">
            <span className="flex items-center gap-1 text-stone-200">
              <Bomb className="w-3 h-3 text-orange-400" />
              Deeping Culvert Drain
            </span>
            <span
              className={
                gameState?.culvertBreached
                  ? "text-red-400 font-black animate-pulse"
                  : (gameState?.culvertHp ?? 400) < 180
                  ? "text-orange-400 font-bold"
                  : "text-stone-300"
              }
            >
              {gameState?.culvertBreached ? "⚠️ BREACHED" : `${gameState?.culvertHp ?? 400} / ${gameState?.maxCulvertHp ?? 400} HP`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-stone-900/90 border border-stone-700/80 p-0.5 overflow-hidden shadow">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                gameState?.culvertBreached
                  ? "bg-red-600 animate-pulse"
                  : ((gameState?.culvertHp ?? 400) / (gameState?.maxCulvertHp ?? 400)) > 0.45
                  ? "bg-gradient-to-r from-sky-500 to-blue-400"
                  : "bg-gradient-to-r from-orange-500 to-red-400"
              }`}
              style={{
                width: `${
                  gameState?.culvertBreached
                    ? 0
                    : Math.max(0, Math.min(100, ((gameState?.culvertHp ?? 400) / (gameState?.maxCulvertHp ?? 400)) * 100))
                }%`,
              }}
            />
          </div>

          {(gateHealthPercent < 100 || (gameState?.culvertHp ?? 400) < 400 || (gameState?.powderBarrelsRemaining ?? 8) < 8) && (
            <button
              onClick={handleRepair}
              className="pointer-events-auto mt-1.5 px-3 py-1 bg-stone-900/90 hover:bg-stone-800 border border-amber-400/50 text-amber-300 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              Reinforce Defenses & Restock Casks [100 Gold / Key R]
            </button>
          )}
          {(gameState?.bossHp || 0) > 0 && (
            <div className="w-full mt-2 flex flex-col items-center">
              <div className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-widest text-fuchsia-300 mb-0.5">
                <span className="flex items-center gap-1">
                  <Skull className="w-3 h-3 text-fuchsia-400" />
                  Siege Warlord of Udûn
                </span>
                <span>
                  {gameState?.bossHp} / {gameState?.bossMaxHp} HP
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-stone-950/90 border border-fuchsia-500/60 p-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 via-purple-500 to-rose-500 transition-all duration-200"
                  style={{
                    width: `${Math.max(
                      2,
                      Math.round(((gameState?.bossHp || 0) / (gameState?.bossMaxHp || 520)) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top Right: Gold, Arbalest Upgrade & Sound */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleUpgradeCrossbow}
            disabled={
              (gameState?.weaponLevel || 1) >= 5 ||
              (gameState?.gold || 0) < (gameState?.weaponUpgradeCost || 120)
            }
            className={`pointer-events-auto px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition shadow-lg ${
              (gameState?.weaponLevel || 1) >= 5
                ? "bg-stone-900/80 border-amber-500/40 text-amber-300 cursor-default"
                : (gameState?.gold || 0) >= (gameState?.weaponUpgradeCost || 120)
                ? "bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400 text-emerald-200 cursor-pointer"
                : "bg-stone-900/70 border-stone-700 text-stone-400 opacity-60 cursor-not-allowed"
            }`}
          >
            <ChevronUp className="w-4 h-4 text-emerald-400" />
            {(gameState?.weaponLevel || 1) >= 5 ? (
              <span>Arbalest Max (Tier 5)</span>
            ) : (
              <span>
                Upgrade Arbalest Lv.{gameState?.weaponLevel || 1} [{gameState?.weaponUpgradeCost || 120}G / Key G]
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-300 font-black tracking-wide shadow-lg">
            <Coins className="w-4 h-4 text-yellow-400 animate-bounce" />
            <span className="text-base">{gameState?.gold || 0} Gold</span>
          </div>

          <button
            onClick={handleToggleMute}
            className="pointer-events-auto p-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-600 text-stone-200 hover:text-white transition cursor-pointer shadow"
            title={isMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* BOTTOM QUICK CONTROL TIP (Non-intrusive pill above dock) */}
      {!isPointerLocked && (
        <div
          onClick={requestLock}
          className="absolute bottom-28 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-stone-900/95 hover:bg-stone-800 border border-amber-400/80 text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl cursor-pointer transition hover:scale-105 whitespace-nowrap"
        >
          <MousePointer className="w-3.5 h-3.5 text-amber-400" />
          Click to Aim • [Scroll / Z] Enhance Zoom • [T] Night-Sight • [Q] Ammo • [1-4] Abilities • [G] Upgrade • Shoot Red Powder Casks!
        </div>
      )}

      {/* BOTTOM HUD: Turret Battlement Sockets & Siege Abilities */}
      <div className="absolute bottom-3 inset-x-0 px-6 flex flex-col items-center gap-2.5 pointer-events-none">
        {/* Wall Sockets Overview Bar */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-900/95 border border-stone-700/80 backdrop-blur-md shadow-2xl">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest px-2 flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5" />
            Wall Turrets:
          </span>
          {gameState?.turretSockets.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSocket(selectedSocket === s.id ? null : s.id)}
              className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                selectedSocket === s.id
                  ? "bg-amber-500 text-stone-950 border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.6)]"
                  : s.turretType
                  ? "bg-stone-800 text-amber-300 border-amber-500/40 hover:bg-stone-700"
                  : "bg-stone-950/70 text-stone-400 border-dashed border-stone-700 hover:border-amber-400"
              }`}
            >
              <span>{s.name}</span>
              {s.turretType ? (
                <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-600/50 text-[10px] text-amber-300">
                  {TURRET_SPECS[s.turretType].name} {s.level > 1 && `★${s.level}`}
                </span>
              ) : (
                <span className="text-[10px] text-stone-500">[+ Build]</span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Socket Action Modal */}
        {currentSocketData && (
          <div className="pointer-events-auto p-4 rounded-2xl bg-stone-900/98 border border-amber-500/60 backdrop-blur-lg shadow-[0_0_35px_rgba(0,0,0,0.8)] flex flex-col gap-3 max-w-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="font-black text-sm text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Socket: {currentSocketData.name}
              </span>
              <button
                onClick={() => setSelectedSocket(null)}
                className="text-stone-400 hover:text-white p-1 rounded-md bg-stone-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {currentSocketData.turretType ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-stone-100 text-sm">
                    {TURRET_SPECS[currentSocketData.turretType].name} (Level {currentSocketData.level})
                  </div>
                  <div className="text-xs text-stone-400">
                    {TURRET_SPECS[currentSocketData.turretType].blurb}
                  </div>
                </div>
                {currentSocketData.level < 3 ? (
                  <button
                    onClick={() => handleUpgrade(currentSocketData.id)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Upgrade to Level {currentSocketData.level + 1} (
                    {Math.round(
                      TURRET_SPECS[currentSocketData.turretType].cost *
                        0.85 *
                        currentSocketData.level,
                    )}{" "}
                    Gold)
                  </button>
                ) : (
                  <span className="text-xs text-amber-400 font-black uppercase">
                    Max Level Reached
                  </span>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["repeater", "oil", "mortar", "ballista"] as TurretType[]).map((type) => {
                  const spec = TURRET_SPECS[type];
                  const canAfford = (gameState?.gold || 0) >= spec.cost;
                  return (
                    <button
                      key={type}
                      disabled={!canAfford}
                      onClick={() => {
                        handleBuild(currentSocketData.id, type);
                        setSelectedSocket(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
                        canAfford
                          ? "bg-stone-800/90 hover:bg-amber-950/50 border-stone-700 hover:border-amber-400 cursor-pointer"
                          : "bg-stone-900/40 border-stone-800 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div>
                        <div className="font-black text-xs text-stone-100">{spec.name}</div>
                        <div className="text-[10px] text-stone-400 line-clamp-2 mt-0.5">
                          {spec.blurb}
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-black text-amber-300 flex items-center gap-1">
                        <Coins className="w-3 h-3 text-yellow-400" />
                        {spec.cost} Gold
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active Siege Abilities Hotbar */}
        <div className="pointer-events-auto flex items-center gap-2.5">
          {gameState?.abilities.map((ab) => (
            <button
              key={ab.id}
              disabled={!ab.ready}
              onClick={() => handleAbility(ab.id)}
              className={`relative px-3.5 py-2 rounded-xl border flex items-center gap-2 transition active:scale-95 shadow-2xl ${
                ab.ready
                  ? "bg-stone-900/95 hover:bg-stone-800 border-amber-500/60 text-stone-100 hover:border-amber-400 cursor-pointer"
                  : "bg-stone-950/85 border-stone-800 text-stone-500 cursor-not-allowed"
              }`}
            >
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-black flex items-center justify-center text-xs border border-amber-500/40">
                {ab.hotkey}
              </span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-black">{ab.name}</span>
                <span className="text-[10px] font-bold text-stone-400">
                  {ab.ready ? "READY" : `${Math.ceil(ab.cooldown)}s`}
                </span>
              </div>
              {ab.id === "oil_dump" && <Flame className="w-4 h-4 text-orange-400 ml-1" />}
              {ab.id === "catapult_barrage" && <Bomb className="w-4 h-4 text-amber-400 ml-1" />}
              {ab.id === "horn_of_helm" && <Sparkles className="w-4 h-4 text-cyan-400 ml-1" />}
              {ab.id === "archer_volley" && <Swords className="w-4 h-4 text-emerald-400 ml-1" />}
            </button>
          ))}
        </div>

        {/* Quick Tactical Controls Pill */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-950/85 border border-stone-800/80 text-[10px] font-mono font-semibold text-stone-400 shadow-xl backdrop-blur-md">
          <span><strong className="text-amber-300 font-bold">Aim:</strong> R-Click</span>
          <span>•</span>
          <span><strong className="text-cyan-300 font-bold">Steady Aim:</strong> Space / Shift</span>
          <span>•</span>
          <span><strong className="text-amber-300 font-bold">Quiver:</strong> Q / Click</span>
          <span>•</span>
          <span><strong className="text-cyan-300 font-bold">Optics:</strong> T</span>
          <span>•</span>
          <span><strong className="text-amber-300 font-bold">Upgrade:</strong> G</span>
          <span>•</span>
          <span><strong className="text-amber-300 font-bold">Repair:</strong> R</span>
        </div>
      </div>

      {/* VICTORY MODAL */}
      {gameState?.status === "victory" && (
        <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-2xl bg-stone-900 border border-amber-500/60 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center flex flex-col items-center gap-4">
            <Sparkles className="w-14 h-14 text-amber-400 animate-spin" />
            <h2 className="text-2xl font-black text-amber-300 tracking-wide">
              THE DEEP WALL HOLDS!
            </h2>
            <p className="text-sm text-stone-300">
              The hordes of the undead shattered against the gates. Helm Hammerhand himself would be
              proud.
            </p>
            <div className="flex items-center justify-center gap-6 py-2 text-stone-300 text-sm">
              <div>
                <div className="text-xs text-stone-400">Total Kills</div>
                <div className="text-xl font-bold text-amber-300">{gameState.kills}</div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Headshots</div>
                <div className="text-xl font-bold text-amber-300">{gameState.headshots}</div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Gate Integrity</div>
                <div className="text-xl font-bold text-emerald-400">
                  {Math.round((gameState.gateHp / gameState.maxGateHp) * 100)}%
                </div>
              </div>
            </div>
            <button
              onClick={handleRestart}
              className="mt-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-stone-950 font-black text-sm uppercase tracking-wider shadow hover:brightness-110 flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Defend Again
            </button>
          </div>
        </div>
      )}

      {/* DEFEAT MODAL */}
      {gameState?.status === "defeat" && (
        <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-2xl bg-stone-900 border border-red-600/60 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center flex flex-col items-center gap-4">
            <Skull className="w-14 h-14 text-red-500 animate-pulse" />
            <h2 className="text-2xl font-black text-red-500 tracking-wide">
              THE GATE HAS FALLEN
            </h2>
            <p className="text-sm text-stone-300">
              The undead breached the main gatehouse. The fortress was overwhelmed.
            </p>
            <div className="flex items-center justify-center gap-6 py-2 text-stone-300 text-sm">
              <div>
                <div className="text-xs text-stone-400">Wave Reached</div>
                <div className="text-xl font-bold text-stone-200">
                  {gameState.wave} / {gameState.totalWaves}
                </div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Kills</div>
                <div className="text-xl font-bold text-stone-200">{gameState.kills}</div>
              </div>
              <div>
                <div className="text-xs text-stone-400">Headshots</div>
                <div className="text-xl font-bold text-red-400">{gameState.headshots}</div>
              </div>
            </div>
            <button
              onClick={handleRestart}
              className="mt-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider shadow flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
