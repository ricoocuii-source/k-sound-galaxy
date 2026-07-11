/**
 * K Sound Galaxy — Visual Prototype v4 "NEBULA UNIVERSE"
 *
 * Hierarchy: the universe holds MANY volumetric artist nebulas (real data);
 * songs float INSIDE each nebula. Every nebula shares one shader language but
 * differs in silhouette, color family, size, spin axis — irregular, fully 3D
 * clouds (never flat disks). Everything drifts and rotates. Camera moves are
 * absolutely three-dimensional (banked bezier arcs across a 3D shell layout).
 * Clicking a song reuses the REAL TimeMirror (dust body → blown-away reveal).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import { TimeMirror } from '../engine/TimeMirror';
import { MUSIC_NODES } from '../data';
import type { MusicNode } from '../types';

gsap.ticker.remove(gsap.updateRoot); // manual drive — env-proof

// ---------------------------------------------------------------- setup
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.5, 40000);

// volumes march in a low-res offscreen target, composited upscaled
const VOL_SCALE = 0.42;
const volScene = new THREE.Scene();
const rtVol = new THREE.WebGLRenderTarget(
  Math.max(2, Math.floor(innerWidth * VOL_SCALE * renderer.getPixelRatio())),
  Math.max(2, Math.floor(innerHeight * VOL_SCALE * renderer.getPixelRatio())),
  { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.78);
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
const glowTex = glowTexture();

/** placeholder cover (no iTunes in the prototype) — lets the mirror's
 *  dust-blow reveal play with something worth revealing */
function makeCover(song: string, artist: string, a: string, b: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 512);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fillRect(0, 0, 512, 512);
  x.textAlign = 'center';
  x.fillStyle = 'rgba(245,238,224,0.94)';
  x.font = '500 210px Georgia, serif';
  x.fillText(song.slice(0, 1).toUpperCase(), 256, 300);
  x.font = '500 30px Georgia, serif';
  (x as any).letterSpacing = '8px';
  x.fillText(song.toUpperCase().slice(0, 18), 256, 400);
  x.fillStyle = 'rgba(245,238,224,0.5)';
  x.font = '400 20px Georgia, serif';
  x.fillText(artist.toUpperCase(), 256, 444);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function labelSprite(text: string, px: number, alpha = 0.92): THREE.Sprite {
  const c = document.createElement('canvas');
  const W = 1024;
  const H = 168;
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, W, H);
  x.font = `500 ${px}px Georgia, serif`;
  (x as any).letterSpacing = `${Math.round(px * 0.34)}px`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  // soft shadow for readability over bright gas
  x.shadowColor = 'rgba(0,0,0,0.85)';
  x.shadowBlur = 14;
  x.fillStyle = `rgba(240,233,219,${alpha})`;
  x.fillText(text.toUpperCase(), W / 2, H / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(W / 6, H / 6, 1);
  return s;
}

// ---------------------------------------------------------------- color families (one language, different pigments)
const FAMILIES = [
  { hot: '#ffe9c9', mid: '#c77bd8', rim: '#5d55c9' }, // violet
  { hot: '#ffe4c2', mid: '#e0708f', rim: '#8a3a68' }, // rose
  { hot: '#e9fff4', mid: '#5fc4b8', rim: '#2b5f8a' }, // teal
  { hot: '#fff3d2', mid: '#e0a95f', rim: '#8a5230' }, // gold
  { hot: '#e4efff', mid: '#6f8fd8', rim: '#3a4a9a' }, // blue
  { hot: '#ffe9f2', mid: '#c789b9', rim: '#6a4a8a' }, // mauve
  { hot: '#ffeedd', mid: '#d8895f', rim: '#7a3a3a' }, // copper
  { hot: '#f2ffe4', mid: '#9fc47f', rim: '#4a6a4a' }, // sage
];

