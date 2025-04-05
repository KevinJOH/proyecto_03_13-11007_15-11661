precision mediump float;

uniform sampler2D tDiffuse;
uniform float uBlurAmount;
uniform float uFocusDistance;
uniform float uFocusRange;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec4 color = vec4(0.0);
  float depth = texture(tDiffuse, vUv).r; // Supongamos que la profundidad viene en el canal rojo
  float blurFactor = clamp(abs(depth - uFocusDistance) / uFocusRange, 0.0, 1.0);
  float blurRadius = uBlurAmount * blurFactor;

  for (float x = -blurRadius; x <= blurRadius; x++) {
    for (float y = -blurRadius; y <= blurRadius; y++) {
      vec2 offset = vec2(x, y) * 0.005;
      color += texture(tDiffuse, vUv + offset);
    }
  }
  color /= pow(blurRadius * 2.0 + 1.0, 2.0);
  fragColor = color;
}