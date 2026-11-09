using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace HelmsDeep
{
    /// <summary>Sky dome, post stack, rain, distant lightning — sells the siege night.</summary>
    public sealed class AtmosphereController : MonoBehaviour
    {
        float _lightningTimer = 6f;
        Light _boltLight;
        ParticleSystem _rain;

        public void Build(Transform root)
        {
            BuildSkyDome(root);
            BuildPostFx();
            BuildRain(root);
            BuildBoltLight(root);
        }

        void Update()
        {
            _lightningTimer -= Time.deltaTime;
            if (_lightningTimer <= 0f)
            {
                _lightningTimer = Random.Range(7f, 16f);
                StartCoroutine(FlashLightning());
            }

            if (_rain != null)
            {
                var cam = Camera.main;
                if (cam != null)
                {
                    var p = cam.transform.position;
                    _rain.transform.position = new Vector3(p.x, p.y + 18f, p.z - 20f);
                }
            }
        }

        static void BuildSkyDome(Transform root)
        {
            var sky = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            sky.name = "SkyDome";
            sky.transform.SetParent(root, false);
            sky.transform.localScale = Vector3.one * 420f;
            Object.Destroy(sky.GetComponent<Collider>());

            var shader = Shader.Find("HelmsDeep/ProcColor");
            if (shader == null) return;
            var mat = new Material(shader) { name = "SkyMat" };
            mat.SetColor("_BaseColor", new Color(0.05f, 0.07f, 0.12f));
            mat.SetColor("_EmissionColor", new Color(0.03f, 0.045f, 0.08f));
            sky.GetComponent<MeshRenderer>().sharedMaterial = mat;
            // Invert normals by scaling negative so we see inside
            sky.transform.localScale = new Vector3(-420f, 420f, 420f);

            // Moon disc
            var moon = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            moon.name = "Moon";
            moon.transform.SetParent(root, false);
            moon.transform.position = new Vector3(-40f, 55f, -90f);
            moon.transform.localScale = Vector3.one * 8f;
            Object.Destroy(moon.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(moon, new Color(0.85f, 0.9f, 1f), 2.4f);
        }

        void BuildPostFx()
        {
            var go = new GameObject("SiegeVolume");
            go.transform.SetParent(transform, false);
            var volume = go.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 10;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            volume.profile = profile;

            var bloom = profile.Add<Bloom>(true);
            bloom.intensity.Override(0.55f);
            bloom.threshold.Override(0.85f);
            bloom.scatter.Override(0.7f);

            var vig = profile.Add<Vignette>(true);
            vig.intensity.Override(0.32f);
            vig.smoothness.Override(0.4f);
            vig.color.Override(new Color(0.02f, 0.03f, 0.06f));

            var color = profile.Add<ColorAdjustments>(true);
            color.postExposure.Override(0.35f);
            color.contrast.Override(18f);
            color.saturation.Override(8f);
            color.colorFilter.Override(new Color(0.92f, 0.95f, 1f));

            var tonemap = profile.Add<Tonemapping>(true);
            tonemap.mode.Override(TonemappingMode.ACES);

            var cam = Camera.main;
            if (cam != null)
            {
                var data = cam.GetComponent<UniversalAdditionalCameraData>();
                if (data != null) data.renderPostProcessing = true;
            }
        }

        void BuildRain(Transform root)
        {
            var go = new GameObject("Rain");
            go.transform.SetParent(root, false);
            _rain = go.AddComponent<ParticleSystem>();
            var main = _rain.main;
            main.startLifetime = 0.55f;
            main.startSpeed = 28f;
            main.startSize = new ParticleSystem.MinMaxCurve(0.02f, 0.05f);
            main.startColor = new Color(0.55f, 0.65f, 0.8f, 0.35f);
            main.maxParticles = 1200;
            main.simulationSpace = ParticleSystemSimulationSpace.World;

            var emission = _rain.emission;
            emission.rateOverTime = 450f;

            var shape = _rain.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(60f, 1f, 70f);

            var renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.material = new Material(Shader.Find("Sprites/Default"))
            {
                color = new Color(0.7f, 0.8f, 0.95f, 0.4f)
            };
        }

        void BuildBoltLight(Transform root)
        {
            var go = new GameObject("LightningFill");
            go.transform.SetParent(root, false);
            go.transform.rotation = Quaternion.Euler(50f, 20f, 0f);
            _boltLight = go.AddComponent<Light>();
            _boltLight.type = LightType.Directional;
            _boltLight.color = new Color(0.7f, 0.8f, 1f);
            _boltLight.intensity = 0f;
            _boltLight.shadows = LightShadows.None;
        }

        System.Collections.IEnumerator FlashLightning()
        {
            if (_boltLight == null) yield break;
            CombatFeedback.Instance?.Shake(0.18f, 0.25f);
            SiegeAudio.Instance?.PlayThunder();
            for (var i = 0; i < 3; i++)
            {
                _boltLight.intensity = Random.Range(1.8f, 3.2f);
                yield return new WaitForSeconds(0.04f + Random.value * 0.05f);
                _boltLight.intensity = 0f;
                yield return new WaitForSeconds(0.05f + Random.value * 0.08f);
            }
        }
    }
}
