using System;
using System.Collections.Generic;
using UnityEngine;

namespace HelmsDeep
{
    public sealed class SiegeGame : MonoBehaviour
    {
        public static SiegeGame Instance { get; private set; }

        public GamePhase Phase { get; private set; } = GamePhase.Title;
        public int Wave { get; private set; } = 1;
        public int Gold { get; private set; } = GameBalance.StartGold;
        public float GateHp { get; private set; } = GameBalance.StartGateHp;
        public float MaxGateHp => GameBalance.StartGateHp;
        public int Kills { get; private set; }
        public int Headshots { get; private set; }
        public float PrepRemaining { get; private set; }
        public int EnemiesAlive { get; private set; }
        public string Toast { get; private set; } = "Click to take the wall. Hold the Deep.";

        public event Action StateChanged;

        readonly Dictionary<AbilityId, float> _abilityCooldown = new();
        WaveDirector _waves;
        TurretGrid _turrets;
        GateController _gate;

        void Awake()
        {
            Instance = this;
            foreach (var ability in GameBalance.Abilities)
            {
                _abilityCooldown[ability.Id] = 0f;
            }
        }

        public void Bind(WaveDirector waves, TurretGrid turrets, GateController gate)
        {
            _waves = waves;
            _turrets = turrets;
            _gate = gate;
        }

        public void BeginSiege()
        {
            if (Phase is GamePhase.Wave or GamePhase.Preparing) return;
            Debug.Log($"[SiegeGame] BeginSiege from {Phase}");

            Phase = GamePhase.Preparing;
            Wave = 1;
            Gold = GameBalance.StartGold;
            GateHp = GameBalance.StartGateHp;
            Kills = 0;
            Headshots = 0;
            PrepRemaining = GameBalance.PrepSeconds;
            Toast = "Prep the wall. Space starts the wave early.";
            _gate?.ResetGate();
            _turrets?.ResetSockets();
            _waves?.ClearAlive();
            GameplayRecorder.Instance?.LogEvent("siege_begin");
            SiegeAudio.Instance?.PlayWaveStart();
            Notify();
        }

        public void Restart()
        {
            Phase = GamePhase.Title;
            Toast = "Click to take the wall. Hold the Deep.";
            _waves?.ClearAlive();
            Notify();
        }

        public void CallWaveEarly()
        {
            if (Phase != GamePhase.Preparing) return;
            Gold += 10;
            StartWave();
        }

        public bool TrySpend(int amount)
        {
            if (Gold < amount) return false;
            Gold -= amount;
            Notify();
            return true;
        }

        public void AddGold(int amount)
        {
            Gold += amount;
            Notify();
        }

        public void RegisterKill(bool headshot, int gold)
        {
            Kills++;
            if (headshot) Headshots++;
            AddGold(gold);
        }

        public void DamageGate(float amount)
        {
            if (Phase is GamePhase.Defeat or GamePhase.Victory) return;

            GateHp = Mathf.Max(0f, GateHp - amount);
            _gate?.SetHpNormalized(GateHp / MaxGateHp);
            if (GateHp <= 0f)
            {
                Phase = GamePhase.Defeat;
                Toast = "The gate is breached. The Deep falls.";
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
                GameplayRecorder.Instance?.LogEvent("defeat");
            }

            Notify();
        }

        public float AbilityCooldown(AbilityId id) =>
            _abilityCooldown.TryGetValue(id, out var value) ? value : 0f;

        public bool TryUseAbility(AbilityId id)
        {
            if (Phase is not (GamePhase.Wave or GamePhase.Preparing)) return false;
            if (AbilityCooldown(id) > 0f) return false;

            var spec = Array.Find(GameBalance.Abilities, a => a.Id == id);
            _abilityCooldown[id] = spec.Cooldown;
            _waves?.ApplyAbility(id);
            Toast = $"{spec.Name}!";
            SiegeAudio.Instance?.PlayAbility();
            CombatFeedback.Instance?.Shake(0.28f);
            Notify();
            return true;
        }

        public void SetEnemyCount(int count)
        {
            EnemiesAlive = count;
            if (Phase == GamePhase.Wave && count == 0 && _waves != null && !_waves.HasQueuedSpawns)
            {
                if (Wave >= GameBalance.TotalWaves)
                {
                    Phase = GamePhase.Victory;
                    Toast = "The horn sounds. The Deep holds.";
                    Cursor.lockState = CursorLockMode.None;
                    Cursor.visible = true;
                    GameplayRecorder.Instance?.LogEvent("victory");
                }
                else
                {
                    Wave++;
                    Phase = GamePhase.Preparing;
                    PrepRemaining = GameBalance.PrepSeconds;
                    Toast = $"Wave {Wave} approaches. Spend gold. Space to call early.";
                    GameplayRecorder.Instance?.LogEvent($"wave_clear next={Wave}");
                }
            }

            Notify();
        }

        void Update()
        {
            var keys = _abilityCooldown.Keys;
            var ids = new List<AbilityId>(keys);
            foreach (var id in ids)
            {
                if (_abilityCooldown[id] > 0f)
                {
                    _abilityCooldown[id] = Mathf.Max(0f, _abilityCooldown[id] - Time.deltaTime);
                }
            }

            if (Phase != GamePhase.Preparing) return;

            PrepRemaining -= Time.deltaTime;
            if (PrepRemaining <= 0f)
            {
                StartWave();
            }
            else if (Time.frameCount % 15 == 0)
            {
                Notify();
            }
        }

        void StartWave()
        {
            Phase = GamePhase.Wave;
            PrepRemaining = 0f;
            Toast = $"Wave {Wave} — hold the gate!";
            _waves?.BeginWave(Wave);
            SiegeAudio.Instance?.PlayWaveStart();
            CombatFeedback.Instance?.Shake(0.15f);
            Notify();
        }

        void Notify() => StateChanged?.Invoke();
    }
}
