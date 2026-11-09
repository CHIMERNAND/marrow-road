using UnityEngine;

namespace HelmsDeep
{
    public sealed class EnemyUnit : MonoBehaviour
    {
        static int _nextId = 1;

        public int Id { get; private set; }
        public float Height { get; private set; } = 1.8f;
        public bool IsDead { get; private set; }
        public float Hp01 => _spec.Hp <= 0f ? 0f : Mathf.Clamp01(_hp / _spec.Hp);

        ZombieSpec _spec;
        float _hp;
        float _shieldHp;
        float _burnTimer;
        float _burnDps;
        float _frostTimer;
        float _staggerTimer;
        float _attackTimer;
        float _walkPhase;
        Transform _gate;
        Transform _visualRoot;
        GameObject _hpBg;
        GameObject _hpFill;
        GameObject _burnAura;
        GameObject _frostAura;

        public void Init(ZombieSpec spec, Transform gate)
        {
            Id = _nextId++;
            _spec = spec;
            _hp = spec.Hp;
            _shieldHp = spec.HasShield ? spec.ShieldHp : 0f;
            _gate = gate;
            Height = Mathf.Clamp(spec.Radius * 3.4f, 1.6f, 3.6f);

            var col = gameObject.GetComponent<Collider>();
            if (col != null) col.isTrigger = false;

            EnemyVisuals.Build(transform, spec);
            Height *= transform.localScale.y;
            _visualRoot = transform;
            _walkPhase = Random.value * Mathf.PI * 2f;
            BuildHpBar();
            BuildAuras();
        }

