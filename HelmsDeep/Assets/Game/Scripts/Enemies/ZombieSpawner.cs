using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Pools zombies and places them in the valley spawn zone.</summary>
    public sealed class ZombieSpawner
    {
        readonly Transform root;
        readonly MaterialLibrary lib;
        readonly Stack<Zombie> pool = new Stack<Zombie>();
        public readonly List<Zombie> Alive = new List<Zombie>();
        public int ActiveCount { get; private set; }

        public ZombieSpawner(Transform root, MaterialLibrary lib, int prewarm)
        {
            this.root = root;
            this.lib = lib;
            for (var i = 0; i < prewarm; i++) pool.Push(Zombie.Create(root, lib));
        }

        public Zombie Spawn(SiegeDirector director, Vector3 at, Vector3 target)
        {
            var z = pool.Count > 0 ? pool.Pop() : Zombie.Create(root, lib);
            if (!z.Spawn(director, at, target))
            {
                pool.Push(z);
                return null;
            }

            Alive.Add(z);
            ActiveCount++;
            return z;
        }

        public void OnKilled(Zombie z) => Alive.Remove(z);

        public void OnDespawned(Zombie z)
        {
            Alive.Remove(z);
            ActiveCount--;
            pool.Push(z);
        }
    }
}
