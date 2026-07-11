/**
 * K Sound Galaxy — Visual Prototype v3 "VOLUMETRIC — no particles"
 *
 * The galaxy body is a single raymarched VOLUME (fragment shader): a density
 * field shaped as a continuous banded disk, integrated with emission +
 * dust absorption — the same imaging physics as the reference photograph.
 * No particle grain anywhere in the body. Pinpoint background stars remain
 * (the photo has those too — they are point light sources, not grain).
 *
 * Camera languages unchanged: EDGE in-plane glide ⟷ HERO tilted money shot.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';

gsap.ticker.remove(gsap.updateRoot); // manual drive — env-proof

// ---------------------------------------------------------------- setup
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x000000, 0); // alpha 0 so the volume RT clears transparent
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.5, 20000);

// The volume marches in a LOW-RES offscreen target and is composited
// upscaled — gas is soft, the upscale is invisible, the speedup is ~5x.
const VOL_SCALE = 0.42;
const volScene = new THREE.Scene();
let rtVol = new THREE.WebGLRenderTarget(
  Math.max(2, Math.floor(innerWidth * VOL_SCALE * renderer.getPixelRatio())),
  Math.max(2, Math.floor(innerHeight * VOL_SCALE * renderer.getPixelRatio())),
  { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.9, 0.6, 0.78);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- band profile → texture (R: light bands, G: dust lanes)
const R = 900;
const H = R * 0.12; // volume slab half-height — tight bounds = shorter marches

interface Lane { c: number; w: number; d: number }
const LANES: Lane[] = [];
{
  let c = 0.16;
  while (c < 0.97) {
    LANES.push({ c, w: 0.01 + Math.random() * 0.028, d: 0.45 + Math.random() * 0.45 });
    c += 0.05 + Math.random() * 0.09;
  }
}
const BAND_N = 512;
const bandTex = (() => {
  const data = new Uint8Array(BAND_N * 4);
  for (let i = 0; i < BAND_N; i++) {
    const x = i / (BAND_N - 1);
    let light = 0.8 + 0.2 * Math.sin(x * 19.7 + 1.3) * Math.sin(x * 7.1 + 4.2);
    let dust = 0;
    for (const L of LANES) {
      const g = Math.exp(-((x - L.c) * (x - L.c)) / (2 * L.w * L.w));
      light *= 1 - L.d * 0.72 * g;
      dust += L.d * g;
    }
    data[i * 4] = Math.round(Math.max(0.05, light) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, dust) * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, BAND_N, 1, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
})();

// ---------------------------------------------------------------- textures for core/knots glow
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
const glowTex = glowTexture();

// ---------------------------------------------------------------- THE VOLUME (galaxy body, zero particles)
const volumeMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.BackSide, // camera can sit INSIDE the volume (EDGE view)
  uniforms: {
    uTime: { value: 0 },
    uBand: { value: bandTex },
    uR: { value: R },
    uH: { value: H },
    uSteps: { value: 44 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float uTime; uniform sampler2D uBand;
    uniform float uR; uniform float uH; uniform int uSteps;
    varying vec3 vWorld;

    // ---- hash / 3D value noise / fbm ----
    float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vno3(vec3 p){
      vec3 i = floor(p), f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      float a = h31(i);
      float b = h31(i + vec3(1,0,0));
      float c = h31(i + vec3(0,1,0));
      float d = h31(i + vec3(1,1,0));
      float e = h31(i + vec3(0,0,1));
      float g = h31(i + vec3(1,0,1));
      float m = h31(i + vec3(0,1,1));
      float n = h31(i + vec3(1,1,1));
      return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(m,n,u.x), u.y), u.z);
    }
    float fbm3(vec3 p){
      // two octaves are enough at the composite's soft upscale
      float v = 0.6 * vno3(p);
      v += 0.3 * vno3(p * 2.17);
      return v;
    }

    // ring-following shear: rotate the noise domain by a radius-dependent
    // angle so the marbling streaks ALONG the rings (like the photo), and
    // the whole texture slowly shears over time
    vec3 shear(vec3 p, float r01) {
      float ang = (1.0 - r01) * 6.2 + uTime * 0.012;
      float cs = cos(ang), sn = sin(ang);
      return vec3(p.x * cs - p.z * sn, p.y, p.x * sn + p.z * cs);
    }

    // color ramp — violet/magenta-dominant like the reference; amber stays
    // confined to the inner rings, cream only at the very core
    vec3 ramp(float r01) {
      vec3 core  = vec3(1.00, 0.93, 0.80);
      vec3 amber = vec3(0.96, 0.62, 0.36);
      vec3 rose  = vec3(0.86, 0.38, 0.62);
      vec3 viol  = vec3(0.58, 0.40, 0.92);
      vec3 rim   = vec3(0.40, 0.50, 0.96);
      vec3 c = mix(core, amber, smoothstep(0.02, 0.11, r01));
      c = mix(c, rose, smoothstep(0.11, 0.34, r01));
      c = mix(c, viol, smoothstep(0.34, 0.66, r01));
      c = mix(c, rim, smoothstep(0.66, 1.02, r01));
      return c;
    }

    void main() {
      vec3 ro = cameraPosition;
      vec3 rd = normalize(vWorld - cameraPosition);

      // analytic bounds: slab |y|<=uH ∩ cylinder r<=uR*1.06
      float tEnterY = (-uH - ro.y) / rd.y;
      float tExitY  = ( uH - ro.y) / rd.y;
      if (tEnterY > tExitY) { float s = tEnterY; tEnterY = tExitY; tExitY = s; }
      float Rb = uR * 1.06;
      float aC = rd.x * rd.x + rd.z * rd.z;
      float bC = 2.0 * (ro.x * rd.x + ro.z * rd.z);
      float cC = ro.x * ro.x + ro.z * ro.z - Rb * Rb;
      float disc = bC * bC - 4.0 * aC * cC;
      if (disc < 0.0) discard;
      float sq = sqrt(disc);
      float tC0 = (-bC - sq) / (2.0 * aC);
      float tC1 = (-bC + sq) / (2.0 * aC);
      float t0 = max(max(tEnterY, tC0), 0.0);
      float t1 = min(tExitY, tC1);
      if (t1 <= t0) discard;

      float dt = (t1 - t0) / float(uSteps);
      // blue-noise style jitter kills banding
      float jitter = h31(vec3(gl_FragCoord.xy, uTime)) * dt;

      vec3 col = vec3(0.0);
      vec3 T = vec3(1.0); // per-channel transmittance — dust reddens what it crosses

      for (int i = 0; i < 96; i++) {
        if (i >= uSteps) break;
        float t = t0 + jitter + (float(i) + 0.5) * dt;
        if (t > t1) break;
        vec3 p = ro + rd * t;
        float r01 = length(p.xz) / uR;
        if (r01 > 1.06) continue;

        vec2 band = texture2D(uBand, vec2(clamp(r01, 0.0, 1.0), 0.5)).rg;

        // disk body: gentle radial falloff — the photo glows all the way out
        float radial = exp(-pow(max(r01 - 0.02, 0.0), 1.5) * 1.55);
        float thick = mix(0.045, 0.013, smoothstep(0.0, 0.45, r01)) + 0.03 * exp(-r01 * 7.0);
        float vert = exp(-abs(p.y) / (uR * thick) * 2.1);

        // luminous core yolk — bright but never a white wall
        float coreGlow = exp(-length(vec3(p.x, p.y * 2.8, p.z)) / (uR * 0.16)) * 1.6 * smoothstep(0.55, 0.15, r01);

        // EMPTY-SPACE SKIP: most of the box contributes nothing — bail out
        // before paying for any noise
        float baseline = radial * vert;
        if (baseline < 0.004 && coreGlow < 0.01) continue;

        // ring-streaked marbling
        vec3 ps = shear(p, r01);
        float marble = fbm3(ps * (2.6 / uR) * 3.0 + vec3(0.0, 3.7, 0.0));
        float marble2 = vno3(ps * (2.6 / uR) * 11.0 + vec3(5.2));

        float density = baseline * (0.3 + 1.05 * band.r) * (0.3 + 0.95 * marble);

        // dust: dark absorbing lanes hugging the mid-plane, broken by noise
        float dustVert = exp(-abs(p.y) / (uR * 0.012) * 2.4);
        float dust = band.g * dustVert * smoothstep(0.3, 0.8, marble2) * radial * 2.6;

        // emission + absorption (front-to-back), coefficients per WORLD UNIT.
        // Dust absorbs blue > green > red — crossed lanes turn warm brown,
        // exactly how the photograph gets its rust-colored rings.
        vec3 emit = ramp(r01) * (density * 0.85 + coreGlow);
        col += T * emit * dt * 0.004;
        vec3 absorb = dust * vec3(0.038, 0.055, 0.078) + density * 0.002;
        T *= exp(-absorb * dt);
        if (max(T.r, max(T.g, T.b)) < 0.02) break;
      }

      float alpha = 1.0 - dot(T, vec3(0.333));
      // gentle saturation lift — the reference is unapologetically violet
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, 1.18);
      gl_FragColor = vec4(col, clamp(alpha + luma * 0.2, 0.0, 1.0));
    }
  `,
});
const volume = new THREE.Mesh(new THREE.BoxGeometry(R * 2.12, H * 2, R * 2.12), volumeMat);
volScene.add(volume); // marched offscreen at low res

// composite the upscaled volume over the star field (premultiplied over)
const compositeQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { tVol: { value: rtVol.texture } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tVol; varying vec2 vUv;
      void main() { gl_FragColor = texture2D(tVol, vUv); }
    `,
  })
);
compositeQuad.frustumCulled = false;
compositeQuad.renderOrder = 5;
scene.add(compositeQuad);

// hot center — a small sprite feeds the bloom a clean highlight
function coreSprite(color: string, scale: number, opacity: number, flat = false): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex, color: new THREE.Color(color), transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  s.scale.set(scale, flat ? scale * 0.45 : scale, 1);
  s.renderOrder = 6;
  return s;
}
scene.add(coreSprite('#fff7e8', 120, 0.9));
scene.add(coreSprite('#ffd9a0', 300, 0.35));

// ---------------------------------------------------------------- artist knots (fake data)
const ARTISTS = ['BTS', 'BLACKPINK', 'IU', 'AESPA', 'EXO', 'NEWJEANS', 'TWICE', 'SEVENTEEN'];
function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 140;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 140);
  x.font = '500 46px Georgia, serif';
  (x as any).letterSpacing = '18px';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(240,233,219,0.92)';
  x.fillText(text.toUpperCase(), 512, 62);
  x.fillStyle = 'rgba(240,233,219,0.4)';
  x.fillRect(430, 108, 164, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.92, depthWrite: false }));
  s.scale.set(190, 26, 1);
  s.renderOrder = 9;
  return s;
}
const knotGroup = new THREE.Group();
scene.add(knotGroup);
ARTISTS.forEach((name, i) => {
  const r01 = 0.24 + (i / ARTISTS.length) * 0.62;
  const theta = (i / ARTISTS.length) * Math.PI * 2 + 0.45;
  const r = r01 * R;
  const knot = new THREE.Group();
  knot.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
  knot.add(coreSprite('#fff2dc', 40, 0.8));
  knot.add(coreSprite('#ffdCB0', 92, 0.2));
  const lbl = labelSprite(name);
  lbl.position.y = 40;
  knot.add(lbl);
  (knot as any).__theta = theta; (knot as any).__r = r;
  knotGroup.add(knot);
});

// ---------------------------------------------------------------- pinpoint sky (photo-style stars, not body grain)
{
  const N = 15000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const tints = ['#e8e0d2', '#c8ccd8', '#d8c8c0', '#9fb0dd', '#ddb9a8'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = 6200 + Math.random() * 2600;
    pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = rr * Math.cos(ph);
    pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    const c = tints[(Math.random() * tints.length) | 0];
    const d = 0.22 + Math.random() * 0.75;
    col[i * 3] = c.r * d; col[i * 3 + 1] = c.g * d; col[i * 3 + 2] = c.b * d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true,
    opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = 0;
  scene.add(stars);
  for (let i = 0; i < 5; i++) {
    const s = coreSprite(i % 2 ? '#c9c2b2' : '#aab2c9', 90 + Math.random() * 130, 0.05, true);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = 5200 + Math.random() * 1800;
    s.position.set(rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph), rr * Math.sin(ph) * Math.sin(th));
    (s.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI;
    s.renderOrder = 0;
    scene.add(s);
  }
}

// ---------------------------------------------------------------- camera choreography (unchanged language)
type ViewName = 'EDGE' | 'HERO';
const VIEWS = {
  EDGE: {
    pos: new THREE.Vector3(R * 1.04, R * 0.02, R * 0.1),
    look: new THREE.Vector3(0, R * 0.008, 0),
    up: new THREE.Vector3(0, 1, 0),
    fov: 80,
    label: 'EDGE — 盘中行者',
  },
  HERO: {
    pos: new THREE.Vector3(
      1.85 * R * Math.sin(0.72) * Math.cos(2.35),
      1.85 * R * Math.cos(0.72),
      1.85 * R * Math.sin(0.72) * Math.sin(2.35)
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

// opening: distant edge glide in → hold → hero reveal
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
let volTick = false;
// in-loop FPS probe (injected rAF doesn't fire in this embedded browser)
let fpsN = 0;
let fpsT = performance.now();

function tick() {
  fpsN++;
  const nowMs = performance.now();
  if (nowMs - fpsT >= 1000) {
    (window as any).__fps = Math.round((fpsN * 1000) / (nowMs - fpsT));
    fpsN = 0;
    fpsT = nowMs;
  }
  const t = clock.getElapsedTime();
  gsap.updateRoot(t);
  volumeMat.uniforms.uTime.value = t;

  knotGroup.children.forEach((k) => {
    const th0 = (k as any).__theta as number;
    const r = (k as any).__r as number;
    const th = th0 + t * 0.012;
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

  // march the volume offscreen — every frame in flight, every 2nd at idle
  // (the shear drifts at 0.012 rad/s; a 33ms hold is invisible)
  const cost0 = performance.now();
  volTick = !volTick;
  if (flying || volTick) {
    renderer.setRenderTarget(rtVol);
    renderer.clear();
    renderer.render(volScene, camera);
    renderer.setRenderTarget(null);
  }

  composer.render();
  // exponential moving average of the CPU-side frame cost — a rate-independent
  // performance probe (this embedded browser starves rAF, so fps alone lies)
  const cost = performance.now() - cost0;
  (window as any).__frameMs = ((window as any).__frameMs ?? cost) * 0.9 + cost * 0.1;
}

let lastTick = performance.now();
function frame() {
  lastTick = performance.now();
  requestAnimationFrame(frame);
  tick();
}
frame();
// rAF watchdog: some environments (embedded/background tabs) starve rAF —
// keep the show running on a timer until real frames come back
setInterval(() => {
  if (performance.now() - lastTick > 250) {
    lastTick = performance.now();
    tick();
  }
}, 66);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  rtVol.setSize(
    Math.max(2, Math.floor(innerWidth * VOL_SCALE * renderer.getPixelRatio())),
    Math.max(2, Math.floor(innerHeight * VOL_SCALE * renderer.getPixelRatio()))
  );
});

addEventListener('click', () => { hintEl.style.opacity = '0.15'; }, { once: true });

// prototype-only debug handle
(window as any).__proto = {
  camera,
  gsap,
  volumeMat,
  get flying() { return flying; },
  get current() { return current; },
};
