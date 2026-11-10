using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// A siege ladder at one of the wall's ladder zones. The first climber to arrive raises it against a crenel;
    /// climbers go up it in single file and vault onto the wall walk. A defender at the top can shove it off
    /// (F), which throws everyone on it into the valley. It can be raised again after a short cooldown.
    /// </summary>
    public sealed class SiegeLadder : MonoBehaviour
    {
        public enum LadderState { Down, Raising, Up, Falling }

        const float RaiseSeconds = 3.2f;
        const float FallSeconds = 1.5f;
        const float Cooldown = 7f;
        const float Spacing = 2.3f;
        const int MaxOnLadder = 7;
        const float DownAngle = -86f;

        public string ladderName;
        public LadderState State { get; private set; } = LadderState.Down;
        public float Length { get; private set; }
        public Vector3 ApproachPoint { get; private set; }
        public Vector3 TopWalk { get; private set; }
        public Vector3 ShovePoint { get; private set; }
        public int ClimberCount => climbers.Count;
        public int Raises { get; private set; }
        public int Shoves { get; private set; }
        public bool Shovable => State is LadderState.Up or LadderState.Raising;

        readonly List<Zombie> climbers = new List<Zombie>();
        Transform pivot;
        Vector3 basePos, upDir, outDir;
        float upAngle, angle, t, cooldown;

        public static SiegeLadder Create(Transform parent, LayoutLadder def, float wallTop, MaterialLibrary lib)
        {
            var go = new GameObject(def.name);
            go.transform.SetParent(parent, false);
            var l = go.AddComponent<SiegeLadder>();
            l.ladderName = def.name;
            l.basePos = new Vector3(def.x, 0f, def.baseZ);
            var top = new Vector3(def.x, def.topY, -0.15f);
            var v = top - l.basePos;
            l.Length = v.magnitude;
            l.upDir = v / l.Length;
            l.upAngle = Mathf.Atan2(v.z, v.y) * Mathf.Rad2Deg;
            l.outDir = new Vector3(0, l.upDir.z, -l.upDir.y); // perpendicular to the ladder, toward the valley
            l.ApproachPoint = new Vector3(def.x, 0f, def.baseZ - 1.6f);
            l.TopWalk = new Vector3(def.x, wallTop, 2.4f);
            l.ShovePoint = new Vector3(def.x, wallTop, 1.5f);
            l.angle = DownAngle;

            l.pivot = new GameObject("Pivot").transform;
            l.pivot.SetParent(go.transform, false);
            l.pivot.localPosition = l.basePos;
            Material wood = lib != null ? lib.wood : null;
            foreach (var sx in new[] { -0.36f, 0.36f })
                Part(l.pivot, new Vector3(sx, l.Length / 2f, 0), new Vector3(0.11f, l.Length, 0.13f), wood, true);
            for (var y = 0.5f; y < l.Length - 0.2f; y += 0.75f)
                Part(l.pivot, new Vector3(0, y, 0), new Vector3(0.72f, 0.06f, 0.07f), wood, false);
            l.Apply();
            return l;
        }

        static void Part(Transform parent, Vector3 pos, Vector3 size, Material m, bool shadows)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(go.GetComponent<Collider>());
            go.layer = 2;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            if (m != null) r.sharedMaterial = m;
        }

        void Apply() => pivot.localRotation = Quaternion.AngleAxis(angle, Vector3.right);

        public void RequestRaise()
        {
            if (State != LadderState.Down || cooldown > 0f) return;
            State = LadderState.Raising;
            t = 0f;
            Raises++;
        }

        public bool TryEnter(Zombie z)
        {
            if (State != LadderState.Up || climbers.Count >= MaxOnLadder) return false;
            if (climbers.Contains(z)) return true;
            if (climbers.Count > 0 && climbers[climbers.Count - 1].ClimbS * Length < Spacing) return false;
            climbers.Add(z);
            return true;
        }

        /// <summary>How far up (0..1) this climber may go without treading on the one above.</summary>
        public float MaxS(Zombie z)
        {
            var i = climbers.IndexOf(z);
            if (i <= 0) return 1f;
            return Mathf.Max(0f, climbers[i - 1].ClimbS - Spacing / Length);
        }

        public void Leave(Zombie z) => climbers.Remove(z);

        public Vector3 PointAt(float s) => basePos + upDir * (s * Length) + outDir * 0.28f;

        /// <summary>Push the ladder off the wall. Returns the number of climbers thrown down.</summary>
        public int Shove()
        {
            if (!Shovable) return 0;
            State = LadderState.Falling;
            t = 0f;
            Shoves++;
            var thrown = new List<Zombie>(climbers);
            climbers.Clear();
            foreach (var z in thrown) z.KnockOffLadder();
            return thrown.Count;
        }

        public void ResetLadder()
        {
            climbers.Clear();
            State = LadderState.Down;
            angle = DownAngle;
            cooldown = 0f;
            Apply();
        }

        void Update()
        {
            var dt = Time.deltaTime;
            cooldown = Mathf.Max(0f, cooldown - dt);
            switch (State)
            {
                case LadderState.Raising:
                    t += dt / RaiseSeconds;
                    var e = t * t * (3f - 2f * t);
                    angle = Mathf.Lerp(DownAngle, upAngle, Mathf.Clamp01(e));
                    if (t >= 1f) State = LadderState.Up;
                    Apply();
                    break;
                case LadderState.Falling:
                    t += dt / FallSeconds;
                    angle = Mathf.Lerp(upAngle, DownAngle, Mathf.Clamp01(t * t));
                    if (t >= 1f)
                    {
                        State = LadderState.Down;
                        cooldown = Cooldown;
                    }

                    Apply();
                    break;
            }
        }
    }
}
