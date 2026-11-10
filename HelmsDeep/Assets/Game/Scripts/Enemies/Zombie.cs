using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace MarrowRoad
{
    public enum EnemyKind
    {
        Shambler,
        Runner,
        Brute,
        Climber,
        Ram
    }

    /// <summary>
    /// One undead enemy, configured from an <see cref="EnemyDef"/> in balance.json.
    /// Kinds: shambler and runner walk to the gate and beat on it; the brute does the same in armour;
    /// the climber goes to a ladder zone, raises a siege ladder and comes over the wall top to hunt the defender;
    /// the ram crew carries a log to the gate and strikes it, ignoring the gate's slot limit.
    /// Once the gate is breached everything still walking re-targets the keep door.
    /// Bodies are primitive humanoids (graybox) with procedural gait, stagger and a fall-over death.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public sealed class Zombie : MonoBehaviour, IDamageable
    {
        enum Mode { Walking, Attacking, ToLadder, WaitLadder, Climbing, Vaulting, OnWall, Dead }

        struct Rig
        {
            public Transform root, hips, torso, head, armL, armR, legL, legR;
        }

        public EnemyDef Def { get; private set; }
        public EnemyKind Kind { get; private set; }
        public bool Alive => mode != Mode.Dead && gameObject.activeSelf;
        public Vector3 Velocity => agent != null && agent.enabled ? agent.velocity : (mode == Mode.Climbing ? climbVel : Vector3.zero);
        public Vector3 HeadPosition => rigs[0].head.position;
        public Vector3 ChestPosition => Kind == EnemyKind.Ram && log != null ? log.position : rigs[0].torso.position + rigs[0].torso.up * 0.3f * transform.localScale.y;
        public bool AtGate => mode == Mode.Attacking;
        public bool OnLadder => mode is Mode.Climbing or Mode.Vaulting;
        public bool OnWall => mode == Mode.OnWall;
        public bool Heavy => Kind is EnemyKind.Brute or EnemyKind.Ram;
        public float Hp01 => Def == null || Def.hp <= 0 ? 0 : Mathf.Clamp01(hp / Def.hp);
        public float ClimbS => climbS;
        public SiegeLadder Ladder => ladder;

        NavMeshAgent agent;
        readonly List<Rig> rigs = new List<Rig>();
        Transform log, logPivot;
        Mode mode;
        float hp;
        float baseSpeed;
        float phase;
        float stagger;
        float deadTime;
        float fallVel, groundY;
        float attackTimer;
        float repathTimer;
        float climbS;
        float vaultT;
        Vector3 vaultFrom;
        Vector3 climbVel;
        Vector3 target;
        bool targetIsKeep;
        int visibleCarriers;
        SiegeLadder ladder;
        Quaternion deathFrom, deathTo;
        SiegeDirector director;

        static readonly Vector3 Up = Vector3.up;

        public static EnemyKind ParseKind(string kind)
        {
            switch (kind)
            {
                case "runner": return EnemyKind.Runner;
                case "brute": return EnemyKind.Brute;
                case "climber": return EnemyKind.Climber;
                case "ram": return EnemyKind.Ram;
                default: return EnemyKind.Shambler;
            }
        }

        public static Zombie Create(Transform parent, MaterialLibrary lib, EnemyDef def)
        {
            var go = new GameObject("Enemy_" + def.id);
            go.SetActive(false); // the agent must not try to bind to the NavMesh until it is placed
            go.transform.SetParent(parent, false);
            var agent = go.AddComponent<NavMeshAgent>();
            var kind = ParseKind(def.kind);
            agent.radius = kind == EnemyKind.Ram ? 1.1f : kind == EnemyKind.Brute ? 0.5f : 0.35f;
            agent.height = kind == EnemyKind.Brute ? 2.4f : 1.8f;
            agent.acceleration = kind == EnemyKind.Runner ? 12f : 6f;
            agent.angularSpeed = kind == EnemyKind.Ram ? 90f : 240f;
            agent.stoppingDistance = 0.3f;
            agent.autoBraking = false;
            agent.obstacleAvoidanceType = ObstacleAvoidanceType.LowQualityObstacleAvoidance;
            var z = go.AddComponent<Zombie>();
            z.Def = def;
            z.Kind = kind;
            z.agent = agent;
            z.BuildBody(lib);
            return z;
        }

        // ---------- Body ----------

        void BuildBody(MaterialLibrary lib)
        {
            Material skin = lib != null ? lib.zombieSkin : null, cloth = lib != null ? lib.zombieCloth : null;
            Material metal = lib != null ? lib.metal : null, wood = lib != null ? lib.wood : null;
            switch (Kind)
            {
                case EnemyKind.Ram:
                {
                    logPivot = Pivot("LogPivot", transform, new Vector3(0, 1.05f, 0));
                    log = Pivot("Log", logPivot, Vector3.zero);
                    var logMesh = Mesh(log, Vector3.zero, new Vector3(0.55f, 2.9f, 0.55f), wood, true, PrimitiveType.Cylinder);
                    logMesh.localRotation = Quaternion.Euler(90f, 0, 0);
                    Mesh(log, new Vector3(0, 0, 2.85f), new Vector3(0.66f, 0.66f, 0.3f), metal, true);
                    var lc = log.gameObject.AddComponent<CapsuleCollider>();
                    lc.isTrigger = true;
                    lc.direction = 2;
                    lc.height = 5.8f;
                    lc.radius = 0.32f;
                    AddHitbox(log.gameObject, 1f, false, true);
                    var slots = new[] { new Vector3(-0.6f, 0, 1.5f), new Vector3(0.6f, 0, 1.5f), new Vector3(-0.6f, 0, -1.3f), new Vector3(0.6f, 0, -1.3f) };
                    foreach (var s in slots)
                    {
                        var r = Humanoid(Pivot("Carrier", transform, s), skin, cloth, metal, 1f, false, false);
                        // Arms locked forward/inward onto the log.
                        r.armL.localRotation = Quaternion.Euler(-70f, 0, s.x > 0 ? -25f : 0f);
                        r.armR.localRotation = Quaternion.Euler(-70f, 0, s.x < 0 ? 25f : 0f);
                        rigs.Add(r);
                    }

                    break;
                }
                case EnemyKind.Brute:
                    rigs.Add(Humanoid(transform, skin, cloth, metal, 1f, true, false));
                    break;
                case EnemyKind.Climber:
                    rigs.Add(Humanoid(transform, skin, cloth, metal, 1f, false, true));
                    break;
                default:
                    rigs.Add(Humanoid(transform, skin, cloth, metal, 1f, false, false));
                    break;
            }
        }

        Rig Humanoid(Transform root, Material skin, Material cloth, Material metal, float s, bool armored, bool longArms)
        {
            var r = new Rig { root = root };
            r.hips = Pivot("Hips", root, new Vector3(0, 0.95f * s, 0));
            r.legL = Pivot("LegL", r.hips, new Vector3(-0.11f, 0, 0));
            r.legR = Pivot("LegR", r.hips, new Vector3(0.11f, 0, 0));
            Mesh(r.legL, new Vector3(0, -0.47f, 0), new Vector3(0.15f, 0.92f, 0.16f), cloth, true);
            Mesh(r.legR, new Vector3(0, -0.47f, 0), new Vector3(0.15f, 0.92f, 0.16f), cloth, true);
            r.torso = Pivot("Torso", r.hips, Vector3.zero);
            Mesh(r.torso, new Vector3(0, 0.34f, 0), new Vector3(0.4f, 0.62f, 0.24f), cloth, true);
            r.head = Pivot("Head", r.torso, new Vector3(0, 0.78f, 0.02f));
            Mesh(r.head, Vector3.zero, new Vector3(0.21f, 0.26f, 0.24f), skin, true, PrimitiveType.Sphere);
            var armLen = longArms ? 0.78f : 0.62f;
            r.armL = Pivot("ArmL", r.torso, new Vector3(-0.25f, 0.6f, 0));
            r.armR = Pivot("ArmR", r.torso, new Vector3(0.25f, 0.6f, 0));
            Mesh(r.armL, new Vector3(0, -armLen / 2f, 0), new Vector3(0.1f, armLen, 0.11f), skin, false);
            Mesh(r.armR, new Vector3(0, -armLen / 2f, 0), new Vector3(0.1f, armLen, 0.11f), skin, false);
            if (armored)
            {
                // Scavenged plate: breastplate, pauldrons and a pot helm. Bolts glance off unless they pierce.
                Mesh(r.torso, new Vector3(0, 0.36f, -0.01f), new Vector3(0.46f, 0.56f, 0.3f), metal, true);
                Mesh(r.torso, new Vector3(-0.27f, 0.62f, 0), new Vector3(0.2f, 0.12f, 0.24f), metal, false);
                Mesh(r.torso, new Vector3(0.27f, 0.62f, 0), new Vector3(0.2f, 0.12f, 0.24f), metal, false);
                Mesh(r.head, new Vector3(0, 0.05f, 0), new Vector3(0.26f, 0.2f, 0.28f), metal, true, PrimitiveType.Sphere);
            }

            var headBox = r.head.gameObject.AddComponent<SphereCollider>();
            headBox.isTrigger = true;
            headBox.radius = 0.14f;
            AddHitbox(r.head.gameObject, Kind == EnemyKind.Ram ? 2f : 3f, true, armored);
            var chest = r.torso.gameObject.AddComponent<CapsuleCollider>();
            chest.isTrigger = true;
            chest.center = new Vector3(0, 0.34f, 0);
            chest.height = 0.75f;
            chest.radius = armored ? 0.25f : 0.21f;
            AddHitbox(r.torso.gameObject, 1f, false, armored);
            foreach (var leg in new[] { r.legL, r.legR })
            {
                var c = leg.gameObject.AddComponent<CapsuleCollider>();
                c.isTrigger = true;
                c.center = new Vector3(0, -0.47f, 0);
                c.height = 0.95f;
                c.radius = 0.09f;
                AddHitbox(leg.gameObject, 0.6f, false, false);
            }

            foreach (var arm in new[] { r.armL, r.armR })
            {
                var c = arm.gameObject.AddComponent<CapsuleCollider>();
                c.isTrigger = true;
                c.center = new Vector3(0, -armLen / 2f, 0);
                c.height = armLen + 0.03f;
                c.radius = 0.07f;
                AddHitbox(arm.gameObject, 0.5f, false, false);
            }

            return r;
        }

        void AddHitbox(GameObject go, float mult, bool isHead, bool armored)
        {
            var h = go.AddComponent<Hitbox>();
            h.multiplier = mult;
            h.isHead = isHead;
            h.armored = armored;
            h.Owner = this;
        }

        static Transform Pivot(string name, Transform parent, Vector3 pos)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = pos;
            return t;
        }

        static Transform Mesh(Transform parent, Vector3 pos, Vector3 size, Material m, bool shadows, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            if (m != null) r.sharedMaterial = m;
            return go.transform;
        }

        // ---------- Spawn / targets ----------

        public bool Spawn(SiegeDirector owner, Vector3 at)
        {
            director = owner;
            if (!NavMesh.SamplePosition(at, out var hit, 8f, NavMesh.AllAreas)) return false;
            ClearStuckBolts();
            transform.SetPositionAndRotation(hit.position, Quaternion.Euler(0, Random.Range(150f, 210f), 0));
            var s = Def.scale * (Kind == EnemyKind.Ram ? 1f : Random.Range(0.93f, 1.07f));
            transform.localScale = new Vector3(s, s, s);
            foreach (var r in rigs) r.root.gameObject.SetActive(true);
            visibleCarriers = rigs.Count;
            gameObject.SetActive(true);
            agent.enabled = true;
            agent.Warp(hit.position);
            baseSpeed = Random.Range(Def.speedMin, Def.speedMax);
            agent.speed = baseSpeed;
            agent.avoidancePriority = Kind == EnemyKind.Ram ? 10 : Kind == EnemyKind.Brute ? 25 : Random.Range(30, 70);
            hp = Def.hp;
            stagger = 0f;
            attackTimer = Def.ramInterval * Random.Range(0.4f, 1f);
            phase = Random.value * 10f;
            ladder = null;
            climbS = 0f;
            fallVel = 0f;
            agent.isStopped = false;
            var r0 = rigs[0];
            if (Kind == EnemyKind.Runner)
            {
                r0.torso.localRotation = Quaternion.Euler(Random.Range(22f, 32f), 0, Random.Range(-5f, 5f));
            }
            else if (Kind != EnemyKind.Ram)
            {
                r0.torso.localRotation = Quaternion.Euler(Random.Range(8f, 22f), 0, Random.Range(-8f, 8f));
                r0.head.localRotation = Quaternion.Euler(Random.Range(-10f, 20f), 0, Random.Range(-25f, 25f));
            }

            if (Kind == EnemyKind.Climber && director.Ladders.Count > 0 && !director.State.GateBreached)
            {
                ladder = director.PickLadder();
                mode = Mode.ToLadder;
                SetDestination(ladder.ApproachPoint + new Vector3(Random.Range(-2.5f, 2.5f), 0, Random.Range(-2f, 0.5f)));
            }
            else
            {
                AssignGateOrKeep();
            }

            return true;
        }

        void AssignGateOrKeep()
        {
            targetIsKeep = director.State.GateBreached;
            target = director.AssaultPoint(this, targetIsKeep);
            mode = Mode.Walking;
            SetDestination(target);
        }

        /// <summary>The gate fell: anything still marching on it heads for the keep door instead.</summary>
        public void OnGateBreached()
        {
            if (!Alive) return;
            if (mode is Mode.ToLadder or Mode.WaitLadder)
            {
                // Not on the ladder yet: abandon it and join the push on the keep.
                ladder?.Leave(this);
                ladder = null;
                agent.isStopped = false;
                AssignGateOrKeep();
            }
            else if (mode is Mode.Walking or Mode.Attacking)
            {
                director.ReleaseSlot(this);
                agent.isStopped = false;
                AssignGateOrKeep();
            }
        }

        void SetDestination(Vector3 p)
        {
            target = p;
            if (agent.enabled && agent.isOnNavMesh)
            {
                agent.isStopped = false;
                agent.SetDestination(p);
            }
        }

        // ---------- Damage ----------

        public void TakeHit(in HitInfo hit)
        {
            if (!Alive) return;
            var dmg = hit.Damage;
            if (hit.Armored && !hit.ArmorPiercing) dmg *= Def.armor;
            hp -= dmg;
            if (hp <= 0f)
            {
                Die(hit);
                return;
            }

            if (Kind == EnemyKind.Ram)
            {
                // A carrier drops for every quarter of the crew's HP lost.
                var want = Mathf.Clamp(Mathf.CeilToInt(Hp01 * rigs.Count), 1, rigs.Count);
                while (visibleCarriers > want)
                {
                    visibleCarriers--;
                    rigs[visibleCarriers].root.gameObject.SetActive(false);
                }

                return;
            }

            // Fire ticks (tiny per-frame damage) don't stagger; real hits do. Brutes shrug most of it off.
            if (dmg < 10f) return;
            var st = hit.Headshot ? 0.7f : 0.45f;
            if (Kind == EnemyKind.Brute) st *= 0.35f;
            if (OnLadder) st *= 0.5f;
            stagger = Mathf.Max(stagger, st);
        }

        void Die(in HitInfo hit)
        {
            director?.ReleaseSlot(this);
            if (ladder != null) ladder.Leave(this);
            var wasHigh = mode is Mode.Climbing or Mode.Vaulting or Mode.OnWall;
            mode = Mode.Dead;
            deadTime = 0f;
            fallVel = 0f;
            if (agent.enabled) agent.enabled = false;
            groundY = transform.position.y;
            if (wasHigh && Physics.Raycast(transform.position + Up * 0.3f, Vector3.down, out var g, 40f, ~(1 << 2), QueryTriggerInteraction.Ignore))
                groundY = g.point.y;
            var flatDir = new Vector3(hit.Direction.x, 0, hit.Direction.z);
            if (flatDir.sqrMagnitude < 0.01f) flatDir = -transform.forward;
            deathFrom = transform.rotation;
            if (Kind == EnemyKind.Ram)
            {
                deathTo = Quaternion.Euler(0, 0, Random.Range(-6f, 6f)) * deathFrom;
                foreach (var r in rigs) r.root.gameObject.SetActive(false);
            }
            else
            {
                // Topple in the direction the hit was travelling.
                var axis = Vector3.Cross(Up, flatDir.normalized);
                deathTo = Quaternion.AngleAxis(88f, axis) * deathFrom;
            }

            director?.OnZombieKilled(this, hit);
        }

        /// <summary>The ladder was shoved off the wall: fall and die.</summary>
        public void KnockOffLadder()
        {
            if (!Alive) return;
            ladder = null; // the ladder already cleared its list
            var info = new HitInfo { Damage = 9999f, Direction = Vector3.back, Source = DamageSource.Environment, SourceId = "ladder", Point = transform.position };
            hp = 0f;
            Die(info);
        }

        // ---------- Behaviour ----------

        void Update()
        {
            var dt = Time.deltaTime;
            if (mode == Mode.Dead)
            {
                UpdateDead(dt);
                return;
            }

            stagger = Mathf.Max(0f, stagger - dt);
            switch (mode)
            {
                case Mode.Walking: TickWalking(); break;
                case Mode.Attacking: TickAttacking(dt); break;
                case Mode.ToLadder: TickToLadder(); break;
                case Mode.WaitLadder: TickWaitLadder(); break;
                case Mode.Climbing: TickClimbing(dt); break;
                case Mode.Vaulting: TickVaulting(dt); break;
                case Mode.OnWall: TickOnWall(dt); break;
            }

            Animate(dt);
        }

        void TickWalking()
        {
            var flat = transform.position - target;
            flat.y = 0;
            var arrive = Kind == EnemyKind.Ram ? 1.2f : 2.2f;
            if (!agent.pathPending && (flat.magnitude < arrive || (agent.hasPath && agent.remainingDistance < 0.5f)))
            {
                mode = Mode.Attacking;
                agent.isStopped = true;
                return;
            }

            var gait = Kind == EnemyKind.Runner ? 1f : 0.65f + 0.35f * Mathf.Abs(Mathf.Sin(phase * 0.5f));
            agent.isStopped = stagger > 0f;
            agent.speed = baseSpeed * gait;
        }

        void TickAttacking(float dt)
        {
            var face = target + Vector3.forward * 3f - transform.position;
            face.y = 0;
            if (face.sqrMagnitude > 0.01f)
                transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(face), 180f * dt);
            if (director == null || stagger > 0f) return;
            if (Kind == EnemyKind.Ram)
            {
                attackTimer -= dt;
                if (attackTimer <= 0f)
                {
                    attackTimer = Def.ramInterval;
                    director.DamageAssault(targetIsKeep, Def.ramDamage);
                }

                return;
            }

            if (director.TryClaimSlot(this)) director.DamageAssault(targetIsKeep, Def.gateDps * dt);
        }

        void TickToLadder()
        {
            if (ladder == null || director.State.GateBreached)
            {
                AssignGateOrKeep();
                return;
            }

            var flat = transform.position - ladder.ApproachPoint;
            flat.y = 0;
            if (!agent.pathPending && (flat.magnitude < 3.2f || (agent.hasPath && agent.remainingDistance < 0.5f)))
            {
                mode = Mode.WaitLadder;
                agent.isStopped = true;
            }
            else
            {
                agent.isStopped = stagger > 0f;
                agent.speed = baseSpeed;
            }
        }

        void TickWaitLadder()
        {
            if (ladder == null || director.State.GateBreached)
            {
                ladder?.Leave(this);
                ladder = null;
                agent.isStopped = false;
                AssignGateOrKeep();
                return;
            }

            ladder.RequestRaise();
            if (stagger > 0f || !ladder.TryEnter(this)) return;
            // Walk onto the foot of the ladder; from here on the ladder carries us (no NavMesh).
            agent.enabled = false;
            climbS = 0f;
            mode = Mode.Climbing;
            transform.position = ladder.PointAt(0f);
            transform.rotation = Quaternion.LookRotation(Vector3.forward);
        }

        void TickClimbing(float dt)
        {
            if (ladder == null)
            {
                KnockOffLadder();
                return;
            }

            var before = transform.position;
            var max = ladder.MaxS(this);
            if (stagger <= 0f) climbS = Mathf.Min(max, climbS + Def.climbSpeed / ladder.Length * dt);
            transform.position = ladder.PointAt(climbS);
            climbVel = dt > 0f ? (transform.position - before) / dt : Vector3.zero;
            transform.rotation = Quaternion.LookRotation(Vector3.forward);
            if (climbS >= 0.999f)
            {
                mode = Mode.Vaulting;
                vaultT = 0f;
                vaultFrom = transform.position;
            }
        }

        void TickVaulting(float dt)
        {
            // Over the breastwork through the crenel and down onto the wall walk.
            vaultT += dt / 0.9f;
            var top = new Vector3(vaultFrom.x, director.Layout.wallTop + 1.15f, 0.5f);
            var walk = ladder != null ? ladder.TopWalk : new Vector3(vaultFrom.x, director.Layout.wallTop, 2.4f);
            transform.position = vaultT < 0.5f
                ? Vector3.Lerp(vaultFrom, top, vaultT * 2f)
                : Vector3.Lerp(top, walk, (vaultT - 0.5f) * 2f);
            if (vaultT < 1f) return;
            ladder?.Leave(this);
            ladder = null;
            agent.enabled = true;
            if (!NavMesh.SamplePosition(walk, out var hit, 3f, NavMesh.AllAreas) || !agent.Warp(hit.position))
            {
                Debug.LogWarning("[MarrowRoad] Climber could not find the wall walk NavMesh at " + walk);
            }

            mode = Mode.OnWall;
            repathTimer = 0f;
            attackTimer = 0.5f;
            director.OnClimberTopped(this);
        }

        void TickOnWall(float dt)
        {
            if (!agent.enabled || !agent.isOnNavMesh) return;
            repathTimer -= dt;
            attackTimer -= dt;
            var huntPlayer = director.PlayerHuntable(transform.position, out var playerPos);
            if (huntPlayer)
            {
                var flat = playerPos - transform.position;
                flat.y = 0;
                if (flat.magnitude < 1.5f)
                {
                    agent.isStopped = true;
                    transform.rotation = Quaternion.RotateTowards(transform.rotation, Quaternion.LookRotation(flat.sqrMagnitude > 0.01f ? flat : transform.forward), 360f * dt);
                    if (attackTimer <= 0f && stagger <= 0f)
                    {
                        attackTimer = Def.meleeInterval;
                        director.DamagePlayer(Def.meleeDamage, transform.position);
                    }

                    return;
                }

                if (repathTimer <= 0f)
                {
                    repathTimer = 0.35f;
                    SetDestination(playerPos);
                }

                agent.isStopped = stagger > 0f;
                agent.speed = baseSpeed * 1.1f;
                return;
            }

            // Gate already broken: the wall walk has no way down to the court, so hunt the defender along the wall.
            if (director.State.GateBreached)
            {
                if (repathTimer <= 0f && Mathf.Abs(playerPos.y - transform.position.y) < 2.5f)
                {
                    repathTimer = 1f;
                    SetDestination(playerPos);
                }

                agent.isStopped = stagger > 0f;
                agent.speed = baseSpeed * 1.1f;
                return;
            }

            // Nobody to fight: go and hack at the gate from the gatehouse walk.
            var sab = director.SabotagePoint;
            if (repathTimer <= 0f)
            {
                repathTimer = 1f;
                SetDestination(sab);
            }

            var d = sab - transform.position;
            d.y = 0;
            agent.isStopped = stagger > 0f;
            agent.speed = baseSpeed;
            if (d.magnitude < 2.5f && stagger <= 0f && !director.State.GateBreached) director.DamageAssault(false, Def.gateDps * dt);
        }

        void Animate(float dt)
        {
            var v = Velocity.magnitude;
            var climbing = mode is Mode.Climbing or Mode.Vaulting;
            var attacking = mode == Mode.Attacking || (mode == Mode.OnWall && attackTimer > Def.meleeInterval - 0.4f);
            var waiting = mode == Mode.WaitLadder;
            phase += dt * (1.2f + (climbing ? 3.5f : v * (Kind == EnemyKind.Runner ? 1.8f : 2.6f)));
            var swing = climbing ? Mathf.Sin(phase) : Mathf.Sin(phase) * Mathf.Clamp01(v / 1.2f);
            if (Kind == EnemyKind.Ram)
            {
                for (var i = 0; i < rigs.Count; i++)
                {
                    var r = rigs[i];
                    var sw = Mathf.Sin(phase + i * 1.3f) * Mathf.Clamp01(v / 0.8f);
                    r.legL.localRotation = Quaternion.Euler(sw * 24f, 0, 0);
                    r.legR.localRotation = Quaternion.Euler(-sw * 24f, 0, 0);
                }

                // Draw back, then drive the log forward on the strike.
                var back = Mathf.Sin(phase * 0.5f) * 0.05f;
                if (mode == Mode.Attacking)
                {
                    var k = Mathf.Clamp01(attackTimer / Mathf.Max(0.1f, Def.ramInterval)); // 1 -> 0, strike at 0
                    back = k > 0.15f ? Mathf.Lerp(0f, -0.9f, (1f - k) / 0.85f) : Mathf.Lerp(0.5f, -0.9f, k / 0.15f);
                }

                logPivot.localPosition = new Vector3(0, 1.05f, back);
                return;
            }

            var rr = rigs[0];
            if (climbing)
            {
                rr.legL.localRotation = Quaternion.Euler(-35f + swing * 30f, 0, 0);
                rr.legR.localRotation = Quaternion.Euler(-35f - swing * 30f, 0, 0);
                rr.armL.localRotation = Quaternion.Euler(-160f + swing * 25f, 0, -6f);
                rr.armR.localRotation = Quaternion.Euler(-160f - swing * 25f, 0, 6f);
                rr.hips.localRotation = Quaternion.identity;
                return;
            }

            rr.legL.localRotation = Quaternion.Euler(swing * (Kind == EnemyKind.Runner ? 45f : 28f), 0, 0);
            rr.legR.localRotation = Quaternion.Euler(-swing * (Kind == EnemyKind.Runner ? 45f : 28f), 0, 0);
            float reach, reachR;
            if (attacking)
            {
                reach = -95f + Mathf.Sin(phase * 2.2f) * 45f;
                reachR = -95f + Mathf.Sin(phase * 2.2f + 1.7f) * 45f;
            }
            else if (waiting)
            {
                reach = -150f + Mathf.Sin(phase) * 10f;
                reachR = -150f - Mathf.Sin(phase) * 10f;
            }
            else if (Kind == EnemyKind.Runner)
            {
                reach = -swing * 50f + 10f;
                reachR = swing * 50f + 10f;
            }
            else
            {
                reach = -78f + swing * 8f;
                reachR = -72f - swing * 8f;
            }

            rr.armL.localRotation = Quaternion.Euler(reach, 0, -6f);
            rr.armR.localRotation = Quaternion.Euler(reachR, 0, 6f);
            var lurch = stagger > 0f ? -25f * stagger : Mathf.Sin(phase * 0.5f) * 4f;
            rr.hips.localRotation = Quaternion.Euler(lurch, 0, Mathf.Sin(phase) * 5f);
            rr.hips.localPosition = new Vector3(0, 0.95f - Mathf.Abs(Mathf.Sin(phase)) * 0.04f, 0);
        }

        void UpdateDead(float dt)
        {
            deadTime += dt;
            var y = transform.position.y;
            if (y > groundY + 0.01f)
            {
                fallVel += Ballistics.Gravity * dt;
                transform.position = new Vector3(transform.position.x, Mathf.Max(groundY, y - fallVel * dt), transform.position.z);
            }

            var t = Mathf.Clamp01(deadTime / 0.8f);
            transform.rotation = Quaternion.Slerp(deathFrom, deathTo, t * t);
            if (Kind != EnemyKind.Ram)
            {
                var r = rigs[0];
                r.armL.localRotation = Quaternion.Slerp(r.armL.localRotation, Quaternion.Euler(-160f, 0, -20f), dt * 3f);
                r.armR.localRotation = Quaternion.Slerp(r.armR.localRotation, Quaternion.Euler(-150f, 0, 25f), dt * 3f);
            }

            if (deadTime > 7f) transform.position += Vector3.down * (dt * 0.5f);
            if (deadTime > 9.5f) Despawn();
        }

        public void Despawn()
        {
            if (agent.enabled) agent.enabled = false;
            director?.ReleaseSlot(this);
            if (ladder != null) ladder.Leave(this);
            ladder = null;
            mode = Mode.Dead;
            ClearStuckBolts();
            gameObject.SetActive(false);
            director?.OnZombieDespawned(this);
        }

        void ClearStuckBolts()
        {
            foreach (var b in GetComponentsInChildren<Bolt>(true)) b.Recycle();
        }
    }
}
