using UnityEngine;

namespace HelmsDeep
{
    /// <summary>
    /// Plays the siege without a human: strafe, aim nearest threat, shoot,
    /// spend gold on turrets, dump abilities, call waves early when ready.
    /// </summary>
    public sealed class AutopilotController : MonoBehaviour
    {
        public static AutopilotController Instance { get; private set; }

        WallDefender _defender;
        TurretGrid _turrets;
        float _buildTimer;
        float _abilityTimer;
        float _bootTimer = 0.2f;
        bool _started;
        int _lastLoggedWave = -1;
        int _startAttempts;

        public bool Active { get; private set; }

        public void Configure(WallDefender defender, TurretGrid turrets)
        {
            _defender = defender;
            _turrets = turrets;
        }

        public void Activate()
        {
            Active = true;
            Instance = this;
            if (_defender != null) _defender.AutopilotOwned = true;
            GameplayRecorder.Instance?.LogEvent("autopilot_on");
            Debug.Log("[Autopilot] Active");
        }

        void Update()
        {
            if (!Active || _defender == null) return;
            var game = SiegeGame.Instance;
            if (game == null) return;

            _bootTimer -= Time.unscaledDeltaTime;
            if (game.Phase == GamePhase.Title && _bootTimer <= 0f)
            {
                _startAttempts++;
                _defender.BeginFromTitleOrRetry(game);
                if (!_started)
                {
                    _started = true;
                    GameplayRecorder.Instance?.LogEvent("autopilot_begin_siege");
                    Debug.Log($"[Autopilot] BeginSiege attempt #{_startAttempts} → {game.Phase}");
                }

                // Keep retrying title until the phase actually advances.
                if (game.Phase == GamePhase.Title)
                {
                    _bootTimer = 0.5f;
                    return;
                }
            }

            if (game.Phase is GamePhase.Victory or GamePhase.Defeat) return;
            if (game.Phase == GamePhase.Title) return;

            if (game.Wave != _lastLoggedWave)
            {
                _lastLoggedWave = game.Wave;
                GameplayRecorder.Instance?.LogEvent($"autopilot_wave={game.Wave} phase={game.Phase}");
            }

            ManageEconomy(game);
            ManageAbilities(game);
            Fight(game);

            if (game.Phase == GamePhase.Preparing && game.PrepRemaining < 8f)
            {
                // Spend first, then pull the wave once sockets are seeded.
                if (_turrets != null && CountBuilt() >= Mathf.Min(2, _turrets.Sockets.Length))
                {
                    game.CallWaveEarly();
                    GameplayRecorder.Instance?.LogEvent("autopilot_call_wave");
                }
            }
        }

        void ManageEconomy(SiegeGame game)
        {
            if (_turrets == null || _turrets.Sockets.Length == 0) return;
            _buildTimer -= Time.deltaTime;
            if (_buildTimer > 0f) return;
            _buildTimer = 0.45f;

            // Prefer empty sockets near center first, then flanks.
            var order = new[] { 1, 2, 4, 0, 3 };
            foreach (var id in order)
            {
                if (id >= _turrets.Sockets.Length) continue;
                var socket = _turrets.Sockets[id];
                if (socket == null || socket.BuiltType != null) continue;

                var pick = PickTurret(game.Gold, id);
                if (pick == null) continue;
                _defender.SelectSocket(id);
                if (_defender.TryBuildSelected(pick.Value))
                {
                    GameplayRecorder.Instance?.LogEvent($"autopilot_build socket={id} type={pick.Value}");
                    return;
                }
            }
        }

        static TurretType? PickTurret(int gold, int socketId)
        {
            // Gate bastions get oil; outer pads get range.
            if (socketId is 1 or 2)
            {
                if (gold >= GameBalance.GetTurret(TurretType.Oil).Cost) return TurretType.Oil;
                if (gold >= GameBalance.GetTurret(TurretType.Repeater).Cost) return TurretType.Repeater;
                return null;
            }

            if (gold >= GameBalance.GetTurret(TurretType.Ballista).Cost) return TurretType.Ballista;
            if (gold >= GameBalance.GetTurret(TurretType.Mortar).Cost) return TurretType.Mortar;
            if (gold >= GameBalance.GetTurret(TurretType.Repeater).Cost) return TurretType.Repeater;
            return null;
        }

