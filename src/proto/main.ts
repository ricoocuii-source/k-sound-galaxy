/**
 * K Sound Galaxy — Visual Prototype "B+A: The One Galaxy" (v2 — NO ARMS)
 *
 * The references are NOT spiral-arm galaxies: they are CONTINUOUS luminous
 * disks banded by concentric dust rings (Andromeda photos) / a pure particle
 * ring-sea (Interstellar). v2 rebuilds the structure accordingly:
 *   - stars fill the whole disk, density/brightness modulated by ONE shared
 *     concentric band profile (bright swells + dark ring lanes)
 *   - dark dust = ring lanes aligned with the carved gaps
 *   - a continuous luminous plate shader gives the disk its solid body
 * Two camera languages: EDGE (in-plane glide) ⟷ HERO (tilted money shot).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';

// Drive gsap from our own render loop — this embedded browser can freeze
// gsap's internal rAF ticker even while the page renders fine.
gsap.ticker.remove(gsap.updateRoot);

// ---------------------------------------------------------------- setup
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.setClearColor(0x000000);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.5, 20000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.1, 0.55, 0.74);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- textures
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function smokeTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 15; i++) {
    const bx = 70 + Math.random() * 116;
    const by = 70 + Math.random() * 116;
    const br = 28 + Math.random() * 66;
    const g = x.createRadialGradient(bx, by, 0, bx, by, br);
    const a = 0.05 + Math.random() * 0.1;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glowTex = glowTexture();
const smokeTex = smokeTexture();

// ---------------------------------------------------------------- the ONE band profile
// Concentric structure shared by stars, dust rings and the luminous plate —
// this coherence is what makes the disk read as one physical body.
const R = 900;
const gauss = () => Math.random() + Math.random() + Math.random() - 1.5;

interface Lane { c: number; w: number; d: number } // center (0..1), width, depth
const LANES: Lane[] = [];
{
  let c = 0.2;
  while (c < 0.97) {
    LANES.push({ c, w: 0.008 + Math.random() * 0.026, d: 0.4 + Math.random() * 0.45 });
    c += 0.05 + Math.random() * 0.1;
  }
}
const BAND_N = 512;
const bandProfile = new Float32Array(BAND_N);
for (let i = 0; i < BAND_N; i++) {
  const x = i / (BAND_N - 1);
  // gentle broad swells so the disk isn't uniformly bright
  let v = 0.82 + 0.18 * Math.sin(x * 19.7 + 1.3) * Math.sin(x * 7.1 + 4.2);
  // carve the dark ring lanes
  for (const L of LANES) {
    const g = Math.exp(-((x - L.c) * (x - L.c)) / (2 * L.w * L.w));
    v *= 1 - L.d * g;
  }
  bandProfile[i] = Math.max(0.06, v);
}
const bandAt = (x: number) =>
  bandProfile[Math.min(BAND_N - 1, Math.max(0, Math.floor(x * BAND_N)))];

// band profile → texture for the plate shader
const bandTex = (() => {
  const data = new Uint8Array(BAND_N * 4);
  for (let i = 0; i < BAND_N; i++) {
    const v = Math.round(bandProfile[i] * 255);
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, BAND_N, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

// color story — amber core → dusty rose → violet → cool blue rim
const C_CORE = new THREE.Color('#ffdfae');
const C_MID = new THREE.Color('#d99e94');
const C_ROSE = new THREE.Color('#c489b4');
const C_RIM = new THREE.Color('#8fa0dc');
const C_HOT = new THREE.Color('#dfe9ff');
function rampColor(out: THREE.Color, r01: number) {
  if (r01 < 0.22) out.copy(C_CORE).lerp(C_MID, r01 / 0.22);
  else if (r01 < 0.55) out.copy(C_MID).lerp(C_ROSE, (r01 - 0.22) / 0.33);
  else out.copy(C_ROSE).lerp(C_RIM, (r01 - 0.55) / 0.45);
}

const galaxy = new THREE.Group();
scene.add(galaxy);

// ---------------------------------------------------------------- 420k stars — continuous banded disk
const STAR_COUNT = 420_000;
{
  const pR = new Float32Array(STAR_COUNT);
  const pT = new Float32Array(STAR_COUNT);
  const pH = new Float32Array(STAR_COUNT);
  const pS = new Float32Array(STAR_COUNT);
  const pTw = new Float32Array(STAR_COUNT);
  const pC = new Float32Array(STAR_COUNT * 3);
  const tmp = new THREE.Color();

  for (let i = 0; i < STAR_COUNT; i++) {
    const pop = Math.random();
    let r01: number, h: number, size: number;

    if (pop < 0.13) {
      // blazing bulge
      r01 = Math.abs(gauss()) * 0.09;
      h = gauss() * R * 0.045 * (1 - r01 * 4);
      size = 0.8 + Math.random() * 1.7;
      tmp.copy(C_CORE).lerp(C_MID, Math.random() * 0.3).multiplyScalar(0.9 + Math.random() * 0.5);
    } else if (pop < 0.92) {
      // continuous disk — density via radial power + band rejection sampling
      do {
        r01 = 0.06 + 0.94 * Math.pow(Math.random(), 0.58);
      } while (Math.random() > 0.25 + 0.75 * bandAt(r01));
      h = gauss() * R * 0.011 * (0.55 + 1.8 * Math.exp(-r01 * 3.2));
      size = 0.5 + Math.random() * 1.4;
      rampColor(tmp, r01);
      tmp.offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.1);
      tmp.multiplyScalar((0.4 + Math.random() * 0.55) * (0.45 + 0.75 * bandAt(r01)));
      if (Math.random() < 0.01) {
        tmp.copy(C_HOT).multiplyScalar(1.5 + Math.random() * 1.2);
        size = 1.8 + Math.random() * 1.6;
      }
    } else {
      // sparse thick-disk halo
      r01 = 0.15 + 1.05 * Math.pow(Math.random(), 0.6);
      h = gauss() * R * 0.055;
      size = 0.35 + Math.random() * 0.6;
      tmp.copy(C_RIM).lerp(C_MID, Math.random() * 0.4).multiplyScalar(0.16 + Math.random() * 0.2);
    }

    pR[i] = r01 * R;
    pT[i] = Math.random() * Math.PI * 2;
    pH[i] = h;
    pS[i] = size;
    pTw[i] = Math.random() * Math.PI * 2;
    pC[i * 3] = tmp.r; pC[i * 3 + 1] = tmp.g; pC[i * 3 + 2] = tmp.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STAR_COUNT * 3), 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(pR, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(pT, 1));
  geo.setAttribute('aH', new THREE.BufferAttribute(pH, 1));
  geo.setAttribute('aS', new THREE.BufferAttribute(pS, 1));
  geo.setAttribute('aTw', new THREE.BufferAttribute(pTw, 1));
  geo.setAttribute('aC', new THREE.BufferAttribute(pC, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 2.4);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float aR; attribute float aT; attribute float aH;
      attribute float aS; attribute float aTw; attribute vec3 aC;
      uniform float uTime; uniform float uPx;
      varying vec3 vC; varying float vTw;
      void main() {
        // slow differential rotation — inner rings lead, like a real disk
        float w = 0.016 + 0.045 / (sqrt(aR * 0.02) + 1.0);
        float th = aT + uTime * w;
        vec3 pos = vec3(cos(th) * aR, aH, sin(th) * aR);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float att = 340.0 / max(1.0, -mv.z);
        gl_PointSize = clamp(aS * att * uPx, 0.5, 22.0);
        float depthDim = clamp(1.35 - (-mv.z) / 4200.0, 0.42, 1.0);
        vC = aC * depthDim;
        vTw = aTw;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vTw;
      uniform float uTime;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d2 = dot(c, c);
        float a = exp(-d2 * 9.0) - 0.014;
        if (a <= 0.0) discard;
        float tw = 0.88 + 0.12 * sin(uTime * 0.9 + vTw * 7.0);
        gl_FragColor = vec4(vC * tw, a);
      }
    `,
  });
  galaxy.add(new THREE.Points(geo, mat));
  (galaxy as any).__starMat = mat;
}

// ---------------------------------------------------------------- luminous plate — the disk's solid body
const plate = (() => {
  const geo = new THREE.CircleGeometry(R * 1.04, 128);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBand: { value: bandTex },
      uCore: { value: C_CORE },
      uMid: { value: C_MID },
      uRose: { value: C_ROSE },
      uRim: { value: C_RIM },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vFacing;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
        vFacing = abs(normalize(mv.xyz).z * n.z + dot(normalize(-mv.xyz), n));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uBand;
      uniform float uTime;
      uniform vec3 uCore; uniform vec3 uMid; uniform vec3 uRose; uniform vec3 uRim;
      varying vec2 vUv; varying float vFacing;
      float h21(vec2 p){ p = fract(p*vec2(234.34,435.345)); p += dot(p,p+34.23); return fract(p.x*p.y); }
      float vno(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float v=0., a=.55; for(int k=0;k<3;k++){ v+=a*vno(p); p*=2.13; a*=.5; } return v; }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float band = texture2D(uBand, vec2(r, 0.5)).r;
        // slow shear rotation of the marbling — the disk breathes
        float ang = atan(p.y, p.x);
        float marble = fbm(vec2(ang * 2.2 + uTime * 0.01, r * 9.0));
        float body = smoothstep(1.0, 0.86, r) * (0.22 + 0.78 * band) * (0.55 + 0.6 * marble);
        // blazing inner glow — the yolk of the reference photos
        float core = exp(-r * 5.2) * 1.7 + exp(-r * 15.0) * 2.4;
        vec3 col = mix(uCore, uMid, smoothstep(0.05, 0.3, r));
        col = mix(col, uRose, smoothstep(0.3, 0.62, r));
        col = mix(col, uRim, smoothstep(0.62, 1.0, r));
        float alpha = (body * 0.34 + core * 0.5) * clamp(vFacing, 0.06, 1.0);
        gl_FragColor = vec4(col * (0.55 + 0.9 * band + core * 0.35), alpha);
      }
    `,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 0;
  galaxy.add(m);
  return mat;
})();

// ---------------------------------------------------------------- dust ring lanes (dark) + gas sheen
function ringDust(): THREE.Points {
  const COUNT = 3000;
  const pR = new Float32Array(COUNT);
  const pT = new Float32Array(COUNT);
  const pH = new Float32Array(COUNT);
  const pS = new Float32Array(COUNT);
  const pRot = new Float32Array(COUNT);
  const pA = new Float32Array(COUNT);
  const pC = new Float32Array(COUNT * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const L = LANES[(Math.random() * LANES.length) | 0];
    const r01 = THREE.MathUtils.clamp(L.c + gauss() * L.w * 1.1, 0.05, 1);
    pR[i] = r01 * R;
    pT[i] = Math.random() * Math.PI * 2;
    pH[i] = gauss() * R * 0.006;
    pS[i] = 26 + Math.random() * 55;
    pRot[i] = Math.random() * Math.PI * 2;
    pA[i] = (0.2 + Math.random() * 0.25) * L.d;
    tmp.set('#171015').lerp(new THREE.Color('#2b1a20'), Math.random());
    pC[i * 3] = tmp.r; pC[i * 3 + 1] = tmp.g; pC[i * 3 + 2] = tmp.b;
  }
  return smokePoints(COUNT, pR, pT, pH, pS, pRot, pA, pC, THREE.NormalBlending);
}
function gasSheen(): THREE.Points {
  const COUNT = 2400;
  const pR = new Float32Array(COUNT);
  const pT = new Float32Array(COUNT);
  const pH = new Float32Array(COUNT);
  const pS = new Float32Array(COUNT);
  const pRot = new Float32Array(COUNT);
  const pA = new Float32Array(COUNT);
  const pC = new Float32Array(COUNT * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    let r01: number;
    do {
      r01 = 0.05 + 0.95 * Math.pow(Math.random(), 0.6);
    } while (Math.random() > 0.3 + 0.7 * bandAt(r01));
    pR[i] = r01 * R;
    pT[i] = Math.random() * Math.PI * 2;
    pH[i] = gauss() * R * 0.008;
    pS[i] = 45 + Math.random() * 110;
    pRot[i] = Math.random() * Math.PI * 2;
    pA[i] = 0.04 + Math.random() * 0.06;
    rampColor(tmp, r01);
    tmp.multiplyScalar(0.5);
    pC[i * 3] = tmp.r; pC[i * 3 + 1] = tmp.g; pC[i * 3 + 2] = tmp.b;
  }
  return smokePoints(COUNT, pR, pT, pH, pS, pRot, pA, pC, THREE.AdditiveBlending);
}
function smokePoints(
  COUNT: number, pR: Float32Array, pT: Float32Array, pH: Float32Array, pS: Float32Array,
  pRot: Float32Array, pA: Float32Array, pC: Float32Array, blending: THREE.Blending
): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(pR, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(pT, 1));
  geo.setAttribute('aH', new THREE.BufferAttribute(pH, 1));
  geo.setAttribute('aS', new THREE.BufferAttribute(pS, 1));
  geo.setAttribute('aRot', new THREE.BufferAttribute(pRot, 1));
  geo.setAttribute('aA', new THREE.BufferAttribute(pA, 1));
  geo.setAttribute('aC', new THREE.BufferAttribute(pC, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 2.2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: Math.min(devicePixelRatio, 2) },
      uMap: { value: smokeTex },
    },
    vertexShader: /* glsl */ `
      attribute float aR; attribute float aT; attribute float aH; attribute float aS;
      attribute float aRot; attribute float aA; attribute vec3 aC;
      uniform float uTime; uniform float uPx;
      varying vec3 vC; varying float vA; varying float vRot;
      void main() {
        float w = 0.016 + 0.045 / (sqrt(aR * 0.02) + 1.0);
        float th = aT + uTime * w;
        vec3 pos = vec3(cos(th) * aR, aH, sin(th) * aR);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float att = 340.0 / max(1.0, -mv.z);
        gl_PointSize = clamp(aS * att * uPx, 2.0, 460.0);
        float depthDim = clamp(1.35 - (-mv.z) / 4200.0, 0.45, 1.0);
        vC = aC * depthDim;
        vA = aA;
        vRot = aRot + uTime * 0.015;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      varying vec3 vC; varying float vA; varying float vRot;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float cs = cos(vRot), sn = sin(vRot);
        vec2 uv = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + 0.5;
        float a = texture2D(uMap, uv).a * vA;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vC, a);
      }
    `,
  });
  return new THREE.Points(geo, mat);
}
const gasLayer = gasSheen();
const dustLayer = ringDust();
gasLayer.renderOrder = 1;
dustLayer.renderOrder = 2;
galaxy.add(gasLayer, dustLayer);