        void BuildHpBar()
        {
            _hpBg = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _hpBg.name = "HpBg";
            _hpBg.transform.SetParent(transform, false);
            _hpBg.transform.localPosition = new Vector3(0f, Height + 0.35f, 0f);
            _hpBg.transform.localScale = new Vector3(1.1f, 0.08f, 0.08f);
            Object.Destroy(_hpBg.GetComponent<Collider>());
            BattlementBuilder.SetColor(_hpBg, new Color(0.05f, 0.05f, 0.05f));

            _hpFill = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _hpFill.name = "HpFill";
            _hpFill.transform.SetParent(_hpBg.transform, false);
            _hpFill.transform.localPosition = Vector3.zero;
            _hpFill.transform.localScale = Vector3.one;
            Object.Destroy(_hpFill.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(_hpFill, new Color(0.85f, 0.15f, 0.1f), 1.2f);
        }

        void BuildAuras()
        {
            _burnAura = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            _burnAura.name = "BurnAura";
            _burnAura.transform.SetParent(transform, false);
            _burnAura.transform.localPosition = new Vector3(0f, 1f, 0f);
            _burnAura.transform.localScale = Vector3.one * 1.6f;
            Object.Destroy(_burnAura.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(_burnAura, new Color(1f, 0.35f, 0.05f), 1.5f);
            _burnAura.SetActive(false);

            _frostAura = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            _frostAura.name = "FrostAura";
            _frostAura.transform.SetParent(transform, false);
            _frostAura.transform.localPosition = new Vector3(0f, 1f, 0f);
            _frostAura.transform.localScale = Vector3.one * 1.5f;
            Object.Destroy(_frostAura.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(_frostAura, new Color(0.35f, 0.75f, 1f), 1.2f);
            _frostAura.SetActive(false);
        }

        public void ApplyDamage(float amount, bool headshot, BoltAmmoType ammo)
        {
            if (IsDead) return;

            if (_shieldHp > 0f)
            {
                _shieldHp -= amount;
                if (_shieldHp > 0f)
                {
                    UpdateHpBar();
                    return;
                }

                amount = -_shieldHp;
                _shieldHp = 0f;
            }

            _hp -= amount;

            if (ammo == BoltAmmoType.Fire)
            {
                _burnTimer = 5f;
                _burnDps = 14f;
                _burnAura.SetActive(true);
            }
            else if (ammo == BoltAmmoType.Frost)
            {
                _frostTimer = 4.5f;
                _frostAura.SetActive(true);
            }

            UpdateHpBar();
            if (_hp <= 0f) Die(headshot);
        }

        public void ApplyAbility(AbilityId id)
        {
            if (IsDead) return;
            switch (id)
            {
                case AbilityId.OilDump:
                    ApplyDamage(90f, false, BoltAmmoType.Fire);
                    CombatFeedback.Instance?.SpawnImpact(transform.position + Vector3.up, new Color(1f, 0.4f, 0.05f));
                    break;
                case AbilityId.CatapultBarrage:
                    ApplyDamage(120f, false, BoltAmmoType.Bodkin);
                    _staggerTimer = 1.2f;
                    CombatFeedback.Instance?.SpawnImpact(transform.position + Vector3.up * 0.5f, new Color(0.7f, 0.5f, 0.2f));
                    break;
                case AbilityId.HornOfHelm:
                    _staggerTimer = 2.5f;
                    break;
                case AbilityId.ArcherVolley:
                    ApplyDamage(55f, false, BoltAmmoType.Fire);
                    break;
            }
        }

        void Update()
        {
            if (IsDead) return;

            if (_burnTimer > 0f)
            {
                _burnTimer -= Time.deltaTime;
                _hp -= _burnDps * Time.deltaTime;
                UpdateHpBar();
                if (_hp <= 0f)
                {
                    Die(false);
                    return;
                }

                if (_burnTimer <= 0f) _burnAura.SetActive(false);
            }

            if (_staggerTimer > 0f)
            {
                _staggerTimer -= Time.deltaTime;
                return;
            }

            var speedMul = _frostTimer > 0f ? 0.45f : 1f;
            if (_frostTimer > 0f)
            {
                _frostTimer -= Time.deltaTime;
                if (_frostTimer <= 0f) _frostAura.SetActive(false);
            }

            var gatePos = _gate != null ? _gate.position : new Vector3(0f, 0f, GameBalance.GateZ);
            var target = new Vector3(Mathf.Clamp(transform.position.x, -6f, 6f), 0f, gatePos.z);
            var to = target - transform.position;
            to.y = 0f;

            if (to.magnitude > 2.2f)
            {
                transform.position += to.normalized * (_spec.Speed * speedMul * Time.deltaTime);
                if (to.sqrMagnitude > 0.01f)
                {
                    transform.rotation = Quaternion.LookRotation(to.normalized);
                }

                _walkPhase += Time.deltaTime * 8f * speedMul;
                var bob = Mathf.Sin(_walkPhase) * 0.08f;
                if (_visualRoot != null)
                {
                    // mild stride lean via child parts if present
                    var armL = transform.Find("ArmL");
                    var armR = transform.Find("ArmR");
                    if (armL != null) armL.localRotation = Quaternion.Euler(Mathf.Sin(_walkPhase) * 25f, 0f, -12f);
                    if (armR != null) armR.localRotation = Quaternion.Euler(Mathf.Sin(_walkPhase + Mathf.PI) * 25f, 0f, 12f);
                    transform.position = new Vector3(transform.position.x, Mathf.Abs(bob) * 0.15f, transform.position.z);
                }
            }
            else
            {
                _attackTimer -= Time.deltaTime;
                if (_attackTimer <= 0f)
                {
                    _attackTimer = 1.1f;
                    SiegeGame.Instance?.DamageGate(_spec.Damage);
                    CombatFeedback.Instance?.Shake(0.2f);
                }
            }

            BillBoardHp();
        }

        void BillBoardHp()
        {
            if (_hpBg == null || Camera.main == null) return;
            _hpBg.transform.rotation = Quaternion.LookRotation(Camera.main.transform.forward);
        }

        void UpdateHpBar()
        {
            if (_hpFill == null) return;
            var t = Hp01;
            _hpFill.transform.localScale = new Vector3(Mathf.Max(0.05f, t), 1f, 1f);
            _hpFill.transform.localPosition = new Vector3((t - 1f) * 0.5f, 0f, 0f);
            var c = Color.Lerp(new Color(0.9f, 0.15f, 0.1f), new Color(0.2f, 0.85f, 0.25f), t);
            BattlementBuilder.SetEmissive(_hpFill, c, 1.3f);
        }

        void Die(bool headshot)
        {
            if (IsDead) return;
            IsDead = true;
            SiegeGame.Instance?.RegisterKill(headshot, _spec.Gold);
            SiegeAudio.Instance?.PlayKill();
            CombatFeedback.Instance?.SpawnImpact(transform.position + Vector3.up, _spec.Color);

            // Collapse
            foreach (var col in GetComponentsInChildren<Collider>()) col.enabled = false;
            if (_hpBg != null) Destroy(_hpBg);
            var body = gameObject.AddComponent<Rigidbody>();
            body.AddForce(Random.insideUnitSphere * 4f + Vector3.up * 3f, ForceMode.Impulse);
            body.AddTorque(Random.insideUnitSphere * 6f, ForceMode.Impulse);
            Destroy(gameObject, 1.4f);
        }
    }
}
