using System;
using System.Collections.Generic;

namespace MarrowRoad
{
    public enum SiegePhase
    {
        Title,
        Preparing,
        Wave,
        Victory,
        Defeat
    }

    public enum DamageSource
    {
        Player,
        Turret,
        Environment
    }

    /// <summary>
    /// Authoritative siege state. Plain C# (no MonoBehaviour) so a host can own it in co-op later.
    /// Everything else reads it and sends commands; nothing outside this class mutates the numbers.
    /// All starting values come from <see cref="Balance"/>.
    /// </summary>
    public sealed class SiegeState
    {
        readonly Balance balance;

        public SiegePhase Phase { get; private set; } = SiegePhase.Title;
        public int Wave { get; private set; }
        public int TotalWaves => balance.TotalWaves;
        public float MaxGateHp => balance.gate.hp;
        public float MaxKeepHp => balance.keep.hp;
        public float GateHp { get; private set; }
        public float KeepHp { get; private set; }
        /// <summary>True once the gate has fallen; the defence falls back to the keep door.</summary>
        public bool GateBreached { get; private set; }
        public int BreachWave { get; private set; }
        public int Gold { get; private set; }
        public int Kills { get; private set; }
        public int PlayerKills { get; private set; }
        public int TurretKills { get; private set; }
        public int Headshots { get; private set; }
        public int ShotsFired { get; private set; }
        public int ShotsHit { get; private set; }
        public int GoldEarned { get; private set; }
        public int GoldSpent { get; private set; }
        public float PrepRemaining { get; private set; }
        public float ElapsedSeconds { get; private set; }
        /// <summary>Kills keyed by source id: "player", "crossbow", "ballista", "catapult", "pitch", "ladder".</summary>
        public readonly Dictionary<string, int> KillsBySource = new Dictionary<string, int>();

        public event Action Changed;
        public event Action<SiegePhase> PhaseChanged;
        public event Action GateBreachedEvent;

        public SiegeState(Balance balance)
        {
            this.balance = balance;
            GateHp = MaxGateHp;
            KeepHp = MaxKeepHp;
            Gold = balance.economy.startGold;
        }

        public float Gate01 => MaxGateHp <= 0 ? 0 : GateHp / MaxGateHp;
        public float Keep01 => MaxKeepHp <= 0 ? 0 : KeepHp / MaxKeepHp;
        public float Accuracy01 => ShotsFired == 0 ? 0f : (float)ShotsHit / ShotsFired;

        public void Begin(float prepSeconds)
        {
            Wave = 0;
            GateHp = MaxGateHp;
            KeepHp = MaxKeepHp;
            GateBreached = false;
            BreachWave = 0;
            Gold = balance.economy.startGold;
            Kills = PlayerKills = TurretKills = Headshots = ShotsFired = ShotsHit = GoldEarned = GoldSpent = 0;
            KillsBySource.Clear();
            ElapsedSeconds = 0f;
            EnterPrep(prepSeconds);
        }

        public void EnterPrep(float seconds)
        {
            PrepRemaining = seconds;
            SetPhase(SiegePhase.Preparing);
        }

        /// <summary>Called when a wave is cleared: pays the clear bonus and starts the prep timer.</summary>
        public int CompleteWave(float prepSeconds)
        {
            var bonus = balance.economy.waveClearBase + balance.economy.waveClearPerWave * Wave;
            GrantGold(bonus);
            EnterPrep(prepSeconds);
            return bonus;
        }

        public void StartNextWave()
        {
            Wave++;
            PrepRemaining = 0f;
            SetPhase(SiegePhase.Wave);
        }

        public void Tick(float dt)
        {
            if (Phase is SiegePhase.Preparing or SiegePhase.Wave) ElapsedSeconds += dt;
            if (Phase == SiegePhase.Preparing)
            {
                PrepRemaining = Math.Max(0f, PrepRemaining - dt);
            }
        }

        public void DamageGate(float amount)
        {
            if (Phase != SiegePhase.Wave || amount <= 0f || GateBreached) return;
            GateHp = Math.Max(0f, GateHp - amount);
            Changed?.Invoke();
            if (GateHp <= 0f)
            {
                GateBreached = true;
                BreachWave = Wave;
                GateBreachedEvent?.Invoke();
                Changed?.Invoke();
            }
        }

        /// <summary>Prep-phase repair. A rebuilt gate (HP above 0 again) is no longer breached.</summary>
        public void RepairGate(float amount)
        {
            if (amount <= 0f) return;
            GateHp = Math.Min(MaxGateHp, GateHp + amount);
            if (GateBreached && GateHp > 0f) GateBreached = false;
            Changed?.Invoke();
        }

        public void DamageKeep(float amount)
        {
            if (Phase != SiegePhase.Wave || amount <= 0f) return;
            KeepHp = Math.Max(0f, KeepHp - amount);
            Changed?.Invoke();
            if (KeepHp <= 0f) SetPhase(SiegePhase.Defeat);
        }

        public void RegisterShot(DamageSource source)
        {
            if (source == DamageSource.Player) ShotsFired++;
        }

        public void RegisterHit(DamageSource source)
        {
            if (source == DamageSource.Player) ShotsHit++;
        }

        public void RegisterKill(DamageSource source, string sourceId, bool headshot, int gold)
        {
            Kills++;
            if (source == DamageSource.Player) PlayerKills++;
            if (source == DamageSource.Turret) TurretKills++;
            if (headshot) Headshots++;
            var key = string.IsNullOrEmpty(sourceId) ? source.ToString().ToLowerInvariant() : sourceId;
            KillsBySource.TryGetValue(key, out var n);
            KillsBySource[key] = n + 1;
            GrantGold(gold + (headshot && source == DamageSource.Player ? balance.economy.headshotBonus : 0));
        }

        public bool TrySpend(int cost)
        {
            if (Gold < cost) return false;
            Gold -= cost;
            GoldSpent += cost;
            Changed?.Invoke();
            return true;
        }

        public void GrantGold(int amount)
        {
            Gold += amount;
            GoldEarned += amount;
            Changed?.Invoke();
        }

        public void Win() => SetPhase(SiegePhase.Victory);

        public void ResetToTitle() => SetPhase(SiegePhase.Title);

        void SetPhase(SiegePhase phase)
        {
            if (Phase == phase) return;
            Phase = phase;
            PhaseChanged?.Invoke(phase);
            Changed?.Invoke();
        }
    }
}
