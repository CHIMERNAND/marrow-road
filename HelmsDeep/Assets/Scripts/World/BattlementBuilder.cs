using UnityEngine;

namespace HelmsDeep
{
    /// <summary>
    /// Procedural night siege set: layered curtain wall, gatehouse, valley approach,
    /// torchlight, banners, and fog. Still code-built, but meant to read as a place.
    /// </summary>
    public sealed class BattlementBuilder : MonoBehaviour
    {
        static Material _sharedProc;
        static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        static readonly int EmissionId = Shader.PropertyToID("_EmissionColor");

        public GateController Gate { get; private set; }
        public Transform PlayerSpawn { get; private set; }
        public TurretSocket[] Sockets { get; private set; }

        public void Build()
        {
            EnsureProcMaterial();
            var root = new GameObject("SiegeWorld").transform;
            root.SetParent(transform, false);

            BuildAtmosphere();
            BuildTerrain(root);
            BuildCurtainWall(root);
            BuildGatehouse(root);
            BuildRampartDressing(root);
            BuildSockets(root);
            BuildLighting(root);

            var atmosphere = gameObject.GetComponent<AtmosphereController>() ?? gameObject.AddComponent<AtmosphereController>();
            atmosphere.Build(root);

            var spawn = new GameObject("PlayerSpawn").transform;
            spawn.SetParent(root, false);
            spawn.position = new Vector3(0f, GameBalance.WallY + 1.55f, -7.35f);
            spawn.rotation = Quaternion.Euler(0f, 180f, 0f); // look down the approach road
            PlayerSpawn = spawn;
        }

        static void EnsureProcMaterial()
        {
            if (_sharedProc != null) return;

            // Resources material forces the custom shader into player builds.
            var fromResources = Resources.Load<Material>("HelmsDeepProc");
            if (fromResources != null)
            {
                _sharedProc = fromResources;
                return;
            }

            var shader = Shader.Find("HelmsDeep/ProcColor");
            if (shader == null)
            {
                Debug.LogError("[BattlementBuilder] Missing HelmsDeep/ProcColor shader.");
                return;
            }

            _sharedProc = new Material(shader) { name = "HelmsDeepProcShared" };
        }

        static void BuildAtmosphere()
        {
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = VisualPalette.Ambient * 1.35f;
            RenderSettings.ambientEquatorColor = VisualPalette.Ambient;
            RenderSettings.ambientGroundColor = VisualPalette.Earth;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = VisualPalette.Fog;
            RenderSettings.fogDensity = 0.0022f;

            if (Camera.main != null)
            {
                Camera.main.backgroundColor = VisualPalette.NightSky;
                Camera.main.clearFlags = CameraClearFlags.SolidColor;
                Camera.main.farClipPlane = 320f;
                Camera.main.nearClipPlane = 0.08f;
            }
        }

