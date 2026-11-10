using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Catapult stone. Ballistic flight; on impact deals splash damage with linear falloff and kicks up dust.</summary>
    public sealed class Boulder : MonoBehaviour
    {
        const int Mask = ~(1 << 2);
        Vector3 velocity;
        float damage, radius, life;
        SiegeDirector director;
        Turret owner;
        Transform dust;
        float dustT = -1f;
        bool landed;

        public static void Launch(Vector3 from, Vector3 v0, float damage, float radius, SiegeDirector director, Turret owner = null)
        {
            var lib = MaterialLibrary.Instance;
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(go.GetComponent<Collider>());
            go.layer = 2;
            go.name = "Boulder";
            go.transform.position = from;
            go.transform.localScale = Vector3.one * 0.55f;
            if (lib != null) go.GetComponent<MeshRenderer>().sharedMaterial = lib.rock;
            var b = go.AddComponent<Boulder>();
            b.velocity = v0;
            b.damage = damage;
            b.radius = radius;
            b.director = director;
            b.owner = owner;
        }

        void Update()
        {
            var dt = Time.deltaTime;
            if (landed)
            {
                dustT += dt;
                var k = dustT / 1.6f;
                if (dust != null) dust.localScale = new Vector3(1f, 0.35f, 1f) * (radius * 1.2f * Mathf.Sqrt(Mathf.Clamp01(k * 2f))) * (1f - Mathf.Clamp01((k - 0.6f) / 0.4f) * 0.9f);
                if (k >= 1f) Destroy(gameObject);
                return;
            }

            life += dt;
            velocity += Vector3.down * (Ballistics.Gravity * dt);
            var step = velocity * dt;
            var dist = step.magnitude;
            if (Physics.Raycast(transform.position, step / Mathf.Max(dist, 1e-5f), out var hit, dist, Mask, QueryTriggerInteraction.Ignore))
            {
                Explode(hit.point);
                return;
            }

            transform.position += step;
            transform.Rotate(220f * dt, 90f * dt, 0f, Space.Self);
            if (life > 12f || transform.position.y < -5f) Explode(transform.position);
        }

        void Explode(Vector3 at)
        {
            landed = true;
            transform.position = at;
            GetComponent<MeshRenderer>().enabled = false;
            if (director != null)
            {
                var alive = director.Spawner.Alive;
                for (var i = alive.Count - 1; i >= 0; i--)
                {
                    if (i >= alive.Count) continue;
                    var z = alive[i];
                    if (!z.Alive) continue;
                    var d = Vector3.Distance(z.transform.position, at);
                    if (d > radius) continue;
                    var dir = z.transform.position - at;
                    dir.y = 0;
                    z.TakeHit(new HitInfo
                    {
                        Damage = damage * (1f - 0.6f * d / radius),
                        Point = z.ChestPosition,
                        Direction = dir.sqrMagnitude > 0.01f ? dir.normalized : Vector3.forward,
                        Source = DamageSource.Turret,
                        SourceId = "catapult",
                        Owner = owner
                    });
                }
            }

            var lib = MaterialLibrary.Instance;
            var puff = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(puff.GetComponent<Collider>());
            puff.layer = 2;
            puff.transform.SetParent(transform, false);
            puff.transform.localScale = Vector3.zero;
            var r = puff.GetComponent<MeshRenderer>();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (lib != null) r.sharedMaterial = lib.road;
            dust = puff.transform;
            transform.localScale = Vector3.one;
            transform.rotation = Quaternion.identity;
            dustT = 0f;
        }
    }
}
