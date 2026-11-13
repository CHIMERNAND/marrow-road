using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Torsion ballista: slow, heavy bolt that ignores armour and passes through several bodies.
    /// Prefers rams and brutes, then whatever is closest to the door.
    /// </summary>
    public sealed class BallistaTurret : BoltTurret
    {
        protected override Bolt.Options BoltOptions => new Bolt.Options { SourceId = "ballista", Pierce = Stats.pierce, ArmorPiercing = true, Scale = 3.2f };
        protected override float Spread => 0.003f;

        protected override float Preference(Zombie z)
        {
            switch (z.Kind)
            {
                case EnemyKind.Ram: return 0.05f;
                case EnemyKind.Brute: return 0.15f;
                default: return 1f;
            }
        }

        protected override void BuildModel(MaterialLibrary lib)
        {
            Material M(Material a, Material b) => a != null ? a : b;
            Material wood = lib != null ? lib.wood : null, iron = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            Material stock = lib != null ? M(lib.stock, lib.wood) : null;
            ProcBow.PartFn P = (pa, pos, size, m) => Part(pa, pos, size, m, false);
            slewYaw = 45f;
            slewPitch = 30f;
            var root = transform;
            // Timber stand: four legs, X-braced, under a plank deck and an iron turntable.
            Part(root, new Vector3(0, 0.1f, 0), new Vector3(1.8f, 0.2f, 1.8f), wood, true);
            var legs = new[] { new Vector3(-0.65f, 0, -0.65f), new Vector3(0.65f, 0, -0.65f), new Vector3(0.65f, 0, 0.65f), new Vector3(-0.65f, 0, 0.65f) };
            foreach (var p in legs) Part(root, p + new Vector3(0, 1.2f, 0), new Vector3(0.2f, 2.0f, 0.2f), wood, true);
            for (var k = 0; k < 4; k++)
            {
                var a = legs[k];
                var b = legs[(k + 1) % 4];
                ProcBow.Strut(P, root, a + Vector3.up * 0.35f, b + Vector3.up * 2.0f, 0.09f, 0.09f, wood);
                ProcBow.Strut(P, root, b + Vector3.up * 0.35f, a + Vector3.up * 2.0f, 0.09f, 0.09f, wood);
            }

            Part(root, new Vector3(0, 2.25f, 0), new Vector3(1.6f, 0.12f, 1.6f), wood, true);

            yaw = new GameObject("Yaw").transform;
            yaw.SetParent(root, false);
            yaw.localPosition = new Vector3(0, 2.36f, 0);
            yaw.rotation = Quaternion.LookRotation(Vector3.back);
            Part(yaw, Vector3.zero, new Vector3(0.8f, 0.05f, 0.8f), iron, true, PrimitiveType.Cylinder);
            foreach (var sx in new[] { -1f, 1f })
                Part(yaw, new Vector3(sx * 0.2f, 0.2f, 0), new Vector3(0.08f, 0.36f, 0.3f), wood, false);
            pitch = new GameObject("Pitch").transform;
            pitch.SetParent(yaw, false);
            pitch.localPosition = new Vector3(0, 0.38f, 0);
            // Slider/stock with the trough, the claw and the rear windlass.
            Part(pitch, new Vector3(0, 0, -0.2f), new Vector3(0.28f, 0.2f, 3.0f), stock, true);
            Part(pitch, new Vector3(0, 0.102f, 0.0f), new Vector3(0.06f, 0.006f, 2.4f), lib != null ? lib.dark : null, false);
            var drum = Part(pitch, new Vector3(0, 0.05f, -1.55f), new Vector3(0.2f, 0.3f, 0.2f), wood, false, PrimitiveType.Cylinder);
            drum.localRotation = Quaternion.Euler(0, 0, 90f);
            foreach (var sx in new[] { -1f, 1f })
            {
                Part(pitch, new Vector3(sx * 0.3f, 0.05f, -1.55f), new Vector3(0.26f, 0.05f, 0.05f), wood, false);
                Part(pitch, new Vector3(sx * 0.3f, 0.05f, -1.55f), new Vector3(0.05f, 0.5f, 0.05f), wood, false);
            }

            Part(pitch, new Vector3(0, 0.16f, -1.2f), new Vector3(0.18f, 0.12f, 0.2f), iron, false);
            // Torsion frame: two crossbeams, four stiles, twisted rope skeins with iron washers.
            foreach (var y in new[] { -0.36f, 0.36f })
                Part(pitch, new Vector3(0, y, 0.9f), new Vector3(1.45f, 0.14f, 0.3f), wood, true);
            foreach (var x in new[] { -0.68f, -0.18f, 0.18f, 0.68f })
                Part(pitch, new Vector3(x, 0, 0.9f), new Vector3(0.12f, 0.6f, 0.28f), wood, false);
            foreach (var sx in new[] { -0.43f, 0.43f })
            {
                Part(pitch, new Vector3(sx, 0, 0.9f), new Vector3(0.22f, 0.3f, 0.22f), rope, false, PrimitiveType.Cylinder);
                foreach (var y in new[] { -0.45f, 0.45f })
                    Part(pitch, new Vector3(sx, y, 0.9f), new Vector3(0.3f, 0.03f, 0.3f), iron, false, PrimitiveType.Cylinder);
            }

            // Rigid arms pivot in the skeins and swing back when the windlass draws the string to the claw.
            bow = new ProcBow(pitch, new Vector3(0, 0.12f, 0.9f), 0.43f, 0.95f, 1, 0.12f, 0.08f, 0.1f, 4f, 48f, -1.2f, 0.035f, wood, rope, P, rigid: true);
            bow.Set(1f);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(pitch, false);
            muzzle.localPosition = new Vector3(0, 0.18f, 1.4f);
        }
    }
}
