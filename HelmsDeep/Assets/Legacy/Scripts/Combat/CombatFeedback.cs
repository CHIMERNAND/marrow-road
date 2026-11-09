using System.Collections.Generic;
using UnityEngine;

namespace HelmsDeep
{
    public sealed class CombatFeedback : MonoBehaviour
    {
        public static CombatFeedback Instance { get; private set; }

        float _shake;
        float _hitFlash;
        readonly List<FloatText> _texts = new();
        int _nextId = 1;

        struct FloatText
        {
            public int Id;
            public Vector3 World;
            public string Text;
            public Color Color;
            public float Age;
            public float Life;
        }

        void Awake() => Instance = this;

        public void Shake(float amount, float duration = 0.2f)
        {
            _shake = Mathf.Max(_shake, amount);
        }

        public void Hitmarker(bool headshot)
        {
            _hitFlash = headshot ? 0.22f : 0.12f;
            if (headshot) Shake(0.35f, 0.25f);
            else Shake(0.12f, 0.12f);
        }

        public void FloatDamage(Vector3 world, float amount, bool headshot, Color? color = null)
        {
            _texts.Add(new FloatText
            {
                Id = _nextId++,
                World = world + Vector3.up * 1.2f,
                Text = headshot ? $"{Mathf.RoundToInt(amount)}!" : Mathf.RoundToInt(amount).ToString(),
                Color = color ?? (headshot ? new Color(1f, 0.85f, 0.2f) : Color.white),
                Age = 0f,
                Life = 0.85f
            });
        }

        public void SpawnImpact(Vector3 pos, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "Impact";
            go.transform.position = pos;
            go.transform.localScale = Vector3.one * 0.25f;
            Object.Destroy(go.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(go, color, 3f);
            Object.Destroy(go, 0.18f);

            var burst = new GameObject("Sparks");
            burst.transform.position = pos;
            var ps = burst.AddComponent<ParticleSystem>();
            var main = ps.main;
            main.startLifetime = 0.35f;
            main.startSpeed = 6f;
            main.startSize = 0.08f;
            main.startColor = color;
            main.gravityModifier = 1.2f;
            main.maxParticles = 24;
            var em = ps.emission;
            em.SetBursts(new[] { new ParticleSystem.Burst(0f, 16) });
            em.rateOverTime = 0;
            var sh = ps.shape;
            sh.shapeType = ParticleSystemShapeType.Sphere;
            sh.radius = 0.1f;
            var rend = burst.GetComponent<ParticleSystemRenderer>();
            rend.material = new Material(Shader.Find("Sprites/Default")) { color = color };
            Object.Destroy(burst, 0.6f);
        }

        void LateUpdate()
        {
            _shake = Mathf.MoveTowards(_shake, 0f, Time.deltaTime * 1.8f);
            _hitFlash = Mathf.MoveTowards(_hitFlash, 0f, Time.deltaTime);

            var cam = Camera.main;
            if (cam != null && _shake > 0.001f)
            {
                var offset = Random.insideUnitSphere * _shake * 0.35f;
                cam.transform.localPosition = new Vector3(offset.x, offset.y, offset.z);
            }
            else if (cam != null)
            {
                cam.transform.localPosition = Vector3.zero;
            }

            for (var i = _texts.Count - 1; i >= 0; i--)
            {
                var t = _texts[i];
                t.Age += Time.deltaTime;
                t.World += Vector3.up * Time.deltaTime * 1.4f;
                _texts[i] = t;
                if (t.Age >= t.Life) _texts.RemoveAt(i);
            }
        }

        void OnGUI()
        {
            if (_hitFlash > 0f)
            {
                var c = new Color(1f, 0.9f, 0.4f, _hitFlash * 2f);
                var cx = Screen.width * 0.5f;
                var cy = Screen.height * 0.5f;
                var old = GUI.color;
                GUI.color = c;
                GUI.DrawTexture(new Rect(cx - 14, cy - 2, 28, 4), Texture2D.whiteTexture);
                GUI.DrawTexture(new Rect(cx - 2, cy - 14, 4, 28), Texture2D.whiteTexture);
                GUI.color = old;
            }

            var cam = Camera.main;
            if (cam == null) return;
            foreach (var t in _texts)
            {
                var sp = cam.WorldToScreenPoint(t.World);
                if (sp.z < 0.1f) continue;
                var a = 1f - t.Age / t.Life;
                var style = new GUIStyle(GUI.skin.label)
                {
                    fontSize = t.Text.EndsWith("!") ? 22 : 16,
                    fontStyle = FontStyle.Bold,
                    alignment = TextAnchor.MiddleCenter
                };
                style.normal.textColor = new Color(t.Color.r, t.Color.g, t.Color.b, a);
                GUI.Label(new Rect(sp.x - 40, Screen.height - sp.y - 20, 80, 30), t.Text, style);
            }
        }
    }
}
