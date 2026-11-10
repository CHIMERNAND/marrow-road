using System;

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
    /// </summary>
    public sealed class SiegeState
    {
        public const int StartGold = 100;
        public const float MaxGateHp = 2500f;

        public SiegePhase Phase { get; private set; } = SiegePhase.Title;
        public int Wave { get; private set; }
        public int TotalWaves { get; }
        public float GateHp { get; private set; } = MaxGateHp;
        public int Gold { get; private set; } = StartGold;
        public int Kills { get; private set; }
        public int PlayerKills { get; private set; }
        public int TurretKills { get; private set; }
        public int Headshots { get; private set; }
        public int ShotsFired { get; private set; }
        public int ShotsHit { get; private set; }
        public float PrepRemaining { get; private set; }
        public float ElapsedSeconds { get; private set; }

        public event Action Changed;
        public event Action<SiegePhase> PhaseChanged;

        public SiegeState(int totalWaves)
        {
            TotalWaves = totalWaves;
        }

        public float Gate01 => GateHp / MaxGateHp;
        public float Accuracy01 => ShotsFired == 0 ? 0f : (float)ShotsHit / ShotsFired;

        public void Begin(float prepSeconds)
        {
            Wave = 0;
            GateHp = MaxGateHp;
            Gold = StartGold;
            Kills = PlayerKills = TurretKills = Headshots = ShotsFired = ShotsHit = 0;
            ElapsedSeconds = 0f;
            EnterPrep(prepSeconds);
        }

        public void EnterPrep(float seconds)
        {
            PrepRemaining = seconds;
            SetPhase(SiegePhase.Preparing);
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
            if (Phase != SiegePhase.Wave || amount <= 0f) return;
            GateHp = Math.Max(0f, GateHp - amount);
            Changed?.Invoke();
            if (GateHp <= 0f) SetPhase(SiegePhase.Defeat);
        }

        public void RegisterShot(DamageSource source)
        {
            if (source == DamageSource.Player) ShotsFired++;
        }

        public void RegisterHit(DamageSource source)
        {
            if (source == DamageSource.Player) ShotsHit++;
        }

        public void RegisterKill(DamageSource source, bool headshot, int gold)
        {
            Kills++;
            if (source == DamageSource.Player) PlayerKills++;
            if (source == DamageSource.Turret) TurretKills++;
            if (headshot) Headshots++;
            Gold += gold + (headshot ? 5 : 0);
            Changed?.Invoke();
        }

        public bool TrySpend(int cost)
        {
            if (Gold < cost) return false;
            Gold -= cost;
            Changed?.Invoke();
            return true;
        }

        public void GrantGold(int amount)
        {
            Gold += amount;
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
