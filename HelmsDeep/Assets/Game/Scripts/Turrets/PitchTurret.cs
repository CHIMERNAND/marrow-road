using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Boiling-pitch cauldron over the gate. When the dead crowd the gate it tips, pouring burning pitch onto the
    /// gate apron for a few seconds: damage per second to everything in the zone (armour doesn't help).
    /// Higher tiers burn hotter, refill faster and spread wider.
    /// </summary>
    public sealed class PitchTurret : Turret
    {
        // Gate apron in front of the leaves (world space), from the gate recess out onto the shelf.
        static readonly Vector3 ZoneCenter = new Vector3(140f, 10f, -4.2f);
        static readonly Vector3 ZoneHalf = new Vector3(4.6f, 2.5f, 4.4f);

        Transform tilt, stream, puddle;
        float cooldown = 1f;
        float pouring;
        float puddleLife;
        int lastCount;

        public int Pours { get; private set; }

        float ZoneScale => 1f + 0.15f * Tier;

        protected override void BuildModel(MaterialLibrary lib)
        {
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, flame = lib != null ? lib.flame : null, dark = lib != null ? lib.dark : null;
            var root = transform;
            // Gallows frame on the wall walk, arm reaching out over the breastwork.
            Part(root, new Vector3(0, 0.08f, 0), new Vector3(2.2f, 0.16f, 1.6f), wood, true);
            foreach (var sx in new[] { -0.95f, 0.95f })
                Part(root, new Vector3(sx, 1.4f, 0), new Vector3(0.18f, 2.8f, 0.18f), wood, true);
            Part(root, new Vector3(0, 2.8f, -0.9f), new Vector3(2.1f, 0.18f, 2.8f), wood, false);
            Part(root, new Vector3(0, 0.5f, 0.3f), new Vector3(0.9f, 0.5f, 0.9f), dark, false, PrimitiveType.Cylinder); // fire pit
            Part(root, new Vector3(0, 0.82f, 0.3f), new Vector3(0.5f, 0.12f, 0.5f), flame, false, PrimitiveType.Cylinder);

            tilt = new GameObject("Tilt").transform;
            tilt.SetParent(root, false);
            tilt.localPosition = new Vector3(0, 2.45f, -1.9f);
            Part(tilt, new Vector3(0, -0.2f, 0), new Vector3(1.1f, 0.8f, 1.1f), metal, false, PrimitiveType.Cylinder);
            Part(tilt, new Vector3(0, 0.22f, 0), new Vector3(0.95f, 0.04f, 0.95f), flame, false, PrimitiveType.Cylinder);
            stream = Part(root, Vector3.zero, new Vector3(0.35f, 1f, 0.35f), flame, false);
            stream.gameObject.SetActive(false);
            puddle = Part(root, Vector3.zero, Vector3.one, flame, false, PrimitiveType.Cylinder);
            puddle.gameObject.SetActive(false);
        }

        public int CountInZone()
        {
            var n = 0;
            var half = ZoneHalf * ZoneScale;
            foreach (var z in director.Spawner.Alive)
                if (z.Alive && InZone(z.transform.position, half)) n++;
            return n;
        }

        static bool InZone(Vector3 p, Vector3 half)
        {
            var d = p - ZoneCenter;
            return Mathf.Abs(d.x) <= half.x && Mathf.Abs(d.y) <= half.y && Mathf.Abs(d.z) <= half.z;
        }

        void Update()
        {
            var dt = Time.deltaTime;
            puddleLife -= dt;
            if (puddle.gameObject.activeSelf)
            {
                var k = Mathf.Clamp01(puddleLife / 2f);
                var hz = ZoneHalf * ZoneScale;
                puddle.position = new Vector3(ZoneCenter.x, ZoneCenter.y + 0.04f, ZoneCenter.z);
                puddle.localScale = new Vector3(hz.x * 1.8f * (0.6f + 0.4f * k), 0.02f, hz.z * 1.8f * (0.6f + 0.4f * k));
                if (puddleLife <= 0f) puddle.gameObject.SetActive(false);
            }

            if (!Active)
            {
                pouring = 0f;
                stream.gameObject.SetActive(false);
                tilt.localRotation = Quaternion.Slerp(tilt.localRotation, Quaternion.identity, dt * 2f);
                return;
            }

            var st = Stats;
            cooldown -= dt;
            if (pouring > 0f)
            {
                pouring -= dt;
                tilt.localRotation = Quaternion.Slerp(tilt.localRotation, Quaternion.Euler(-80f, 0, 0), dt * 6f);
                Burn(st.damage * dt);
                if (pouring <= 0f) stream.gameObject.SetActive(false);
                return;
            }

            tilt.localRotation = Quaternion.Slerp(tilt.localRotation, Quaternion.identity, dt * 1.5f);
            if (cooldown > 0f) return;
            lastCount = CountInZone();
            if (lastCount < 1) return;
            pouring = st.duration;
            cooldown = st.interval + st.duration;
            puddleLife = st.duration + 2f;
            Pours++;
            Shots++;
            // Stream from the cauldron lip to the apron.
            var top = tilt.position + new Vector3(0, 0.1f, -0.6f);
            var bottom = new Vector3(top.x, ZoneCenter.y, ZoneCenter.z + 2.5f);
            stream.position = (top + bottom) * 0.5f;
            stream.rotation = Quaternion.FromToRotation(Vector3.up, (top - bottom).normalized);
            stream.localScale = new Vector3(0.35f, Vector3.Distance(top, bottom), 0.35f);
            stream.gameObject.SetActive(true);
            puddle.gameObject.SetActive(true);
        }

        void Burn(float amount)
        {
            var alive = director.Spawner.Alive;
            var half = ZoneHalf * ZoneScale;
            for (var i = alive.Count - 1; i >= 0; i--)
            {
                if (i >= alive.Count) continue;
                var z = alive[i];
                if (!z.Alive || !InZone(z.transform.position, half)) continue;
                z.TakeHit(new HitInfo
                {
                    Damage = amount,
                    Point = z.ChestPosition,
                    Direction = Vector3.down,
                    Source = DamageSource.Turret,
                    SourceId = "pitch"
                });
            }
        }
    }
}
