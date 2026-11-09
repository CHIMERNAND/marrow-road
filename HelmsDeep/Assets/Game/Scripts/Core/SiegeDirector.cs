using System.Collections.Generic;
using Unity.AI.Navigation;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.SceneManagement;

namespace MarrowRoad
{
    /// <summary>
    /// Scene entry point for the M1 slice. Owns the authoritative SiegeState, the runtime NavMesh,
    /// the wave schedule, and the local player. In co-op this component runs on the host.
    /// </summary>
    public sealed class SiegeDirector : MonoBehaviour
    {
        public const int TotalWaves = 5;
        public const float FirstPrepSeconds = 20f;
        public const float BetweenWaveSeconds = 15f;
        public const int GoldPerKill = 10;

        public TextAsset layoutJson;
        public GateDoor gate;

        public static SiegeDirector Instance { get; private set; }
        public SiegeState State { get; private set; }
        public ZombieSpawner Spawner { get; private set; }
        public GrayboxLayout Layout { get; private set; }
        public FirstPersonController Player { get; private set; }
        public CrossbowWeapon Weapon { get; private set; }
        public Vector3 GateTarget { get; private set; }
        public float NavMeshBuildMs { get; private set; }
        public bool Ready { get; private set; }
        public bool Paused { get; private set; }
        public bool InputLocked { get; set; }
        public int SpawnFailures { get; private set; }
        public readonly List<TurretSocket> Sockets = new List<TurretSocket>();

        /// <summary>When set, this replaces local device input for the frame (capture bot).</summary>
        public System.Func<PlayerIntent> IntentOverride;

        int toSpawn;
        float spawnTimer;
        bool waveSpawningDone;
        int waveSpawnFailures;
        readonly List<Vector3> gatePoints = new List<Vector3>();

        void Awake()
        {
            Instance = this;
            State = new SiegeState(TotalWaves);
            Layout = layoutJson != null ? GrayboxLayout.FromJson(layoutJson.text) : new GrayboxLayout();
            GateTarget = GrayboxLayout.V(Layout.gateTarget);
            for (var i = 0; i < 24; i++)
            {
                gatePoints.Add(GateTarget + new Vector3(Random.Range(-3.0f, 3.0f), 0, Random.Range(-1.6f, 1.1f)));
            }
        }

        void Start()
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var surface = gameObject.AddComponent<NavMeshSurface>();
            surface.collectObjects = CollectObjects.Volume;
            surface.center = transform.InverseTransformPoint(new Vector3(140f, 15f, -125f));
            surface.size = new Vector3(170f, 40f, 280f);
            surface.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
            surface.layerMask = 1; // Default layer only: level geometry. Player/turrets live on Ignore Raycast.
            surface.overrideVoxelSize = true;
            surface.voxelSize = 0.2f;
            surface.BuildNavMesh();
            NavMeshBuildMs = (float)sw.Elapsed.TotalMilliseconds;
            Debug.Log($"[MarrowRoad] NavMesh built in {NavMeshBuildMs:0} ms");

            Spawner = new ZombieSpawner(new GameObject("Zombies").transform, MaterialLibrary.Instance, 60);
            Sockets.AddRange(FindObjectsByType<TurretSocket>(FindObjectsSortMode.None));

            var spawn = Layout.playerSpawn;
            Player = FirstPersonController.Create(GrayboxLayout.V(spawn.p), spawn.yaw);
            Weapon = CrossbowWeapon.Attach(Player, this);
            Player.Teleport(GrayboxLayout.V(spawn.p), spawn.yaw, 4f);
            foreach (var cam in FindObjectsByType<Camera>(FindObjectsSortMode.None))
            {
                if (cam != Player.Cam) cam.gameObject.SetActive(false);
            }

            if (!NavMesh.SamplePosition(GateTarget, out _, 4f, NavMesh.AllAreas))
                Debug.LogError("[MarrowRoad] Gate target is not on the NavMesh; zombies cannot reach the gate.");
            Ready = true;
        }

