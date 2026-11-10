using UnityEngine;

namespace MarrowRoad
{
    public struct HitInfo
    {
        public float Damage;
        public Vector3 Point;
        public Vector3 Direction;
        public DamageSource Source;
        public bool Headshot;
    }

    public interface IDamageable
    {
        bool Alive { get; }
        void TakeHit(in HitInfo hit);
    }
}
