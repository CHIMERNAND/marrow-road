using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Shared aim-and-shoot logic for the wall crossbow and the ballista: pick a target with line of sight,
    /// lead it with a ballistic solve, slew yaw/pitch, fire when aligned and spanned.
    /// </summary>
    public abstract class BoltTurret : Turret
    {
        protected Transform yaw, pitch, muzzle, stringT;
        protected ProcBow bow;
        protected float slewYaw = 90f, slewPitch = 60f;
        protected float stringRest = 0.95f, stringDrawn = 0.15f;
        float cooldown = 0.5f;
        float retarget;
        Zombie current;

        protected abstract Bolt.Options BoltOptions { get; }
        protected virtual float Spread => 0.006f;

        /// <summary>Extra score bias (lower = preferred). Ballistas prefer armour and rams.</summary>
        protected virtual float Preference(Zombie z) => 1f;

        void Update()
        {
            if (!Active)
            {
                current = null;
                return;
            }

            var dt = Time.deltaTime;
            var st = Stats;
            cooldown -= dt;
            retarget -= dt;
            if (current == null || !current.Alive || !InRange(current, st) || retarget <= 0f)
            {
                current = PickTarget(director.Spawner.Alive, st);
                retarget = 1.0f;
            }

            if (current == null) return;
            var from = muzzle.position;
            if (!Ballistics.Solve(from, current.ChestPosition, current.Velocity, st.projectileSpeed, out var dir)) return;
            var flat = new Vector3(dir.x, 0, dir.z);
            var wantYaw = Quaternion.LookRotation(flat.sqrMagnitude > 1e-4f ? flat : Vector3.forward);
            yaw.rotation = Quaternion.RotateTowards(yaw.rotation, wantYaw, slewYaw * dt);
            var wantPitch = -Mathf.Asin(Mathf.Clamp(dir.y, -1f, 1f)) * Mathf.Rad2Deg;
            pitch.localRotation = Quaternion.RotateTowards(pitch.localRotation, Quaternion.Euler(wantPitch, 0, 0), slewPitch * dt);
            var drawn = Mathf.Clamp01(1f - cooldown / st.interval);
            if (stringT != null) stringT.localPosition = new Vector3(0, stringT.localPosition.y, Mathf.Lerp(stringRest, stringDrawn, drawn));
            bow?.Set(drawn);

            var aligned = Vector3.Angle(muzzle.forward, dir) < 2.5f;
            if (cooldown <= 0f && aligned)
            {
                cooldown = st.interval;
                Shots++;
                var spread = Random.insideUnitSphere * Spread;
                var opt = BoltOptions;
                opt.Owner = this;
                Bolt.Fire(from, (dir + spread).normalized, st.projectileSpeed, st.damage, DamageSource.Turret, opt);
            }
        }

        bool InRange(Zombie z, TurretTier st) => (z.ChestPosition - muzzle.position).sqrMagnitude < st.range * st.range;

        Zombie PickTarget(List<Zombie> alive, TurretTier st)
        {
            Zombie best = null;
            var bestScore = float.MaxValue;
            foreach (var z in alive)
            {
                if (!z.Alive || !InRange(z, st)) continue;
                var score = ThreatScore(z) * Preference(z);
                if (score >= bestScore) continue;
                if (!Clear(muzzle.position, z.ChestPosition)) continue;
                best = z;
                bestScore = score;
            }

            return best;
        }
    }
}
