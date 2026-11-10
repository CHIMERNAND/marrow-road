using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MarrowRoad.EditorTools
{
    /// <summary>
    /// Builds Assets/Scenes/Siege_Graybox.unity from graybox_layout.json.
    /// Re-runnable: generated meshes, materials and textures live in Assets/Game/Generated.
    /// Menu: Marrow Road > Build Graybox Scene. Batch: -executeMethod MarrowRoad.EditorTools.M1Pipeline.BuildAllBatch
    /// </summary>
    public static class GrayboxBuilder
    {
        public const string ScenePath = "Assets/Scenes/Siege_Graybox.unity";
        const string LayoutPath = "Assets/Game/Data/graybox_layout.json";
        const string Gen = "Assets/Game/Generated";
        const float MerlonW = 1.2f, MerlonGap = 1.1f, MerlonH = 1.2f, BreastH = 1.0f;

        static readonly Dictionary<string, Mesh> MeshCache = new Dictionary<string, Mesh>();
        static MaterialLibrary lib;

        [MenuItem("Marrow Road/Build Graybox Scene")]
        public static void BuildMenu()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            Build();
            EditorSceneManager.OpenScene(ScenePath);
        }

        public static void Build()
        {
            MeshCache.Clear();
            EnsureFolder(Gen);
            EnsureFolder(Gen + "/Meshes");
            EnsureFolder(Gen + "/Materials");
            EnsureFolder(Gen + "/Textures");

            var layoutAsset = AssetDatabase.LoadAssetAtPath<TextAsset>(LayoutPath);
            if (layoutAsset == null) throw new System.Exception("Missing " + LayoutPath);
            var layout = GrayboxLayout.FromJson(layoutAsset.text);

            var grid = MakeGridTexture();
            ConfigureRenderPipeline();
            ConfigurePlayer();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var systems = new GameObject("Systems");
            lib = systems.AddComponent<MaterialLibrary>();
            CreateMaterials(lib, grid);

            var level = new GameObject("Level").transform;
            foreach (var b in layout.boxes) MakeBox(level, b);
            var parapets = new GameObject("Parapets").transform;
            parapets.SetParent(level, false);
            foreach (var p in layout.parapets) MakeParapet(parapets, p, true);
            foreach (var p in layout.rails) MakeParapet(parapets, p, false);

            var gate = MakeGate(level, layout);
            MakeSockets(level, layout);
            MakeDummies(level, layout);
            MakeLighting(layout);
            MakeVolume();

            var director = systems.AddComponent<SiegeDirector>();
            director.layoutJson = layoutAsset;
            director.gate = gate;
            systems.AddComponent<SiegeHud>();
            systems.AddComponent<NightAmbience>();

            // Editor preview camera at the player spawn (disabled by the director at runtime).
            var preview = new GameObject("PreviewCamera");
            var pc = preview.AddComponent<Camera>();
            pc.fieldOfView = 75f;
            pc.farClipPlane = 1500f;
            preview.transform.SetPositionAndRotation(GrayboxLayout.V(layout.playerSpawn.p) + Vector3.up * 1.7f, Quaternion.Euler(4f, layout.playerSpawn.yaw, 0));
            var pdata = pc.GetUniversalAdditionalCameraData();
            pdata.renderPostProcessing = true;

            EditorSceneManager.SaveScene(scene, ScenePath);
            var scenes = new List<EditorBuildSettingsScene> { new EditorBuildSettingsScene(ScenePath, true) };
            foreach (var s in EditorBuildSettings.scenes)
            {
                if (s.path != ScenePath) scenes.Add(new EditorBuildSettingsScene(s.path, false));
            }

            EditorBuildSettings.scenes = scenes.ToArray();
            AssetDatabase.SaveAssets();
            Debug.Log("[MarrowRoad] Graybox scene built: " + ScenePath);
        }

        // ---------- Geometry ----------

        static void MakeBox(Transform parent, LayoutBox b)
        {
            var size = GrayboxLayout.V(b.s);
            var go = new GameObject(b.name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = GrayboxLayout.V(b.p);
            go.transform.localRotation = Quaternion.Euler(GrayboxLayout.V(b.r));
            AddMesh(go, size, lib.ForKind(b.kind), b.kind != "ground");
            if (b.collide)
            {
                var c = go.AddComponent<BoxCollider>();
                c.size = size;
            }

            GameObjectUtility.SetStaticEditorFlags(go, StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic);
        }

        static void AddMesh(GameObject go, Vector3 size, Material m, bool castShadows)
        {
            go.AddComponent<MeshFilter>().sharedMesh = BoxMesh(size);
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = castShadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
        }

        static GameObject Solid(Transform parent, string name, Vector3 center, Vector3 size, Material m, bool collide = true, bool shadows = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = center;
            AddMesh(go, size, m, shadows);
            if (collide) go.AddComponent<BoxCollider>().size = size;
            return go;
        }

        static void MakeParapet(Transform parent, LayoutParapet p, bool merlons)
        {
            var alongZ = p.axis == "z";
            var a0 = alongZ ? p.z0 : p.x0;
            var a1 = alongZ ? p.z1 : p.x1;
            var len = Mathf.Abs(a1 - a0);
            var mid = (a0 + a1) * 0.5f;
            var h = p.height > 0 ? p.height : BreastH;
            var root = new GameObject(p.name).transform;
            root.SetParent(parent, false);
            Vector3 C(float along, float y) => alongZ ? new Vector3(p.x0, y, along) : new Vector3(along, y, p.z);
            Vector3 S(float alongLen, float hh) => alongZ ? new Vector3(p.thick, hh, alongLen) : new Vector3(alongLen, hh, p.thick);
            var breast = Solid(root, "Breastwork", C(mid, p.y + h / 2f), S(len, h), lib.wall);
            GameObjectUtility.SetStaticEditorFlags(breast, StaticEditorFlags.BatchingStatic);
            if (!merlons) return;
            var pitch = MerlonW + MerlonGap;
            var n = Mathf.FloorToInt((len + MerlonGap) / pitch);
            if (n < 1) return;
            var used = n * MerlonW + (n - 1) * MerlonGap;
            var start = Mathf.Min(a0, a1) + (len - used) / 2f + MerlonW / 2f;
            for (var i = 0; i < n; i++)
            {
                var m = Solid(root, "Merlon_" + i, C(start + i * pitch, p.y + h + MerlonH / 2f), S(MerlonW, MerlonH), lib.wall);
                GameObjectUtility.SetStaticEditorFlags(m, StaticEditorFlags.BatchingStatic);
            }
        }

        static GateDoor MakeGate(Transform parent, GrayboxLayout layout)
        {
            var c = GrayboxLayout.V(layout.gateCenter);
            var root = new GameObject("HornburgGate");
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(c.x, 10f, 0.7f);
            var gate = root.AddComponent<GateDoor>();
            Transform Leaf(string name, float x)
            {
                var pivot = new GameObject(name).transform;
                pivot.SetParent(root.transform, false);
                pivot.localPosition = new Vector3(x, 0, 0);
                var off = x < 0 ? 2f : -2f;
                Solid(pivot, "Planks", new Vector3(off, 3.5f, 0), new Vector3(3.96f, 7f, 0.5f), lib.gate);
                for (var i = 0; i < 4; i++)
                    Solid(pivot, "Band_" + i, new Vector3(off, 0.9f + i * 1.75f, -0.28f), new Vector3(3.9f, 0.18f, 0.06f), lib.metal, false);
                return pivot;
            }

            gate.leafLeft = Leaf("LeafW", -4f);
            gate.leafRight = Leaf("LeafE", 4f);
            return gate;
        }

        static void MakeSockets(Transform parent, GrayboxLayout layout)
        {
            foreach (var s in layout.sockets)
            {
                var go = new GameObject(s.name);
                go.transform.SetParent(parent, false);
                go.transform.localPosition = GrayboxLayout.V(s.p);
                go.AddComponent<TurretSocket>().socketName = s.name;
                Solid(go.transform, "Marker", new Vector3(0, 0.02f, 0), new Vector3(1.4f, 0.04f, 1.4f), lib.socket, false, false);
                Solid(go.transform, "Post", new Vector3(0, 0.6f, 0), new Vector3(0.12f, 1.2f, 0.12f), lib.socket, false, false);
            }
        }

        static void MakeDummies(Transform parent, GrayboxLayout layout)
        {
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            foreach (var d in layout.dummies)
            {
                var go = new GameObject(d.name);
                go.transform.SetParent(parent, false);
                go.transform.localPosition = GrayboxLayout.V(d.p);
                go.transform.localRotation = Quaternion.Euler(0, 180f, 0);
                Solid(go.transform, "Legs", new Vector3(0, 0.45f, 0), new Vector3(0.34f, 0.9f, 0.2f), lib.dummy);
                Solid(go.transform, "Torso", new Vector3(0, 1.2f, 0), new Vector3(0.44f, 0.6f, 0.24f), lib.dummy);
                Solid(go.transform, "Head", new Vector3(0, 1.66f, 0), new Vector3(0.2f, 0.28f, 0.22f), lib.dummy);
                var label = new GameObject("Label");
                label.transform.SetParent(go.transform, false);
                label.transform.localPosition = new Vector3(0, 2.1f, 0);
                label.transform.localRotation = Quaternion.Euler(0, 180f, 0);
                var tm = label.AddComponent<TextMesh>();
                tm.text = "1.8 m";
                tm.font = font;
                tm.fontSize = 64;
                tm.characterSize = 0.04f;
                tm.anchor = TextAnchor.LowerCenter;
                tm.color = new Color(1f, 0.75f, 0.3f);
                label.GetComponent<MeshRenderer>().sharedMaterial = font.material;
            }
        }

        // ---------- Lighting / post ----------

        static void MakeLighting(GrayboxLayout layout)
        {
            var moon = new GameObject("Moon").AddComponent<Light>();
            moon.type = LightType.Directional;
            moon.color = new Color(0.62f, 0.7f, 0.95f);
            moon.intensity = 1.0f;
            moon.shadows = LightShadows.Soft;
            moon.shadowStrength = 0.85f;
            moon.transform.rotation = Quaternion.Euler(32f, 22f, 0f);
            RenderSettings.sun = moon;

            var sky = new Material(Shader.Find("Skybox/Procedural"));
            sky.SetFloat("_SunDisk", 1f);
            sky.SetFloat("_SunSize", 0.025f);
            sky.SetFloat("_AtmosphereThickness", 0.55f);
            sky.SetColor("_SkyTint", new Color(0.25f, 0.3f, 0.45f));
            sky.SetColor("_GroundColor", new Color(0.04f, 0.045f, 0.05f));
            sky.SetFloat("_Exposure", 0.26f);
            AssetDatabase.CreateAsset(sky, Gen + "/Materials/NightSky.mat");
            RenderSettings.skybox = sky;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.2f, 0.235f, 0.36f);
            RenderSettings.ambientEquatorColor = new Color(0.11f, 0.12f, 0.155f);
            RenderSettings.ambientGroundColor = new Color(0.045f, 0.045f, 0.055f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.0055f;
            RenderSettings.fogColor = new Color(0.08f, 0.095f, 0.125f);
            RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
            RenderSettings.reflectionIntensity = 0.3f;

            var torches = new GameObject("Torches").transform;
            var i = 0;
            foreach (var t in layout.torchList)
            {
                var p = GrayboxLayout.V(t.p);
                var root = new GameObject("Torch_" + i).transform;
                root.SetParent(torches, false);
                root.localPosition = p;
                Solid(root, "Pole", new Vector3(0, -0.9f, 0), new Vector3(0.08f, 1.8f, 0.08f), lib.wood, false);
                Solid(root, "Flame", new Vector3(0, 0.12f, 0), new Vector3(0.16f, 0.26f, 0.16f), lib.flame, false, false);
                var lg = new GameObject("Light");
                lg.transform.SetParent(root, false);
                lg.transform.localPosition = new Vector3(0, 0.25f, -0.25f);
                var l = lg.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = new Color(1f, 0.58f, 0.28f);
                l.range = 16f;
                l.intensity = 5f;
                l.shadows = i % 4 == 0 ? LightShadows.Soft : LightShadows.None;
                var f = lg.AddComponent<TorchFlicker>();
                f.baseIntensity = 5f;
                i++;
            }
        }

        static void MakeVolume()
        {
            var path = Gen + "/SiegeNightProfile.asset";
            AssetDatabase.DeleteAsset(path);
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            AssetDatabase.CreateAsset(profile, path);
            var tone = profile.Add<Tonemapping>(true);
            tone.mode.Override(TonemappingMode.ACES);
            var bloom = profile.Add<Bloom>(true);
            bloom.threshold.Override(0.95f);
            bloom.intensity.Override(0.55f);
            bloom.scatter.Override(0.65f);
            var vig = profile.Add<Vignette>(true);
            vig.intensity.Override(0.3f);
            vig.smoothness.Override(0.45f);
            var ca = profile.Add<ColorAdjustments>(true);
            ca.postExposure.Override(1.9f);
            ca.contrast.Override(12f);
            ca.saturation.Override(-12f);
            var grain = profile.Add<FilmGrain>(true);
            grain.intensity.Override(0.12f);
            foreach (var comp in profile.components) AssetDatabase.AddObjectToAsset(comp, profile);
            EditorUtility.SetDirty(profile);
            AssetDatabase.SaveAssets();

            var go = new GameObject("PostVolume");
            var v = go.AddComponent<Volume>();
            v.isGlobal = true;
            v.priority = 10;
            v.sharedProfile = profile;
        }

        static void ConfigureRenderPipeline()
        {
            var assets = new List<RenderPipelineAsset>();
            if (GraphicsSettings.defaultRenderPipeline != null) assets.Add(GraphicsSettings.defaultRenderPipeline);
            var levels = QualitySettings.names.Length;
            for (var q = 0; q < levels; q++)
            {
                var rp = QualitySettings.GetRenderPipelineAssetAt(q);
                if (rp != null && !assets.Contains(rp)) assets.Add(rp);
            }

            foreach (var rp in assets)
            {
                if (!(rp is UniversalRenderPipelineAsset urp)) continue;
                if (AssetDatabase.GetAssetPath(urp).Contains("Mobile")) continue;
                var so = new SerializedObject(urp);
                SetFloat(so, "m_ShadowDistance", 160f);
                SetInt(so, "m_ShadowCascadeCount", 4);
                SetInt(so, "m_MainLightShadowmapResolution", 4096);
                SetInt(so, "m_AdditionalLightsPerObjectLimit", 8);
                SetInt(so, "m_AdditionalLightsShadowmapResolution", 4096);
                SetBool(so, "m_AdditionalLightShadowsSupported", true);
                SetBool(so, "m_SoftShadowsSupported", true);
                SetBool(so, "m_SupportsHDR", true);
                so.ApplyModifiedPropertiesWithoutUndo();
                EditorUtility.SetDirty(urp);
                Debug.Log("[MarrowRoad] Configured URP asset " + AssetDatabase.GetAssetPath(urp));
            }
        }

        static void ConfigurePlayer()
        {
            PlayerSettings.productName = "Marrow Road";
            PlayerSettings.companyName = "Clarke Studios";
            PlayerSettings.runInBackground = true;
            PlayerSettings.visibleInBackground = true;
            PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
            PlayerSettings.defaultScreenWidth = 1920;
            PlayerSettings.defaultScreenHeight = 1080;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.bundleVersion = "0.1.0-m1";
        }

        static void SetFloat(SerializedObject so, string n, float v)
        {
            var p = so.FindProperty(n);
            if (p != null) p.floatValue = v;
            else Debug.LogWarning("[MarrowRoad] URP property not found: " + n);
        }

        static void SetInt(SerializedObject so, string n, int v)
        {
            var p = so.FindProperty(n);
            if (p != null) p.intValue = v;
            else Debug.LogWarning("[MarrowRoad] URP property not found: " + n);
        }

        static void SetBool(SerializedObject so, string n, bool v)
        {
            var p = so.FindProperty(n);
            if (p != null) p.boolValue = v;
            else Debug.LogWarning("[MarrowRoad] URP property not found: " + n);
        }

        // ---------- Materials / textures ----------

        static void CreateMaterials(MaterialLibrary l, Texture2D grid)
        {
            l.ground = Lit("Ground", new Color(0.32f, 0.31f, 0.28f), grid, 0.08f);
            l.rock = Lit("Rock", new Color(0.36f, 0.35f, 0.34f), grid, 0.1f);
            l.wall = Lit("Wall", new Color(0.55f, 0.53f, 0.49f), grid, 0.12f);
            l.tower = Lit("Tower", new Color(0.5f, 0.49f, 0.46f), grid, 0.12f);
            l.road = Lit("Road", new Color(0.42f, 0.38f, 0.32f), grid, 0.1f);
            l.dark = Lit("Dark", new Color(0.04f, 0.04f, 0.045f), null, 0.05f);
            l.wood = Lit("Wood", new Color(0.33f, 0.22f, 0.13f), null, 0.2f);
            l.metal = Lit("Metal", new Color(0.28f, 0.29f, 0.31f), null, 0.55f, 0.8f);
            l.rope = Lit("Rope", new Color(0.62f, 0.56f, 0.44f), null, 0.1f);
            l.zombieSkin = Lit("ZombieSkin", new Color(0.42f, 0.45f, 0.36f), null, 0.25f);
            l.zombieCloth = Lit("ZombieCloth", new Color(0.2f, 0.18f, 0.16f), null, 0.08f);
            l.zombieWound = Lit("ZombieWound", new Color(0.3f, 0.05f, 0.04f), null, 0.5f);
            l.dummy = Lit("ScaleDummy", new Color(0.95f, 0.45f, 0.1f), null, 0.2f);
            l.dummy.EnableKeyword("_EMISSION");
            l.dummy.SetColor("_EmissionColor", new Color(0.25f, 0.1f, 0.02f));
            l.socket = Lit("Socket", new Color(0.2f, 0.5f, 0.9f), null, 0.3f);
            l.socket.EnableKeyword("_EMISSION");
            l.socket.SetColor("_EmissionColor", new Color(0.1f, 0.35f, 0.9f) * 1.5f);
            l.gate = Lit("GateWood", new Color(0.28f, 0.19f, 0.11f), grid, 0.15f);
            l.flame = Lit("Flame", new Color(1f, 0.6f, 0.2f), null, 0f);
            l.flame.EnableKeyword("_EMISSION");
            l.flame.SetColor("_EmissionColor", new Color(1f, 0.5f, 0.15f) * 6f);
            l.trail = Lit("BoltTrail", new Color(0.9f, 0.85f, 0.7f), null, 0f);
            l.trail.EnableKeyword("_EMISSION");
            l.trail.SetColor("_EmissionColor", new Color(0.6f, 0.55f, 0.45f));
            foreach (var m in new[] { l.dummy, l.socket, l.flame, l.trail })
            {
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
                EditorUtility.SetDirty(m);
            }
        }

        static Material Lit(string name, Color c, Texture2D tex, float smooth, float metallic = 0f)
        {
            var path = Gen + "/Materials/" + name + ".mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (m == null)
            {
                m = new Material(shader);
                AssetDatabase.CreateAsset(m, path);
            }
            else
            {
                m.shader = shader;
            }

            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", smooth);
            m.SetFloat("_Metallic", metallic);
            if (tex != null)
            {
                m.SetTexture("_BaseMap", tex);
                m.SetTextureScale("_BaseMap", new Vector2(0.25f, 0.25f));
            }
            else
            {
                m.SetTexture("_BaseMap", null);
            }

            m.enableInstancing = true;
            EditorUtility.SetDirty(m);
            return m;
        }

        /// <summary>4 m tile with 1 m lines and a little noise: readable scale on every surface.</summary>
        static Texture2D MakeGridTexture()
        {
            var path = Gen + "/Textures/Grid4m.png";
            const int n = 512;
            var tex = new Texture2D(n, n, TextureFormat.RGBA32, true);
            var px = new Color32[n * n];
            var rng = new System.Random(7);
            for (var y = 0; y < n; y++)
            {
                for (var x = 0; x < n; x++)
                {
                    var v = 0.86f + 0.1f * Mathf.PerlinNoise(x * 0.03f, y * 0.03f) + (float)(rng.NextDouble() * 0.04);
                    var mx = x % 128;
                    var my = y % 128;
                    if (mx < 2 || my < 2) v *= 0.72f;
                    if (x < 4 || y < 4) v *= 0.6f;
                    var b = (byte)Mathf.Clamp(v * 255f, 0, 255);
                    px[y * n + x] = new Color32(b, b, b, 255);
                }
            }

            tex.SetPixels32(px);
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Object.DestroyImmediate(tex);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
            var imp = (TextureImporter)AssetImporter.GetAtPath(path);
            imp.wrapMode = TextureWrapMode.Repeat;
            imp.mipmapEnabled = true;
            imp.anisoLevel = 8;
            imp.filterMode = FilterMode.Trilinear;
            imp.sRGBTexture = true;
            imp.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        /// <summary>Box mesh with UVs in world metres so the grid stays square on every face.</summary>
        static Mesh BoxMesh(Vector3 s)
        {
            var key = $"{s.x:0.###}x{s.y:0.###}x{s.z:0.###}";
            if (MeshCache.TryGetValue(key, out var cached)) return cached;
            var path = Gen + "/Meshes/Box_" + key + ".asset";
            var existing = AssetDatabase.LoadAssetAtPath<Mesh>(path);
            var mesh = existing != null ? existing : new Mesh();
            mesh.Clear();
            mesh.name = "Box_" + key;
            var h = s * 0.5f;
            var verts = new List<Vector3>();
            var norms = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();

            void Face(Vector3 n, Vector3 u, Vector3 v, float uLen, float vLen)
            {
                var c = Vector3.Scale(n, h);
                var hu = u * (uLen * 0.5f);
                var hv = v * (vLen * 0.5f);
                var i = verts.Count;
                verts.Add(c - hu - hv);
                verts.Add(c - hu + hv);
                verts.Add(c + hu + hv);
                verts.Add(c + hu - hv);
                for (var k = 0; k < 4; k++) norms.Add(n);
                uvs.Add(new Vector2(-uLen * 0.5f, -vLen * 0.5f));
                uvs.Add(new Vector2(-uLen * 0.5f, vLen * 0.5f));
                uvs.Add(new Vector2(uLen * 0.5f, vLen * 0.5f));
                uvs.Add(new Vector2(uLen * 0.5f, -vLen * 0.5f));
                tris.AddRange(new[] { i, i + 1, i + 2, i, i + 2, i + 3 });
            }

            // u = cross(n, v): seen from outside, u points right, so BL-TL-TR winds clockwise (Unity front face).
            Face(Vector3.forward, Vector3.left, Vector3.up, s.x, s.y);
            Face(Vector3.back, Vector3.right, Vector3.up, s.x, s.y);
            Face(Vector3.right, Vector3.forward, Vector3.up, s.z, s.y);
            Face(Vector3.left, Vector3.back, Vector3.up, s.z, s.y);
            Face(Vector3.up, Vector3.right, Vector3.forward, s.x, s.z);
            Face(Vector3.down, Vector3.left, Vector3.forward, s.x, s.z);

            mesh.SetVertices(verts);
            mesh.SetNormals(norms);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateTangents();
            mesh.RecalculateBounds();
            if (existing == null) AssetDatabase.CreateAsset(mesh, path);
            else EditorUtility.SetDirty(mesh);
            MeshCache[key] = mesh;
            return mesh;
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path)?.Replace('\\', '/');
            var leaf = Path.GetFileName(path);
            if (!string.IsNullOrEmpty(parent) && !AssetDatabase.IsValidFolder(parent)) EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, leaf);
        }
    }
}
