using System.Collections.Generic;
using Unity.AI.Navigation;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.SceneManagement;

namespace MarrowRoad
{
    /// <summary>Per-wave numbers for the results screen and the automated report.</summary>
    public sealed class WaveRecord
    {
        public int Wave;
        public float StartTime, Duration;
        public int Spawned, Kills, GoldStart, GoldEnd, Climbed, Shoved, Downs, PeakAlive;
        public float GateStart, GateEnd, KeepEnd;
        public bool Breached;
        public readonly Dictionary<string, int> SpawnedByType = new Dictionary<string, int>();
        public readonly Dictionary<string, int> KillsBySource = new Dictionary<string, int>();
    }

    /// <summary>
    /// Scene entry point. Owns the authoritative SiegeState, balance data, the runtime NavMesh, the wave
    /// schedule, ladders, the gate/keep fall-back and the local player. In co-op this component runs on the host.
    /// </summary>
    public sealed class SiegeDirector : MonoBehaviour
    {
        public const float SocketReach = 3.5f;
        public const float LadderReach = 2.6f;

        public TextAsset layoutJson;
        public TextAsset balanceJson;
        public GateDoor gate;
        public KeepDoor keepDoor;

        public static SiegeDirector Instance { get; private set; }
        public Balance Balance { get; private set; }
        public SiegeState State { get; private set; }
        public PlayerVitals Vitals { get; private set; }
        public ZombieSpawner Spawner { get; private set; }
        public GrayboxLayout Layout { get; private set; }
        public FirstPersonController Player { get; private set; }
        public CrossbowWeapon Weapon { get; private set; }
        public Vector3 GateTarget { get; private set; }
        public Vector3 KeepTarget { get; private set; }
        public Vector3 SabotagePoint { get; private set; }
        public float NavMeshBuildMs { get; private set; }
        public float PrewarmMs { get; private set; }
        public bool Ready { get; private set; }
        public bool Paused { get; private set; }
        public bool InputLocked { get; set; }
        public int SpawnFailures { get; private set; }
        public int ClimbersTopped { get; private set; }
        public int LadderShoves { get; private set; }
        public int GateRepairs { get; private set; }
        public Vector3 LastPlayerHitFrom { get; private set; }
        public float BreachBannerTime { get; private set; } = -100f;
        public readonly List<TurretSocket> Sockets = new List<TurretSocket>();
        public readonly List<Turret> Turrets = new List<Turret>();
        public readonly List<SiegeLadder> Ladders = new List<SiegeLadder>();
        public readonly List<WaveRecord> History = new List<WaveRecord>();
        public WaveRecord CurrentWave { get; private set; }

        /// <summary>When set, this replaces local device input for the frame (capture bot).</summary>
        public System.Func<PlayerIntent> IntentOverride;

        public event System.Action<int> WaveStarted;
        public event System.Action<WaveRecord> WaveEnded;

        readonly List<string> spawnQueue = new List<string>();
        float spawnTimer;
        bool waveSpawningDone;
        int waveSpawnFailures;
        int ladderPick;
        readonly List<Vector3> gatePoints = new List<Vector3>();
        readonly List<Vector3> keepPoints = new List<Vector3>();
        readonly HashSet<Zombie> slotHolders = new HashSet<Zombie>();
        readonly List<Zombie> scratch = new List<Zombie>();

