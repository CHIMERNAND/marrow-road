using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// The fall-back point: the keep door behind a timber barricade. Barricade planks drop away as the keep HP
    /// falls; when it reaches zero the siege is lost.
    /// </summary>
    public sealed class KeepDoor : MonoBehaviour
    {
        public Transform[] planks = System.Array.Empty<Transform>();
        public Transform door;
        float lastHp = -1f;
        float shake;
        Vector3 doorBase;

        void Start()
        {
            if (door != null) doorBase = door.localPosition;
        }

        public void Sync(SiegeState state)
        {
            if (lastHp >= 0 && state.KeepHp < lastHp) shake = Mathf.Min(1f, shake + (lastHp - state.KeepHp) * 0.08f);
            lastHp = state.KeepHp;
            shake = Mathf.MoveTowards(shake, 0f, Time.deltaTime * 2f);
            var k = state.Keep01;
            for (var i = 0; i < planks.Length; i++)
            {
                if (planks[i] == null) continue;
                // Plank i stays while HP is above its share.
                var keep = k > (i + 1f) / (planks.Length + 1f);
                if (planks[i].gameObject.activeSelf != keep) planks[i].gameObject.SetActive(keep);
            }

            if (door != null) door.localPosition = doorBase + new Vector3(Mathf.Sin(Time.time * 51f) * 0.02f * shake, 0, 0.2f * (1f - k));
        }
    }
}
