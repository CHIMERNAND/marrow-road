using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Mounted heavy crossbow (springald-style): fast single-target bolts. Stats per tier in balance.json.</summary>
    public sealed class WallCrossbowTurret : BoltTurret
    {
        protected override Bolt.Options BoltOptions => new Bolt.Options { SourceId = "crossbow", Scale = 1f };

        protected override void BuildModel(MaterialLibrary lib)
        {
            Material M(Material a, Material b) => a != null ? a : b;
            Material wood = lib != null ? lib.wood : null, iron = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            Material steel = lib != null ? M(lib.steel, lib.metal) : null, stock = lib != null ? M(lib.stock, lib.wood) : null;
            ProcBow.PartFn P = (pa, pos, size, m) => Part(pa, pos, size, m, false);
            var root = transform;
            // Pivot post on crossed sole beams with four raking braces; the bow rides high enough to clear the merlons.
            Part(root, new Vector3(0, 0.11f, 0), new Vector3(1.6f, 0.2f, 0.22f), wood, true);
            Part(root, new Vector3(0, 0.11f, 0), new Vector3(0.22f, 0.2f, 1.6f), wood, true);
            Part(root, new Vector3(0, 1.2f, 0), new Vector3(0.26f, 2.0f, 0.26f), wood, true);
            foreach (var d in new[] { Vector3.right, Vector3.left, Vector3.forward, Vector3.back })
                ProcBow.Strut(P, root, d * 0.72f + Vector3.up * 0.2f, d * 0.12f + Vector3.up * 1.05f, 0.12f, 0.12f, wood);
            Part(root, new Vector3(0, 2.16f, 0), new Vector3(0.34f, 0.09f, 0.34f), iron, false);

            yaw = new GameObject("Yaw").transform;
            yaw.SetParent(root, false);
            yaw.localPosition = new Vector3(0, 2.25f, 0);
            yaw.rotation = Quaternion.LookRotation(Vector3.back);
            Part(yaw, Vector3.zero, new Vector3(0.44f, 0.07f, 0.34f), iron, true);
            foreach (var sx in new[] { -1f, 1f })
                Part(yaw, new Vector3(sx * 0.15f, 0.16f, 0), new Vector3(0.05f, 0.3f, 0.2f), iron, false);
            pitch = new GameObject("Pitch").transform;
            pitch.SetParent(yaw, false);
            pitch.localPosition = new Vector3(0, 0.24f, 0);
            var pin = Part(pitch, Vector3.zero, new Vector3(0.06f, 0.2f, 0.06f), iron, false, PrimitiveType.Cylinder);
            pin.localRotation = Quaternion.Euler(0, 0, 90f);
            // Heavy tiller with the bolt groove, iron lock and a rear windlass for spanning.
            Part(pitch, new Vector3(0, 0, 0.15f), new Vector3(0.2f, 0.17f, 2.0f), stock, true);
            Part(pitch, new Vector3(0, 0.086f, 0.35f), new Vector3(0.04f, 0.004f, 1.5f), lib != null ? lib.dark : null, false);
            foreach (var sx in new[] { -1f, 1f })
                Part(pitch, new Vector3(sx * 0.103f, 0.01f, -0.35f), new Vector3(0.008f, 0.2f, 0.3f), iron, false);
            var nut = Part(pitch, new Vector3(0, 0.1f, -0.35f), new Vector3(0.12f, 0.1f, 0.12f), steel, false, PrimitiveType.Cylinder);
            nut.localRotation = Quaternion.Euler(0, 0, 90f);
            var drum = Part(pitch, new Vector3(0, 0.02f, -0.78f), new Vector3(0.16f, 0.17f, 0.16f), wood, false, PrimitiveType.Cylinder);
            drum.localRotation = Quaternion.Euler(0, 0, 90f);
            foreach (var sx in new[] { -1f, 1f })
            {
                Part(pitch, new Vector3(sx * 0.2f, -0.06f, -0.78f), new Vector3(0.03f, 0.2f, 0.03f), iron, false);
                Part(pitch, new Vector3(sx * 0.25f, -0.15f, -0.78f), new Vector3(0.12f, 0.035f, 0.035f), wood, false);
            }

            ProcBow.Strut(P, pitch, new Vector3(0, 0.1f, -0.74f), new Vector3(0, 0.11f, -0.4f), 0.015f, 0.015f, rope);
            // Rope bridle and iron nose; steel prod with ~1.9 m span.
            Part(pitch, new Vector3(0, 0.04f, 1.05f), new Vector3(0.3f, 0.17f, 0.15f), rope, false);
            Part(pitch, new Vector3(0, 0.0f, 1.16f), new Vector3(0.22f, 0.2f, 0.06f), iron, false);
            bow = new ProcBow(pitch, new Vector3(0, 0.1f, 1.05f), 0.12f, 0.85f, 7, 0.09f, 0.04f, 0.06f, 10f, 36f, -0.35f, 0.02f, steel, rope, P);
            bow.Set(1f);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(pitch, false);
            muzzle.localPosition = new Vector3(0, 0.12f, 1.25f);
        }
    }
}
