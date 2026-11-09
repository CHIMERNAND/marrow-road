using UnityEngine;

namespace HelmsDeep
{
    public static class EnemyVisuals
    {
        public static void Build(Transform root, ZombieSpec spec)
        {
            // Clear default capsule mesh look by hiding the root renderer and building a body.
            var rootRenderer = root.GetComponent<MeshRenderer>();
            if (rootRenderer != null) rootRenderer.enabled = false;
            var rootCol = root.GetComponent<CapsuleCollider>();
            if (rootCol != null)
            {
                rootCol.height = 2f;
                rootCol.radius = 0.35f;
                rootCol.center = new Vector3(0f, 1f, 0f);
            }

            var skin = spec.Color;
            var cloth = Color.Lerp(skin, new Color(0.12f, 0.1f, 0.08f), 0.55f);
            var bone = new Color(0.72f, 0.66f, 0.55f);
            var armor = new Color(0.28f, 0.3f, 0.32f);

            switch (spec.Type)
            {
                case ZombieType.Runner:
                    AssembleHumanoid(root, skin, cloth, lean: true, scale: 0.92f);
                    break;
                case ZombieType.Shambler:
                    AssembleHumanoid(root, skin, cloth, lean: false, scale: 1.05f);
                    var shield = Proc.Box("Shield", root, new Vector3(-0.55f, 1.1f, 0.35f),
                        new Vector3(0.12f, 1.1f, 0.7f), VisualPalette.WoodLight);
                    Proc.StripCollider(shield);
                    break;
                case ZombieType.Brute:
                    AssembleHumanoid(root, new Color(0.45f, 0.22f, 0.14f), armor, lean: false, scale: 1.35f, armored: true);
                    break;
                case ZombieType.Banshee:
                    AssembleWraith(root, new Color(0.35f, 0.55f, 0.75f));
                    break;
                case ZombieType.Sapper:
                    AssembleHumanoid(root, skin, cloth, lean: true, scale: 0.95f);
                    var bomb = Proc.Sphere("Bomb", root, new Vector3(0.45f, 1.0f, 0.2f), Vector3.one * 0.35f,
                        new Color(0.85f, 0.45f, 0.1f));
                    Proc.StripCollider(bomb);
                    BattlementBuilder.SetEmissive(bomb, new Color(1f, 0.4f, 0.05f), 1.4f);
                    break;
                case ZombieType.Warlord:
                    AssembleHumanoid(root, new Color(0.55f, 0.12f, 0.1f), armor, lean: false, scale: 1.55f, armored: true);
                    var helm = Proc.Box("Helm", root, new Vector3(0f, 2.05f, 0.05f), new Vector3(0.55f, 0.35f, 0.55f), VisualPalette.Iron);
                    Proc.StripCollider(helm);
                    break;
                default: // Ram
                    AssembleRam(root);
                    break;
            }

            // Always ensure a visible head collider target exists.
            if (root.Find("Head") == null)
            {
                var head = Proc.Sphere("Head", root, new Vector3(0f, 1.7f, 0f), Vector3.one * 0.42f, skin);
                var col = head.GetComponent<Collider>();
                if (col != null) Object.Destroy(col);
                var sc = head.AddComponent<SphereCollider>();
                sc.isTrigger = true;
            }
        }

