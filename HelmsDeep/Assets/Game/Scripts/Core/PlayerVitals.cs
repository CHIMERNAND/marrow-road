using System;

namespace MarrowRoad
{
    /// <summary>
    /// Defender health. Plain C# so the host can own one per player in co-op. Climbers that reach the wall top
    /// hit you; at 0 HP you are down for a few seconds and come back at the gatehouse stair.
    /// </summary>
    public sealed class PlayerVitals
    {
        readonly PlayerBalance b;
        float sinceHit = 99f;

        public float Hp { get; private set; }
        public float MaxHp => b.hp;
        public bool Down { get; private set; }
        public float DownRemaining { get; private set; }
        public int Downs { get; private set; }
        public float DamageTaken { get; private set; }
        public float LastHitTime { get; private set; } = -10f;

        public event Action Downed;
        public event Action Revived;

        public PlayerVitals(PlayerBalance balance)
        {
            b = balance;
            Hp = b.hp;
        }

        public float Hp01 => b.hp <= 0 ? 0 : Hp / b.hp;

        public void Reset()
        {
            Hp = b.hp;
            Down = false;
            DownRemaining = 0f;
            Downs = 0;
            DamageTaken = 0f;
            sinceHit = 99f;
        }

        public void Damage(float amount, float now)
        {
            if (Down || amount <= 0f) return;
            Hp = Math.Max(0f, Hp - amount);
            DamageTaken += amount;
            sinceHit = 0f;
            LastHitTime = now;
            if (Hp > 0f) return;
            Down = true;
            Downs++;
            DownRemaining = b.respawnSeconds;
            Downed?.Invoke();
        }

        public void Tick(float dt)
        {
            if (Down)
            {
                DownRemaining -= dt;
                if (DownRemaining > 0f) return;
                Down = false;
                Hp = b.hp;
                sinceHit = 99f;
                Revived?.Invoke();
                return;
            }

            sinceHit += dt;
            if (sinceHit > b.regenDelay && Hp < b.hp) Hp = Math.Min(b.hp, Hp + b.regenPerSecond * dt);
        }
    }
}
