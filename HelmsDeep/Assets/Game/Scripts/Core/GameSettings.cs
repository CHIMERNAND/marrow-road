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

        public static bool InvertY
        {
            get => PlayerPrefs.GetInt("mr.invy", 0) == 1;
            set => PlayerPrefs.SetInt("mr.invy", value ? 1 : 0);
        }
    }

    /// <summary>Command-line switches.</summary>
    public static class LaunchArgs
    {
        public static string CaptureDir => Value("-m1capture");

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