        static void AssembleHumanoid(Transform root, Color skin, Color cloth, bool lean, float scale, bool armored = false)
        {
            root.localScale = Vector3.one * scale;

            var torso = Proc.Box("Torso", root, new Vector3(0f, 1.15f, 0f),
                new Vector3(lean ? 0.55f : 0.7f, 0.85f, 0.4f), cloth);
            Proc.StripCollider(torso);

            var hips = Proc.Box("Hips", root, new Vector3(0f, 0.65f, 0f), new Vector3(0.6f, 0.3f, 0.35f), cloth);
            Proc.StripCollider(hips);

            var head = Proc.Sphere("Head", root, new Vector3(0f, 1.72f, 0.02f), Vector3.one * (lean ? 0.38f : 0.45f), skin);
            var headCol = head.GetComponent<Collider>();
            if (headCol != null) Object.Destroy(headCol);
            var sc = head.AddComponent<SphereCollider>();
            sc.isTrigger = true;

            // Eyes
            var eyeL = Proc.Sphere("EyeL", root, new Vector3(-0.1f, 1.76f, 0.18f), Vector3.one * 0.08f, new Color(1f, 0.35f, 0.08f));
            var eyeR = Proc.Sphere("EyeR", root, new Vector3(0.1f, 1.76f, 0.18f), Vector3.one * 0.08f, new Color(1f, 0.35f, 0.08f));
            Proc.StripCollider(eyeL);
            Proc.StripCollider(eyeR);
            BattlementBuilder.SetEmissive(eyeL, new Color(1f, 0.25f, 0.05f), 2.5f);
            BattlementBuilder.SetEmissive(eyeR, new Color(1f, 0.25f, 0.05f), 2.5f);

            MakeLimb(root, "ArmL", new Vector3(-0.45f, 1.25f, 0f), new Vector3(0.18f, 0.7f, 0.18f), skin, -12f);
            MakeLimb(root, "ArmR", new Vector3(0.45f, 1.25f, 0f), new Vector3(0.18f, 0.7f, 0.18f), skin, 12f);
            MakeLimb(root, "LegL", new Vector3(-0.18f, 0.3f, 0f), new Vector3(0.22f, 0.65f, 0.22f), cloth, 0f);
            MakeLimb(root, "LegR", new Vector3(0.18f, 0.3f, 0f), new Vector3(0.22f, 0.65f, 0.22f), cloth, 0f);

            if (armored)
            {
                var plate = Proc.Box("ChestPlate", root, new Vector3(0f, 1.2f, 0.22f), new Vector3(0.65f, 0.55f, 0.12f), VisualPalette.Iron);
                Proc.StripCollider(plate);
            }
        }

        static void AssembleWraith(Transform root, Color hue)
        {
            root.localScale = Vector3.one * 1.1f;
            var cloak = Proc.Cyl("Cloak", root, new Vector3(0f, 1.0f, 0f), new Vector3(0.9f, 1.1f, 0.9f), hue);
            Proc.StripCollider(cloak);
            BattlementBuilder.SetEmissive(cloak, hue, 0.6f);
            var core = Proc.Sphere("Core", root, new Vector3(0f, 1.5f, 0f), Vector3.one * 0.45f, hue * 1.3f);
            Proc.StripCollider(core);
            BattlementBuilder.SetEmissive(core, hue, 2.2f);
            var head = Proc.Sphere("Head", root, new Vector3(0f, 2.0f, 0f), Vector3.one * 0.4f, new Color(0.85f, 0.9f, 1f));
            var col = head.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            head.AddComponent<SphereCollider>().isTrigger = true;
        }

        static void AssembleRam(Transform root)
        {
            root.localScale = Vector3.one * 1.4f;
            var body = Proc.Box("RamBody", root, new Vector3(0f, 0.9f, 0f), new Vector3(1.2f, 1.0f, 2.4f), VisualPalette.Wood);
            Proc.StripCollider(body);
            var tip = Proc.Sphere("RamTip", root, new Vector3(0f, 0.9f, 1.4f), Vector3.one * 0.7f, VisualPalette.Iron);
            Proc.StripCollider(tip);
            var head = Proc.Box("Head", root, new Vector3(0f, 1.4f, -0.2f), new Vector3(0.5f, 0.4f, 0.5f), VisualPalette.WoodLight);
            var col = head.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            head.AddComponent<BoxCollider>().isTrigger = true;
        }

        static void MakeLimb(Transform root, string name, Vector3 pos, Vector3 scale, Color color, float zAngle)
        {
            var limb = Proc.Box(name, root, pos, scale, color, Quaternion.Euler(0f, 0f, zAngle));
            Proc.StripCollider(limb);
        }
    }
}
