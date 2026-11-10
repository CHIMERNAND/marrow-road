using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Mangonel-style catapult. Every few seconds it lobs a stone at the densest knot of the horde inside its
    /// range band (min..max), leading the group by the flight time. Splash damage falls off with distance.
    /// </summary>
    public sealed class CatapultTurret : Turret
    {
        enum ArmState { Cocked, Throwing, Rewinding }

        Transform yaw, arm, cup, stone;
        ArmState state;
        float cooldown = 1.5f;
        float t;
        bool released;
        Vector3 pendingTarget;
        Vector3 pendingVel;

        protected override void BuildModel(MaterialLibrary lib)
        {
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null, rock = lib != null ? lib.rock : null;
            var root = transform;
            Part(root, new Vector3(0, 0.1f, 0), new Vector3(2.4f, 0.2f, 2.4f), wood, true);
            yaw = new GameObject("Yaw").transform;
            yaw.SetParent(root, false);
            yaw.localPosition = new Vector3(0, 0.2f, 0);
            yaw.rotation = Quaternion.LookRotation(Vector3.back);
            // Base frame (rails) and the A-frame uprights holding the axle.
            foreach (var sx in new[] { -0.8f, 0.8f })
            {
                Part(yaw, new Vector3(sx, 0.15f, 0), new Vector3(0.22f, 0.3f, 3.2f), wood, true);
                var up = Part(yaw, new Vector3(sx, 1.0f, 0.2f), new Vector3(0.18f, 1.8f, 0.18f), wood, false);
                up.localRotation = Quaternion.Euler(-12f, 0, 0);
            }

            Part(yaw, new Vector3(0, 1.85f, 0.45f), new Vector3(1.8f, 0.2f, 0.2f), wood, false); // stop beam
            Part(yaw, new Vector3(0, 0.6f, -0.3f), new Vector3(1.3f, 0.4f, 0.4f), rope, false, PrimitiveType.Cylinder); // torsion skein
            arm = new GameObject("Arm").transform;
            arm.SetParent(yaw, false);
            arm.localPosition = new Vector3(0, 0.6f, -0.3f);
            Part(arm, new Vector3(0, 1.4f, 0), new Vector3(0.16f, 2.8f, 0.16f), wood, false);
            cup = new GameObject("Cup").transform;
            cup.SetParent(arm, false);
            cup.localPosition = new Vector3(0, 2.8f, 0);
            Part(cup, Vector3.zero, new Vector3(0.5f, 0.12f, 0.5f), metal, false);
            stone = Part(cup, new Vector3(0, 0.25f, 0), new Vector3(0.45f, 0.45f, 0.45f), rock, false, PrimitiveType.Sphere);
            SetArm(0f);
        }

        void SetArm(float s)
        {
            // Cocked: arm lies back toward the wall. Thrown: slams forward onto the stop beam.
            arm.localRotation = Quaternion.Euler(Mathf.Lerp(-75f, 18f, s), 0, 0);
        }

        void Update()
        {
            if (!Active) return;
            var dt = Time.deltaTime;
            var st = Stats;
            cooldown -= dt;
            switch (state)
            {
                case ArmState.Throwing:
                    t += dt / 0.35f;
                    if (!released && t >= 0.6f) Release(st);
                    SetArm(Mathf.Min(t, 1f));
                    if (t >= 1f)
                    {
                        state = ArmState.Rewinding;
                        t = 0f;
                    }

                    return;
                case ArmState.Rewinding:
                    t += dt / Mathf.Max(0.5f, st.interval * 0.7f);
                    SetArm(1f - Mathf.Min(t, 1f));
                    if (t >= 1f)
                    {
                        state = ArmState.Cocked;
                        stone.gameObject.SetActive(true);
                    }

                    return;
            }

            if (cooldown > 0f) return;
            if (!PickCluster(director.Spawner.Alive, st, out var p, out var v)) return;
            pendingTarget = p;
            pendingVel = v;
            var flat = p - transform.position;
            flat.y = 0;
            if (flat.sqrMagnitude > 0.01f) yaw.rotation = Quaternion.LookRotation(flat);
            cooldown = st.interval;
            state = ArmState.Throwing;
            t = 0f;
            released = false;
            Shots++;
        }

        void Release(TurretTier st)
        {
            released = true;
            stone.gameObject.SetActive(false);
            var from = cup.position + Vector3.up * 0.3f;
            var dist = Vector3.Distance(from, pendingTarget);
            var T = Mathf.Clamp(dist / 40f, 2.5f, 5f);
            var aim = pendingTarget + pendingVel * T;
            var v0 = (aim - from) / T + Vector3.up * (0.5f * Ballistics.Gravity * T);
            Boulder.Launch(from, v0, st.damage, st.splash, director);
        }

        bool PickCluster(List<Zombie> alive, TurretTier st, out Vector3 point, out Vector3 vel)
        {
            point = vel = Vector3.zero;
            var bestN = 0;
            var origin = transform.position;
            var r2 = st.splash * st.splash;
            for (var i = 0; i < alive.Count; i++)
            {
                var z = alive[i];
                if (!z.Alive || z.OnWall || z.OnLadder) continue;
                var d = Vector3.Distance(origin, z.transform.position);
                if (d < st.minRange || d > st.range) continue;
                var n = 0;
                var sum = Vector3.zero;
                var vs = Vector3.zero;
                for (var j = 0; j < alive.Count; j++)
                {
                    var o = alive[j];
                    if (!o.Alive) continue;
                    if ((o.transform.position - z.transform.position).sqrMagnitude > r2) continue;
                    n++;
                    sum += o.transform.position;
                    vs += o.Velocity;
                }

                if (n > bestN)
                {
                    bestN = n;
                    point = sum / n;
                    vel = vs / n;
                }
            }

            return bestN > 0;
        }
    }
}
