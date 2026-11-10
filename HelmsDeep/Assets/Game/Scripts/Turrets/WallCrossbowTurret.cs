using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Mounted heavy crossbow (springald-style). Picks the zombie closest to the gate inside range,
    /// leads it with a ballistic solve, and fires every 1.6 s.
    /// </summary>
    public sealed class WallCrossbowTurret : MonoBehaviour
    {
        public const int Cost = 150;
        public const float Range = 90f;
        public const float FireInterval = 1.6f;
        public const float Damage = 70f;

        Transform yaw, pitch, muzzle, stringT;
        float cooldown = 0.5f;
        Zombie current;
        SiegeDirector director;

        public static WallCrossbowTurret Build(TurretSocket socket, SiegeDirector director)
        {
            var lib = MaterialLibrary.Instance;
            var go = new GameObject("WallCrossbowTurret_" + socket.socketName);
            go.transform.SetPositionAndRotation(socket.transform.position, Quaternion.identity);
            var t = go.AddComponent<WallCrossbowTurret>();
            t.director = director;
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            // Timber trestle that lifts the bow over the merlons (2.2 m).
            Part(go.transform, new Vector3(0, 0.08f, 0), new Vector3(1.4f, 0.16f, 1.4f), wood, true);
            Part(go.transform, new Vector3(0, 1.3f, 0), new Vector3(0.3f, 2.4f, 0.3f), wood, true);
            foreach (var sx in new[] { -1f, 1f })
            {
                var brace = Part(go.transform, new Vector3(sx * 0.35f, 0.8f, 0), new Vector3(0.12f, 1.7f, 0.12f), wood, true);
                brace.localRotation = Quaternion.Euler(0, 0, sx * 22f);
            }

            t.yaw = new GameObject("Yaw").transform;
            t.yaw.SetParent(go.transform, false);
            t.yaw.localPosition = new Vector3(0, 2.6f, 0);
            t.yaw.rotation = Quaternion.LookRotation(Vector3.back);
            Part(t.yaw, Vector3.zero, new Vector3(0.5f, 0.12f, 0.5f), metal, true);
            t.pitch = new GameObject("Pitch").transform;
            t.pitch.SetParent(t.yaw, false);
            t.pitch.localPosition = new Vector3(0, 0.25f, 0);
            Part(t.pitch, new Vector3(0, 0, 0.1f), new Vector3(0.18f, 0.16f, 1.9f), wood, true);
            var l = Part(t.pitch, new Vector3(-0.55f, 0, 0.9f), new Vector3(1.1f, 0.08f, 0.1f), metal, true);
            var r = Part(t.pitch, new Vector3(0.55f, 0, 0.9f), new Vector3(1.1f, 0.08f, 0.1f), metal, true);
            l.localRotation = Quaternion.Euler(0, -14, 0);
            r.localRotation = Quaternion.Euler(0, 14, 0);
            t.stringT = Part(t.pitch, new Vector3(0, 0.06f, 0.55f), new Vector3(1.9f, 0.02f, 0.02f), rope, false);
            t.muzzle = new GameObject("Muzzle").transform;
            t.muzzle.SetParent(t.pitch, false);
            t.muzzle.localPosition = new Vector3(0, 0.1f, 1.2f);
            socket.Turret = t;
            return t;
        }

        static Transform Part(Transform parent, Vector3 pos, Vector3 size, Material m, bool collide)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.layer = 2;
            if (!collide) Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            if (m != null) go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go.transform;
        }

        void Update()
        {
            if (director == null || director.State.Phase != SiegePhase.Wave)
            {
                current = null;
                return;
            }

            var dt = Time.deltaTime;
            cooldown -= dt;
            if (current == null || !current.Alive || !InRange(current)) current = PickTarget(director.Spawner.Alive);
            if (current == null) return;

            var from = muzzle.position;
            if (!Ballistics.Solve(from, current.ChestPosition, current.Velocity, CrossbowWeapon.BoltSpeed, out var dir)) return;
            var flat = new Vector3(dir.x, 0, dir.z);
            var wantYaw = Quaternion.LookRotation(flat.sqrMagnitude > 1e-4f ? flat : Vector3.forward);
            yaw.rotation = Quaternion.RotateTowards(yaw.rotation, wantYaw, 90f * dt);
            var wantPitch = -Mathf.Asin(Mathf.Clamp(dir.y, -1f, 1f)) * Mathf.Rad2Deg;
            pitch.localRotation = Quaternion.RotateTowards(pitch.localRotation, Quaternion.Euler(wantPitch, 0, 0), 60f * dt);
            var drawn = Mathf.Clamp01(1f - cooldown / FireInterval);
            stringT.localPosition = new Vector3(0, 0.06f, Mathf.Lerp(0.95f, 0.15f, drawn));

            var aligned = Vector3.Angle(muzzle.forward, dir) < 2.5f;
            if (cooldown <= 0f && aligned)
            {
                cooldown = FireInterval;
                var spread = Random.insideUnitSphere * 0.006f;
                Bolt.Fire(from, (dir + spread).normalized, CrossbowWeapon.BoltSpeed, Damage, DamageSource.Turret);
            }
        }

        bool InRange(Zombie z) => (z.ChestPosition - muzzle.position).sqrMagnitude < Range * Range;

        Zombie PickTarget(List<Zombie> alive)
        {
            Zombie best = null;
            var bestScore = float.MaxValue;
            var gate = director.GateTarget;
            foreach (var z in alive)
            {
                if (!z.Alive || !InRange(z)) continue;
                var score = (z.transform.position - gate).sqrMagnitude;
                if (score >= bestScore) continue;
                var to = z.ChestPosition - muzzle.position;
                if (Physics.Raycast(muzzle.position, to.normalized, out var hit, to.magnitude - 0.5f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore) && hit.collider != null)
                    continue;
                best = z;
                bestScore = score;
            }

            return best;
        }
    }
}
