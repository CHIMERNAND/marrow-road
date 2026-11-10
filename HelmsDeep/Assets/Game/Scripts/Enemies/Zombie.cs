using UnityEngine;
using UnityEngine.AI;

namespace MarrowRoad
{
    /// <summary>
    /// Walker zombie: shambles along the NavMesh to the Hornburg gate and beats on it.
    /// Body is a primitive humanoid (graybox) with procedural gait, stagger, and a fall-over death.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public sealed class Zombie : MonoBehaviour, IDamageable
    {
        public const float MaxHp = 100f;
        public const float GateDps = 2f;

        enum Mode { Walking, Attacking, Dead }

        public bool Alive => mode != Mode.Dead && gameObject.activeSelf;
        public Vector3 Velocity => agent != null && agent.enabled ? agent.velocity : Vector3.zero;
        public Vector3 HeadPosition => head.position;
        public Vector3 ChestPosition => torso.position + torso.up * 0.3f;
        public bool AtGate => mode == Mode.Attacking;

        NavMeshAgent agent;
        Transform hips, torso, head, armL, armR, legL, legR;
        Mode mode;
        float hp;
        float baseSpeed;
        float phase;
        float stagger;
        float deadTime;
        Vector3 target;
        Quaternion deathFrom, deathTo;
        SiegeDirector director;

        public static Zombie Create(Transform parent, MaterialLibrary lib)
        {
            var go = new GameObject("Zombie");
            go.SetActive(false); // the agent must not try to bind to the NavMesh until it is placed
            go.transform.SetParent(parent, false);
            var agent = go.AddComponent<NavMeshAgent>();
            agent.radius = 0.35f;
            agent.height = 1.8f;
            agent.acceleration = 6f;
            agent.angularSpeed = 240f;
            agent.stoppingDistance = 0.3f;
            agent.autoBraking = false;
            agent.obstacleAvoidanceType = ObstacleAvoidanceType.LowQualityObstacleAvoidance;
            var z = go.AddComponent<Zombie>();
            z.BuildBody(lib);
            return z;
        }

        void BuildBody(MaterialLibrary lib)
        {
            agent = GetComponent<NavMeshAgent>();
            Material skin = lib != null ? lib.zombieSkin : null, cloth = lib != null ? lib.zombieCloth : null;
            hips = Pivot("Hips", transform, new Vector3(0, 0.95f, 0));
            legL = Pivot("LegL", hips, new Vector3(-0.11f, 0, 0));
            legR = Pivot("LegR", hips, new Vector3(0.11f, 0, 0));
            Mesh(legL, new Vector3(0, -0.47f, 0), new Vector3(0.15f, 0.92f, 0.16f), cloth, true);
            Mesh(legR, new Vector3(0, -0.47f, 0), new Vector3(0.15f, 0.92f, 0.16f), cloth, true);
            torso = Pivot("Torso", hips, Vector3.zero);
            Mesh(torso, new Vector3(0, 0.34f, 0), new Vector3(0.4f, 0.62f, 0.24f), cloth, true);
            head = Pivot("Head", torso, new Vector3(0, 0.78f, 0.02f));
            Mesh(head, Vector3.zero, new Vector3(0.21f, 0.26f, 0.24f), skin, true, PrimitiveType.Sphere);
            armL = Pivot("ArmL", torso, new Vector3(-0.25f, 0.6f, 0));
            armR = Pivot("ArmR", torso, new Vector3(0.25f, 0.6f, 0));
            Mesh(armL, new Vector3(0, -0.3f, 0), new Vector3(0.1f, 0.62f, 0.11f), skin, false);
            Mesh(armR, new Vector3(0, -0.3f, 0), new Vector3(0.1f, 0.62f, 0.11f), skin, false);

            var headBox = head.gameObject.AddComponent<SphereCollider>();
            headBox.isTrigger = true;
            headBox.radius = 0.14f;
            AddHitbox(head.gameObject, 3f, true);
            var chest = torso.gameObject.AddComponent<CapsuleCollider>();
            chest.isTrigger = true;
            chest.center = new Vector3(0, 0.34f, 0);
            chest.height = 0.75f;
            chest.radius = 0.21f;
            AddHitbox(torso.gameObject, 1f, false);
            foreach (var leg in new[] { legL, legR })
            {
                var c = leg.gameObject.AddComponent<CapsuleCollider>();
                c.isTrigger = true;
                c.center = new Vector3(0, -0.47f, 0);
                c.height = 0.95f;
                c.radius = 0.09f;
                AddHitbox(leg.gameObject, 0.6f, false);
            }

            foreach (var arm in new[] { armL, armR })
            {
                var c = arm.gameObject.AddComponent<CapsuleCollider>();
                c.isTrigger = true;
                c.center = new Vector3(0, -0.3f, 0);
                c.height = 0.65f;
                c.radius = 0.07f;
                AddHitbox(arm.gameObject, 0.5f, false);
            }
        }

        void AddHitbox(GameObject go, float mult, bool isHead)
        {
            var h = go.AddComponent<Hitbox>();
            h.multiplier = mult;
            h.isHead = isHead;
            h.Owner = this;
        }

        static Transform Pivot(string name, Transform parent, Vector3 pos)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = pos;
            return t;
        }

        static void Mesh(Transform parent, Vector3 pos, Vector3 size, Material m, bool shadows, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            if (m != null) r.sharedMaterial = m;
        }

