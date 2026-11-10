using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>Pools enemies per archetype and places them in the valley spawn zone.</summary>
    public sealed class ZombieSpawner
    {
        readonly Transform root;
        readonly MaterialLibrary lib;
        readonly Balance balance;
        readonly Dictionary<string, Stack<Zombie>> pools = new Dictionary<string, Stack<Zombie>>();
        public readonly List<Zombie> Alive = new List<Zombie>();
        public int ActiveCount { get; private set; }
        public int PeakActive { get; private set; }

        public ZombieSpawner(Transform root, MaterialLibrary lib, Balance balance)
        {
            this.root = root;
            this.lib = lib;
            this.balance = balance;
        }

        /// <summary>Build bodies up front (per archetype, the largest count any single wave needs, capped).</summary>
        public void Prewarm(int cap)
        {
            var need = new Dictionary<string, int>();
            foreach (var w in balance.waves)
            foreach (var g in w.groups)
            {
                need.TryGetValue(g.type, out var n);
                need[g.type] = Mathf.Max(n, g.count);
            }

            foreach (var kv in need)
            {
                var def = balance.Enemy(kv.Key);
                if (def == null) continue;
                var pool = Pool(kv.Key);
                var count = Mathf.Min(kv.Value, cap);
                for (var i = pool.Count; i < count; i++) pool.Push(Zombie.Create(root, lib, def));
            }
        }

        Stack<Zombie> Pool(string id)
        {
            if (!pools.TryGetValue(id, out var p))
            {
                p = new Stack<Zombie>();
                pools[id] = p;
            }

            return p;
        }

        public Zombie Spawn(SiegeDirector director, string type, Vector3 at)
        {
            var def = balance.Enemy(type);
            if (def == null)
            {
                Debug.LogError("[MarrowRoad] Unknown enemy type in balance.json: " + type);
                return null;
            }

            var pool = Pool(type);
            var z = pool.Count > 0 ? pool.Pop() : Zombie.Create(root, lib, def);
            if (!z.Spawn(director, at))
            {
                pool.Push(z);
                return null;
            }

            Alive.Add(z);
            ActiveCount++;
            PeakActive = Mathf.Max(PeakActive, ActiveCount);
            return z;
        }

        public void OnKilled(Zombie z) => Alive.Remove(z);

        public void OnDespawned(Zombie z)
        {
            Alive.Remove(z);
            ActiveCount--;
            Pool(z.Def.id).Push(z);
        }
    }
}