        int CountBuilt()
        {
            var n = 0;
            foreach (var s in _turrets.Sockets)
            {
                if (s != null && s.BuiltType != null) n++;
            }

            return n;
        }

        void ManageAbilities(SiegeGame game)
        {
            if (game.Phase != GamePhase.Wave) return;
            _abilityTimer -= Time.deltaTime;
            if (_abilityTimer > 0f) return;
            _abilityTimer = 1.2f;

            if (game.EnemiesAlive >= 8 && game.TryUseAbility(AbilityId.CatapultBarrage))
            {
                GameplayRecorder.Instance?.LogEvent("autopilot_ability=catapult");
                return;
            }

            if (game.GateHp < game.MaxGateHp * 0.55f && game.TryUseAbility(AbilityId.OilDump))
            {
                GameplayRecorder.Instance?.LogEvent("autopilot_ability=oil");
                return;
            }

            if (game.EnemiesAlive >= 12 && game.TryUseAbility(AbilityId.HornOfHelm))
            {
                GameplayRecorder.Instance?.LogEvent("autopilot_ability=horn");
                return;
            }

            if (game.TryUseAbility(AbilityId.ArcherVolley))
            {
                GameplayRecorder.Instance?.LogEvent("autopilot_ability=volley");
            }
        }

        void Fight(SiegeGame game)
        {
            if (game.Phase != GamePhase.Wave && game.Phase != GamePhase.Preparing) return;

            // Prefer nearby live powder barrels when a pack is close
            var barrel = FindJuicyBarrel();
            if (barrel != null)
            {
                _defender.SetAmmo(BoltAmmoType.Fire);
                var aim = barrel.transform.position + Vector3.up * 0.6f;
                _defender.StrafeToward(barrel.transform.position.x);
                _defender.LookToward(aim, turnRate: 12f);
                TryShoot(aim);
                return;
            }

            var target = FindPriorityTarget();
            if (target == null)
            {
                _defender.SetAiming(false);
                _defender.StrafeToward(0f);
                return;
            }

            if (target.name.Contains("Brute") || target.name.Contains("Ram") || target.name.Contains("Warlord"))
                _defender.SetAmmo(BoltAmmoType.Frost);
            else if (game.EnemiesAlive >= 8)
                _defender.SetAmmo(BoltAmmoType.Fire);
            else
                _defender.SetAmmo(BoltAmmoType.Bodkin);

            var aimPoint = target.transform.position + Vector3.up * (target.Height * 0.85f);
            _defender.StrafeToward(target.transform.position.x);
            _defender.LookToward(aimPoint, turnRate: 12f);
            TryShoot(aimPoint);
        }

        void TryShoot(Vector3 aimPoint)
        {
            var cam = _defender.ViewCamera;
            if (cam == null) return;
            var to = (aimPoint - cam.transform.position).normalized;
            if (Vector3.Dot(cam.transform.forward, to) > 0.9f)
            {
                _defender.TryFire();
            }
        }

        static PowderBarrel FindJuicyBarrel()
        {
            PowderBarrel best = null;
            var bestCount = 0;
            foreach (var barrel in FindObjectsByType<PowderBarrel>(FindObjectsSortMode.None))
            {
                if (barrel == null || barrel.Detonated) continue;
                var nearby = 0;
                foreach (var enemy in FindObjectsByType<EnemyUnit>(FindObjectsSortMode.None))
                {
                    if (enemy == null || enemy.IsDead) continue;
                    if (Vector3.Distance(enemy.transform.position, barrel.transform.position) < barrel.Radius)
                        nearby++;
                }

                if (nearby >= 3 && nearby > bestCount)
                {
                    bestCount = nearby;
                    best = barrel;
                }
            }

            return best;
        }

        static EnemyUnit FindPriorityTarget()
        {
            EnemyUnit best = null;
            var bestScore = float.NegativeInfinity;
            foreach (var enemy in FindObjectsByType<EnemyUnit>(FindObjectsSortMode.None))
            {
                if (enemy == null || enemy.IsDead) continue;
                var score = enemy.transform.position.z * 2f;
                if (enemy.name.Contains("Brute") || enemy.name.Contains("Warlord") || enemy.name.Contains("Ram"))
                    score += 40f;
                if (enemy.name.Contains("Sapper")) score += 25f;
                score += (1f - enemy.Hp01) * 15f;
                if (score > bestScore)
                {
                    bestScore = score;
                    best = enemy;
                }
            }

            return best;
        }
    }
}