        static void BuildTerrain(Transform root)
        {
            Proc.Box("ValleyFloor", root, new Vector3(0f, -0.4f, -95f), new Vector3(120f, 1f, 190f), VisualPalette.Earth);
            Proc.Box("ApproachRoad", root, new Vector3(0f, 0.08f, -90f), new Vector3(9.5f, 0.2f, 150f), VisualPalette.Road);

            for (var i = 0; i < 18; i++)
            {
                var z = -20f - i * 8f;
                Proc.Box($"CurbL_{i}", root, new Vector3(-5.1f, 0.22f, z), new Vector3(0.45f, 0.35f, 1.8f), VisualPalette.StoneDark);
                Proc.Box($"CurbR_{i}", root, new Vector3(5.1f, 0.22f, z), new Vector3(0.45f, 0.35f, 1.8f), VisualPalette.StoneDark);
            }

            for (var i = 0; i < 10; i++)
            {
                var z = -25f - i * 14f;
                var h = 6f + (i % 3) * 3.5f;
                Proc.Box($"CliffL_{i}", root, new Vector3(-28f - i * 0.6f, h * 0.5f, z),
                    new Vector3(14f + i % 4, h, 12f), VisualPalette.Cliff, Quaternion.Euler(0f, 12f + i * 3f, 0f));
                Proc.Box($"CliffR_{i}", root, new Vector3(28f + i * 0.6f, h * 0.5f, z),
                    new Vector3(14f + i % 4, h, 12f), VisualPalette.Cliff, Quaternion.Euler(0f, -12f - i * 3f, 0f));
            }

            for (var i = 0; i < 16; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                Proc.Box($"Boulder_{i}", root,
                    new Vector3(side * (8.5f + (i % 5) * 1.7f), 0.7f + (i % 3) * 0.35f, -30f - i * 7.5f),
                    new Vector3(2.2f + i % 3, 1.4f + i % 2, 2.8f + i % 4),
                    Color.Lerp(VisualPalette.Cliff, VisualPalette.StoneDark, (i % 4) / 4f),
                    Quaternion.Euler(i * 11f, i * 29f, i * 7f));
            }

            for (var i = 0; i < 8; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                var x = side * (16f + i * 1.4f);
                var z = -45f - i * 11f;
                var trunk = Proc.Cyl($"Tree_{i}", root, new Vector3(x, 2.2f, z), new Vector3(0.35f, 2.2f, 0.35f), VisualPalette.Wood);
                Proc.StripCollider(trunk);
                Proc.Box($"Branch_{i}a", root, new Vector3(x + side * 0.8f, 3.6f, z), new Vector3(1.8f, 0.18f, 0.18f), VisualPalette.Wood,
                    Quaternion.Euler(0f, 0f, side * -35f));
                Proc.Box($"Branch_{i}b", root, new Vector3(x - side * 0.5f, 4.1f, z + 0.3f), new Vector3(1.2f, 0.14f, 0.14f), VisualPalette.Wood,
                    Quaternion.Euler(20f, 40f, side * 25f));
            }
        }

        static void BuildCurtainWall(Transform root)
        {
            var y = GameBalance.WallY;
            // Layout (valley is -Z): outer face ~-10.8, wall mass ~-8.5, walk ~-7.2, keep ~-5.8
            Proc.Box("CurtainWall", root, new Vector3(0f, y * 0.5f, -8.5f), new Vector3(78f, y, 5.2f), VisualPalette.StoneDark);
            Proc.Box("WallFace", root, new Vector3(0f, y * 0.52f, -10.85f), new Vector3(76f, y * 0.92f, 0.55f), VisualPalette.Stone);

            for (var i = -4; i <= 4; i++)
            {
                if (i == 0) continue;
                Proc.Box($"Buttress_{i}", root, new Vector3(i * 8.5f, y * 0.45f, -10.2f),
                    new Vector3(2.2f, y * 0.9f, 2.4f), VisualPalette.StoneLight);
            }

            Proc.Box("ParapetWalk", root, new Vector3(0f, y + 0.12f, -7.2f), new Vector3(76f, 0.28f, 3.6f), VisualPalette.StoneLight);

            for (var i = -9; i <= 9; i++)
            {
                if (Mathf.Abs(i) < 1) continue;
                Proc.Box($"Merlon_{i}", root, new Vector3(i * 3.9f, y + 1.55f, -10.7f),
                    new Vector3(2.4f, 2.8f, 1.35f), VisualPalette.Stone);
                Proc.Box($"MerlonCap_{i}", root, new Vector3(i * 3.9f, y + 3.05f, -10.7f),
                    new Vector3(2.7f, 0.28f, 1.55f), VisualPalette.StoneLight);
            }

            Proc.Box("InnerRail", root, new Vector3(0f, y + 1.1f, -5.7f), new Vector3(74f, 1.4f, 0.35f), VisualPalette.StoneDark);
            BuildTower(root, "WestTower", new Vector3(-34f, 0f, -8.5f), y + 8f);
            BuildTower(root, "EastTower", new Vector3(34f, 0f, -8.5f), y + 8f);
        }

