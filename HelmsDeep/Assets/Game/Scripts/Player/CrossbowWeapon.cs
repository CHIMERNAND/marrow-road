using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Heavy windlass-style crossbow. One bolt, 1.5 s spanning, bolt leaves at 85 m/s and drops under gravity.
    /// Holds the procedural viewmodel and its animation (recoil, spanning, sway, aim-down-sights).
    /// </summary>
    public sealed class CrossbowWeapon : MonoBehaviour
    {
        public const float BoltSpeed = 85f;
        public const float ReloadSeconds = 1.5f;
        public const float BodyDamage = 70f;
        public const float HipFov = 0f;
        public const float AdsFov = 35f;

        public bool Loaded { get; private set; } = true;
        public float Reload01 { get; private set; } = 1f;
        public float Ads01 { get; private set; }
        public float LastHitTime { get; private set; } = -10f;
        public bool LastHitWasHead { get; private set; }
        public bool LastHitKilled { get; private set; }
        public Vector3 Muzzle => muzzle.position;

        FirstPersonController body;
        Transform rig, loadedBolt, muzzle;
        ProcBow bow;
        Vector3 hipPos = new Vector3(0.15f, -0.16f, 0.33f);
        static readonly Vector3 HipEuler = new Vector3(-1.5f, -4f, 5f); // slight inward cant at the hip
        Vector3 adsPos = new Vector3(0f, -0.044f, 0.43f); // rear notch ~18 cm from the eye
        float reloadT = -1f;
        float recoil;
        Vector2 sway;
        SiegeDirector director;

        public static CrossbowWeapon Attach(FirstPersonController body, SiegeDirector director)
        {
            var w = body.gameObject.AddComponent<CrossbowWeapon>();
            w.body = body;
            w.director = director;
            w.BuildRig(body.Cam.transform);
            return w;
        }

        void BuildRig(Transform cam)
        {
            var lib = MaterialLibrary.Instance;
            rig = new GameObject("CrossbowRig").transform;
            rig.SetParent(cam, false);
            rig.localPosition = hipPos;
            Material M(Material a, Material b) => a != null ? a : b;
            Material wood = lib != null ? M(lib.stock, lib.wood) : null;
            Material steel = lib != null ? M(lib.steel, lib.metal) : null;
            Material iron = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            Material glove = lib != null ? M(lib.leather, lib.wood) : null, sleeve = lib != null ? M(lib.wool, lib.dark) : null;
            ProcBow.PartFn P = (parent, pos, size, m) => Part(parent, pos, size, m);

            // Tiller: deep at the lock, slimmer toward the nose; bolt groove along the top.
            Part(rig, new Vector3(0, -0.018f, -0.15f), new Vector3(0.05f, 0.068f, 0.26f), wood);
            Part(rig, new Vector3(0, -0.01f, 0.1f), new Vector3(0.044f, 0.05f, 0.26f), wood);
            Part(rig, new Vector3(0, 0.0158f, 0.08f), new Vector3(0.012f, 0.002f, 0.3f), lib != null ? lib.dark : null);
            // Butt stock, dropping away behind the lock, with an iron butt plate.
            var butt = Part(rig, new Vector3(0, -0.06f, -0.39f), new Vector3(0.046f, 0.1f, 0.24f), wood);
            butt.localRotation = Quaternion.Euler(9f, 0, 0);
            var plate = Part(rig, new Vector3(0, -0.08f, -0.51f), new Vector3(0.05f, 0.11f, 0.012f), iron);
            plate.localRotation = Quaternion.Euler(9f, 0, 0);
            // Lock: side plates, rolling nut, bolt-holding spring and the long trigger lever.
            foreach (var sx in new[] { -1f, 1f })
                Part(rig, new Vector3(sx * 0.0265f, -0.004f, -0.03f), new Vector3(0.004f, 0.045f, 0.08f), iron);
            var nut = Part(rig, new Vector3(0, 0.014f, -0.025f), new Vector3(0.04f, 0.009f, 0.04f), steel, PrimitiveType.Cylinder);
            nut.localRotation = Quaternion.Euler(0, 0, 90f);
            Part(rig, new Vector3(0, 0.02f, 0.0f), new Vector3(0.008f, 0.003f, 0.05f), steel);
            ProcBow.Strut(P, rig, new Vector3(0, -0.055f, -0.06f), new Vector3(0, -0.085f, -0.27f), 0.012f, 0.012f, iron);
            // Rear notch sight on a base plate, front post at the nose (ADS geometry: rear notch ~18 cm from the eye).
            Part(rig, new Vector3(0, 0.019f, -0.25f), new Vector3(0.032f, 0.006f, 0.014f), iron);
            Part(rig, new Vector3(-0.009f, 0.032f, -0.25f), new Vector3(0.01f, 0.022f, 0.004f), iron);
            Part(rig, new Vector3(0.009f, 0.032f, -0.25f), new Vector3(0.01f, 0.022f, 0.004f), iron);
            Part(rig, new Vector3(0, 0.027f, 0.17f), new Vector3(0.004f, 0.032f, 0.004f), iron);
            // Iron nose cap, rope bridle binding the prod, and the spanning stirrup.
            Part(rig, new Vector3(0, -0.01f, 0.225f), new Vector3(0.05f, 0.056f, 0.03f), iron);
            Part(rig, new Vector3(0, 0.008f, 0.205f), new Vector3(0.062f, 0.036f, 0.034f), rope);
            var s0 = new Vector3(0, -0.025f, 0.24f);
            ProcBow.Strut(P, rig, s0 + new Vector3(-0.022f, 0, 0), new Vector3(-0.05f, -0.06f, 0.33f), 0.008f, 0.008f, iron);
            ProcBow.Strut(P, rig, s0 + new Vector3(0.022f, 0, 0), new Vector3(0.05f, -0.06f, 0.33f), 0.008f, 0.008f, iron);
            ProcBow.Strut(P, rig, new Vector3(-0.054f, -0.06f, 0.33f), new Vector3(0.054f, -0.06f, 0.33f), 0.009f, 0.009f, iron);
            // Steel prod: 0.62 m span, recurving back as the string is spanned.
            bow = new ProcBow(rig, new Vector3(0, 0.017f, 0.205f), 0.031f, 0.28f, 7, 0.026f, 0.011f, 0.013f, 14f, 46f, -0.025f, 0.004f, steel, rope, P);

            // Gloved hands: left under the fore-tiller, right on the grip with fingers on the lever.
            Part(rig, new Vector3(-0.004f, -0.05f, 0.06f), new Vector3(0.058f, 0.026f, 0.095f), glove);
            Part(rig, new Vector3(-0.034f, -0.022f, 0.065f), new Vector3(0.02f, 0.05f, 0.088f), glove);
            var thumbL = Part(rig, new Vector3(0.027f, -0.022f, 0.045f), new Vector3(0.016f, 0.02f, 0.055f), glove);
            thumbL.localRotation = Quaternion.Euler(0, -12f, 0);
            Part(rig, new Vector3(-0.02f, -0.07f, -0.005f), new Vector3(0.068f, 0.056f, 0.07f), glove);
            ProcBow.Strut(P, rig, new Vector3(-0.025f, -0.08f, -0.02f), new Vector3(-0.12f, -0.2f, -0.34f), 0.085f, 0.08f, sleeve);
            Part(rig, new Vector3(0.034f, -0.03f, -0.255f), new Vector3(0.026f, 0.066f, 0.09f), glove);
            Part(rig, new Vector3(0.004f, -0.068f, -0.245f), new Vector3(0.058f, 0.026f, 0.08f), glove);
            Part(rig, new Vector3(-0.03f, -0.03f, -0.25f), new Vector3(0.012f, 0.05f, 0.06f), glove);
            ProcBow.Strut(P, rig, new Vector3(0.03f, -0.06f, -0.3f), new Vector3(0.11f, -0.2f, -0.6f), 0.085f, 0.08f, sleeve);

            // Loaded bolt: nock at the nut, head proud of the prod.
            loadedBolt = new GameObject("LoadedBolt").transform;
            loadedBolt.SetParent(rig, false);
            loadedBolt.localPosition = new Vector3(0, 0.022f, 0.37f);
            Bolt.BuildVisual(loadedBolt, lib);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(rig, false);
            muzzle.localPosition = new Vector3(0, 0.022f, 0.4f);
        }

        static Transform Part(Transform parent, Vector3 pos, Vector3 size, Material m, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            Destroy(go.GetComponent<Collider>());
            go.layer = 2;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<MeshRenderer>();
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            if (m != null) r.sharedMaterial = m;
            return go.transform;
        }

        /// <summary>Fire along the camera look ray. Returns true if a bolt left the bow.</summary>
        public bool TryFire()
        {
            if (!Loaded) return false;
            var cam = body.Cam.transform;
            // Bolt starts at the eye so the crosshair is honest; it drops from there.
            Bolt.Fire(cam.position + cam.forward * 0.3f, cam.forward, BoltSpeed, BodyDamage, DamageSource.Player, OnResolved);
            director?.State.RegisterShot(DamageSource.Player);
            Loaded = false;
            LastHitKilled = false;
            loadedBolt.gameObject.SetActive(false);
            recoil = 1f;
            reloadT = 0f;
            Reload01 = 0f;
            return true;
        }

        void OnResolved(HitInfo info, bool hitEnemy)
        {
            if (!hitEnemy) return;
            director?.State.RegisterHit(DamageSource.Player);
            LastHitTime = Time.time;
            LastHitWasHead = info.Headshot;
        }

        public void Tick(in PlayerIntent input, float dt)
        {
            if (input.Fire) TryFire();

            if (!Loaded)
            {
                reloadT += dt;
                Reload01 = Mathf.Clamp01(reloadT / ReloadSeconds);
                if (Reload01 >= 1f)
                {
                    Loaded = true;
                    loadedBolt.gameObject.SetActive(true);
                }
            }

            var wantAds = input.Aim && Loaded && !body.Sprinting;
            Ads01 = Mathf.MoveTowards(Ads01, wantAds ? 1f : 0f, dt * 5f);
            body.ZoomFov = Ads01 > 0.01f ? Mathf.Lerp(GameSettings.FieldOfView, AdsFov, Ads01) : 0f;

            // Sway lags the look input; much tighter when aiming.
            var swayTarget = -input.Look * 0.0006f * (1f - 0.8f * Ads01);
            sway = Vector2.Lerp(sway, Vector2.ClampMagnitude(swayTarget, 0.03f), 1f - Mathf.Exp(-10f * dt));
            recoil = Mathf.MoveTowards(recoil, 0f, dt * 4f);

            // Spanning: bow dips and cants while the string is cranked back.
            var span = Loaded ? 0f : Mathf.Sin(Mathf.Clamp01(Reload01) * Mathf.PI);
            var breathe = Mathf.Sin(Time.time * 1.3f) * 0.0025f * (1f - 0.7f * Ads01);
            var pos = Vector3.Lerp(hipPos, adsPos, Ads01);
            pos += new Vector3(sway.x, sway.y + breathe, 0);
            pos += new Vector3(0.02f, -0.12f, -0.05f) * span;
            pos += new Vector3(0, 0.01f, -0.06f) * recoil;
            rig.localPosition = pos;
            var hip = HipEuler * (1f - Ads01);
            rig.localRotation = Quaternion.Euler(hip.x - recoil * 9f + span * 35f, hip.y + sway.x * 200f, hip.z + span * -20f + sway.x * 120f);

            // String snaps forward on release, then is spanned back to the nut; the prod flexes with it.
            var drawn = Loaded ? 1f : Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.15f, 0.9f, Reload01));
            bow.Set(drawn);
        }

        public void MarkKill(bool headshot)
        {
            LastHitKilled = true;
            LastHitWasHead = headshot;
            LastHitTime = Time.time;
        }
    }
}
