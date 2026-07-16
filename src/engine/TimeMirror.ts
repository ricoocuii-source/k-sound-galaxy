/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TimeMirror — image particle dispersion.
 *
 * The cover and particles are co-registered on one cell grid. A cell's
 * lifecycle removes that pixel from the plane while its same-colour particle
 * leaves the surface, then restores both during its independent return.
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

const PLANE_W = 34;
const PLANE_H = 30;
// 36,720 samples retain a continuous image at the renderer's 1.6 DPR cap,
// while leaving enough GPU budget for the galaxy, bloom and free-flight HUD.
const GRID_W = 204;
const GRID_H = 180;
const MAX_RIPPLES = 8;

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int i = 0; i < 3; i++) {
      value += amplitude * vnoise(p);
      p = p * 2.071 + vec2(1.37, -2.11);
      amplitude *= 0.48;
    }
    return value;
  }
`;

// Plane and points share the same material field and independent grain clock.
// state = (pixel transfer, active transfer, cycle id, particle seed).
const DISPERSION_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uErosion;
  uniform float uAudioEnergy;
  uniform float uBurst;

  ${NOISE_GLSL}

  float materialField(vec2 home) {
    float macro = fbm(
      home * 2.15 + vec2(uTime * 0.0087, -uTime * 0.0063)
    );
    float detail = fbm(
      home * 6.35 +
      vec2(-uTime * 0.0061, uTime * 0.0083) +
      macro * 1.67
    );
    return macro * 0.70 + detail * 0.30;
  }

  // Keep the photograph broadly readable through the middle while its
  // perimeter dissolves unevenly. This is a warped image field—not the former
  // ellipse, S curve, or a hard rectangular card.
  float organicDistance(vec2 home) {
    vec2 p = home * 2.0 - 1.0;
    float macro = fbm(
      p * 1.17 + vec2(uTime * 0.0071, -uTime * 0.0053) + 4.7
    );
    float detail = fbm(
      p * 3.85 + vec2(-uTime * 0.0103, uTime * 0.0079) +
      macro * 1.41
    );
    vec2 warp = vec2(
      detail - 0.5,
      fbm(p * 2.73 - 3.1 + macro * 1.23) - 0.5
    );
    p += warp * vec2(0.105, 0.082);

    vec2 q = abs(p);
    float imageField = max(q.x * 0.91, q.y * 1.02);
    float roundedField = length(p / vec2(1.30, 1.22));
    float d = mix(imageField, roundedField, 0.18);
    d += (macro - 0.5) * 0.25 + (detail - 0.5) * 0.13;
    return d;
  }

  float islandAlpha(vec2 home) {
    float topErosion = smoothstep(0.44, 1.0, home.y) * 0.11;
    return 1.0 - smoothstep(
      0.56,
      1.00,
      organicDistance(home) + topErosion
    );
  }

  float particleSeed(vec2 home) {
    vec2 cell = floor(home * vec2(${GRID_W.toFixed(1)}, ${GRID_H.toFixed(1)}));
    return hash21(cell + vec2(17.31, 43.79));
  }

  // A continuous soft patch: no floor(), rectangular zones or shared pulse.
  float clusterBurst(vec2 home) {
    float broad = fbm(
      home * 3.65 + vec2(uTime * 0.071, -uTime * 0.053) + 12.7
    );
    float fine = fbm(
      home * 8.3 + vec2(-uTime * 0.043, uTime * 0.061) - 5.2
    );
    return smoothstep(0.53, 0.76, broad * 0.72 + fine * 0.28);
  }

  vec4 dispersionState(vec2 home) {
    float shape = organicDistance(home);
    if (shape > 1.34) return vec4(0.0);

    float seed = particleSeed(home);
    float speedSeed = hash21(vec2(seed * 91.7, 12.4));
    float period = mix(9.5, 22.8, speedSeed);
    float phase = hash21(vec2(seed * 47.1, 5.8)) * period;
    float clock = uTime + phase;
    float cycleId = floor(clock / period);
    float t = fract(clock / period);

    // Every cell has a different wait, departure speed, free-drift duration
    // and return time. Nothing here is driven by one shared sine wave.
    float delay = mix(0.025, 0.19, hash21(vec2(seed, 2.1)));
    float departEnd = delay + mix(0.10, 0.23, hash21(vec2(seed, 7.6)));
    float returnStart = mix(0.50, 0.74, hash21(vec2(seed, 13.9)));
    float returnEnd = min(
      0.985,
      returnStart + mix(0.13, 0.245, hash21(vec2(seed, 21.3)))
    );
    float lifecycle =
      smoothstep(delay, departEnd, t) *
      (1.0 - smoothstep(returnStart, returnEnd, t));

    // The clear centre is protected. At rest only broken, broad edge patches
    // loosen; music can reach inward through a second non-periodic field.
    float field = materialField(home);
    float secondary = fbm(
      home * 5.2 + vec2(-uTime * 0.0127, uTime * 0.0091) + 21.4
    );
    float centre = length((home - 0.5) / vec2(0.46, 0.50));
    float centreProtection = 1.0 - smoothstep(0.32, 0.68, centre);
    float edgeZone =
      smoothstep(0.43, 0.76, shape + (field - 0.5) * 0.25) *
      (1.0 - smoothstep(1.13, 1.34, shape));
    float brokenEdge = smoothstep(0.49, 0.72, field * 0.72 + secondary * 0.28);
    float quietActivation = edgeZone * mix(0.34, 0.94, brokenEdge);

    // The reference always keeps a dense granular border. These grains are
    // already transferred from the image but remain close to their home;
    // only the active population below takes a wider excursion.
    float occupancySeed = hash21(vec2(seed * 113.7, 29.1));
    float denseOccupancy = 1.0 - smoothstep(0.76, 0.91, occupancySeed);
    float baseGranule =
      edgeZone *
      denseOccupancy *
      mix(0.58, 0.92, brokenEdge) *
      (1.0 - centreProtection);
    float topErosion = smoothstep(0.48, 1.0, home.y) * 0.075;
    float erosionFront = mix(1.06, 0.42, uErosion);
    float inward = smoothstep(
      erosionFront - 0.16,
      erosionFront + 0.18,
      shape + (field - 0.5) * 0.33
    );
    float audioPatch = smoothstep(
      0.48,
      0.73,
      secondary * 0.63 + field * 0.37 + uBurst * 0.08
    );
    float audioGate = smoothstep(0.035, 0.55, uAudioEnergy + uBurst * 0.34);
    float audioActivation = inward * audioPatch * audioGate;
    float burstActivation =
      clusterBurst(home) * uBurst * smoothstep(0.50, 0.88, shape);
    float activation = max(quietActivation, audioActivation);
    activation = clamp(
      activation + burstActivation * 0.74,
      0.0,
      1.0
    );
    activation *= 1.0 - centreProtection;

    float activeTransfer = lifecycle * activation;
    // Only pixels that actually leave the photograph are rendered as points.
    // The intact centre stays on the image plane and therefore remains sharp.
    float transfer = max(baseGranule, activeTransfer);
    return vec4(transfer, activeTransfer, cycleId, seed);
  }
`;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uAspect;
  uniform vec3 uColor;
  uniform float uBass;
  uniform float uHighs;
  uniform float uOpacity;
  uniform float uDistanceFade;
  uniform float uForm;
  uniform vec4 uRipples[8];
  varying vec2 vUv;

  ${DISPERSION_GLSL}

  void main() {
    // Texture sampling stays still and legible; only the material boundary
    // and the actual transferred pixels move.
    vec2 texUv = vUv;
    if (uAspect < 1.0) {
      texUv.x = (texUv.x - 0.5) * uAspect + 0.5;
    } else {
      texUv.y = (texUv.y - 0.5) / uAspect + 0.5;
    }
    vec3 tex = texture2D(uMap, clamp(texUv, 0.001, 0.999)).rgb;
    float procedural = fbm(vUv * 3.1 + vec2(2.7, -1.4));
    vec3 col = mix(
      uColor * (0.28 + procedural * 0.42),
      tex,
      uHasMap
    );

    // Pointer/click interaction is a local gravity well: a dark core with a
    // compressed bright rim that relaxes without moving the whole surface.
    float rippleLight = 0.0;
    float forceDark = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 ripple = uRipples[i];
      if (ripple.w <= 0.0) continue;
      float age = uTime - ripple.z;
      if (age < 0.0 || age > 1.45) continue;
      float d = distance(vUv, ripple.xy);
      float decay = exp(-age * 2.15);
      float radius = 0.078 + smoothstep(0.0, 1.0, age) * 0.034;
      float well = 1.0 - smoothstep(radius * 0.36, radius, d);
      float ring = exp(-pow((d - radius) * 39.0, 2.0));
      forceDark = max(forceDark, well * decay * ripple.w);
      rippleLight += ring * decay * ripple.w;
    }

    // Calling the shared state on the continuous UV keeps the boundary soft;
    // the grain clock still resolves to the exact point-grid cell.
    float transfer = dispersionState(vUv).x * uHasMap;
    float shapeAlpha = islandAlpha(vUv);
    float edgeMicro = hash21(
      floor(vUv * vec2(
        ${(GRID_W * 2).toFixed(1)},
        ${(GRID_H * 2).toFixed(1)}
      )) + 37.2
    );
    float edgeDither =
      (edgeMicro - 0.5) * 0.24 *
      (1.0 - smoothstep(0.28, 0.82, shapeAlpha));
    float silhouette = smoothstep(0.10, 0.48, shapeAlpha - edgeDither);
    float formSeed = particleSeed(vUv);
    float reveal = smoothstep(
      formSeed * 0.58,
      formSeed * 0.58 + 0.34,
      uForm
    );

    float pixelPresence = 1.0 - transfer;
    float alpha =
      silhouette *
      reveal *
      pixelPresence *
      (1.0 - clamp(forceDark * 0.92, 0.0, 0.94)) *
      uOpacity *
      uDistanceFade;
    if (alpha < 0.004) discard;

    col *= 0.92 + min(rippleLight, 1.0) * 0.10 + uHighs * 0.008;
    col = min(col, vec3(0.94));
    gl_FragColor = vec4(col, alpha);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uForm;
  uniform float uOpacity;
  uniform float uDistanceFade;
  uniform float uBass;
  uniform float uHighs;
  uniform vec3 uColor;
  uniform vec4 uRipples[8];
  uniform vec4 uPointer;
  uniform vec2 uPointerVelocity;
  uniform float uPixelRatio;
  uniform float uAspect;
  attribute vec2 aHome;
  varying vec3 vColor;
  varying float vAlpha;

  ${DISPERSION_GLSL}

  vec2 curlField(vec2 p) {
    float epsilon = 0.075;
    float up = fbm(p + vec2(0.0, epsilon));
    float down = fbm(p - vec2(0.0, epsilon));
    float right = fbm(p + vec2(epsilon, 0.0));
    float left = fbm(p - vec2(epsilon, 0.0));
    return vec2(up - down, left - right) / (2.0 * epsilon);
  }

  void main() {
    vec4 state = dispersionState(aHome);
    float transfer = state.x;
    float activeTransfer = state.y;
    float cycleId = state.z;
    float seed = state.w;

    float speedSeed = hash21(vec2(seed * 91.7, 12.4));
    float period = mix(9.5, 22.8, speedSeed);
    float phase = hash21(vec2(seed * 47.1, 5.8)) * period;
    float cycleT = fract((uTime + phase) / period);

    vec2 homeWorld =
      (aHome - 0.5) * vec2(
        ${PLANE_W.toFixed(1)},
        ${PLANE_H.toFixed(1)}
      );
    vec2 radial = normalize((aHome * 2.0 - 1.0) + vec2(0.0001));
    vec2 texUv = aHome;
    if (uAspect < 1.0) {
      texUv.x = (texUv.x - 0.5) * uAspect + 0.5;
    } else {
      texUv.y = (texUv.y - 0.5) / uAspect + 0.5;
    }
    vec3 sampledTex = texture2D(
      uMap,
      clamp(texUv, 0.001, 0.999)
    ).rgb;
    float sampledLuminance = dot(
      sampledTex,
      vec3(0.299, 0.587, 0.114)
    );

    // Rebuild the independent clock so departure and return can follow
    // different curves instead of reversing one shared translation.
    float delay = mix(0.025, 0.19, hash21(vec2(seed, 2.1)));
    float departEnd = delay + mix(0.10, 0.23, hash21(vec2(seed, 7.6)));
    float returnStart = mix(0.50, 0.74, hash21(vec2(seed, 13.9)));
    float returnEnd = min(
      0.985,
      returnStart + mix(0.13, 0.245, hash21(vec2(seed, 21.3)))
    );
    float depart = smoothstep(delay, departEnd, cycleT);
    float returning = smoothstep(returnStart, returnEnd, cycleT);
    float airborne = depart * (1.0 - returning);
    float driftAge = smoothstep(departEnd, returnStart, cycleT);

    // Every cycle receives two unrelated directions. Curl supplies the broad
    // tendency; the seeded vectors prevent a layer-wide stream.
    float angleA =
      6.2831853 *
      hash21(vec2(seed * 83.7, cycleId + 11.2));
    float angleB =
      6.2831853 *
      hash21(vec2(seed * 37.9, cycleId + 29.6));
    vec2 randomA = vec2(cos(angleA), sin(angleA));
    vec2 randomB = vec2(cos(angleB), sin(angleB));
    float speed = mix(
      0.52,
      1.48,
      hash21(vec2(seed * 29.3, cycleId + 2.4))
    );

    // Two irrationally paced fields keep the grain close to its image island:
    // a slow envelope plus fine local eddies, with no repeatable breathing.
    vec2 broadCurl = curlField(
      aHome * 2.15 +
      vec2(uTime * 0.0111, -uTime * 0.0083) +
      cycleId * vec2(0.173, -0.119)
    );
    vec2 detailCurl = curlField(
      aHome * 7.25 +
      vec2(-uTime * 0.0247, uTime * 0.0181) +
      cycleId * vec2(-0.071, 0.097)
    );
    float burstHere = clusterBurst(aHome) * uBurst;
    vec2 localDirection = normalize(
      broadCurl * 1.34 +
      randomA * 0.72 +
      radial * 0.18 +
      vec2(0.0001)
    );
    vec2 returnBend =
      randomB * (1.2 + speed * 1.5) +
      vec2(-radial.y, radial.x) *
        (hash21(vec2(seed, cycleId + 73.2)) - 0.5) * 4.2 +
      detailCurl * 1.8;
    vec2 primaryOffset =
      localDirection * (3.8 + speed * 7.6) +
      detailCurl * (1.8 + speed * 2.4) +
      radial * (0.7 + speed * 1.05);
    float travelProgress = airborne * mix(0.24, 1.0, driftAge);
    float returnArc = sin(returning * 3.14159265) * depart;
    vec2 travel =
      primaryOffset * travelProgress +
      returnBend * returnArc +
      randomB * burstHere * airborne * (2.2 + speed * 3.8);
    float activeMotion = smoothstep(0.035, 0.52, activeTransfer);
    float baseWeight = clamp(
      (transfer - activeTransfer) / max(transfer, 0.001),
      0.0,
      1.0
    );
    float microPhase =
      uTime * mix(0.11, 0.23, hash21(vec2(seed, 84.2))) +
      seed * 6.2831853;
    vec2 microDrift =
      (broadCurl * 0.46 + randomA * sin(microPhase) * 0.13) *
      baseWeight *
      mix(0.24, 0.72, speed);
    // A persistent, non-uniform erosion cloud removes the square-cover edge.
    // It is still made from the cover's own samples; no separate white halo is
    // drawn. Seeded gaps and mixed radial/curl directions create the feathered
    // peaks visible in the reference without one global spray direction.
    float edgeCloud = smoothstep(0.55, 1.06, organicDistance(aHome));
    float imageCore = 1.0 - smoothstep(0.32, 0.76, organicDistance(aHome));
    float plumeSeed = hash21(vec2(seed * 71.3, 118.9));
    float plumeGate = smoothstep(0.28, 0.86, plumeSeed);
    float plumeLength = edgeCloud * plumeGate * mix(
      1.8,
      11.8,
      hash21(vec2(seed * 39.1, 77.4))
    );
    vec2 plumeDirection = normalize(
      radial * 0.58 +
      randomA * 0.44 +
      broadCurl * 1.05 +
      vec2(0.0001)
    );
    vec2 restingPlume = plumeDirection * plumeLength;
    float restingPlumeDepth =
      (hash21(vec2(seed * 17.7, 94.1)) - 0.5) *
      plumeLength * 1.08;
    float depthWave =
      (fbm(
        aHome * 3.15 +
        vec2(uTime * 0.0187, -uTime * 0.0131) +
        8.6
      ) - 0.5) *
      (2.4 + uAudioEnergy * 5.6) *
      baseWeight;
    // Slow spatial folding gives the point fabric a bent-film silhouette from
    // the side. Noise drift avoids a layer-wide synchronized sine breath.
    float macroFold = (
      fbm(vec2(
        aHome.y * 1.55 + uTime * 0.0067,
        aHome.x * 0.46 - uTime * 0.0049 + 5.3
      )) - 0.5
    ) * (8.2 + uAudioEnergy * 2.4);
    float imageRelief =
      (sampledLuminance - 0.42) *
      uHasMap *
      3.2 *
      baseWeight;
    float surfaceThickness =
      (hash21(vec2(seed * 53.7, 42.6)) - 0.5) *
      mix(3.4, 12.6, edgeCloud) *
      baseWeight;

    vec3 assembled = vec3(
      homeWorld + microDrift + restingPlume + travel * activeMotion,
      (
        (hash21(vec2(seed, cycleId + 44.1)) - 0.5) *
        (2.4 + speed * 4.6) +
        broadCurl.x * 2.1
      ) * travelProgress * activeMotion +
      (hash21(vec2(seed, cycleId + 91.4)) - 0.5) *
        3.4 * returnArc * activeMotion +
      broadCurl.y * baseWeight * 0.42 +
      restingPlumeDepth +
      macroFold * baseWeight +
      depthWave +
      imageRelief +
      surfaceThickness
    );

    // Opening assembly is independent per grain. Once assembled, its image
    // lifecycle takes over; no layer-wide scale/breath motion is introduced.
    vec3 scatter = vec3(
      (hash21(vec2(seed, 3.2)) - 0.5) * 72.0,
      (hash21(vec2(seed, 8.5)) - 0.5) * 88.0,
      (hash21(vec2(seed, 13.7)) - 0.5) * 38.0
    );
    float formT = smoothstep(
      seed * 0.58,
      seed * 0.58 + 0.34,
      uForm
    );
    vec3 pos = mix(scatter, assembled, formT);

    // Pointer history becomes a chain of local gravity wells. Each well
    // compresses a rim, adds a little swirl and pushes depth inward, then the
    // stateless spring field returns every grain to its sampled home.
    float rippleLift = 0.0;
    float rippleWell = 0.0;
    vec2 rippleShift = vec2(0.0);
    for (int i = 0; i < 8; i++) {
      vec4 ripple = uRipples[i];
      if (ripple.w <= 0.0) continue;
      float age = uTime - ripple.z;
      if (age < 0.0 || age > 1.45) continue;
      vec2 delta = aHome - ripple.xy;
      float d = length(delta);
      float decay = exp(-age * 2.15);
      float radius = 0.078 + smoothstep(0.0, 1.0, age) * 0.034;
      float well = 1.0 - smoothstep(radius * 0.30, radius, d);
      float ring = exp(-pow((d - radius) * 39.0, 2.0));
      float localRipple = (well * 0.68 + ring) * decay * ripple.w;
      vec2 localDirection = normalize(delta + vec2(0.0001));
      vec2 localTangent = vec2(-localDirection.y, localDirection.x);
      rippleLift += ring * decay * ripple.w;
      rippleWell = max(rippleWell, well * decay * ripple.w);
      rippleShift +=
        (localDirection * 2.9 + localTangent * 0.82) * localRipple;
    }
    float visibleGrain = smoothstep(0.025, 0.32, transfer);
    pos.xy += rippleShift * visibleGrain;
    pos.z +=
      rippleLift * visibleGrain * 0.72 -
      rippleWell * visibleGrain * 3.2;

    // The reference interaction is a continuously moving gravity well, not a
    // trail of synchronized click pulses. A dark centre bends the fabric into
    // depth while a compressed ring and velocity-coupled swirl preserve the
    // tactile, springy particle texture.
    vec2 pointerDelta = aHome - uPointer.xy;
    float pointerDistance = length(pointerDelta);
    vec2 pointerDirection = normalize(pointerDelta + vec2(0.0001));
    vec2 pointerTangent = vec2(-pointerDirection.y, pointerDirection.x);
    float pointerRadius = 0.18;
    float pointerEnvelope =
      1.0 - smoothstep(pointerRadius * 0.25, pointerRadius * 1.42, pointerDistance);
    float pointerCore =
      1.0 - smoothstep(pointerRadius * 0.08, pointerRadius * 0.68, pointerDistance);
    float pointerRing = exp(
      -pow((pointerDistance - pointerRadius * 0.74) * 43.0, 2.0)
    );
    float pointerSpeed = min(length(uPointerVelocity) * 2.4, 1.0);
    float pointerForce = uPointer.z * visibleGrain;
    float ringDelta = pointerRadius * 0.72 - pointerDistance;
    pos.xy +=
      pointerDirection * ringDelta * ${PLANE_W.toFixed(1)} *
        pointerEnvelope * pointerForce * 0.23 +
      pointerTangent * pointerRing * pointerSpeed * pointerForce * 0.92;
    pos.z +=
      pointerRing * pointerForce * 1.1 -
      pointerCore * pointerForce * 6.6;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float procedural = fbm(aHome * 3.1 + vec2(2.7, -1.4));
    vColor = mix(
      uColor * (0.28 + procedural * 0.42),
      sampledTex,
      uHasMap
    );
    // Keep the sampled hue; only a restrained gamma lift separates dark cover
    // pixels from the star field.
    vColor = min(
      pow(clamp(vColor, 0.0, 1.0), vec3(0.90)) * 0.88,
      vec3(0.86)
    );
    vColor *= 1.0 + pointerRing * pointerForce * 1.18;

    float luminance = dot(vColor, vec3(0.299, 0.587, 0.114));
    float perspective = 102.0 / max(1.0, -mv.z);
    float size = mix(
      0.82,
      1.58,
      hash21(vec2(seed, cycleId + 61.3))
    );
    size *= mix(0.85, 1.18, luminance);
    size *= mix(1.15, 0.98, imageCore);
    size *= 1.0 + pointerRing * pointerForce * 0.72;
    gl_PointSize = clamp(
      size * perspective * uPixelRatio,
      0.85,
      4.2
    );

    // No cover means no particles. With a cover, point opacity is the same
    // transfer that removed the corresponding image cell.
    vAlpha =
      mix(0.34, 1.0, uHasMap) *
      uOpacity *
      uDistanceFade *
      formT *
      min(1.0, clamp(transfer, 0.0, 1.0) * 1.08) *
      (mix(0.44, 0.88, imageCore) + rippleLift * 0.10) *
      (1.0 + pointerRing * pointerForce * 0.55) *
      (1.0 - pointerCore * pointerForce * 0.94);
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d2 = dot(p, p);
    float alpha = (exp(-d2 * 16.0) - 0.018) * vAlpha;
    if (alpha <= 0.003) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export interface AudioLevels {
  intensity: number;
  bass: number;
  mids: number;
  highs: number;
}

export class TimeMirror {
  public group: THREE.Group;
  public mirrorMat: THREE.ShaderMaterial;
  private plane: THREE.Mesh;
  private rim: THREE.Points;
  private rimMat: THREE.ShaderMaterial;
  private hit: THREE.Mesh;
  private halo: THREE.Sprite;
  private ripples: Float32Array;
  private rippleIndex = 0;
  private fallbackTex: THREE.Texture;
  private textureEpoch = 0;
  private transitionEpoch = 0;
  private lastTime = 0;
  private erosion = 0;
  private burst = 0;
  private previousBass = 0;
  private previousHighs = 0;
  private pointerTarget = 0;
  private pointerStrength = 0;
  public isOpen = false;
  public distanceFade = 1;

  constructor(haloTexture: THREE.Texture) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const dark = new Uint8Array([10, 10, 16, 255]);
    this.fallbackTex = new THREE.DataTexture(
      dark,
      1,
      1,
      THREE.RGBAFormat
    );
    this.fallbackTex.needsUpdate = true;
    this.ripples = new Float32Array(MAX_RIPPLES * 4);

    this.mirrorMat = new THREE.ShaderMaterial({
      vertexShader: PLANE_VERT,
      fragmentShader: PLANE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      uniforms: this.makeUniforms(),
    });
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_W, PLANE_H),
      this.mirrorMat
    );
    // The centre is a stable image surface. Its edge pixels are cut out by the
    // same transfer field that creates the particles, so the two layers remain
    // one dissolving object rather than a photo with a decorative particle ring.
    this.plane.visible = true;
    this.plane.renderOrder = 20;
    this.group.add(this.plane);

    // Keep one point for every image-grid cell. The shader owns the organic
    // boundary, so plane and points cannot drift into mismatched shape rules.
    const homes: number[] = [];
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const u = (gx + 0.5) / GRID_W;
        const v = (gy + 0.5) / GRID_H;
        homes.push(u, v);
      }
    }
    const count = homes.length / 2;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    );
    geometry.setAttribute(
      'aHome',
      new THREE.BufferAttribute(new Float32Array(homes), 2)
    );
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      210
    );

    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: this.makeUniforms(),
    });
    this.rim = new THREE.Points(geometry, this.rimMat);
    this.rim.renderOrder = 21;
    this.group.add(this.rim);

    this.hit = new THREE.Mesh(
      // A shallow volume keeps hover/click interaction alive when the player
      // flies around the particle fabric and views it from the side or back.
      new THREE.BoxGeometry(PLANE_W * 1.2, PLANE_H * 1.2, 7),
      new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
      })
    );
    this.group.add(this.hit);

    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture,
        color: new THREE.Color('#d8dbe2'),
        transparent: true,
        opacity: 0.012,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halo.scale.setScalar(80);
    this.halo.renderOrder = 19;
    this.group.add(this.halo);
  }

  private makeUniforms() {
    return {
      uMap: { value: this.fallbackTex },
      uHasMap: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: PLANE_W / PLANE_H },
      uColor: { value: new THREE.Color('#8d85c6') },
      uBass: { value: 0 },
      uHighs: { value: 0 },
      uAudioEnergy: { value: 0 },
      uErosion: { value: 0 },
      uBurst: { value: 0 },
      uOpacity: { value: 0 },
      uDistanceFade: { value: 1 },
      uForm: { value: 0 },
      uRipples: { value: this.ripples },
      uPointer: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
      uPointerVelocity: { value: new THREE.Vector2() },
      uPixelRatio: {
        // Keep point size aligned with the renderer's Retina cap.
        value: Math.min(window.devicePixelRatio, 1.6),
      },
    };
  }

  get hitMesh(): THREE.Mesh {
    return this.hit;
  }

  /** Orient once toward the final approach point, then remain world-fixed. */
  faceToward(position: THREE.Vector3) {
    this.group.lookAt(position);
  }

  /** Continuous local gravity well used by mouse hover. */
  setPointer(
    u: number,
    v: number,
    velocityX = 0,
    velocityY = 0
  ) {
    this.pointerTarget = 1;
    for (const uniforms of [
      this.mirrorMat.uniforms,
      this.rimMat.uniforms,
    ]) {
      const pointer = uniforms.uPointer.value as THREE.Vector4;
      pointer.x = u;
      pointer.y = v;
      (
        uniforms.uPointerVelocity.value as THREE.Vector2
      ).set(velocityX, velocityY);
    }
  }

  clearPointer() {
    this.pointerTarget = 0;
  }

  setPixelRatio(pixelRatio: number) {
    for (const uniforms of [
      this.mirrorMat.uniforms,
      this.rimMat.uniforms,
    ]) {
      uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  open(position: THREE.Vector3, color: string) {
    this.transitionEpoch++;
    this.group.position.copy(position);
    (
      this.mirrorMat.uniforms.uColor.value as THREE.Color
    ).set(color);
    (
      this.rimMat.uniforms.uColor.value as THREE.Color
    ).set(color);
    this.ripples.fill(0);
    this.pointerTarget = 0;
    this.pointerStrength = 0;
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.isOpen = true;
    this.distanceFade = 1;

    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    pm.uDistanceFade.value = 1;
    rm.uDistanceFade.value = 1;
    gsap.killTweensOf([
      pm.uForm,
      pm.uOpacity,
      rm.uForm,
      rm.uOpacity,
    ]);
    gsap.killTweensOf(this.halo.material);
    gsap.fromTo(
      rm.uForm,
      { value: 0 },
      { value: 1, duration: 1.45, ease: 'expo.out' }
    );
    gsap.fromTo(
      rm.uOpacity,
      { value: 0 },
      { value: 1, duration: 0.55, ease: 'power2.out' }
    );
    gsap.fromTo(
      pm.uForm,
      { value: 0 },
      {
        value: 1,
        duration: 1.55,
        ease: 'power2.inOut',
        delay: 0.22,
      }
    );
    gsap.fromTo(
      pm.uOpacity,
      { value: 0 },
      {
        value: 1,
        duration: 0.62,
        ease: 'power2.out',
        delay: 0.18,
      }
    );
    gsap.fromTo(
      this.halo.material as THREE.SpriteMaterial,
      { opacity: 0 },
      { opacity: 0.012, duration: 1.1 }
    );
  }

  close(onDone?: () => void) {
    if (!this.isOpen) {
      onDone?.();
      return;
    }

    this.isOpen = false;
    this.clearPointer();
    const closeTransition = ++this.transitionEpoch;
    const textureAtClose = this.textureEpoch;
    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    gsap.killTweensOf([
      pm.uForm,
      pm.uOpacity,
      rm.uForm,
      rm.uOpacity,
    ]);
    gsap.killTweensOf(this.halo.material);
    gsap.to(pm.uForm, {
      value: 0,
      duration: 0.65,
      ease: 'power2.in',
    });
    gsap.to(rm.uForm, {
      value: 0,
      duration: 0.78,
      ease: 'power2.in',
    });
    gsap.to(
      this.halo.material as THREE.SpriteMaterial,
      { opacity: 0, duration: 0.45 }
    );
    gsap.to([pm.uOpacity, rm.uOpacity], {
      value: 0,
      duration: 0.72,
      ease: 'power2.in',
      onComplete: () => {
        // A fast re-open owns the object now; this stale close must not hide
        // it or erase the newer cover texture.
        if (
          this.transitionEpoch !== closeTransition ||
          this.isOpen
        ) {
          return;
        }
        this.group.visible = false;
        if (this.textureEpoch === textureAtClose) {
          this.setTexture(null);
        }
        onDone?.();
      },
    });
  }

  setTexture(tex: THREE.Texture | null) {
    this.textureEpoch++;
    const target = tex || this.fallbackTex;
    const planeHasMap = this.mirrorMat.uniforms.uHasMap;
    const particleHasMap = this.rimMat.uniforms.uHasMap;
    gsap.killTweensOf([planeHasMap, particleHasMap]);
    this.mirrorMat.uniforms.uMap.value = target;
    this.rimMat.uniforms.uMap.value = target;

    if (tex) {
      gsap.to([planeHasMap, particleHasMap], {
        value: 1,
        duration: 0.72,
        ease: 'power2.inOut',
      });
    } else {
      planeHasMap.value = 0;
      particleHasMap.value = 0;
    }
  }

  addRipple(
    u: number,
    v: number,
    time: number,
    strength = 1
  ) {
    const index = this.rippleIndex * 4;
    this.ripples[index] = u;
    this.ripples[index + 1] = v;
    this.ripples[index + 2] = time;
    this.ripples[index + 3] = strength * 0.58;
    this.rippleIndex =
      (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  update(
    time: number,
    audio: AudioLevels,
    camera: THREE.Camera
  ) {
    const dt = this.lastTime
      ? THREE.MathUtils.clamp(time - this.lastTime, 0.001, 0.1)
      : 1 / 60;
    this.lastTime = time;
    if (!this.group.visible) return;

    const targetEnergy = THREE.MathUtils.clamp(
      audio.intensity * 0.46 +
        audio.bass * 0.25 +
        audio.mids * 0.21 +
        audio.highs * 0.08,
      0,
      1
    );
    const smoothing = targetEnergy > this.erosion
      ? 1 - Math.exp(-dt * 1.05)
      : 1 - Math.exp(-dt * 0.24);
    this.erosion +=
      (targetEnergy - this.erosion) * smoothing;

    // Only positive local musical changes create a burst, which then decays.
    // Shader-side cluster clocks decide where the burst may actually appear.
    const transient = Math.max(
      0,
      (audio.bass - this.previousBass) * 2.3 +
        (audio.highs - this.previousHighs) * 1.15 -
        0.055
    );
    this.previousBass = audio.bass;
    this.previousHighs = audio.highs;
    this.burst = Math.max(
      this.burst * Math.exp(-dt * 1.45),
      THREE.MathUtils.clamp(transient, 0, 1)
    );

    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    const pointerEase = 1 - Math.exp(-dt * (
      this.pointerTarget > this.pointerStrength ? 9.5 : 4.2
    ));
    this.pointerStrength +=
      (this.pointerTarget - this.pointerStrength) * pointerEase;
    for (const uniforms of [pm, rm]) {
      uniforms.uTime.value = time;
      uniforms.uBass.value = audio.bass;
      uniforms.uHighs.value = audio.highs;
      uniforms.uAudioEnergy.value = targetEnergy;
      uniforms.uErosion.value = this.erosion;
      uniforms.uBurst.value = this.burst;
      (
        uniforms.uPointer.value as THREE.Vector4
      ).z = this.pointerStrength;
    }

    const distance =
      camera.position.distanceTo(this.group.position);
    const targetFade =
      1 - THREE.MathUtils.smoothstep(distance, 85, 520);
    pm.uDistanceFade.value +=
      (targetFade - pm.uDistanceFade.value) * 0.12;
    rm.uDistanceFade.value = pm.uDistanceFade.value;
    this.distanceFade = pm.uDistanceFade.value;
    if (this.isOpen) {
      (
        this.halo.material as THREE.SpriteMaterial
      ).opacity = 0.012 * pm.uDistanceFade.value;
    }
  }

  dispose() {
    this.plane.geometry.dispose();
    this.mirrorMat.dispose();
    this.rim.geometry.dispose();
    this.rimMat.dispose();
    this.hit.geometry.dispose();
    (this.hit.material as THREE.Material).dispose();
    (this.halo.material as THREE.SpriteMaterial).dispose();
    this.fallbackTex.dispose();
  }
}