        void Awake()
        {
            Instance = this;
            Layout = layoutJson != null ? GrayboxLayout.FromJson(layoutJson.text) : new GrayboxLayout();
            Balance = balanceJson != null ? Balance.FromJson(balanceJson.text) : new Balance();
            if (Balance.TotalWaves == 0) Debug.LogError("[MarrowRoad] balance.json has no waves.");
            State = new SiegeState(Balance);
            Vitals = new PlayerVitals(Balance.player);
            GateTarget = GrayboxLayout.V(Layout.gateTarget);
            KeepTarget = GrayboxLayout.V(Layout.keepTarget);
            SabotagePoint = new Vector3(GateTarget.x, Layout.wallTop, 3.2f);
            for (var i = 0; i < 24; i++)
            {
                gatePoints.Add(GateTarget + new Vector3(Random.Range(-3.0f, 3.0f), 0, Random.Range(-1.6f, 1.1f)));
                keepPoints.Add(KeepTarget + new Vector3(Random.Range(-3.5f, 3.5f), 0, Random.Range(-1.8f, 0.6f)));
            }

            State.GateBreachedEvent += OnGateBreached;
            Vitals.Revived += OnPlayerRevived;
        }

        void Start()
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var surface = gameObject.AddComponent<NavMeshSurface>();
            surface.collectObjects = CollectObjects.Volume;
            // Valley, causeway, shelf, gate passage, court (fall-back) and the wall walk from x 20 to the gatehouse.
            surface.center = transform.InverseTransformPoint(new Vector3(122.5f, 15f, -107.5f));
            surface.size = new Vector3(205f, 40f, 315f);
            surface.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
            surface.layerMask = 1; // Default layer only: level geometry. Player/turrets live on Ignore Raycast.
            surface.overrideVoxelSize = true;
            surface.voxelSize = 0.2f;
            surface.BuildNavMesh();
            NavMeshBuildMs = (float)sw.Elapsed.TotalMilliseconds;
            Debug.Log($"[MarrowRoad] NavMesh built in {NavMeshBuildMs:0} ms");

            sw.Restart();
            gameObject.AddComponent<ExposureControl>();
            Spawner = new ZombieSpawner(new GameObject("Enemies").transform, MaterialLibrary.Instance, Balance);
            Spawner.Prewarm(Balance.maxAlive);
            Bolt.Prewarm(64);
            // Shader.WarmupAllShaders() hard-crashes the D3D12 player (seen on G15, Unity 6000.3).
            // Pooled instances above already create their materials; PSOs compile on first draw.
            PrewarmMs = (float)sw.Elapsed.TotalMilliseconds;
            Debug.Log($"[MarrowRoad] Prewarm {PrewarmMs:0} ms ({Balance.TotalWaves} waves, {Balance.enemies.Length} enemy types)");

            Sockets.AddRange(FindObjectsByType<TurretSocket>(FindObjectsSortMode.None));
            Sockets.Sort((a, b) => string.CompareOrdinal(a.socketName, b.socketName));
            var ladderRoot = new GameObject("Ladders").transform;
            foreach (var l in Layout.ladders) Ladders.Add(SiegeLadder.Create(ladderRoot, l, Layout.wallTop, MaterialLibrary.Instance));

            var spawn = Layout.playerSpawn;
            Player = FirstPersonController.Create(GrayboxLayout.V(spawn.p), spawn.yaw);
            Weapon = CrossbowWeapon.Attach(Player, this);
            Player.Teleport(GrayboxLayout.V(spawn.p), spawn.yaw, 4f);
            foreach (var cam in FindObjectsByType<Camera>(FindObjectsSortMode.None))
            {
                if (cam != Player.Cam) cam.gameObject.SetActive(false);
            }

            GraphicsOptions.RegisterSceneLights();
            if (LaunchArgs.CaptureDir != null) GraphicsOptions.ApplyCaptureProfile(Player.Cam);
            else GraphicsOptions.Apply(Player.Cam);