        static void BuildTower(Transform root, string name, Vector3 basePos, float height)
        {
            var tower = new GameObject(name).transform;
            tower.SetParent(root, false);
            tower.position = basePos;

            Proc.Cyl("Shaft", tower, new Vector3(0f, height * 0.5f, 0f), new Vector3(7.5f, height * 0.5f, 7.5f), VisualPalette.StoneDark);
            Proc.Cyl("Crown", tower, new Vector3(0f, height + 0.4f, 0f), new Vector3(8.4f, 0.45f, 8.4f), VisualPalette.StoneLight);
            for (var i = 0; i < 8; i++)
            {
                var ang = i * 45f * Mathf.Deg2Rad;
                Proc.Box($"Tooth_{i}", tower,
                    new Vector3(Mathf.Cos(ang) * 3.6f, height + 1.5f, Mathf.Sin(ang) * 3.6f),
                    new Vector3(1.5f, 2.2f, 1.5f), VisualPalette.Stone);
            }

            Proc.Box("SlotN", tower, new Vector3(0f, height * 0.65f, -3.6f), new Vector3(0.55f, 2.2f, 0.4f), VisualPalette.Mortar);
            Proc.Box("SlotS", tower, new Vector3(0f, height * 0.45f, 3.6f), new Vector3(0.55f, 2.2f, 0.4f), VisualPalette.Mortar);
        }

        void BuildGatehouse(Transform root)
        {
            var y = GameBalance.WallY;
            var gateRoot = new GameObject("Gatehouse").transform;
            gateRoot.SetParent(root, false);

            Proc.Box("BastionL", gateRoot, new Vector3(-8.5f, y * 0.55f, -9.5f), new Vector3(7f, y * 1.1f, 8f), VisualPalette.Stone);
            Proc.Box("BastionR", gateRoot, new Vector3(8.5f, y * 0.55f, -9.5f), new Vector3(7f, y * 1.1f, 8f), VisualPalette.Stone);
            Proc.Box("BastionCapL", gateRoot, new Vector3(-8.5f, y + 1.2f, -9.5f), new Vector3(7.6f, 0.4f, 8.6f), VisualPalette.StoneLight);
            Proc.Box("BastionCapR", gateRoot, new Vector3(8.5f, y + 1.2f, -9.5f), new Vector3(7.6f, 0.4f, 8.6f), VisualPalette.StoneLight);
            Proc.Box("Lintel", gateRoot, new Vector3(0f, 14.5f, GameBalance.GateZ + 12.4f), new Vector3(12f, 2.2f, 2.4f), VisualPalette.StoneLight);
            Proc.Box("ArchKey", gateRoot, new Vector3(0f, 16.2f, GameBalance.GateZ + 12.4f), new Vector3(2.2f, 1.4f, 2.6f), VisualPalette.Bronze);

            var gateGo = Proc.Box("GreatGate", gateRoot, new Vector3(0f, 8f, GameBalance.GateZ + 12f),
                new Vector3(9.2f, 15.5f, 1.1f), VisualPalette.Gate);
            Proc.Box("GateBand1", gateRoot, new Vector3(0f, 4f, GameBalance.GateZ + 11.35f), new Vector3(9.4f, 0.35f, 0.25f), VisualPalette.Iron);
            Proc.Box("GateBand2", gateRoot, new Vector3(0f, 8f, GameBalance.GateZ + 11.35f), new Vector3(9.4f, 0.35f, 0.25f), VisualPalette.Iron);
            Proc.Box("GateBand3", gateRoot, new Vector3(0f, 12f, GameBalance.GateZ + 11.35f), new Vector3(9.4f, 0.35f, 0.25f), VisualPalette.Iron);
            Proc.Sphere("GateBoss", gateRoot, new Vector3(1.6f, 8f, GameBalance.GateZ + 11.2f), Vector3.one * 0.55f, VisualPalette.Iron);

            Gate = gateGo.AddComponent<GateController>();
            Gate.Configure(gateGo.transform);
            Proc.Box("Machicolation", gateRoot, new Vector3(0f, y + 0.5f, -11.2f), new Vector3(10f, 1.2f, 3.2f), VisualPalette.StoneDark);
        }

