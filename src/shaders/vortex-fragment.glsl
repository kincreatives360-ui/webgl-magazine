varying vec2 vUv;
uniform sampler2D uAtlas;
varying vec4 vTextureCoords;

void main() {
    float xStart = vTextureCoords.x;
    float xEnd = vTextureCoords.y;
    float yStart = vTextureCoords.z;
    float yEnd = vTextureCoords.w;
        
    vec2 atlasUV = vec2(
        mix(xStart, xEnd, vUv.x),
        mix(yStart, yEnd, 1.0 - vUv.y)
    );
        
    vec4 color = texture2D(uAtlas, atlasUV);
    gl_FragColor = color;
}
