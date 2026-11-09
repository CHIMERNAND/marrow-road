using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Automated verification pass, enabled with "-m1capture &lt;dir&gt;".
    /// Takes the M1 review screenshots from fixed vantage points, lets a bot play a wave
    /// (aim with ballistic lead, fire, build a turret), measures frame times at timeScale 1,
    /// collects errors, writes report.json, then quits.
    /// </summary>
    public sealed class CaptureRunner : MonoBehaviour
    {
        string dir;
        SiegeDirector d;
        readonly List<string> errors = new List<string>();
        readonly List<string> shots = new List<string>();
        readonly List<float> frameMs = new List<float>();
        readonly List<string> notes = new List<string>();
        int errorCount, warningCount;
        bool measuring, botFiring, botAds;
        Zombie botTarget, aimFor;
        bool aimHead;
        float botYaw, botPitch;
        PlayerIntent pending;
        int botShots, botKillsAtStart;
        float started;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (LaunchArgs.CaptureDir == null) return;
            if (FindAnyObjectByType<SiegeDirector>() == null) return;
            new GameObject("CaptureRunner").AddComponent<CaptureRunner>();
        }

        void Awake()
        {
            dir = LaunchArgs.CaptureDir;
            Directory.CreateDirectory(dir);
            Application.logMessageReceived += OnLog;
            started = Time.realtimeSinceStartup;
        }

        void OnDestroy() => Application.logMessageReceived -= OnLog;

        void OnLog(string msg, string stack, LogType type)
        {
            if (type == LogType.Warning)
            {
                warningCount++;
                return;
            }

            if (type == LogType.Log) return;
            errorCount++;
            if (errors.Count < 30) errors.Add($"{type}: {msg} | {FirstLine(stack)}");
        }

        static string FirstLine(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            var i = s.IndexOf('\n');
            return i < 0 ? s : s.Substring(0, i);
        }

        IEnumerator Start()
        {
            d = SiegeDirector.Instance;
            while (d == null || !d.Ready)
            {
                d = SiegeDirector.Instance;
                yield return null;
            }

            d.IntentOverride = BotIntent;
            yield return Wait(1.5f);
            yield return Shot("00_title");
            d.StartSiege();
            var p = d.Player;
            var spawn = d.Layout.playerSpawn;
            p.Teleport(GrayboxLayout.V(spawn.p), spawn.yaw, 4f);
            yield return Wait(1.0f);
            yield return Shot("01_spawn_view");

            p.Teleport(new Vector3(92f, 0.05f, -18f), 0f, -14f);
            yield return Wait(0.6f);
            yield return Shot("02_scale_test");

            p.Teleport(new Vector3(60f, 20.05f, 3f), 90f, 3f);
            yield return Wait(0.6f);
            yield return Shot("03_wallwalk");

            p.Teleport(new Vector3(125.15f, 20.05f, 1.75f), 164f, 16f);
            yield return Wait(0.6f);
            yield return Shot("04_causeway");

            // Build a turret on the gate tower (gold granted so the run is deterministic).
            d.State.GrantGold(WallCrossbowTurret.Cost);
            p.Teleport(new Vector3(131.5f, 20.05f, 1.0f), 180f, 10f);
            yield return null;
            var built = d.TryBuildAtNearestSocket();
            notes.Add("turret_built=" + built);
            p.Teleport(new Vector3(124f, 20.05f, 3f), 160f, 8f);

            d.SkipPrep();
            botKillsAtStart = d.State.Kills;
            // Fast-forward the walk in; drop back to real time once the horde is in view.
            Time.timeScale = 3f;
            var t0 = Time.realtimeSinceStartup;
            while (Time.realtimeSinceStartup - t0 < 60f && Closest(p.transform.position) > 150f) yield return null;
            Time.timeScale = 1f;
            yield return Wait(1.0f);
            AimAt(Nearest(p.transform.position), true);
            yield return Wait(0.5f);
            yield return Shot("05_horde_approach");

            // Combat window: bot plays at timeScale 1 while frame time is sampled.
            botFiring = true;
            measuring = true;
            var tc = Time.realtimeSinceStartup;
            var combatShot = false;
            while (Time.realtimeSinceStartup - tc < 45f && d.State.Phase == SiegePhase.Wave)
            {
                if (!combatShot && Time.realtimeSinceStartup - tc > 12f && d.Weapon.Ads01 > 0.95f)
                {
                    combatShot = true;
                    yield return Shot("06_combat");
                }

                yield return null;
            }

            measuring = false;
            if (!combatShot) yield return Shot("06_combat");

            // Let the turret and the horde work; watch the gate get hit.
            botFiring = false;
            Time.timeScale = 3f;
            t0 = Time.realtimeSinceStartup;
            while (Time.realtimeSinceStartup - t0 < 50f && !AnyAtGate() && d.State.Phase == SiegePhase.Wave) yield return null;
            Time.timeScale = 1f;
            notes.Add("zombie_reached_gate=" + AnyAtGate());
            p.Teleport(new Vector3(135.3f, 20.05f, -2.0f), 90f, 60f);
            yield return Wait(2.0f);
            yield return Shot("07_gate_assault");

            // Finish the siege fast with the bot and turret to verify the full loop (waves, prep, end screen).
            botFiring = true;
            p.Teleport(new Vector3(124f, 20.05f, 3f), 160f, 8f);
            Time.timeScale = 4f;
            t0 = Time.realtimeSinceStartup;
            while (Time.realtimeSinceStartup - t0 < 150f && (d.State.Phase == SiegePhase.Wave || d.State.Phase == SiegePhase.Preparing))
            {
                if (d.State.Phase == SiegePhase.Preparing && d.State.PrepRemaining > 2f) d.SkipPrep();
                yield return null;
            }

            Time.timeScale = 1f;
            yield return Wait(1.0f);
            yield return Shot("08_end_state");
            WriteReport();
            yield return Wait(0.5f);
            Application.Quit();
        }

        void Update()
        {
            if (measuring) frameMs.Add(Time.unscaledDeltaTime * 1000f);
            if (d == null || !d.Ready || !botFiring) return;
            var p = d.Player;
            if (botTarget == null || !botTarget.Alive) botTarget = Nearest(p.transform.position);
            if (botTarget == null) return;
            AimAt(botTarget, false);
        }

        void AimAt(Zombie z, bool snap)
        {
            if (z == null) return;
            var p = d.Player;
            var from = p.Cam.transform.position;
            if (z != aimFor)
            {
                aimFor = z;
                aimHead = Random.value < 0.4f;
            }

            var aimPoint = aimHead ? z.HeadPosition : z.ChestPosition;
            if (!Ballistics.Solve(from, aimPoint, z.Velocity, CrossbowWeapon.BoltSpeed, out var dir)) return;
            botYaw = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;
            botPitch = -Mathf.Asin(dir.y) * Mathf.Rad2Deg;
            var yaw = snap ? botYaw : Mathf.MoveTowardsAngle(p.Yaw, botYaw, 120f * Time.deltaTime);
            var pitch = snap ? botPitch : Mathf.MoveTowardsAngle(p.Pitch, botPitch, 120f * Time.deltaTime);
            p.SetLook(yaw, pitch);
            var onTarget = Mathf.Abs(Mathf.DeltaAngle(yaw, botYaw)) < 0.4f && Mathf.Abs(Mathf.DeltaAngle(pitch, botPitch)) < 0.4f;
            botAds = true;
            if (botFiring && onTarget && d.Weapon.Loaded && d.Weapon.Ads01 > 0.9f)
            {
                pending.Fire = true;
                botShots++;
            }
        }

        PlayerIntent BotIntent()
        {
            var i = pending;
            i.Aim = botAds && (botFiring || measuring);
            pending = default;
            return i;
        }

        Zombie Nearest(Vector3 pos)
        {
            Zombie best = null;
            var bd = float.MaxValue;
            foreach (var z in d.Spawner.Alive)
            {
                if (!z.Alive) continue;
                var dd = (z.transform.position - pos).sqrMagnitude;
                if (dd < bd && dd < 120f * 120f)
                {
                    bd = dd;
                    best = z;
                }
            }

            return best;
        }

        float Closest(Vector3 pos)
        {
            var bd = float.MaxValue;
            foreach (var z in d.Spawner.Alive) bd = Mathf.Min(bd, Vector3.Distance(z.transform.position, pos));
            return bd;
        }

        bool AnyAtGate()
        {
            foreach (var z in d.Spawner.Alive)
                if (z.AtGate) return true;
            return false;
        }

        static IEnumerator Wait(float seconds)
        {
            var t = Time.realtimeSinceStartup + seconds;
            while (Time.realtimeSinceStartup < t) yield return null;
        }

        IEnumerator Shot(string name)
        {
            yield return new WaitForEndOfFrame();
            var tex = ScreenCapture.CaptureScreenshotAsTexture();
            var path = Path.Combine(dir, name + ".jpg");
            File.WriteAllBytes(path, tex.EncodeToJPG(88));
            Destroy(tex);
            shots.Add(name);
        }

        void WriteReport()
        {
            var sorted = new List<float>(frameMs);
            sorted.Sort();
            float Pct(float q) => sorted.Count == 0 ? 0 : sorted[Mathf.Clamp(Mathf.FloorToInt(q * (sorted.Count - 1)), 0, sorted.Count - 1)];
            var avg = 0f;
            foreach (var f in frameMs) avg += f;
            avg = frameMs.Count > 0 ? avg / frameMs.Count : 0;
            var s = d.State;
            var sb = new StringBuilder();
            sb.Append("{\n");
            KV(sb, "build", Application.version);
            KV(sb, "unity", Application.unityVersion);
            KV(sb, "gpu", SystemInfo.graphicsDeviceName);
            KV(sb, "cpu", SystemInfo.processorType);
            KV(sb, "resolution", $"{Screen.width}x{Screen.height}");
            KV(sb, "fullscreen", Screen.fullScreenMode.ToString());
            KV(sb, "vsync", QualitySettings.vSyncCount);
            KV(sb, "quality", QualitySettings.names[QualitySettings.GetQualityLevel()]);
            KV(sb, "navmesh_build_ms", d.NavMeshBuildMs);
            KV(sb, "perf_frames", frameMs.Count);
            KV(sb, "perf_avg_ms", avg);
            KV(sb, "perf_avg_fps", avg > 0 ? 1000f / avg : 0);
            KV(sb, "perf_p95_ms", Pct(0.95f));
            KV(sb, "perf_p99_ms", Pct(0.99f));
            KV(sb, "perf_worst_ms", Pct(1f));
            KV(sb, "phase_end", s.Phase.ToString());
            KV(sb, "wave_reached", s.Wave);
            KV(sb, "gate_hp", s.GateHp);
            KV(sb, "kills", s.Kills);
            KV(sb, "player_kills", s.PlayerKills);
            KV(sb, "turret_kills", s.TurretKills);
            KV(sb, "headshots", s.Headshots);
            KV(sb, "shots_fired", s.ShotsFired);
            KV(sb, "shots_hit", s.ShotsHit);
            KV(sb, "spawn_failures", d.SpawnFailures);
            KV(sb, "alive_at_end", d.Spawner.Alive.Count);
            KV(sb, "error_count", errorCount);
            KV(sb, "warning_count", warningCount);
            KV(sb, "runtime_s", Time.realtimeSinceStartup - started);
            sb.Append("  \"notes\": [").Append(Join(notes)).Append("],\n");
            sb.Append("  \"shots\": [").Append(Join(shots)).Append("],\n");
            sb.Append("  \"errors\": [").Append(Join(errors)).Append("]\n}\n");
            File.WriteAllText(Path.Combine(dir, "report.json"), sb.ToString());
        }

        static string Esc(string s) => s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ");

        static string Join(List<string> items)
        {
            var sb = new StringBuilder();
            for (var i = 0; i < items.Count; i++)
            {
                if (i > 0) sb.Append(", ");
                sb.Append('"').Append(Esc(items[i])).Append('"');
            }

            return sb.ToString();
        }

        static void KV(StringBuilder sb, string k, object v)
        {
            sb.Append("  \"").Append(k).Append("\": ");
            if (v is string str) sb.Append('"').Append(Esc(str)).Append('"');
            else if (v is float f) sb.Append(f.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
            else sb.Append(System.Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture));
            sb.Append(",\n");
        }
    }
}
