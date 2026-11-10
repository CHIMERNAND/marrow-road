using UnityEngine;

namespace HelmsDeep
{
    public sealed class GateController : MonoBehaviour
    {
        Transform _visual;
        Vector3 _basePos;

        public void Configure(Transform visual)
        {
            _visual = visual;
            _basePos = visual.position;
        }

        public void ResetGate()
        {
            if (_visual == null) return;
            _visual.position = _basePos;
            _visual.localScale = new Vector3(10f, 16f, 1.2f);
            BattlementBuilder.SetColor(_visual.gameObject, VisualPalette.Gate);
        }

        public void SetHpNormalized(float t)
        {
            if (_visual == null) return;
            var damaged = Color.Lerp(new Color(0.18f, 0.04f, 0.04f), VisualPalette.Gate, t);
            BattlementBuilder.SetColor(_visual.gameObject, damaged);
            _visual.localScale = new Vector3(9.2f, Mathf.Lerp(10f, 15.5f, t), 1.1f);
            if (t < 0.35f)
            {
                _visual.position = _basePos + new Vector3(Random.Range(-0.08f, 0.08f), 0f, 0f);
            }
        }
    }
}
