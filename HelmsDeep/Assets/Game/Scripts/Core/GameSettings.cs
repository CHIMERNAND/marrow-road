using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Player-facing options persisted in PlayerPrefs.</summary>
    public static class GameSettings
    {
        public static float MouseSensitivity
        {
            get => PlayerPrefs.GetFloat("mr.sens", 0.12f);
            set => PlayerPrefs.SetFloat("mr.sens", Mathf.Clamp(value, 0.02f, 0.5f));
        }

        public static float FieldOfView
        {
            get => PlayerPrefs.GetFloat("mr.fov", 75f);
            set => PlayerPrefs.SetFloat("mr.fov", Mathf.Clamp(value, 60f, 100f));
        }

        /// <summary>Exposure offset in EV stops on top of the authored night grade.</summary>
        public static float Brightness
        {
            get => PlayerPrefs.GetFloat("mr.bright", 0f);
            set => PlayerPrefs.SetFloat("mr.bright", Mathf.Clamp(value, -1.5f, 2.5f));
        }

        public static bool InvertY
        {
            get => PlayerPrefs.GetInt("mr.invy", 0) == 1;
            set => PlayerPrefs.SetInt("mr.invy", value ? 1 : 0);
        }
    }

    /// <summary>Command-line switches.</summary>
    public static class LaunchArgs
    {
        /// <summary>"-capture &lt;dir&gt;" runs the automated verification pass ("-m1capture" still works).</summary>
        public static string CaptureDir => Value("-capture") ?? Value("-m1capture");

        /// <summary>"-capturewaves N": stop the automated run after N waves (default: the whole night).</summary>
        public static int CaptureWaves => int.TryParse(Value("-capturewaves"), out var n) ? n : 0;

        public static string Value(string flag)
        {
            var args = System.Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == flag) return args[i + 1];
            }

            return null;
        }
    }
}
