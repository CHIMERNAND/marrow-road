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
        int botShots, botKillsAtStart, losRetargets, blockedHolds;
        float maxPeek, losTimer;
        readonly List<string> luma = new List<string>();
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

            // Exposure bracket of the same view so the night grade can be tuned from one run.
            var userBright = GameSettings.Brightness;
            GameSettings.Brightness = -1f;
            yield return Wait(0.3f);
            yield return Shot("01b_spawn_ev-1");
            GameSettings.Brightness = 1f;
            yield return Wait(0.3f);
            yield return Shot("01c_spawn_ev+1");
            GameSettings.Brightness = userBright;
            yield return Wait(0.2f);

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
            var post = PostAgainstParapet(new Vector3(133.2f, 20.05f, -1.5f), 180f);
            p.Teleport(post, 180f, 8f);

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
            p.Teleport(post, 180f, 8f);
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
            if (d == null || !d.Ready) return;
            maxPeek = Mathf.Max(maxPeek, d.Player.Peek);
            if (!botFiring) return;
            var p = d.Player;
            losTimer -= Time.unscaledDeltaTime;
            if (botTarget == null || !botTarget.Alive || (losTimer <= 0f && !Visible(botTarget)))
            {
                if (botTarget != null && botTarget.Alive) losRetargets++;
                botTarget = Nearest(p.transform.position);
                losTimer = 0.3f;
            }

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
                // Never loose a bolt into the stonework right in front of the face.
                var cam = p.Cam.transform;
                if (Physics.Raycast(cam.position, cam.forward, 4f, ~(1 << 2), QueryTriggerInteraction.Ignore))
                {
                    blockedHolds++;
                    return;
                }

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

        /// <summary>Clear line from the eye (as it would be when leaning over) to the zombie's chest.</summary>
        bool Visible(Zombie z)
        {
            var p = d.Player;
            var eye = p.Cam.transform.position;
            if (SeesFrom(eye, z)) return true;
            // Also count targets that would be visible once leaning out through the crenel.
            var fwd = Quaternion.Euler(0, p.Yaw, 0) * Vector3.forward;
            var reach = FirstPersonController.MaxPeek - p.Peek;
            if (reach < 0.2f || Physics.SphereCast(eye, 0.16f, fwd, out _, reach, ~(1 << 2), QueryTriggerInteraction.Ignore)) return false;
            return SeesFrom(eye + fwd * reach + Vector3.down * 0.35f, z);
        }

        static bool SeesFrom(Vector3 cam, Zombie z)
        {
            var to = z.ChestPosition - cam;
            var hits = Physics.RaycastAll(cam, to.normalized, to.magnitude + 0.5f, ~(1 << 2), QueryTriggerInteraction.Collide);
            var nearest = float.MaxValue;
            Collider first = null;
            foreach (var h in hits)
            {
                if (h.distance < nearest)
                {
                    nearest = h.distance;
                    first = h.collider;
                }
            }

            return first == null || first.GetComponentInParent<Zombie>() == z;
        }

        /// <summary>
        /// Finds a crenel (gap between merlons) near <paramref name="approx"/> and returns feet
        /// position pressed against the breastwork, facing <paramref name="yaw"/>.
        /// </summary>
        Vector3 PostAgainstParapet(Vector3 approx, float yaw)
        {
            var fwd = Quaternion.Euler(0, yaw, 0) * Vector3.forward;
            var right = Quaternion.Euler(0, yaw, 0) * Vector3.right;
            const int mask = ~(1 << 2);
            float bestCenter = 0f, bestLen = 0f, bestScore = float.MaxValue;
            float runStart = float.NaN;
            for (var o = -1.6f; o <= 1.6f + 0.001f; o += 0.05f)
            {
                var head = approx + right * o + Vector3.up * 1.7f;
                var free = !Physics.Raycast(head, fwd, 3f, mask, QueryTriggerInteraction.Ignore);
                if (free && float.IsNaN(runStart)) runStart = o;
                var end = !free || o >= 1.6f - 0.001f;
                if (end && !float.IsNaN(runStart))
                {
                    var stop = free ? o : o - 0.05f;
                    var len = stop - runStart;
                    var c = (runStart + stop) / 2f;
                    var score = Mathf.Abs(c) - len * 2f;
                    if (len > 0.5f && score < bestScore)
                    {
                        bestScore = score;
                        bestCenter = c;
                        bestLen = len;
                    }

                    runStart = float.NaN;
                }
            }

            var spot = approx + right * bestCenter;
            if (Physics.Raycast(spot + Vector3.up * 0.6f, fwd, out var hit, 4f, mask, QueryTriggerInteraction.Ignore))
                spot = new Vector3(hit.point.x, approx.y, hit.point.z) - fwd * 0.4f;
            notes.Add($"post=({spot.x:0.0},{spot.z:0.0}) crenel={bestLen:0.00}m");
            return spot;
        }

        Zombie Nearest(Vector3 pos)
        {
            Zombie best = null;
            var bd = float.MaxValue;
            foreach (var z in d.Spawner.Alive)
            {
                if (!z.Alive || !Visible(z)) continue;
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
            luma.Add($"{name}={MeanLuma(tex):0.0}");
            var path = Path.Combine(dir, name + ".jpg");
            File.WriteAllBytes(path, tex.EncodeToJPG(88));
            Destroy(tex);
            shots.Add(name);
        }

        static float MeanLuma(Texture2D tex)
        {
            var px = tex.GetPixels32();
            double sum = 0;
            var n = 0;
            for (var i = 0; i < px.Length; i += 97)
            {
                var c = px[i];
                sum += 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
                n++;
            }

            return n == 0 ? 0f : (float)(sum / n);
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
            KV(sb, "bot_shots", botShots);
            KV(sb, "bot_los_retargets", losRetargets);
            KV(sb, "bot_blocked_holds", blockedHolds);
            KV(sb, "max_peek_m", maxPeek);
            KV(sb, "spawn_failures", d.SpawnFailures);
            KV(sb, "alive_at_end", d.Spawner.Alive.Count);
            KV(sb, "error_count", errorCount);
            KV(sb, "warning_count", warningCount);
            KV(sb, "runtime_s", Time.realtimeSinceStartup - started);
            sb.Append("  \"notes\": [").Append(Join(notes)).Append("],\n");
            sb.Append("  \"shots\": [").Append(Join(shots)).Append("],\n");
            sb.Append("  \"mean_luma_0_255\": [").Append(Join(luma)).Append("],\n");
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
