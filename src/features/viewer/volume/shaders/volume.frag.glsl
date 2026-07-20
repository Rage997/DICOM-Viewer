// Volume rendering fragment shader
// Ray marching through a 3D texture: composite, MIP, or MinIP.

uniform sampler3D volumeTexture;
uniform vec3 volumeDimensions;
uniform vec3 uCameraPosition;

// Window/Level settings
uniform float windowLevel;
uniform float windowWidth;

// Rendering settings
uniform float opacity;
uniform float stepSize;   // reference sampling distance for opacity correction
uniform int maxSteps;
uniform int renderMode;   // 0 = composite, 1 = MIP, 2 = MinIP
uniform int colorMap;     // 0 = grayscale, 1 = hot metal, 2 = PET

// Data normalization
uniform float dataMin;
uniform float dataMax;

// Clip box in texture space (0..1). Default 0..1 = no clipping.
uniform vec3 clipMin;
uniform vec3 clipMax;

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;

// Map a raw data value into the 0..1 window set by window/level.
float applyWindowLevel(float value) {
    float windowMin = windowLevel - windowWidth / 2.0;
    float windowMax = windowLevel + windowWidth / 2.0;
    return clamp((value - windowMin) / (windowMax - windowMin), 0.0, 1.0);
}

// Sample the volume at a model-space point, returning the windowed intensity 0..1.
float sampleWindowed(vec3 samplePos) {
    float density = texture(volumeTexture, samplePos + 0.5).r;
    float actualValue = density * (dataMax - dataMin) + dataMin;
    return applyWindowLevel(actualValue);
}

// True when a texture-space point lies inside the clip box.
bool insideClip(vec3 texCoord) {
    return all(greaterThanEqual(texCoord, clipMin)) && all(lessThanEqual(texCoord, clipMax));
}

// Opacity transfer (composite only): smoothstep floors out air/noise and ramps
// tissue to solid so mid-density anatomy accumulates instead of washing out.
const float TISSUE_LO = 0.12;
const float TISSUE_HI = 0.55;
float transferFunction(float windowed) {
    return smoothstep(TISSUE_LO, TISSUE_HI, windowed) * opacity;
}

// Windowed intensity 0..1 -> display color via the selected palette.
// Grayscale gamma-lifts midtones with a small floor; hot/PET are procedural LUTs.
vec3 palette(float t) {
    if (colorMap == 1) {
        // Hot metal: black -> red -> orange -> yellow -> white.
        return clamp(vec3(t * 3.0, t * 3.0 - 1.0, t * 3.0 - 2.0), 0.0, 1.0);
    } else if (colorMap == 2) {
        // PET (jet-style): blue -> cyan -> green -> yellow -> red.
        return clamp(
            vec3(1.5 - abs(4.0 * t - 3.0), 1.5 - abs(4.0 * t - 2.0), 1.5 - abs(4.0 * t - 1.0)),
            0.0,
            1.0
        );
    }
    // Grayscale
    return vec3(0.20 + 0.80 * pow(t, 0.65));
}

// Central-difference gradient (surface normal proxy) for composite shading.
vec3 calculateGradient(vec3 texCoord, float delta) {
    float dx = texture(volumeTexture, texCoord + vec3(delta, 0.0, 0.0)).r
             - texture(volumeTexture, texCoord - vec3(delta, 0.0, 0.0)).r;
    float dy = texture(volumeTexture, texCoord + vec3(0.0, delta, 0.0)).r
             - texture(volumeTexture, texCoord - vec3(0.0, delta, 0.0)).r;
    float dz = texture(volumeTexture, texCoord + vec3(0.0, 0.0, delta)).r
             - texture(volumeTexture, texCoord - vec3(0.0, 0.0, delta)).r;
    return vec3(dx, dy, dz);
}

// Phong-ish shading with a strong ambient floor so shaded tissue stays visible.
vec3 applyShading(vec3 baseColor, vec3 normal, vec3 rayDir) {
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
    float diffuse = max(dot(normal, lightDir), 0.0);
    float lighting = 0.55 + 0.55 * diffuse;
    vec3 halfVec = normalize(lightDir - rayDir);
    float specular = pow(max(dot(normal, halfVec), 0.0), 24.0) * 0.35;
    return baseColor * lighting + vec3(specular);
}

void main() {
    // Ray direction in model space (camera position is provided in model space).
    vec3 rayDir = normalize(vPosition - uCameraPosition);

    // vPosition is the front-face entry point. March to the back-face exit.
    vec3 invRayDir = 1.0 / rayDir;
    vec3 tMax = (sign(rayDir) * 0.5 - vPosition) * invRayDir;
    float tExit = max(max(tMax.x, tMax.y), tMax.z);
    if (tExit <= 0.0) {
        discard;
    }

    // Adaptive step: always cross the whole entry->exit segment in maxSteps.
    float step = tExit / float(maxSteps);

    // --- MIP / MinIP: project the extreme windowed intensity along the ray ---
    if (renderMode != 0) {
        float extreme = (renderMode == 2) ? 1.0 : 0.0; // MinIP tracks min, MIP tracks max
        float t = 0.0;
        for (int i = 0; i < maxSteps; i++) {
            if (t > tExit) break;
            vec3 sp = vPosition + rayDir * t;
            if (insideClip(sp + 0.5)) {
                float w = sampleWindowed(sp);
                extreme = (renderMode == 2) ? min(extreme, w) : max(extreme, w);
            }
            t += step;
        }
        // MIP: skip rays that never hit anything (keeps the background black).
        if (renderMode == 1 && extreme < 0.02) {
            discard;
        }
        gl_FragColor = vec4(palette(extreme), opacity);
        return;
    }

    // --- Composite: front-to-back alpha compositing with gradient shading ---
    float refStep = max(stepSize, 1e-4);
    vec4 accumulatedColor = vec4(0.0);
    float t = 0.0;

    for (int i = 0; i < maxSteps; i++) {
        if (t > tExit) break;
        if (accumulatedColor.a > 0.98) break; // early ray termination

        vec3 texCoord = vPosition + rayDir * t + 0.5;
        float windowed = sampleWindowed(vPosition + rayDir * t);
        float alpha = transferFunction(windowed);

        if (alpha > 0.01 && insideClip(texCoord)) {
            vec3 color = palette(windowed);

            vec3 grad = calculateGradient(texCoord, 1.0 / 256.0);
            if (length(grad) > 0.01) {
                color = applyShading(color, normalize(grad), rayDir);
            }

            float corrected = 1.0 - pow(1.0 - alpha, step / refStep);
            float weight = corrected * (1.0 - accumulatedColor.a);
            accumulatedColor.rgb += color * weight;
            accumulatedColor.a += weight;
        }

        t += step;
    }

    if (accumulatedColor.a < 0.01) {
        discard;
    }

    // Un-premultiply for Three's NormalBlending (avoids double-darkening on black).
    gl_FragColor = vec4(accumulatedColor.rgb / accumulatedColor.a, accumulatedColor.a);
}
