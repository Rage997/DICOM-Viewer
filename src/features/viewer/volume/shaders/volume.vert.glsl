// Volume rendering vertex shader
// Passes through position and calculates ray direction

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    // Pass position to fragment shader (in model space for texture sampling)
    vPosition = position;

    // Also pass world space position for ray marching
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

    vNormal = normalize(normalMatrix * normal);

    // Transform to clip space
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
