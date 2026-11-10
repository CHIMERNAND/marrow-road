using UnityEngine;
using UnityEngine.Rendering;

namespace MarrowRoad
{
    /// <summary>
    /// Sets the ambient probe directly so the night fill light is correct without a lighting bake.
    /// </summary>
    public sealed class NightAmbience : MonoBehaviour
    {
        public Color sky = new Color(0.2f, 0.235f, 0.36f);
        public Color equator = new Color(0.11f, 0.12f, 0.155f);
        public Color ground = new Color(0.045f, 0.045f, 0.055f);

        void Awake()
        {
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = sky;
            RenderSettings.ambientEquatorColor = equator;
            RenderSettings.ambientGroundColor = ground;
            var sh = new SphericalHarmonicsL2();
            sh.AddAmbientLight(equator);
            sh.AddDirectionalLight(Vector3.up, (sky - equator) * 1.5f, 1f);
            sh.AddDirectionalLight(Vector3.down, (ground - equator) * 1.0f + new Color(0.01f, 0.01f, 0.01f), 1f);
            RenderSettings.ambientProbe = sh;
        }
    }
}