            if (!NavMesh.SamplePosition(GateTarget, out _, 4f, NavMesh.AllAreas))
                Debug.LogError("[MarrowRoad] Gate target is not on the NavMesh; zombies cannot reach the gate.");
            if (!NavMesh.SamplePosition(KeepTarget, out _, 4f, NavMesh.AllAreas))
                Debug.LogError("[MarrowRoad] Keep target is not on the NavMesh; the fall-back cannot be assaulted.");
            // The fall-back only works if the gate passage joins the causeway to the court (carving is not applied yet).
            if (NavMesh.SamplePosition(GateTarget, out var gHit, 4f, NavMesh.AllAreas) && NavMesh.SamplePosition(KeepTarget, out var kHit, 4f, NavMesh.AllAreas))
            {
                var path = new NavMeshPath();
                NavMesh.CalculatePath(gHit.position, kHit.position, NavMesh.AllAreas, path);
                if (path.status != NavMeshPathStatus.PathComplete)
                    Debug.LogError("[MarrowRoad] No NavMesh path from the gate to the keep (" + path.status + "); a breach would strand the horde.");
                else
                    Debug.Log("[MarrowRoad] Gate-to-keep path OK (" + path.corners.Length + " corners)");
            }

            foreach (var l in Ladders)
            {
                if (!NavMesh.SamplePosition(l.ApproachPoint, out _, 4f, NavMesh.AllAreas))
                    Debug.LogError("[MarrowRoad] Ladder foot off the NavMesh: " + l.ladderName);
                if (!NavMesh.SamplePosition(l.TopWalk, out _, 3f, NavMesh.AllAreas))
                    Debug.LogError("[MarrowRoad] Ladder top (wall walk) off the NavMesh: " + l.ladderName);
            }

            Ready = true;
        }

        // ---------- Flow ----------

        public void StartSiege()
        {
            if (State.Phase != SiegePhase.Title) return;
            State.Begin(Balance.prep.first);
            Vitals.Reset();
            SetCursorLocked(true);
        }

        public void SkipPrep()
        {
            if (State.Phase == SiegePhase.Preparing) BeginWave();
        }

        public void SetPaused(bool paused)
        {
            if (State.Phase is SiegePhase.Title or SiegePhase.Victory or SiegePhase.Defeat) paused = false;
            Paused = paused;
            Time.timeScale = paused ? 0f : 1f;
            SetCursorLocked(!paused && State.Phase is SiegePhase.Preparing or SiegePhase.Wave);
            if (!paused && Player != null) GraphicsOptions.Apply(Player.Cam);
        }