// ---------------------------------------------------------------- blazing core
function coreSprite(color: string, scale: number, opacity: number, flat = false): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  s.scale.set(scale, flat ? scale * 0.42 : scale, 1);
  s.renderOrder = 3;
  return s;
}
galaxy.add(coreSprite('#fff6e6', 95, 0.95));
galaxy.add(coreSprite('#ffd9a0', 260, 0.5));
galaxy.add(coreSprite('#e8b37a', 640, 0.16, true));
galaxy.add(coreSprite('#b98a8f', 1150, 0.05, true));

// ---------------------------------------------------------------- artist cluster knots (fake data)
const ARTISTS = ['BTS', 'BLACKPINK', 'IU', 'AESPA', 'EXO', 'NEWJEANS', 'TWICE', 'SEVENTEEN'];
function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 140;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 140);
  x.font = '500 46px Georgia, serif';
  (x as any).letterSpacing = '18px';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(238,231,215,0.92)';
  x.fillText(text.toUpperCase(), 512, 62);
  x.fillStyle = 'rgba(238,231,215,0.42)';
  x.fillRect(430, 108, 164, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false }));
  s.scale.set(190, 26, 1);
  s.renderOrder = 8;
  return s;
}
// knots sit in the BRIGHT swells between dust lanes
const brightRadii: number[] = [];
for (let x = 0.18; x < 0.95; x += 0.004) {
  if (bandAt(x) > 0.75) brightRadii.push(x);
}
const knotGroup = new THREE.Group();
galaxy.add(knotGroup);
ARTISTS.forEach((name, i) => {
  const r01 = brightRadii.length
    ? brightRadii[Math.floor((i / ARTISTS.length) * brightRadii.length)]
    : 0.25 + (i / ARTISTS.length) * 0.6;
  const theta = (i / ARTISTS.length) * Math.PI * 2 + Math.random() * 0.5;
  const r = r01 * R;
  const knot = new THREE.Group();
  knot.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  knot.add(coreSprite('#fff2dc', 34 + Math.random() * 18, 0.75));
  knot.add(coreSprite('#ffe0b4', 80 + Math.random() * 26, 0.22));
  const lbl = labelSprite(name);
  lbl.position.y = 34;
  knot.add(lbl);
  (knot as any).__theta = theta; (knot as any).__r = r;
  knotGroup.add(knot);
});

