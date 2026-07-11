/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GalaxyEngine — WebGL music galaxy.
 * Concepts:
 *  - Each ARTIST is a particle NEBULA (GPU point cloud + glowing core).
 *  - Entering a nebula reveals its SONGS as orbiting planets on rings.
 *  - Clicking a song flies the camera along a cinematic cubic-bezier path
 *    and blooms open a TimeMirror with the album artwork.
 * Rendering: three.js + UnrealBloom. Camera motions: GSAP.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { MusicNode } from '../types';
import { TimeMirror, AudioLevels } from './TimeMirror';
import { CORE_WHITE, SPACE_BG, paletteFor, NebulaPalette } from './palette';
import musicSynth from '../synth';

// ---------------------------------------------------------------- types

export interface ArtistDef {
  id: string;
  name: string;
  chineseName?: string;
  color: string;
  genre: string;
  region: string;
  songs: MusicNode[];
}

export interface EngineCallbacks {
  /** user entered / left an artist system (null = overview) */
  onFocusArtist: (artistId: string | null) => void;
  /** user clicked a song planet */
  onSelectSong: (song: MusicNode, shiftKey: boolean) => void;
  /** user dismissed the current song (clicked empty space / zoomed out) */
  onDeselectSong: () => void;
  onHoverChange: (hover: { type: 'artist' | 'song'; id: string; name: string } | null) => void;
  onModeChange: (mode: EngineMode) => void;
}

export type EngineMode = 'overview' | 'artist' | 'song';

interface NebulaEntry {
  def: ArtistDef;
  palette: NebulaPalette;
  group: THREE.Group;      // carries position + disk tilt quaternion
  cloud: THREE.Points;
  cloudMat: THREE.ShaderMaterial;
  gas: THREE.Points;       // additive glowing mist riding the arms
  gasMat: THREE.ShaderMaterial;
  dust: THREE.Points;      // normal-blended dark smoke (occluding dust lanes)
  dustMat: THREE.ShaderMaterial;
  mist: THREE.Mesh;        // continuous procedural gas-flow disk
  mistMat: THREE.ShaderMaterial;
  core: THREE.Sprite;
  veil: THREE.Sprite;
  coreDim: number;         // eased multiplier; drops while the mirror is open
  coreDimTarget: number;
  hit: THREE.Mesh;
  label: HTMLDivElement;
  labelName: HTMLDivElement;
  labelSub: HTMLDivElement;
  baseCoreScale: number;
  diskRadius: number;
  armPhase: number;        // spiral arm azimuth offset (song stars sit on the arms)
  spinTime: number;        // accumulated local rotation time (drives shader + song stars)
  spinFactor: { v: number }; // 1 = rotating, tweens to 0 when a song is selected
  hoverT: number;
  dimT: number;
  matched: boolean;
}

interface SongStarEntry {
  node: MusicNode;
  star: THREE.Sprite;      // diffraction-spike bright star
  hit: THREE.Mesh;
  label: HTMLDivElement;
  labelBelow: boolean;     // alternate above/below to reduce collisions
  radius: number;          // disk-plane radius
  theta0: number;          // initial azimuth on the arm
  height: number;
  baseScale: number;
}

// ---------------------------------------------------------------- shaders

// Spiral-disk galaxy particles. Per-particle color is precomputed on the CPU
// (core→arm→accent→deep along the radius, plus dark dust); the shader only
// handles Keplerian differential rotation, soft gaussian falloff and twinkle.
const NEBULA_VERT = /* glsl */ `
  attribute float aRadius;    // disk-plane radius
  attribute float aTheta;     // initial azimuth (arm shape baked in)
  attribute float aHeight;    // disk thickness offset
  attribute float aSize;
  attribute float aBright;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uSpinTime;
  uniform float uFocus;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vBright;
  varying float vTwinkle;
  void main() {
    // density-wave rotation: mostly rigid + a whisper of Keplerian shear
    // (keep in sync with spinSpeedAt in TS)
    float w = 0.1517 + (1.6 / (sqrt(aRadius) + 2.0)) * 0.18;
    float theta = aTheta + uSpinTime * w;
    float r = aRadius * (1.0 + uFocus * 0.32);
    vec3 p = vec3(cos(theta) * r, aHeight * (1.0 + uFocus * 0.5), sin(theta) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float att = 400.0 / max(1.0, -mv.z);
    gl_PointSize = clamp(aSize * att * uPixelRatio * (1.0 + uFocus * 0.35), 0.5, 34.0);
    vColor = aColor;
    vBright = aBright;
    vTwinkle = 0.8 + 0.2 * sin(uSpinTime * 2.6 + aPhase);
  }
`;

const NEBULA_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform float uBrightness;
  varying vec3 vColor;
  varying float vBright;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    // pure gaussian falloff — no visible sprite edge
    float a = exp(-d2 * 14.0) - 0.004;
    if (a <= 0.0) discard;
    vec3 col = vColor * uBrightness * (0.72 + 0.28 * vTwinkle) * vBright;
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

// Large rotating smoke billboards riding the same Keplerian spin as the disk.
// Each puff slowly self-rotates (vRot), picks one of 4 atlas silhouettes, and
// is pseudo-lit by the galactic core (bright toward the core, shadowed away).
const SMOKE_VERT = /* glsl */ `
  attribute float aRadius;
  attribute float aTheta;
  attribute float aHeight;
  attribute float aSize;
  attribute float aPhase;
  attribute float aRotSpeed;
  attribute float aVariant;   // 0..3 atlas cell
  attribute vec3 aColor;
  attribute float aAlpha;
  uniform float uSpinTime;
  uniform float uFocus;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vVariant;
  varying vec2 vLightDir;     // screen-space direction toward the galactic core
  void main() {
    // density-wave rotation (keep in sync with spinSpeedAt in TS)
    float w = 0.1517 + (1.6 / (sqrt(aRadius) + 2.0)) * 0.18;
    float theta = aTheta + uSpinTime * w;
    float r = aRadius * (1.0 + uFocus * 0.32);
    vec3 p = vec3(cos(theta) * r, aHeight * (1.0 + uFocus * 0.5), sin(theta) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float att = 400.0 / max(1.0, -mv.z);
    gl_PointSize = clamp(aSize * att * uPixelRatio * (1.0 + uFocus * 0.3), 2.0, 460.0);
    vColor = aColor;
    // mist is a close-up detail: distant galaxies read as crisp stars, so the
    // additive haze fades with camera distance and the void stays black
    float distFade = mix(1.0, 0.1, smoothstep(420.0, 950.0, -mv.z));
    vAlpha = aAlpha * distFade * (0.85 + 0.15 * sin(uSpinTime * 0.7 + aPhase * 9.0));
    vRot = aPhase * 6.2831 + uSpinTime * aRotSpeed;
    vVariant = aVariant;
    // view-space direction from this puff toward the core (group origin)
    vec4 coreMv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 toCore = coreMv.xy - mv.xy;
    vLightDir = length(toCore) > 0.001 ? normalize(toCore) : vec2(0.0);
  }
`;

const SMOKE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uLightGain;   // strength of the core-side illumination
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vVariant;
  varying vec2 vLightDir;
  void main() {
    // rotate the billboard UV so every puff drifts uniquely
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot), co = cos(vRot);
    vec2 rc = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
    // pick the atlas cell (2x2), clamped away from cell borders
    vec2 cellUv = clamp(rc + 0.5, 0.02, 0.98) * 0.5;
    float vx = mod(vVariant, 2.0) * 0.5;
    float vy = floor(vVariant / 2.0) * 0.5;
    float a = texture2D(uMap, cellUv + vec2(vx, vy)).a;

    // pseudo volumetric lighting: the rim facing the core catches its light,
    // the far side falls into shadow — sculpts the puff like the reference
    float k = dot(normalize(c + 1e-5), vLightDir); // note: original (unrotated) offset
    float lit = 1.0 + k * uLightGain;
    vec3 col = vColor * lit + vec3(1.0, 0.93, 0.78) * max(k, 0.0) * uLightGain * 0.35;

    float alpha = a * vAlpha * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Continuous procedural mist disk — the seamless "gas flow" underlying the
// discrete puffs. Arm pattern matches the particle parameterization exactly
// and shears with the same Keplerian spin. Fades out at grazing view angles.
const MISTDISK_VERT = /* glsl */ `
  uniform float uFocus;
  varying vec2 vUv;
  varying float vFacing;
  varying float vDist;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.xy *= 1.0 + uFocus * 0.32; // expand with the particle disk on focus
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    vFacing = abs(dot(worldNormal, viewDir));
    vDist = distance(cameraPosition, wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const MISTDISK_FRAG = /* glsl */ `
  uniform float uSpinTime;
  uniform float uOpacity;
  uniform float uArmPhase;
  uniform float uTurns;
  uniform float uRadius;     // world disk radius (for the Keplerian rate)
  uniform float uSeed;
  uniform vec3 uCore;
  uniform vec3 uArm;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying float vFacing;
  varying float vDist;

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
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      v += amp * vnoise(p);
      p *= 2.15;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float rn = length(p);
    if (rn > 1.0) discard;
    float theta = atan(p.y, p.x);

    // same arm parameterization as the particles (radius eased by ARM_R_EXP;
    // 0.7407 = 1/1.35 inverts it). The pattern rotates as a RIGID density wave
    // (real spiral arms don't wind up) — shear lives in the particle layers.
    float t = pow(clamp((rn - 0.13) / 0.87, 0.0, 1.0), 0.7407);
    float wRigid = 1.6 / (sqrt(0.55 * uRadius) + 2.0);
    float armCenter = uArmPhase + t * uTurns + uSpinTime * wRigid;

    // two arms: bright ridge every PI. Narrow band — the gaps between arms
    // must stay BLACK (that contrast is where the depth lives)
    float d = theta - armCenter;
    float armWave = cos(2.0 * d);
    // noise-carved gas: arm band + marbled detail
    float n1 = fbm(vec2(theta * 1.6 + uSeed, rn * 5.5 - uSeed));
    float n2 = fbm(vec2(theta * 4.0 - uSeed * 2.0, rn * 11.0 + uSeed) + uSpinTime * 0.015);
    float arm = smoothstep(0.18, 0.95, armWave) * (0.45 + 0.55 * n1);

    float bulge = smoothstep(0.3, 0.0, rn) * (0.55 + 0.45 * n1);
    float body = arm * smoothstep(1.0, 0.2, rn) + bulge;
    body *= 0.55 + 0.65 * n2; // internal marbling

    // radial color story
    vec3 col = mix(uCore, uArm, smoothstep(0.05, 0.42, rn));
    col = mix(col, uAccent, smoothstep(0.45, 0.95, rn) * 0.65);

    float alpha = body * uOpacity * smoothstep(1.0, 0.62, rn);
    // grazing angles: the flat disk must never read as a paper cut-out
    alpha *= smoothstep(0.10, 0.42, vFacing);
    // close-up detail only — fades out toward overview distance
    alpha *= mix(1.0, 0.08, smoothstep(420.0, 950.0, vDist));
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col * (0.8 + 0.5 * body), alpha);
  }
