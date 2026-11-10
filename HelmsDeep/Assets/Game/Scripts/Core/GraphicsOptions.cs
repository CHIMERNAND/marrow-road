using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MarrowRoad
{
    /// <summary>
    /// Runtime graphics options from the pause menu, persisted in PlayerPrefs.
    /// Presets set shadow distance/cascades, torch shadows and anti-aliasing; render scale, vsync,
    /// frame cap and window mode are separate. The capture bot forces a fixed setup so runs compare.
    /// </summary>
    public static class GraphicsOptions
    {
        public static readonly string[] PresetNames = { "Low", "Medium", "High" };
        public static readonly int[] FrameCaps = { 0, 60, 90, 120, 144 };
        static readonly List<Light> Torches = new List<Light>();
        static readonly Dictionary<Light, LightShadows> AuthoredShadows = new Dictionary<Light, LightShadows>();

        public static int Preset
        {
            get => PlayerPrefs.GetInt("mr.gfx.preset", 2);
            set => PlayerPrefs.SetInt("mr.gfx.preset", Mathf.Clamp(value, 0, PresetNames.Length - 1));
        }

        public static float RenderScale
        {
            get => PlayerPrefs.GetFloat("mr.gfx.scale", 1f);
            set => PlayerPrefs.SetFloat("mr.gfx.scale", Mathf.Clamp(value, 0.5f, 1f));
        }

        public static bool VSync
        {
            get => PlayerPrefs.GetInt("mr.gfx.vsync", 1) == 1;
            set => PlayerPrefs.SetInt("mr.gfx.vsync", value ? 1 : 0);
        }

        /// <summary>Index into <see cref="FrameCaps"/> (0 = uncapped). Ignored while vsync is on.</summary>
        public static int FrameCapIndex
        {
            get => PlayerPrefs.GetInt("mr.gfx.cap", 0);
            set => PlayerPrefs.SetInt("mr.gfx.cap", Mathf.Clamp(value, 0, FrameCaps.Length - 1));
        }

        public static bool Fullscreen
        {
            get => PlayerPrefs.GetInt("mr.gfx.full", 1) == 1;
            set => PlayerPrefs.SetInt("mr.gfx.full", value ? 1 : 0);
        }

        /// <summary>Collect the scene's point lights (torches) so the preset can switch their shadows.</summary>
        public static void RegisterSceneLights()
        {
            Torches.Clear();
            AuthoredShadows.Clear();
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
            {
                if (l.type != LightType.Point) continue;
                Torches.Add(l);
                AuthoredShadows[l] = l.shadows;
            }
        }

        public static void Apply(Camera cam, bool applyWindow = true)
        {
            var preset = Preset;
            if (GraphicsSettings.currentRenderPipeline is UniversalRenderPipelineAsset urp)
            {
                urp.renderScale = RenderScale;
                urp.shadowDistance = preset == 0 ? 60f : preset == 1 ? 110f : 160f;
                urp.shadowCascadeCount = preset == 2 ? 4 : 2;
            }

            foreach (var l in Torches)
            {
                if (l == null) continue;
                var authored = AuthoredShadows.TryGetValue(l, out var a) ? a : LightShadows.None;
                l.shadows = preset == 0 ? LightShadows.None : authored;
            }

            if (cam != null)
            {
                var data = cam.GetUniversalAdditionalCameraData();
                data.antialiasing = preset == 0 ? AntialiasingMode.FastApproximateAntialiasing : AntialiasingMode.SubpixelMorphologicalAntiAliasing;
                data.antialiasingQuality = preset == 2 ? AntialiasingQuality.High : AntialiasingQuality.Medium;
            }

            QualitySettings.vSyncCount = VSync ? 1 : 0;
            Application.targetFrameRate = VSync ? -1 : (FrameCaps[FrameCapIndex] == 0 ? -1 : FrameCaps[FrameCapIndex]);
            if (applyWindow)
            {
                var mode = Fullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed;
                if (Screen.fullScreenMode != mode) Screen.fullScreenMode = mode;
            }
        }

        /// <summary>Deterministic setup for automated runs: High, full res, no vsync, uncapped, window untouched.</summary>
        public static void ApplyCaptureProfile(Camera cam)
        {
            var saved = (Preset, RenderScale, VSync, FrameCapIndex);
            Preset = 2;
            RenderScale = 1f;
            VSync = false;
            FrameCapIndex = 0;
            Apply(cam, false);
            (Preset, RenderScale, VSync, FrameCapIndex) = saved;
        }
    }
}
