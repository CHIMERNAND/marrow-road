using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Automated verification pass, enabled with "-capture &lt;dir&gt;" (or the M1 alias "-m1capture").
    /// Takes the review screenshots, then a bot plays the whole night: it aims with ballistic lead and fires,
    /// follows a scripted build/upgrade/repair plan, shoves loaded ladders and returns to its post after being
    /// downed. Frame time is sampled at timeScale 1 during wave 1 and one heavy late wave; the rest runs at
    /// timeScale 4. Writes report.json (with per-wave history and frame spikes), then quits.
    /// "-capturewaves N" stops after N waves.
    /// </summary>
    public sealed class CaptureRunner : MonoBehaviour
    {
        const float FastScale = 4f;
        const float SpikeMs = 33.4f;
        const float RunBudgetSeconds = 26f * 60f;
        static readonly RaycastHit[] HitBuf = new RaycastHit[32];

        // Scripted economy: socket + turret id ("" = upgrade the turret there).
        static readonly (string socket, string id)[] Plan =
        {
            ("GateTowerW", "crossbow"),
            ("OverGate", "pitch"),
            ("Bastion2", "catapult"),
            ("GateTowerE", "ballista"),
            ("GateTowerW", ""),
            ("OverGate", ""),
            ("WallEast", "crossbow"),
            ("Bastion2", ""),
            ("GateTowerE", ""),
            ("GateTowerW", ""),
            ("OverGate", ""),
            ("Bastion1", "catapult"),
            ("WallEast", ""),
            ("Bastion2", ""),
            ("GateTowerE", ""),
            ("WallEast", ""),
            ("Bastion1", ""),
            ("Bastion1", ""),
        };

        string dir;
        SiegeDirector d;
        readonly List<string> errors = new List<string>();
        readonly List<string> shots = new List<string>();
        readonly List<float> frameMs = new List<float>();
        readonly List<string> notes = new List<string>();
        readonly List<string> planLog = new List<string>();
        readonly List<(float ms, int wave, float t)> spikes = new List<(float, int, float)>();
        readonly Dictionary<int, (double sum, int n, int spikes)> waveFrames = new Dictionary<int, (double, int, int)>();
        int errorCount, warningCount, spikeCount, allFrames;
        bool measuring, botFiring, botAds, busy;
        Zombie botTarget, aimFor;
        bool aimHead;
        float botYaw, botPitch;
        PlayerIntent pending;
        int botShots, losRetargets, blockedHolds, planStep, botShoves, botRepairs, revives;
        float maxPeek, losTimer, perfLateWave = -1;
        readonly List<string> luma = new List<string>();
        float started;
        Vector3 post;
        bool ladderShot, breachShot, defensesShot, returnToPost;

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

        bool reportWritten;

        void OnDestroy() => Application.logMessageReceived -= OnLog;

        // If the window is closed early, still leave a (partial) report behind.
        void OnApplicationQuit()
        {
            if (reportWritten || d == null) return;
            notes.Add("aborted_early=True");
            WriteReport();
        }

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
            d.Vitals.Revived += () => { revives++; returnToPost = true; };
            d.State.GateBreachedEvent += () => notes.Add($"gate_breached_wave={d.State.Wave} t={d.State.ElapsedSeconds:0}");
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

            post = PostAgainstParapet(new Vector3(133.2f, 20.05f, -1.5f), 180f);
            p.Teleport(post, 180f, 8f);
            RunPlan();
            yield return Wait(0.5f);
            p.Teleport(new Vector3(126.5f, 20.05f, 3.2f), 120f, 8f);
            yield return Wait(0.6f);
            yield return Shot("05_first_turret");
            p.Teleport(post, 180f, 8f);
            d.SkipPrep();

            // Wave 1 at real time: walk-in, approach shot, measured combat.
            botFiring = true;
            measuring = true;
            Time.timeScale = 1f;
            var t0 = Time.realtimeSinceStartup;
            var approach = false;
            var combat = false;
            while (d.State.Phase == SiegePhase.Wave && d.State.Wave == 1 && Time.realtimeSinceStartup - t0 < 240f)
            {
                if (!approach && Closest(p.transform.position) < 140f)
                {
                    approach = true;
                    yield return Shot("06_horde_approach");
                }

                if (!combat && approach && Time.realtimeSinceStartup - t0 > 40f && d.Weapon.Ads01 > 0.95f)
                {
                    combat = true;
                    yield return Shot("07_combat");
                }

                yield return Tend();
            }

            measuring = false;
            notes.Add($"wave1_realtime_s={Time.realtimeSinceStartup - t0:0}");

            // The rest of the night at speed, with one heavy late wave measured at real time.
            var maxWaves = LaunchArgs.CaptureWaves > 0 ? LaunchArgs.CaptureWaves : d.State.TotalWaves;
            perfLateWave = Mathf.Min(maxWaves, Mathf.Max(2, d.State.TotalWaves - 2));
            var aborted = false;
            while (d.State.Phase is SiegePhase.Wave or SiegePhase.Preparing && d.History.Count < maxWaves)
            {
                if (Time.realtimeSinceStartup - started > RunBudgetSeconds)
                {
                    aborted = true;
                    break;
                }

                var late = d.State.Phase == SiegePhase.Wave && d.State.Wave == (int)perfLateWave;
                if (late && lateStart <= 0f) lateStart = Time.realtimeSinceStartup;
                measuring = late && Time.realtimeSinceStartup - lateStart < 75f;
                Time.timeScale = measuring ? 1f : FastScale;

                if (d.State.Phase == SiegePhase.Preparing)
                {
                    botFiring = false;
                    if (busy) { yield return null; continue; }
                    RunPlan();
                    if (!defensesShot && d.State.Wave >= 5)
                    {
                        defensesShot = true;
                        yield return VantageShot("09_defenses", new Vector3(122f, 20.05f, 3.6f), 115f, 10f);
                    }

                    if (d.State.PrepRemaining > 1.5f) d.SkipPrep();
                }
                else
                {
                    botFiring = true;
                    if (Time.frameCount % 30 == 0) RunPlan();
                }

                yield return Tend();
            }

            measuring = false;
            botFiring = false;
            Time.timeScale = 1f;
            if (aborted) notes.Add("run_budget_exceeded=True");
            notes.Add($"plan_steps_done={planStep}/{Plan.Length}");
            yield return Wait(1.0f);
            yield return Shot("12_end_state");
            WriteReport();
            yield return Wait(0.5f);
            Application.Quit();
        }

        float lateStart;

        /// <summary>One frame of bot housekeeping: event shots, ladder shoves, return to post.</summary>
        IEnumerator Tend()
        {
            if (busy)
            {
                yield return null;
                yield break;
            }

            var p = d.Player;
            if (returnToPost && !d.Vitals.Down)
            {
                returnToPost = false;
                p.Teleport(post, 180f, 8f);
            }

            if (!breachShot && d.State.GateBreached && d.State.Phase == SiegePhase.Wave)
            {
                breachShot = true;
                yield return VantageShot("11_breach_court", new Vector3(146f, 20.05f, 5.0f), 150f, 32f);
            }

            if (d.State.Phase == SiegePhase.Wave)
            {
                foreach (var l in d.Ladders)
                {
                    if (!l.Shovable || l.ClimberCount < 2) continue;
                    if (!ladderShot)
                    {
                        ladderShot = true;
                        var from = l.TopWalk + new Vector3(l.TopWalk.x < 70f ? 6f : -6f, 0.05f, 0.4f);
                        var yaw = Quaternion.LookRotation(l.PointAt(0.5f) - from).eulerAngles.y;
                        yield return VantageShot("10_ladder", from, yaw, 38f);
                    }

                    yield return ShoveRoutine(l);
                    break;
                }
            }

            yield return null;
        }

        /// <summary>The bot runs to the ladder (travel time scales with distance), shoves it and returns.</summary>
        IEnumerator ShoveRoutine(SiegeLadder l)
        {
            busy = true;
            var p = d.Player;
            var wasFiring = botFiring;
            botFiring = false;
            var travel = Mathf.Clamp(Vector3.Distance(p.transform.position, l.ShovePoint) / 6.5f, 0.5f, 9f);
            var tEnd = Time.time + travel;
            while (Time.time < tEnd && d.State.Phase == SiegePhase.Wave) yield return null;
            if (l.Shovable && !d.Vitals.Down)
            {
                p.Teleport(l.ShovePoint, p.Yaw, 10f);
                yield return null;
                d.ShoveLadder(l);
                botShoves++;
                tEnd = Time.time + travel;
                while (Time.time < tEnd && d.State.Phase == SiegePhase.Wave) yield return null;
            }

            if (!d.Vitals.Down) p.Teleport(post, 180f, 8f);
            botFiring = wasFiring;
            busy = false;
        }

        IEnumerator VantageShot(string name, Vector3 at, float yaw, float pitch)
        {
            busy = true;
            var p = d.Player;
            var wasFiring = botFiring;
            botFiring = false;
            var scale = Time.timeScale;
            Time.timeScale = 0.15f;
            p.Teleport(at, yaw, pitch);
            yield return Wait(0.4f);
            yield return Shot(name);
            Time.timeScale = scale;
            if (!d.Vitals.Down) p.Teleport(post, 180f, 8f);
            botFiring = wasFiring;
            busy = false;
        }

        /// <summary>Spend gold: emergency gate repair first, then the build plan, then top up the gate.</summary>
        void RunPlan()
        {
            var s = d.State;
            var prep = s.Phase == SiegePhase.Preparing;
            for (var guard = 0; guard < 12; guard++)
            {
                if (prep && (s.GateBreached || s.Gate01 < 0.5f) && d.TryRepairGate())
                {
                    botRepairs++;
                    continue;
                }

                if (planStep < Plan.Length)
                {
                    var (sockName, id) = Plan[planStep];
                    var sock = d.Sockets.Find(x => x.socketName == sockName || x.socketName == "Socket_" + sockName);
                    if (sock == null)
                    {
                        planLog.Add($"missing socket {sockName}");
                        planStep++;
                        continue;
                    }

                    var ok = id == "" ? (sock.Occupied && sock.Turret.CanUpgrade && d.TryUpgrade(sock)) : (!sock.Occupied && d.TryBuild(sock, id));
                    var impossible = id == "" ? !sock.Occupied || !sock.Turret.CanUpgrade : sock.Occupied || !sock.Allows(id);
                    if (ok || impossible)
                    {
                        planLog.Add($"w{s.Wave} {(ok ? "" : "SKIP ")}{(id == "" ? "upgrade" : id)}@{sockName} gold={s.Gold}");
                        planStep++;
                        continue;
                    }
                }

                if (prep && s.Gate01 < 0.85f && (planStep >= Plan.Length || s.Gold >= d.RepairCost * 3) && d.TryRepairGate())
                {
                    botRepairs++;
                    continue;
                }

                break;
            }
        }

        void Update()
        {
            var ms = Time.unscaledDeltaTime * 1000f;
            if (measuring) frameMs.Add(ms);
            if (d == null || !d.Ready) return;
            if (d.State.Phase == SiegePhase.Wave && Time.frameCount > 10)
            {
                allFrames++;
                var wv = d.State.Wave;
                waveFrames.TryGetValue(wv, out var acc);
                var spike = ms > SpikeMs;
                waveFrames[wv] = (acc.sum + ms, acc.n + 1, acc.spikes + (spike ? 1 : 0));
                if (spike)
                {
                    spikeCount++;
                    spikes.Add((ms, wv, d.State.ElapsedSeconds));
                    if (spikes.Count > 64)
                    {
                        spikes.Sort((x, y) => y.ms.CompareTo(x.ms));
                        spikes.RemoveRange(32, spikes.Count - 32);
                    }
                }
            }

            maxPeek = Mathf.Max(maxPeek, d.Player.Peek);
            if (!botFiring || d.Vitals.Down) return;
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
            var n = Physics.RaycastNonAlloc(cam, to.normalized, HitBuf, to.magnitude + 0.5f, ~(1 << 2), QueryTriggerInteraction.Collide);
            var nearest = float.MaxValue;
            Collider first = null;
            for (var i = 0; i < n; i++)
            {
                if (HitBuf[i].distance < nearest)
                {
                    nearest = HitBuf[i].distance;
                    first = HitBuf[i].collider;
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
                if (z.OnWall || z.OnLadder) dd *= 0.25f; // threats on the wall first
                if (z.Kind == EnemyKind.Ram) dd *= 0.6f;
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
            reportWritten = true;
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
            KV(sb, "prewarm_ms", d.PrewarmMs);
            KV(sb, "all_wave_frames", allFrames);
            KV(sb, "spike_frames_over_33ms", spikeCount);
            KV(sb, "perf_late_wave", (int)perfLateWave);
            KV(sb, "phase_end", s.Phase.ToString());
            KV(sb, "victory", s.Phase == SiegePhase.Victory);
            KV(sb, "waves_total", s.TotalWaves);
            KV(sb, "waves_completed", d.History.Count);
            KV(sb, "gate_breached", s.GateBreached);
            KV(sb, "breach_wave", s.BreachWave);
            KV(sb, "keep_hp", s.KeepHp);
            KV(sb, "gold_end", s.Gold);
            KV(sb, "gold_earned", s.GoldEarned);
            KV(sb, "gold_spent", s.GoldSpent);
            KV(sb, "gate_repairs", d.GateRepairs);
            KV(sb, "ladder_shoves", d.LadderShoves);
            KV(sb, "climbers_topped", d.ClimbersTopped);
            KV(sb, "player_downs", d.Vitals.Downs);
            KV(sb, "player_damage_taken", d.Vitals.DamageTaken);
            KV(sb, "peak_active_enemies", d.Spawner.PeakActive);
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
            KV(sb, "bot_shoves", botShoves);
            KV(sb, "bot_repairs", botRepairs);
            KV(sb, "bot_revives", revives);
            KV(sb, "max_peek_m", maxPeek);
            KV(sb, "spawn_failures", d.SpawnFailures);
            KV(sb, "alive_at_end", d.Spawner.Alive.Count);
            KV(sb, "error_count", errorCount);
            KV(sb, "warning_count", warningCount);
            KV(sb, "runtime_s", Time.realtimeSinceStartup - started);
            sb.Append("  \"kills_by_source\": {").Append(Dict(s.KillsBySource)).Append("},\n");
            var turrets = new List<string>();
            foreach (var t in d.Turrets)
                if (t != null) turrets.Add($"{t.Def.id}@{t.Socket.socketName} t{t.Tier + 1} kills={t.Kills} shots={t.Shots}");
            sb.Append("  \"turrets\": [").Append(Join(turrets)).Append("],\n");
            sb.Append("  \"plan_log\": [").Append(Join(planLog)).Append("],\n");
            spikes.Sort((x, y) => y.ms.CompareTo(x.ms));
            var top = new List<string>();
            for (var i = 0; i < spikes.Count && i < 12; i++) top.Add($"{spikes[i].ms:0.0}ms w{spikes[i].wave} t={spikes[i].t:0.0}");
            sb.Append("  \"top_spikes\": [").Append(Join(top)).Append("],\n");
            sb.Append("  \"waves\": [\n");
            for (var i = 0; i < d.History.Count; i++)
            {
                var r = d.History[i];
                waveFrames.TryGetValue(r.Wave, out var wf);
                var inv = System.Globalization.CultureInfo.InvariantCulture;
                sb.Append("    {");
                sb.Append($"\"wave\": {r.Wave}, \"duration_s\": {r.Duration.ToString("0.0", inv)}, \"spawned\": {r.Spawned}, \"kills\": {r.Kills}, ");
                sb.Append($"\"gate_start\": {r.GateStart.ToString("0", inv)}, \"gate_end\": {r.GateEnd.ToString("0", inv)}, \"keep_end\": {r.KeepEnd.ToString("0", inv)}, \"breached\": {(r.Breached ? "true" : "false")}, ");
                sb.Append($"\"gold_start\": {r.GoldStart}, \"gold_end\": {r.GoldEnd}, \"climbed\": {r.Climbed}, \"shoved\": {r.Shoved}, \"downs\": {r.Downs}, \"peak_alive\": {r.PeakAlive}, ");
                sb.Append($"\"avg_frame_ms\": {(wf.n > 0 ? wf.sum / wf.n : 0).ToString("0.00", inv)}, \"spikes\": {wf.spikes}, ");
                sb.Append("\"spawned_by_type\": {").Append(Dict(r.SpawnedByType)).Append("}, \"kills_by_source\": {").Append(Dict(r.KillsBySource)).Append("}}");
                sb.Append(i < d.History.Count - 1 ? ",\n" : "\n");
            }

            sb.Append("  ],\n");
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

        static string Dict(Dictionary<string, int> m)
        {
            var sb = new StringBuilder();
            foreach (var kv in m)
            {
                if (sb.Length > 0) sb.Append(", ");
                sb.Append('"').Append(Esc(kv.Key)).Append("\": ").Append(kv.Value);
            }

            return sb.ToString();
        }

        static void KV(StringBuilder sb, string k, object v)
        {
            sb.Append("  \"").Append(k).Append("\": ");
            if (v is string str) sb.Append('"').Append(Esc(str)).Append('"');
            else if (v is bool bo) sb.Append(bo ? "true" : "false");
            else if (v is float f) sb.Append(f.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
            else sb.Append(System.Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture));
            sb.Append(",\n");
        }
    }
}
