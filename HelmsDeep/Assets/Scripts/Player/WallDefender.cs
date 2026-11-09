using UnityEngine;
using UnityEngine.InputSystem;

namespace HelmsDeep
{
    /// <summary>
    /// First-person battlement defender: strafe the wall, aim, fire bolts.
    /// Human input is ignored while Autopilot owns the defender.
    /// </summary>
    public sealed class WallDefender : MonoBehaviour
    {
        [SerializeField] float mouseSensitivity = 0.12f;
        [SerializeField] float strafeSpeed = 14f;
        [SerializeField] float minX = -28f;
        [SerializeField] float maxX = 28f;

        Camera _camera;
        // Positive pitch tilts the camera down onto the approach road.
        float _pitch = 0.42f;
        // Face the valley approach (-Z). Unity forward is +Z, so start turned around.
        float _yaw = Mathf.PI;
        float _cooldown;
        bool _aiming;
        BoltAmmoType _ammo = BoltAmmoType.Bodkin;
        int _selectedSocket = -1;
        CrossbowViewModel _crossbow;

        public bool AutopilotOwned { get; set; }
        public BoltAmmoType CurrentAmmo => _ammo;
        public int SelectedSocket => _selectedSocket;
        public bool IsAiming => _aiming;
        public Camera ViewCamera => _camera;
        public float MinX => minX;
        public float MaxX => maxX;
        public float StrafeSpeed => strafeSpeed;
        public float Yaw => _yaw;
        public float Pitch => _pitch;
        public bool CanFire => _cooldown <= 0f;

        public void Possess(Transform spawn, Camera camera)
        {
            _camera = camera;
            transform.position = spawn.position;
            transform.rotation = spawn.rotation;
            _camera.transform.SetParent(transform, false);
            _camera.transform.localPosition = Vector3.zero;
            _camera.fieldOfView = 65f;
            ApplyLook();

            _crossbow = gameObject.AddComponent<CrossbowViewModel>();
            _crossbow.Build(_camera);
            _crossbow.SetAmmoTint(_ammo);
        }

        void Update()
        {
            var game = SiegeGame.Instance;
            if (game == null) return;

            _cooldown = Mathf.Max(0f, _cooldown - Time.deltaTime);

            if (AutopilotOwned) return;

            if (Mouse.current != null && Mouse.current.leftButton.wasPressedThisFrame &&
                Cursor.lockState != CursorLockMode.Locked &&
                game.Phase is GamePhase.Title or GamePhase.Victory or GamePhase.Defeat)
            {
                BeginFromTitleOrRetry(game);
            }

            if (Keyboard.current != null && Keyboard.current.escapeKey.wasPressedThisFrame)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
                _selectedSocket = -1;
            }

            if (Cursor.lockState != CursorLockMode.Locked) return;
            if (game.Phase is GamePhase.Victory or GamePhase.Defeat) return;

            HandleLook();
            HandleMove();
            HandleCombat();
            HandleBuild(game);
            HandleAbilities(game);
        }

        public void BeginFromTitleOrRetry(SiegeGame game)
        {
            if (game.Phase == GamePhase.Title)
            {
                game.BeginSiege();
            }
            else if (game.Phase is GamePhase.Victory or GamePhase.Defeat)
            {
                game.Restart();
                game.BeginSiege();
            }

            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        public void SetAiming(bool aiming)
        {
            _aiming = aiming;
            if (_camera != null)
            {
                _camera.fieldOfView = Mathf.Lerp(_camera.fieldOfView, _aiming ? 38f : 65f, Time.deltaTime * 12f);
            }
        }

        public void LookToward(Vector3 worldPoint, float turnRate = 8f)
        {
            if (_camera == null) return;
            var to = worldPoint - _camera.transform.position;
            if (to.sqrMagnitude < 0.001f) return;

            var desiredYaw = Mathf.Atan2(to.x, to.z);
            var horizontal = new Vector3(to.x, 0f, to.z).magnitude;
            var desiredPitch = -Mathf.Atan2(to.y, Mathf.Max(0.01f, horizontal));

            _yaw = Mathf.LerpAngle(_yaw * Mathf.Rad2Deg, desiredYaw * Mathf.Rad2Deg, Time.deltaTime * turnRate) * Mathf.Deg2Rad;
            // Match mouse convention: higher world targets => lower pitch value.
            var targetPitch = Mathf.Clamp(-desiredPitch, -0.2f, 1.15f);
            _pitch = Mathf.Lerp(_pitch, targetPitch, Time.deltaTime * turnRate);
            ApplyLook();
            SetAiming(true);
        }

        public void StrafeToward(float worldX)
        {
            var pos = transform.position;
            var targetX = Mathf.Clamp(worldX, minX, maxX);
            pos.x = Mathf.MoveTowards(pos.x, targetX, strafeSpeed * Time.deltaTime);
            transform.position = pos;
        }

        public void SetAmmo(BoltAmmoType ammo)
        {
            _ammo = ammo;
            _crossbow?.SetAmmoTint(ammo);
        }

        public void SelectSocket(int index)
        {
            var grid = FindFirstObjectByType<TurretGrid>();
            if (grid == null || grid.Sockets.Length == 0) return;
            _selectedSocket = Mathf.Clamp(index, 0, grid.Sockets.Length - 1);
            grid.Highlight(_selectedSocket);
        }

        public bool TryBuildSelected(TurretType type)
        {
            if (_selectedSocket < 0) return false;
            var grid = FindFirstObjectByType<TurretGrid>();
            return grid != null && grid.TryBuild(_selectedSocket, type);
        }

        public bool TryFire()
        {
            if (!CanFire || _camera == null) return false;
            FireBolt();
            _crossbow?.PulseRecoil();
            CombatFeedback.Instance?.Shake(0.08f);
            SiegeAudio.Instance?.PlayShot();
            _cooldown = 1f / 2.6f;
            return true;
        }

        void HandleLook()
        {
            var mouse = Mouse.current;
            if (mouse == null) return;

            var delta = mouse.delta.ReadValue();
            _yaw += delta.x * mouseSensitivity * 0.02f;
            _pitch -= delta.y * mouseSensitivity * 0.02f;
            _pitch = Mathf.Clamp(_pitch, -1.2f, 0.55f);
            SetAiming(mouse.rightButton.isPressed);
            ApplyLook();
        }

        void HandleMove()
        {
            var kb = Keyboard.current;
            if (kb == null) return;

            var x = 0f;
            if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) x -= 1f;
            if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) x += 1f;

