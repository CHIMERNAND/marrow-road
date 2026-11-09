using UnityEngine;

namespace HelmsDeep
{
    public sealed class SiegeHud : MonoBehaviour
    {
        WallDefender _defender;
        Texture2D _white;

        public void Bind(WallDefender defender) => _defender = defender;

        void OnGUI()
        {
            var game = SiegeGame.Instance;
            if (game == null) return;
            EnsureTextures();

            DrawLetterbox();
            DrawCrosshair(game);
            DrawTopBar(game);
            DrawGateBar(game);
            DrawAbilityStrip(game);
            DrawBottomHints(game);
            DrawCenterPrompt(game);
        }

        void DrawTopBar(SiegeGame game)
        {
            var rec = GameplayRecorder.Instance;
            var auto = AutopilotController.Instance != null && AutopilotController.Instance.Active;
            DrawPanel(new Rect(16, 14, 430, 102), new Color(0.015f, 0.02f, 0.04f, 0.78f));

            GUI.color = new Color(0.95f, 0.86f, 0.58f);
            GUI.Label(new Rect(30, 20, 400, 28), "HELMS DEEP" +
                (rec != null && rec.IsRecording ? "   ● REC" : "") +
                (auto ? "   AUTO" : ""), TitleStyle(22));

            GUI.color = new Color(0.88f, 0.92f, 0.96f);
            GUI.Label(new Rect(30, 50, 400, 55),
                $"{PhaseLabel(game)}    Wave {game.Wave}/{GameBalance.TotalWaves}\n" +
                $"Gold {game.Gold}    Kills {game.Kills}" +
                (game.Headshots > 0 ? $" ({game.Headshots} HS)" : "") +
                $"    Alive {game.EnemiesAlive}",
                BodyStyle(15));
            GUI.color = Color.white;
        }

        void DrawGateBar(SiegeGame game)
        {
            var t = Mathf.Clamp01(game.GateHp / game.MaxGateHp);
            var x = Screen.width * 0.5f - 190f;
            DrawPanel(new Rect(x, 14, 380, 36), new Color(0.015f, 0.02f, 0.04f, 0.78f));
            GUI.color = new Color(0.12f, 0.06f, 0.06f, 0.95f);
            GUI.DrawTexture(new Rect(x + 12, 28, 356, 12), _white);
            GUI.color = Color.Lerp(new Color(0.85f, 0.12f, 0.1f), new Color(0.85f, 0.62f, 0.2f), t);
            GUI.DrawTexture(new Rect(x + 12, 28, 356f * t, 12), _white);
            GUI.color = new Color(0.95f, 0.9f, 0.78f);
            GUI.Label(new Rect(x + 12, 14, 356, 18), $"GREAT GATE   {Mathf.CeilToInt(game.GateHp)} / {Mathf.CeilToInt(game.MaxGateHp)}", BodyStyle(13));
            GUI.color = Color.white;
        }

        void DrawAbilityStrip(SiegeGame game)
        {
            if (game.Phase is GamePhase.Title) return;
            var x = Screen.width - 250f;
            DrawPanel(new Rect(x, 14, 234, 118), new Color(0.015f, 0.02f, 0.04f, 0.78f));
            GUI.color = new Color(0.9f, 0.85f, 0.7f);
            GUI.Label(new Rect(x + 12, 18, 210, 20), "ABILITIES", TitleStyle(14));
            var y = 42f;
            foreach (var a in GameBalance.Abilities)
            {
                var cd = game.AbilityCooldown(a.Id);
                var ready = cd <= 0.01f;
                GUI.color = ready ? new Color(0.95f, 0.8f, 0.35f) : new Color(0.45f, 0.5f, 0.55f);
                var label = ready ? $"{a.Hotkey}  {a.Name}" : $"{a.Hotkey}  {cd:0.0}s";
                GUI.Label(new Rect(x + 12, y, 210, 18), label, BodyStyle(13));
                y += 20f;
            }

            GUI.color = Color.white;
        }

