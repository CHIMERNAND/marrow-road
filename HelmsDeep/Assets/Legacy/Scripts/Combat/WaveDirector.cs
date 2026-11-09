using System.Collections.Generic;
using UnityEngine;

namespace HelmsDeep
{
    public sealed class WaveDirector : MonoBehaviour
    {
        readonly Queue<(ZombieType type, float delay)> _queue = new();
        readonly List<EnemyUnit> _alive = new();
        float _timer;
        Transform _gate;

        public bool HasQueuedSpawns => _queue.Count > 0;

        public void Configure(Transform gate) => _gate = gate;

        public void ClearAlive()
        {
            foreach (var enemy in _alive)
            {
                if (enemy != null) Destroy(enemy.gameObject);
            }

            _alive.Clear();
            _queue.Clear();
            SiegeGame.Instance?.SetEnemyCount(0);
        }

        public void BeginWave(int wave)
        {
            _queue.Clear();
            _timer = 0f;

            void Add(ZombieType type, int count, float interval, float startDelay = 0f)
            {
                for (var i = 0; i < count; i++)
                {
                    _queue.Enqueue((type, startDelay + i * interval));
                }
            }

            switch (wave)
            {
                case 1:
                    Add(ZombieType.Runner, 10, 0.7f);
                    Add(ZombieType.Shambler, 4, 1.2f, 4f);
                    break;
                case 2:
                    Add(ZombieType.Runner, 12, 0.55f);
                    Add(ZombieType.Shambler, 8, 0.9f, 2f);
                    break;
                case 3:
                    Add(ZombieType.Shambler, 10, 0.8f);
                    Add(ZombieType.Brute, 2, 3f, 5f);
                    Add(ZombieType.Runner, 8, 0.5f, 1f);
                    break;
                case 4:
                    Add(ZombieType.Runner, 14, 0.45f);
                    Add(ZombieType.Banshee, 4, 1.5f, 3f);
                    Add(ZombieType.Sapper, 3, 2f, 6f);
                    break;
                case 5:
                    Add(ZombieType.Brute, 4, 2.2f);
                    Add(ZombieType.Shambler, 12, 0.7f, 1f);
                    Add(ZombieType.Runner, 10, 0.4f, 2f);
                    break;
                case 6:
                    Add(ZombieType.Sapper, 6, 1.4f);
                    Add(ZombieType.Banshee, 5, 1.2f, 2f);
                    Add(ZombieType.Brute, 3, 2.5f, 4f);
                    break;
                case 7:
                    Add(ZombieType.Ram, 2, 5f);
                    Add(ZombieType.Runner, 16, 0.35f, 1f);
                    Add(ZombieType.Shambler, 10, 0.65f, 2f);
                    break;
                case 8:
                    Add(ZombieType.Brute, 6, 1.8f);
                    Add(ZombieType.Banshee, 6, 1.1f, 2f);
                    Add(ZombieType.Sapper, 5, 1.3f, 3f);
                    break;
                case 9:
                    Add(ZombieType.Ram, 3, 4f);
                    Add(ZombieType.Brute, 5, 2f, 2f);
                    Add(ZombieType.Runner, 20, 0.3f);
                    break;
                default:
                    Add(ZombieType.Warlord, 1, 0f);
                    Add(ZombieType.Brute, 6, 2f, 3f);
                    Add(ZombieType.Runner, 18, 0.35f, 1f);
                    Add(ZombieType.Sapper, 6, 1.2f, 4f);
                    break;
            }
        }

        public void ApplyAbility(AbilityId id)
        {
            foreach (var enemy in _alive)
            {
                if (enemy == null || enemy.IsDead) continue;
                var gateZ = _gate != null ? _gate.position.z : GameBalance.GateZ;
                var nearGate = Mathf.Abs(enemy.transform.position.z - gateZ) < 35f;
                if (id == AbilityId.OilDump && !nearGate) continue;
                enemy.ApplyAbility(id);
            }
        }

        void Update()
        {
            _alive.RemoveAll(e => e == null || e.IsDead);
            SiegeGame.Instance?.SetEnemyCount(_alive.Count + _queue.Count);

            if (_queue.Count == 0) return;

            _timer += Time.deltaTime;
            while (_queue.Count > 0 && _queue.Peek().delay <= _timer)
            {
                var next = _queue.Dequeue();
                Spawn(next.type);
            }
        }

        void Spawn(ZombieType type)
        {
            var spec = GameBalance.GetZombie(type);
            var go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            go.name = spec.Name;
            var lane = Random.Range(-5.5f, 5.5f);
            go.transform.position = new Vector3(lane, 0f, GameBalance.SpawnZ + Random.Range(-8f, 8f));
            var enemy = go.AddComponent<EnemyUnit>();
            enemy.Init(spec, _gate);
            _alive.Add(enemy);
        }
    }
}
