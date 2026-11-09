using UnityEngine;

namespace MarrowRoad
{
    /// <summary>A build spot on the wall. The marker is a flat ring; the turret replaces it when built.</summary>
    public sealed class TurretSocket : MonoBehaviour
    {
        public string socketName;
        public WallCrossbowTurret Turret { get; set; }
        public bool Occupied => Turret != null;
    }
}
