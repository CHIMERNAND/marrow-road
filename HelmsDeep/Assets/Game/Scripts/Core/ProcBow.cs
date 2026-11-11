using System;
using UnityEngine;

namespace MarrowRoad
{
    /// <summary>
    /// Procedural bow prod (two jointed, tapering limbs) with a two-segment string that runs from each
    /// limb tip to the nock point. Shared by the player crossbow, the wall crossbow and the ballista.
    /// Placeholder until the M3 art pass swaps in real models.
    /// </summary>
    public sealed class ProcBow
    {
        public delegate Transform PartFn(Transform parent, Vector3 pos, Vector3 size, Material m);

        readonly Transform space;
        readonly Transform[][] joints = new Transform[2][];
        readonly Transform[] tips = new Transform[2];
        readonly Transform[] strings = new Transform[2];
        readonly float restBend, drawBend, stringThick, drawnZ, nockY;
        readonly bool rigidLimbs;

        /// <param name="space">Transform the bow is built in (+z = shooting direction).</param>
        /// <param name="center">Where the prod meets the stock.</param>
        /// <param name="rootHalf">Half-width of the stock/bridle the limbs grow out of.</param>
        /// <param name="limbLen">Length of each limb.</param>
        /// <param name="restBend">Total sweep-back of each limb when braced (degrees).</param>
        /// <param name="drawBend">Total sweep-back at full draw (degrees).</param>
        /// <param name="drawnZ">Nock z at full draw, in <paramref name="space"/>.</param>
        /// <param name="rigid">Arms that pivot at the root instead of flexing (ballista).</param>
        public ProcBow(Transform space, Vector3 center, float rootHalf, float limbLen, int segs,
            float thickRoot, float thickTip, float depth, float restBend, float drawBend,
            float drawnZ, float stringThick, Material limbMat, Material stringMat, PartFn part, bool rigid = false)
        {
            this.space = space;
            this.restBend = restBend;
            this.drawBend = drawBend;
            this.drawnZ = drawnZ;
            this.stringThick = stringThick;
            nockY = center.y;
            rigidLimbs = rigid;
            var segLen = limbLen / segs;
            for (var side = 0; side < 2; side++)
            {
                var s = side == 0 ? -1f : 1f;
                joints[side] = new Transform[segs];
                Transform parent = space;
                var pos = center + new Vector3(s * rootHalf, 0, 0);
                for (var i = 0; i < segs; i++)
                {
                    var j = new GameObject("Limb" + (side == 0 ? "L" : "R") + i).transform;
                    j.SetParent(parent, false);
                    j.localPosition = pos;
                    var t = segs == 1 ? 0f : i / (segs - 1f);
                    var th = Mathf.Lerp(thickRoot, thickTip, t);
                    part(j, new Vector3(s * segLen * 0.5f, 0, 0), new Vector3(segLen * 1.06f, th, depth), limbMat);
                    joints[side][i] = j;
                    parent = j;
                    pos = new Vector3(s * segLen, 0, 0);
                }

                var tip = new GameObject("Tip").transform;
                tip.SetParent(parent, false);
                tip.localPosition = pos;
                tips[side] = tip;
                // Small horn nock on the tip so the string has something to sit in.
                part(tip, Vector3.zero, new Vector3(depth * 1.2f, thickTip * 1.6f, depth * 1.4f), stringMat);
                strings[side] = part(space, center, new Vector3(stringThick, stringThick, 0.1f), stringMat);
            }

            Set(0f);
        }

        /// <summary>0 = slack/braced, 1 = spanned to the nut.</summary>
        public void Set(float drawn)
        {
            var bend = Mathf.Lerp(restBend, drawBend, drawn);
            for (var side = 0; side < 2; side++)
            {
                var s = side == 0 ? -1f : 1f;
                var js = joints[side];
                if (rigidLimbs)
                {
                    for (var i = 0; i < js.Length; i++)
                        js[i].localRotation = i == 0 ? Quaternion.Euler(0, s * bend, 0) : Quaternion.identity;
                    continue;
                }

                // Progressive bend: the outer segments flex more, like a real steel prod.
                var sum = js.Length * (js.Length + 1) / 2f;
                for (var i = 0; i < js.Length; i++)
                    js[i].localRotation = Quaternion.Euler(0, s * bend * (i + 1) / sum, 0);
            }

            var a = space.InverseTransformPoint(tips[0].position);
            var b = space.InverseTransformPoint(tips[1].position);
            var slack = (a + b) * 0.5f;
            var nock = new Vector3(0, nockY, Mathf.Lerp(slack.z, drawnZ, drawn));
            Span(strings[0], a, nock);
            Span(strings[1], b, nock);
        }

        void Span(Transform t, Vector3 from, Vector3 to)
        {
            var d = to - from;
            var len = d.magnitude;
            t.localPosition = (from + to) * 0.5f;
            if (len > 1e-5f) t.localRotation = Quaternion.LookRotation(d / len, Vector3.up);
            t.localScale = new Vector3(stringThick, stringThick, Mathf.Max(len, 1e-4f));
        }

        /// <summary>Box part oriented between two points (struts, braces, stirrup bars).</summary>
        public static Transform Strut(PartFn part, Transform parent, Vector3 from, Vector3 to, float w, float h, Material m)
        {
            var d = to - from;
            var t = part(parent, (from + to) * 0.5f, new Vector3(w, h, d.magnitude), m);
            if (d.sqrMagnitude > 1e-8f) t.localRotation = Quaternion.LookRotation(d.normalized, Math.Abs(d.normalized.y) > 0.99f ? Vector3.forward : Vector3.up);
            return t;
        }
    }
}