// ---------------------------------------------------------------- deep background
{
  const N = 14000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const tints = ['#e8e0d2', '#c8ccd8', '#d8c8c0', '#aab4cc'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = 6200 + Math.random() * 2600;
    pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = rr * Math.cos(ph);
    pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    const c = tints[(Math.random() * 4) | 0];
    const d = 0.25 + Math.random() * 0.6;
    col[i * 3] = c.r * d; col[i * 3 + 1] = c.g * d; col[i * 3 + 2] = c.b * d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.4, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(geo, mat));
  for (let i = 0; i < 5; i++) {
    const s = coreSprite(i % 2 ? '#c9c2b2' : '#aab2c9', 90 + Math.random() * 130, 0.05, true);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = 5200 + Math.random() * 1800;
    s.position.set(rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th));
    (s.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI;
    scene.add(s);
  }
}

// ---------------------------------------------------------------- camera choreography
type ViewName = 'EDGE' | 'HERO';
const VIEWS = {
  EDGE: {
    pos: new THREE.Vector3(R * 1.04, R * 0.016, R * 0.1),
    look: new THREE.Vector3(0, R * 0.006, 0),
    up: new THREE.Vector3(0, 1, 0),
    fov: 80,
    label: 'EDGE — 盘中行者',
  },
  HERO: {
    pos: new THREE.Vector3(
      2.35 * R * Math.sin(0.72) * Math.cos(2.35),
      2.35 * R * Math.cos(0.72),
      2.35 * R * Math.sin(0.72) * Math.sin(2.35)
    ),
    look: new THREE.Vector3(0, 0, 0),
    up: new THREE.Vector3(0.26, 1, 0).normalize(),
    fov: 42,
    label: 'HERO — 安德洛墨达构图',
  },
};
let current: ViewName = 'EDGE';
let flying = false;
const lookNow = VIEWS.EDGE.look.clone();
camera.position.copy(VIEWS.EDGE.pos).multiplyScalar(1.5);
camera.up.copy(VIEWS.EDGE.up);
camera.fov = VIEWS.EDGE.fov;
camera.updateProjectionMatrix();