        public static void SetCursorLocked(bool locked)
        {
            if (LaunchArgs.CaptureDir != null) return;
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        public void Restart()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        void BeginWave()
        {
            State.StartNextWave();
            BuildSpawnQueue(Balance.Wave(State.Wave));
            spawnTimer = 0f;
            waveSpawningDone = false;
            waveSpawnFailures = 0;
            CurrentWave = new WaveRecord
            {
                Wave = State.Wave,
                StartTime = State.ElapsedSeconds,
                GoldStart = State.Gold,
                GateStart = State.GateHp,
                Spawned = 0
            };
            foreach (var kv in State.KillsBySource) CurrentWave.KillsBySource[kv.Key] = -kv.Value; // diffed at the end
            CurrentWave.Kills = -State.Kills;
            CurrentWave.Climbed = -ClimbersTopped;
            CurrentWave.Shoved = -LadderShoves;
            CurrentWave.Downs = -Vitals.Downs;
            WaveStarted?.Invoke(State.Wave);
        }

        void EndWave()
        {
            var r = CurrentWave;
            if (r != null)
            {
                r.Duration = State.ElapsedSeconds - r.StartTime;
                r.GoldEnd = State.Gold;
                r.GateEnd = State.GateHp;
                r.KeepEnd = State.KeepHp;
                r.Breached = State.GateBreached;
                r.Kills += State.Kills;
                r.Climbed += ClimbersTopped;
                r.Shoved += LadderShoves;
                r.Downs += Vitals.Downs;
                foreach (var kv in State.KillsBySource)
                {
                    r.KillsBySource.TryGetValue(kv.Key, out var before);
                    r.KillsBySource[kv.Key] = before + kv.Value;
                }

                History.Add(r);
                WaveEnded?.Invoke(r);
            }

            CurrentWave = null;
        }

        void BuildSpawnQueue(WaveDef w)
        {
            spawnQueue.Clear();
            if (w == null) return;
            var rams = new List<string>();
            foreach (var g in w.groups)
            {
                var def = Balance.Enemy(g.type);
                for (var i = 0; i < g.count; i++)
                {
                    if (def != null && def.kind == "ram") rams.Add(g.type);
                    else spawnQueue.Add(g.type);
                }
            }

            for (var i = spawnQueue.Count - 1; i > 0; i--)
            {
                var j = Random.Range(0, i + 1);
                (spawnQueue[i], spawnQueue[j]) = (spawnQueue[j], spawnQueue[i]);
            }

            // Rams arrive spread through the wave rather than in a clump.
            for (var i = 0; i < rams.Count; i++)
            {
                var at = Mathf.Clamp(Mathf.RoundToInt((i + 1f) * spawnQueue.Count / (rams.Count + 1f)), 0, spawnQueue.Count);
                spawnQueue.Insert(at, rams[i]);
            }
        }

        void Update()
        {
            if (!Ready) return;
            var dt = Time.deltaTime;
            State.Tick(dt);
            if (gate != null) gate.Sync(State);
            if (keepDoor != null) keepDoor.Sync(State);

            var playing = State.Phase is SiegePhase.Preparing or SiegePhase.Wave;
            var intent = IntentOverride != null ? IntentOverride() : LocalInput.Read(playing && !Paused);
            if (IntentOverride == null && intent.Pause && playing) SetPaused(!Paused);

            if (playing && !Paused) Vitals.Tick(dt);
            if (playing && !Paused && !InputLocked && !Vitals.Down)
            {
                Player.Tick(intent, dt);
                Weapon.Tick(intent, dt);
                HandleInteract(intent);
            }

            switch (State.Phase)
            {
                case SiegePhase.Preparing:
                    if (State.PrepRemaining <= 0f) BeginWave();
                    break;
                case SiegePhase.Wave:
                    TickWave(dt);
                    break;
            }
        }

        void TickWave(float dt)
        {
            if (spawnQueue.Count > 0)
            {
                spawnTimer -= dt;
                if (spawnTimer <= 0f && Spawner.Alive.Count < Balance.maxAlive)
                {
                    var w = Balance.Wave(State.Wave);
                    spawnTimer = (w != null ? w.spawnInterval : 1f) * Random.Range(0.6f, 1.4f);
                    var min = GrayboxLayout.V(Layout.spawnMin);
                    var max = GrayboxLayout.V(Layout.spawnMax);
                    // Spawn in small clumps so the horde reads as groups emerging from the fog. Rams come alone.
                    var clump = Random.Range(1, 4);
                    var c = new Vector3(Random.Range(min.x, max.x), 0, Random.Range(min.z, max.z));
                    for (var i = 0; i < clump && spawnQueue.Count > 0; i++)
                    {
                        var type = spawnQueue[0];
                        var isRam = Balance.Enemy(type)?.kind == "ram";
                        if (isRam && i > 0) break;
                        var at = c + new Vector3(Random.Range(-3f, 3f), 0, Random.Range(-3f, 3f));
                        var z = Spawner.Spawn(this, type, at);
                        if (z != null)
                        {
                            spawnQueue.RemoveAt(0);
                            if (CurrentWave != null)
                            {
                                CurrentWave.Spawned++;
                                CurrentWave.SpawnedByType.TryGetValue(type, out var n);
                                CurrentWave.SpawnedByType[type] = n + 1;
                                CurrentWave.PeakAlive = Mathf.Max(CurrentWave.PeakAlive, Spawner.Alive.Count);
                            }

                            if (isRam) break;
                            continue;
                        }

                        // Retry next tick so the wave keeps its full count; give up only if the NavMesh is broken.
                        SpawnFailures++;
                        waveSpawnFailures++;
                        if (waveSpawnFailures > 200)
                        {
                            Debug.LogError($"[MarrowRoad] Spawn zone is off the NavMesh; dropping {spawnQueue.Count} enemies from wave {State.Wave}.");
                            spawnQueue.Clear();
                        }

                        break;
                    }
                }
            }
            else
            {
                waveSpawningDone = true;
            }

            if (State.Phase == SiegePhase.Defeat)
            {
                EndWave();
                return;
            }

            if (waveSpawningDone && Spawner.Alive.Count == 0)
            {
                EndWave();
                foreach (var l in Ladders) l.ResetLadder();
                if (State.Wave >= State.TotalWaves) State.Win();
                else State.CompleteWave(Balance.prep.between);
            }
        }

        // ---------- Gate, keep and slots ----------

        public Vector3 AssaultPoint(Zombie z, bool keep)
        {
            if (z.Kind == EnemyKind.Ram) return (keep ? KeepTarget : GateTarget) + new Vector3(0, 0, keep ? -2.6f : -2.2f);
            var pts = keep ? keepPoints : gatePoints;
            return pts[Random.Range(0, pts.Count)];
        }

        public void DamageAssault(bool keep, float amount)
        {
            if (keep) State.DamageKeep(amount);
            else State.DamageGate(amount);
            if (State.Phase == SiegePhase.Defeat && CurrentWave != null) EndWave();
        }

        /// <summary>Only so many of the dead can beat on the door at once; the rest crowd behind.</summary>
        public bool TryClaimSlot(Zombie z)
        {
            if (slotHolders.Contains(z)) return true;
            slotHolders.RemoveWhere(a => a == null || !a.Alive);
            var cap = State.GateBreached ? Balance.keep.slots : Balance.gate.slots;
            if (slotHolders.Count >= cap) return false;
            slotHolders.Add(z);
            return true;
        }

        public void ReleaseSlot(Zombie z) => slotHolders.Remove(z);

        void OnGateBreached()
        {
            slotHolders.Clear();
            BreachBannerTime = Time.unscaledTime;
            if (gate != null) gate.SetBreached(true);
            Debug.Log($"[MarrowRoad] Gate breached in wave {State.Wave}; falling back to the keep.");
            scratch.Clear();
            scratch.AddRange(Spawner.Alive);
            foreach (var z in scratch) z.OnGateBreached();
        }

        public int RepairCost => Balance.economy.repairCost;
        public float RepairAmount => Balance.economy.repairAmount;
        public bool CanRepairGate => State.Phase == SiegePhase.Preparing && State.GateHp < State.MaxGateHp && State.Gold >= RepairCost;

        /// <summary>Prep-phase only: pay to shore up the gate. Rebuilding a broken gate closes it again.</summary>
        public bool TryRepairGate()
        {
            if (!CanRepairGate || !State.TrySpend(RepairCost)) return false;
            var wasBreached = State.GateBreached;
            State.RepairGate(RepairAmount);
            GateRepairs++;
            if (wasBreached && !State.GateBreached && gate != null) gate.SetBreached(false);
            return true;
        }

        // ---------- Player ----------

        public bool PlayerHuntable(Vector3 from, out Vector3 playerPos)
        {
            playerPos = Player != null ? Player.transform.position : Vector3.zero;
            if (Player == null || Vitals.Down) return false;
            return Mathf.Abs(playerPos.y - from.y) < 2.5f && (playerPos - from).sqrMagnitude < 70f * 70f;
        }

        public void DamagePlayer(float amount, Vector3 from)
        {
            if (State.Phase != SiegePhase.Wave) return;
            LastPlayerHitFrom = from;
            Vitals.Damage(amount, Time.time);
        }

        void OnPlayerRevived()
        {
            var spawn = Layout.playerSpawn;
            Player.Teleport(GrayboxLayout.V(spawn.p), spawn.yaw, 4f);
        }

        // ---------- Kills ----------

        public void OnZombieKilled(Zombie z, in HitInfo hit)
        {
            Spawner.OnKilled(z);
            var headshot = hit.Headshot && hit.Source == DamageSource.Player;
            State.RegisterKill(hit.Source, hit.SourceId, headshot, z.Def.gold);
            if (hit.Source == DamageSource.Player) Weapon.MarkKill(headshot);
            if (hit.Owner != null) hit.Owner.Kills++;
        }

        public void OnZombieDespawned(Zombie z) => Spawner.OnDespawned(z);

        public void OnClimberTopped(Zombie z) => ClimbersTopped++;

        public SiegeLadder PickLadder()
        {
            if (Ladders.Count == 0) return null;
            ladderPick = (ladderPick + 1) % Ladders.Count;
            return Ladders[ladderPick];
        }

        // ---------- Building ----------

        public TurretSocket NearestSocket(out float distance)
        {
            TurretSocket best = null;
            distance = float.MaxValue;
            if (Player == null) return null;
            foreach (var s in Sockets)
            {
                if (s == null) continue;
                var d = Vector3.Distance(Player.transform.position, s.transform.position);
                if (d < distance)
                {
                    distance = d;
                    best = s;
                }
            }

            return best;
        }

        public SiegeLadder NearestShovableLadder(out float distance)
        {
            SiegeLadder best = null;
            distance = float.MaxValue;
            if (Player == null) return null;
            foreach (var l in Ladders)
            {
                if (!l.Shovable) continue;
                var d = Vector3.Distance(Player.transform.position, l.ShovePoint);
                if (d < distance)
                {
                    distance = d;
                    best = l;
                }
            }

            return best;
        }

        public int BuildCost(string id)
        {
            var def = Balance.Turret(id);
            return def != null && def.tiers.Length > 0 ? def.tiers[0].cost : int.MaxValue;
        }

        public bool TryBuild(TurretSocket s, string id)
        {
            if (s == null || s.Occupied || !s.Allows(id)) return false;
            if (State.Phase is SiegePhase.Title or SiegePhase.Victory or SiegePhase.Defeat) return false;
            if (!State.TrySpend(BuildCost(id))) return false;
            foreach (Transform child in s.transform) child.gameObject.SetActive(false);
            var t = Turret.Build(id, s, this);
            if (t != null) Turrets.Add(t);
            return t != null;
        }

        public bool TryUpgrade(TurretSocket s)
        {
            if (s == null || !s.Occupied || !s.Turret.CanUpgrade) return false;
            if (!State.TrySpend(s.Turret.UpgradeCost)) return false;
            s.Turret.Upgrade();
            return true;
        }

        void HandleInteract(in PlayerIntent intent)
        {
            if (intent.Repair) TryRepairGate();
            if (!intent.Build && intent.BuildChoice <= 0) return;
            var s = NearestSocket(out var d);
            if (s != null && d <= SocketReach)
            {
                if (s.Occupied)
                {
                    if (intent.Build) TryUpgrade(s);
                    return;
                }

                var allow = s.allow;
                if (intent.BuildChoice > 0 && allow != null && intent.BuildChoice <= allow.Length) TryBuild(s, allow[intent.BuildChoice - 1]);
                else if (intent.Build && allow != null && allow.Length >= 1) TryBuild(s, allow[0]);
                return;
            }

            if (!intent.Build) return;
            var l = NearestShovableLadder(out var ld);
            if (l != null && ld <= LadderReach) ShoveLadder(l);
        }

        public int ShoveLadder(SiegeLadder l)
        {
            var n = l.Shove();
            LadderShoves++;
            if (Balance.economy.ladderShoveGold > 0) State.GrantGold(Balance.economy.ladderShoveGold);
            return n;
        }

        // M1 compatibility for older tooling: build the first allowed turret at the nearest free socket.
        public bool TryBuildAtNearestSocket()
        {
            var s = NearestSocket(out var d);
            if (s == null || d > SocketReach || s.Occupied || s.allow == null || s.allow.Length == 0) return false;
            return TryBuild(s, s.allow[0]);
        }
    }
}
