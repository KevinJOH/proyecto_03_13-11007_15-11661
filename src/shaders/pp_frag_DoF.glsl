precision mediump float;

uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform float uBlurAmount;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uCameraNear;
uniform float uCameraFar;

in vec2 vUv;
out vec4 fragColor;

// Función para linealizar la profundidad no-lineal del buffer
float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0; // Remapea [0,1] a [-1,1]
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - z * (uCameraFar - uCameraNear));
}

void main() {
  vec4 color = texture(tDiffuse, vUv);
  // Obtiene la profundidad y la linealiza
  float depthSample = texture(tDepth, vUv).r;
  float linearDepth = linearizeDepth(depthSample) / uCameraFar; // Normaliza la profundidad
  
  // Calcula el factor de desenfoque basado en la diferencia con la distancia de enfoque
  float blurFactor = clamp(abs(linearDepth - uFocusDistance) / uFocusRange, 0.0, 1.0);
  float blurRadius = uBlurAmount * blurFactor;
  
  vec4 sum = vec4(0.0);
  float count = 0.0;
  // Recorre un área cuadrada en función del blurRadius
  for (float x = -blurRadius; x <= blurRadius; x++) {
    for (float y = -blurRadius; y <= blurRadius; y++) {
      vec2 offset = vec2(x, y) * 0.005;
      sum += texture(tDiffuse, vUv + offset);
      count += 1.0;
    }
  }
  fragColor = sum / count;
}