using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.InputSystem;

namespace HelmsDeep
{
    /// <summary>
    /// Records the final backbuffer (URP-safe) as JPG frames, then encodes MP4 with FFmpeg.
    /// </summary>
    public sealed class GameplayRecorder : MonoBehaviour
    {
        public static GameplayRecorder Instance { get; private set; }

        [SerializeField] int fps = 15;
        [SerializeField] Key toggleKey = Key.F9;

        float _accum;
        float _autoStartDelay = -1f;
        bool _recording;
        bool _capturing;
        string _outputPath;
        string _frameDir;
        string _sessionId;
        int _frameIndex;
        readonly StringBuilder _events = new();

        public bool IsRecording => _recording;
        public string LastOutputPath => _outputPath;

        public static string RecordingsFolder
        {
            get
            {
                var root = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "Recordings"));
                Directory.CreateDirectory(root);
                return root;
            }
        }

        void Awake() => Instance = this;

        public void Bind(Camera camera) { /* backbuffer capture does not need a private RT */ }

        void Start()
        {
            if (ShouldAutoStart()) _autoStartDelay = 0.75f;
        }

        void Update()
        {
            if (_autoStartDelay >= 0f)
            {
                _autoStartDelay -= Time.unscaledDeltaTime;
                if (_autoStartDelay <= 0f)
                {
                    _autoStartDelay = -1f;
                    StartRecording("autostart");
                }
            }

            if (Keyboard.current != null && Keyboard.current[toggleKey].wasPressedThisFrame)
            {
                if (_recording) StopRecording("manual");
                else StartRecording("manual");
            }

            if (!_recording || _capturing) return;

            _accum += Time.unscaledDeltaTime;
            var frameInterval = 1f / Mathf.Max(1, fps);
            if (_accum >= frameInterval)
            {
                _accum -= frameInterval;
                StartCoroutine(CaptureEndOfFrame());
            }
        }

        void OnApplicationQuit() => StopRecording("quit");

        void OnDestroy()
        {
            StopRecording("destroy");
            if (Instance == this) Instance = null;
        }

        public void LogEvent(string message)
        {
            if (!_recording) return;
            _events.Append('[').Append(Time.realtimeSinceStartup.ToString("0.00")).Append("] ")
                .Append(message).AppendLine();
        }

        public bool StartRecording(string reason = "manual")
        {
            if (_recording) return true;

            _sessionId = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            _frameDir = Path.Combine(RecordingsFolder, $"frames_{_sessionId}");
            Directory.CreateDirectory(_frameDir);
            _outputPath = Path.Combine(RecordingsFolder, $"helmsdeep_{_sessionId}.mp4");
            _frameIndex = 0;
            _accum = 0f;
            _events.Clear();
            _events.AppendLine($"session={_sessionId}");
            _events.AppendLine($"reason={reason}");
            _events.AppendLine($"started={DateTime.Now:o}");
            _recording = true;
            UnityEngine.Debug.Log($"[Recorder] Capturing backbuffer → {_frameDir}");
            return true;
        }

        public void StopRecording(string reason = "manual")
        {
            if (!_recording) return;
            _recording = false;
            EncodeMp4();
            WriteSidecar(reason);
            TryDeleteDirectory(_frameDir);
            UnityEngine.Debug.Log($"[Recorder] Saved {_outputPath}");
        }

        IEnumerator CaptureEndOfFrame()
        {
            _capturing = true;
            yield return new WaitForEndOfFrame();
            try
            {
                var tex = ScreenCapture.CaptureScreenshotAsTexture();
                if (tex != null)
                {
                    var jpg = tex.EncodeToJPG(80);
                    var path = Path.Combine(_frameDir, $"frame_{_frameIndex:D5}.jpg");
                    File.WriteAllBytes(path, jpg);
                    _frameIndex++;
                    Destroy(tex);
                }
            }
            finally
            {
                _capturing = false;
            }
        }

        void EncodeMp4()
        {
            if (_frameIndex <= 0)
            {
                UnityEngine.Debug.LogWarning("[Recorder] No frames captured.");
                return;
            }

            var ffmpeg = ResolveFfmpeg();
            if (ffmpeg == null)
            {
                UnityEngine.Debug.LogError("[Recorder] ffmpeg not found; left JPG frames on disk.");
                return;
            }

            var args =
                $"-y -framerate {fps} -i \"{Path.Combine(_frameDir, "frame_%05d.jpg")}\" " +
                $"-c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast \"{_outputPath}\"";

            try
            {
                using var proc = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = ffmpeg,
                        Arguments = args,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardError = true,
                        RedirectStandardOutput = true
                    }
                };
                proc.Start();
                var err = proc.StandardError.ReadToEnd();
                proc.WaitForExit(90000);
                if (proc.ExitCode != 0)
                {
                    UnityEngine.Debug.LogWarning($"[Recorder] ffmpeg exit {proc.ExitCode}: {err}");
                }
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[Recorder] encode failed: {ex.Message}");
            }
        }

        void WriteSidecar(string reason)
        {
            try
            {
                var game = SiegeGame.Instance;
                var metaPath = Path.ChangeExtension(_outputPath, ".txt");
                var sb = new StringBuilder();
                sb.Append(_events);
                sb.AppendLine($"stopped={DateTime.Now:o}");
                sb.AppendLine($"stopReason={reason}");
                sb.AppendLine($"frames={_frameIndex}");
                if (game != null)
                {
                    sb.AppendLine($"phase={game.Phase}");
                    sb.AppendLine($"wave={game.Wave}");
                    sb.AppendLine($"gold={game.Gold}");
                    sb.AppendLine($"gateHp={game.GateHp}");
                    sb.AppendLine($"kills={game.Kills}");
                    sb.AppendLine($"toast={game.Toast}");
                }

                File.WriteAllText(metaPath, sb.ToString());
            }
            catch (Exception ex)
            {
                UnityEngine.Debug.LogWarning($"[Recorder] Sidecar failed: {ex.Message}");
            }
        }

        static void TryDeleteDirectory(string path)
        {
            try
            {
                if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
                    Directory.Delete(path, true);
            }
            catch { /* leave frames if locked */ }
        }

        static bool ShouldAutoStart()
        {
            var env = Environment.GetEnvironmentVariable("HELMS_RECORD");
            if (!string.IsNullOrEmpty(env) && env != "0" && !env.Equals("false", StringComparison.OrdinalIgnoreCase))
                return true;

            foreach (var arg in Environment.GetCommandLineArgs())
            {
                if (arg.Equals("-record", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("--record", StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        static string ResolveFfmpeg()
        {
            var overridePath = Environment.GetEnvironmentVariable("FFMPEG_PATH");
            if (!string.IsNullOrEmpty(overridePath) && File.Exists(overridePath)) return overridePath;

            foreach (var candidate in new[]
                     {
                         Path.Combine(Application.dataPath, "..", "Tools", "ffmpeg.exe"),
                         Path.Combine(Application.dataPath, "..", "ffmpeg.exe"),
                         Path.Combine(Application.dataPath, "..", "..", "..", "Tools", "ffmpeg.exe"),
                     })
            {
                if (File.Exists(candidate)) return Path.GetFullPath(candidate);
            }

            try
            {
                var probe = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "where",
                        Arguments = "ffmpeg",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        CreateNoWindow = true
                    }
                };
                probe.Start();
                var output = probe.StandardOutput.ReadToEnd();
                probe.WaitForExit(3000);
                foreach (var line in output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (File.Exists(line.Trim())) return line.Trim();
                }
            }
            catch { /* ignore */ }

            var wingetLink = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Microsoft", "WinGet", "Links", "ffmpeg.exe");
            return File.Exists(wingetLink) ? wingetLink : null;
        }
    }
}
