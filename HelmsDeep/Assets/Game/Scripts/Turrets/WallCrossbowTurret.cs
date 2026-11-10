using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Mounted heavy crossbow (springald-style): fast single-target bolts. Stats per tier in balance.json.</summary>
    public sealed class WallCrossbowTurret : BoltTurret
    {
        protected override Bolt.Options BoltOptions => new Bolt.Options { SourceId = "crossbow", Scale = 1f };

        protected override void BuildModel(MaterialLibrary lib)
        {
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            var root = transform;
            // Timber trestle that lifts the bow over the merlons (2.2 m).
            Part(root, new Vector3(0, 0.08f, 0), new Vector3(1.4f, 0.16f, 1.4f), wood, true);
            Part(root, new Vector3(0, 1.3f, 0), new Vector3(0.3f, 2.4f, 0.3f), wood, true);
            foreach (var sx in new[] { -1f, 1f })
            {
                var brace = Part(root, new Vector3(sx * 0.35f, 0.8f, 0), new Vector3(0.12f, 1.7f, 0.12f), wood, true);
                brace.localRotation = Quaternion.Euler(0, 0, sx * 22f);
            }

            yaw = new GameObject("Yaw").transform;
            yaw.SetParent(root, false);
            yaw.localPosition = new Vector3(0, 2.6f, 0);
            yaw.rotation = Quaternion.LookRotation(Vector3.back);
            Part(yaw, Vector3.zero, new Vector3(0.5f, 0.12f, 0.5f), metal, true);
            pitch = new GameObject("Pitch").transform;
            pitch.SetParent(yaw, false);
            pitch.localPosition = new Vector3(0, 0.25f, 0);
            Part(pitch, new Vector3(0, 0, 0.1f), new Vector3(0.18f, 0.16f, 1.9f), wood, true);
            var l = Part(pitch, new Vector3(-0.55f, 0, 0.9f), new Vector3(1.1f, 0.08f, 0.1f), metal, true);
            var r = Part(pitch, new Vector3(0.55f, 0, 0.9f), new Vector3(1.1f, 0.08f, 0.1f), metal, true);
            l.localRotation = Quaternion.Euler(0, -14, 0);
            r.localRotation = Quaternion.Euler(0, 14, 0);
            stringT = Part(pitch, new Vector3(0, 0.06f, 0.55f), new Vector3(1.9f, 0.02f, 0.02f), rope, false);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(pitch, false);
            muzzle.localPosition = new Vector3(0, 0.1f, 1.2f);
        }
    }
}
