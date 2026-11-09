using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace HelmsDeep
{
    /// <summary>
    /// CLI/env harness for automated playthroughs and build smoke tests.
    ///
    /// Flags (also env HELMS_*):
    ///   -autopilot              enable bot
    ///   -record                 start FFmpeg capture
    ///   -quit-after-end         Application.Quit when victory/defeat
    ///   -max-seconds N          force-stop timeout (default 900)
    ///   -max-waves N            quit after clearing N waves (smoke)
    ///   -timescale N            Unity timeScale (default 1; use 2-3 for faster tests)
    ///
    /// Exit codes: 0 victory, 1 defeat, 2 timeout, 3 error/incomplete
    /// </summary>
    public sealed class AutopilotHarness : MonoBehaviour
    {
        public static AutopilotHarness Instance { get; private set; }

        bool _autopilot;
        bool _quitAfterEnd;
        float _maxSeconds = 900f;
        int _maxWaves;
        float _elapsed;
        bool _finished;
        int _exitCode = 3;
        string _runId;
        string _reportPath;
        readonly StringBuilder _log = new();

        public bool AutopilotRequested => _autopilot;
        public string ReportPath => _reportPath;

        public void ConfigureFromArgs()
        {
            Instance = this;
            _runId = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            _autopilot = HasFlag("-autopilot") || EnvTruthy("HELMS_AUTOPILOT");
            _quitAfterEnd = HasFlag("-quit-after-end") || EnvTruthy("HELMS_QUIT_AFTER_END") || _autopilot;
            _maxSeconds = GetFloatArg("-max-seconds", EnvFloat("HELMS_MAX_SECONDS", 900f));
            _maxWaves = GetIntArg("-max-waves", EnvInt("HELMS_MAX_WAVES", 0));
            var scale = GetFloatArg("-timescale", EnvFloat("HELMS_TIMESCALE", 1f));
            Time.timeScale = Mathf.Clamp(scale, 0.25f, 8f);

            Directory.CreateDirectory(ReportsFolder);
            _reportPath = Path.Combine(ReportsFolder, $"run_{_runId}.txt");
            Log($"runId={_runId}");
            Log($"autopilot={_autopilot}");
            Log($"maxSeconds={_maxSeconds}");
            Log($"maxWaves={_maxWaves}");
            Log($"timescale={Time.timeScale}");
            Log($"quitAfterEnd={_quitAfterEnd}");
        }

        public static string ReportsFolder
        {
            get
            {
                var root = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Recordings", "runs"));
                Directory.CreateDirectory(root);
                return root;
            }
        }

        void Update()
        {
            if (_finished) return;
            _elapsed += Time.unscaledDeltaTime;

            var game = SiegeGame.Instance;
            if (game == null) return;

            // Belt-and-suspenders: if autopilot is on but still on title after 2s, force begin.
            if (_autopilot && game.Phase == GamePhase.Title && _elapsed > 2f)
            {
                var defender = UnityEngine.Object.FindFirstObjectByType<WallDefender>();
                if (defender != null)
                {
                    defender.AutopilotOwned = true;
                    defender.BeginFromTitleOrRetry(game);
                    Log($"harness_force_begin elapsed={_elapsed:0.00} phase={game.Phase}");
                }
            }

            if (_maxWaves > 0 && game.Wave > _maxWaves && game.Phase == GamePhase.Preparing)
            {
                Finish(0, $"smoke_ok cleared_waves={_maxWaves}");
                return;
            }

            if (game.Phase == GamePhase.Victory)
            {
                Finish(0, "victory");
                return;
            }

            if (game.Phase == GamePhase.Defeat)
            {
                Finish(1, "defeat");
                return;
            }

            if (_elapsed >= _maxSeconds)
            {
                Finish(2, $"timeout elapsed={_elapsed:0.0}s phase={game.Phase} wave={game.Wave}");
            }
        }

        void OnApplicationQuit()
        {
            if (!_finished)
            {
                WriteReport("quit_without_finish");
            }
        }

        void Finish(int exitCode, string reason)
        {
            if (_finished) return;
            _finished = true;
            _exitCode = exitCode;
            Log($"result={reason}");
            Log($"exitCode={exitCode}");
            Log($"elapsed={_elapsed:0.00}");
            SnapshotGame();
            WriteReport(reason);
            GameplayRecorder.Instance?.LogEvent($"harness_finish={reason}");
            GameplayRecorder.Instance?.StopRecording("harness_end");

            Debug.Log($"[Harness] {reason} exit={exitCode} report={_reportPath}");

            if (_quitAfterEnd)
            {
#if UNITY_EDITOR
                UnityEditor.EditorApplication.isPlaying = false;
#else
                Application.Quit(exitCode);
#endif
            }
        }

        void SnapshotGame()
        {
            var game = SiegeGame.Instance;
            if (game == null) return;
            Log($"phase={game.Phase}");
            Log($"wave={game.Wave}");
            Log($"gold={game.Gold}");
            Log($"gateHp={game.GateHp}");
            Log($"kills={game.Kills}");
            Log($"headshots={game.Headshots}");
            Log($"alive={game.EnemiesAlive}");
            Log($"toast={game.Toast}");
            if (GameplayRecorder.Instance != null)
            {
                Log($"recording={GameplayRecorder.Instance.IsRecording}");
                Log($"video={GameplayRecorder.Instance.LastOutputPath}");
            }
        }

        void WriteReport(string reason)
        {
            try
            {
                File.WriteAllText(_reportPath, _log.ToString());
                var jsonPath = Path.ChangeExtension(_reportPath, ".json");
                var game = SiegeGame.Instance;
                var json = new StringBuilder();
                json.AppendLine("{");
                json.AppendLine($"  \"runId\": \"{_runId}\",");
                json.AppendLine($"  \"reason\": \"{Escape(reason)}\",");
                json.AppendLine($"  \"exitCode\": {_exitCode},");
                json.AppendLine($"  \"elapsed\": {_elapsed:0.00},");
                if (game != null)
                {
                    json.AppendLine($"  \"phase\": \"{game.Phase}\",");
                    json.AppendLine($"  \"wave\": {game.Wave},");
                    json.AppendLine($"  \"gold\": {game.Gold},");
                    json.AppendLine($"  \"gateHp\": {game.GateHp:0.##},");
                    json.AppendLine($"  \"kills\": {game.Kills},");
                    json.AppendLine($"  \"headshots\": {game.Headshots},");
                }

                json.AppendLine($"  \"video\": \"{Escape(GameplayRecorder.Instance?.LastOutputPath ?? "")}\",");
                json.AppendLine($"  \"report\": \"{Escape(_reportPath)}\"");
                json.AppendLine("}");
                File.WriteAllText(jsonPath, json.ToString());
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Harness] report write failed: {ex.Message}");
            }
        }

        void Log(string line) => _log.AppendLine(line);

        static string Escape(string s) => (s ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");

        static bool HasFlag(string flag)
        {
            foreach (var arg in Environment.GetCommandLineArgs())
            {
                if (arg.Equals(flag, StringComparison.OrdinalIgnoreCase)) return true;
            }

            return false;
        }

        static float GetFloatArg(string flag, float fallback)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals(flag, StringComparison.OrdinalIgnoreCase) &&
                    float.TryParse(args[i + 1], out var v))
                {
                    return v;
                }
            }

            return fallback;
        }

        static int GetIntArg(string flag, int fallback)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i].Equals(flag, StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(args[i + 1], out var v))
                {
                    return v;
                }
            }

            return fallback;
        }

        static bool EnvTruthy(string key)
        {
            var v = Environment.GetEnvironmentVariable(key);
            return !string.IsNullOrEmpty(v) && v != "0" &&
                   !v.Equals("false", StringComparison.OrdinalIgnoreCase);
        }

        static float EnvFloat(string key, float fallback)
        {
            var v = Environment.GetEnvironmentVariable(key);
            return float.TryParse(v, out var n) ? n : fallback;
        }

        static int EnvInt(string key, int fallback)
        {
            var v = Environment.GetEnvironmentVariable(key);
            return int.TryParse(v, out var n) ? n : fallback;
        }
    }
}
