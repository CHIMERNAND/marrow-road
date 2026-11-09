using UnityEngine;

namespace HelmsDeep
{
    public sealed class PowderBarrel : MonoBehaviour
    {
        public bool Detonated { get; private set; }
        public float Radius = 10f;
        public float Damage = 220f;

        public void Detonate()
        {
            if (Detonated) return;
            Detonated = true;

            CombatFeedback.Instance?.Shake(0.55f);
            CombatFeedback.Instance?.SpawnImpact(transform.position + Vector3.up, new Color(1f, 0.45f, 0.05f));
            SiegeAudio.Instance?.PlayAbility();

            foreach (var enemy in FindObjectsByType<EnemyUnit>(FindObjectsSortMode.None))
            {
                if (enemy == null || enemy.IsDead) continue;
                if (Vector3.Distance(enemy.transform.position, transform.position) <= Radius)
                {
                    enemy.ApplyDamage(Damage, false, BoltAmmoType.Fire);
                }
            }

            // Fireball visual
            var ball = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            ball.transform.position = transform.position + Vector3.up * 0.8f;
            ball.transform.localScale = Vector3.one * 0.5f;
            Object.Destroy(ball.GetComponent<Collider>());
            BattlementBuilder.SetEmissive(ball, new Color(1f, 0.4f, 0.05f), 4f);
            StartCoroutine(ExpandAndDie(ball.transform));
            foreach (var r in GetComponentsInChildren<Renderer>()) r.enabled = false;
            Destroy(gameObject, 0.6f);
        }

        System.Collections.IEnumerator ExpandAndDie(Transform ball)
        {
            var t = 0f;
            while (t < 0.35f)
            {
                t += Time.deltaTime;
                ball.localScale = Vector3.one * Mathf.Lerp(0.5f, Radius * 0.9f, t / 0.35f);
                yield return null;
            }

            Destroy(ball.gameObject);
        }
    }
}
