using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Holds material assets created by the editor builder, so runtime code never calls Shader.Find
    /// (shaders that are only referenced by name get stripped from player builds).
    /// </summary>
    public sealed class MaterialLibrary : MonoBehaviour
    {
        public Material ground, rock, wall, tower, road, dark;
        public Material wood, metal, rope, zombieSkin, zombieCloth, zombieWound, dummy, socket, gate;
        public Material flame, trail, ghost;

        public static MaterialLibrary Instance { get; private set; }

        void Awake() => Instance = this;

        public Material ForKind(string kind)
        {
            switch (kind)
            {
                case "ground": return ground;
                case "rock": return rock;
                case "tower": return tower;
                case "road": return road;
                case "dark": return dark;
                default: return wall;
            }
        }
    }
}