// ---------------------------------------------------------------- volumetric nebula shader (LOCAL-space march)
const VOL_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const VOL_FRAG = /* glsl */ `
  precision highp float;
  uniform mat4 uInvModel;
  uniform float uTime; uniform float uR; uniform vec3 uAxes;
  uniform float uSeed; uniform int uSteps;
  uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uRim;
  uniform vec3 uCoreOff;
  varying vec3 vWorld;

  float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vno3(vec3 p){
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = h31(i), b = h31(i + vec3(1,0,0)), c = h31(i + vec3(0,1,0)), d = h31(i + vec3(1,1,0));
    float e = h31(i + vec3(0,0,1)), g = h31(i + vec3(1,0,1)), m = h31(i + vec3(0,1,1)), n = h31(i + vec3(1,1,1));
    return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(m,n,u.x), u.y), u.z);
  }
  float fbm3(vec3 p){ return 0.6 * vno3(p) + 0.3 * vno3(p * 2.17); }

  // internal swirl: rotate around the local Y by radius (inner leads) — the
  // cloud's guts slowly churn even when the camera is still
  vec3 swirl(vec3 p, float r01) {
    float ang = (1.0 - r01) * 2.6 + uTime * 0.02;
    float cs = cos(ang), sn = sin(ang);
    return vec3(p.x * cs - p.z * sn, p.y, p.x * sn + p.z * cs);
  }

  void main() {
    // ray in LOCAL space (nebula tumbles freely; the march follows it)
    vec3 ro = (uInvModel * vec4(cameraPosition, 1.0)).xyz;
    vec3 pw = (uInvModel * vec4(vWorld, 1.0)).xyz;
    vec3 rd = normalize(pw - ro);

    // bounds: ellipsoid (axes-scaled sphere of radius 1.1R)
    vec3 roQ = ro / uAxes;
    vec3 rdQ = rd / uAxes;
    float Rb = uR * 1.12;
    float aC = dot(rdQ, rdQ);
    float bC = 2.0 * dot(roQ, rdQ);
    float cC = dot(roQ, roQ) - Rb * Rb;
    float disc = bC * bC - 4.0 * aC * cC;
    if (disc < 0.0) discard;
    float sq = sqrt(disc);
    float t0 = max((-bC - sq) / (2.0 * aC), 0.0);
    float t1 = (-bC + sq) / (2.0 * aC);
    if (t1 <= t0) discard;

    float dt = (t1 - t0) / float(uSteps);
    float jitter = h31(vec3(gl_FragCoord.xy, uTime)) * dt;

    vec3 col = vec3(0.0);
    vec3 T = vec3(1.0);

    for (int i = 0; i < 72; i++) {
      if (i >= uSteps) break;
      float t = t0 + jitter + (float(i) + 0.5) * dt;
      if (t > t1) break;
      vec3 p = ro + rd * t;
      vec3 q = p / uAxes;
      float r01 = length(q) / uR;
      if (r01 > 1.12) continue;

      // irregular silhouette: the boundary radius wanders with direction —
      // lobes and bites instead of a tidy ball
      float lob = fbm3(normalize(q) * 2.3 + uSeed * 7.3);
      float edge = 0.52 + 0.58 * lob;
      float body = smoothstep(edge, edge * 0.42, r01);
      float core = exp(-length(p - uCoreOff) / (uR * 0.2)) * 1.5;
      if (body < 0.01 && core < 0.02) continue;

      vec3 ps = swirl(p, r01);
      float marble = fbm3(ps * (3.4 / uR) + uSeed);
      float density = body * (0.22 + 1.0 * marble);

      // dark veins — per-channel absorption turns them warm-brown
      float vein = vno3(ps * (7.5 / uR) + uSeed * 3.1);
      float dust = body * smoothstep(0.56, 0.82, vein) * 2.2;

      float glow = clamp(core, 0.0, 1.4);
      vec3 emit = mix(mix(uRim, uMid, smoothstep(0.9, 0.35, r01)), uHot, glow * 0.75)
                * (density * 0.8 + glow * 1.1);
      col += T * emit * dt * 0.0042;
      vec3 absorb = dust * vec3(0.035, 0.05, 0.07) + density * 0.0022;
      T *= exp(-absorb * dt);
      if (max(T.r, max(T.g, T.b)) < 0.02) break;
    }

    float alpha = 1.0 - dot(T, vec3(0.333));
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.16);
    gl_FragColor = vec4(col, clamp(alpha + luma * 0.2, 0.0, 1.0));
  }
`;

// ---------------------------------------------------------------- universe data (REAL artists & songs)
const PICK = ['bts', 'blackpink', 'iu', 'aespa', 'newjeans', 'exo', 'seventeen', 'twice'];
interface ArtistData { id: string; name: string; songs: MusicNode[] }
const artistsData: ArtistData[] = PICK.map((id) => {
  const songs = MUSIC_NODES.filter((n) => n.id.startsWith(`song_${id}_`)).slice(0, 12);
  const display = songs[0]?.artist?.split('/')[0].trim() || id.toUpperCase();
  return { id, name: display, songs };
}).filter((a) => a.songs.length > 0);