        void BuildRampartDressing(Transform root)
        {
            var y = GameBalance.WallY;
            var dress = new GameObject("RampartDressing").transform;
            dress.SetParent(root, false);

            for (var i = -6; i <= 6; i++)
            {
                if (i == 0) continue;
                var x = i * 5.2f;
                var torch = Proc.Cyl($"TorchPole_{i}", dress, new Vector3(x, y + 1.1f, -10.2f),
                    new Vector3(0.12f, 0.7f, 0.12f), VisualPalette.Wood);
                Proc.StripCollider(torch);
                var flame = Proc.Sphere($"Flame_{i}", dress, new Vector3(x, y + 1.85f, -10.2f),
                    Vector3.one * 0.38f, VisualPalette.Torch);
                Proc.StripCollider(flame);
                SetEmissive(flame, VisualPalette.Torch, 2.2f);
                Proc.Point($"TorchLight_{i}", dress, new Vector3(x, y + 1.9f, -11.2f), VisualPalette.Torch, 18f, 2.8f);
            }

            for (var i = -2; i <= 2; i++)
            {
                if (i == 0) continue;
                var x = i * 12f;
                Proc.Box($"BannerPole_{i}", dress, new Vector3(x, y + 3.2f, -10.9f), new Vector3(0.12f, 4.5f, 0.12f), VisualPalette.Wood);
                var banner = Proc.Box($"Banner_{i}", dress, new Vector3(x, y + 2.4f, -11.5f), new Vector3(1.8f, 3.2f, 0.08f), VisualPalette.Banner);
                Proc.StripCollider(banner);
                Proc.Box($"BannerBar_{i}", dress, new Vector3(x, y + 4.1f, -11.5f), new Vector3(2.1f, 0.12f, 0.12f), VisualPalette.Bronze);
            }

            Proc.Box("CrateA", dress, new Vector3(-14f, y + 0.7f, -6.8f), new Vector3(1.4f, 1.2f, 1.4f), VisualPalette.WoodLight);
            Proc.Box("CrateB", dress, new Vector3(-12.6f, y + 0.55f, -6.3f), new Vector3(1.1f, 0.9f, 1.1f), VisualPalette.Wood);
            Proc.Cyl("BarrelA", dress, new Vector3(15f, y + 0.75f, -6.9f), new Vector3(1.1f, 0.75f, 1.1f), VisualPalette.WoodLight);
            Proc.Cyl("BarrelB", dress, new Vector3(16.3f, y + 0.65f, -6.4f), new Vector3(0.95f, 0.65f, 0.95f), VisualPalette.Wood);

            // Shootable powder barrels on the approach — high-risk high-reward
            for (var i = 0; i < 4; i++)
            {
                var side = i % 2 == 0 ? -1f : 1f;
                var pos = new Vector3(side * (7.5f + i * 0.4f), 0.75f, -35f - i * 14f);
                var barrel = Proc.Cyl($"PowderBarrel_{i}", dress, pos, new Vector3(1.1f, 0.75f, 1.1f), new Color(0.35f, 0.16f, 0.08f));
                Proc.Box($"PowderBand_{i}", dress, pos, new Vector3(1.15f, 0.14f, 1.15f), VisualPalette.Iron);
                var fuse = Proc.Sphere($"Fuse_{i}", dress, pos + Vector3.up * 0.85f, Vector3.one * 0.18f, VisualPalette.Torch);
                Proc.StripCollider(fuse);
                SetEmissive(fuse, VisualPalette.Torch, 2f);
                barrel.AddComponent<PowderBarrel>();
            }

            // Walkway powder crates (also detonate)
            for (var i = 0; i < 2; i++)
            {
                var pos = new Vector3(-5f + i * 2.2f, y + 0.7f, -6.2f);
                var barrel = Proc.Cyl($"WallPowder_{i}", dress, pos, new Vector3(0.95f, 0.7f, 0.95f), new Color(0.3f, 0.12f, 0.08f));
                Proc.Box($"WallPowderBand_{i}", dress, pos, new Vector3(1f, 0.12f, 1f), VisualPalette.Iron);
                barrel.AddComponent<PowderBarrel>();
            }
        }

