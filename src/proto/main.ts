/**
 * K Sound Galaxy — Visual Prototype "B+A: The One Galaxy"
 *
 * ONE colossal Andromeda-class galaxy (420k GPU stars + dark dust lanes +
 * glowing gas + blazing amber core), with two camera languages:
 *   EDGE — Interstellar-style in-plane glide, grains streaming past
 *   HERO — tilted 3/4 photographic money shot
 * Click anywhere to travel between them. Fully self-contained; the real app
 * is untouched.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';

// Drive gsap from our own render loop (manual mode). In this embedded-browser
// environment gsap's internal rAF ticker can stay frozen even while the page
// renders — updateRoot() from frame() makes every tween follow OUR clock.
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
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.15, 0.55, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- canvas textures
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
function smokeTexture(seedBlobs = 15): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < seedBlobs; i++) {
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

// ---------------------------------------------------------------- galaxy params
const R = 900;                 // disk radius
const TURNS = 7.4;             // total arm winding (radians)
const STAR_COUNT = 420_000;
const gauss = () => Math.random() + Math.random() + Math.random() - 1.5;

// color story (ref: Andromeda photos) — amber core → dusty rose → violet-blue rim
const C_CORE = new THREE.Color('#ffdfae');
const C_MID = new THREE.Color('#d99e94');
const C_ROSE = new THREE.Color('#c489b4');
const C_RIM = new THREE.Color('#8fa0dc');
const C_HOT = new THREE.Color('#dfe9ff'); // scattered young blue-white giants

const galaxy = new THREE.Group();
scene.add(galaxy);

// ---------------------------------------------------------------- 420k stars
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
    let t: number, r: number, theta: number, h: number, size: number;

    if (pop < 0.14) {
      // amber bulge
      t = 0;
      r = Math.abs(gauss()) * R * 0.13;
      theta = Math.random() * Math.PI * 2;
      h = gauss() * R * 0.05 * (1 - r / (R * 0.2));
      size = 0.8 + Math.random() * 1.7;
      tmp.copy(C_CORE).lerp(C_MID, Math.random() * 0.3);
      tmp.multiplyScalar(0.85 + Math.random() * 0.5);
    } else if (pop < 0.9) {
      // spiral arms + feathered spurs
      t = Math.pow(Math.random(), 0.72);
      r = R * (0.05 + 0.95 * Math.pow(t, 1.38));
      const arm = i % 2;
      const spread = (0.08 + 0.3 * t) * (1 + Math.abs(gauss()) * 0.35);
      theta = arm * Math.PI + t * TURNS + gauss() * spread;
      if (Math.random() < 0.13) theta += (Math.random() < 0.5 ? 1 : -1) * (0.22 + Math.random() * 0.3); // spurs
      h = gauss() * R * 0.016 * (0.5 + 1.6 * Math.exp(-t * 2.6));
      size = 0.55 + Math.random() * 1.5;
      // radial color ramp with jitter
      if (t < 0.3) tmp.copy(C_CORE).lerp(C_MID, t / 0.3);
      else if (t < 0.62) tmp.copy(C_MID).lerp(C_ROSE, (t - 0.3) / 0.32);
      else tmp.copy(C_ROSE).lerp(C_RIM, (t - 0.62) / 0.38);
      tmp.offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.1);
      const lum = 0.5 + Math.random() * 0.6;
      tmp.multiplyScalar(lum);
      // rare hot giants — bloom picks them into star-spikes
      if (Math.random() < 0.012) {
        tmp.copy(C_HOT).multiplyScalar(1.6 + Math.random() * 1.3);
        size = 1.9 + Math.random() * 1.8;
      }
    } else {
      // sparse thick-disk halo field — quiet, never competing with the disk
      t = Math.random();
      r = R * (0.15 + 1.1 * Math.pow(Math.random(), 0.6));
      theta = Math.random() * Math.PI * 2;
      h = gauss() * R * 0.06;
      size = 0.35 + Math.random() * 0.6;
      tmp.copy(C_RIM).lerp(C_MID, Math.random() * 0.4).multiplyScalar(0.18 + Math.random() * 0.22);
    }

    pR[i] = r;
    pT[i] = theta;
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
        // density-wave rotation: mostly rigid, tiny shear
        float w = 0.028 + 0.05 / (sqrt(aR * 0.02) + 1.0);
        float th = aT + uTime * w;
        vec3 pos = vec3(cos(th) * aR, aH, sin(th) * aR);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float att = 340.0 / max(1.0, -mv.z);
        gl_PointSize = clamp(aS * att * uPx, 0.5, 22.0);
        // aerial perspective: far grains dim — sells depth on the far rim
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

// ---------------------------------------------------------------- smoke layers (points with texture)
function makeSmokeLayer(count: number, opts: { dark: boolean }): THREE.Points {
  const pR = new Float32Array(count);
  const pT = new Float32Array(count);
  const pH = new Float32Array(count);
  const pS = new Float32Array(count);
  const pRot = new Float32Array(count);
  const pA = new Float32Array(count);
  const pC = new Float32Array(count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = opts.dark ? 0.12 + 0.82 * Math.sqrt(Math.random()) : Math.pow(Math.random(), 0.8);
    const r = R * (0.06 + 0.94 * Math.pow(t, 1.38));
    const arm = i % 2;
    const spread = opts.dark ? 0.06 + 0.1 * t : 0.12 + 0.24 * t;
    pR[i] = r;
    pT[i] = arm * Math.PI + t * TURNS + gauss() * spread + (opts.dark ? -0.1 : 0.02);
    pH[i] = gauss() * R * 0.012 * (0.6 + t);
    pS[i] = opts.dark ? 40 + Math.random() * 85 : 55 + Math.random() * 120;
    pRot[i] = Math.random() * Math.PI * 2;
    if (opts.dark) {
      tmp.set('#1a120e').lerp(new THREE.Color('#2b1a22'), Math.random());
      pA[i] = 0.32 + Math.random() * 0.3;
    } else {
      if (t < 0.35) tmp.copy(C_CORE).lerp(C_MID, t / 0.35);
      else tmp.copy(C_ROSE).lerp(C_RIM, (t - 0.35) / 0.65);
      tmp.multiplyScalar(0.5);
      pA[i] = 0.05 + Math.random() * 0.08;
    }
    pC[i * 3] = tmp.r; pC[i * 3 + 1] = tmp.g; pC[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
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
    blending: opts.dark ? THREE.NormalBlending : THREE.AdditiveBlending,
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
        float w = 0.028 + 0.05 / (sqrt(aR * 0.02) + 1.0);
        float th = aT + uTime * w;
        vec3 pos = vec3(cos(th) * aR, aH, sin(th) * aR);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float att = 340.0 / max(1.0, -mv.z);
        gl_PointSize = clamp(aS * att * uPx, 2.0, 460.0);
        float depthDim = clamp(1.35 - (-mv.z) / 4200.0, 0.45, 1.0);
        vC = aC * depthDim;
        vA = aA;
        vRot = aRot + uTime * 0.02;
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
const gasLayer = makeSmokeLayer(2600, { dark: false });
const dustLayer = makeSmokeLayer(2400, { dark: true });
dustLayer.renderOrder = 2;
gasLayer.renderOrder = 1;
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

// ---------------------------------------------------------------- artist cluster knots (fake data for the prototype)
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
  s.scale.set(150, 20.5, 1);
  s.renderOrder = 8;
  return s;
}
const knotGroup = new THREE.Group();
galaxy.add(knotGroup);
ARTISTS.forEach((name, i) => {
  const t = 0.2 + (i / ARTISTS.length) * 0.72;
  const arm = i % 2;
  const theta = arm * Math.PI + t * TURNS + (Math.random() - 0.5) * 0.12;
  const r = R * (0.05 + 0.95 * Math.pow(t, 1.38));
  const knot = new THREE.Group();
  knot.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  const g1 = coreSprite('#fff2dc', 34 + Math.random() * 18, 0.75);
  const g2 = coreSprite('#ffe0b4', 80 + Math.random() * 26, 0.22);
  knot.add(g1, g2);
  const lbl = labelSprite(name);
  lbl.position.y = 30;
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
  // ghost neighbor galaxies
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
    // 49° elevation, pulled back — the full tilted oval with visible arms
    pos: new THREE.Vector3(
      2.35 * R * Math.sin(0.72) * Math.cos(2.35),
      2.35 * R * Math.cos(0.72),
      2.35 * R * Math.sin(0.72) * Math.sin(2.35)
    ),
    look: new THREE.Vector3(0, 0, 0),
    up: new THREE.Vector3(0.26, 1, 0).normalize(), // banked horizon → Andromeda diagonal
    fov: 42,
    label: 'HERO — 安德洛墨达构图',
  },
};
let current: ViewName = 'EDGE';
let flying = false;
const lookNow = VIEWS.EDGE.look.clone();
camera.position.copy(VIEWS.EDGE.pos).multiplyScalar(1.5); // intro starts further out
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
  // arc control point: lift above the disk for edge↔hero grandeur
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

// opening: distant edge glide in → hold → sweep up to the hero reveal.
// flying=true keeps the idle loop's position pinning out of the way.
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

// subtle mouse parallax
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

  // knots ride the density wave so labels stay glued to their clusters
  knotGroup.children.forEach((k) => {
    const th0 = (k as any).__theta as number;
    const r = (k as any).__r as number;
    const w = 0.028 + 0.05 / (Math.sqrt(r * 0.02) + 1);
    const th = th0 + t * w;
    k.position.set(Math.cos(th) * r, 0, Math.sin(th) * r);
  });

  // parallax breathes around the current view
  parNow.x += (par.x - parNow.x) * 0.04;
  parNow.y += (par.y - parNow.y) * 0.04;
  camOffset.set(parNow.x * 14, -parNow.y * 9, parNow.x * 6);
  if (!flying) {
    const v = VIEWS[current];
    camera.position.copy(v.pos).add(camOffset);
    if (current === 'HERO') {
      // majestic idle drift
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

// fade the hint after first interaction
addEventListener('click', () => { hintEl.style.opacity = '0.15'; }, { once: true });

// prototype-only debug handle
(window as any).__proto = {
  camera,
  gsap,
  get flying() { return flying; },
  get current() { return current; },
};
