varying vec2 vUv;
varying float vVisibility;
varying vec4 vTextureCoords;

uniform sampler2D uWrapperTexture;
uniform sampler2D uAtlas;
uniform sampler2D uBlurryAtlas;

void main() {
    vec4 texel = texture2D(uWrapperTexture, vUv);
    if (texel.a == 0.0) discard;
                
    float xStart = vTextureCoords.x;
    float xEnd = vTextureCoords.y;
    float yStart = vTextureCoords.z;
    float yEnd = vTextureCoords.w;

    vec2 atlasUV = vec2(
        mix(xStart, xEnd, vUv.x),
        mix(yStart, yEnd, (1.0 - vUv.y) * 1.5)
    ); 

    vec4 blurryTexel = texture2D(uBlurryAtlas, atlasUV);
    vec4 color = texel.b < 0.02 ? texture2D(uAtlas, atlasUV) : texel + blurryTexel * 0.8;
    
    color.a *= vVisibility;
    color.r = min(color.r, 1.0);
    color.g = min(color.g, 1.0);
    color.b = min(color.b, 1.0);

    gl_FragColor = color;
}
