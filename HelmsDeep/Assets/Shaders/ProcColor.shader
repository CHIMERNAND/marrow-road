Shader "HelmsDeep/ProcColor"
{
    Properties
    {
        _BaseColor ("Color", Color) = (1,1,1,1)
        _EmissionColor ("Emission", Color) = (0,0,0,0)
        _Gloss ("Gloss", Range(0,1)) = 0.25
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Opaque"
            "Queue" = "Geometry"
            "RenderPipeline" = "UniversalPipeline"
        }
        Pass
        {
            Name "ForwardUnlit"
            Tags { "LightMode" = "UniversalForward" }

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float3 normalWS : TEXCOORD1;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _BaseColor;
                float4 _EmissionColor;
                float _Gloss;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                VertexPositionInputs pos = GetVertexPositionInputs(input.positionOS.xyz);
                VertexNormalInputs nrm = GetVertexNormalInputs(input.normalOS);
                output.positionCS = pos.positionCS;
                output.positionWS = pos.positionWS;
                output.normalWS = nrm.normalWS;
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float3 n = normalize(input.normalWS);
                Light mainLight = GetMainLight();
                float ndl = saturate(dot(n, mainLight.direction));
                float wrap = ndl * 0.65 + 0.35;

                float3 ambient = SampleSH(n) * 0.55 + float3(0.08, 0.1, 0.14);
                float3 diffuse = _BaseColor.rgb * (ambient + mainLight.color.rgb * wrap * mainLight.distanceAttenuation);

                // Warm torch fill from above/behind the wall
                float3 torchDir = normalize(float3(0.1, 0.55, -0.7));
                float torch = saturate(dot(n, torchDir)) * 0.45;
                diffuse += _BaseColor.rgb * float3(1.0, 0.55, 0.22) * torch;

                float3 viewDir = GetWorldSpaceNormalizeViewDir(input.positionWS);
                float3 halfDir = normalize(mainLight.direction + viewDir);
                float spec = pow(saturate(dot(n, halfDir)), lerp(8, 48, _Gloss)) * _Gloss * 0.35;
                diffuse += mainLight.color.rgb * spec;

                float fogFactor = ComputeFogFactor(TransformWorldToHClip(input.positionWS).z);
                float3 col = diffuse + _EmissionColor.rgb;
                col = MixFog(col, fogFactor);
                return half4(col, 1);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
