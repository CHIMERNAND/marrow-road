using UnityEngine;

namespace MarrowRoad
{
    /// <summary>The Hornburg gate leaves. Shakes when struck and visibly gives as the siege state's gate HP drops.</summary>
    public sealed class GateDoor : MonoBehaviour
    {
        public Transform leafLeft, leafRight;
        Vector3 baseL, baseR;
        float shake;
        float lastHp = -1f;

        void Start()
        {
            if (leafLeft != null) baseL = leafLeft.localPosition;
            if (leafRight != null) baseR = leafRight.localPosition;
        }

        public void Sync(SiegeState state)
        {
            if (lastHp >= 0 && state.GateHp < lastHp) shake = Mathf.Min(1f, shake + (lastHp - state.GateHp) * 0.08f);
            lastHp = state.GateHp;
            var broken = state.GateHp <= 0f;
            var give = 1f - state.Gate01;
            shake = Mathf.MoveTowards(shake, 0f, Time.deltaTime * 2f);
            var jitter = Mathf.Sin(Time.time * 47f) * 0.03f * shake;
            if (leafLeft != null)
            {
                leafLeft.localPosition = baseL + new Vector3(0, 0, 0.25f * give + jitter);
                leafLeft.localRotation = broken ? Quaternion.Euler(0, -70f, 0) : Quaternion.Euler(0, -3f * give, 0);
            }

            if (leafRight != null)
            {
                leafRight.localPosition = baseR + new Vector3(0, 0, 0.25f * give - jitter);
                leafRight.localRotation = broken ? Quaternion.Euler(0, 70f, 0) : Quaternion.Euler(0, 3f * give, 0);
            }
        }
    }
}
