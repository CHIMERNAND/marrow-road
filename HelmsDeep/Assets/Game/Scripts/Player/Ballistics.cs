using UnityEngine;

namespace MarrowRoad
{
    public static class Ballistics
    {
        public const float Gravity = 9.81f;

        /// <summary>Angle (degrees) a flat-fired projectile has dropped below the bore line at a given range.</summary>
        public static float DropAngleDeg(float range, float speed)
        {
            var t = range / speed;
            var drop = 0.5f * Gravity * t * t;
            return Mathf.Atan2(drop, range) * Mathf.Rad2Deg;
        }

        /// <summary>
        /// Launch direction to hit a (possibly moving) target with a gravity-affected projectile.
        /// Uses the low arc and iterates time-of-flight for lead. Returns false when out of range.
        /// </summary>
        public static bool Solve(Vector3 from, Vector3 target, Vector3 targetVel, float speed, out Vector3 dir)
        {
            var aim = target;
            dir = (target - from).normalized;
            for (var iter = 0; iter < 4; iter++)
            {
                var d = aim - from;
                var flat = new Vector3(d.x, 0, d.z);
                var x = flat.magnitude;
                var y = d.y;
                var v2 = speed * speed;
                var disc = v2 * v2 - Gravity * (Gravity * x * x + 2 * y * v2);
                if (disc < 0) return false;
                var ang = Mathf.Atan2(v2 - Mathf.Sqrt(disc), Gravity * x);
                var flatDir = x > 0.001f ? flat / x : Vector3.forward;
                dir = flatDir * Mathf.Cos(ang) + Vector3.up * Mathf.Sin(ang);
                var tof = x / Mathf.Max(0.01f, speed * Mathf.Cos(ang));
                aim = target + targetVel * tof;
            }

            return true;
        }
    }
}
