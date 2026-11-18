import * as THREE from 'three';

export interface HoloCoreUniforms {
  [uniform: string]: THREE.IUniform<unknown>;
  uTime: THREE.IUniform<number>;
  uPrimary: THREE.IUniform<THREE.Color>;
  uSecondary: THREE.IUniform<THREE.Color>;
  uAccent: THREE.IUniform<THREE.Color>;
  uGlitch: THREE.IUniform<number>;
  uGlow: THREE.IUniform<number>;
  uSurge: THREE.IUniform<number>;
}

/**
 * Custom GLSL shader for the central holographic cyber-core.
 * Combines organic harmonic vertex displacement, glitch-slice jitter,
 * Fresnel rim luminescence, scrolling scanlines, and chromatic interference.
 */
export function createHoloCoreMaterial(
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color
): THREE.ShaderMaterial {
  const uniforms: HoloCoreUniforms = {
    uTime: {value: 0},
    uPrimary: {value: primary.clone()},
    uSecondary: {value: secondary.clone()},
    uAccent: {value: accent.clone()},
    uGlitch: {value: 0.35},
    uGlow: {value: 0.85},
    uSurge: {value: 0},
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      uniform float uGlitch;
      uniform float uSurge;

      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;
      varying float vPulse;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      void main() {
        vLocalPos = position;
        vec3 displaced = position;

        // Smooth harmonic breathing + neural ripple
        float ripple = sin(position.x * 18.0 + uTime * 2.6)
                     * cos(position.y * 18.0 - uTime * 2.1)
                     * sin(position.z * 18.0 + uTime * 1.7);
        float amp = 0.008 + uSurge * 0.022;
        displaced += normal * (ripple * amp);

        // Glitch slice horizontal displacement
        float sliceBand = floor(position.y * 28.0 + uTime * 6.0);
        float sliceNoise = hash11(sliceBand + floor(uTime * 14.0));
        float glitchTrigger = step(1.0 - (uGlitch * 0.42 + uSurge * 0.35), sliceNoise);
        float shift = (hash11(sliceBand * 3.17) - 0.5) * 0.045 * (uGlitch + uSurge);
        displaced.x += glitchTrigger * shift;
        displaced.z -= glitchTrigger * shift * 0.6;

        vPulse = glitchTrigger;

        vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform float uGlitch;
      uniform float uGlow;
      uniform float uSurge;

      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;
      varying float vPulse;

      void main() {
        vec3 viewDir = normalize(vViewPos);
        vec3 n = normalize(vNormalView);
        float fresnel = pow(1.0 - clamp(abs(dot(viewDir, n)), 0.0, 1.0), 2.1);

        // Scrolling cyber scanlines
        float scan = 0.5 + 0.5 * sin(vLocalPos.y * 95.0 - uTime * 9.0);
        float scanMask = mix(0.68, 1.25, smoothstep(0.35, 0.9, scan));

        // Chromatic RGB phase offset driven by glitch intensity
        float chromaPhase = sin(vLocalPos.y * 40.0 + uTime * 12.0) * uGlitch;
        vec3 baseCol = mix(uPrimary, uSecondary, clamp(vLocalPos.y * 3.8 + 0.5 + chromaPhase * 0.25, 0.0, 1.0));
        vec3 rimCol = mix(uSecondary, uAccent, fresnel * 0.7 + uSurge * 0.5);

        vec3 color = mix(baseCol * 0.42, rimCol * (1.3 + uGlow * 0.9), fresnel);
        color *= scanMask;

        // Glitch slice highlight + chromatic split accent
        color += uAccent * vPulse * (0.45 + uGlow * 0.5);
        color += mix(uPrimary, uAccent, 0.5) * uSurge * (0.55 + fresnel * 0.8);

        float alpha = clamp(0.42 + fresnel * 0.58 + uSurge * 0.25, 0.0, 0.98);
        gl_FragColor = vec4(color * (0.75 + uGlow * 0.65), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Infinite-fade synthwave cyber-grid floor shader with dual-frequency lines,
 * traveling data pulses, and radial surge shockwaves.
 */
export function createCyberGridMaterial(
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uAccent: {value: accent.clone()},
      uGridScale: {value: 1.0},
      uGlow: {value: 0.85},
      uGlitch: {value: 0.35},
      uSurgeRadius: {value: 0},
      uSurgeIntensity: {value: 0},
      uSurgeOrigin: {value: new THREE.Vector3(0, 0, -1)},
      uOpacityScale: {value: 1.0},
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform float uGridScale;
      uniform float uGlow;
      uniform float uGlitch;
      uniform float uSurgeRadius;
      uniform float uSurgeIntensity;
      uniform vec3 uSurgeOrigin;
      uniform float uOpacityScale;

      varying vec3 vWorldPos;

      float gridLine(vec2 coord, float thickness) {
        vec2 g = abs(fract(coord - 0.5) - 0.5);
        vec2 line = 1.0 - smoothstep(0.0, thickness, g);
        return max(line.x, line.y);
      }

      void main() {
        float dist = length(vWorldPos.xz);
        float radialFade = 1.0 - smoothstep(6.0, 24.0, dist);
        if (radialFade <= 0.005) discard;

        // Subtle glitch UV warp on grid lines
        float glitchShift = sin(vWorldPos.z * 6.0 + uTime * 16.0) * 0.03 * uGlitch;
        vec2 uvMajor = (vWorldPos.xz + vec2(glitchShift, 0.0)) * uGridScale;
        vec2 uvMinor = uvMajor * 4.0;

        float majorThickness = 0.024 + dist * 0.0032;
        float minorThickness = 0.032 + dist * 0.0065;

        float major = gridLine(uvMajor, majorThickness);
        float minor = gridLine(uvMinor, minorThickness) * 0.32;

        // Traveling radial cyber pulse from origin
        float pulseRing = 0.5 + 0.5 * sin(dist * 1.1 - uTime * 2.4);
        pulseRing = pow(pulseRing, 5.0);

        // User-triggered surge shockwave across the floor
        float surgeDist = length(vWorldPos.xz - uSurgeOrigin.xz);
        float waveBand = exp(-pow((surgeDist - uSurgeRadius) * 2.2, 2.0)) * uSurgeIntensity;

        vec3 gridColor = mix(uPrimary, uSecondary, clamp(dist / 14.0, 0.0, 1.0));
        vec3 lineColor = gridColor * (major + minor);
        lineColor += uSecondary * pulseRing * (major * 0.85 + 0.06);
        lineColor += uAccent * waveBand * (0.45 + major * 1.4);

        // Subtle dark floor tint in VR mode + crisp line alpha in AR
        float lineAlpha = clamp((major * 0.88 + minor * 0.45 + waveBand * 0.55) * radialFade, 0.0, 1.0);
        float glowBoost = 0.55 + uGlow * 0.85;

        gl_FragColor = vec4(lineColor * glowBoost, lineAlpha * uOpacityScale);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Procedural glowing skyscraper / data monolith shader for VR Cyberspace horizon.
 */
export function createSkylineMaterial(
  primary: THREE.Color,
  secondary: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uGlow: {value: 0.85},
      uOpacity: {value: 1.0},
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalWorld = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform float uGlow;
      uniform float uOpacity;

      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        // Dark obsidian monolith body
        vec3 base = vec3(0.025, 0.02, 0.06);

        // Procedural glowing cyber-windows
        vec2 winGrid = vec2(floor(vUv.x * 10.0), floor(vUv.y * 28.0));
        vec2 winFract = fract(vec2(vUv.x * 10.0, vUv.y * 28.0));
        float winSeed = hash21(winGrid + floor(vWorldPos.xz * 0.5));
        float winActive = step(0.68, winSeed);
        float winMask = step(0.2, winFract.x) * step(winFract.x, 0.8)
                      * step(0.25, winFract.y) * step(winFract.y, 0.78);

        // Traveling vertical data stream
        float stream = pow(0.5 + 0.5 * sin(vWorldPos.y * 1.4 - uTime * 2.5 + winSeed * 6.28), 6.0);
        vec3 winColor = mix(uPrimary, uSecondary, step(0.84, winSeed));

        // Top rooftop neon cap
        float roofGlow = smoothstep(0.92, 1.0, vUv.y);
        float edgeMask = smoothstep(0.92, 0.99, abs(vUv.x - 0.5) * 2.0);

        vec3 emissive = winColor * winActive * winMask * (0.4 + stream * 0.7);
        emissive += uSecondary * roofGlow * 0.85;
        emissive += uPrimary * edgeMask * 0.25;
        emissive *= (0.45 + uGlow * 0.8);

        // Height fog blend near base
        float baseFade = smoothstep(0.0, 0.14, vUv.y);
        vec3 finalColor = mix(base * 0.5, base + emissive, baseFade);

        gl_FragColor = vec4(finalColor, uOpacity);
      }
    `,
    transparent: true,
    depthWrite: true,
  });
}

/**
 * GPU-driven digital data rain particles surrounding the XR space.
 */
export function createDataRainMaterial(
  primary: THREE.Color,
  secondary: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uDensity: {value: 0.75},
      uGlow: {value: 0.85},
      uGlitch: {value: 0.35},
    },
    vertexShader: `
      attribute float aSpeed;
      attribute float aPhase;
      attribute float aSeed;

      uniform float uTime;
      uniform float uGlitch;

      varying float vAlpha;
      varying float vSeed;

      void main() {
        vSeed = aSeed;
        vec3 pos = position;

        // Loop vertically between y = 0.1 and y = 5.5
        float heightSpan = 5.4;
        pos.y = 0.1 + mod(position.y - uTime * aSpeed + aPhase * heightSpan, heightSpan);

        // Subtle horizontal glitch jitter
        float jitter = sin(uTime * 18.0 + aPhase * 30.0) * 0.04 * uGlitch;
        pos.x += jitter;

        // Fade near floor and ceiling
        float normY = (pos.y - 0.1) / heightSpan;
        vAlpha = smoothstep(0.0, 0.15, normY) * (1.0 - smoothstep(0.8, 1.0, normY));

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = clamp((24.0 + aSeed * 18.0) / max(-mvPosition.z, 0.5), 2.0, 26.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform float uDensity;
      uniform float uGlow;

      varying float vAlpha;
      varying float vSeed;

      void main() {
        if (vSeed > uDensity) discard;

        vec2 c = gl_PointCoord - vec2(0.5);
        // Elongated vertical cyber-streak shape
        float d = length(vec2(c.x * 2.1, c.y * 0.85));
        float shape = smoothstep(0.5, 0.04, d);
        if (shape <= 0.01) discard;

        vec3 col = mix(uPrimary, uSecondary, fract(vSeed * 7.13));
        float alpha = shape * vAlpha * (0.45 + uGlow * 0.45);
        gl_FragColor = vec4(col * (0.9 + uGlow * 0.8), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Expanding additive shockwave ring shader for CyberCore interactions.
 */
export function createShockwaveMaterial(
  accent: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: {value: accent.clone()},
      uProgress: {value: 1.0},
      uGlow: {value: 0.85},
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uGlow;
      varying vec2 vUv;

      void main() {
        float dist = abs(vUv.y - 0.5) * 2.0;
        float ring = smoothstep(1.0, 0.0, dist);
        float alpha = ring * (1.0 - uProgress) * 0.9;
        gl_FragColor = vec4(uColor * (1.3 + uGlow * 0.8), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Translucent glowing holographic backplane shader with animated sweep beam,
 * micro-grid interference, corner brackets, and glitch shimmer.
 */
export function createHoloBackplaneMaterial(
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uAccent: {value: accent.clone()},
      uGlitch: {value: 0.35},
      uGlow: {value: 0.85},
      uSurge: {value: 0},
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform float uGlitch;
      uniform float uGlow;
      uniform float uSurge;

      varying vec2 vUv;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      void main() {
        // Horizontal glitch UV jitter on interference bands
        float band = floor(vUv.y * 36.0 + uTime * 8.0);
        float noise = hash11(band + floor(uTime * 16.0));
        float glitchHit = step(1.0 - (uGlitch * 0.35 + uSurge * 0.35), noise);
        vec2 uv = vUv;
        uv.x += glitchHit * (hash11(band * 2.13) - 0.5) * 0.04 * (uGlitch + uSurge);

        // Micro tech grid
        vec2 grid = abs(fract(uv * vec2(22.0, 22.0) - 0.5) - 0.5);
        float gridLine = 1.0 - smoothstep(0.0, 0.06, min(grid.x, grid.y));

        // Fine CRT scanlines
        float scanlines = 0.72 + 0.28 * sin(uv.y * 220.0 - uTime * 6.0);

        // Traveling vertical scanner sweep
        float sweepPos = fract(uTime * 0.32);
        float sweep = exp(-pow((1.0 - uv.y - sweepPos) * 14.0, 2.0));

        // Glowing perimeter & corner bracket aura
        vec2 edgeDist = min(uv, 1.0 - uv);
        float borderDist = min(edgeDist.x, edgeDist.y);
        float rimGlow = exp(-borderDist * 26.0);

        // Crisp L-corner accents
        float cornerX = step(edgeDist.x, 0.09);
        float cornerY = step(edgeDist.y, 0.09);
        float borderBand = step(borderDist, 0.012);
        float corners = borderBand * max(cornerX, cornerY);

        vec3 baseCol = mix(uPrimary, uSecondary, uv.y);
        vec3 color = baseCol * (0.14 + gridLine * 0.16);
        color += uPrimary * rimGlow * (0.55 + uGlow * 0.65);
        color += mix(uPrimary, uAccent, 0.5) * sweep * (0.45 + uGlow * 0.5);
        color += uAccent * corners * (0.9 + uGlow * 0.7);
        color += uSecondary * glitchHit * 0.45;
        color += uAccent * uSurge * 0.5;
        color *= scanlines;

        float alpha = clamp(
          0.16 + gridLine * 0.1 + rimGlow * 0.55 + sweep * 0.3 + corners * 0.75 + uSurge * 0.25,
          0.0,
          0.95
        );
        gl_FragColor = vec4(color * (0.7 + uGlow * 0.55), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Soft volumetric upward hologram projection cone emitted from the terminal base bar.
 */
export function createHoloBeamMaterial(
  primary: THREE.Color,
  secondary: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uGlow: {value: 0.85},
      uSurge: {value: 0},
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform float uGlow;
      uniform float uSurge;
      varying vec2 vUv;

      void main() {
        // vUv.y = 0 at emitter base, 1 at top
        float verticalFade = (1.0 - vUv.y) * smoothstep(0.0, 0.12, vUv.y);
        float horizontalFade = 1.0 - pow(abs(vUv.x - 0.5) * 2.0, 1.8);
        float shimmer = 0.75 + 0.25 * sin(vUv.y * 28.0 - uTime * 5.0);
        vec3 col = mix(uPrimary, uSecondary, vUv.y * 0.8);
        float alpha = verticalFade * horizontalFade * shimmer * (0.22 + uGlow * 0.22 + uSurge * 0.2);
        gl_FragColor = vec4(col * (1.0 + uGlow * 0.6), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Soft glowing neon dust mote shader with spawn/despawn fade envelope,
 * ambient harmonic twinkle, and movement-reactive energy glow.
 */
export function createNeonDustMaterial(
  primary: THREE.Color,
  secondary: THREE.Color,
  accent: THREE.Color
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {value: 0},
      uPrimary: {value: primary.clone()},
      uSecondary: {value: secondary.clone()},
      uAccent: {value: accent.clone()},
      uDensity: {value: 0.85},
      uGlow: {value: 0.85},
      uSurge: {value: 0},
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSeed;
      attribute float aSize;
      attribute float aEnergy;
      attribute float aLife;

      uniform float uTime;
      uniform float uSurge;

      varying float vSeed;
      varying float vEnergy;
      varying float vLifeAlpha;
      varying float vTwinkle;

      void main() {
        vSeed = aSeed;
        vEnergy = aEnergy;
        vLifeAlpha = sin(clamp(aLife, 0.0, 1.0) * 3.14159265);
        vTwinkle = 0.68 + 0.32 * sin(uTime * 1.5 + aPhase * 6.2831853);

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(-mvPosition.z, 0.35);
        float sizeScale = 1.0 + aEnergy * 1.25 + uSurge * 0.35;
        gl_PointSize = clamp((aSize * sizeScale * 38.0) / dist, 2.5, 42.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform float uDensity;
      uniform float uGlow;
      uniform float uSurge;

      varying float vSeed;
      varying float vEnergy;
      varying float vLifeAlpha;
      varying float vTwinkle;

      void main() {
        if (vSeed > uDensity) discard;

        vec2 centered = (gl_PointCoord - vec2(0.5)) * 2.0;
        float r2 = dot(centered, centered);
        if (r2 > 1.0) discard;

        float r = sqrt(r2);
        float halo = exp(-r2 * 4.0);
        float core = smoothstep(0.45, 0.05, r);

        vec3 baseCol = mix(uPrimary, uSecondary, fract(vSeed * 9.73));
        vec3 col = mix(baseCol, uAccent, clamp(vEnergy * 0.85 + uSurge * 0.4, 0.0, 1.0));

        float intensity = 0.7 + uGlow * 0.85 + vEnergy * 0.85;
        float alpha = (halo * 0.55 + core * 0.65) * vLifeAlpha * vTwinkle * (0.34 + uGlow * 0.45 + vEnergy * 0.4);

        gl_FragColor = vec4(col * intensity, clamp(alpha, 0.0, 0.95));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}