// ---------------------------------------------------------------- nebula construction
interface SongEntry {
  node: MusicNode;
  star: THREE.Sprite;
  label: THREE.Sprite;
  base: THREE.Vector3;
  bobPhase: number;
  bobAmp: number;
}
interface Nebula {
  id: string;
  name: string;
  family: (typeof FAMILIES)[number];
  R: number;
  group: THREE.Group;      // main scene: labels, stars, hit sphere
  volMesh: THREE.Mesh;     // volScene: the raymarched body
  volMat: THREE.ShaderMaterial;
  label: THREE.Sprite;
  hit: THREE.Mesh;
  songs: SongEntry[];
  spinAxis: THREE.Vector3;
  spinSpeed: number;
  basePos: THREE.Vector3;
  bobPhase: number;
}

const nebulas: Nebula[] = [];
const rngSeed = (s: string) => {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 9973;
  return () => {
    x = (x * 16807 + 11) % 2147483647;
    return (x % 10000) / 10000;
  };
};

// 3D shell layout with rejection for separation — REAL vertical spread
const positions: THREE.Vector3[] = [];
{
  const rnd = rngSeed('universe-v4');
  for (let i = 0; i < artistsData.length; i++) {
    let p: THREE.Vector3;
    let tries = 0;
    do {
      const th = rnd() * Math.PI * 2;
      const ph = Math.acos(rnd() * 1.7 - 0.85); // avoid extreme poles, keep big y spread
      const rr = 1500 + rnd() * 1150;
      p = new THREE.Vector3(
        rr * Math.sin(ph) * Math.cos(th),
        rr * Math.cos(ph) * 0.85,
        rr * Math.sin(ph) * Math.sin(th)
      );
      tries++;
    } while (tries < 40 && positions.some((q) => q.distanceTo(p) < 1250));
    positions.push(p);
  }
}

artistsData.forEach((a, idx) => {
  const rnd = rngSeed(a.id);
  const family = FAMILIES[idx % FAMILIES.length];
  const R = 340 + rnd() * 240;
  const axes = new THREE.Vector3(1, 0.6 + rnd() * 0.35, 0.82 + rnd() * 0.25);

  const group = new THREE.Group();
  group.position.copy(positions[idx]);
  // random initial tumble — no two clouds share an orientation
  group.quaternion.setFromEuler(new THREE.Euler(rnd() * Math.PI, rnd() * Math.PI * 2, rnd() * Math.PI));
  scene.add(group);

  const volMat = new THREE.ShaderMaterial({
    vertexShader: VOL_VERT,
    fragmentShader: VOL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uInvModel: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uR: { value: R },
      uAxes: { value: axes },
      uSeed: { value: rnd() * 43.7 },
      uSteps: { value: 40 },
      uHot: { value: new THREE.Color(family.hot) },
      uMid: { value: new THREE.Color(family.mid) },
      uRim: { value: new THREE.Color(family.rim) },
      uCoreOff: { value: new THREE.Vector3((rnd() - 0.5) * R * 0.3, (rnd() - 0.5) * R * 0.2, (rnd() - 0.5) * R * 0.3) },
    },
  });
  const volMesh = new THREE.Mesh(
    new THREE.BoxGeometry(R * 2.4 * axes.x, R * 2.4 * axes.y, R * 2.4 * axes.z),
    volMat
  );
  volScene.add(volMesh);

  // artist caption — floats above the cloud, always readable
  const label = labelSprite(a.name, 64);
  label.position.set(0, R * 1.35, 0);
  label.renderOrder = 30;
  group.add(label);

  // generous invisible hit volume
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.05, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.userData = { type: 'artist', id: a.id };
  group.add(hit);

  // songs — floating stars INSIDE the cloud
  const songs: SongEntry[] = a.songs.map((node, i) => {
    const dir = new THREE.Vector3(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.7, rnd() * 2 - 1).normalize();
    const dist = R * (0.2 + 0.65 * Math.cbrt(rnd()));
    const base = dir.multiplyScalar(dist).multiply(axes);
    const star = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: new THREE.Color(family.hot),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    star.scale.setScalar(26);
    star.position.copy(base);
    star.renderOrder = 20;
    star.userData = { type: 'song', artistId: a.id, index: i };
    group.add(star);

    const label = labelSprite(node.name, 44, 0.85);
    label.scale.multiplyScalar(0.62);
    label.position.copy(base).add(new THREE.Vector3(0, -30, 0));
    label.renderOrder = 21;
    label.userData = { type: 'song', artistId: a.id, index: i };
    (label.material as THREE.SpriteMaterial).opacity = 0; // hidden until focused
    group.add(label);

    return { node, star, label, base, bobPhase: rnd() * Math.PI * 2, bobAmp: 6 + rnd() * 10 };
  });

  nebulas.push({
    id: a.id,
    name: a.name,
    family,
    R,
    group,
    volMesh,
    volMat,
    label,
    hit,
    songs,
    spinAxis: new THREE.Vector3(rnd() - 0.5, 0.7 + rnd() * 0.3, rnd() - 0.5).normalize(),
    spinSpeed: (0.014 + rnd() * 0.02) * (rnd() > 0.5 ? 1 : -1),
    basePos: positions[idx].clone(),
    bobPhase: rnd() * Math.PI * 2,
  });
});

