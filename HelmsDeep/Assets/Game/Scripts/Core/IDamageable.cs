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
        /// <summary>Hit landed on an armoured hitbox (helmet, plate, ram log).</summary>
        public bool Armored;
        /// <summary>Ignores armour (ballista). Splash and fire never count as armoured hits.</summary>
        public bool ArmorPiercing;
        /// <summary>Who dealt it, for kill attribution: "player", "crossbow", "ballista", "catapult", "pitch", "ladder".</summary>
        public string SourceId;
        /// <summary>The turret that dealt it (null for the player and the environment).</summary>
        public Turret Owner;
    }

    public interface IDamageable
    {
        bool Alive { get; }
        void TakeHit(in HitInfo hit);
    }
}
