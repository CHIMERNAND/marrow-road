using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Ballistic crossbow bolt. Integrates gravity and ray-casts each step so fast bolts never tunnel.
    /// Sticks into whatever it hits (static geometry or a zombie limb).
    /// </summary>
    public sealed class Bolt : MonoBehaviour
    {
        const int MaxStuck = 80;
        static readonly Queue<Bolt> Stuck = new Queue<Bolt>();

        Vector3 velocity;
        float damage;
        DamageSource source;
        float life;
        bool flying;
        TrailRenderer trail;
        System.Action<HitInfo, bool> onResolved;

        public static Bolt Fire(Vector3 origin, Vector3 dir, float speed, float damage, DamageSource source, System.Action<HitInfo, bool> onResolved = null)
        {
            var lib = MaterialLibrary.Instance;
            var go = new GameObject("Bolt");
            go.layer = 2;
            go.transform.position = origin;
            go.transform.rotation = Quaternion.LookRotation(dir);
            BuildVisual(go.transform, lib);
            var b = go.AddComponent<Bolt>();
            b.velocity = dir * speed;
            b.damage = damage;
            b.source = source;
            b.flying = true;
            b.onResolved = onResolved;
            b.trail = go.AddComponent<TrailRenderer>();
            b.trail.time = 0.12f;
            b.trail.startWidth = 0.025f;
            b.trail.endWidth = 0f;
            b.trail.minVertexDistance = 0.4f;
            b.trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (lib != null && lib.trail != null) b.trail.sharedMaterial = lib.trail;
            return b;
        }

        public static void BuildVisual(Transform parent, MaterialLibrary lib)
        {
            var shaft = Prim(PrimitiveType.Cube, parent, new Vector3(0, 0, -0.2f), new Vector3(0.012f, 0.012f, 0.4f), lib != null ? lib.wood : null);
            var head = Prim(PrimitiveType.Cube, parent, new Vector3(0, 0, 0.01f), new Vector3(0.02f, 0.02f, 0.05f), lib != null ? lib.metal : null);
            head.localRotation = Quaternion.Euler(0, 0, 45);
            Prim(PrimitiveType.Cube, parent, new Vector3(0, 0.008f, -0.36f), new Vector3(0.002f, 0.018f, 0.07f), lib != null ? lib.rope : null);
            Prim(PrimitiveType.Cube, parent, new Vector3(0.008f, 0, -0.36f), new Vector3(0.018f, 0.002f, 0.07f), lib != null ? lib.rope : null);
            _ = shaft;
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
            if (Physics.Raycast(pos, step / Mathf.Max(dist, 1e-5f), out var hit, dist, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Collide))
            {
                Impact(hit);
                return;
            }

            transform.position = pos + step;
            if (velocity.sqrMagnitude > 1f) transform.rotation = Quaternion.LookRotation(velocity);
            if (life > 6f || transform.position.y < -20f)
            {
                onResolved?.Invoke(default, false);
                Destroy(gameObject);
            }
        }

        void Impact(RaycastHit hit)
        {
            flying = false;
            var dir = velocity.normalized;
            transform.position = hit.point - dir * 0.12f;
            transform.rotation = Quaternion.LookRotation(dir);
            if (trail != null) trail.emitting = false;

            var info = new HitInfo { Damage = damage, Point = hit.point, Direction = dir, Source = source };
            var box = hit.collider.GetComponent<Hitbox>();
            var hitEnemy = false;
            if (box != null && box.Owner != null && box.Owner.Alive)
            {
                info.Damage = damage * box.multiplier;
                info.Headshot = box.isHead;
                box.Owner.TakeHit(info);
                hitEnemy = true;
            }

            var t = hit.collider.transform;
            var ls = t.lossyScale;
            if (Mathf.Abs(ls.x - 1f) < 0.01f && Mathf.Abs(ls.y - 1f) < 0.01f && Mathf.Abs(ls.z - 1f) < 0.01f)
                transform.SetParent(t, true);
            onResolved?.Invoke(info, hitEnemy);
            Stuck.Enqueue(this);
            while (Stuck.Count > MaxStuck)
            {
                var old = Stuck.Dequeue();
                if (old != null) Destroy(old.gameObject);
            }
        }
    }
}
