using UnityEngine;

namespace HelmsDeep
{
    /// <summary>Tiny helpers for procedural set dressing.</summary>
    public static class Proc
    {
        public static GameObject Box(string name, Transform parent, Vector3 pos, Vector3 scale, Color color,
            Quaternion? rot = null)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            if (rot.HasValue) go.transform.localRotation = rot.Value;
            BattlementBuilder.SetColor(go, color);
            return go;
        }

        public static GameObject Cyl(string name, Transform parent, Vector3 pos, Vector3 scale, Color color,
            Quaternion? rot = null)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            if (rot.HasValue) go.transform.localRotation = rot.Value;
            BattlementBuilder.SetColor(go, color);
            return go;
        }

        public static GameObject Sphere(string name, Transform parent, Vector3 pos, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            BattlementBuilder.SetColor(go, color);
            return go;
        }

        public static Light Point(string name, Transform parent, Vector3 pos, Color color, float range, float intensity)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            var light = go.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = color;
            light.range = range;
            light.intensity = intensity;
            light.shadows = LightShadows.Soft;
            return light;
        }

        public static void StripCollider(GameObject go)
        {
            var col = go.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
        }
    }
}
