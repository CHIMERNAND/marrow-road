using UnityEngine;
using UnityEngine.InputSystem;

namespace MarrowRoad
{
    /// <summary>
    /// Graybox HUD drawn with IMGUI: title, crosshair with bolt-drop ticks, hit markers, gate/gold/wave,
    /// build prompt, pause/options, and results. Replaced by a real UI pass in M3.
    /// </summary>
    public sealed class SiegeHud : MonoBehaviour
    {
        static readonly float[] TickRanges = { 50f, 75f, 100f };
        SiegeDirector d;
        GUIStyle big, mid, small, label, center, button, toggle;
        Texture2D white;
        int lastWave;
        float waveBanner;

        void Start()
        {
            d = SiegeDirector.Instance;
            white = Texture2D.whiteTexture;
        }

        void Update()
        {
            if (d == null || !d.Ready) return;
            if (d.State.Phase == SiegePhase.Title && d.IntentOverride == null)
            {
                var kb = Keyboard.current;
                var m = Mouse.current;
                if ((kb != null && (kb.enterKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame)) || (m != null && m.leftButton.wasPressedThisFrame))
                    d.StartSiege();
            }

            if (d.State.Wave != lastWave)
            {
                lastWave = d.State.Wave;
                waveBanner = 3.5f;
            }

            waveBanner -= Time.unscaledDeltaTime;
        }

