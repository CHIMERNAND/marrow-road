using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace MarrowRoad
{
    /// <summary>
    /// Grounded first-person body. Realistic pacing: 1.4 m/s walk, 4.2 m/s sprint, 1.7 m eye height.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public sealed class FirstPersonController : MonoBehaviour
    {
        public const float StandHeight = 1.8f;
        public const float CrouchHeight = 1.15f;
        public const float EyeFromTop = 0.1f;

        public float walkSpeed = 1.6f;
        public float sprintSpeed = 4.2f;
        public float crouchSpeed = 0.9f;
        public float jumpHeight = 0.45f;
        public float gravity = 9.81f;

        public Camera Cam { get; private set; }
        public Transform Head { get; private set; }
        public float Yaw { get; private set; }
        public float Pitch { get; private set; }
        public float Speed01 { get; private set; }
        public bool Grounded => cc.isGrounded;
        public bool Sprinting { get; private set; }
        public float ZoomFov { get; set; }

        CharacterController cc;
        Transform leanPivot;
        float verticalVel;
        float height = StandHeight;
        float lean;
        float peek;
        // Body stands ~0.36 m off the stone and the breastwork is 1.0 m thick, so the head must travel
        // ~1.6 m to sit just past the outer face and see the foot of the wall.
        public const float MaxPeek = 1.6f;
        public float Peek => peek;
        float bobPhase;
        Vector3 planarVel;

        public static FirstPersonController Create(Vector3 feet, float yaw)
        {
            var go = new GameObject("Player");
            go.layer = 2; // Ignore Raycast: bolts and turret checks never hit the player.
            go.transform.position = feet;
            var cc = go.AddComponent<CharacterController>();
            cc.height = StandHeight;
            cc.radius = 0.32f;
            cc.center = new Vector3(0, StandHeight / 2f, 0);
            cc.stepOffset = 0.4f;
            cc.slopeLimit = 50f;
            cc.skinWidth = 0.04f;
            var fp = go.AddComponent<FirstPersonController>();
            fp.Yaw = yaw;
            return fp;
        }

        void Awake()
        {
            cc = GetComponent<CharacterController>();
            var head = new GameObject("Head").transform;
            head.SetParent(transform, false);
            head.localPosition = new Vector3(0, StandHeight - EyeFromTop, 0);
            Head = head;
            leanPivot = new GameObject("LeanPivot").transform;
            leanPivot.SetParent(head, false);
            var camGo = new GameObject("PlayerCamera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(leanPivot, false);
            Cam = camGo.AddComponent<Camera>();
            Cam.nearClipPlane = 0.03f;
            Cam.farClipPlane = 1500f;
            Cam.fieldOfView = GameSettings.FieldOfView;
            camGo.AddComponent<AudioListener>();
            var urp = Cam.GetUniversalAdditionalCameraData();
            urp.renderPostProcessing = true;
            urp.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            urp.antialiasingQuality = AntialiasingQuality.High;
        }

        public void Teleport(Vector3 feet, float yaw, float pitch)
        {
            cc.enabled = false;
            transform.position = feet;
            cc.enabled = true;
            Yaw = yaw;
            Pitch = pitch;
            verticalVel = 0;
            planarVel = Vector3.zero;
            peek = 0f;
            ApplyRotation();
        }

        public void SetLook(float yaw, float pitch)
        {
            Yaw = yaw;
            Pitch = Mathf.Clamp(pitch, -85f, 85f);
            ApplyRotation();
        }

        public void Tick(in PlayerIntent input, float dt)
        {
            var sens = GameSettings.MouseSensitivity * (ZoomFov > 0 ? ZoomFov / GameSettings.FieldOfView : 1f);
            Yaw += input.Look.x * sens;
            Pitch += input.Look.y * sens * (GameSettings.InvertY ? 1f : -1f);
            Pitch = Mathf.Clamp(Pitch, -85f, 85f);

            // Crouch height with headroom check.
            var wantH = input.Crouch ? CrouchHeight : StandHeight;
            if (wantH > height)
            {
                var top = transform.position + Vector3.up * height;
                if (Physics.SphereCast(top - Vector3.up * 0.1f, cc.radius * 0.9f, Vector3.up, out _, StandHeight - height + 0.1f, ~(1 << 2), QueryTriggerInteraction.Ignore))
                    wantH = height;
            }

            height = Mathf.MoveTowards(height, wantH, dt * 4f);
            cc.height = height;
            cc.center = new Vector3(0, height / 2f, 0);

            var crouched = height < StandHeight - 0.2f;
            Sprinting = input.Sprint && !crouched && input.Move.y > 0.1f && ZoomFov <= 0f;
            var speed = crouched ? crouchSpeed : Sprinting ? sprintSpeed : walkSpeed;
            if (ZoomFov > 0f) speed = Mathf.Min(speed, crouchSpeed + 0.2f);

            var fwd = Quaternion.Euler(0, Yaw, 0) * Vector3.forward;
            var right = Quaternion.Euler(0, Yaw, 0) * Vector3.right;
            var target = (fwd * input.Move.y + right * input.Move.x) * speed;
            var accel = cc.isGrounded ? 12f : 2f;
            planarVel = Vector3.MoveTowards(planarVel, target, accel * dt);

            if (cc.isGrounded)
            {
                verticalVel = -1f;
                if (input.Jump && !crouched) verticalVel = Mathf.Sqrt(2f * gravity * jumpHeight);
            }
            else
            {
                verticalVel -= gravity * dt;
            }

            cc.Move((planarVel + Vector3.up * verticalVel) * dt);
            Speed01 = planarVel.magnitude / sprintSpeed;

            // Lean: only while not sprinting. Pivot sits at the hips so the head arcs out.
            lean = Mathf.MoveTowards(lean, Sprinting ? 0 : input.Lean, dt * 4f);

            UpdatePeek(dt);

            // Head bob scaled by speed; subtle so it reads as weight, not nausea.
            if (cc.isGrounded) bobPhase += dt * Mathf.Lerp(0f, 11f, planarVel.magnitude / sprintSpeed + 0.25f * Mathf.Min(1f, planarVel.magnitude));
            ApplyRotation();
        }

        /// <summary>
        /// Parapet lean-over. Standing against a breastwork and looking down pushes the head out over it
        /// (like bracing your chest on the stone), so you can see and shoot the wall base and the gate.
        /// A head-height sphere cast stops the head at merlons, so it only works through a crenel.
        /// </summary>
        void UpdatePeek(float dt)
        {
            var want = 0f;
            var fwd = Quaternion.Euler(0, Yaw, 0) * Vector3.forward;
            const int mask = ~(1 << 2);
            if (cc.isGrounded && !Sprinting)
            {
                var chest = transform.position + Vector3.up * 0.7f; // below breastwork top (1.0 m)
                if (Physics.Raycast(chest, fwd, cc.radius + 0.45f, mask, QueryTriggerInteraction.Ignore))
                    want = Mathf.InverseLerp(6f, 40f, Pitch) * MaxPeek;
            }

            var allowed = want;
            if (want > 0f)
            {
                var head = transform.position + Vector3.up * (height - EyeFromTop);
                if (Physics.SphereCast(head, 0.16f, fwd, out var hit, want + 0.05f, mask, QueryTriggerInteraction.Ignore))
                    allowed = Mathf.Max(0f, hit.distance - 0.05f);
            }

            peek = Mathf.Min(Mathf.MoveTowards(peek, allowed, dt * 2.2f), allowed);
        }

        void ApplyRotation()
        {
            transform.rotation = Quaternion.Euler(0, Yaw, 0);
            var eye = height - EyeFromTop;
            var bobAmp = Mathf.Clamp01(planarVel.magnitude / sprintSpeed) * 0.045f;
            var bob = new Vector3(Mathf.Cos(bobPhase * 0.5f) * bobAmp * 0.6f, Mathf.Abs(Mathf.Sin(bobPhase * 0.5f)) * bobAmp, 0);
            Head.localPosition = new Vector3(0, eye - peek * 0.3f, peek) + bob;
            Head.localRotation = Quaternion.Euler(Pitch, 0, 0);
            leanPivot.localPosition = new Vector3(lean * 0.32f, -Mathf.Abs(lean) * 0.05f, 0);
            leanPivot.localRotation = Quaternion.Euler(0, 0, -lean * 11f);
            if (Cam != null)
            {
                var targetFov = ZoomFov > 0 ? ZoomFov : GameSettings.FieldOfView + (Sprinting ? 4f : 0f);
                Cam.fieldOfView = Mathf.Lerp(Cam.fieldOfView, targetFov, 1f - Mathf.Exp(-12f * Time.unscaledDeltaTime));
            }
        }
    }
}
