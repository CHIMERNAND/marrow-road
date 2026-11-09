using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace MarrowRoad.EditorTools
{
    /// <summary>Batch entry points used by Tools/M1Verify.ps1.</summary>
    public static class M1Pipeline
    {
        public const string PlayerPath = "Builds/M1/MarrowRoad.exe";

        [MenuItem("Marrow Road/Build M1 Player")]
        public static void BuildPlayerMenu()
        {
            GrayboxBuilder.Build();
            BuildPlayer();
        }

        /// <summary>Unity.exe -batchmode -quit -projectPath . -executeMethod MarrowRoad.EditorTools.M1Pipeline.BuildAllBatch</summary>
        public static void BuildAllBatch()
        {
            var ok = false;
            try
            {
                GrayboxBuilder.Build();
                ok = BuildPlayer();
            }
            catch (System.Exception e)
            {
                Debug.LogException(e);
            }

            EditorApplication.Exit(ok ? 0 : 1);
        }

        public static void BuildSceneBatch()
        {
            var ok = false;
            try
            {
                GrayboxBuilder.Build();
                ok = true;
            }
            catch (System.Exception e)
            {
                Debug.LogException(e);
            }

            EditorApplication.Exit(ok ? 0 : 1);
        }

        static bool BuildPlayer()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PlayerPath) ?? "Builds/M1");
            var opts = new BuildPlayerOptions
            {
                scenes = new[] { GrayboxBuilder.ScenePath },
                locationPathName = PlayerPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };
            var report = BuildPipeline.BuildPlayer(opts);
            var s = report.summary;
            Debug.Log($"[MarrowRoad] Player build {s.result}: {s.totalSize / (1024 * 1024)} MB, {s.totalErrors} errors, {s.totalTime.TotalSeconds:0}s -> {PlayerPath}");
            return s.result == BuildResult.Succeeded;
        }
    }
}