        void BuildSockets(Transform root)
        {
            var defs = new (string name, Vector3 pos)[]
            {
                ("Far West Rampart", new Vector3(-24f, GameBalance.WallY + 0.35f, -9.8f)),
                ("West Gate Bastion", new Vector3(-11f, GameBalance.WallY + 0.35f, -10.2f)),
                ("East Gate Bastion", new Vector3(11f, GameBalance.WallY + 0.35f, -10.2f)),
                ("Far East Rampart", new Vector3(24f, GameBalance.WallY + 0.35f, -9.8f)),
                ("Inner West Barbican", new Vector3(-17.5f, GameBalance.WallY + 0.35f, -9.8f)),
            };

            Sockets = new TurretSocket[defs.Length];
            for (var i = 0; i < defs.Length; i++)
            {
                var padRoot = new GameObject($"Socket_{i}").transform;
                padRoot.SetParent(root, false);
                padRoot.position = defs[i].pos;

                var pad = Proc.Cyl("Pad", padRoot, Vector3.zero, new Vector3(3.4f, 0.16f, 3.4f), VisualPalette.Bronze);
                Proc.Cyl("Ring", padRoot, new Vector3(0f, 0.12f, 0f), new Vector3(3.0f, 0.08f, 3.0f), VisualPalette.Iron);
                Proc.Box("BoltMark", padRoot, new Vector3(0f, 0.18f, 0f), new Vector3(0.8f, 0.05f, 0.8f), VisualPalette.Gold);

                var socket = pad.AddComponent<TurretSocket>();
                socket.Configure(i, defs[i].name);
                Sockets[i] = socket;
            }
        }

        static void BuildLighting(Transform root)
        {
            foreach (var existing in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
            {
                if (existing.type == LightType.Directional) Object.Destroy(existing.gameObject);
            }

            var moon = new GameObject("MoonLight");
            moon.transform.SetParent(root, false);
            moon.transform.rotation = Quaternion.Euler(38f, -40f, 0f);
            var light = moon.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = VisualPalette.Moon;
            light.intensity = 1.35f;
            light.shadows = LightShadows.Soft;
            light.shadowStrength = 0.85f;

            var spotGo = new GameObject("GateSpot");
            spotGo.transform.SetParent(root, false);
            spotGo.transform.position = new Vector3(0f, GameBalance.WallY + 3f, -11f);
            spotGo.transform.rotation = Quaternion.Euler(48f, 180f, 0f);
            var spot = spotGo.AddComponent<Light>();
            spot.type = LightType.Spot;
            spot.color = new Color(1f, 0.78f, 0.45f);
            spot.intensity = 6.5f;
            spot.range = 70f;
            spot.spotAngle = 65f;
            spot.shadows = LightShadows.Soft;
        }

        public static void SetColor(GameObject go, Color color)
        {
            EnsureProcMaterial();
            var renderer = go.GetComponent<MeshRenderer>();
            if (renderer == null || _sharedProc == null) return;

            var mat = new Material(_sharedProc) { name = go.name + "_Mat" };
            mat.SetColor(BaseColorId, color);
            mat.SetColor(EmissionId, Color.black);
            renderer.sharedMaterial = mat;
        }

        public static void SetEmissive(GameObject go, Color color, float intensity)
        {
            EnsureProcMaterial();
            var renderer = go.GetComponent<MeshRenderer>();
            if (renderer == null || _sharedProc == null) return;

            var mat = renderer.sharedMaterial;
            if (mat == null || mat.shader != _sharedProc.shader)
            {
                mat = new Material(_sharedProc);
                renderer.sharedMaterial = mat;
            }
            else
            {
                mat = new Material(mat);
                renderer.sharedMaterial = mat;
            }

            mat.SetColor(BaseColorId, color);
            mat.SetColor(EmissionId, color * intensity);
        }
    }
}