            var pos = transform.position;
            pos.x = Mathf.Clamp(pos.x + x * strafeSpeed * Time.deltaTime, minX, maxX);
            transform.position = pos;
        }

        void HandleCombat()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.qKey.wasPressedThisFrame)
            {
                SetAmmo((BoltAmmoType)(((int)_ammo + 1) % 4));
            }

            if (Mouse.current == null || !Mouse.current.leftButton.isPressed) return;
            TryFire();
        }

        void HandleBuild(SiegeGame game)
        {
            var kb = Keyboard.current;
            if (kb == null) return;

            if (kb.spaceKey.wasPressedThisFrame) game.CallWaveEarly();
            if (kb.digit5Key.wasPressedThisFrame) CycleSocket(-1);
            if (kb.tabKey.wasPressedThisFrame) CycleSocket(1);
            if (_selectedSocket < 0) return;

            if (kb.zKey.wasPressedThisFrame) TryBuildSelected(TurretType.Repeater);
            if (kb.xKey.wasPressedThisFrame) TryBuildSelected(TurretType.Oil);
            if (kb.cKey.wasPressedThisFrame) TryBuildSelected(TurretType.Mortar);
            if (kb.vKey.wasPressedThisFrame) TryBuildSelected(TurretType.Ballista);
        }

        void HandleAbilities(SiegeGame game)
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            if (kb.digit1Key.wasPressedThisFrame) game.TryUseAbility(AbilityId.OilDump);
            if (kb.digit2Key.wasPressedThisFrame) game.TryUseAbility(AbilityId.CatapultBarrage);
            if (kb.digit3Key.wasPressedThisFrame) game.TryUseAbility(AbilityId.HornOfHelm);
            if (kb.digit4Key.wasPressedThisFrame) game.TryUseAbility(AbilityId.ArcherVolley);
        }

        void CycleSocket(int delta)
        {
            var grid = FindFirstObjectByType<TurretGrid>();
            if (grid == null || grid.Sockets.Length == 0) return;
            if (_selectedSocket < 0) _selectedSocket = 0;
            else _selectedSocket = (_selectedSocket + delta + grid.Sockets.Length) % grid.Sockets.Length;
            grid.Highlight(_selectedSocket);
        }

        void FireBolt()
        {
            if (_camera == null) return;

            var origin = _camera.transform.position + _camera.transform.forward * 0.8f;
            var dir = _camera.transform.forward;
            var damage = _ammo switch
            {
                BoltAmmoType.Bodkin => 56f,
                BoltAmmoType.Fire => 42f,
                BoltAmmoType.Frost => 38f,
                _ => 28f
            };

            if (_ammo == BoltAmmoType.Scatter)
            {
                for (var i = -1; i <= 1; i++)
                {
                    var spread = Quaternion.Euler(0f, i * 4.5f, 0f) * dir;
                    SpawnBolt(origin, spread, damage, pierce: 0);
                }
            }
            else
            {
                var pierce = _ammo == BoltAmmoType.Bodkin ? 2 : 0;
                SpawnBolt(origin, dir, damage, pierce);
            }
        }

        void SpawnBolt(Vector3 origin, Vector3 dir, float damage, int pierce)
        {
            var bolt = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            bolt.name = "Bolt";
            bolt.transform.position = origin;
            bolt.transform.rotation = Quaternion.LookRotation(dir);
            bolt.transform.localScale = new Vector3(0.08f, 0.08f, 0.55f);
            Object.Destroy(bolt.GetComponent<Collider>());
            BattlementBuilder.SetColor(bolt, AmmoColor(_ammo));

            var proj = bolt.AddComponent<BoltProjectile>();
            proj.Init(dir.normalized * 115f, damage, pierce, _ammo, headshotMul: 2.8f);
            Object.Destroy(bolt, 3.5f);
        }

        static Color AmmoColor(BoltAmmoType ammo) => ammo switch
        {
            BoltAmmoType.Fire => new Color(1f, 0.38f, 0.05f),
            BoltAmmoType.Frost => new Color(0.22f, 0.75f, 1f),
            BoltAmmoType.Scatter => new Color(0.66f, 0.33f, 0.95f),
            _ => new Color(1f, 0.85f, 0.25f)
        };

        void ApplyLook()
        {
            transform.rotation = Quaternion.Euler(0f, _yaw * Mathf.Rad2Deg, 0f);
            if (_camera != null)
            {
                _camera.transform.localRotation = Quaternion.Euler(_pitch * Mathf.Rad2Deg, 0f, 0f);
            }
        }
    }
}
