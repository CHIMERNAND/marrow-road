using UnityEngine;

namespace MarrowRoad
{
    public sealed class TorchFlicker : MonoBehaviour
    {
        public float baseIntensity = 6f;
        Light lightRef;
        float seed;

        void Awake()
        {
            lightRef = GetComponent<Light>();
            seed = Random.value * 100f;
        }

        void Update()
        {
            if (lightRef == null) return;
            var t = Time.time * 7f + seed;
            var n = Mathf.PerlinNoise(t, seed) * 0.6f + Mathf.PerlinNoise(t * 2.7f, seed + 3f) * 0.4f;
            lightRef.intensity = baseIntensity * (0.75f + 0.45f * n);
        }
    }
}