// composite the volume RT over the scene background
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
compositeQuad.renderOrder = 10;
scene.add(compositeQuad);

// ---------------------------------------------------------------- the REAL time mirror
const mirror = new TimeMirror(glowTex);
mirror.group.scale.setScalar(1.6); // universe scale is larger than the app's
scene.add(mirror.group);
const AUDIO_ZERO = { intensity: 0, bass: 0, mids: 0, highs: 0 };

// ---------------------------------------------------------------- deep background
{
  const N = 16000;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const tints = ['#e8e0d2', '#c8ccd8', '#d8c8c0', '#9fb0dd', '#ddb9a8'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const rr = 12000 + Math.random() * 6000;
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
  scene.add(new THREE.Points(geo, mat));
}

// ---------------------------------------------------------------- navigation state machine
type Mode = 'universe' | 'artist' | 'song';
let mode: Mode = 'universe';
let focused: Nebula | null = null;
let currentSong: SongEntry | null = null;
let flying = false;
const lookNow = new THREE.Vector3(0, 0, 0);

const UNIVERSE_POS = new THREE.Vector3(0, 1400, 4600);
camera.position.copy(UNIVERSE_POS).multiplyScalar(1.35);
camera.lookAt(lookNow);

const modeEl = document.getElementById('mode')!;
const hintEl = document.getElementById('hint')!;

/** absolutely 3D flight: banked quadratic arc, control point pushed sideways
 *  AND vertically so no two flights share a plane */
function flyTo(pos: THREE.Vector3, look: THREE.Vector3, duration: number, fov: number, onDone?: () => void) {
  flying = true;
  const p0 = camera.position.clone();
  const p2 = pos.clone();
  const dir = p2.clone().sub(p0);
  const dist = dir.length();
  const side = new THREE.Vector3().crossVectors(dir.normalize(), new THREE.Vector3(0, 1, 0)).normalize();
  const p1 = p0.clone().add(p2).multiplyScalar(0.5)
    .addScaledVector(side, dist * (Math.random() > 0.5 ? 0.22 : -0.22))
    .add(new THREE.Vector3(0, dist * 0.24, 0));
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const look0 = lookNow.clone();
  const state = { t: 0, fov: camera.fov };
  const baseUp = new THREE.Vector3(0, 1, 0);
  gsap.to(state, {
    t: 1,
    fov,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => {
      curve.getPoint(state.t, camera.position);
      lookNow.lerpVectors(look0, look, state.t);
      // banked roll through the arc — the "aircraft" feel
      const bank = Math.sin(state.t * Math.PI) * 0.16;
      camera.up.copy(baseUp).applyAxisAngle(curve.getTangent(state.t), bank).normalize();
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    },
    onComplete: () => {
      camera.up.set(0, 1, 0);
      flying = false;
      onDone?.();
    },
  });
}

function setSongLabelsVisible(n: Nebula | null) {
  nebulas.forEach((neb) => {
    const on = neb === n;
    neb.songs.forEach((s) => {
      gsap.to(s.label.material, { opacity: on ? 0.95 : 0, duration: 0.8, overwrite: 'auto' });
      gsap.to(s.star.material, { opacity: on ? 1 : mode === 'universe' ? 0.5 : 0.35, duration: 0.8, overwrite: 'auto' });
    });
    gsap.to(neb.label.material, { opacity: on || mode !== 'song' ? 0.92 : 0.15, duration: 0.8, overwrite: 'auto' });
  });
}

function goUniverse() {
  mode = 'universe';
  focused = null;
  currentSong = null;
  mirror.close();
  modeEl.textContent = '宇宙';
  setSongLabelsVisible(null);
  flyTo(UNIVERSE_POS, new THREE.Vector3(0, 0, 0), 2.6, 66);
}

function goArtist(n: Nebula) {
  mode = 'artist';
  focused = n;
  currentSong = null;
  mirror.close();
  modeEl.textContent = n.name;
  setSongLabelsVisible(n);
  const center = n.group.position.clone();
  // approach from a random 3D direction — never the same flat angle twice
  const rnd = Math.random;
  const dir = new THREE.Vector3(rnd() * 2 - 1, 0.35 + rnd() * 0.5, rnd() * 2 - 1).normalize();
  flyTo(center.clone().addScaledVector(dir, n.R * 2.35), center, 3.0, 58);
}

function goSong(n: Nebula, s: SongEntry) {
  mode = 'song';
  focused = n;
  currentSong = s;
  modeEl.textContent = `${n.name} — ${s.node.name}`;
  const world = s.star.getWorldPosition(new THREE.Vector3());
  const dir = camera.position.clone().sub(world).normalize();
  dir.y = Math.max(dir.y, 0.08);
  dir.normalize();
  const camEnd = world.clone().addScaledVector(dir, 130);
  // the REAL mirror sequence: dust body forms mid-flight, cover blows in
  mirror.setTexture(null);
  mirror.group.position.copy(world);
  setTimeout(() => {
    if (currentSong === s) {
      mirror.open(world, n.family.mid);
      mirror.setTexture(makeCover(s.node.name, n.name, n.family.mid, n.family.rim));
    }
  }, 500);
  flyTo(camEnd, world, 2.4, 52);
}

// ---------------------------------------------------------------- picking
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = { x: 0, y: 0, t: 0 };

function pickables(): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  nebulas.forEach((n) => {
    if (mode === 'universe' || n !== focused) out.push(n.hit);
    if (n === focused) n.songs.forEach((s) => { out.push(s.star); out.push(s.label); });
  });
  return out;
}

