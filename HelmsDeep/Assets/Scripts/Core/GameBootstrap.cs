using UnityEngine;

namespace HelmsDeep
{
    public sealed class GameBootstrap : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoBootstrap()
        {
            if (Object.FindFirstObjectByType<GameBootstrap>() != null) return;
            var go = new GameObject("HelmsDeepBootstrap");
            go.AddComponent<GameBootstrap>();
        }

        void Start()
        {
            if (Object.FindObjectsByType<GameBootstrap>(FindObjectsSortMode.None).Length > 1 &&
                Object.FindFirstObjectByType<SiegeGame>() != null)
            {
                Destroy(gameObject);
                return;
            }

            EnsureCamera();
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.shadowDistance = 90f;
            Application.targetFrameRate = 60;

            var harness = gameObject.AddComponent<AutopilotHarness>();
            harness.ConfigureFromArgs();

            gameObject.AddComponent<CombatFeedback>();
            gameObject.AddComponent<SiegeAudio>();

            var game = gameObject.AddComponent<SiegeGame>();
            var builder = gameObject.AddComponent<BattlementBuilder>();
            try
            {
                builder.Build();
            }
            catch (System.Exception ex)
            {
                Debug.LogError($"[Bootstrap] World build failed: {ex}");
            }

            var waves = gameObject.AddComponent<WaveDirector>();
            if (builder.Gate != null) waves.Configure(builder.Gate.transform);

            var turrets = gameObject.AddComponent<TurretGrid>();
            if (builder.Sockets != null) turrets.Configure(builder.Sockets);

            game.Bind(waves, turrets, builder.Gate);

            var playerGo = new GameObject("WallDefender");
            var defender = playerGo.AddComponent<WallDefender>();
            var spawn = builder.PlayerSpawn != null ? builder.PlayerSpawn : CreateFallbackSpawn();
            defender.Possess(spawn, Camera.main);

            var recorderGo = new GameObject("GameplayRecorder");
            var recorder = recorderGo.AddComponent<GameplayRecorder>();
            recorder.Bind(Camera.main);

            var autopilotGo = new GameObject("Autopilot");
            var autopilot = autopilotGo.AddComponent<AutopilotController>();
            autopilot.Configure(defender, turrets);
            if (harness.AutopilotRequested) autopilot.Activate();

            var hudGo = new GameObject("SiegeHud");
            var hud = hudGo.AddComponent<SiegeHud>();
            hud.Bind(defender);

            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
        }

        static Transform CreateFallbackSpawn()
        {
            var spawn = new GameObject("FallbackSpawn").transform;
            spawn.position = new Vector3(0f, GameBalance.WallY + 1.6f, -7.4f);
            spawn.rotation = Quaternion.Euler(0f, 180f, 0f);
            return spawn;
        }

        static void EnsureCamera()
        {
            if (Camera.main != null) return;
            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
        }
    }
}