const modeEl = document.getElementById('mode')!;
const hintEl = document.getElementById('hint')!;

function flyTo(view: ViewName, duration: number, onDone?: () => void) {
  if (flying) return;
  flying = true;
  const target = VIEWS[view];
  modeEl.textContent = target.label;
  const p0 = camera.position.clone();
  const p2 = target.pos.clone();
  const p1 = p0.clone().add(p2).multiplyScalar(0.5);
  p1.y += view === 'HERO' ? R * 0.9 : R * 0.55;
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const look0 = lookNow.clone();
  const up0 = camera.up.clone();
  const state = { t: 0, fov: camera.fov };
  gsap.to(state, {
    t: 1,
    fov: target.fov,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      curve.getPoint(state.t, camera.position);
      lookNow.lerpVectors(look0, target.look, state.t);
      camera.up.lerpVectors(up0, target.up, state.t).normalize();
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    },
    onComplete: () => {
      flying = false;
      current = view;
      onDone?.();
    },
  });
}

// opening: distant edge glide in → hold → sweep up to the hero reveal
{
  flying = true;
  const from = camera.position.clone();
  const to = VIEWS.EDGE.pos.clone();
  const st = { t: 0 };
  gsap.to(st, {
    t: 1, duration: 4.2, ease: 'power1.inOut', delay: 0.3,
    onUpdate: () => camera.position.lerpVectors(from, to, st.t),
    onComplete: () => {
      flying = false;
      setTimeout(() => flyTo('HERO', 3.6), 1200);
    },
  });
}