`;

const STARS_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * (900.0 / max(1.0, -mv.z)) * uPixelRatio, 0.4, 5.5);
    vColor = aColor;
    vTwinkle = 0.45 + 0.55 * sin(uTime * 1.6 + aPhase);
  }
`;

const STARS_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float a = exp(-d2 * 16.0) - 0.006;
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor, a * vTwinkle * 0.8);
  }
`;

// ---------------------------------------------------------------- helpers

/** Exponential-falloff glow — no visible edge at any scale. */
function makeGlowTexture(): THREE.Texture {
  const SIZE = 256;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - SIZE / 2) / (SIZE / 2);
      const dy = (y - SIZE / 2) / (SIZE / 2);
      const d2 = dx * dx + dy * dy;
      // twin gaussian: hot core + wide soft veil (tail kept quiet — 25 cores
      // overlap at overview distance and their tails sum into grey)
      const a = Math.exp(-d2 * 18) * 0.85 + Math.exp(-d2 * 3.6) * 0.1;
      const i = (y * SIZE + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 2x2 atlas of torn, filamentary smoke wisps (ridged turbulence, anisotropic
 * stretch). Four distinct silhouettes so clustered puffs never read as
 * repeated "cotton balls".
 */
function makeSmokeAtlas(): THREE.Texture {
  const CELL = 256;
  const SIZE = CELL * 2;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);

  // value-noise fbm + ridged turbulence
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = (Math.random() * 256) | 0;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise2 = (x: number, y: number) => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const h = (a: number, b: number) => P[(P[a & 255] + b) & 255] / 255;
    const u = smooth(xf), v = smooth(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), cc = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  const fbm = (x: number, y: number, oct = 4) => {
    let v = 0, amp = 0.55, f = 1;
    for (let o = 0; o < oct; o++) {
      v += amp * noise2(x * f, y * f);
      f *= 2.13;
      amp *= 0.5;
    }
    return v;
  };
  // ridged: bright filaments where the noise crosses its midline
  const ridged = (x: number, y: number) => {
    let v = 0, amp = 0.62, f = 1;
    for (let o = 0; o < 4; o++) {
      v += amp * (1 - Math.abs(2 * noise2(x * f, y * f) - 1));
      f *= 2.2;
      amp *= 0.52;
    }
    return v;
  };

  // per-cell character: stretch direction, anisotropy, seed offset
  const cells = [
    { ox: 0, oy: 0, ang: 0.4, an: 2.1, sx: 0, sy: 0 },
    { ox: CELL, oy: 0, ang: 1.9, an: 1.7, sx: 37, sy: 91 },
    { ox: 0, oy: CELL, ang: 2.9, an: 2.4, sx: 113, sy: 51 },
    { ox: CELL, oy: CELL, ang: 5.2, an: 1.5, sx: 71, sy: 143 },
  ];

  cells.forEach((cell) => {
    const ca = Math.cos(cell.ang), sa = Math.sin(cell.ang);
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const dx = (x - CELL / 2) / (CELL / 2);
        const dy = (y - CELL / 2) / (CELL / 2);
        // anisotropic sample space (stretched along cell.ang → torn streaks)
        const rx = (dx * ca + dy * sa) * cell.an;
        const ry = (-dx * sa + dy * ca);
        const nx = rx * 2.6 + cell.sx, ny = ry * 2.6 + cell.sy;

        const fil = ridged(nx * 1.35, ny * 1.35);            // filament structure
        const body = fbm(nx, ny);                            // cloud body
        const edge = fbm(nx * 0.55 + 31, ny * 0.55 + 17, 3); // silhouette breakup

        const d = Math.sqrt(rx * rx / (cell.an * 0.8) + ry * ry);
        const falloff = Math.max(0, 1 - d * (0.72 + edge * 0.65));
        // marble the interior: body clouds carved by bright filaments
        let a = Math.pow(falloff, 1.55) * (body * 0.55 + Math.pow(fil, 2.4) * 0.75);
        a = Math.min(1, a * 1.25);

        const i = ((y + cell.oy) * SIZE + (x + cell.ox)) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
      }
    }
  });

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Astro-photography diffraction spikes — the "brightest star" look for songs. */
function makeStarSpikeTexture(): THREE.Texture {
  const SIZE = 256;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - SIZE / 2) / (SIZE / 2);
      const dy = (y - SIZE / 2) / (SIZE / 2);
      const d2 = dx * dx + dy * dy;
      // core
      let a = Math.exp(-d2 * 42) * 1.0 + Math.exp(-d2 * 7) * 0.12;
      // vertical + horizontal spikes (sharp gaussian across, long falloff along)
      const spikeV = Math.exp(-(dx * dx) * 900) * Math.exp(-Math.abs(dy) * 4.2) * 0.9;
      const spikeH = Math.exp(-(dy * dy) * 900) * Math.exp(-Math.abs(dx) * 4.2) * 0.9;
      // faint 45° secondary spikes
      const u = (dx + dy) * 0.7071, v = (dx - dy) * 0.7071;
      const spikeD1 = Math.exp(-(u * u) * 1400) * Math.exp(-Math.abs(v) * 7.0) * 0.35;
      const spikeD2 = Math.exp(-(v * v) * 1400) * Math.exp(-Math.abs(u) * 7.0) * 0.35;
      a += spikeV + spikeH + spikeD1 + spikeD2;
      const i = (y * SIZE + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const OVERVIEW_RADIUS = 1020;
const ARTIST_RADIUS = 250;
const SONG_DISTANCE = 82;
const ARM_TURNS = Math.PI * 1.05; // gentle ~half-turn per arm — no ring stacking
/** Radius easing along the arm: inner tight, outer spacing widens (log-spiral feel). */
const ARM_R_EXP = 1.35;
const armRadius = (t: number) => 0.13 + 0.87 * Math.pow(t, ARM_R_EXP);
/**
 * Angular speed used by BOTH the GPU cloud and CPU song stars.
 * Mostly-rigid density-wave rotation with a whisper of Keplerian shear —
 * pure Kepler winds the arms into concentric rings within seconds.
 * Keep in sync with the GLSL copies in NEBULA_VERT / SMOKE_VERT.
 */
const spinSpeedAt = (r: number) =>
  0.185 * 0.82 + (1.6 / (Math.sqrt(r) + 2.0)) * 0.18;

// ---------------------------------------------------------------- engine

export class GalaxyEngine {
  private container: HTMLDivElement;
  private labelLayer: HTMLDivElement;
  private callbacks: EngineCallbacks;
  private artists: ArtistDef[];

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private timer = new THREE.Timer();
  private elapsed = 0;
  private rafId = 0;
  private bgTimeoutId = 0;

  // camera rig
  private lookTarget = new THREE.Vector3(0, 0, 0);
  private sph = { theta: -0.55, phi: 1.02, radius: OVERVIEW_RADIUS };
  private sphTarget = { theta: -0.55, phi: 1.02, radius: OVERVIEW_RADIUS };
  private rollAngle = { v: 0 };
  private flying = false;
  private lastInteraction = 0;

  // interaction
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDown: { x: number; y: number; t: number } | null = null;
  private dragging = false;
  private hovered: { type: 'artist' | 'song'; id: string } | null = null;
  private lastRippleAt = 0;

  // world
  private nebulas = new Map<string, NebulaEntry>();
  private planets = new Map<string, SongStarEntry>();
  private songHostId: string | null = null; // nebula currently carrying song stars
  private compareLink: THREE.Mesh | null = null;
  private mirror!: TimeMirror;
  private glowTex!: THREE.Texture;
  private spikeTex!: THREE.Texture;
  private smokeTex!: THREE.Texture;

  // state
  public mode: EngineMode = 'overview';
  private focusedArtistId: string | null = null;
  private selectedSongId: string | null = null;
  private selectedSongIdB: string | null = null;
  private mirrorOpenCall: gsap.core.Tween | null = null;
  private searchQuery = '';
  private disposed = false;

  // audio smoothing
  private levels: AudioLevels = { intensity: 0.05, bass: 0.05, mids: 0.05, highs: 0.05 };

  constructor(
    container: HTMLDivElement,
    labelLayer: HTMLDivElement,
    artists: ArtistDef[],
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.labelLayer = labelLayer;
    this.artists = artists;
    this.callbacks = callbacks;

    this.initRenderer();
    this.initWorld();
    this.bindEvents();

    // Cinematic arrival: drift in from deep space toward the galaxy
    this.sph.radius = 2350;
    this.sph.phi = 0.62;
    this.sph.theta = this.sphTarget.theta - 0.5;
    this.applySpherical();
    this.flying = true;
    gsap.to(this.sph, {
      radius: this.sphTarget.radius,
      phi: this.sphTarget.phi,
      theta: this.sphTarget.theta,
      duration: 3.4,
      ease: 'power3.out',
      onUpdate: () => this.applySpherical(),
      onComplete: () => { this.flying = false; },
    });

    this.loop();
  }

  // ------------------------------------------------ setup

  private initRenderer() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    // Pure black clear: the post chain re-encodes the clear color (grey-lifting
    // any non-zero value), and black survives any encoding. The subtle blue
    // air of SPACE_BG lives in the CSS backdrop + vignette instead.
    this.renderer.setClearColor(0x000000, 1);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.5, 6000);
    this.applySpherical(true);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // High threshold + tight radius: only true highlights bloom, and their
    // halo stays close — a wide radius smears 25 galaxies into a grey shroud.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.0, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  private initWorld() {
    this.glowTex = makeGlowTexture();
    this.spikeTex = makeStarSpikeTexture();
    this.smokeTex = makeSmokeAtlas();

    // --- background starfield: 90% neutral warm whites, 10% quiet accents ---
    const STAR_COUNT = 3200;
    const pos = new Float32Array(STAR_COUNT * 3);
    const size = new Float32Array(STAR_COUNT);
    const phase = new Float32Array(STAR_COUNT);
    const color = new Float32Array(STAR_COUNT * 3);
    const neutrals = ['#eae2d4', '#d8d2c6', '#ffffff', '#cfc6ba'].map((c) => new THREE.Color(c));
    const accents = ['#aab6cf', '#c9b8a0', '#a8b8b2'].map((c) => new THREE.Color(c));
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1600 + Math.random() * 1400;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      size[i] = Math.random() * 1.7 + 0.3;
      phase[i] = Math.random() * Math.PI * 2;
      const c = Math.random() < 0.9
        ? neutrals[(Math.random() * neutrals.length) | 0]
        : accents[(Math.random() * accents.length) | 0];
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STARS_VERT,
      fragmentShader: STARS_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.name = 'starfield';
    this.scene.add(stars);

    // --- near-field drifting stars: parallax layer sharing the galaxies' space ---
    const NEAR_COUNT = 1100;
    const nPos = new Float32Array(NEAR_COUNT * 3);
    const nSize = new Float32Array(NEAR_COUNT);
    const nPhase = new Float32Array(NEAR_COUNT);
    const nColor = new Float32Array(NEAR_COUNT * 3);
    for (let i = 0; i < NEAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 350 + Math.pow(Math.random(), 0.7) * 1100;
      nPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      nPos[i * 3 + 1] = r * Math.cos(phi) * 0.7;
      nPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      nSize[i] = Math.random() * 1.2 + 0.25;
      nPhase[i] = Math.random() * Math.PI * 2;
      const c = neutrals[(Math.random() * neutrals.length) | 0];
      const dim = 0.5 + Math.random() * 0.4;
      nColor[i * 3] = c.r * dim; nColor[i * 3 + 1] = c.g * dim; nColor[i * 3 + 2] = c.b * dim;
    }
    const nearGeo = new THREE.BufferGeometry();
    nearGeo.setAttribute('position', new THREE.BufferAttribute(nPos, 3));
    nearGeo.setAttribute('aSize', new THREE.BufferAttribute(nSize, 1));
    nearGeo.setAttribute('aPhase', new THREE.BufferAttribute(nPhase, 1));
    nearGeo.setAttribute('aColor', new THREE.BufferAttribute(nColor, 3));
    const nearStars = new THREE.Points(nearGeo, starMat);
    this.scene.add(nearStars);

    // --- distant Milky Way band: a tilted arc of fine grain across the deep sky ---
    const MW_COUNT = 5200;
    const mwPos = new Float32Array(MW_COUNT * 3);
    const mwSize = new Float32Array(MW_COUNT);
    const mwPhase = new Float32Array(MW_COUNT);
    const mwColor = new Float32Array(MW_COUNT * 3);
    // band plane basis: tilted ~40° so the arc sweeps diagonally behind the scene
    const bandNormal = new THREE.Vector3(0.55, 0.78, 0.3).normalize();
    const bandU = new THREE.Vector3(1, 0, 0).cross(bandNormal).normalize();
    const bandV = new THREE.Vector3().crossVectors(bandNormal, bandU).normalize();
    const gaussRnd = () => Math.random() + Math.random() + Math.random() - 1.5;
    const mwTints = ['#e8e0d2', '#d5cfc4', '#c6c4bd', '#b8bcc4'].map((c) => new THREE.Color(c));
    for (let i = 0; i < MW_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 2150 + gaussRnd() * 420;
      const p = new THREE.Vector3()
        .addScaledVector(bandU, Math.cos(a) * rr)
        .addScaledVector(bandV, Math.sin(a) * rr)
        .addScaledVector(bandNormal, gaussRnd() * 240);
      mwPos[i * 3] = p.x; mwPos[i * 3 + 1] = p.y; mwPos[i * 3 + 2] = p.z;
      mwSize[i] = Math.random() * 1.1 + 0.2;
      mwPhase[i] = Math.random() * Math.PI * 2;
      const c = mwTints[(Math.random() * mwTints.length) | 0];
      const dim = 0.3 + Math.random() * 0.45; // a whisper — never competes with artists
      mwColor[i * 3] = c.r * dim; mwColor[i * 3 + 1] = c.g * dim; mwColor[i * 3 + 2] = c.b * dim;
    }
    const mwGeo = new THREE.BufferGeometry();
    mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPos, 3));
    mwGeo.setAttribute('aSize', new THREE.BufferAttribute(mwSize, 1));
    mwGeo.setAttribute('aPhase', new THREE.BufferAttribute(mwPhase, 1));
    mwGeo.setAttribute('aColor', new THREE.BufferAttribute(mwColor, 3));
    const milkyWay = new THREE.Points(mwGeo, starMat);
    this.scene.add(milkyWay);
    // faint gas smudges along the band give the grain its "river" continuity
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const rr = 2150 + gaussRnd() * 300;
      const smudge = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTex,
          color: new THREE.Color('#b9b4ab'),
          transparent: true,
          opacity: 0.022 + Math.random() * 0.016,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          rotation: Math.random() * Math.PI * 2,
        })
      );
      smudge.position
        .set(0, 0, 0)
        .addScaledVector(bandU, Math.cos(a) * rr)
        .addScaledVector(bandV, Math.sin(a) * rr)
        .addScaledVector(bandNormal, gaussRnd() * 160);
      smudge.scale.setScalar(420 + Math.random() * 380);
      this.scene.add(smudge);
    }

    // --- remote background galaxies: tiny stretched glints in the far dark ---
    for (let i = 0; i < 11; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 1900 + Math.random() * 800;
      const glint = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: new THREE.Color(Math.random() > 0.5 ? '#d8d0c2' : '#c2c8d5'),
          transparent: true,
          opacity: 0.045 + Math.random() * 0.05,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          rotation: Math.random() * Math.PI,
        })
      );
      glint.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      glint.scale.set(24 + Math.random() * 34, (24 + Math.random() * 34) * (0.3 + Math.random() * 0.35), 1);
      this.scene.add(glint);
    }

    // --- out-of-focus bokeh dust (near-field depth, Penderecki style) ---
    const BOKEH_COUNT = 42;
    const bPos = new Float32Array(BOKEH_COUNT * 3);
    const bCol = new Float32Array(BOKEH_COUNT * 3);
    const bokehTints = ['#8a92a5', '#7a7f8e', '#95919a', '#83879a'].map((c) => new THREE.Color(c));
    for (let i = 0; i < BOKEH_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 320 + Math.random() * 700;
      bPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      bPos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      bPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const c = bokehTints[(Math.random() * bokehTints.length) | 0];
      bCol[i * 3] = c.r; bCol[i * 3 + 1] = c.g; bCol[i * 3 + 2] = c.b;
    }
    const bokehGeo = new THREE.BufferGeometry();
    bokehGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bokehGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    const bokeh = new THREE.Points(
      bokehGeo,
      new THREE.PointsMaterial({
        map: this.glowTex,
        size: 26,
        transparent: true,
        opacity: 0.06,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    this.scene.add(bokeh);

    // (no full-screen center glow — the void must stay void; depth comes
    // from the galaxies themselves)

    // --- artist nebulas ---
    const layout = this.computeLayout();
    this.artists.forEach((def) => {
      const p = layout[def.id];
      const entry = this.buildNebula(def);
      entry.group.position.set(p.x, p.y, p.z);
      this.scene.add(entry.group);
      this.nebulas.set(def.id, entry);
    });

    // --- time mirror (shared instance) ---
    this.mirror = new TimeMirror(this.glowTex);
    this.scene.add(this.mirror.group);
  }

  private buildNebula(def: ArtistDef): NebulaEntry {
    const palette = paletteFor(def.color);
    const group = new THREE.Group();
    group.name = `nebula_${def.id}`;

    // deterministic per-artist variation
    let seed = 0;
    for (let i = 0; i < def.id.length; i++) seed = (seed * 31 + def.id.charCodeAt(i)) % 9973;
    const rand = () => {
      seed = (seed * 16807 + 11) % 2147483647;
      return (seed % 10000) / 10000;
    };
    const gauss = () => rand() + rand() + rand() - 1.5;

    const R = 64 + rand() * 30; // disk radius 64..94

    // disk tilt: interleaved 3D orientation (like the reference collage)
    const tiltAxis = new THREE.Vector3(Math.cos(rand() * Math.PI * 2), 0, Math.sin(rand() * Math.PI * 2)).normalize();
    const tiltAngle = 0.18 + rand() * 0.55; // 10°..42°
    group.quaternion.setFromAxisAngle(tiltAxis, tiltAngle);

    // ---- spiral-disk particles (stars are the seasoning; mist is the dish) ----
    const COUNT = 3400;
    const aRadius = new Float32Array(COUNT);
    const aTheta = new Float32Array(COUNT);
    const aHeight = new Float32Array(COUNT);
    const aSize = new Float32Array(COUNT);
    const aBright = new Float32Array(COUNT);
    const aPhase = new Float32Array(COUNT);
    const aColor = new Float32Array(COUNT * 3);

    const cCore = new THREE.Color(CORE_WHITE);
    const cArm = new THREE.Color(palette.arm);
    const cAccent = new THREE.Color(palette.accent);
    const cDust = new THREE.Color(palette.dust);
    const cDeep = new THREE.Color(palette.deep);
    const tmp = new THREE.Color();

    const ARM_COUNT = 2;
    const TURNS = ARM_TURNS;
    const armPhase = rand() * Math.PI * 2;

    for (let i = 0; i < COUNT; i++) {
      const kind = i / COUNT; // 0..0.15 bulge, 0.15..0.77 arms, 0.77..1 dust
      let r: number, theta: number, h: number, size: number, bright: number;

      if (kind < 0.15) {
        // central bulge — warm white sphere-ish glow
        r = Math.abs(gauss()) * R * 0.13;
        theta = rand() * Math.PI * 2;
        h = gauss() * R * 0.045;
        size = 1.0 + rand() * 2.1;
        bright = 0.85 + rand() * 0.6;
        tmp.copy(cCore).lerp(cArm, rand() * 0.25);
      } else if (kind < 0.77) {
        // spiral arms — radius eased so outer windings spread apart (log feel)
        const arm = i % ARM_COUNT;
        const t = Math.sqrt(rand()); // denser toward the center
        r = R * armRadius(t);
        const spread = (0.11 + 0.2 * t) * (1 + Math.abs(gauss()) * 0.4);
        theta = armPhase + arm * Math.PI + t * TURNS + gauss() * spread;
        h = gauss() * R * 0.028 * (1 + t * 1.1);
        size = 0.85 + rand() * 2.4;
        bright = 0.4 + rand() * 0.45;
        // radial color story: core-white → arm → accent → deep
        if (t < 0.24) tmp.copy(cCore).lerp(cArm, t / 0.24);
        else if (t < 0.68) tmp.copy(cArm).lerp(cAccent, (t - 0.24) / 0.44);
        else tmp.copy(cAccent).lerp(cDeep, (t - 0.68) / 0.32);
        // sparse HII "knots": brighter, bigger, whiter
        if (rand() > 0.94) {
          bright = 1.5 + rand() * 0.7;
          size *= 2.1;
          tmp.lerp(cCore, 0.45);
        }
        // subtle per-particle tint jitter keeps the arm painterly, not flat
        tmp.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06);
      } else {
        // dark dust lanes hugging the inner edge of the arms — soft, dim, large
        const arm = i % ARM_COUNT;
        const t = 0.18 + 0.82 * Math.sqrt(rand());
        r = R * armRadius(t) * (0.96 + rand() * 0.04);
        theta = armPhase + arm * Math.PI + t * TURNS - 0.13 + gauss() * 0.07;
        h = gauss() * R * 0.02 * (1 + t);
        size = 2.2 + rand() * 3.2;
        bright = 0.16 + rand() * 0.16;
        tmp.copy(cDust).lerp(cDeep, rand() * 0.5);
      }

      aRadius[i] = r;
      aTheta[i] = theta;
      aHeight[i] = h;
      aSize[i] = size;
      aBright[i] = bright;
      aPhase[i] = rand() * Math.PI * 2;
      aColor[i * 3] = tmp.r;
      aColor[i * 3 + 1] = tmp.g;
      aColor[i * 3 + 2] = tmp.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
    geo.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(aHeight, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);

    // Small initial phase: at ±18% shear this bends the arms gracefully
    // without ever winding them into rings.
    const spinTime0 = rand() * 80; // shared by shader + CPU-side song stars
    const cloudMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSpinTime: { value: spinTime0 },
        uFocus: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uOpacity: { value: 0.92 },
        uBrightness: { value: 1.0 },
      },
    });
    const cloud = new THREE.Points(geo, cloudMat);
    group.add(cloud);

    // ---- smoke layers: glowing gas + occluding dark dust (the "swirling mist") ----
    const buildSmoke = (count: number, dustLayer: boolean) => {
      const sRadius = new Float32Array(count);
      const sTheta = new Float32Array(count);
      const sHeight = new Float32Array(count);
      const sSize = new Float32Array(count);
      const sPhase = new Float32Array(count);
      const sRot = new Float32Array(count);
      const sVariant = new Float32Array(count);
      const sColor = new Float32Array(count * 3);
      const sAlpha = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const arm = i % ARM_COUNT;
        const t = dustLayer ? 0.15 + 0.85 * Math.sqrt(rand()) : Math.pow(rand(), 0.85);
        const r = R * (0.06 + 0.94 * Math.pow(t, ARM_R_EXP));
        const spread = dustLayer ? 0.1 + 0.12 * t : 0.16 + 0.22 * t;
        sRadius[i] = r;
        sTheta[i] = armPhase + arm * Math.PI + t * TURNS + gauss() * spread + (dustLayer ? -0.14 : 0);
        sHeight[i] = gauss() * R * 0.05 * (0.55 + t);
        // wide size variance: broad beds of mist + small detail wisps
        const big = rand() > 0.6;
        sSize[i] = dustLayer
          ? (big ? 34 + rand() * 26 : 16 + rand() * 18)
          : (big ? 40 + rand() * 34 : 18 + rand() * 22);
        sPhase[i] = rand();
        sRot[i] = (rand() - 0.5) * 0.45;
        sVariant[i] = (rand() * 4) | 0;
        if (dustLayer) {
          tmp.copy(cDust).lerp(cDeep, rand() * 0.7);
          sAlpha[i] = 0.14 + rand() * 0.12;
        } else {
          if (t < 0.3) tmp.copy(cCore).lerp(cArm, t / 0.3);
          else tmp.copy(cArm).lerp(cAccent, (t - 0.3) / 0.7);
          tmp.multiplyScalar(0.82);
          sAlpha[i] = 0.09 + rand() * 0.09;
        }
        sColor[i * 3] = tmp.r; sColor[i * 3 + 1] = tmp.g; sColor[i * 3 + 2] = tmp.b;
      }
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      sGeo.setAttribute('aRadius', new THREE.BufferAttribute(sRadius, 1));
      sGeo.setAttribute('aTheta', new THREE.BufferAttribute(sTheta, 1));
      sGeo.setAttribute('aHeight', new THREE.BufferAttribute(sHeight, 1));
      sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
      sGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
      sGeo.setAttribute('aRotSpeed', new THREE.BufferAttribute(sRot, 1));
      sGeo.setAttribute('aVariant', new THREE.BufferAttribute(sVariant, 1));
      sGeo.setAttribute('aColor', new THREE.BufferAttribute(sColor, 3));
      sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
      sGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);
      const mat = new THREE.ShaderMaterial({
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: dustLayer ? THREE.NormalBlending : THREE.AdditiveBlending,
        uniforms: {
          uSpinTime: { value: spinTime0 },
          uFocus: { value: 0 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
          uMap: { value: this.smokeTex },
          uOpacity: { value: 1 },
          uLightGain: { value: dustLayer ? 0.35 : 0.55 },
        },
      });
      const pts = new THREE.Points(sGeo, mat);
      group.add(pts);
      return { pts, mat };
    };
    const gasLayer = buildSmoke(130, false);
    const dustLayer = buildSmoke(70, true);

    // ---- continuous mist disk: the seamless gas flow beneath the puffs ----
    const mistMat = new THREE.ShaderMaterial({
      vertexShader: MISTDISK_VERT,
      fragmentShader: MISTDISK_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSpinTime: { value: spinTime0 },
        uFocus: { value: 0 },
        uOpacity: { value: 0.27 },
        uArmPhase: { value: armPhase },
        uTurns: { value: ARM_TURNS },
        uRadius: { value: R },
        uSeed: { value: rand() * 40 },
        uCore: { value: new THREE.Color(CORE_WHITE).multiplyScalar(0.85) },
        uArm: { value: cArm.clone() },
        uAccent: { value: cAccent.clone().multiplyScalar(0.8) },
      },
    });
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.15, R * 2.15), mistMat);
    mist.rotation.x = -Math.PI / 2; // lie in the disk plane (group carries the tilt)
    group.add(mist);

    // warm-white galactic core (shared temperature across ALL galaxies)
    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: new THREE.Color(CORE_WHITE),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const baseCoreScale = R * 0.42;
    core.scale.setScalar(baseCoreScale);
    group.add(core);

    // wide, very faint theme-colored veil — color identity without candy glow
    const veil = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: cArm,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    veil.scale.setScalar(R * 1.9);
    group.add(veil);

    // invisible ray target — a flattened ellipsoid hugging the visible disk,
    // so pointing anywhere at the galaxy (not just its core) registers
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.95, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.scale.y = 0.35;
    hit.userData = { type: 'artist', id: def.id };
    group.add(hit);

    // DOM label — serif editorial caption, readable over bright mist
    const label = document.createElement('div');
    label.className =
      'galaxy-label absolute pointer-events-none select-none text-center will-change-transform';
    const labelName = document.createElement('div');
    labelName.className = 'font-serif font-semibold text-[12.5px] text-[#e8e0d2] uppercase tracking-[0.2em] whitespace-nowrap';
    labelName.textContent = def.chineseName ? `${def.name} · ${def.chineseName}` : def.name;
    const labelSub = document.createElement('div');
    labelSub.className = 'font-mono text-[8.5px] text-[#e8e0d2]/50 tracking-[0.16em] whitespace-nowrap mt-1';
    labelSub.textContent = `${def.songs.length} TRACKS`;
    label.appendChild(labelName);
    label.appendChild(labelSub);
    label.style.opacity = '0';
    this.labelLayer.appendChild(label);

    return {
      def, palette, group, cloud, cloudMat,
      gas: gasLayer.pts, gasMat: gasLayer.mat,
      dust: dustLayer.pts, dustMat: dustLayer.mat,
      mist, mistMat,
      core, veil, coreDim: 1, coreDimTarget: 1,
      hit, label, labelName, labelSub,
      baseCoreScale, diskRadius: R, armPhase,
      spinTime: spinTime0, spinFactor: { v: 1 },
      hoverT: 0, dimT: 0, matched: false,
    };
  }

  // ------------------------------------------------ layouts

  /** Double-arm spiral layout — the one and only constellation arrangement. */
  private computeLayout(): Record<string, THREE.Vector3> {
    const out: Record<string, THREE.Vector3> = {};
    const N = this.artists.length;
    this.artists.forEach((a, idx) => {
      const arm = idx % 2;
      const t = idx / N;
      const ang = t * Math.PI * 3.2 + arm * Math.PI;
      const dist = 260 + t * 800;
      out[a.id] = new THREE.Vector3(
        Math.cos(ang) * dist,
        Math.sin(idx * 3.7) * 95,
        Math.sin(ang) * dist
      );
    });
    return out;
  }

  // ------------------------------------------------ song system

  /** Songs are the brightest stars ON the spiral arms — no orbit lines. */
  private buildSongSystem(def: ArtistDef) {
    this.destroySongSystem();
    const nebula = this.nebulas.get(def.id)!;
    const R = nebula.diskRadius;
    this.songHostId = def.id;

    const starColor = new THREE.Color(nebula.palette.accent).lerp(new THREE.Color('#ffffff'), 0.55);
    const n = def.songs.length;
    const perArm = Math.ceil(n / 2);

    def.songs.forEach((song, idx) => {
      const arm = idx % 2;
      const slot = Math.floor(idx / 2);
      // even spacing along the arm, away from the crowded core
      const t = 0.3 + 0.64 * (perArm <= 1 ? 0.5 : slot / (perArm - 1));
      // scatter within the arm cloud (not a bead chain): banded radius offsets
      // + sideways angular jitter, deterministic per song index
      const j1 = Math.sin(idx * 12.9898) * 0.5 + Math.sin(idx * 4.1) * 0.5; // -1..1
      const j2 = Math.sin(idx * 7.7 + 2.1);
      const radius = R * armRadius(t) * (1 + ((idx % 3) - 1) * 0.085 + j1 * 0.03);
      const theta0 = nebula.armPhase + arm * Math.PI + t * ARM_TURNS + j2 * 0.16;
      const height = Math.sin(idx * 2.3) * R * 0.035;

      const isMajor = (song.radius || 4.5) >= 8;
      const baseScale = isMajor ? 15 : 11;

      const star = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.spikeTex,
          color: starColor.clone(),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      star.scale.setScalar(baseScale);
      star.renderOrder = 10; // above the host galaxy's smoke layers
      nebula.group.add(star); // local coords — inherits the disk tilt

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(12, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData = { type: 'song', id: song.id };
      nebula.group.add(hit);

      const label = document.createElement('div');
      label.className = 'galaxy-label absolute pointer-events-none select-none will-change-transform';
      label.innerHTML = `<div class="font-sans text-[11px] text-[#ede7db] tracking-[0.1em] whitespace-nowrap">${song.name}</div>`;
      label.style.opacity = '0';
      this.labelLayer.appendChild(label);

      this.planets.set(song.id, {
        node: song, star, hit, label, labelBelow: idx % 2 === 1,
        radius, theta0, height, baseScale,
      });
    });
  }

  private destroySongSystem() {
    const host = this.songHostId ? this.nebulas.get(this.songHostId) : null;
    this.planets.forEach((p) => {
      (p.star.material as THREE.Material).dispose();
      p.hit.geometry.dispose();
      if (host) {
        host.group.remove(p.star);
        host.group.remove(p.hit);
      }
      p.label.remove();
    });
    this.planets.clear();
    this.songHostId = null;
    this.removeCompareLink();
  }

  // ------------------------------------------------ camera

  private applySpherical(hard = false) {
    if (hard) {
      this.sph.theta = this.sphTarget.theta;
      this.sph.phi = this.sphTarget.phi;
      this.sph.radius = this.sphTarget.radius;
    }
    const { theta, phi, radius } = this.sph;
    this.camera.position.set(
      this.lookTarget.x + radius * Math.sin(phi) * Math.sin(theta),
      this.lookTarget.y + radius * Math.cos(phi),
      this.lookTarget.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.up.set(Math.sin(this.rollAngle.v), 1, 0).normalize();
    this.camera.lookAt(this.lookTarget);
  }

  /** Sync spherical targets from the camera's current transform (after a flight). */
  private syncSphericalFromCamera() {
    const off = this.camera.position.clone().sub(this.lookTarget);
    const radius = off.length();
    const phi = Math.acos(THREE.MathUtils.clamp(off.y / radius, -1, 1));
    const theta = Math.atan2(off.x, off.z);
    this.sph = { theta, phi, radius };
    this.sphTarget = { theta, phi, radius };
  }

  /** Cinematic cubic-bezier camera flight. */
  private flyTo(
    camEnd: THREE.Vector3,
    lookEnd: THREE.Vector3,
    opts: { duration?: number; onComplete?: () => void; bloomPeak?: number } = {}
  ) {
    const camStart = this.camera.position.clone();
    const lookStart = this.lookTarget.clone();
    const dir = camEnd.clone().sub(camStart);
    const len = Math.max(dir.length(), 1);
    const up = new THREE.Vector3(0, 1, 0);
    const side = dir.clone().cross(up).normalize();
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);

    // Control points: rise and bank outward, then swoop in
    const c1 = camStart.clone().addScaledVector(dir, 0.28).addScaledVector(up, len * 0.16).addScaledVector(side, len * 0.14);
    const c2 = camStart.clone().addScaledVector(dir, 0.74).addScaledVector(up, len * 0.05).addScaledVector(side, -len * 0.07);
    const curve = new THREE.CubicBezierCurve3(camStart, c1, c2, camEnd);

    const duration = opts.duration ?? THREE.MathUtils.clamp(len / 420, 1.5, 2.7);
    const state = { t: 0 };
    this.flying = true;
    gsap.killTweensOf(state);

    const tl = gsap.timeline({
      onComplete: () => {
        this.flying = false;
        this.rollAngle.v = 0;
        this.camera.up.set(0, 1, 0);
        this.syncSphericalFromCamera();
        opts.onComplete?.();
      },
    });

    tl.to(state, {
      t: 1,
      duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        const t = state.t;
        curve.getPoint(t, this.camera.position);
        this.lookTarget.lerpVectors(lookStart, lookEnd, THREE.MathUtils.smoothstep(t, 0, 1));
        this.camera.up.set(Math.sin(this.rollAngle.v), 1, 0).normalize();
        this.camera.lookAt(this.lookTarget);
      },
    }, 0);

    // gentle banking roll
    tl.to(this.rollAngle, { v: 0.1, duration: duration * 0.4, ease: 'sine.inOut' }, 0);
    tl.to(this.rollAngle, { v: 0, duration: duration * 0.6, ease: 'sine.inOut' }, duration * 0.4);

    // speed sensation: fov + bloom pulse
    const fov = { v: this.camera.fov };
    tl.to(fov, {
      v: 68, duration: duration * 0.45, ease: 'power2.in',
      onUpdate: () => { this.camera.fov = fov.v; this.camera.updateProjectionMatrix(); },
    }, 0);
    tl.to(fov, {
      v: 55, duration: duration * 0.55, ease: 'power2.out',
      onUpdate: () => { this.camera.fov = fov.v; this.camera.updateProjectionMatrix(); },
    }, duration * 0.45);

    const bloomPeak = opts.bloomPeak ?? 1.9;
    tl.to(this.bloom, { strength: bloomPeak, duration: duration * 0.45, ease: 'power2.in' }, 0);
    tl.to(this.bloom, { strength: 1.0, duration: duration * 0.55, ease: 'power2.out' }, duration * 0.45);
  }

  // ------------------------------------------------ public navigation API

  focusArtist(id: string, notify = true) {
    if (this.disposed) return;
    const nebula = this.nebulas.get(id);
    if (!nebula) return;

    const wasFocused = this.focusedArtistId;
    this.closeMirrorAndDeselect(false);
    this.focusedArtistId = id;
    this.setMode('artist');
    this.buildSongSystem(nebula.def);

    // focus/unfocus nebula clouds + smoke layers
    this.nebulas.forEach((n, nid) => {
      const focused = nid === id;
      [n.cloudMat, n.gasMat, n.dustMat, n.mistMat].forEach((m) => {
        gsap.to(m.uniforms.uFocus, { value: focused ? 1 : 0, duration: 1.6, ease: 'power2.inOut' });
      });
      gsap.to(n.cloudMat.uniforms.uOpacity, { value: focused ? 0.95 : 0.5, duration: 1.2 });
      gsap.to(n.gasMat.uniforms.uOpacity, { value: focused ? 1 : 0.55, duration: 1.2 });
      gsap.to(n.dustMat.uniforms.uOpacity, { value: focused ? 1 : 0.6, duration: 1.2 });
      gsap.to(n.mistMat.uniforms.uOpacity, { value: focused ? 0.3 : 0.18, duration: 1.2 });
    });

    const center = nebula.group.position.clone();
    // approach along the disk normal (so the spiral arms face the camera),
    // banked slightly sideways for a 3/4 cinematic view
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(nebula.group.quaternion);
    if (normal.dot(this.camera.position.clone().sub(center)) < 0) normal.negate();
    const tangent = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
    if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0);
    else tangent.normalize();
    const dir = normal.clone().multiplyScalar(0.9).addScaledVector(tangent, 0.42).normalize();
    const camEnd = center.clone().addScaledVector(dir, ARTIST_RADIUS);

    this.flyTo(camEnd, center, {
      duration: wasFocused ? 2.2 : 2.4,
      bloomPeak: 1.8,
      onComplete: () => this.updateHint(),
    });

    if (notify) this.callbacks.onFocusArtist(id);
  }

  flyToOverview(notify = true) {
    if (this.disposed) return;
    this.closeMirrorAndDeselect(notify);
    this.focusedArtistId = null;
    this.setMode('overview');

    this.nebulas.forEach((n) => {
      [n.cloudMat, n.gasMat, n.dustMat, n.mistMat].forEach((m) => {
        gsap.to(m.uniforms.uFocus, { value: 0, duration: 1.4, ease: 'power2.inOut' });
      });
      gsap.to(n.cloudMat.uniforms.uOpacity, { value: 0.92, duration: 1.2 });
      gsap.to(n.gasMat.uniforms.uOpacity, { value: 1, duration: 1.2 });
      gsap.to(n.dustMat.uniforms.uOpacity, { value: 1, duration: 1.2 });
      gsap.to(n.mistMat.uniforms.uOpacity, { value: 0.27, duration: 1.2 });
    });

    const camEnd = new THREE.Vector3(
      OVERVIEW_RADIUS * Math.sin(1.02) * Math.sin(this.sph.theta),
      OVERVIEW_RADIUS * Math.cos(1.02),
      OVERVIEW_RADIUS * Math.sin(1.02) * Math.cos(this.sph.theta)
    );
    this.flyTo(camEnd, new THREE.Vector3(0, 0, 0), {
      duration: 2.0,
      onComplete: () => {
        this.destroySongSystem();
        this.updateHint();
      },
    });
    if (notify) this.callbacks.onFocusArtist(null);
  }

  /** Fly the camera to a song planet and bloom open the time mirror. */
  selectSong(node: MusicNode, notify = false) {
    if (this.disposed) return;
    const artistId = node.id.split('_')[1];
    if (this.focusedArtistId !== artistId) {
      // cross-system selection (e.g. from a side panel): focus first, then dive
      const nebula = this.nebulas.get(artistId);
      if (!nebula) return;
      this.focusArtist(artistId, true);
      // chain the dive after the system flight
      gsap.delayedCall(2.45, () => this.selectSong(node, notify));
      return;
    }

    const planet = this.planets.get(node.id);
    if (!planet) return;

    // switching from an already-open mirror: close it; the star scale
    // recovers automatically in the frame loop
    if (this.selectedSongId && this.selectedSongId !== node.id) {
      const prev = this.planets.get(this.selectedSongId);
      this.mirror.close(() => {
        if (prev) gsap.to(prev.star.material as THREE.SpriteMaterial, { opacity: 0.95, duration: 0.6 });
      });
      this.removeCompareLink();
      this.selectedSongIdB = null;
    }

    this.selectedSongId = node.id;
    this.setMode('song');

    const nebula = this.nebulas.get(artistId)!;

    // freeze the disk rotation almost instantly so the star's position is
    // stable by the time the mirror starts forming mid-flight
    gsap.to(nebula.spinFactor, { v: 0, duration: 0.2, ease: 'power2.out' });

    const starPos = new THREE.Vector3();
    planet.star.getWorldPosition(starPos);

    const center = nebula.group.position.clone();
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(nebula.group.quaternion);
    if (normal.dot(this.camera.position.clone().sub(center)) < 0) normal.negate();
    const outward = starPos.clone().sub(center).normalize();
    // hover above the disk, pushed slightly outward from the core
    const camEnd = starPos.clone()
      .addScaledVector(normal, SONG_DISTANCE * 0.88)
      .addScaledVector(outward, SONG_DISTANCE * 0.42);

    // dim the world hard around the mirror — it should hang in a black abyss,
    // the only light source in frame (core dimming eased in the frame loop).
    // Even the host's own particle bulge is pushed near-black so nothing
    // competes with the lens (the reference isolates it completely).
    gsap.to(nebula.cloudMat.uniforms.uOpacity, { value: 0.05, duration: 1.2 });
    gsap.to(nebula.gasMat.uniforms.uOpacity, { value: 0.03, duration: 1.2 });
    gsap.to(nebula.dustMat.uniforms.uOpacity, { value: 0.08, duration: 1.2 });
    gsap.to(nebula.mistMat.uniforms.uOpacity, { value: 0, duration: 1.2 });
    nebula.coreDimTarget = 0.015; // near-black: the warm core must not glow beside the lens
    // fade EVERY other galaxy down too — the reference isolates the lens in
    // pure void; no bright neighbor should compete for the eye
    this.nebulas.forEach((other, oid) => {
      if (oid === artistId) return;
      gsap.to(other.cloudMat.uniforms.uOpacity, { value: 0.05, duration: 1.2 });
      gsap.to(other.gasMat.uniforms.uOpacity, { value: 0.03, duration: 1.2 });
      other.coreDimTarget = 0.02;
    });
    this.planets.forEach((p, pid) => {
      gsap.to(p.star.material as THREE.SpriteMaterial, { opacity: pid === node.id ? 1 : 0.2, duration: 1.0 });
    });

    // open the mirror DURING the flight so it is already fully formed on
    // arrival — the user must never watch the centre-out reveal from a
    // parked camera. When switching songs, wait for the old lens to fade.
    const wasOpen = this.mirror.isOpen;
    this.mirrorOpenCall?.kill();
    this.mirrorOpenCall = gsap.delayedCall(wasOpen ? 0.45 : 0.3, () => {
      const mirrorPos = new THREE.Vector3();
      planet.star.getWorldPosition(mirrorPos);
      mirrorPos.addScaledVector(normal, 5);
      this.mirror.open(mirrorPos, nebula.palette.arm);
      this.updateHint();
    });

    this.flyTo(camEnd, starPos, {
      duration: 1.9,
      bloomPeak: 1.0, // no flash-white on arrival; the lens is meant to be dim
    });

    if (notify) this.callbacks.onSelectSong(node, false);
  }

  /** Second selection for DNA comparison (no camera move). */
  setCompareSong(node: MusicNode | null) {
    this.selectedSongIdB = node ? node.id : null;
    this.removeCompareLink();
    if (!node || !this.selectedSongId) return;
    const a = this.planets.get(this.selectedSongId);
    const b = this.planets.get(node.id);
    if (!a || !b) return;

    const pa = new THREE.Vector3(); a.star.getWorldPosition(pa);
    const pb = new THREE.Vector3(); b.star.getWorldPosition(pb);
    const mid = pa.clone().add(pb).multiplyScalar(0.5).add(new THREE.Vector3(0, 26, 0));
    const curve = new THREE.QuadraticBezierCurve3(pa, mid, pb);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.5, 6, false),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.scene.add(tube);
    this.compareLink = tube;

    // Reframe so both planets and the arc fit in view
    const span = pa.distanceTo(pb);
    const center = pa.clone().add(pb).multiplyScalar(0.5);
    const viewDir = this.camera.position.clone().sub(center).normalize();
    viewDir.y = Math.max(viewDir.y, 0.35);
    viewDir.normalize();
    const dist = Math.max(SONG_DISTANCE + 20, span * 1.25);
    this.flyTo(center.clone().addScaledVector(viewDir, dist), center, { duration: 1.4, bloomPeak: 1.2 });
  }

  private removeCompareLink() {
    if (this.compareLink) {
      this.compareLink.geometry.dispose();
      (this.compareLink.material as THREE.Material).dispose();
      this.scene.remove(this.compareLink);
      this.compareLink = null;
    }
  }

  /** Close mirror, restore the song star, return to the galaxy-disk view. */
  deselectSong(notify = true, flyBack = true) {
    if (!this.selectedSongId) return;
    const artistId = this.focusedArtistId;
    this.selectedSongId = null;
    this.selectedSongIdB = null;
    this.removeCompareLink();

    this.mirrorOpenCall?.kill();
    this.mirror.close();

    this.planets.forEach((p) => {
      gsap.to(p.star.material as THREE.SpriteMaterial, { opacity: 0.95, duration: 0.8 });
    });

    if (artistId) {
      const nebula = this.nebulas.get(artistId)!;
      gsap.to(nebula.spinFactor, { v: 1, duration: 1.6, ease: 'power2.inOut' });
      gsap.to(nebula.cloudMat.uniforms.uOpacity, { value: 0.92, duration: 1.0 });
      gsap.to(nebula.gasMat.uniforms.uOpacity, { value: 1, duration: 1.0 });
      gsap.to(nebula.dustMat.uniforms.uOpacity, { value: 1, duration: 1.0 });
      gsap.to(nebula.mistMat.uniforms.uOpacity, { value: 0.27, duration: 1.0 });
      nebula.coreDimTarget = 1; // veil recovers via the frame loop
      // bring the other galaxies back up to their artist-mode (unfocused) glow
      this.nebulas.forEach((other, oid) => {
        if (oid === artistId) return;
        gsap.to(other.cloudMat.uniforms.uOpacity, { value: 0.5, duration: 1.0 });
        gsap.to(other.gasMat.uniforms.uOpacity, { value: 0.55, duration: 1.0 });
        other.coreDimTarget = 1;
      });
      this.setMode('artist');
      if (flyBack) {
        const center = nebula.group.position.clone();
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(nebula.group.quaternion);
        if (normal.dot(this.camera.position.clone().sub(center)) < 0) normal.negate();
        const tangent = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
        if (tangent.lengthSq() < 1e-4) tangent.set(1, 0, 0);
        else tangent.normalize();
        const dir = normal.clone().multiplyScalar(0.9).addScaledVector(tangent, 0.42).normalize();
        this.flyTo(center.clone().addScaledVector(dir, ARTIST_RADIUS), center, { duration: 1.5 });
      }
    }
    if (notify) this.callbacks.onDeselectSong();
  }

  private closeMirrorAndDeselect(notify: boolean) {
    if (this.selectedSongId) this.deselectSong(notify, false);
  }

  setMirrorTexture(tex: THREE.Texture | null, accent?: string | null) {
    this.mirror.setTexture(tex, accent);
  }

  setSearch(q: string) {
    this.searchQuery = q.trim().toLowerCase();
    this.nebulas.forEach((n) => {
      const { def } = n;
      n.matched = this.searchQuery
        ? def.name.toLowerCase().includes(this.searchQuery) ||
          (def.chineseName || '').toLowerCase().includes(this.searchQuery) ||
          def.songs.some(
            (s) =>
              s.name.toLowerCase().includes(this.searchQuery) ||
              (s.chineseName || '').includes(this.searchQuery)
          )
        : false;
    });
  }

  zoomBy(factor: number) {
    this.sphTarget.radius = THREE.MathUtils.clamp(this.sphTarget.radius * factor, 40, 2200);
    this.lastInteraction = performance.now();
  }

  resetView() {
    if (this.mode === 'overview') {
      this.sphTarget = { theta: -0.55, phi: 1.02, radius: OVERVIEW_RADIUS };
    } else if (this.mode === 'artist') {
      this.sphTarget.radius = ARTIST_RADIUS;
      this.sphTarget.phi = 1.05;
    } else {
      this.sphTarget.radius = SONG_DISTANCE;
    }
  }

  getZoomPercent(): number {
    const base = this.mode === 'overview' ? OVERVIEW_RADIUS : this.mode === 'artist' ? ARTIST_RADIUS : SONG_DISTANCE;
    return Math.round((base / this.sph.radius) * 100);
  }

  // ------------------------------------------------ events

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    this.dragging = false;
    this.lastInteraction = performance.now();
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.pointerDown && !this.flying) {
      const dx = e.clientX - this.pointerDown.x;
      const dy = e.clientY - this.pointerDown.y;
      if (this.dragging || Math.hypot(dx, dy) > 6) {
        this.dragging = true;
        this.sphTarget.theta -= (e.movementX || 0) * 0.0042;
        this.sphTarget.phi = THREE.MathUtils.clamp(this.sphTarget.phi - (e.movementY || 0) * 0.0042, 0.25, 1.45);
        this.lastInteraction = performance.now();
      }
    }

    // ripples on the mirror
    if (this.mirror.isOpen && !this.dragging) {
      const now = performance.now();
      if (now - this.lastRippleAt > 46) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObject(this.mirror.hitMesh, false);
        if (hits.length && hits[0].uv) {
          this.mirror.addRipple(hits[0].uv.x, hits[0].uv.y, this.elapsed, 0.85);
          this.lastRippleAt = now;
        }
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (!down || this.flying) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    if (this.dragging || moved > 6 || dt > 600) {
      this.dragging = false;
      return;
    }
    // refresh picking coordinates from the click itself (pointer may not have moved)
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.handleClick(e.shiftKey);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.flying) return;

    // In song mode the lens fills the view — any zoom-out gesture means "step back"
    if (this.mode === 'song') {
      if (e.deltaY > 0) this.deselectSong(true);
      return;
    }

    let factor: number;
    if (e.ctrlKey) {
      factor = 1 + e.deltaY * 0.009;
      factor = THREE.MathUtils.clamp(factor, 0.85, 1.15);
    } else {
      factor = e.deltaY > 0 ? 1.09 : 0.92;
    }
    this.zoomBy(factor);

    // zoom-out escapes the artist system
    if (this.mode === 'artist' && this.sphTarget.radius > 480) {
      this.flyToOverview();
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.mode === 'song') this.deselectSong(true);
      else if (this.mode === 'artist') this.flyToOverview();
    }
  };

  /** Two-pass picking: song stars first, then the big galaxy ellipsoids —
   *  otherwise the flattened disk hit-volume would swallow star clicks. */
  private pickAtPointer(): { type: 'artist' | 'song'; id: string } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const songTargets: THREE.Object3D[] = [];
    this.planets.forEach((p) => songTargets.push(p.hit));
    if (songTargets.length) {
      const songHits = this.raycaster.intersectObjects(songTargets, false);
      if (songHits.length) return songHits[0].object.userData as { type: 'song'; id: string };
    }
    const artistTargets: THREE.Object3D[] = [];
    this.nebulas.forEach((n) => artistTargets.push(n.hit));
    const artistHits = this.raycaster.intersectObjects(artistTargets, false);
    if (artistHits.length) return artistHits[0].object.userData as { type: 'artist'; id: string };
    return null;
  }

  private handleClick(shiftKey: boolean) {
    const picked = this.pickAtPointer();

    if (!picked) {
      // empty space click while a mirror is open → back to the artist system
      if (this.mode === 'song') this.deselectSong(true);
      return;
    }

    if (picked.type === 'artist') {
      if (picked.id !== this.focusedArtistId) {
        this.focusArtist(picked.id); // enter or warp
      }
    } else {
      const planet = this.planets.get(picked.id);
      if (!planet) return;
      if (shiftKey && this.selectedSongId && this.selectedSongId !== picked.id) {
        this.callbacks.onSelectSong(planet.node, true);
        return;
      }
      if (picked.id === this.selectedSongId) return;
      // React round-trip drives engine.selectSong via the selectedNode prop
      this.callbacks.onSelectSong(planet.node, false);
    }
  }

  private bindEvents() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onVisibility();
  }

  private onResize = () => {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  // ------------------------------------------------ per-frame

  private updateAudioLevels() {
    let tI = 0.05, tB = 0.05, tM = 0.05, tH = 0.05;
    let playing = false;
    const analyser = musicSynth.analyser;
    if (analyser) {
      try {
        const n = analyser.frequencyBinCount;
        const arr = new Uint8Array(n);
        analyser.getByteFrequencyData(arr);
        let sum = 0, active = 0;
        for (let i = 0; i < n; i++) { sum += arr[i]; if (arr[i] > 5) active++; }
        const avg = sum / (n || 1);
        if (avg > 1.5 && active > 2) {
          playing = true;
          let bs = 0; const bE = Math.min(12, n);
          for (let i = 1; i < bE; i++) bs += arr[i];
          tB = bs / (bE - 1) / 255;
          let ms = 0; const mE = Math.min(50, n);
          for (let i = 12; i < mE; i++) ms += arr[i];
          tM = ms / (mE - 12) / 255;
          let hs = 0; const hE = Math.min(120, n);
          for (let i = 50; i < hE; i++) hs += arr[i];
          tH = hs / (hE - 50) / 255;
          tI = avg / 255;
        }
      } catch {}
    }
    if (!playing) {
      const t = this.elapsed;
      tI = (Math.sin(t * 0.8) * 0.3 + Math.cos(t * 1.5) * 0.2 + 0.5) * 0.16 + 0.04;
      tB = (Math.cos(t * 1.1) * 0.5 + 0.5) * 0.16 + 0.05;
      tM = (Math.sin(t * 1.6) * 0.5 + 0.5) * 0.12 + 0.04;
      tH = (Math.cos(t * 2.3) * 0.5 + 0.5) * 0.09 + 0.03;
    }
    const L = this.levels, k = 0.08;
    L.intensity += (tI - L.intensity) * k;
    L.bass += (tB - L.bass) * k;
    L.mids += (tM - L.mids) * k;
    L.highs += (tH - L.highs) * k;
  }

  private updateHover() {
    if (this.dragging || this.flying) return;
    const d = this.pickAtPointer();

    let next: { type: 'artist' | 'song'; id: string } | null = null;
    // ignore hover on the focused artist's own disk (nothing to do there)
    if (d && !(d.type === 'artist' && d.id === this.focusedArtistId)) next = d;

    const changed = next?.id !== this.hovered?.id || next?.type !== this.hovered?.type;
    if (changed) {
      this.hovered = next;
      this.container.style.cursor = next ? 'pointer' : 'grab';
      if (next) {
        const name =
          next.type === 'artist'
            ? this.nebulas.get(next.id)?.def.name || ''
            : this.planets.get(next.id)?.node.name || '';
        this.callbacks.onHoverChange({ ...next, name });
      } else {
        this.callbacks.onHoverChange(null);
      }
    }
  }

  private worldToScreen(v: THREE.Vector3, out: { x: number; y: number; visible: boolean }) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const p = v.clone().project(this.camera);
    // tight bounds: labels vanish at the frame edge instead of leaving orphans
    out.visible = p.z < 1 && p.x > -1.04 && p.x < 1.04 && p.y > -1.04 && p.y < 1.04;
    out.x = (p.x * 0.5 + 0.5) * w;
    out.y = (-p.y * 0.5 + 0.5) * h;
  }

  private screenPos = { x: 0, y: 0, visible: false };
  private tmpVec = new THREE.Vector3();

  private updateLabels() {
    const camDist = this.camera.position.distanceTo(this.lookTarget);

    this.nebulas.forEach((n, id) => {
      const isFocused = id === this.focusedArtistId;
      n.group.getWorldPosition(this.tmpVec);
      this.tmpVec.y -= isFocused ? -(n.diskRadius * 1.12 + 18) : n.diskRadius * 0.62 + 12;
      this.worldToScreen(this.tmpVec, this.screenPos);

      const isHovered = this.hovered?.type === 'artist' && this.hovered.id === id;
      let opacity = 0;
      if (this.screenPos.visible) {
        if (this.mode === 'overview') {
          opacity = this.searchQuery ? (n.matched ? 1 : 0.22) : isHovered ? 1 : 0.78;
        } else {
          // focused mode: show focused + hovered warp targets
          opacity = isFocused ? 0.95 : isHovered ? 0.9 : 0.3;
        }
        if (this.mode === 'song') opacity = 0; // the mirror carries its own title card
      }
      n.label.style.opacity = String(opacity);
      n.label.style.transform = `translate(-50%, -50%) translate(${this.screenPos.x}px, ${this.screenPos.y}px) scale(${isHovered || isFocused ? 1.12 : 1})`;
      n.labelName.style.color = n.matched && this.searchQuery ? '#c9b8e8' : isHovered ? '#ffffff' : '';
      // keep the field quiet: track counts only surface on hover/focus
      n.labelSub.style.display = isHovered || isFocused ? '' : 'none';
      n.labelSub.textContent = isFocused
        ? `${n.def.genre.replace('genre_', '').toUpperCase()} • ${n.def.songs.length} TRACKS`
        : isHovered && this.mode !== 'overview'
          ? '⚡ CLICK TO WARP'
          : isHovered
            ? 'CLICK TO ENTER'
            : `${n.def.songs.length} TRACKS`;
    });

    this.planets.forEach((p, id) => {
      p.star.getWorldPosition(this.tmpVec);
      this.tmpVec.y += p.labelBelow ? -7 : 8;
      this.worldToScreen(this.tmpVec, this.screenPos);
      const isSelected = id === this.selectedSongId;
      const isHovered = this.hovered?.type === 'song' && this.hovered.id === id;
      let opacity = 0;
      if (this.screenPos.visible && camDist < 620) {
        if (this.mode === 'song') opacity = isSelected ? 0 : 0.12; // mirror carries its own title
        else opacity = isHovered ? 1 : 0.85;
      }
      p.label.style.opacity = String(opacity);
      const vAlign = p.labelBelow ? '15%' : '-100%';
      p.label.style.transform = `translate(-50%, ${vAlign}) translate(${this.screenPos.x}px, ${this.screenPos.y}px) scale(${isHovered ? 1.15 : 1})`;
      (p.label.firstChild as HTMLDivElement).style.color = isSelected ? '#fbbf24' : isHovered ? '#ffffff' : '';
    });
  }

  /** Mirror screen anchor for the React title card (below the lens, never on it). */
  getMirrorAnchor(): { x: number; y: number } | null {
    if (!this.mirror.isOpen) return null;
    this.tmpVec.copy(this.mirror.group.position);
    this.tmpVec.y -= 31; // lens half-height (18) + margin, in world units
    this.worldToScreen(this.tmpVec, this.screenPos);
    if (!this.screenPos.visible) return null;
    return { x: this.screenPos.x, y: this.screenPos.y + 12 };
  }

  private updateHint() {
    this.callbacks.onModeChange(this.mode);
  }

  private setMode(m: EngineMode) {
    if (this.mode !== m) {
      this.mode = m;
      this.callbacks.onModeChange(m);
    }
  }

  /** rAF normally; setTimeout fallback keeps animations alive in hidden tabs
   *  (background tabs, automated test drivers) where rAF never fires.
   *  GSAP's own ticker is rAF-driven too, so we pump it manually while hidden. */
  private scheduleNext = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.bgTimeoutId = window.setTimeout(() => {
        (gsap.ticker as any).tick?.();
        this.loop();
      }, 33);
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private onVisibility = () => {
    const hidden = document.visibilityState === 'hidden';
    gsap.ticker.lagSmoothing(hidden ? 0 : 500, 33);
  };

  private loop = () => {
    if (this.disposed) return;
    this.scheduleNext();

    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed = this.timer.getElapsed();
    const t = this.elapsed;
    this.updateAudioLevels();

    // camera damping (manual control only when not flying)
    if (!this.flying) {
      // idle drift after 4s of no interaction
      if (performance.now() - this.lastInteraction > 4000 && !this.mirror.isOpen) {
        this.sphTarget.theta += dt * 0.016;
      }
      const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
      this.sph.theta += (this.sphTarget.theta - this.sph.theta) * k;
      this.sph.phi += (this.sphTarget.phi - this.sph.phi) * k;
      this.sph.radius += (this.sphTarget.radius - this.sph.radius) * k;
      this.applySpherical();
    }

    // nebula updates: slow differential spin + audio breathing
    this.nebulas.forEach((n, id) => {
      const mat = n.cloudMat;
      n.spinTime += dt * (0.5 + this.levels.bass * 0.28) * n.spinFactor.v;
      mat.uniforms.uSpinTime.value = n.spinTime;
      n.gasMat.uniforms.uSpinTime.value = n.spinTime;
      n.dustMat.uniforms.uSpinTime.value = n.spinTime;
      n.mistMat.uniforms.uSpinTime.value = n.spinTime;
      const isHovered = this.hovered?.type === 'artist' && this.hovered.id === id;
      n.hoverT += ((isHovered ? 1 : 0) - n.hoverT) * Math.min(1, dt * 7);
      const searchDim = this.searchQuery && !n.matched ? 1 : 0;
      n.dimT += (searchDim - n.dimT) * Math.min(1, dt * 7);
      mat.uniforms.uBrightness.value =
        (0.95 + n.hoverT * 0.4 + (n.matched ? 0.45 : 0)) * (1.0 - n.dimT * 0.65);
      const pulse = 1 + Math.sin(t * 1.1 + n.armPhase) * 0.03 + this.levels.bass * 0.2;
      n.core.scale.setScalar(n.baseCoreScale * pulse * (1 + n.hoverT * 0.18));
      n.coreDim += (n.coreDimTarget - n.coreDim) * Math.min(1, dt * 3.5);
      (n.core.material as THREE.SpriteMaterial).opacity = (0.72 + this.levels.intensity * 0.3) * n.coreDim;

      // per-galaxy paint order sorted by camera distance so dark dust from a
      // far galaxy never occludes a nearer one (all layers are depth-write-off)
      const camDist = this.camera.position.distanceTo(n.group.position);
      // theme veil is a close-range whisper; at overview distance it would
      // stack into the grey shroud the void must never have
      const veilFade = 1 - 0.8 * THREE.MathUtils.smoothstep(camDist, 480, 950);
      (n.veil.material as THREE.SpriteMaterial).opacity = 0.055 * veilFade * n.coreDim;
      const base = -camDist;
      n.mist.renderOrder = base - 0.02;
      n.cloud.renderOrder = base;
      n.core.renderOrder = base + 0.02;
      n.gas.renderOrder = base + 0.04;
      n.dust.renderOrder = base + 0.06;
      n.veil.renderOrder = base + 0.01;
    });

    // starfield time
    const stars = this.scene.getObjectByName('starfield') as THREE.Points | null;
    if (stars) (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = t;

    // song stars ride the rotating disk (CPU mirror of the GPU spin math)
    if (this.songHostId) {
      const host = this.nebulas.get(this.songHostId);
      if (host) {
        this.planets.forEach((p, id) => {
          const theta = p.theta0 + host.spinTime * spinSpeedAt(p.radius);
          const x = Math.cos(theta) * p.radius;
          const z = Math.sin(theta) * p.radius;
          p.star.position.set(x, p.height, z);
          p.hit.position.set(x, p.height, z);

          const isSel = id === this.selectedSongId;
          const isHov = this.hovered?.type === 'song' && this.hovered.id === id;
          const target =
            isSel && this.mirror.isOpen
              ? 0.001 // the star folds into the time lens
              : p.baseScale *
                (isHov ? 1.45 : 1) *
                (1 + Math.sin(t * 2.2 + p.theta0 * 7) * 0.05 + (isSel ? this.levels.bass * 0.5 : 0));
          const s = p.star.scale.x + (target - p.star.scale.x) * Math.min(1, dt * 8);
          p.star.scale.setScalar(s);
        });
      }
    }

    this.mirror.update(t, this.levels, this.camera);
    this.updateHover();
    this.updateLabels();

    this.composer.render();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.bgTimeoutId);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);

    this.destroySongSystem();
    this.nebulas.forEach((n) => {
      n.cloud.geometry.dispose();
      n.cloudMat.dispose();
      (n.core.material as THREE.Material).dispose();
      n.hit.geometry.dispose();
      n.label.remove();
    });
    this.nebulas.clear();
    this.mirror.dispose();
    this.glowTex.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Points || o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry?.dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