        public bool Spawn(SiegeDirector owner, Vector3 at, Vector3 gateTarget)
        {
            director = owner;
            if (!NavMesh.SamplePosition(at, out var hit, 8f, NavMesh.AllAreas)) return false;
            ClearStuckBolts();
            transform.SetPositionAndRotation(hit.position, Quaternion.Euler(0, Random.Range(150f, 210f), 0));
            var s = Random.Range(0.93f, 1.07f);
            transform.localScale = new Vector3(s, s, s);
            gameObject.SetActive(true);
            agent.enabled = true;
            agent.Warp(hit.position);
            baseSpeed = Random.Range(1.3f, 2.0f);
            agent.speed = baseSpeed;
            agent.avoidancePriority = Random.Range(30, 70);
            hp = MaxHp;
            mode = Mode.Walking;
            stagger = 0f;
            phase = Random.value * 10f;
            target = gateTarget;
            agent.isStopped = false;
            agent.SetDestination(target);
            torso.localRotation = Quaternion.Euler(Random.Range(8f, 22f), 0, Random.Range(-8f, 8f));
            head.localRotation = Quaternion.Euler(Random.Range(-10f, 20f), 0, Random.Range(-25f, 25f));
            return true;
        }

        public void TakeHit(in HitInfo hit)
        {
            if (!Alive) return;
            hp -= hit.Damage;
            if (hp <= 0f)
            {
                Die(hit);
                return;
            }

            stagger = Mathf.Max(stagger, hit.Headshot ? 0.7f : 0.45f);
        }

        void Die(in HitInfo hit)
        {
            director?.ReleaseGateSlot(this);
            mode = Mode.Dead;
            deadTime = 0f;
            agent.enabled = false;
            var flatDir = new Vector3(hit.Direction.x, 0, hit.Direction.z);
            if (flatDir.sqrMagnitude < 0.01f) flatDir = -transform.forward;
            deathFrom = transform.rotation;
            // Topple in the direction the bolt was travelling.
            var axis = Vector3.Cross(Vector3.up, flatDir.normalized);
            deathTo = Quaternion.AngleAxis(88f, axis) * deathFrom;
            director?.OnZombieKilled(this, hit.Source, hit.Headshot);
        }

        void Update()
        {
            var dt = Time.deltaTime;
            if (mode == Mode.Dead)
            {
                UpdateDead(dt);
                return;
            }

            stagger = Mathf.Max(0f, stagger - dt);
            if (mode == Mode.Walking)
            {
                var flat = transform.position - target;
                flat.y = 0;
                if (!agent.pathPending && (flat.magnitude < 2.2f || (agent.hasPath && agent.remainingDistance < 0.5f)))
                {
                    mode = Mode.Attacking;
                    agent.isStopped = true;
                }
            }

            var gait = 0.65f + 0.35f * Mathf.Abs(Mathf.Sin(phase * 0.5f));
            if (mode == Mode.Walking)
            {
                agent.isStopped = stagger > 0f;
                agent.speed = baseSpeed * gait;
            }

            var v = agent.velocity.magnitude;
            phase += dt * (1.2f + v * 2.6f);
            var swing = Mathf.Sin(phase) * Mathf.Clamp01(v / 1.2f);
            legL.localRotation = Quaternion.Euler(swing * 28f, 0, 0);
            legR.localRotation = Quaternion.Euler(-swing * 28f, 0, 0);
            var reach = mode == Mode.Attacking ? -95f + Mathf.Sin(phase * 2.2f) * 45f : -78f + swing * 8f;
            var reachR = mode == Mode.Attacking ? -95f + Mathf.Sin(phase * 2.2f + 1.7f) * 45f : -72f - swing * 8f;
            armL.localRotation = Quaternion.Euler(reach, 0, -6f);
            armR.localRotation = Quaternion.Euler(reachR, 0, 6f);
            var lurch = stagger > 0f ? -25f * stagger : Mathf.Sin(phase * 0.5f) * 4f;
            hips.localRotation = Quaternion.Euler(lurch, 0, Mathf.Sin(phase) * 5f);
            hips.localPosition = new Vector3(0, 0.95f - Mathf.Abs(Mathf.Sin(phase)) * 0.04f, 0);

            if (mode == Mode.Attacking)
            {
                var face = target + Vector3.forward * 3f - transform.position;
                face.y = 0;
                if (face.sqrMagnitude > 0.01f)
                    transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(face), 180f * dt);
                if (stagger <= 0f && director != null && director.TryClaimGateSlot(this)) director.DamageGate(GateDps * dt);
            }
        }

        void UpdateDead(float dt)
        {
            deadTime += dt;
            var t = Mathf.Clamp01(deadTime / 0.8f);
            transform.rotation = Quaternion.Slerp(deathFrom, deathTo, t * t);
            armL.localRotation = Quaternion.Slerp(armL.localRotation, Quaternion.Euler(-160f, 0, -20f), dt * 3f);
            armR.localRotation = Quaternion.Slerp(armR.localRotation, Quaternion.Euler(-150f, 0, 25f), dt * 3f);
            if (deadTime > 7f) transform.position += Vector3.down * (dt * 0.5f);
            if (deadTime > 9.5f) Despawn();
        }

        public void Despawn()
        {
            if (agent.enabled) agent.enabled = false;
            director?.ReleaseGateSlot(this);
            mode = Mode.Dead;
            ClearStuckBolts();
            gameObject.SetActive(false);
            director?.OnZombieDespawned(this);
        }

        void ClearStuckBolts()
        {
            foreach (var b in GetComponentsInChildren<Bolt>(true)) Destroy(b.gameObject);
        }
    }
}
