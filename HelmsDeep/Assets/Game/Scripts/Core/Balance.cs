using System;
using System.Collections.Generic;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Every gameplay number that a designer tunes: enemies, turrets and their upgrade tiers, the ten waves,
    /// gate/keep HP, gold and timings. Lives in Assets/Game/Data/balance.json so balance changes are
    /// diffable text and never need a code change. Loaded once by the director (host-authoritative in co-op).
    /// </summary>
    [Serializable]
    public sealed class Balance
    {
        public int version = 1;
        public GateBalance gate = new GateBalance();
        public GateBalance keep = new GateBalance { hp = 1500f, slots = 8 };
        public EconomyBalance economy = new EconomyBalance();
        public PlayerBalance player = new PlayerBalance();
        public PrepBalance prep = new PrepBalance();
        public int maxAlive = 90;
        public EnemyDef[] enemies = Array.Empty<EnemyDef>();
        public TurretDef[] turrets = Array.Empty<TurretDef>();
        public WaveDef[] waves = Array.Empty<WaveDef>();

        [NonSerialized] Dictionary<string, EnemyDef> enemyById;
        [NonSerialized] Dictionary<string, TurretDef> turretById;

        public int TotalWaves => waves.Length;

        public static Balance FromJson(string json)
        {
            var b = JsonUtility.FromJson<Balance>(json) ?? new Balance();
            b.Index();
            return b;
        }

        void Index()
        {
            enemyById = new Dictionary<string, EnemyDef>();
            foreach (var e in enemies) enemyById[e.id] = e;
            turretById = new Dictionary<string, TurretDef>();
            foreach (var t in turrets) turretById[t.id] = t;
        }

        public EnemyDef Enemy(string id)
        {
            if (enemyById == null) Index();
            return enemyById.TryGetValue(id, out var e) ? e : null;
        }

        public TurretDef Turret(string id)
        {
            if (turretById == null) Index();
            return turretById.TryGetValue(id, out var t) ? t : null;
        }

        public WaveDef Wave(int wave) => wave >= 1 && wave <= waves.Length ? waves[wave - 1] : null;
    }

    [Serializable]
    public sealed class GateBalance
    {
        public float hp = 2500f;
        public int slots = 10;
    }

    [Serializable]
    public sealed class EconomyBalance
    {
        public int startGold = 250;
        public int headshotBonus = 5;
        public int waveClearBase = 40;
        public int waveClearPerWave = 10;
        public int ladderShoveGold = 0;
        public int repairCost = 75;
        public float repairAmount = 300f;
    }

    [Serializable]
    public sealed class PlayerBalance
    {
        public float hp = 100f;
        public float respawnSeconds = 8f;
        public float regenDelay = 5f;
        public float regenPerSecond = 8f;
    }

    [Serializable]
    public sealed class PrepBalance
    {
        public float first = 40f;
        public float between = 25f;
    }

    /// <summary>Enemy archetype. <c>kind</c> selects the body and behaviour; the rest are tunables.</summary>
    [Serializable]
    public sealed class EnemyDef
    {
        public string id;
        public string name;
        public string kind; // shambler | runner | brute | climber | ram
        public float hp = 100f;
        public float speedMin = 1.3f, speedMax = 2.0f;
        public float scale = 1f;
        public float gateDps = 2f;
        /// <summary>Damage multiplier on armoured hitboxes for non-piercing hits (0.35 = takes 35%).</summary>
        public float armor = 1f;
        public int gold = 8;
        public float meleeDamage = 0f;
        public float meleeInterval = 1.3f;
        public float climbSpeed = 1.4f;
        /// <summary>Ram crews: damage per ram strike and seconds between strikes. Ignore gate slots.</summary>
        public float ramDamage = 0f;
        public float ramInterval = 2.4f;
    }

    [Serializable]
    public sealed class TurretDef
    {
        public string id;
        public string name;
        public string blurb;
        public TurretTier[] tiers = Array.Empty<TurretTier>();
    }

    /// <summary>Stats for one tier. Tier 0 <c>cost</c> is the build price; later tiers are upgrade prices.</summary>
    [Serializable]
    public sealed class TurretTier
    {
        public int cost;
        public float damage;
        public float interval = 1.6f;
        public float range = 90f;
        public float minRange;
        public float splash;
        public int pierce;
        public float duration;
        public float projectileSpeed = 85f;
    }

    [Serializable]
    public sealed class WaveDef
    {
        public float spawnInterval = 1f;
        public WaveGroup[] groups = Array.Empty<WaveGroup>();

        public int Total
        {
            get
            {
                var n = 0;
                foreach (var g in groups) n += g.count;
                return n;
            }
        }
    }

    [Serializable]
    public sealed class WaveGroup
    {
        public string type;
        public int count;
    }
}
