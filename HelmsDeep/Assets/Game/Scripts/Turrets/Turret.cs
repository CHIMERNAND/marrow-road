using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Base for every wall engine. Holds its <see cref="TurretDef"/> from balance.json and the current tier;
    /// subclasses read <see cref="Stats"/> every shot so upgrades take effect immediately.
    /// </summary>
    public abstract class Turret : MonoBehaviour
    {
        public TurretDef Def { get; private set; }
        public int Tier { get; private set; }
        public TurretSocket Socket { get; private set; }
        public int Kills { get; set; }
        public int Shots { get; protected set; }
        protected SiegeDirector director;
        Transform tierMarks;

        public TurretTier Stats => Def.tiers[Mathf.Clamp(Tier, 0, Def.tiers.Length - 1)];
        public bool CanUpgrade => Tier + 1 < Def.tiers.Length;
        public int UpgradeCost => CanUpgrade ? Def.tiers[Tier + 1].cost : 0;
        protected bool Active => director != null && director.State.Phase == SiegePhase.Wave;

        public static Turret Build(string id, TurretSocket socket, SiegeDirector director)
        {
            var def = director.Balance.Turret(id);
            if (def == null || def.tiers.Length == 0) return null;
            var go = new GameObject(def.name + "_" + socket.socketName);
            go.transform.SetPositionAndRotation(socket.transform.position, Quaternion.identity);
            Turret t;
            switch (id)
            {
                case "ballista": t = go.AddComponent<BallistaTurret>(); break;
                case "catapult": t = go.AddComponent<CatapultTurret>(); break;
                case "pitch": t = go.AddComponent<PitchTurret>(); break;
                default: t = go.AddComponent<WallCrossbowTurret>(); break;
            }

            t.Def = def;
            t.Socket = socket;
            t.director = director;
            t.BuildModel(MaterialLibrary.Instance);
            t.tierMarks = new GameObject("TierMarks").transform;
            t.tierMarks.SetParent(go.transform, false);
            t.RefreshTierMarks();
            socket.Turret = t;
            return t;
        }

        public void Upgrade()
        {
            if (!CanUpgrade) return;
            Tier++;
            RefreshTierMarks();
            OnUpgraded();
        }

        protected abstract void BuildModel(MaterialLibrary lib);

        protected virtual void OnUpgraded()
        {
        }

        /// <summary>Brass bands on the base, one per tier, so the tier reads from across the wall.</summary>
        void RefreshTierMarks()
        {
            foreach (Transform c in tierMarks) Destroy(c.gameObject);
            var lib = MaterialLibrary.Instance;
            for (var i = 0; i <= Tier; i++)
                Part(tierMarks, new Vector3(0.78f, 0.25f + i * 0.18f, 0.78f), new Vector3(0.16f, 0.1f, 0.16f), lib != null ? lib.flame : null, false);
        }

        public static Transform Part(Transform parent, Vector3 pos, Vector3 size, Material m, bool collide, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            go.layer = 2;
            if (!collide) Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            if (m != null) go.GetComponent<MeshRenderer>().sharedMaterial = m;
            return go.transform;
        }

        /// <summary>Clear line from <paramref name="from"/> to <paramref name="to"/> through level geometry (triggers ignored).</summary>
        protected static bool Clear(Vector3 from, Vector3 to)
        {
            var d = to - from;
            var len = d.magnitude;
            if (len < 0.6f) return true;
            return !Physics.Raycast(from, d / len, len - 0.5f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
        }

        /// <summary>Lowest score wins: distance of the enemy to whichever door the dead are assaulting.</summary>
        protected float ThreatScore(Zombie z)
        {
            var door = director.State.GateBreached ? director.KeepTarget : director.GateTarget;
            var s = (z.transform.position - door).sqrMagnitude;
            if (z.OnLadder || z.OnWall) s *= 0.25f; // climbers on the wall are urgent
            return s;
        }
    }
}
