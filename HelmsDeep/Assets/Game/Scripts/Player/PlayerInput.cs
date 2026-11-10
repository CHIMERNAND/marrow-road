using UnityEngine;
using UnityEngine.InputSystem;

namespace MarrowRoad
{
    /// <summary>
    /// One frame of player intent. Filled from the local devices, or by the capture bot.
    /// Kept as plain data so a co-op client could send it to the host later.
    /// </summary>
    public struct PlayerIntent
    {
        public Vector2 Move;
        public Vector2 Look;
        public bool Sprint, Crouch, Jump;
        public float Lean;
        public bool Fire, Aim, Build, Pause, Repair;
        /// <summary>1..4 = build the nth turret a free socket allows (number keys).</summary>
        public int BuildChoice;
    }

    public static class LocalInput
    {
        public static PlayerIntent Read(bool allowLook)
        {
            var i = new PlayerIntent();
            var kb = Keyboard.current;
            var mouse = Mouse.current;
            if (kb != null)
            {
                var m = Vector2.zero;
                if (kb.wKey.isPressed) m.y += 1;
                if (kb.sKey.isPressed) m.y -= 1;
                if (kb.dKey.isPressed) m.x += 1;
                if (kb.aKey.isPressed) m.x -= 1;
                i.Move = Vector2.ClampMagnitude(m, 1f);
                i.Sprint = kb.leftShiftKey.isPressed;
                i.Crouch = kb.leftCtrlKey.isPressed || kb.cKey.isPressed;
                i.Jump = kb.spaceKey.wasPressedThisFrame;
                i.Lean = (kb.eKey.isPressed ? 1f : 0f) - (kb.qKey.isPressed ? 1f : 0f);
                i.Build = kb.fKey.wasPressedThisFrame;
                i.Pause = kb.escapeKey.wasPressedThisFrame;
                i.Repair = kb.rKey.wasPressedThisFrame;
                if (kb.digit1Key.wasPressedThisFrame) i.BuildChoice = 1;
                else if (kb.digit2Key.wasPressedThisFrame) i.BuildChoice = 2;
                else if (kb.digit3Key.wasPressedThisFrame) i.BuildChoice = 3;
                else if (kb.digit4Key.wasPressedThisFrame) i.BuildChoice = 4;
            }

            if (mouse != null && allowLook)
            {
                i.Look = mouse.delta.ReadValue();
                i.Fire = mouse.leftButton.wasPressedThisFrame;
                i.Aim = mouse.rightButton.isPressed;
            }

            return i;
        }
    }
}
