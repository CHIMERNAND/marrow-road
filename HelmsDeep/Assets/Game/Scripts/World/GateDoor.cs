using UnityEngine;
using UnityEngine.AI;

namespace MarrowRoad
{
    /// <summary>
    /// The Hornburg gate leaves. Shakes when struck and visibly gives as the gate HP drops. The leaves are left
    /// out of the NavMesh bake; a carving obstacle blocks the passage until the gate breaks, then opens it so the
    /// dead can pour through to the keep.
    /// </summary>
    public sealed class GateDoor : MonoBehaviour
    {
        public Transform leafLeft, leafRight;
        public NavMeshObstacle blocker;
        Vector3 baseL, baseR;
        float shake;
        float lastHp = -1f;
        float open; // 0 closed .. 1 burst open
        bool breached;

        void Start()
        {
            if (leafLeft != null) baseL = leafLeft.localPosition;
            if (leafRight != null) baseR = leafRight.localPosition;
            if (blocker != null) blocker.enabled = true;
        }

        public void SetBreached(bool value)
        {
            breached = value;
            if (blocker != null) blocker.enabled = !value;
            if (!value) open = 0f;
        }

        public void Sync(SiegeState state)
        {
            if (lastHp >= 0 && state.GateHp < lastHp) shake = Mathf.Min(1f, shake + (lastHp - state.GateHp) * 0.08f);
            lastHp = state.GateHp;
            open = Mathf.MoveTowards(open, breached ? 1f : 0f, Time.deltaTime * 1.5f);
            var give = 1f - state.Gate01;
            shake = Mathf.MoveTowards(shake, 0f, Time.deltaTime * 2f);
            var jitter = Mathf.Sin(Time.time * 47f) * 0.03f * shake;
            var e = open * open * (3f - 2f * open);
            if (leafLeft != null)
            {
                leafLeft.localPosition = baseL + new Vector3(0, 0, 0.25f * give + jitter);
                leafLeft.localRotation = Quaternion.Euler(0, Mathf.Lerp(-3f * give, -78f, e), 0);
            }

            if (leafRight != null)
            {
                leafRight.localPosition = baseR + new Vector3(0, 0, 0.25f * give - jitter);
                leafRight.localRotation = Quaternion.Euler(0, Mathf.Lerp(3f * give, 78f, e), 0);
            }
        }
    }
}
