using UnityEngine;

namespace HelmsDeep
{
    /// <summary>Lightweight procedural SFX so the siege has punch without asset packs.</summary>
    public sealed class SiegeAudio : MonoBehaviour
    {
        public static SiegeAudio Instance { get; private set; }

        AudioSource _src;
        float _sampleRate = 44100f;

        void Awake()
        {
            Instance = this;
            _src = gameObject.AddComponent<AudioSource>();
            _src.playOnAwake = false;
            _src.spatialBlend = 0f;
            _src.volume = 0.55f;
        }

        public void PlayShot() => PlayTone(520f, 0.07f, 0.4f, noise: true);
        public void PlayHit() => PlayTone(180f, 0.05f, 0.35f);
        public void PlayHeadshot() => PlayTone(880f, 0.09f, 0.5f);
        public void PlayBuild() => PlayTone(240f, 0.12f, 0.3f);
        public void PlayAbility() => PlayTone(140f, 0.22f, 0.45f, noise: true);
        public void PlayThunder() => PlayNoise(0.35f, 0.4f);
        public void PlayWaveStart() => PlayTone(110f, 0.3f, 0.35f);
        public void PlayKill() => PlayTone(320f, 0.08f, 0.28f);

        void PlayTone(float freq, float duration, float volume, bool noise = false)
        {
            var clip = noise ? MakeNoise(duration, volume) : MakeTone(freq, duration, volume);
            _src.PlayOneShot(clip, volume);
            Destroy(clip, duration + 0.5f);
        }

        void PlayNoise(float duration, float volume) => PlayTone(0f, duration, volume, true);

        AudioClip MakeTone(float freq, float duration, float volume)
        {
            var samples = Mathf.CeilToInt(_sampleRate * duration);
            var data = new float[samples];
            for (var i = 0; i < samples; i++)
            {
                var t = i / _sampleRate;
                var env = 1f - t / duration;
                data[i] = Mathf.Sin(2f * Mathf.PI * freq * t) * env * volume;
            }

            var clip = AudioClip.Create("tone", samples, 1, (int)_sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }

        AudioClip MakeNoise(float duration, float volume)
        {
            var samples = Mathf.CeilToInt(_sampleRate * duration);
            var data = new float[samples];
            for (var i = 0; i < samples; i++)
            {
                var t = i / _sampleRate;
                var env = Mathf.Exp(-t * 4f);
                data[i] = (Random.value * 2f - 1f) * env * volume;
            }

            var clip = AudioClip.Create("noise", samples, 1, (int)_sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
