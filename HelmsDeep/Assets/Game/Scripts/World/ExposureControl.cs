using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace MarrowRoad
{
    /// <summary>
    /// Applies the player's brightness setting (EV offset) on top of the authored post-exposure
    /// of every global volume. The authored value is captured once so the offset never compounds.
    /// </summary>
    public sealed class ExposureControl : MonoBehaviour
    {
        ColorAdjustments ca;
        float authored;
        float applied = float.NaN;

        void Start()
        {
            foreach (var v in FindObjectsByType<Volume>(FindObjectsSortMode.None))
            {
                var profile = v.profile; // runtime instance; never touches the asset on disk
                if (profile != null && profile.TryGet(out ca))
                {
                    authored = ca.postExposure.value;
                    break;
                }
            }
        }

        void LateUpdate()
        {
            if (ca == null) return;
            var want = authored + GameSettings.Brightness;
            if (Mathf.Approximately(want, applied)) return;
            ca.postExposure.Override(want);
            applied = want;
        }
    }
}