function pick(e: { clientX: number; clientY: number }): { type: string; nebula?: Nebula; song?: SongEntry } | null {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables(), false);
  for (const h of hits) {
    const u = h.object.userData;
    if (u.type === 'artist') {
      const n = nebulas.find((x) => x.id === u.id)!;
      return { type: 'artist', nebula: n };
    }
    if (u.type === 'song') {
      const n = nebulas.find((x) => x.id === u.artistId)!;
      return { type: 'song', nebula: n, song: n.songs[u.index] };
    }
  }
  return null;
}

const noteDown = (e: { clientX: number; clientY: number }) => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
};
addEventListener('pointerdown', noteDown);
addEventListener('mousedown', noteDown); // some automation environments send mouse events only
addEventListener('click', (e) => {
  if (flying) return;
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return; // a drag, not a click
  const hit = pick(e);
  if (hit?.type === 'song' && hit.nebula && hit.song) {
    if (currentSong !== hit.song) goSong(hit.nebula, hit.song);
    return;
  }
  if (hit?.type === 'artist' && hit.nebula) {
    goArtist(hit.nebula);
    return;
  }
  // void click → one level back
  if (mode === 'song' && focused) goArtist(focused);
  else if (mode === 'artist') goUniverse();
});
const onMove = (e: { clientX: number; clientY: number }) => {
  par.x = (e.clientX / innerWidth - 0.5) * 2;
  par.y = (e.clientY / innerHeight - 0.5) * 2;
  if (flying) return;
  const hit = pick(e);
  document.body.style.cursor = hit ? 'pointer' : 'default';
  // ripples on the open mirror — the same soft wave as the app
  if (mirror.isOpen) {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(mirror.hitMesh, false);
    if (hits.length && hits[0].uv) mirror.addRipple(hits[0].uv.x, hits[0].uv.y, clockElapsed, 0.85);
  }
};
addEventListener('pointermove', onMove);
addEventListener('mousemove', onMove);
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !flying) {
    if (mode === 'song' && focused) goArtist(focused);
    else if (mode === 'artist') goUniverse();
  }
});

