using UnityEngine;
using UnityEngine.Rendering;

namespace MarrowRoad
{
    /// <summary>
    /// Sets the ambient probe directly so the night fill light is correct without a lighting bake.
    /// </summary>
    public sealed class NightAmbience : MonoBehaviour
    {
        public Color sky = new Color(0.11f, 0.13f, 0.2f);
        public Color equator = new Color(0.06f, 0.065f, 0.085f);
        public Color ground = new Color(0.025f, 0.025f, 0.03f);

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