        void Styles()
        {
            if (big != null) return;
            big = new GUIStyle(GUI.skin.label) { fontSize = 64, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            big.normal.textColor = new Color(0.92f, 0.88f, 0.8f);
            mid = new GUIStyle(big) { fontSize = 30, fontStyle = FontStyle.Normal };
            small = new GUIStyle(big) { fontSize = 20, fontStyle = FontStyle.Normal };
            label = new GUIStyle(GUI.skin.label) { fontSize = 22, alignment = TextAnchor.MiddleLeft };
            label.normal.textColor = new Color(0.92f, 0.88f, 0.8f);
            center = new GUIStyle(label) { alignment = TextAnchor.MiddleCenter };
            button = new GUIStyle(GUI.skin.button) { fontSize = 24 };
            toggle = new GUIStyle(GUI.skin.toggle) { fontSize = 22 };
        }

        void OnGUI()
        {
            if (d == null || !d.Ready) return;
            Styles();
            // Lay out against a 1920x1080 reference, scaled to the real screen.
            var scale = Screen.height / 1080f;
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
            var w = Screen.width / scale;
            const float h = 1080f;
            var s = d.State;

            switch (s.Phase)
            {
                case SiegePhase.Title:
                    Fill(new Rect(0, 0, w, h), new Color(0, 0, 0, 0.45f));
                    GUI.Label(new Rect(0, h * 0.26f, w, 90), "MARROW ROAD", big);
                    GUI.Label(new Rect(0, h * 0.26f + 80, w, 40), $"Hold the Deep until dawn. {s.TotalWaves} waves.", mid);
                    GUI.Label(new Rect(0, h * 0.50f, w, 220),
                        "WASD move   Shift sprint   Ctrl crouch   Q/E lean   Walk up to a crenel and look down to lean over\n" +
                        "Left click fire   Right click aim\n" +
                        "At a socket: 1-3 build a turret   F upgrade\n" +
                        "At a raised ladder: F shove it off the wall   Between waves: R repair the gate\n" +
                        "If the gate breaks, the dead go for the keep. Esc pause and options", small);
                    GUI.Label(new Rect(0, h * 0.78f, w, 40), "Click or press Enter to begin", mid);
                    return;
                case SiegePhase.Victory:
                case SiegePhase.Defeat:
                    Results(w, h, s);
                    return;
            }

            DamageVignette(w, h);
            if (d.Vitals.Down)
            {
                Downed(w, h);
                TopBar(w, s);
                if (d.Paused) Pause(w, h);
                return;
            }

            DrawCrosshair(w, h);
            TopBar(w, s);
            DrawVitals(w, h);

            if (s.Phase == SiegePhase.Preparing)
            {
                GUI.Label(new Rect(0, 150, w, 40), $"Wave {s.Wave + 1} in {Mathf.CeilToInt(s.PrepRemaining)}", mid);
                GUI.Label(new Rect(0, 192, w, 30), NextWaveText(s.Wave + 1), center);
                if (s.GateHp < s.MaxGateHp)
                {
                    var txt = s.Gold >= d.RepairCost
                        ? $"R  Repair the gate +{d.RepairAmount:0} ({d.RepairCost} gold)"
                        : $"Gate repair needs {d.RepairCost} gold";
                    if (s.GateBreached) txt += "  -  rebuilding closes the breach";
                    GUI.Label(new Rect(0, 226, w, 30), txt, center);
                }
            }
            else if (waveBanner > 0)
            {
                GUI.Label(new Rect(0, 150, w, 40), $"Wave {s.Wave} of {s.TotalWaves}", mid);
            }

            if (Time.unscaledTime - d.BreachBannerTime < 5f)
            {
                var a = 1f - Mathf.Clamp01((Time.unscaledTime - d.BreachBannerTime - 3.5f) / 1.5f);
                var old = big.normal.textColor;
                big.normal.textColor = new Color(0.9f, 0.25f, 0.18f, a);
                GUI.Label(new Rect(0, h * 0.30f, w, 90), "THE GATE IS BREACHED", big);
                big.normal.textColor = old;
                GUI.Label(new Rect(0, h * 0.30f + 80, w, 40), "Fall back. Hold the keep.", mid);
            }

            Prompts(w, h, s);
            if (d.Paused) Pause(w, h);
        }

        string NextWaveText(int wave)
        {
            var wd = d.Balance.Wave(wave);
            if (wd == null) return "";
            var sb = new System.Text.StringBuilder("Coming: ");
            for (var i = 0; i < wd.groups.Length; i++)
            {
                var g = wd.groups[i];
                if (g.count <= 0) continue;
                var def = d.Balance.Enemy(g.type);
                if (sb.Length > 8) sb.Append("   ");
                sb.Append(g.count).Append(' ').Append(def != null && !string.IsNullOrEmpty(def.name) ? def.name : g.type);
            }

            return sb.ToString();
        }

        void Prompts(float w, float h, SiegeState s)
        {
            var y = h * 0.62f;
            var sock = d.NearestSocket(out var dist);
            if (sock != null && dist <= SiegeDirector.SocketReach)
            {
                if (sock.Occupied)
                {
                    var t = sock.Turret;
                    var title = $"{t.Def.name}  (tier {t.Tier + 1}/{t.Def.tiers.Length})   kills {t.Kills}";
                    GUI.Label(new Rect(0, y, w, 30), title, center);
                    if (t.CanUpgrade)
                        GUI.Label(new Rect(0, y + 32, w, 30), s.Gold >= t.UpgradeCost ? $"F  Upgrade ({t.UpgradeCost} gold)" : $"Upgrade needs {t.UpgradeCost} gold (you have {s.Gold})", center);
                    else
                        GUI.Label(new Rect(0, y + 32, w, 30), "Fully upgraded", center);
                }
                else
                {
                    GUI.Label(new Rect(0, y, w, 30), $"Socket: {sock.socketName.Replace("Socket_", "")}", center);
                    for (var i = 0; i < sock.allow.Length; i++)
                    {
                        var def = d.Balance.Turret(sock.allow[i]);
                        if (def == null) continue;
                        var cost = d.BuildCost(def.id);
                        var line = $"{i + 1}  {def.name}  {cost} gold   {def.blurb}";
                        var c = s.Gold >= cost ? label.normal.textColor : new Color(0.6f, 0.55f, 0.5f);
                        var st = new GUIStyle(center);
                        st.normal.textColor = c;
                        GUI.Label(new Rect(0, y + 32 + i * 30, w, 30), line, st);
                    }
                }

                return;
            }

            var lad = d.NearestShovableLadder(out var ld);
            if (lad != null && ld <= SiegeDirector.LadderReach)
                GUI.Label(new Rect(0, y, w, 30), lad.ClimberCount > 0 ? $"F  Shove the ladder ({lad.ClimberCount} climbing)" : "F  Shove the ladder", center);
        }

        void DrawVitals(float w, float h)
        {
            var v = d.Vitals;
            Fill(new Rect(40, h - 64, 300, 18), new Color(0, 0, 0, 0.55f));
            Fill(new Rect(42, h - 62, 296 * v.Hp01, 14), Color.Lerp(new Color(0.8f, 0.12f, 0.1f), new Color(0.72f, 0.7f, 0.62f), v.Hp01));
            GUI.Label(new Rect(40, h - 96, 300, 30), $"Health  {Mathf.CeilToInt(v.Hp)}", label);
        }

        void DamageVignette(float w, float h)
        {
            var since = Time.time - d.Vitals.LastHitTime;
            var low = 1f - d.Vitals.Hp01;
            var a = Mathf.Max(since < 0.6f ? 0.45f * (1f - since / 0.6f) : 0f, d.Vitals.Down ? 0f : low * low * 0.35f);
            if (a <= 0.01f) return;
            var c = new Color(0.55f, 0.02f, 0.02f, a);
            const float band = 140f;
            Fill(new Rect(0, 0, w, band), c);
            Fill(new Rect(0, h - band, w, band), c);
            Fill(new Rect(0, band, band, h - band * 2), c);
            Fill(new Rect(w - band, band, band, h - band * 2), c);
        }

        void Downed(float w, float h)
        {
            Fill(new Rect(0, 0, w, h), new Color(0.12f, 0, 0, 0.6f));
            GUI.Label(new Rect(0, h * 0.38f, w, 90), "YOU ARE DOWN", big);
            GUI.Label(new Rect(0, h * 0.38f + 84, w, 40), $"Back on the wall in {Mathf.CeilToInt(d.Vitals.DownRemaining)}", mid);
        }

        void TopBar(float w, SiegeState s)
        {
            var keep = s.GateBreached;
            var frac = keep ? s.Keep01 : s.Gate01;
            Fill(new Rect(w / 2 - 260, 24, 520, 22), new Color(0, 0, 0, 0.55f));
            var col = keep
                ? Color.Lerp(new Color(0.85f, 0.1f, 0.1f), new Color(0.85f, 0.45f, 0.2f), frac)
                : Color.Lerp(new Color(0.75f, 0.15f, 0.1f), new Color(0.75f, 0.62f, 0.35f), frac);
            Fill(new Rect(w / 2 - 257, 27, 514 * frac, 16), col);
            GUI.Label(new Rect(w / 2 - 260, 48, 520, 30),
                keep ? $"THE KEEP  {Mathf.CeilToInt(s.KeepHp)} / {s.MaxKeepHp:0}   (gate broken)" : $"Hornburg gate  {Mathf.CeilToInt(s.GateHp)} / {s.MaxGateHp:0}", center);
            GUI.Label(new Rect(40, 24, 400, 30), $"Gold  {s.Gold}", label);
            GUI.Label(new Rect(40, 54, 400, 30), $"Kills  {s.Kills}   Headshots  {s.Headshots}", label);
            var alive = d.Spawner != null ? d.Spawner.Alive.Count : 0;
            GUI.Label(new Rect(w - 380, 24, 340, 30), s.Phase == SiegePhase.Wave ? $"Wave {s.Wave}/{s.TotalWaves}   Dead walking {alive}" : $"Preparing  (wave {s.Wave + 1}/{s.TotalWaves})", label);
            var wpn = d.Weapon;
            if (wpn != null)
            {
                GUI.Label(new Rect(w - 360, 1080 - 80, 320, 30), wpn.Loaded ? "Bolt loaded" : "Spanning...", label);
                Fill(new Rect(w - 360, 1080 - 46, 220, 8), new Color(0, 0, 0, 0.5f));
                Fill(new Rect(w - 360, 1080 - 46, 220 * wpn.Reload01, 8), new Color(0.85f, 0.8f, 0.7f, 0.9f));
            }
        }

        void DrawCrosshair(float w, float h)
        {
            var wpn = d.Weapon;
            var cam = d.Player != null ? d.Player.Cam : null;
            if (wpn == null || cam == null) return;
            var cx = w / 2f;
            var cy = h / 2f;
            var a = Mathf.Lerp(0.85f, 0.35f, wpn.Ads01);
            var col = new Color(1, 1, 1, wpn.Loaded ? a : a * 0.35f);
            var gap = Mathf.Lerp(8f, 3f, wpn.Ads01);
            Fill(new Rect(cx - 1, cy - 1, 2, 2), col);
            Fill(new Rect(cx - gap - 10, cy - 1, 10, 2), col);
            Fill(new Rect(cx + gap, cy - 1, 10, 2), col);
            Fill(new Rect(cx - 1, cy + gap, 2, 8), col);

            // Bolt-drop ticks: put the target on the tick for that range.
            var tanHalf = Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            foreach (var r in TickRanges)
            {
                var ang = Ballistics.DropAngleDeg(r, CrossbowWeapon.BoltSpeed) * Mathf.Deg2Rad;
                var y = cy + Mathf.Tan(ang) / tanHalf * (h / 2f);
                var len = r >= 100f ? 14f : 9f;
                Fill(new Rect(cx - len / 2f, y, len, 2), col);
                GUI.Label(new Rect(cx + len / 2f + 4, y - 11, 60, 22), $"{r:0}", new GUIStyle(label) { fontSize = 14 });
            }

            var since = Time.time - wpn.LastHitTime;
            if (since < 0.25f)
            {
                var hc = wpn.LastHitKilled ? new Color(0.9f, 0.2f, 0.15f) : wpn.LastHitWasHead ? new Color(1f, 0.8f, 0.3f) : Color.white;
                hc.a = 1f - since / 0.25f;
                foreach (var dx in new[] { -1f, 1f })
                foreach (var dy in new[] { -1f, 1f })
                    for (var i = 0; i < 7; i++)
                        Fill(new Rect(cx + dx * (8 + i) - 1, cy + dy * (8 + i) - 1, 2.5f, 2.5f), hc);
            }
        }

        void Pause(float w, float h)
        {
            Fill(new Rect(0, 0, w, h), new Color(0, 0, 0, 0.6f));
            GUI.Label(new Rect(0, h / 2 - 330, w, 60), "Paused", mid);
            // Left column: controls.
            var r = new Rect(w / 2 - 560, h / 2 - 250, 520, 420);
            GUI.Label(new Rect(r.x, r.y, r.width, 30), "Controls", center);
            GUI.Label(new Rect(r.x, r.y + 50, 200, 30), $"Sensitivity {GameSettings.MouseSensitivity:0.00}", label);
            GameSettings.MouseSensitivity = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 62, 300, 20), GameSettings.MouseSensitivity, 0.02f, 0.5f);
            GUI.Label(new Rect(r.x, r.y + 100, 200, 30), $"Field of view {GameSettings.FieldOfView:0}", label);
            GameSettings.FieldOfView = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 112, 300, 20), GameSettings.FieldOfView, 60f, 100f);
            GUI.Label(new Rect(r.x, r.y + 150, 200, 30), $"Brightness {GameSettings.Brightness:+0.0;-0.0;0.0}", label);
            GameSettings.Brightness = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 162, 300, 20), GameSettings.Brightness, -1.5f, 2.5f);
            GameSettings.InvertY = GUI.Toggle(new Rect(r.x, r.y + 200, 300, 30), GameSettings.InvertY, " Invert mouse Y", toggle);

            // Right column: graphics. Applied when the game resumes.
            var g = new Rect(w / 2 + 40, h / 2 - 250, 520, 420);
            GUI.Label(new Rect(g.x, g.y, g.width, 30), "Graphics", center);
            GUI.Label(new Rect(g.x, g.y + 50, 140, 30), "Quality", label);
            for (var i = 0; i < GraphicsOptions.PresetNames.Length; i++)
            {
                var on = GraphicsOptions.Preset == i;
                if (GUI.Toggle(new Rect(g.x + 140 + i * 125, g.y + 48, 118, 36), on, GraphicsOptions.PresetNames[i], button) && !on) GraphicsOptions.Preset = i;
            }

            GUI.Label(new Rect(g.x, g.y + 100, 220, 30), $"Render scale {GraphicsOptions.RenderScale * 100f:0}%", label);
            var rs = GUI.HorizontalSlider(new Rect(g.x + 220, g.y + 112, 300, 20), GraphicsOptions.RenderScale, 0.5f, 1f);
            rs = Mathf.Round(rs * 20f) / 20f;
            if (!Mathf.Approximately(rs, GraphicsOptions.RenderScale)) GraphicsOptions.RenderScale = rs;
            var vs = GUI.Toggle(new Rect(g.x, g.y + 150, 300, 30), GraphicsOptions.VSync, " Vertical sync", toggle);
            if (vs != GraphicsOptions.VSync) GraphicsOptions.VSync = vs;
            GUI.enabled = !GraphicsOptions.VSync;
            var cap = GraphicsOptions.FrameCaps[GraphicsOptions.FrameCapIndex];
            if (GUI.Button(new Rect(g.x, g.y + 195, 520, 40), "Frame cap: " + (cap == 0 ? "Uncapped" : cap + " fps"), button))
                GraphicsOptions.FrameCapIndex = (GraphicsOptions.FrameCapIndex + 1) % GraphicsOptions.FrameCaps.Length;
            GUI.enabled = true;
            var fs = GUI.Toggle(new Rect(g.x, g.y + 250, 300, 30), GraphicsOptions.Fullscreen, " Fullscreen", toggle);
            if (fs != GraphicsOptions.Fullscreen) GraphicsOptions.Fullscreen = fs;
            GUI.Label(new Rect(g.x, g.y + 290, 520, 30), "Graphics changes apply when you resume.", new GUIStyle(label) { fontSize = 16 });

            var by = h / 2 + 200;
            if (GUI.Button(new Rect(w / 2 - 620, by, 400, 48), "Resume", button)) d.SetPaused(false);
            if (GUI.Button(new Rect(w / 2 - 200, by, 400, 48), "Restart", button)) d.Restart();
            if (GUI.Button(new Rect(w / 2 + 220, by, 400, 48), "Quit", button)) Application.Quit();
        }

        void Results(float w, float h, SiegeState s)
        {
            if (Cursor.lockState != CursorLockMode.None && d.IntentOverride == null) SiegeDirector.SetCursorLocked(false);
            Fill(new Rect(0, 0, w, h), new Color(0, 0, 0, 0.55f));
            var won = s.Phase == SiegePhase.Victory;
            GUI.Label(new Rect(0, h * 0.18f, w, 90), won ? "THE DEEP HOLDS" : s.GateBreached ? "THE KEEP HAS FALLEN" : "THE GATE HAS FALLEN", big);
            var mins = Mathf.FloorToInt(s.ElapsedSeconds / 60f);
            var secs = Mathf.FloorToInt(s.ElapsedSeconds % 60f);
            var src = new System.Text.StringBuilder();
            foreach (var kv in s.KillsBySource)
            {
                if (src.Length > 0) src.Append("   ");
                var def = d.Balance.Turret(kv.Key);
                src.Append(def != null ? def.name : kv.Key).Append(' ').Append(kv.Value);
            }

            GUI.Label(new Rect(0, h * 0.32f, w, 320),
                $"Waves survived  {(won ? s.Wave : s.Wave - 1)} / {s.TotalWaves}" + (s.BreachWave > 0 ? $"   (gate broke in wave {s.BreachWave})" : "") + "\n" +
                $"Kills  {s.Kills}  (you {s.PlayerKills}, turrets {s.TurretKills})\n" +
                (src.Length > 0 ? src + "\n" : "") +
                $"Headshots  {s.Headshots}   Accuracy  {s.Accuracy01 * 100f:0}%\n" +
                $"Gold earned  {s.GoldEarned}   spent  {s.GoldSpent}   Times downed  {d.Vitals.Downs}\n" +
                $"Time  {mins}:{secs:00}", mid);
            if (GUI.Button(new Rect(w / 2 - 200, h * 0.74f, 400, 50), "Play again", button)) d.Restart();
            if (GUI.Button(new Rect(w / 2 - 200, h * 0.74f + 62, 400, 50), "Quit", button)) Application.Quit();
        }

        void Fill(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, white);
            GUI.color = old;
        }
    }
}
