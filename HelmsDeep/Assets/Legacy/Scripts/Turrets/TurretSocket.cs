using UnityEngine;

namespace HelmsDeep
{
    public sealed class TurretSocket : MonoBehaviour
    {
        public int Id { get; private set; }
        public string SocketName { get; private set; }
        public TurretType? BuiltType { get; private set; }
        public int Level { get; private set; }

        GameObject _turretVisual;
        float _cooldown;

        public void Configure(int id, string socketName)
        {
            Id = id;
            SocketName = socketName;
        }

        public void ResetSocket()
        {
            BuiltType = null;
            Level = 0;
            _cooldown = 0f;
            if (_turretVisual != null) Destroy(_turretVisual);
            BattlementBuilder.SetColor(gameObject, new Color(0.55f, 0.42f, 0.18f));
        }

        public void SetHighlight(bool on)
        {
            if (BuiltType != null) return;
            BattlementBuilder.SetColor(gameObject, on
                ? new Color(0.95f, 0.8f, 0.25f)
                : new Color(0.55f, 0.42f, 0.18f));
        }

        public bool TryBuild(TurretType type)
        {
            var game = SiegeGame.Instance;
            if (game == null) return false;
            if (BuiltType != null) return false;

            var spec = GameBalance.GetTurret(type);
            if (!game.TrySpend(spec.Cost)) return false;

            BuiltType = type;
            Level = 1;
            if (_turretVisual != null) Destroy(_turretVisual);
            _turretVisual = BuildTurretVisual(type, spec.Name);
            SiegeAudio.Instance?.PlayBuild();
            CombatFeedback.Instance?.SpawnImpact(transform.position + Vector3.up, VisualPalette.Gold);
            return true;
        }

        GameObject BuildTurretVisual(TurretType type, string name)
        {
            var root = new GameObject(name);
            root.transform.SetParent(transform, false);
            root.transform.localPosition = Vector3.zero;

            switch (type)
            {
                case TurretType.Oil:
                    Proc.Cyl("Cauldron", root.transform, new Vector3(0f, 0.9f, 0f), new Vector3(1.4f, 0.55f, 1.4f), VisualPalette.Iron);
                    Proc.Sphere("Pitch", root.transform, new Vector3(0f, 1.15f, 0f), Vector3.one * 0.9f, new Color(0.95f, 0.35f, 0.05f));
                    BattlementBuilder.SetEmissive(root.transform.Find("Pitch").gameObject, new Color(1f, 0.4f, 0.05f), 1.6f);
                    Proc.Point("OilGlow", root.transform, new Vector3(0f, 1.3f, 0f), VisualPalette.Torch, 8f, 1.8f);
                    break;
                case TurretType.Mortar:
                    Proc.Box("Base", root.transform, new Vector3(0f, 0.4f, 0f), new Vector3(1.4f, 0.5f, 1.4f), VisualPalette.Wood);
                    Proc.Cyl("Tube", root.transform, new Vector3(0f, 1.1f, 0.2f), new Vector3(0.55f, 0.7f, 0.55f), VisualPalette.Stone,
                        Quaternion.Euler(55f, 0f, 0f));
                    break;
                case TurretType.Ballista:
                    Proc.Box("Carriage", root.transform, new Vector3(0f, 0.55f, 0f), new Vector3(1.2f, 0.45f, 1.8f), VisualPalette.WoodLight);
                    Proc.Box("ArmL", root.transform, new Vector3(-0.7f, 1.0f, 0.3f), new Vector3(1.1f, 0.12f, 0.12f), VisualPalette.Wood);
                    Proc.Box("ArmR", root.transform, new Vector3(0.7f, 1.0f, 0.3f), new Vector3(1.1f, 0.12f, 0.12f), VisualPalette.Wood);
                    Proc.Cyl("Harpoon", root.transform, new Vector3(0f, 1.05f, 0.6f), new Vector3(0.08f, 0.7f, 0.08f), VisualPalette.Iron,
                        Quaternion.Euler(90f, 0f, 0f));
                    break;
                default:
                    Proc.Cyl("Pedestal", root.transform, new Vector3(0f, 0.55f, 0f), new Vector3(0.9f, 0.55f, 0.9f), VisualPalette.Stone);
                    Proc.Box("Bow", root.transform, new Vector3(0f, 1.25f, 0.15f), new Vector3(1.6f, 0.12f, 0.2f), VisualPalette.WoodLight);
                    Proc.Cyl("Bolt", root.transform, new Vector3(0f, 1.3f, 0.55f), new Vector3(0.06f, 0.45f, 0.06f), VisualPalette.Gold,
                        Quaternion.Euler(90f, 0f, 0f));
                    break;
            }

            foreach (var col in root.GetComponentsInChildren<Collider>())
            {
                if (col != null) Destroy(col);
            }

            return root;
        }

        void Update()
        {
            if (BuiltType == null) return;
            if (SiegeGame.Instance == null || SiegeGame.Instance.Phase != GamePhase.Wave) return;

            _cooldown -= Time.deltaTime;
            if (_cooldown > 0f) return;

            var spec = GameBalance.GetTurret(BuiltType.Value);
            var target = FindTarget(spec.Range);
            if (target == null) return;

            _cooldown = 1f / spec.Rate;
            target.ApplyDamage(spec.Damage * (1f + 0.2f * (Level - 1)), false,
                BuiltType == TurretType.Oil ? BoltAmmoType.Fire : BoltAmmoType.Bodkin);
        }

        EnemyUnit FindTarget(float range)
        {
            EnemyUnit best = null;
            var bestZ = float.PositiveInfinity;
            foreach (var enemy in FindObjectsByType<EnemyUnit>(FindObjectsSortMode.None))
            {
                if (enemy == null || enemy.IsDead) continue;
                var d = Vector3.Distance(transform.position, enemy.transform.position);
                if (d > range) continue;
                if (enemy.transform.position.z < bestZ)
                {
                    bestZ = enemy.transform.position.z;
                    best = enemy;
                }
            }

            return best;
        }
    }
}
