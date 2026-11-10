using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Trigger collider that routes bolt hits to its owner with a damage multiplier.</summary>
    public sealed class Hitbox : MonoBehaviour
    {
        public float multiplier = 1f;
        public bool isHead;
        public bool armored;
        public IDamageable Owner;
    }
}
