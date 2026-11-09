namespace HelmsDeep
{
    public enum GamePhase
    {
        Title,
        Preparing,
        Wave,
        Victory,
        Defeat
    }

    public enum ZombieType
    {
        Runner,
        Shambler,
        Brute,
        Banshee,
        Sapper,
        Warlord,
        Ram
    }

    public enum TurretType
    {
        Repeater,
        Oil,
        Mortar,
        Ballista
    }

    public enum BoltAmmoType
    {
        Bodkin,
        Fire,
        Frost,
        Scatter
    }

    public enum AbilityId
    {
        OilDump,
        CatapultBarrage,
        HornOfHelm,
        ArcherVolley
    }

    [System.Serializable]
    public struct ZombieSpec
    {
        public ZombieType Type;
        public string Name;
        public float Hp;
        public float Speed;
        public int Gold;
        public float Damage;
        public float Radius;
        public bool HasShield;
        public float ShieldHp;
        public UnityEngine.Color Color;
    }

    [System.Serializable]
    public struct TurretSpec
    {
        public TurretType Type;
        public string Name;
        public int Cost;
        public float Damage;
        public float Rate;
        public float Range;
        public string Blurb;
    }

    [System.Serializable]
    public struct AbilitySpec
    {
        public AbilityId Id;
        public string Name;
        public string Hotkey;
        public float Cooldown;
    }
}
