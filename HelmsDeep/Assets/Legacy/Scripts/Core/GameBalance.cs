using UnityEngine;

namespace HelmsDeep
{
    /// <summary>
    /// Balance locked from the web Helms Deep prototype.
    /// Keep numbers here so design iteration stays out of scene objects.
    /// </summary>
    public static class GameBalance
    {
        public const int StartGold = 220;
        public const float StartGateHp = 1000f;
        public const int TotalWaves = 10;
        public const float PrepSeconds = 18f;
        public const float WallY = 22f;
        public const float GateZ = -28f;
        public const float SpawnZ = -95f;

        public static readonly TurretSpec[] Turrets =
        {
            new()
            {
                Type = TurretType.Repeater,
                Name = "Wall Crossbow",
                Cost = 100,
                Damage = 24f,
                Rate = 2.6f,
                Range = 70f,
                Blurb = "Rapid automated bolts that thin runners."
            },
            new()
            {
                Type = TurretType.Oil,
                Name = "Boiling Pitch",
                Cost = 160,
                Damage = 80f,
                Rate = 0.65f,
                Range = 26f,
                Blurb = "Dumps flaming oil onto enemies at the gate."
            },
            new()
            {
                Type = TurretType.Mortar,
                Name = "Deep Wall Catapult",
                Cost = 220,
                Damage = 155f,
                Rate = 0.48f,
                Range = 105f,
                Blurb = "Lobs brimstone into the center of the valley."
            },
            new()
            {
                Type = TurretType.Ballista,
                Name = "Harpoon Ballista",
                Cost = 280,
                Damage = 280f,
                Rate = 0.6f,
                Range = 120f,
                Blurb = "High-caliber harpoons that pierce armored brutes."
            },
        };

        public static readonly AbilitySpec[] Abilities =
        {
            new() { Id = AbilityId.OilDump, Name = "Boiling Pitch Dump", Hotkey = "1", Cooldown = 15f },
            new() { Id = AbilityId.CatapultBarrage, Name = "Catapult Volley", Hotkey = "2", Cooldown = 20f },
            new() { Id = AbilityId.HornOfHelm, Name = "Horn of Helm", Hotkey = "3", Cooldown = 28f },
            new() { Id = AbilityId.ArcherVolley, Name = "Archer Volley", Hotkey = "4", Cooldown = 14f },
        };

        public static ZombieSpec GetZombie(ZombieType type) => type switch
        {
            ZombieType.Runner => new ZombieSpec
            {
                Type = type,
                Name = "Feral Runner",
                Hp = 55f,
                Speed = 9.5f,
                Gold = 8,
                Damage = 8f,
                Radius = 0.55f,
                Color = new Color(0.55f, 0.72f, 0.35f)
            },
            ZombieType.Shambler => new ZombieSpec
            {
                Type = type,
                Name = "Shielded Shambler",
                Hp = 140f,
                Speed = 4.2f,
                Gold = 14,
                Damage = 16f,
                Radius = 0.7f,
                HasShield = true,
                ShieldHp = 45f,
                Color = new Color(0.45f, 0.48f, 0.42f)
            },
            ZombieType.Brute => new ZombieSpec
            {
                Type = type,
                Name = "Armored Brute",
                Hp = 420f,
                Speed = 3.1f,
                Gold = 35,
                Damage = 42f,
                Radius = 1.1f,
                Color = new Color(0.55f, 0.28f, 0.18f)
            },
            ZombieType.Banshee => new ZombieSpec
            {
                Type = type,
                Name = "Barrow Banshee",
                Hp = 180f,
                Speed = 5.4f,
                Gold = 28,
                Damage = 22f,
                Radius = 0.65f,
                Color = new Color(0.35f, 0.55f, 0.75f)
            },
            ZombieType.Sapper => new ZombieSpec
            {
                Type = type,
                Name = "Bomb Sapper",
                Hp = 95f,
                Speed = 6.8f,
                Gold = 22,
                Damage = 90f,
                Radius = 0.6f,
                Color = new Color(0.85f, 0.55f, 0.15f)
            },
            ZombieType.Warlord => new ZombieSpec
            {
                Type = type,
                Name = "Siege Warlord",
                Hp = 1800f,
                Speed = 2.6f,
                Gold = 180,
                Damage = 70f,
                Radius = 1.5f,
                Color = new Color(0.7f, 0.12f, 0.12f)
            },
            _ => new ZombieSpec
            {
                Type = ZombieType.Ram,
                Name = "Siege Ram",
                Hp = 900f,
                Speed = 2.2f,
                Gold = 90,
                Damage = 110f,
                Radius = 1.4f,
                Color = new Color(0.35f, 0.25f, 0.18f)
            }
        };

        public static TurretSpec GetTurret(TurretType type)
        {
            foreach (var t in Turrets)
            {
                if (t.Type == type) return t;
            }

            return Turrets[0];
        }
    }
}
