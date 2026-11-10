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
                    GUI.Label(new Rect(0, h * 0.28f, w, 90), "MARROW ROAD", big);
                    GUI.Label(new Rect(0, h * 0.28f + 80, w, 40), "Hold the Deep until dawn. Five waves.", mid);
                    GUI.Label(new Rect(0, h * 0.55f, w, 160),
                        "WASD move   Shift sprint   Ctrl crouch   Q/E lean   Walk up to a crenel and look down to lean over\nLeft click fire   Right click aim   F build turret at a socket (150 gold)\nEsc pause and options", small);
                    GUI.Label(new Rect(0, h * 0.75f, w, 40), "Click or press Enter to begin", mid);
                    return;
                case SiegePhase.Victory:
                case SiegePhase.Defeat:
                    Results(w, h, s);
                    return;
            }

            DrawCrosshair(w, h);
            TopBar(w, s);

            if (s.Phase == SiegePhase.Preparing)
                GUI.Label(new Rect(0, 150, w, 40), $"Wave {s.Wave + 1} in {Mathf.CeilToInt(s.PrepRemaining)}", mid);
            else if (waveBanner > 0)
                GUI.Label(new Rect(0, 150, w, 40), $"Wave {s.Wave} of {s.TotalWaves}", mid);

            var sock = d.NearestSocket(out var dist);
            if (sock != null && dist < 3.5f)
            {
                var can = s.Gold >= WallCrossbowTurret.Cost;
                GUI.Label(new Rect(0, h * 0.62f, w, 30), can ? "F  Build wall crossbow (150 gold)" : $"Wall crossbow needs 150 gold (you have {s.Gold})", center);
            }

            if (d.Paused) Pause(w, h);
        }

        void TopBar(float w, SiegeState s)
        {
            Fill(new Rect(w / 2 - 260, 24, 520, 22), new Color(0, 0, 0, 0.55f));
            var g = s.Gate01;
            Fill(new Rect(w / 2 - 257, 27, 514 * g, 16), Color.Lerp(new Color(0.75f, 0.15f, 0.1f), new Color(0.75f, 0.62f, 0.35f), g));
            GUI.Label(new Rect(w / 2 - 260, 48, 520, 30), $"Hornburg gate  {Mathf.CeilToInt(s.GateHp)} / {SiegeState.MaxGateHp:0}", center);
            GUI.Label(new Rect(40, 24, 400, 30), $"Gold  {s.Gold}", label);
            GUI.Label(new Rect(40, 54, 400, 30), $"Kills  {s.Kills}   Headshots  {s.Headshots}", label);
            var alive = d.Spawner != null ? d.Spawner.Alive.Count : 0;
            GUI.Label(new Rect(w - 360, 24, 320, 30), s.Phase == SiegePhase.Wave ? $"Wave {s.Wave}/{s.TotalWaves}   Dead walking {alive}" : "Preparing", label);
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
            var r = new Rect(w / 2 - 260, h / 2 - 250, 520, 500);
            GUI.Label(new Rect(r.x, r.y, r.width, 60), "Paused", mid);
            GUI.Label(new Rect(r.x, r.y + 80, 200, 30), $"Sensitivity {GameSettings.MouseSensitivity:0.00}", label);
            GameSettings.MouseSensitivity = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 92, 300, 20), GameSettings.MouseSensitivity, 0.02f, 0.5f);
            GUI.Label(new Rect(r.x, r.y + 130, 200, 30), $"Field of view {GameSettings.FieldOfView:0}", label);
            GameSettings.FieldOfView = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 142, 300, 20), GameSettings.FieldOfView, 60f, 100f);
            GUI.Label(new Rect(r.x, r.y + 180, 200, 30), $"Brightness {GameSettings.Brightness:+0.0;-0.0;0.0}", label);
            GameSettings.Brightness = GUI.HorizontalSlider(new Rect(r.x + 220, r.y + 192, 300, 20), GameSettings.Brightness, -1.5f, 2.5f);
            GameSettings.InvertY = GUI.Toggle(new Rect(r.x, r.y + 230, 300, 30), GameSettings.InvertY, " Invert mouse Y", toggle);
            if (GUI.Button(new Rect(r.x + 60, r.y + 290, 400, 48), "Resume", button)) d.SetPaused(false);
            if (GUI.Button(new Rect(r.x + 60, r.y + 350, 400, 48), "Restart", button)) d.Restart();
            if (GUI.Button(new Rect(r.x + 60, r.y + 410, 400, 48), "Quit", button)) Application.Quit();
        }

        void Results(float w, float h, SiegeState s)
        {
            if (Cursor.lockState != CursorLockMode.None && d.IntentOverride == null) SiegeDirector.SetCursorLocked(false);
            Fill(new Rect(0, 0, w, h), new Color(0, 0, 0, 0.55f));
            GUI.Label(new Rect(0, h * 0.25f, w, 90), s.Phase == SiegePhase.Victory ? "THE DEEP HOLDS" : "THE GATE HAS FALLEN", big);
            var mins = Mathf.FloorToInt(s.ElapsedSeconds / 60f);
            var secs = Mathf.FloorToInt(s.ElapsedSeconds % 60f);
            GUI.Label(new Rect(0, h * 0.42f, w, 200),
                $"Waves survived  {(s.Phase == SiegePhase.Victory ? s.Wave : s.Wave - 1)} / {s.TotalWaves}\n" +
                $"Kills  {s.Kills}  (you {s.PlayerKills}, turrets {s.TurretKills})\n" +
                $"Headshots  {s.Headshots}   Accuracy  {s.Accuracy01 * 100f:0}%\n" +
                $"Time  {mins}:{secs:00}", mid);
            if (GUI.Button(new Rect(w / 2 - 200, h * 0.72f, 400, 50), "Play again", button)) d.Restart();
            if (GUI.Button(new Rect(w / 2 - 200, h * 0.72f + 62, 400, 50), "Quit", button)) Application.Quit();
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
