using UnityEngine;

namespace MarrowRoad
{
    /// <summary>A build spot on the wall. The marker is a flat ring; the turret replaces it when built.</summary>
    public sealed class TurretSocket : MonoBehaviour
    {
        public string socketName;
        /// <summary>Turret ids this socket accepts, in menu order (keys 1..n). Empty = everything except pitch.</summary>
        public string[] allow = System.Array.Empty<string>();
        public Turret Turret { get; set; }
        public bool Occupied => Turret != null;

        public bool Allows(string id)
        {
            if (allow == null || allow.Length == 0) return id != "pitch";
            foreach (var a in allow)
                if (a == id) return true;
            return false;
        }
    }
}