// opening: drift into the universe view
{
  flying = true;
  const from = camera.position.clone();
  const st = { t: 0 };
  gsap.to(st, {
    t: 1, duration: 3.6, ease: 'power2.inOut', delay: 0.3,
    onUpdate: () => camera.position.lerpVectors(from, UNIVERSE_POS, st.t),
    onComplete: () => { flying = false; },
  });
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let clockElapsed = 0;
let uniAng = 0;
let dtFrame = 0.016;
let lastT = 0;
const par = { x: 0, y: 0 };
const parNow = { x: 0, y: 0 };
let volTick = false;
let fpsN = 0;
let fpsT = performance.now();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function tick() {
  fpsN++;
  const nowMs = performance.now();
  if (nowMs - fpsT >= 1000) {
    (window as any).__fps = Math.round((fpsN * 1000) / (nowMs - fpsT));
    fpsN = 0;
    fpsT = nowMs;
  }
  const t = clock.getElapsedTime();
  dtFrame = Math.max(0.001, t - lastT);
  lastT = t;
  clockElapsed = t;
  gsap.updateRoot(t);

  // nebulas tumble on their own axes and breathe in place
  nebulas.forEach((n, i) => {
    tmpQ.setFromAxisAngle(n.spinAxis, n.spinSpeed * 0.016);
    n.group.quaternion.premultiply(tmpQ);
    n.group.position.copy(n.basePos).add(
      tmpV.set(
        Math.sin(t * 0.11 + n.bobPhase) * 16,
        Math.sin(t * 0.09 + n.bobPhase * 2.1) * 22,
        Math.cos(t * 0.1 + n.bobPhase) * 16
      )
    );
    n.group.updateMatrixWorld();
    // volume mesh follows the group; the shader marches in local space
    n.volMesh.position.copy(n.group.position);
    n.volMesh.quaternion.copy(n.group.quaternion);
    n.volMesh.updateMatrixWorld();
    (n.volMat.uniforms.uInvModel.value as THREE.Matrix4).copy(n.volMesh.matrixWorld).invert();
    n.volMat.uniforms.uTime.value = t + i * 7.3;

    // songs bob inside; labels track their stars
    n.songs.forEach((s) => {
      s.star.position.copy(s.base).add(
        tmpV.set(
          Math.sin(t * 0.5 + s.bobPhase) * s.bobAmp,
          Math.sin(t * 0.42 + s.bobPhase * 1.7) * s.bobAmp,
          Math.cos(t * 0.46 + s.bobPhase) * s.bobAmp * 0.7
        )
      );
      s.label.position.copy(s.star.position).add(tmpV.set(0, -30, 0));
    });

    // keep captions readable at any distance (near-constant screen size)
    const dist = camera.position.distanceTo(n.group.getWorldPosition(tmpV));
    const k = THREE.MathUtils.clamp(dist / 1150, 0.55, 4.4);
    n.label.scale.set(260 * k, 42.6 * k, 1);
    n.songs.forEach((s) => {
      const sd = camera.position.distanceTo(s.star.getWorldPosition(tmpV));
      const sk = THREE.MathUtils.clamp(sd / 620, 0.5, 2.4);
      s.label.scale.set(128 * sk, 21 * sk, 1);
      s.star.scale.setScalar(26 * THREE.MathUtils.clamp(sd / 1100, 0.6, 2.0));
    });
  });

  // subtle universe drift + parallax (incremental — no jump after a flight)
  parNow.x += (par.x - parNow.x) * 0.04;
  parNow.y += (par.y - parNow.y) * 0.04;
  if (!flying && mode === 'universe') {
    uniAng += 0.0085 * Math.min(dtFrame, 0.05);
    camera.position.set(
      Math.sin(uniAng) * 4600,
      UNIVERSE_POS.y + parNow.y * -60,
      Math.cos(uniAng) * 4600
    );
    camera.position.x += parNow.x * 90;
  }

  // the mirror stays pinned to its drifting song star; the camera's gaze
  // follows gently so the pair never separates
  if (mode === 'song' && currentSong && mirror.isOpen) {
    currentSong.star.getWorldPosition(tmpV);
    mirror.group.position.copy(tmpV);
    if (!flying) lookNow.lerp(tmpV, 0.06);
  }
  camera.lookAt(lookNow);

  if (mirror.isOpen) mirror.group.lookAt(camera.position);
  mirror.update(t, AUDIO_ZERO, camera);

  const cost0 = performance.now();
  volTick = !volTick;
  if (flying || volTick) {
    renderer.setRenderTarget(rtVol);
    renderer.clear();
    renderer.render(volScene, camera);
    renderer.setRenderTarget(null);
  }
  composer.render();
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
// rAF watchdog — keeps the show alive when the environment starves rAF
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

addEventListener('click', () => { hintEl.style.opacity = '0.2'; }, { once: true });

// prototype-only debug handle
(window as any).__proto = {
  camera,
  gsap,
  nebulas,
  mirror,
  get mode() { return mode; },
  get flying() { return flying; },
};