        public void StartSiege()
        {
            if (State.Phase != SiegePhase.Title) return;
            State.Begin(FirstPrepSeconds);
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
            toSpawn = 12 + 8 * State.Wave;
            spawnTimer = 0f;
            waveSpawningDone = false;
            waveSpawnFailures = 0;
        }

        void Update()
        {
            if (!Ready) return;
            var dt = Time.deltaTime;
            State.Tick(dt);
            if (gate != null) gate.Sync(State);

            var playing = State.Phase is SiegePhase.Preparing or SiegePhase.Wave;
            var intent = IntentOverride != null ? IntentOverride() : LocalInput.Read(playing && !Paused);
            if (IntentOverride == null && intent.Pause && playing) SetPaused(!Paused);

            if (playing && !Paused && !InputLocked)
            {
                Player.Tick(intent, dt);
                Weapon.Tick(intent, dt);
                if (intent.Build) TryBuildAtNearestSocket();
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
            if (toSpawn > 0)
            {
                spawnTimer -= dt;
                if (spawnTimer <= 0f)
                {
                    spawnTimer = Mathf.Max(0.3f, 1.0f - 0.12f * State.Wave) * Random.Range(0.6f, 1.4f);
                    var min = GrayboxLayout.V(Layout.spawnMin);
                    var max = GrayboxLayout.V(Layout.spawnMax);
                    // Spawn in small clumps so the horde reads as groups emerging from the fog.
                    var clump = Mathf.Min(toSpawn, Random.Range(1, 4));
                    var c = new Vector3(Random.Range(min.x, max.x), 0, Random.Range(min.z, max.z));
                    for (var i = 0; i < clump; i++)
                    {
                        var at = c + new Vector3(Random.Range(-3f, 3f), 0, Random.Range(-3f, 3f));
                        var z = Spawner.Spawn(this, at, gatePoints[Random.Range(0, gatePoints.Count)]);
                        if (z != null)
                        {
                            toSpawn--;
                            continue;
                        }

                        // Retry next tick so the wave keeps its full count; give up only if the NavMesh is broken.
                        SpawnFailures++;
                        waveSpawnFailures++;
                        if (waveSpawnFailures > 200)
                        {
                            Debug.LogError($"[MarrowRoad] Spawn zone is off the NavMesh; dropping {toSpawn} zombies from wave {State.Wave}.");
                            toSpawn = 0;
                        }

                        break;
                    }
                }
            }
            else
            {
                waveSpawningDone = true;
            }

            if (waveSpawningDone && Spawner.Alive.Count == 0)
            {
                if (State.Wave >= TotalWaves) State.Win();
                else State.EnterPrep(BetweenWaveSeconds);
            }
        }

        public void DamageGate(float amount) => State.DamageGate(amount);

        public void OnZombieKilled(Zombie z, DamageSource source, bool headshot)
        {
            Spawner.OnKilled(z);
            State.RegisterKill(source, headshot, GoldPerKill);
            if (source == DamageSource.Player) Weapon.MarkKill(headshot);
        }

        public void OnZombieDespawned(Zombie z) => Spawner.OnDespawned(z);

        public TurretSocket NearestSocket(out float distance)
        {
            TurretSocket best = null;
            distance = float.MaxValue;
            if (Player == null) return null;
            foreach (var s in Sockets)
            {
                if (s == null || s.Occupied) continue;
                var d = Vector3.Distance(Player.transform.position, s.transform.position);
                if (d < distance)
                {
                    distance = d;
                    best = s;
                }
            }

            return best;
        }

        public bool TryBuildAtNearestSocket()
        {
            var s = NearestSocket(out var d);
            if (s == null || d > 3.5f) return false;
            if (!State.TrySpend(WallCrossbowTurret.Cost)) return false;
            foreach (Transform child in s.transform) child.gameObject.SetActive(false);
            WallCrossbowTurret.Build(s, this);
            return true;
        }
    }
}
