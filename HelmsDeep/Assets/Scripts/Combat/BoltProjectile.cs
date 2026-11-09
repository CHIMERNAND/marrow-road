using UnityEngine;

namespace HelmsDeep
{
    public sealed class BoltProjectile : MonoBehaviour
    {
        Vector3 _velocity;
        float _damage;
        int _pierceLeft;
        BoltAmmoType _ammo;
        float _headshotMul;
        TrailRenderer _trail;
        readonly System.Collections.Generic.HashSet<int> _hitIds = new();

        public void Init(Vector3 velocity, float damage, int pierce, BoltAmmoType ammo, float headshotMul)
        {
            _velocity = velocity;
            _damage = damage;
            _pierceLeft = pierce;
            _ammo = ammo;
            _headshotMul = headshotMul;

            _trail = gameObject.AddComponent<TrailRenderer>();
            _trail.time = 0.18f;
            _trail.startWidth = 0.08f;
            _trail.endWidth = 0.01f;
            _trail.material = new Material(Shader.Find("Sprites/Default"));
            var c = AmmoColor(ammo);
            _trail.startColor = c;
            _trail.endColor = new Color(c.r, c.g, c.b, 0f);
            _trail.minVertexDistance = 0.05f;
        }

        void Update()
        {
            var step = _velocity * Time.deltaTime;
            var dist = step.magnitude;
            if (Physics.SphereCast(transform.position, 0.14f, _velocity.normalized, out var hit, dist + 0.05f))
            {
                // Powder barrels
                var barrel = hit.collider.GetComponentInParent<PowderBarrel>();
                if (barrel != null && !barrel.Detonated)
                {
                    barrel.Detonate();
                    Destroy(gameObject);
                    return;
                }

                var enemy = hit.collider.GetComponentInParent<EnemyUnit>();
                if (enemy != null && _hitIds.Add(enemy.Id))
                {
                    var headshot = hit.collider.gameObject.name == "Head" ||
                                   hit.point.y > enemy.transform.position.y + enemy.Height * 0.72f;
                    var dmg = headshot ? _damage * _headshotMul : _damage;
                    enemy.ApplyDamage(dmg, headshot, _ammo);
                    CombatFeedback.Instance?.Hitmarker(headshot);
                    CombatFeedback.Instance?.FloatDamage(hit.point, dmg, headshot, AmmoColor(_ammo));
                    CombatFeedback.Instance?.SpawnImpact(hit.point, AmmoColor(_ammo));
                    if (headshot) SiegeAudio.Instance?.PlayHeadshot();
                    else SiegeAudio.Instance?.PlayHit();

                    if (_ammo == BoltAmmoType.Fire)
                    {
                        CombatFeedback.Instance?.SpawnImpact(hit.point + Vector3.up * 0.3f, new Color(1f, 0.4f, 0.05f));
                    }

                    if (_pierceLeft-- <= 0)
                    {
                        Destroy(gameObject);
                        return;
                    }
                }
            }

            transform.position += step;
            if (_velocity.sqrMagnitude > 0.01f)
            {
                transform.rotation = Quaternion.LookRotation(_velocity.normalized);
            }
        }

        static Color AmmoColor(BoltAmmoType ammo) => ammo switch
        {
            BoltAmmoType.Fire => new Color(1f, 0.38f, 0.05f),
            BoltAmmoType.Frost => new Color(0.22f, 0.75f, 1f),
            BoltAmmoType.Scatter => new Color(0.66f, 0.33f, 0.95f),
            _ => new Color(1f, 0.85f, 0.25f)
        };
    }
}