addEventListener('click', () => flyTo(current === 'EDGE' ? 'HERO' : 'EDGE', 3.0));

const par = { x: 0, y: 0 };
addEventListener('pointermove', (e) => {
  par.x = (e.clientX / innerWidth - 0.5) * 2;
  par.y = (e.clientY / innerHeight - 0.5) * 2;
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const parNow = { x: 0, y: 0 };
const camOffset = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const t = clock.getElapsedTime();
  gsap.updateRoot(t);
  ((galaxy as any).__starMat as THREE.ShaderMaterial).uniforms.uTime.value = t;
  (gasLayer.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  (dustLayer.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  plate.uniforms.uTime.value = t;

  knotGroup.children.forEach((k) => {
    const th0 = (k as any).__theta as number;
    const r = (k as any).__r as number;
    const w = 0.016 + 0.045 / (Math.sqrt(r * 0.02) + 1);
    const th = th0 + t * w;
    k.position.set(Math.cos(th) * r, 0, Math.sin(th) * r);
  });

  parNow.x += (par.x - parNow.x) * 0.04;
  parNow.y += (par.y - parNow.y) * 0.04;
  camOffset.set(parNow.x * 14, -parNow.y * 9, parNow.x * 6);
  if (!flying) {
    const v = VIEWS[current];
    camera.position.copy(v.pos).add(camOffset);
    if (current === 'HERO') {
      const drift = t * 0.011;
      camera.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(drift) * 0.05);
    }
  }
  camera.lookAt(lookNow);
  composer.render();
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

addEventListener('click', () => { hintEl.style.opacity = '0.15'; }, { once: true });

// prototype-only debug handle
(window as any).__proto = {
  camera,
  gsap,
  get flying() { return flying; },
  get current() { return current; },
};
