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
        Transform rig, stringT, loadedBolt, limbL, limbR, muzzle;
        Vector3 hipPos = new Vector3(0.17f, -0.17f, 0.36f);
        Vector3 adsPos = new Vector3(0f, -0.044f, 0.30f);
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
            Material wood = lib != null ? lib.wood : null, metal = lib != null ? lib.metal : null, rope = lib != null ? lib.rope : null;
            // Stock / tiller, 0.75 m long, butt back past the cheek.
            Part(rig, new Vector3(0, -0.02f, -0.12f), new Vector3(0.045f, 0.05f, 0.62f), wood);
            Part(rig, new Vector3(0, -0.05f, -0.40f), new Vector3(0.05f, 0.11f, 0.16f), wood);
            // Trigger lever under the tiller.
            Part(rig, new Vector3(0, -0.085f, -0.14f), new Vector3(0.012f, 0.012f, 0.18f), metal);
            // Steel prod (two limbs, swept forward), stirrup at the nose.
            var nose = new Vector3(0, 0.0f, 0.2f);
            limbL = Part(rig, nose + new Vector3(-0.17f, 0, -0.03f), new Vector3(0.34f, 0.025f, 0.03f), metal);
            limbR = Part(rig, nose + new Vector3(0.17f, 0, -0.03f), new Vector3(0.34f, 0.025f, 0.03f), metal);
            limbL.localRotation = Quaternion.Euler(0, -12, 0);
            limbR.localRotation = Quaternion.Euler(0, 12, 0);
            Part(rig, nose + new Vector3(0, -0.02f, 0.05f), new Vector3(0.09f, 0.01f, 0.01f), metal);
            // String: drawn back to the nut when loaded.
            stringT = Part(rig, new Vector3(0, 0.012f, -0.02f), new Vector3(0.6f, 0.006f, 0.006f), rope);
            // Rear sight blade and front post, used when aiming down sights.
            Part(rig, new Vector3(0, 0.035f, -0.25f), new Vector3(0.03f, 0.03f, 0.004f), metal);
            Part(rig, new Vector3(0, 0.032f, 0.17f), new Vector3(0.004f, 0.022f, 0.004f), metal);
            // Loaded bolt in the groove.
            loadedBolt = new GameObject("LoadedBolt").transform;
            loadedBolt.SetParent(rig, false);
            loadedBolt.localPosition = new Vector3(0, 0.014f, 0.2f);
            Bolt.BuildVisual(loadedBolt, lib);
            muzzle = new GameObject("Muzzle").transform;
            muzzle.SetParent(rig, false);
            muzzle.localPosition = new Vector3(0, 0.014f, 0.25f);
        }

        static Transform Part(Transform parent, Vector3 pos, Vector3 size, Material m)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
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
            rig.localRotation = Quaternion.Euler(-recoil * 9f + span * 35f, sway.x * 200f, span * -20f + sway.x * 120f);

            // String sits forward (slack) while unloaded, then slides back to the nut.
            var drawn = Loaded ? 1f : Reload01;
            stringT.localPosition = new Vector3(0, 0.012f, Mathf.Lerp(0.17f, -0.02f, drawn));
            stringT.localScale = new Vector3(Mathf.Lerp(0.68f, 0.6f, drawn), 0.006f, 0.006f);
            var flex = Mathf.Lerp(4f, 16f, drawn);
            limbL.localRotation = Quaternion.Euler(0, -flex, 0);
            limbR.localRotation = Quaternion.Euler(0, flex, 0);
        }

        public void MarkKill(bool headshot)
        {
            LastHitKilled = true;
            LastHitWasHead = headshot;
            LastHitTime = Time.time;
        }
    }
}
