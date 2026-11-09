using UnityEngine;

namespace HelmsDeep
{
    public sealed class CrossbowViewModel : MonoBehaviour
    {
        Transform _root;
        Transform _string;
        Transform _bolt;
        float _recoil;
        float _crank;

        public void Build(Camera camera)
        {
            _root = new GameObject("CrossbowVM").transform;
            _root.SetParent(camera.transform, false);
            _root.localPosition = new Vector3(0.32f, -0.32f, 0.62f);
            _root.localRotation = Quaternion.Euler(4f, -6f, -3f);

            // Arms
            var armL = Proc.Box("ArmFleshL", _root, new Vector3(-0.18f, -0.12f, 0.05f), new Vector3(0.12f, 0.12f, 0.35f),
                new Color(0.45f, 0.32f, 0.25f), Quaternion.Euler(12f, 8f, 0f));
            var armR = Proc.Box("ArmFleshR", _root, new Vector3(0.22f, -0.1f, 0.02f), new Vector3(0.12f, 0.12f, 0.32f),
                new Color(0.45f, 0.32f, 0.25f), Quaternion.Euler(8f, -10f, 0f));
            Proc.StripCollider(armL);
            Proc.StripCollider(armR);

            var stock = Proc.Box("Stock", _root, new Vector3(0f, 0f, 0.12f), new Vector3(0.09f, 0.11f, 0.62f), VisualPalette.Wood);
            Proc.StripCollider(stock);
            var cheek = Proc.Box("Cheek", _root, new Vector3(0f, 0.06f, -0.12f), new Vector3(0.08f, 0.08f, 0.22f), VisualPalette.WoodLight);
            Proc.StripCollider(cheek);

            var limbL = Proc.Box("LimbL", _root, new Vector3(-0.32f, 0.06f, 0.32f), new Vector3(0.52f, 0.045f, 0.07f), VisualPalette.WoodLight,
                Quaternion.Euler(0f, 0f, 20f));
            var limbR = Proc.Box("LimbR", _root, new Vector3(0.32f, 0.06f, 0.32f), new Vector3(0.52f, 0.045f, 0.07f), VisualPalette.WoodLight,
                Quaternion.Euler(0f, 0f, -20f));
            Proc.StripCollider(limbL);
            Proc.StripCollider(limbR);

            var iron = Proc.Box("Prod", _root, new Vector3(0f, 0.05f, 0.34f), new Vector3(0.7f, 0.03f, 0.03f), VisualPalette.Iron);
            Proc.StripCollider(iron);

            _string = Proc.Box("String", _root, new Vector3(0f, 0.06f, 0.2f), new Vector3(0.58f, 0.012f, 0.012f), Color.white).transform;
            Proc.StripCollider(_string.gameObject);

            var stirrup = Proc.Box("Stirrup", _root, new Vector3(0f, -0.06f, 0.42f), new Vector3(0.14f, 0.09f, 0.05f), VisualPalette.Iron);
            Proc.StripCollider(stirrup);

            _bolt = Proc.Cyl("LoadedBolt", _root, new Vector3(0f, 0.08f, 0.08f), new Vector3(0.028f, 0.26f, 0.028f), VisualPalette.Gold,
                Quaternion.Euler(90f, 0f, 0f)).transform;
            Proc.StripCollider(_bolt.gameObject);
            BattlementBuilder.SetEmissive(_bolt.gameObject, VisualPalette.Gold, 1.1f);

            var tip = Proc.Sphere("Broadhead", _root, new Vector3(0f, 0.08f, 0.34f), Vector3.one * 0.05f, VisualPalette.Iron);
            Proc.StripCollider(tip);
        }

        public void PulseRecoil()
        {
            _recoil = 1f;
            _crank = 1f;
        }

        void Update()
        {
            if (_root == null) return;
            _recoil = Mathf.MoveTowards(_recoil, 0f, Time.deltaTime * 5f);
            _crank = Mathf.MoveTowards(_crank, 0f, Time.deltaTime * 2.5f);
            _root.localPosition = new Vector3(0.32f, -0.32f - _recoil * 0.02f, 0.62f - _recoil * 0.1f);
            _root.localRotation = Quaternion.Euler(4f + _recoil * 6f, -6f, -3f);
            if (_string != null)
            {
                _string.localPosition = new Vector3(0f, 0.06f, 0.2f - _crank * 0.08f);
                _string.localScale = new Vector3(0.58f - _crank * 0.1f, 0.012f, 0.012f);
            }

            if (_bolt != null)
            {
                _bolt.localScale = Vector3.Lerp(new Vector3(0.028f, 0.26f, 0.028f), Vector3.zero, _recoil);
            }
        }

        public void SetAmmoTint(BoltAmmoType ammo)
        {
            if (_bolt == null) return;
            var color = ammo switch
            {
                BoltAmmoType.Fire => new Color(1f, 0.38f, 0.05f),
                BoltAmmoType.Frost => new Color(0.22f, 0.75f, 1f),
                BoltAmmoType.Scatter => new Color(0.66f, 0.33f, 0.95f),
                _ => VisualPalette.Gold
            };
            BattlementBuilder.SetColor(_bolt.gameObject, color);
            BattlementBuilder.SetEmissive(_bolt.gameObject, color, 1.4f);
        }
    }
}
