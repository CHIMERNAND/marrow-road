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
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            slewYaw = 45f;
            slewPitch = 30f;
            stringRest = 0.7f;
            stringDrawn = -0.6f;
            var root = transform;
            // Squat timber stand: the ballista fires through the crenels from a raised deck.
            Part(root, new Vector3(0, 0.1f, 0), new Vector3(1.8f, 0.2f, 1.8f), wood, true);
            foreach (var p in new[] { new Vector3(-0.6f, 0, -0.6f), new Vector3(0.6f, 0, -0.6f), new Vector3(-0.6f, 0, 0.6f), new Vector3(0.6f, 0, 0.6f) })
                Part(root, p + new Vector3(0, 1.2f, 0), new Vector3(0.2f, 2.0f, 0.2f), wood, true);
            Part(root, new Vector3(0, 2.2f, 0), new Vector3(1.5f, 0.15f, 1.5f), wood, true);

            yaw = new GameObject("Yaw").transform;
            yaw.SetParent(root, false);
            yaw.localPosition = new Vector3(0, 2.45f, 0);
            yaw.rotation = Quaternion.LookRotation(Vector3.back);
            Part(yaw, Vector3.zero, new Vector3(0.7f, 0.16f, 0.7f), metal, true);
            pitch = new GameObject("Pitch").transform;
            pitch.SetParent(yaw, false);
            pitch.localPosition = new Vector3(0, 0.35f, 0);
            Part(pitch, new Vector3(0, 0, -0.2f), new Vector3(0.3f, 0.22f, 3.0f), wood, true);
            // Torsion frame with two skeins and the arms.
            Part(pitch, new Vector3(0, 0, 0.9f), new Vector3(1.3f, 0.6f, 0.25f), wood, true);
            foreach (var sx in new[] { -0.45f, 0.45f })
            {
                Part(pitch, new Vector3(sx, 0, 0.9f), new Vector3(0.18f, 0.7f, 0.18f), rope, false, PrimitiveType.Cylinder);
                var arm = Part(pitch, new Vector3(sx * 2.0f, 0, 0.75f), new Vector3(0.9f, 0.1f, 0.12f), wood, false);
                arm.localRotation = Quaternion.Euler(0, sx > 0 ? 20f : -20f, 0);
            }

            stringT = Part(pitch, new Vector3(0, 0.12f, 0.7f), new Vector3(2.4f, 0.03f, 0.03f), rope, false);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(pitch, false);
            muzzle.localPosition = new Vector3(0, 0.18f, 1.4f);
        }
    }
}