        void DrawBottomHints(SiegeGame game)
        {
            if (_defender == null || game.Phase is not (GamePhase.Preparing or GamePhase.Wave)) return;

            DrawPanel(new Rect(16, Screen.height - 118, 580, 100), new Color(0.015f, 0.02f, 0.04f, 0.78f));
            GUI.color = AmmoColor(_defender.CurrentAmmo);
            GUI.Label(new Rect(30, Screen.height - 110, 540, 24), $"BOLT  {_defender.CurrentAmmo}", TitleStyle(17));
            GUI.color = new Color(0.85f, 0.9f, 0.94f);
            GUI.Label(new Rect(30, Screen.height - 82, 540, 70),
                $"{game.Toast}\nShoot powder barrels for chain clears · RMB aim · Q ammo · Tab+ZXCV build · F9 record",
                BodyStyle(13));
            GUI.color = Color.white;
        }

        void DrawCenterPrompt(SiegeGame game)
        {
            if (game.Phase is not (GamePhase.Title or GamePhase.Victory or GamePhase.Defeat)) return;
            var msg = game.Phase switch
            {
                GamePhase.Victory => "THE DEEP HOLDS\nClick to siege again",
                GamePhase.Defeat => "THE GATE IS BROKEN\nClick to try again",
                _ => "HOLD THE WALL\nClick to begin the night"
            };
            DrawPanel(new Rect(Screen.width * 0.5f - 220, Screen.height * 0.4f, 440, 110), new Color(0.015f, 0.02f, 0.04f, 0.85f));
            GUI.color = new Color(0.95f, 0.86f, 0.58f);
            GUI.Label(new Rect(Screen.width * 0.5f - 200, Screen.height * 0.42f, 400, 90), msg, TitleStyle(22));
            GUI.color = Color.white;
        }

        void DrawCrosshair(SiegeGame game)
        {
            if (game.Phase is GamePhase.Title or GamePhase.Victory or GamePhase.Defeat) return;
            var cx = Screen.width * 0.5f;
            var cy = Screen.height * 0.5f;
            var aiming = _defender != null && _defender.IsAiming;
            var size = aiming ? 11f : 7f;
            GUI.color = aiming ? new Color(1f, 0.55f, 0.2f, 0.95f) : new Color(0.95f, 0.9f, 0.7f, 0.75f);
            GUI.DrawTexture(new Rect(cx - size, cy - 1.5f, size * 2f, 3f), _white);
            GUI.DrawTexture(new Rect(cx - 1.5f, cy - size, 3f, size * 2f), _white);
            if (aiming)
            {
                GUI.DrawTexture(new Rect(cx - 18, cy - 1f, 8f, 2f), _white);
                GUI.DrawTexture(new Rect(cx + 10, cy - 1f, 8f, 2f), _white);
            }

            GUI.color = Color.white;
        }

        void DrawLetterbox()
        {
            GUI.color = new Color(0f, 0f, 0f, 0.45f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, 28), _white);
            GUI.DrawTexture(new Rect(0, Screen.height - 28, Screen.width, 28), _white);
            GUI.color = Color.white;
        }

        void DrawPanel(Rect r, Color c)
        {
            GUI.color = c;
            GUI.DrawTexture(r, _white);
            GUI.color = new Color(0.85f, 0.65f, 0.28f, 0.45f);
            GUI.DrawTexture(new Rect(r.x, r.y, r.width, 2), _white);
            GUI.DrawTexture(new Rect(r.x, r.yMax - 2, r.width, 2), _white);
            GUI.color = Color.white;
        }

        void EnsureTextures()
        {
            if (_white != null) return;
            _white = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            _white.SetPixel(0, 0, Color.white);
            _white.Apply();
        }

        static GUIStyle TitleStyle(int size) => new(GUI.skin.label)
        {
            fontSize = size,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.UpperLeft
        };

        static GUIStyle BodyStyle(int size) => new(GUI.skin.label)
        {
            fontSize = size,
            alignment = TextAnchor.UpperLeft,
            wordWrap = true
        };

        static string PhaseLabel(SiegeGame game) => game.Phase switch
        {
            GamePhase.Preparing => $"PREP {Mathf.CeilToInt(game.PrepRemaining)}s",
            GamePhase.Wave => "UNDER SIEGE",
            GamePhase.Victory => "VICTORY",
            GamePhase.Defeat => "DEFEAT",
            _ => "TITLE"
        };

        static Color AmmoColor(BoltAmmoType ammo) => ammo switch
        {
            BoltAmmoType.Fire => new Color(1f, 0.5f, 0.15f),
            BoltAmmoType.Frost => new Color(0.4f, 0.8f, 1f),
            BoltAmmoType.Scatter => new Color(0.75f, 0.45f, 1f),
            _ => new Color(1f, 0.85f, 0.35f)
        };
    }
}
