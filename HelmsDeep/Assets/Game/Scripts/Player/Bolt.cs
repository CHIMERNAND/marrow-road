using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Ballistic bolt (hand crossbow, wall crossbow, ballista). Integrates gravity and ray-casts each step so
    /// fast bolts never tunnel. Sticks into whatever stops it. Ballista bolts pierce several bodies first.
    /// Pooled: firing never allocates GameObjects after warm-up (the M1 run showed spikes from per-shot primitives).
    /// </summary>
    public sealed class Bolt : MonoBehaviour
    {
        const int MaxStuck = 80;
        const int Mask = ~(1 << 2);
        static readonly Queue<(Bolt bolt, int serial)> Stuck = new Queue<(Bolt, int)>();
        /// <summary>Bolts built at runtime because the pool ran dry (verification spike context).</summary>
        public static int Created;
        static readonly Stack<Bolt> Pool = new Stack<Bolt>();
        static readonly RaycastHit[] HitBuf = new RaycastHit[16];
        static Transform poolRoot;

        Vector3 velocity;
        float damage;
        DamageSource source;
        string sourceId;
        int pierceLeft;
        bool armorPiercing;
        float life;
        bool flying;
        TrailRenderer trail;
        System.Action<HitInfo, bool> onResolved;
        Turret owner;
        int stuckSerial;
        bool pooled;
        readonly HashSet<IDamageable> pierced = new HashSet<IDamageable>();

        public struct Options
        {
            public int Pierce;
            public bool ArmorPiercing;
            public string SourceId;
            public float Scale;
            public Turret Owner;
        }

        public static Bolt Fire(Vector3 origin, Vector3 dir, float speed, float damage, DamageSource source, System.Action<HitInfo, bool> onResolved = null)
            => Fire(origin, dir, speed, damage, source, new Options { SourceId = source == DamageSource.Player ? "player" : "crossbow", Scale = 1f }, onResolved);

        public static Bolt Fire(Vector3 origin, Vector3 dir, float speed, float damage, DamageSource source, Options opt, System.Action<HitInfo, bool> onResolved = null)
        {
            var b = Take();
            b.pooled = false;
            var t = b.transform;
            t.SetParent(null, false);
            t.position = origin;
            t.rotation = Quaternion.LookRotation(dir);
            var sc = opt.Scale > 0f ? opt.Scale : 1f;
            t.localScale = new Vector3(sc, sc, sc);
            b.velocity = dir * speed;
            b.damage = damage;
            b.source = source;
            b.sourceId = opt.SourceId;
            b.owner = opt.Owner;
            b.pierceLeft = opt.Pierce;
            b.armorPiercing = opt.ArmorPiercing;
            b.life = 0f;
            b.flying = true;
            b.onResolved = onResolved;
            b.pierced.Clear();
            b.gameObject.SetActive(true);
            b.trail.Clear();
            b.trail.emitting = true;
            b.trail.startWidth = 0.025f * sc;
            return b;
        }

        /// <summary>Create pooled bolts up front so the first volleys of a wave don't hitch.</summary>
        public static void Prewarm(int count)
        {
            var made = new List<Bolt>();
            for (var i = 0; i < count; i++) made.Add(Take());
            foreach (var b in made) b.Recycle();
        }

        static Bolt Take()
        {
            while (Pool.Count > 0)
            {
                var b = Pool.Pop();
                if (b != null) return b;
            }

            Created++;
            var lib = MaterialLibrary.Instance;
            var go = new GameObject("Bolt");
            go.layer = 2;
            go.SetActive(false);
            BuildVisual(go.transform, lib);
            var nb = go.AddComponent<Bolt>();
            nb.trail = go.AddComponent<TrailRenderer>();
            nb.trail.time = 0.12f;
            nb.trail.startWidth = 0.025f;
            nb.trail.endWidth = 0f;
            nb.trail.minVertexDistance = 0.4f;
            nb.trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (lib != null && lib.trail != null) nb.trail.sharedMaterial = lib.trail;
            return nb;
        }

        /// <summary>Return to the pool (also used when a zombie carrying stuck bolts is recycled).</summary>
        public void Recycle()
        {
            if (pooled) return;
            pooled = true;
            stuckSerial++; // invalidates any queued stuck entry for this bolt
            owner = null;
            flying = false;
            onResolved = null;
            if (poolRoot == null) poolRoot = new GameObject("BoltPool").transform;
            transform.SetParent(poolRoot, false);
            gameObject.SetActive(false);
            Pool.Push(this);
        }

        public static void BuildVisual(Transform parent, MaterialLibrary lib)
        {
            Material iron = lib != null ? (lib.steel != null ? lib.steel : lib.metal) : null;
            Material ash = lib != null ? lib.wood : null, vane = lib != null ? (lib.leather != null ? lib.leather : lib.rope) : null;
            // Square bodkin head: a tapered socket and a sharp point.
            var socket = Prim(PrimitiveType.Cube, parent, new Vector3(0, 0, -0.005f), new Vector3(0.016f, 0.016f, 0.03f), iron);
            socket.localRotation = Quaternion.Euler(0, 0, 45);
            var point = Prim(PrimitiveType.Cube, parent, new Vector3(0, 0, 0.022f), new Vector3(0.009f, 0.009f, 0.03f), iron);
            point.localRotation = Quaternion.Euler(0, 0, 45);
            // Round ash shaft, slightly swelling toward the head.
            var shaft = Prim(PrimitiveType.Cylinder, parent, new Vector3(0, 0, -0.2f), new Vector3(0.013f, 0.19f, 0.013f), ash);
            shaft.localRotation = Quaternion.Euler(90f, 0, 0);
            // Three leather vanes, 120 degrees apart (the bottom one rides in the groove gap).
            for (var k = 0; k < 3; k++)
            {
                var v = new GameObject("Vane").transform;
                v.SetParent(parent, false);
                v.localPosition = new Vector3(0, 0, -0.35f);
                v.localRotation = Quaternion.Euler(0, 0, k * 120f);
                var f = Prim(PrimitiveType.Cube, v, new Vector3(0, 0.011f, 0), new Vector3(0.0018f, 0.016f, 0.07f), vane);
                f.localRotation = Quaternion.Euler(-6f, 0, 0);
            }
        }

        static Transform Prim(PrimitiveType t, Transform parent, Vector3 pos, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.layer = 2;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (m != null) r.sharedMaterial = m;
            return go.transform;
        }

        void Update()
        {
            if (!flying) return;
            var dt = Time.deltaTime;
            life += dt;
            var pos = transform.position;
            velocity += Vector3.down * (Ballistics.Gravity * dt);
            var step = velocity * dt;
            var dist = step.magnitude;
            var dir = step / Mathf.Max(dist, 1e-5f);
            if (pierceLeft > 0)
            {
                if (StepPiercing(pos, dir, dist)) return;
            }
            else if (Physics.Raycast(pos, dir, out var hit, dist, Mask, QueryTriggerInteraction.Collide))
            {
                var hitEnemy = Apply(hit);
                Stick(hit, hitEnemy, true);
                return;
            }

            transform.position = pos + step;
            if (velocity.sqrMagnitude > 1f) transform.rotation = Quaternion.LookRotation(velocity);
            if (life > 6f || transform.position.y < -20f)
            {
                var cb = onResolved;
                Recycle();
                cb?.Invoke(default, false);
            }
        }

        /// <summary>Returns true when the bolt stopped this step.</summary>
        bool StepPiercing(Vector3 pos, Vector3 dir, float dist)
        {
            var n = Physics.RaycastNonAlloc(pos, dir, HitBuf, dist, Mask, QueryTriggerInteraction.Collide);
            System.Array.Sort(HitBuf, 0, n, HitDistanceComparer.Instance);
            for (var i = 0; i < n; i++)
            {
                var h = HitBuf[i];
                var box = h.collider.GetComponent<Hitbox>();
                if (box == null)
                {
                    if (h.collider.isTrigger) continue;
                    Stick(h, false, true);
                    return true;
                }

                if (box.Owner == null || !box.Owner.Alive || pierced.Contains(box.Owner)) continue;
                var hitEnemy = Apply(h);
                pierced.Add(box.Owner);
                if (--pierceLeft < 0)
                {
                    Stick(h, hitEnemy, false);
                    return true;
                }
            }

            return false;
        }

        bool Apply(RaycastHit hit)
        {
            var box = hit.collider.GetComponent<Hitbox>();
            if (box == null || box.Owner == null || !box.Owner.Alive) return false;
            var info = new HitInfo
            {
                Damage = damage * box.multiplier,
                Point = hit.point,
                Direction = velocity.normalized,
                Source = source,
                Headshot = box.isHead,
                Armored = box.armored,
                ArmorPiercing = armorPiercing,
                SourceId = sourceId,
                Owner = owner
            };
            box.Owner.TakeHit(info);
            onResolved?.Invoke(info, true);
            onResolved = null;
            return true;
        }

        void Stick(RaycastHit hit, bool hitEnemy, bool resolve)
        {
            flying = false;
            var dir = velocity.normalized;
            transform.position = hit.point - dir * 0.12f * transform.localScale.z;
            transform.rotation = Quaternion.LookRotation(dir);
            if (trail != null) trail.emitting = false;

            var t = hit.collider.transform;
            var ls = t.lossyScale;
            // Parent only under uniformly scaled transforms (zombies use random uniform scale);
            // non-uniform parents (scaled primitives) would shear the bolt.
            var maxS = Mathf.Max(ls.x, Mathf.Max(ls.y, ls.z));
            var minS = Mathf.Min(ls.x, Mathf.Min(ls.y, ls.z));
            if (minS > 0f && maxS - minS < 0.01f * maxS)
                transform.SetParent(t, true);
            if (resolve && !hitEnemy && onResolved != null)
            {
                var cb = onResolved;
                onResolved = null;
                cb(default, false);
            }

            Stuck.Enqueue((this, stuckSerial));
            while (Stuck.Count > MaxStuck)
            {
                var (old, serial) = Stuck.Dequeue();
                if (old != null && old.stuckSerial == serial && !old.flying && !old.pooled) old.Recycle();
            }
        }

        sealed class HitDistanceComparer : IComparer<RaycastHit>
        {
            public static readonly HitDistanceComparer Instance = new HitDistanceComparer();
            public int Compare(RaycastHit a, RaycastHit b) => a.distance.CompareTo(b.distance);
        }
    }
}
