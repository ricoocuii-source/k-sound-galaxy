/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prototype v7 · PLANETFALL 着陆计划
 * 范式：不是地图也不是电台——是一艘飞船。每位歌手是一座粒子星系，
 * 扫描 → 入轨 → 降落，着陆点就是一首歌。收集本身是玩法。
 *
 * 开源资产（不从零手绘）：
 *  - 歌手星系:The Milky-way galaxy by balongonick (CC BY 4.0),本地 /models/milky-way/
 *  - HUD 框架:augmented-ui v2 (MIT),本地 /vendor/
 *  - 天幕:ESO/S.Brunier 银河全景 (CC BY 4.0)
 *  - 镜头光斑:three.js 官方 Lensflare 纹理 (MIT)
 *  - 超空间:Star Nest by Pablo Roman Andrioli (MIT)
 * 轨迹:全部飞行走 THREE.CubicBezierCurve3。
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gsap } from 'gsap';
import { MUSIC_NODES } from '../data';
import { MusicNode } from '../types';
import { fetchTrackInfo, TrackInfo } from '../engine/itunes';
// 超空间隧道方案暂下线(./tunnel.ts 完整保留,后期再调时重新挂载)

/* ============ GSAP 手动驱动（防环境节流） ============ */
gsap.ticker.remove(gsap.updateRoot);

/* ============ 数据：按歌手聚合出 25 座星系 ============ */
interface ArtistWorld {
  idx: number;
  id: string;
  name: string;
  cn: string;
  color: THREE.Color;
  css: string;
  songs: MusicNode[];
}

const byArtist = new Map<string, MusicNode[]>();
for (const n of MUSIC_NODES) {
  const key = n.id.split('_')[1];
  if (!byArtist.has(key)) byArtist.set(key, []);
  byArtist.get(key)!.push(n);
}
const ARTISTS: ArtistWorld[] = [...byArtist.entries()].map(([id, songs], idx) => {
  const label = songs[0].artist || id;
  const [en, cn] = label.split('/').map((s) => s.trim());
  return { idx, id, name: en || id, cn: cn || '', color: new THREE.Color(songs[0].color), css: songs[0].color, songs };
});
const TOTAL_SONGS = MUSIC_NODES.length;

/* ============ 火焰方案对比模式:?compare=1 渲染三架主机(A/B/C 方案) ============ */
const COMPARE = new URLSearchParams(location.search).has('compare');

/* ============ 基础三件套 ============ */
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.setClearColor(0x020308, 1); // 隧道渲染路径的深空底色(composer 路径走 scene.background,不受影响)
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 60000);
camera.position.set(0, 320, 2550);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.6, 0.58);
composer.addPass(bloom);
const rgbPass = new ShaderPass(RGBShiftShader);
rgbPass.uniforms['amount'].value = 0.0009;
composer.addPass(rgbPass);
composer.addPass(new OutputPass());

/* ============ 纹理 ============ */
const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin('anonymous');
const loadTex = (url: string, onOk?: (t: THREE.Texture) => void) =>
  texLoader.load(url, (t) => onOk?.(t), undefined, () => console.warn('tex fail:', url));

/* ============ 天幕：ESO 银河全景 ============ */
const skyMat = new THREE.MeshBasicMaterial({ color: 0x0c0f18, side: THREE.BackSide, depthWrite: false, fog: false });
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(26000, 64, 40), skyMat);
skyMesh.rotation.set(0.34, 0, 0.3);
scene.add(skyMesh);
let skyLoaded = false;
loadTex('https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/ESO_-_Milky_Way.jpg/3840px-ESO_-_Milky_Way.jpg', (t) => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  skyMat.map = t; skyMat.color.set(0xaab4ca); skyMat.needsUpdate = true; skyLoaded = true;
});

/* ============ 光照 + 恒星 ============ */
scene.add(new THREE.AmbientLight(0x8b93b8, 0.5));
const SUN_POS = new THREE.Vector3(-3400, 1500, -2600);
// 电影式布光:key light 跟随相机后上方,保证可见面永远受光(太阳只当景观)
const keyLight = new THREE.DirectionalLight(0xfff2dd, 2.3);
scene.add(keyLight);
scene.add(keyLight.target);

const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe6b8 });
const sun = new THREE.Mesh(new THREE.SphereGeometry(230, 48, 32), sunMat);
sun.position.copy(SUN_POS);
scene.add(sun);
loadTex('/textures/2k_sun.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; sunMat.map = t; sunMat.needsUpdate = true; });

const FLARE_BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/lensflare/';
loadTex(FLARE_BASE + 'lensflare0.png', (f0) => {
  loadTex(FLARE_BASE + 'lensflare3.png', (f3) => {
    const lf = new Lensflare();
    lf.addElement(new LensflareElement(f0, 420, 0, new THREE.Color(0xffe2b0)));
    lf.addElement(new LensflareElement(f3, 70, 0.42));
    lf.addElement(new LensflareElement(f3, 120, 0.72));
    lf.addElement(new LensflareElement(f3, 52, 0.94));
    sun.add(lf);
  });
});

/* ============ 星野（twinkle + 高频响应） ============ */
const starU = { uTime: { value: 0 }, uHigh: { value: 0 } };
{
  const N = 34000;
  const pos = new Float32Array(N * 3), phase = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 7000 + Math.random() * 16000;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.72;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    phase[i] = Math.random() * Math.PI * 2;
    size[i] = 1.1 + Math.random() * 2.4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: starU as any,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aPhase; attribute float aSize;
      uniform float uTime; uniform float uHigh;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aPhase) * 1.7) + aPhase * 7.0);
        vA = tw * (0.5 + uHigh * 0.9);
        gl_PointSize = aSize * (1.0 + uHigh * 0.8) * (2600.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d) * vA;
        gl_FragColor = vec4(0.86, 0.9, 1.0, a);
      }`,
  });
  scene.add(new THREE.Points(g, m));
}

/* ============ 歌手星系:5 万点 Milky Way 模板,一次加载、25 次共享几何 ============ */
const milkyWayTemplate = new Promise<THREE.Group>((resolve, reject) => {
  new GLTFLoader().load('/models/milky-way/scene.gltf', (gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const template = new THREE.Group();

    gltf.scene.traverse((obj) => {
      const source = obj as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
      if (!source.isPoints) return;
      const geometry = source.geometry.clone();
      geometry.applyMatrix4(source.matrixWorld);
      template.add(new THREE.Points(geometry, source.material));
    });

    if (!template.children.length) {
      reject(new Error('Milky Way GLTF does not contain a points primitive'));
      return;
    }

    const box = new THREE.Box3().setFromObject(template);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    template.traverse((obj) => {
      const points = obj as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
      if (!points.isPoints) return;
      points.geometry.translate(-center.x, -center.y, -center.z);
      points.geometry.computeBoundingBox();
      points.geometry.computeBoundingSphere();
    });
    template.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
    resolve(template);
  }, undefined, reject);
});

function mountMilkyWayVisual(visual: THREE.Group, artist: ArtistWorld) {
  milkyWayTemplate.then((template) => {
    const instance = template.clone(true);
    instance.traverse((obj) => {
      const points = obj as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
      if (!points.isPoints) return;
      const material = points.material.clone();
      material.vertexColors = true;
      material.color.copy(artist.color).lerp(new THREE.Color(0xffffff), 0.28);
      material.size = 0.95;
      // 粒子随透视距离同步缩放，避免远处过度堆叠、近处被摊薄。
      material.sizeAttenuation = true;
      material.transparent = true;
      material.opacity = 0.032;
      material.depthWrite = false;
      material.blending = THREE.NormalBlending;
      points.material = material;
    });
    visual.add(instance);
  }).catch((error) => console.error('milky-way particle model failed:', error));
}

interface Planet {
  a: ArtistWorld;
  root: THREE.Group;
  visual: THREE.Group;
  galaxy: THREE.Group;
  pickMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  r: number;
  spin: number;
  vinylRoot: THREE.Group | null;
  vinyls: Vinyl[];
}

const planets: Planet[] = [];
const pickPlanets: THREE.Mesh[] = [];

for (const a of ARTISTS) {
  const i = a.idx;
  const r = Math.min(112, 42 + a.songs.length * 2.6);
  const th = i * 2.39996 + 0.7;
  const rad = 560 + 1640 * Math.sqrt(i / (ARTISTS.length - 1));
  const y = Math.sin(i * 12.9898) * 430;
  const root = new THREE.Group();
  root.position.set(Math.cos(th) * rad, y, Math.sin(th) * rad);

  const visual = new THREE.Group();
  // 固定在世界空间中的斜向姿态，让相机环绕时能真实看到模型厚度；不再始终正对镜头。
  visual.rotation.set(
    THREE.MathUtils.degToRad(42 + (i % 4) * 7),
    th + Math.PI * 0.35,
    THREE.MathUtils.degToRad(-18 + (i % 4) * 10),
  );
  root.add(visual);
  const galaxy = new THREE.Group();
  galaxy.scale.setScalar(r * 1.05);
  galaxy.rotateY(i * 1.618);
  visual.add(galaxy);
  mountMilkyWayVisual(galaxy, a);

  // 粒子盘只负责显示；透明球仅用于鼠标命中，飞行/轨道继续沿用原 r。
  const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  pickMaterial.colorWrite = false;
  const pickMesh = new THREE.Mesh(new THREE.SphereGeometry(r * 1.55, 28, 18), pickMaterial);
  pickMesh.userData.planetIdx = planets.length;
  root.add(pickMesh);

  scene.add(root);
  planets.push({ a, root, visual, galaxy, pickMesh, r, spin: 0.05 + (i % 5) * 0.014, vinylRoot: null, vinyls: [] });
  pickPlanets.push(pickMesh);
}

/* ============ 黑胶唱片（歌曲卫星）—— 圆的、有厚度、会转 ============ */
interface Vinyl {
  node: MusicNode;
  group: THREE.Group;
  disc: THREE.Mesh;
  hit: THREE.Mesh;
  labelMat: THREE.MeshBasicMaterial;
  glow: THREE.Sprite;
  orbR: number; orbSpeed: number; phase: number; incl: THREE.Euler;
  base: number;
  coverState: 0 | 1 | 2;
  info: TrackInfo | null;
}

const grooveTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#0a0a10'; c.fillRect(0, 0, 256, 256);
  for (let rr = 34; rr < 126; rr += 3) {
    c.beginPath(); c.arc(128, 128, rr, 0, Math.PI * 2);
    c.strokeStyle = rr % 6 < 3 ? 'rgba(180,190,220,0.10)' : 'rgba(30,32,44,0.9)';
    c.lineWidth = 1.4; c.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const glowTexShared = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.32, 'rgba(255,255,255,0.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
})();

function placeholderLabel(node: MusicNode, css: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(128, 128, 10, 128, 128, 150);
  g.addColorStop(0, css); g.addColorStop(1, '#14141e');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.font = '600 92px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(node.name.slice(0, 1).toUpperCase(), 128, 122);
  c.font = '400 20px Menlo, monospace'; c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText(node.name.slice(0, 16), 128, 196);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const VINYL_R = 4;
function makeVinyl(node: MusicNode, css: string, colorHex: THREE.Color): Vinyl {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(VINYL_R, VINYL_R, 0.55, 48),
    [
      new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.42, metalness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: grooveTex, color: 0x454a58, roughness: 0.42, metalness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: grooveTex, color: 0x454a58, roughness: 0.42, metalness: 0.5 }),
    ]
  );
  group.add(disc);
  const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  hitMaterial.colorWrite = false;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(VINYL_R * 2.4, 16, 10), hitMaterial);
  group.add(hit);
  const labelMat = new THREE.MeshBasicMaterial({ map: placeholderLabel(node, css), color: 0x7a7f8e, side: THREE.DoubleSide });
  const label = new THREE.Mesh(new THREE.CircleGeometry(VINYL_R * 0.42, 40), labelMat);
  label.rotation.x = -Math.PI / 2; label.position.y = 0.31;
  group.add(label);
  const label2 = new THREE.Mesh(new THREE.CircleGeometry(VINYL_R * 0.42, 40), labelMat);
  label2.rotation.x = Math.PI / 2; label2.position.y = -0.31;
  group.add(label2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexShared, color: colorHex, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.scale.setScalar(6);
  group.add(glow);
  (disc as any).__vinyl = null; // 稍后回填
  (hit as any).__vinyl = null;
  return { node, group, disc, hit, labelMat, glow, orbR: 0, orbSpeed: 0, phase: 0, incl: new THREE.Euler(), base: 1, coverState: 0, info: null };
}

/* 封面/试听预取 */
const trackCache = new Map<string, { info: TrackInfo | null; tex: THREE.Texture | null }>();
async function ensureTrack(v: Vinyl) {
  if (v.coverState !== 0) return;
  v.coverState = 1;
  const cached = trackCache.get(v.node.id);
  if (cached) {
    v.info = cached.info;
    if (cached.tex) { v.labelMat.map = cached.tex; v.labelMat.needsUpdate = true; }
    v.coverState = 2; return;
  }
  const info = await fetchTrackInfo(v.node);
  v.info = info;
  let tex: THREE.Texture | null = null;
  if (info?.artworkUrlSmall) {
    tex = await new Promise<THREE.Texture | null>((res) =>
      texLoader.load(info.artworkUrlSmall!, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => res(null))
    );
    if (tex) { v.labelMat.map = tex; v.labelMat.needsUpdate = true; }
  }
  trackCache.set(v.node.id, { info, tex });
  v.coverState = 2;
}

/* ============ 星尘氛围带:应援色大辉光,给宇宙上底色 ============ */
{
  for (let k = 0; k < 90; k++) {
    const a = ARTISTS[k % ARTISTS.length];
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexShared, color: a.color.clone().lerp(new THREE.Color(0x222233), 0.25),
      transparent: true, opacity: 0.05 + (k % 3) * 0.02,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const th = k * 2.39996 * 1.7 + 1.3;
    const rad = 380 + Math.pow(k / 90, 0.7) * 2900;
    sp.position.set(Math.cos(th) * rad, Math.sin(k * 7.31) * 520, Math.sin(th) * rad);
    sp.scale.setScalar(420 + (k % 7) * 160);
    scene.add(sp);
  }
}

/* ============ Star Nest 超空间层（MIT） ============ */
const warpU = {
  uTime: { value: 0 }, uWarp: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) },
  // 跳跃隧道染色:uTint = 目标歌手应援色,uMix 0→1 从蓝白星流渐变过去(0 时输出与原版逐位相同)
  uTint: { value: new THREE.Color(0.62, 0.78, 1.0) }, uMix: { value: 0 },
};
const warpScene = new THREE.Scene();
const warpCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const warpMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    uniforms: warpU as any, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uWarp; uniform vec2 uRes;
      uniform vec3 uTint; uniform float uMix;
      void main() {
        if (uWarp < 0.012) { gl_FragColor = vec4(0.0); return; }
        vec2 uv = gl_FragCoord.xy / uRes - 0.5; uv.y *= uRes.y / uRes.x;
        vec3 dir = vec3(uv * 0.9, 1.0);
        float time = uTime * 0.05 + 0.25;
        vec3 from = vec3(1.0, 0.5, 0.5) + vec3(time * 2.0, time, -2.0);
        float s = 0.1, fade = 1.0; vec3 v = vec3(0.0);
        for (int r = 0; r < 14; r++) {
          vec3 p = from + s * dir * 0.5;
          p = abs(vec3(0.85) - mod(p, vec3(1.7)));
          float pa = 0.0, a = 0.0;
          for (int i = 0; i < 12; i++) { p = abs(p) / dot(p, p) - 0.53; a += abs(length(p) - pa); pa = length(p); }
          a *= a * a;
          v += fade;
          v += vec3(s, s * s, s * s * s * s) * a * 0.0015 * fade;
          fade *= 0.73; s += 0.12;
        }
        v = mix(vec3(length(v)), v, 0.85) * 0.01;
        // 亮度保持式染色:亮度当骨架,应援色当皮(uMix=0 时无变化)
        float lum = dot(v, vec3(0.45, 0.4, 0.35));
        v = mix(v, lum * 2.4 * uTint, uMix);
        float rd = length(uv);
        gl_FragColor = vec4(v * uWarp * 1.6, uWarp * smoothstep(0.1, 0.6, rd + 0.25));
      }`,
  })
);
warpScene.add(warpMesh);

/* ============ 音频总线（gain 静音,分析在上游） ============ */
class AudioBus {
  el = new Audio();
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  gain: GainNode | null = null;
  data: Uint8Array | null = null;
  playing = false;
  muted = new URLSearchParams(location.search).has('muted');
  bands = { bass: 0, mid: 0, high: 0 };
  private peaks: Record<string, number> = { bass: 0.24, mid: 0.2, high: 0.16 };

  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(this.el);
    const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.82;
    const g = ctx.createGain(); g.gain.value = this.muted ? 0 : 1;
    src.connect(an); an.connect(g); g.connect(ctx.destination);
    this.ctx = ctx; this.analyser = an; this.gain = g;
    this.data = new Uint8Array(an.frequencyBinCount);
  }
  setMuted(m: boolean) { this.muted = m; if (this.gain) this.gain.gain.value = m ? 0 : 1; }
  play(url: string) { this.el.src = url; this.el.currentTime = 0; this.playing = true; this.el.play().catch(() => { this.playing = false; }); }
  toggle() {
    if (!this.el.src) return;
    if (this.el.paused) { this.playing = true; this.el.play().catch(() => { this.playing = false; }); }
    else { this.el.pause(); this.playing = false; }
  }
  stop() { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.playing = false; }
  /** 降落白噪音(走同一 gain,静音时无声) */
  entryNoise(dur = 1.9) {
    const ctx = this.ctx; if (!ctx || !this.gain) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 480; flt.Q.value = 0.6;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(0.32, t0 + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(env); env.connect(this.gain);
    src.start(); src.stop(t0 + dur + 0.05);
  }
  tick(dt: number) {
    if (!this.analyser || !this.data) return;
    this.analyser.getByteFrequencyData(this.data as any);
    const grab = (a: number, b: number) => {
      let s = 0; for (let i = a; i < b; i++) s += this.data![i];
      return s / (b - a) / 255;
    };
    const raw = { bass: grab(1, 7), mid: grab(8, 48), high: grab(48, 128) };
    const idle = 0.5 + 0.5 * Math.sin(perfNow() * 0.001 * 2 * Math.PI * (76 / 60));
    for (const k of ['bass', 'mid', 'high'] as const) {
      let v = raw[k];
      if (!this.playing || this.el.paused) v = idle * (k === 'bass' ? 0.16 : 0.08);
      this.peaks[k] = Math.max(this.peaks[k] * (1 - dt * 0.12), v, k === 'high' ? 0.14 : 0.2);
      this.bands[k] = Math.pow(THREE.MathUtils.clamp(v / this.peaks[k], 0, 1), 1.7);
    }
  }
}
const audio = new AudioBus();
const perfNow = () => performance.now();

/* ============ HUD 引用 ============ */
const $ = (id: string) => document.getElementById(id)!;
const el = {
  mode: $('mode'), hint: $('hint'),
  logLines: $('logLines'), logN: $('logN'), radarN: $('radarN'),
  np: $('np'), npCover: $('npCover') as HTMLImageElement, npTitle: $('npTitle'), npMeta: $('npMeta'), npBar: $('npBar'),
  reticle: $('reticle'), retName: $('retName'), retSub: $('retSub'),
  vinylTag: $('vinylTag'), vtName: $('vtName'),
  pcard: $('pcard'), pcName: $('pcName'), pcCn: $('pcCn'), pcSongs: $('pcSongs'), pcLog: $('pcLog'),
  entry: $('entry'), jumpflash: $('jumpflash'), toast: $('toast'), ignite: $('ignite'),
};
el.radarN.textContent = String(ARTISTS.length);

function setAccent(css: string) {
  document.documentElement.style.setProperty('--acc', css);
  const c = new THREE.Color(css);
}

const LOG_MAX = 3;
function say(html: string) {
  const i = document.createElement('i');
  i.innerHTML = html;
  el.logLines.appendChild(i);
  while (el.logLines.children.length > LOG_MAX) el.logLines.removeChild(el.logLines.firstChild!);
}

/* 图鉴 */
const LOG_KEY = 'ksg7_log';
const collected = new Set<string>(JSON.parse(localStorage.getItem(LOG_KEY) || '[]'));
function collect(id: string) {
  if (collected.has(id)) return false;
  collected.add(id);
  localStorage.setItem(LOG_KEY, JSON.stringify([...collected]));
  return true;
}
function updateLogHud(p: Planet | null) {
  el.logN.textContent = `${collected.size}/${TOTAL_SONGS}`;
  if (p) el.pcLog.textContent = String(p.a.songs.filter((s) => collected.has(s.id)).length);
}
updateLogHud(null);

let toastTimer = 0;
function toast(text: string) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.remove('show'), 2100);
}

/* ============ 状态机 ============ */
type Mode = 'idle' | 'cruise' | 'approach' | 'orbit' | 'landing' | 'surface' | 'takeoff';
let MODE: Mode = 'idle';
let focus: Planet | null = null;
let dockedVinyl: Vinyl | null = null;

const MODE_LABEL: Record<Mode, string> = {
  idle: '待命 STANDBY', cruise: '巡航 CRUISE', approach: '入轨 APPROACH',
  orbit: '轨道 ORBIT', landing: '降落 PLANETFALL', surface: '地表 SURFACE', takeoff: '起飞 ASCENT',
};
const HINTS: Partial<Record<Mode, string>> = {
  cruise: '拖拽 环视 · WASD 手动驾驶 · V 视角 · 点星系 入轨 · P 暂停 · M 静音',
  orbit: '拖拽 环视 · 点唱片 降落播放 · 点星系 跃迁 · WASD/ESC 返航 · M 静音',
  surface: '拖拽 环视 · N 下一着陆点 · 点星系 跃迁 · WASD/ESC 起飞 · P 暂停 · M 静音',
};
function setMode(m: Mode) {
  MODE = m;
  el.mode.textContent = MODE_LABEL[m];
  if (HINTS[m]) el.hint.textContent = HINTS[m]!;
  el.pcard.classList.toggle('show', m === 'orbit' || m === 'surface');
  const pk = el.pcard.querySelector('.k');
  if (pk) pk.textContent = m === 'surface' ? 'SURFACE · 已着陆' : 'ORBIT · 已入轨';
  // reticle 在 cruise/orbit/surface 三个模式都可存活(星系拾取)
  if (m !== 'cruise' && m !== 'orbit' && m !== 'surface') { el.reticle.classList.remove('show'); hoverPlanet = null; }
  if (m !== 'orbit') { el.vinylTag.classList.remove('show'); hoverVinyl = null; }
}

/* ============ 相机运动 ============ */
const steer = { x: 0, y: 0, tx: 0, ty: 0 };
/* 自由环视:按住拖拽转头(全模式生效),松手保持朝向;点击与拖拽自动区分 */
const view = { yaw: 0, pitch: 0, down: false, px: 0, py: 0, moved: false };
addEventListener('pointerdown', (e) => {
  view.down = true; view.moved = false; view.px = e.clientX; view.py = e.clientY;
});
addEventListener('pointerup', () => { view.down = false; });
addEventListener('pointermove', (e) => {
  steer.tx = (e.clientX / innerWidth - 0.5) * 2;
  steer.ty = (e.clientY / innerHeight - 0.5) * 2;
  if (view.down) {
    const dx = e.clientX - view.px, dy = e.clientY - view.py;
    if (view.moved || Math.abs(dx) + Math.abs(dy) > 5) {
      view.moved = true;
      view.yaw -= dx * 0.0042;
      view.pitch = THREE.MathUtils.clamp(view.pitch - dy * 0.0034, -1.15, 1.15);
      view.px = e.clientX; view.py = e.clientY;
    }
  }
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mouseMoved = true;
});
const VIEW_UP = new THREE.Vector3(0, 1, 0);
const lwDir = new THREE.Vector3(), lwRight = new THREE.Vector3(), lwTarget = new THREE.Vector3();
/** 统一视线:目标方向 + 环视偏角 */
function lookWithView(target: THREE.Vector3) {
  lwDir.subVectors(target, camera.position).normalize();
  if (view.yaw !== 0) lwDir.applyAxisAngle(VIEW_UP, view.yaw);
  if (view.pitch !== 0) {
    lwRight.crossVectors(lwDir, VIEW_UP);
    if (lwRight.lengthSq() > 0.001) lwDir.applyAxisAngle(lwRight.normalize(), view.pitch);
  }
  lwTarget.copy(camera.position).addScaledVector(lwDir, 200);
  camera.lookAt(lwTarget);
}
/** 镜头归位注视目标(入轨/落地完成时) */
function resetView(dur = 0.9) {
  gsap.to(view, { yaw: 0, pitch: 0, duration: dur, ease: 'power2.inOut', overwrite: 'auto' });
}

/* ============ WASD 手动驾驶(巡航态) ============ */
const drive = {
  manual: false,
  keys: new Set<string>(),
  boost: false,
  vel: new THREE.Vector3(),
  fwd: new THREE.Vector3(0, 0, -1),
};
// 姿态弹簧系统(推背感):目标角随油门,弹簧-阻尼追踪 → 全程无拐点
let pitchCur = 0, pitchVel = 0, rollCur = 0, rollVel = 0;
let pitchTgtSm = 0, rollTgtSm = 0; // 目标缓释:上升即时,回落 ~4s 慢放
function enterManual() {
  if (drive.manual) return;
  drive.manual = true;
  camera.getWorldDirection(drive.fwd);
  view.yaw = 0; view.pitch = 0;
  drive.vel.set(0, 0, 0);
}
function initDrive() {
  drive.manual = true;
  camera.getWorldDirection(drive.fwd);
  drive.vel.set(0, 0, 0);
}
function exitManual() {
  if (!drive.manual) return;
  drive.manual = false;
  drive.keys.clear();
  // 贝塞尔飞回巡航环线,从最近相位接续
  cruiseTheta = Math.atan2(camera.position.z, camera.position.x);
  const to = cruisePos(cruiseTheta, new THREE.Vector3());
  setMode('cruise');
  say('自动巡航接管 · 归航环线');
  flyBezier({
    to, look: cruisePos(cruiseTheta + 0.5, new THREE.Vector3()).multiplyScalar(0.35), dur: 2.2,
    onDone: () => setMode('cruise'),
  });
}

let cruiseTheta = 0.2;
const CRUISE_R = 2550, CRUISE_Y = 300;
const camLook = new THREE.Vector3(0, 0, 0);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3(), tmpL = new THREE.Vector3();
function cruisePos(th: number, out: THREE.Vector3) {
  return out.set(Math.cos(th) * CRUISE_R, CRUISE_Y + Math.sin(th * 2.3) * 90, Math.sin(th) * CRUISE_R);
}

/** 所有飞行统一走三次贝塞尔;两套镜头语言:
 *  glide  — 原有的对称软弧,适合短途转场(降落/换着陆点/归航)
 *  launch — 学 galaxy.spotifytrack.net 的 fly-to,核心是「先拉远再飞入」:
 *    P1 = 路径中点向星域外侧推出一段【常数主导】的巨大距离
 *    (参考站是 dist*0.4+300000,常数远大于典型航程本身)——
 *    起手不是冲向目标,而是猛地向后拉出高空,整个星系带缩成全景,
 *    到达弧顶后再折返俯冲扎向目标,拉出的空间距离就是戏剧张力;
 *    P2 = 沿逼近方向越过终点(len*0.05+常数) → 飞过头刹车再摆回,甩尾入轨;
 *    时间线性推进(ease:'none'),快慢全部由控制点几何决定:
 *    |P1-P0| 巨长 → 瞬间点火急退,|P3-P2| 短 → 漫长优雅的减速滑入;
 *    视线与路径解耦,每帧指数收敛甩向目标(参考站 0.937/帧@60fps),
 *    后拉段死死盯住目标 → 目标在画面里急速缩小,俯冲段再迎面放大。 */
const PULL_BACK = 6200; // 后拉常数:主导 P1 外推量,弧顶拉到 ~5000 高空俯瞰整个星系带,近侧目标可拉到起始距离近 3 倍
interface Flight {
  curve: THREE.CubicBezierCurve3; look0: THREE.Vector3; look1: THREE.Vector3; t: number; roll: number;
  mode: 'glide' | 'launch'; end: THREE.Vector3; tCrop: number;
}
let flight: Flight | null = null;

function flyBezier(opts: {
  to: THREE.Vector3; look: THREE.Vector3; dur?: number; roll?: number; warp?: number;
  ease?: string; onDone?: () => void; lift?: number; style?: 'glide' | 'launch';
}) {
  const p0 = camera.position.clone();
  const p3 = opts.to.clone();
  const dir = tmpV.subVectors(p3, p0);
  const len = dir.length();
  dir.normalize();
  // launch 需要助跑距离,超短途退回 glide
  const style = opts.style === 'launch' && len > 300 ? 'launch' : 'glide';
  let curve: THREE.CubicBezierCurve3;
  let roll: number;
  let dur: number;
  let tCrop = 1; // launch:曲线尾段进入到达球的进度(之后混合到停机位,裁掉回钩)
  if (style === 'launch') {
    const mid = p0.clone().add(p3).multiplyScalar(0.5);
    const out = mid.lengthSq() > 1 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const p1 = mid.clone().addScaledVector(out, len * 0.35 + PULL_BACK);
    const overshoot = len * 0.05 + 50;
    const p2 = p3.clone().addScaledVector(dir, overshoot);
    curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    const arriveR = overshoot * 0.55;
    for (let i = 240; i >= 0; i--) {
      if (curve.getPoint(i / 240).distanceTo(p3) > arriveR) { tCrop = Math.min(1, (i + 1) / 240); break; }
    }
    // 后拉让实际路程远超直线距离,时长按真实弧长配速
    dur = opts.dur ?? THREE.MathUtils.clamp(1.6 + curve.getLength() / 3100, 3.2, 5.0);
    // 压杆方向跟随外推弧线在机身右侧的投影
    const right = tmpV3.crossVectors(dir, camera.up).normalize();
    roll = (opts.roll ?? 0.3) * (Math.sign(right.dot(out)) || 1);
  } else {
    const side = tmpV2.crossVectors(dir, camera.up).normalize();
    const bank = (Math.random() > 0.5 ? 1 : -1) * len * 0.16;
    const lift = (opts.lift ?? 0.1) * len;
    const p1 = p0.clone().addScaledVector(side, bank * 0.7).addScaledVector(camera.up, lift * 0.6).lerp(p3, 0.22);
    const p2 = p3.clone().addScaledVector(side, bank * 0.35).addScaledVector(camera.up, lift * 0.25).lerp(p0, 0.22);
    curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    roll = (opts.roll ?? 0.2) * Math.sign(bank);
    dur = opts.dur ?? 2.5;
  }
  flight = { curve, look0: camLook.clone(), look1: opts.look.clone(), t: 0, roll, mode: style, end: p3, tCrop };
  if (opts.warp) {
    if (style === 'launch') {
      // warp 随后拉渐强,弧顶折返时最盛,俯冲段缓释
      gsap.to(warpU.uWarp, { value: opts.warp, duration: dur * 0.3, ease: 'power2.in' });
      gsap.to(warpU.uWarp, { value: 0, duration: dur * 0.55, ease: 'power2.out', delay: dur * 0.45 });
    } else {
      gsap.to(warpU.uWarp, { value: opts.warp, duration: dur * 0.32, ease: 'power2.in' });
      gsap.to(warpU.uWarp, { value: 0, duration: dur * 0.5, ease: 'power2.out', delay: dur * 0.42 });
    }
  }
  gsap.to(flight, {
    t: 1, duration: dur, ease: style === 'launch' ? 'none' : (opts.ease ?? 'power2.inOut'),
    onComplete: () => { flight = null; opts.onDone?.(); },
  });
}

/* ============ 轨道唱片装配 ============ */
function buildVinyls(p: Planet) {
  if (p.vinylRoot) return;
  const root = new THREE.Group();
  root.position.copy(p.root.position);
  const songs = p.a.songs.slice(0, 12);
  songs.forEach((node, i) => {
    const v = makeVinyl(node, p.a.css, p.a.color);
    v.orbR = p.r * (2.15 + (i % 3) * 0.42);
    v.orbSpeed = 0.16 - (i % 4) * 0.018;
    v.phase = (i / songs.length) * Math.PI * 2;
    v.incl = new THREE.Euler(((i % 5) - 2) * 0.16, 0, ((i % 4) - 1.5) * 0.12);
    v.base = p.r / 92;
    v.group.scale.setScalar(v.base);
    (v.disc as any).__vinyl = v;
    (v.hit as any).__vinyl = v;
    root.add(v.group);
    p.vinyls.push(v);
  });
  p.vinylRoot = root;
  scene.add(root);
  // 预取前 6 首封面,其余悬停/降落时再取
  p.vinyls.slice(0, 6).forEach((v, i) => setTimeout(() => ensureTrack(v), i * 260));
}
function disposeVinyls(p: Planet) {
  if (!p.vinylRoot) return;
  scene.remove(p.vinylRoot);
  p.vinylRoot = null;
  p.vinyls = [];
}

/* ============ 交互:入轨 / 降落 / 起飞 ============ */
let orbitAng = 0;

/** 收养一座星系:焦点切换 + 唱片/泊船装配 + HUD 填充(入轨与跃迁共用) */
function adoptPlanet(p: Planet) {
  focus = p;
  setAccent(p.a.css);
  buildVinyls(p);
  el.pcName.textContent = p.a.name;
  el.pcCn.textContent = p.a.cn || '—';
  el.pcSongs.textContent = String(p.vinyls.length);
  updateLogHud(p);
}

function approachPlanet(p: Planet) {
  if (MODE === 'approach' || MODE === 'takeoff' || MODE === 'landing') return;
  drive.manual = false;
  adoptPlanet(p);
  setMode('approach');
  say(`锁定 <b>${p.a.name}</b> · 入轨序列启动`);

  const dir = tmpV.subVectors(camera.position, p.root.position);
  dir.y = 0; dir.normalize();
  orbitAng = Math.atan2(dir.z, dir.x);
  const dist = p.r * 3.6;
  const to = tmpV2.copy(p.root.position).add(tmpV3.set(Math.cos(orbitAng) * dist, p.r * 0.95, Math.sin(orbitAng) * dist));
  resetView(1.4);
  // spotifytrack 式点火入轨:先猛拉出高空再折返俯冲,时长在 flyBezier 内按弧长配速
  flyBezier({
    to, look: p.root.position,
    warp: 0.55, roll: 0.34, style: 'launch',
    onDone: () => { setMode('orbit'); initDrive(); say(`入轨完成 · <b>${p.vinyls.length}</b> 张唱片在轨道上`); },
  });
}

/* ============ 轨道→轨道直航(超空间隧道方案暂下线,tunnel.ts 保留待后期再调) ============ */

/** 在 A 歌手轨道上点远处星系:旧星收尾+新星装配,一段 launch 贝塞尔直飞入轨 */
function hyperjumpTo(p: Planet) {
  if (p === focus) return;
  if (MODE === 'approach' || MODE === 'takeoff' || MODE === 'landing') return;
  // 地表起跳:先收拾停泊状态
  if (MODE === 'surface') { audio.stop(); el.np.classList.remove('show'); undock(); }
  const oldFocus = focus;
  drive.manual = false;
  if (flight) { gsap.killTweensOf(flight); flight = null; }
  if (oldFocus) disposeVinyls(oldFocus);
  adoptPlanet(p);
  setMode('approach');
  say(`锁定 <b>${p.a.name}</b> · 直航序列启动`);

  const dir = tmpV.subVectors(camera.position, p.root.position);
  dir.y = 0; dir.normalize();
  orbitAng = Math.atan2(dir.z, dir.x);
  const dist = p.r * 3.6;
  const to = tmpV2.copy(p.root.position).add(tmpV3.set(Math.cos(orbitAng) * dist, p.r * 0.95, Math.sin(orbitAng) * dist));
  resetView(1.4);
  flyBezier({
    to, look: p.root.position,
    warp: 0.55, roll: 0.34, style: 'launch',
    onDone: () => { setMode('orbit'); initDrive(); say(`入轨完成 · <b>${p.vinyls.length}</b> 张唱片在轨道上`); },
  });
}

function returnToCruise() {
  if (MODE !== 'orbit' || !focus) return;
  const p = focus;
  drive.manual = false;
  setMode('takeoff');
  say(`脱离 <b>${p.a.name}</b> 轨道`);
  const to = tmpV.clone().subVectors(camera.position, p.root.position).normalize().multiplyScalar(p.r * 7.5).add(p.root.position);
  flyBezier({
    to, look: cruisePos(cruiseTheta + 0.5, tmpV2.clone()).multiplyScalar(0.4), dur: 2.2, warp: 0.4,
    onDone: () => {
      disposeVinyls(p);
      focus = null;
      setAccent('#ffb46b');
      setMode('cruise');
      initDrive();
    },
  });
}

/* ============ 现成星船:Star Fighter Low-Poly © 3DHaupt (CC BY-NC,非商用) ============ */
// 第一人称主机体 + 巡航僚机 + 轨道泊船共用同一模型
// Shield/laser 隐藏;Star_Fighter_Fire 引擎火焰 = 应援色发光件
const cockpit = new THREE.Group();
/* 两档机体视角:贴背全身(默认) / 机鼻特写,V 键切换 */
const CAM_RIGS = [
  { name: '贴背全身', x: 0, y: -13, z: -35, rotX: 0.05 },
  { name: '机鼻特写', x: 0, y: -8.4, z: -14.5, rotX: 0.17 },
];
let rigIdx = 0;
const rigState = { x: CAM_RIGS[0].x, y: CAM_RIGS[0].y };
cockpit.position.set(CAM_RIGS[0].x, CAM_RIGS[0].y, CAM_RIGS[0].z);
camera.add(cockpit);
let fighterProto: THREE.Group | null = null;
interface Wingman {
  holder: THREE.Group;
  lagX: number;      // 转向跟随延迟状态
  lagY: number;      // 俯仰跟随延迟状态
  lagF: number;      // 前后速度姿态滞后(WASD 抬头/压头)
  lagS: number;      // 侧向速度姿态滞后(WASD 压坡)
  k: number;         // 跟随快慢(不同 = 错开)
  phase: number;     // 悬浮/火焰相位
  base: { x: number; y: number; z: number };
  fireMats: THREE.MeshStandardMaterial[];
  nozzleMats: THREE.SpriteMaterial[];
  fireWraps: THREE.Group[];
}
const wingmen: Wingman[] = [];
// 不对称编队:左僚机近而低,右僚机远而高
const WING_DEF = [
  { x: -11.5, y: -9.8, z: -40, k: 3.2, phase: 1.7, scale: 0.62 },
  { x: 10.5, y: -7.6, z: -42.5, k: 1.1, phase: 4.4, scale: 0.55 },
];

/* 模型原样直出 + 原生动画(Sketchfab 演示的火焰抖动就是 glTF 自带的 Take 01):
   只隐藏激光;护盾暂藏(用户要求);火焰强弱只拧作者留的 opacity 旋钮 */
const fireMats: THREE.MeshStandardMaterial[] = [];
/* 喷口炽热金黄(官方 Final Render 里焰根的高温色) */
const nozzleMat = new THREE.SpriteMaterial({
  map: glowTexShared, color: 0xffd23e, transparent: true, opacity: 0.95,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const shipMixers: THREE.AnimationMixer[] = [];
const fireWraps: THREE.Group[] = [];
let fighterClip: THREE.AnimationClip | null = null;
/** A 方案(定稿):焰沿长轴渐隐——根部实,尖端透,刀片变光羽 */
function applyFlameFade(mat: THREE.MeshStandardMaterial, mesh: THREE.Mesh) {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox!;
  const size = bb.getSize(new THREE.Vector3());
  const axis: 'x' | 'y' | 'z' = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const tip = Math.abs(bb.max[axis]) >= Math.abs(bb.min[axis]) ? bb.max[axis] : bb.min[axis];
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosL;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float fadeT = clamp(vPosL.${axis} / float(${tip.toFixed(5)}), 0.0, 1.0);
  gl_FragColor.a *= (1.0 - smoothstep(0.15, 0.9, fadeT)) * 1.4;`);
  };
  mat.needsUpdate = true;
}

function prepFighter(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const name = (mat?.name || '').toLowerCase();
    if (name.includes('laser') || name.includes('shield')) m.visible = false;
    else if (!name.includes('fire') && m.isMesh) {
      // 白色涂装:贴图灰度化提亮成冷白,原暖色装甲块转译成克制的橙(参考图语言)
      const hull = mat.clone();
      hull.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  {
    float g = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float rb = diffuseColor.r - diffuseColor.b;
    // 线性空间标定:黄块 lum~0.2+/暗板 lum~0.06 —— 亮度门槛 0.09~0.15 精准分割
    float warmth = clamp(smoothstep(0.06, 0.14, rb) * smoothstep(0.09, 0.15, g) * 1.5, 0.0, 1.0);
    vec3 whiteHull = vec3(0.4, 0.41, 0.43) + sqrt(g) * vec3(1.28, 1.3, 1.34);
    vec3 accentOr = vec3(1.0, 0.36, 0.05) * (0.75 + g * 1.4);
    diffuseColor.rgb = mix(whiteHull, accentOr, warmth);
  }`);
      };
      hull.needsUpdate = true;
      m.material = hull;
    }
    if (name.includes('fire')) {
      // per-mesh 材质:渐隐参数随各自几何
      const fmat = mat.clone();
      fmat.emissive = (fmat.color as THREE.Color).clone();
      fmat.emissiveIntensity = 1.7; // 收敛:光晕小一号
      applyFlameFade(fmat, m);
      m.material = fmat;
      fireMats.push(fmat);
      // 喷口金黄:焰动画的伸缩固定端就是 mesh 原点 = 喷口位置
      m.geometry.computeBoundingBox();
      const bs = m.geometry.boundingBox!.getSize(new THREE.Vector3());
      const dims = [bs.x, bs.y, bs.z].sort((a, b) => a - b);
      const sp = new THREE.Sprite(nozzleMat);
      sp.position.copy(m.position);
      sp.scale.setScalar(dims[1] * 1.35);
      m.parent?.add(sp);
      // 缩放壳:锚点在喷口,油门控制焰整体大小(动画在壳内照常抖动)
      const wrap = new THREE.Group();
      wrap.position.copy(m.position);
      const parent = m.parent!;
      m.position.set(0, 0, 0);
      parent.add(wrap);
      wrap.add(m);
      fireWraps.push(wrap);
    }
  });
}
function playShipAnim(root: THREE.Object3D) {
  if (!fighterClip) return;
  const mx = new THREE.AnimationMixer(root);
  mx.clipAction(fighterClip).play();
  shipMixers.push(mx);
}

new GLTFLoader().load('/models/starfighter/scene.gltf', (g) => {
  const ship = g.scene;
  prepFighter(ship);
  fighterClip = g.animations[0] ?? null;
  playShipAnim(ship);
  // 包围盒归一化:护盾泡不计入(它比机身大数倍,只是特效),机身最长边 → 18.5
  ship.updateMatrixWorld(true);
  const box = new THREE.Box3();
  ship.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const nm = ((m.material as THREE.Material)?.name || '').toLowerCase();
    if (nm.includes('shield')) return;
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld));
  });
  const size = box.getSize(new THREE.Vector3());
  const norm = 18.5 / Math.max(size.x, size.y, size.z);
  ship.position.sub(box.getCenter(new THREE.Vector3()));
  const pivot = new THREE.Group();
  pivot.add(ship);
  pivot.scale.setScalar(norm);
  pivot.rotation.y = -Math.PI / 2; // 实测:模型机头在 -X 轴,转 -90° 后朝前(-Z)
  pivot.rotation.x = CAM_RIGS[rigIdx].rotX;
  cockpit.add(pivot);
  fighterProto = pivot;
  // 巡航僚机:侧后编队两架,共享材质(应援色同步换色)
  WING_DEF.forEach((def, i) => {
    const holder = new THREE.Group();
    const w = pivot.clone(true);
    w.scale.setScalar(norm * def.scale);
    holder.add(w);
    holder.position.set(def.x, def.y, def.z);
    camera.add(holder);
    // 独立火焰/喷口材质,让每架各烧各的
    const fm: THREE.MeshStandardMaterial[] = [];
    const nm: THREE.SpriteMaterial[] = [];
    const fw: THREE.Group[] = [];
    const cache = new Map<THREE.Material, THREE.Material>();
    w.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh && (mm.material as THREE.Material)?.name?.toLowerCase().includes('fire')) {
        let c = cache.get(mm.material as THREE.Material);
        if (!c) {
          c = (mm.material as THREE.MeshStandardMaterial).clone();
          applyFlameFade(c as THREE.MeshStandardMaterial, mm); // clone 不带 onBeforeCompile,补渐隐
          cache.set(mm.material as THREE.Material, c);
          fm.push(c as THREE.MeshStandardMaterial);
        }
        mm.material = c;
        if (mm.parent && !fw.includes(mm.parent as THREE.Group)) fw.push(mm.parent as THREE.Group); // 焰缩放壳(clone 自主机的 wrap)
      }
      const sp = o as THREE.Sprite;
      if ((sp as any).isSprite && sp.material === nozzleMat) {
        const c = nozzleMat.clone(); sp.material = c; nm.push(c);
      }
    });
    wingmen.push({ holder, lagX: 0, lagY: 0, lagF: 0, lagS: 0, k: def.k, phase: def.phase, base: { ...def }, fireMats: fm, nozzleMats: nm, fireWraps: fw });
    // 原生动画错相播放:两架不与主机同拍
    if (fighterClip) {
      const mx = new THREE.AnimationMixer(w);
      const act = mx.clipAction(fighterClip);
      act.play();
      act.time = (fighterClip.duration || 1) * (0.31 + i * 0.42);
      shipMixers.push(mx);
    }
  });
  if (COMPARE) {
    cockpit.visible = false;
    wingmen.forEach((wg) => (wg.holder.visible = false));
    buildCompare(pivot);
  }
}, undefined, () => console.warn('starfighter model fail'));

function applyRig(i: number) {
  rigIdx = ((i % CAM_RIGS.length) + CAM_RIGS.length) % CAM_RIGS.length;
  const r = CAM_RIGS[rigIdx];
  gsap.to(rigState, { x: r.x, y: r.y, duration: 1.05, ease: 'power2.inOut' });
  gsap.to(cockpit.position, { z: r.z, duration: 1.05, ease: 'power2.inOut' });
  if (fighterProto) gsap.to(fighterProto.rotation, { x: r.rotX, duration: 1.05, ease: 'power2.inOut' });
  say(`视角 · ${r.name}`);
}

/* ============ 火焰方案擂台(?compare=1):A 渐隐软化 / B 柔光羽流 / C GPU 粒子 ============ */
const cmpParticleMats: THREE.ShaderMaterial[] = [];
const cmpPlumes: { sp: THREE.Sprite; k: number; seed: number }[] = [];
let cmpT = 0;

const CMP_PARTICLE_VERT = `
  attribute vec4 aSeed;
  uniform float uTime, uRate, uLen, uSpread, uSize, uDir;
  varying float vLife;
  void main() {
    float life = fract(uTime * uRate + aSeed.x);
    vLife = life;
    vec3 p = vec3(life * uLen * uDir, 0.0, 0.0);
    float ang = aSeed.y * 6.2831 + life * (2.0 + aSeed.z * 3.5);
    float r = uSpread * life * (0.3 + aSeed.w * 0.7);
    p.y += cos(ang) * r;
    p.z += sin(ang) * r;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (1.0 - life * 0.55) * (150.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const CMP_PARTICLE_FRAG = `
  uniform sampler2D uMap; uniform float uOp;
  varying float vLife;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    vec3 hot = vec3(1.0, 0.88, 0.5);
    vec3 cool = vec3(1.0, 0.24, 0.05);
    vec3 col = mix(hot, cool, smoothstep(0.1, 0.72, vLife));
    float a = tex.a * pow(1.0 - vLife, 1.5) * uOp;
    gl_FragColor = vec4(col * 1.25, a);
  }`;

/** A:原网格焰 + 轴向渐隐(与正式版同源) */
function cmpFadeFlame(fires: THREE.Mesh[]) {
  for (const f of fires) {
    const mat = (f.material as THREE.MeshStandardMaterial).clone();
    applyFlameFade(mat, f);
    f.material = mat;
    fireMats.push(mat);
  }
}

/** B:多层柔光羽流(网格焰隐藏,5 层递减 sprite) */
function cmpPlume(wrap: THREE.Group, L: number, dir: number, seed: number) {
  for (let k = 0; k < 5; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexShared, color: k < 2 ? 0xffe08a : 0xff7a30,
      transparent: true, opacity: 0.5 * (1 - k * 0.15),
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sp.position.set(dir * L * (0.12 + k * 0.2), 0, 0);
    sp.scale.setScalar(L * (0.4 - k * 0.055));
    wrap.add(sp);
    cmpPlumes.push({ sp, k, seed: seed + k * 1.7 });
  }
}

/** C:GPU 粒子火焰(喷射-湍流-变色-消散) */
function cmpParticles(wrap: THREE.Group, L: number, dir: number) {
  const N = 260;
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uRate: { value: 0.4 }, uLen: { value: L * 1.05 },
      uSpread: { value: L * 0.22 }, uSize: { value: L * 0.34 }, uDir: { value: dir },
      uOp: { value: 0.6 }, uMap: { value: glowTexShared },
    },
    vertexShader: CMP_PARTICLE_VERT, fragmentShader: CMP_PARTICLE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  wrap.add(pts);
  cmpParticleMats.push(mat);
}

function buildCompare(pivot: THREE.Group) {
  const defs = [
    { x: -33, label: 'A · 网格焰渐隐软化' },
    { x: 0, label: 'B · 多层柔光羽流' },
    { x: 33, label: 'C · GPU 粒子火焰' },
  ];
  defs.forEach((d, i) => {
    const c = pivot.clone(true);
    const holder = new THREE.Group();
    holder.add(c);
    holder.position.set(d.x, -6.5, -60);
    holder.rotation.y = 0.85; // 斜摆让尾焰侧向可见
    camera.add(holder);
    if (fighterClip) {
      const mx = new THREE.AnimationMixer(c);
      mx.clipAction(fighterClip).play();
      shipMixers.push(mx);
    }
    const fires: THREE.Mesh[] = [];
    const wraps: THREE.Group[] = [];
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material)?.name?.toLowerCase().includes('fire')) {
        fires.push(m);
        if (m.parent && !wraps.includes(m.parent as THREE.Group)) wraps.push(m.parent as THREE.Group);
      }
    });
    // 焰几何:长轴/长度/尖端方向
    let L = 10, dir = 1;
    let axis: 'x' | 'y' | 'z' = 'x';
    let tip = 10;
    if (fires.length) {
      fires[0].geometry.computeBoundingBox();
      const bb = fires[0].geometry.boundingBox!;
      const size = bb.getSize(new THREE.Vector3());
      axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
      L = size[axis];
      tip = Math.abs(bb.max[axis]) >= Math.abs(bb.min[axis]) ? bb.max[axis] : bb.min[axis];
      dir = tip >= 0 ? 1 : -1;
    }
    for (const w of wraps) fireWraps.push(w); // 三档焰长全局接管
    if (i === 0) cmpFadeFlame(fires);
    else {
      fires.forEach((f) => (f.visible = false));
      if (i === 1) wraps.forEach((w, wi) => cmpPlume(w, L, dir, i * 3 + wi * 1.3));
      else wraps.forEach((w) => cmpParticles(w, L, dir));
    }
  });
  const el2 = document.createElement('div');
  el2.innerHTML = defs.map((d, i) =>
    `<span style="position:fixed;bottom:16%;left:${18 + i * 32}%;transform:translateX(-50%);z-index:55;font-family:var(--mono);font-size:11px;letter-spacing:.18em;color:var(--acc);background:rgba(4,6,10,.68);padding:6px 12px;border:1px solid color-mix(in srgb,var(--acc) 55%,transparent)">${d.label}</span>`
  ).join('');
  document.body.appendChild(el2);
}

const dockGroup = new THREE.Group();
dockGroup.position.set(-12, -8.8, -31);
dockGroup.rotation.set(0.85, 0.32, -0.12);
dockGroup.scale.setScalar(0.82);
const dockLamp = new THREE.PointLight(0xfff4e2, 900, 160, 1.9);
dockLamp.position.set(9, 26, 22);
dockGroup.add(dockLamp);
camera.add(dockGroup);
scene.add(camera);
let dockVinyl: Vinyl | null = null;

function landOnVinyl(v: Vinyl) {
  if (MODE !== 'orbit' || !focus) return;
  const p = focus;
  setMode('landing');
  say(`着陆点锁定:<b>${v.node.name}</b> · 穿越星云核心`);
  ensureTrack(v);

  // 着陆相机位:从星系中心指向唱片轨道位的方向,落在表面上空
  const vWorld = v.group.getWorldPosition(tmpV.clone());
  const n = tmpV2.subVectors(vWorld, p.root.position).normalize();
  const surf = p.root.position.clone().addScaledVector(n, p.r * 1.22);
  // 视线压向地平线:切向
  const tangent = tmpV3.crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
  if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
  const look = surf.clone().addScaledVector(tangent, p.r * 1.3).addScaledVector(n, -p.r * 0.42);

  audio.entryNoise(2.1);
  // 星云穿越过场
  gsap.to(el.entry, { opacity: 0.55, duration: 1.15, ease: 'power2.in', delay: 0.5 });
  gsap.to(el.entry, { opacity: 0, duration: 0.8, ease: 'power2.out', delay: 2.05 });
  gsap.to(camera, { fov: 74, duration: 1.4, ease: 'power2.in', onUpdate: () => camera.updateProjectionMatrix() });
  gsap.to(camera, { fov: 58, duration: 1.0, ease: 'power2.out', delay: 1.7, onUpdate: () => camera.updateProjectionMatrix() });
  shake = 0.001;
  gsap.to(win, { shakeTo: 1, duration: 1.4, ease: 'power2.in', onUpdate: () => (shake = win.shakeTo * 0.8) });
  gsap.to(win, { shakeTo: 0, duration: 0.7, ease: 'power3.out', delay: 1.9, onUpdate: () => (shake = win.shakeTo * 0.8) });

  resetView(1.2);
  flyBezier({
    to: surf, look, dur: 2.8, ease: 'power3.in', roll: 0.42, lift: -0.06,
    onDone: () => {
      setMode('surface');
      initDrive();
      dockThe(v);
      playVinyl(v);
    },
  });
}

const win = { shakeTo: 0 };
let shake = 0;

function dockThe(v: Vinyl) {
  // 轨道上的本体隐藏,舱内摆一张同款唱片
  v.group.visible = false;
  if (dockVinyl) { dockGroup.remove(dockVinyl.group); dockVinyl = null; }
  const d = makeVinyl(v.node, focus!.a.css, focus!.a.color);
  d.info = v.info;
  const cached = trackCache.get(v.node.id);
  if (cached?.tex) { d.labelMat.map = cached.tex; d.labelMat.needsUpdate = true; }
  d.coverState = v.coverState;
  d.glow.material.opacity = 0.34;
  dockGroup.add(d.group);
  d.group.scale.setScalar(0.001);
  gsap.to(d.group.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.8)', delay: 0.15 });
  dockVinyl = d;
  dockedVinyl = v;
}
function undock() {
  if (dockVinyl) {
    const d = dockVinyl;
    gsap.to(d.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.4, ease: 'power2.in', onComplete: () => dockGroup.remove(d.group) });
    dockVinyl = null;
  }
  if (dockedVinyl) { dockedVinyl.group.visible = true; dockedVinyl = null; }
}

async function playVinyl(v: Vinyl) {
  el.np.classList.add('show');
  el.np.classList.remove('paused');
  el.npTitle.textContent = v.node.name;
  el.npMeta.textContent = `${focus?.a.name ?? ''} · ${v.node.mood} · ${v.node.bpm} BPM`;
  el.npCover.removeAttribute('src');
  if (v.coverState !== 2) await ensureTrack(v);
  if (v.info?.artworkUrlSmall) el.npCover.src = v.info.artworkUrlSmall;
  const isNew = collect(v.node.id);
  updateLogHud(focus);
  if (isNew) toast(`图鉴 +1 · ${v.node.name}`);
  if (v.info?.previewUrl) {
    audio.play(v.info.previewUrl);
    say(`落地 · 正在播放 <b>${v.node.name}</b>`);
  } else {
    say(`落地 · <b>${v.node.name}</b> 无试听源,静赏地貌`);
  }
}

function takeoffToOrbit() {
  if (MODE !== 'surface' || !focus) return;
  const p = focus;
  drive.manual = false;
  setMode('takeoff');
  say('起飞 · 返回轨道');
  audio.stop();
  el.np.classList.remove('show');
  undock();
  const dist = p.r * 3.6;
  const to = tmpV.copy(p.root.position).add(tmpV2.set(Math.cos(orbitAng) * dist, p.r * 0.95, Math.sin(orbitAng) * dist));
  gsap.to(camera, { fov: 58, duration: 0.6, onUpdate: () => camera.updateProjectionMatrix() });
  flyBezier({
    to, look: p.root.position, dur: 2.4, ease: 'power2.out', warp: 0.22,
    onDone: () => { setMode('orbit'); initDrive(); say('已回到轨道 · 挑下一张唱片'); },
  });
}

function nextLanding() {
  if (MODE !== 'surface' || !focus || !dockedVinyl) return;
  const p = focus;
  const i = p.vinyls.indexOf(dockedVinyl);
  const nv = p.vinyls[(i + 1) % p.vinyls.length];
  audio.stop();
  undock();
  setMode('landing');
  say(`转场 · 下一着陆点:<b>${nv.node.name}</b>`);
  const vWorld = nv.group.getWorldPosition(tmpV.clone());
  const n = tmpV2.subVectors(vWorld, p.root.position).normalize();
  const surf = p.root.position.clone().addScaledVector(n, p.r * 1.22);
  const tangent = tmpV3.crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
  if (tangent.lengthSq() < 0.01) tangent.set(1, 0, 0);
  const look = surf.clone().addScaledVector(tangent, p.r * 1.3).addScaledVector(n, -p.r * 0.42);
  gsap.to(el.entry, { opacity: 0.5, duration: 0.7, ease: 'power2.in', delay: 0.2 });
  gsap.to(el.entry, { opacity: 0, duration: 0.6, ease: 'power2.out', delay: 1.15 });
  flyBezier({
    to: surf, look, dur: 1.9, ease: 'power2.inOut', roll: 0.3,
    onDone: () => { setMode('surface'); initDrive(); dockThe(nv); playVinyl(nv); },
  });
}
audio.el.addEventListener('ended', () => { if (MODE === 'surface') nextLanding(); });

/* ============ 拾取 ============ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(9, 9);
let mouseMoved = false;
let hoverPlanet: Planet | null = null;
let hoverVinyl: Vinyl | null = null;

function pick() {
  if (!mouseMoved) return;
  mouseMoved = false;
  raycaster.setFromCamera(mouse, camera);
  if (MODE === 'cruise') {
    const hits = raycaster.intersectObjects(pickPlanets, false);
    hoverPlanet = hits.length ? planets[hits[0].object.userData.planetIdx] : null;
    document.body.style.cursor = hoverPlanet ? 'pointer' : 'default';
  } else if ((MODE === 'orbit' || MODE === 'surface') && focus) {
    // 唱片优先(orbit);没中再测其他星系(跃迁目标)
    hoverVinyl = null;
    hoverPlanet = null;
    if (MODE === 'orbit') {
      const songTargets = focus.vinyls.flatMap((v) => [v.disc, v.hit]);
      const hits = raycaster.intersectObjects(songTargets, false);
      hoverVinyl = hits.length ? ((hits[0].object as any).__vinyl as Vinyl) : null;
    }
    if (!hoverVinyl) {
      const ph = raycaster.intersectObjects(pickPlanets.filter((m) => m !== focus!.pickMesh), false);
      hoverPlanet = ph.length ? planets[ph[0].object.userData.planetIdx] : null;
    }
    document.body.style.cursor = hoverVinyl || hoverPlanet ? 'pointer' : 'default';
    if (hoverVinyl) ensureTrack(hoverVinyl);
  } else {
    document.body.style.cursor = 'default';
  }
}

addEventListener('click', (e) => {
  // 拖拽环视松手不算点击
  if (view.moved) { view.moved = false; return; }
  if ((e.target as HTMLElement).closest('.np')) { audio.toggle(); el.np.classList.toggle('paused', !audio.playing); return; }
  if (hoverVinyl && MODE === 'orbit') landOnVinyl(hoverVinyl);
  else if (hoverPlanet) hyperjumpTo(hoverPlanet);
});
addEventListener('dblclick', () => resetView(0.7)); // 双击回正视线
addEventListener('wheel', () => { /* 已移除模式切换,全程 WASD/鼠标控制 */ }, { passive: true });
const WASD = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
addEventListener('keydown', (e) => {
  drive.boost = e.shiftKey;
  if (WASD.includes(e.code)) {
    if (COMPARE) { drive.keys.add(e.code); return; }
    if (flight) return;
    drive.keys.add(e.code);
    if (MODE === 'surface' && dockVinyl) undock();
    if (!drive.manual) enterManual();
    return;
  }
  if (e.code === 'Escape') {
    if (MODE === 'surface') takeoffToOrbit();
    else if (MODE === 'orbit') returnToCruise();
  }
  else if (e.code === 'KeyM') { audio.setMuted(!audio.muted); say(audio.muted ? '已静音' : '声音恢复'); }
  else if (e.code === 'KeyP' || e.code === 'Space') { e.preventDefault(); audio.toggle(); el.np.classList.toggle('paused', !audio.playing); }
  else if (e.code === 'KeyN') nextLanding();
  else if (e.code === 'KeyV') applyRig(rigIdx + 1);
  else if (e.code === 'KeyC') { if (MODE === 'cruise' && drive.manual) exitManual(); }
});
addEventListener('keyup', (e) => {
  drive.boost = e.shiftKey;
  drive.keys.delete(e.code);
});

/* ============ 雷达 ============ */
const radar = $('radar') as HTMLCanvasElement;
const rctx = radar.getContext('2d')!;
function drawRadar(t: number) {
  const S = 296, C = S / 2, R = C - 10;
  rctx.clearRect(0, 0, S, S);
  rctx.strokeStyle = 'rgba(236,242,250,0.22)';
  rctx.lineWidth = 1;
  for (const rr of [R, R * 0.62, R * 0.3]) { rctx.beginPath(); rctx.arc(C, C, rr, 0, Math.PI * 2); rctx.stroke(); }
  rctx.beginPath(); rctx.moveTo(C - R, C); rctx.lineTo(C + R, C); rctx.moveTo(C, C - R); rctx.lineTo(C, C + R);
  rctx.strokeStyle = 'rgba(236,242,250,0.1)'; rctx.stroke();

  const fwd = camera.getWorldDirection(tmpV);
  const head = Math.atan2(fwd.x, fwd.z);
  // 扫描线
  const sw = t * 1.4;
  const grd = rctx.createConicGradient ? rctx.createConicGradient(sw, C, C) : null;
  if (grd) {
    grd.addColorStop(0, 'rgba(255,180,107,0.3)');
    grd.addColorStop(0.12, 'rgba(255,180,107,0)');
    grd.addColorStop(1, 'rgba(255,180,107,0)');
    rctx.fillStyle = grd; rctx.beginPath(); rctx.arc(C, C, R, 0, Math.PI * 2); rctx.fill();
  }
  for (const p of planets) {
    tmpV2.subVectors(p.root.position, camera.position);
    const d = Math.hypot(tmpV2.x, tmpV2.z);
    const a = Math.atan2(tmpV2.x, tmpV2.z) - head;
    const rr = Math.min(1, Math.log1p(d / 260) / Math.log1p(22)) * R;
    const x = C + Math.sin(a) * rr, y = C - Math.cos(a) * rr;
    rctx.beginPath();
    rctx.fillStyle = p.a.css;
    const isFocus = p === focus || p === hoverPlanet;
    rctx.globalAlpha = isFocus ? 1 : 0.75;
    rctx.arc(x, y, isFocus ? 5 : 3, 0, Math.PI * 2);
    rctx.fill();
    if (isFocus) {
      rctx.strokeStyle = p.a.css; rctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
      rctx.beginPath(); rctx.arc(x, y, 9, 0, Math.PI * 2); rctx.stroke();
    }
    rctx.globalAlpha = 1;
  }
  // 本舰
  rctx.fillStyle = '#ecf2fa';
  rctx.beginPath(); rctx.moveTo(C, C - 6); rctx.lineTo(C + 4.4, C + 5); rctx.lineTo(C - 4.4, C + 5); rctx.closePath(); rctx.fill();
}

/* ============ DOM 投影(锁定框/唱片标签) ============ */
function projectTo(elm: HTMLElement, world: THREE.Vector3, ox: number, oy: number): boolean {
  tmpV.copy(world).project(camera);
  if (tmpV.z > 1) return false;
  const x = (tmpV.x * 0.5 + 0.5) * innerWidth + ox;
  const y = (-tmpV.y * 0.5 + 0.5) * innerHeight + oy;
  elm.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  return true;
}

/* ============ 主循环 ============ */
const clock = new THREE.Clock();
let elapsed = 0;

/* rAF 看门狗:隐藏标签页(后台/自动化驱动)rAF 不派发,退回 setTimeout,
   gsap 本就由 tick 手动驱动,所以动画在后台照常推进;
   后台 timer 会被节流到 ~1fps,必须同时关掉 lagSmoothing,
   否则 gsap 每帧只肯推进 33ms,动画慢 30 倍 */
function scheduleTick() {
  if (document.visibilityState === 'hidden') setTimeout(tick, 33);
  else requestAnimationFrame(tick);
}
const syncLagSmoothing = () =>
  gsap.ticker.lagSmoothing(document.visibilityState === 'hidden' ? 0 : 500, 33);
document.addEventListener('visibilitychange', syncLagSmoothing);
syncLagSmoothing();

function tick() {
  scheduleTick();
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const t = elapsed;
  gsap.updateRoot(perfNow() / 1000);
  audio.tick(dt);
  const { bass, high } = audio.bands;

  steer.x += (steer.tx - steer.x) * (1 - Math.exp(-dt * 4.2));
  steer.y += (steer.ty - steer.y) * (1 - Math.exp(-dt * 4.2));

  // ---- 相机按模式 ----
  if (flight) {
    flight.curve.getPoint(flight.t, camera.position);
    if (flight.mode === 'launch') {
      // 尾段回钩裁剪:进入到达球后平滑混合到停机位
      if (flight.t > flight.tCrop) {
        const k = THREE.MathUtils.smoothstep((flight.t - flight.tCrop) / (1 - flight.tCrop), 0, 1);
        camera.position.lerp(flight.end, k);
      }
      // 视线解耦:注视点按指数每帧甩向目标,与路径进度无关
      camLook.lerp(flight.look1, 1 - Math.pow(0.937, dt * 60));
      lookWithView(camLook);
      // 压杆前置:起飞猛压坡度,漫长回正(峰值 ~t=0.28)
      camera.rotateZ(flight.roll * Math.sin(Math.PI * Math.pow(flight.t, 0.55)));
    } else {
      tmpV.lerpVectors(flight.look0, flight.look1, THREE.MathUtils.smoothstep(flight.t, 0, 1));
      camLook.copy(tmpV);
      lookWithView(camLook);
      camera.rotateZ(flight.roll * Math.sin(flight.t * Math.PI));
    }
  } else if (drive.manual) {
    // ---- WASD 自由驾驶:任何模式都可用 ----
    if (view.yaw !== 0 || view.pitch !== 0) {
      drive.fwd.applyAxisAngle(VIEW_UP, view.yaw);
      lwRight.crossVectors(drive.fwd, VIEW_UP);
      if (lwRight.lengthSq() > 0.001) drive.fwd.applyAxisAngle(lwRight.normalize(), view.pitch);
      drive.fwd.normalize();
      view.yaw = 0; view.pitch = 0; // 增量已消费进航向
    }
    lwRight.crossVectors(drive.fwd, VIEW_UP).normalize();
    // 灵敏操舵:大推力 0.3s 内贴极速;按键时低阻尼,松手时高阻尼快停
    const thrusting = ['KeyW', 'KeyS', 'KeyA', 'KeyD'].some((k) => drive.keys.has(k));
    const accel = drive.boost ? 5600 : 2800;
    if (drive.keys.has('KeyW')) drive.vel.addScaledVector(drive.fwd, accel * dt);
    if (drive.keys.has('KeyS')) drive.vel.addScaledVector(drive.fwd, -accel * 0.75 * dt);
    if (drive.keys.has('KeyA')) drive.vel.addScaledVector(lwRight, -accel * 0.85 * dt);
    if (drive.keys.has('KeyD')) drive.vel.addScaledVector(lwRight, accel * 0.85 * dt);
    const vmax = drive.boost ? 1900 : 860;
    const spd = drive.vel.length();
    if (spd > vmax) drive.vel.setLength(spd + (vmax - spd) * (1 - Math.exp(-dt * 2.2)));
    drive.vel.multiplyScalar(Math.exp(-dt * (thrusting ? 0.45 : 3.2)));
    camera.position.addScaledVector(drive.vel, dt);
    // 星域边界:软推回
    const distC = camera.position.length();
    if (distC > 7200) {
      tmpV.copy(camera.position).normalize();
      drive.vel.addScaledVector(tmpV, -(distC - 7200) * dt * 3);
      if (distC > 7600) say('星域边缘 · 建议调头');
    }
    camLook.copy(camera.position).addScaledVector(drive.fwd, 200);
    camera.lookAt(camLook);
  } else if (MODE === 'cruise') {
    cruiseTheta += dt * 0.0125;
    cruisePos(cruiseTheta, camera.position);
    cruisePos(cruiseTheta + 0.55, tmpV).multiplyScalar(0.32);
    tmpV.x += steer.x * 520; tmpV.y += 60 - steer.y * 380;
    camLook.lerp(tmpV, 1 - Math.exp(-dt * 2.2));
    lookWithView(camLook);
  } else if (MODE === 'orbit' && focus) {
    orbitAng += dt * 0.1;
    const p = focus, dist = p.r * 3.6;
    tmpV.set(
      p.root.position.x + Math.cos(orbitAng) * dist,
      p.root.position.y + p.r * 0.95,
      p.root.position.z + Math.sin(orbitAng) * dist
    );
    camera.position.lerp(tmpV, 1 - Math.exp(-dt * 2.6));
    tmpV2.copy(p.root.position);
    tmpV2.x += steer.x * p.r * 0.9; tmpV2.y += -steer.y * p.r * 0.7;
    camLook.lerp(tmpV2, 1 - Math.exp(-dt * 3));
    lookWithView(camLook);
  } else if (MODE === 'surface' && focus) {
    // 缓慢环绕地表低空 + 呼吸浮动(基数 1.22 = 落地高度)
    const p = focus;
    tmpV.copy(camera.position).sub(p.root.position).normalize();
    const bob = 1.22 + Math.sin(t * 0.8) * 0.012 + bass * 0.016;
    camera.position.copy(p.root.position).addScaledVector(tmpV, p.r * bob);
    tmpV2.copy(camLook);
    tmpV2.x += steer.x * p.r * 0.24; tmpV2.y += -steer.y * p.r * 0.2;
    lookWithView(tmpV2);
  }
  if (shake > 0.0005) {
    camera.position.x += (Math.random() - 0.5) * shake * 6;
    camera.position.y += (Math.random() - 0.5) * shake * 6;
    camera.rotateZ((Math.random() - 0.5) * shake * 0.02);
  }

  // ---- 粒子星系：固定世界朝向，只保留稳定、缓慢的模型自转 ----
  for (const p of planets) {
    p.galaxy.rotateY(dt * p.spin);
  }

  // ---- 唱片轨道 ----
  if (focus?.vinylRoot) {
    for (const v of focus.vinyls) {
      const ang = v.phase + t * v.orbSpeed;
      tmpV.set(Math.cos(ang) * v.orbR, 0, Math.sin(ang) * v.orbR).applyEuler(v.incl);
      v.group.position.copy(tmpV);
      v.group.rotation.y += dt * 1.6;
      v.group.rotation.z = Math.sin(t * 0.7 + v.phase) * 0.12;
      const isHover = v === hoverVinyl;
      const s = v.base * (isHover ? 1.38 : 1);
      v.group.scale.lerp(tmpV2.setScalar(s), 1 - Math.exp(-dt * 9));
      (v.glow.material as THREE.SpriteMaterial).opacity = isHover ? 0.38 : 0.08;
    }
  }
  if (dockVinyl) {
    dockVinyl.group.rotation.y += dt * (audio.playing && !audio.el.paused ? 3.5 : 0.25);
    (dockVinyl.glow.material as THREE.SpriteMaterial).opacity = 0.25 + bass * 0.4;
  }

  // ---- 布光跟随(地表时改为前上方俯打,照亮脚下地貌) ----
  camera.getWorldDirection(tmpV);
  tmpV2.crossVectors(tmpV, camera.up).normalize(); // 相机右
  if (MODE === 'surface' || MODE === 'landing') {
    keyLight.position.copy(camera.position).addScaledVector(tmpV, 240).addScaledVector(camera.up, 520);
    keyLight.target.position.copy(camera.position).addScaledVector(tmpV, 300).addScaledVector(camera.up, -160);
  } else {
    // 侧光:照亮巡航中的主机和僚机
    keyLight.position.copy(camera.position).addScaledVector(tmpV2, 1050).addScaledVector(camera.up, 340).addScaledVector(tmpV, 300);
    keyLight.target.position.copy(camera.position).addScaledVector(tmpV, 800);
  }

  // ---- 火焰三档:静止/漫游 弱 · WASD 中 · Shift/点星系飞行 全力 ----
  const wasdActive = (COMPARE || (drive.manual && MODE === 'cruise')) &&
    ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => drive.keys.has(k));
  const fullBurn = !!flight || (wasdActive && drive.boost);
  let tSize: number, tSpeed: number, tOp: number;
  if (fullBurn) { tSize = 1; tSpeed = 1.25; tOp = 0.78; }
  else if (wasdActive) { tSize = 0.78; tSpeed = 0.72; tOp = 0.52; }
  else { tSize = 0.2; tSpeed = 0.2; tOp = 0.18; }
  const k6 = 1 - Math.exp(-dt * 5);
  for (const w of fireWraps) w.scale.setScalar(w.scale.x + (tSize - w.scale.x) * k6);
  for (const mx of shipMixers) { mx.timeScale += (tSpeed - mx.timeScale) * k6; mx.update(dt); }
  for (const fm of fireMats) fm.opacity += (tOp - fm.opacity) * k6;
  nozzleMat.opacity = 0.34 + (tOp - 0.18) * 1.25; // 金黄更浓

  // ---- 火焰擂台驱动 ----
  if (COMPARE) {
    cmpT += dt;
    for (const pm of cmpParticleMats) {
      pm.uniforms.uTime.value = cmpT;
      pm.uniforms.uRate.value = 0.2 + tSize * 0.95;
      pm.uniforms.uOp.value = 0.22 + tOp * 0.85;
    }
    for (const pl of cmpPlumes) {
      pl.sp.position.y = Math.sin(cmpT * (1.2 + pl.k * 0.35) + pl.seed) * 0.5 * pl.k;
      pl.sp.position.z = Math.cos(cmpT * 1.05 + pl.seed * 1.4) * 0.35 * pl.k;
      (pl.sp.material as THREE.SpriteMaterial).opacity = (0.5 * (1 - pl.k * 0.15)) * (0.35 + tOp);
    }
  }

  // ---- 座舱姿态:侧倾/俯仰/悬浮,给「在开」的身体感 ----
  // 姿态由油门输入直接建模:按键=推力姿态;松 Shift 只是推力变小(角度缓落,无低头);
  // 完全松手才有阻尼减速的低头
  let aF = 0, aS = 0;
  if (drive.manual && MODE === 'cruise') {
    const accIn = drive.boost ? 5600 : 2800;
    const vcap = drive.boost ? 1900 : 860;
    // 推力余量:起步满抬头;过 88% 极速余量截止归零 → 回落一步到底,无残留小角度
    const hr0 = Math.max(0, Math.min(1, (1 - drive.vel.length() / vcap - 0.12) / 0.88));
    const headroom = hr0 * hr0 * (3 - 2 * hr0);
    if (drive.keys.has('KeyW')) aF += accIn * headroom;
    if (drive.keys.has('KeyS')) aF -= accIn * 0.75 * headroom;
    if (drive.keys.has('KeyD')) aS += accIn * 0.85 * headroom;
    if (drive.keys.has('KeyA')) aS -= accIn * 0.85 * headroom;
    if (aF === 0 && aS === 0) {
      // 完全松手:只留轻微惯性点头,主体交给缓释回正
      aF = -drive.vel.dot(drive.fwd) * 0.9;
      tmpL.crossVectors(drive.fwd, VIEW_UP).normalize();
      aS = -drive.vel.dot(tmpL) * 0.9;
    }
  }
  // 弹簧-阻尼追踪目标角:上仰-过顶-回落一条连续弹性曲线,无速率切换拐点
  const pitchTgtRaw = aF * 0.000116;
  const rollTgtRaw = aS * 0.00013;
  // 目标缓释:同向加深即时;回落/换向按 τ=1.4s 慢放(全程约 4s)
  const pF = pitchTgtRaw * pitchTgtSm >= 0 && Math.abs(pitchTgtRaw) > Math.abs(pitchTgtSm) ? 99 : 0.7;
  const pS = rollTgtRaw * rollTgtSm >= 0 && Math.abs(rollTgtRaw) > Math.abs(rollTgtSm) ? 99 : 0.7;
  pitchTgtSm += (pitchTgtRaw - pitchTgtSm) * (1 - Math.exp(-dt * pF));
  rollTgtSm += (rollTgtRaw - rollTgtSm) * (1 - Math.exp(-dt * pS));
  pitchVel += (pitchTgtSm - pitchCur) * 26 * dt;
  pitchVel *= Math.exp(-dt * 7.5);
  pitchCur += pitchVel * dt;
  rollVel += (rollTgtSm - rollCur) * 26 * dt;
  rollVel *= Math.exp(-dt * 7.5);
  rollCur += rollVel * dt;
  cockpit.rotation.z = -steer.x * 0.24 - rollCur;
  cockpit.rotation.x = 0.015 + steer.y * 0.05 + warpU.uWarp.value * 0.12 + pitchCur;
  cockpit.position.x = rigState.x + steer.x * 1.1;
  cockpit.position.y = rigState.y + Math.sin(t * 1.35) * 0.18 + bass * 0.14;
  // 僚机编队:各自的跟随延迟/漂移节律/火焰节拍 —— mini 战队感
  wingmen.forEach((wg, i) => {
    wg.lagX += (steer.x - wg.lagX) * (1 - Math.exp(-dt * wg.k));
    wg.lagY += (steer.y - wg.lagY) * (1 - Math.exp(-dt * wg.k * 0.85));
    wg.lagF += (pitchCur - wg.lagF) * (1 - Math.exp(-dt * wg.k * 0.9));
    wg.lagS += (rollCur - wg.lagS) * (1 - Math.exp(-dt * wg.k * 0.9));
    const h = wg.holder;
    const ph = wg.phase;
    h.position.x = wg.base.x + Math.sin(t * 0.31 + ph) * 1.1 + wg.lagX * (1.8 + i * 1.2) - warpU.uWarp.value * (i ? 4 : 2.5);
    h.position.y = wg.base.y + Math.sin(t * (0.79 + i * 0.33) + ph * 2.1) * 0.8 + wg.lagY * (0.6 + i * 0.5);
    h.position.z = wg.base.z + Math.cos(t * 0.22 + ph) * 1.5;
    // 侧倾/俯仰:steer + WASD 速度姿态都参与,时间常数不同 = 一先一后
    h.rotation.z = -wg.lagX * (0.3 + i * 0.12) - wg.lagS * (0.8 + i * 0.15) + Math.sin(t * 0.5 + ph) * 0.035;
    h.rotation.x = Math.sin(t * 0.42 + ph * 1.3) * 0.028 + wg.lagY * (0.06 + i * 0.03) + wg.lagF * (0.85 + i * 0.15);
    const wop = tOp * (0.82 + 0.34 * Math.sin(t * (0.9 + i * 0.41) + ph * 3));
    for (const fm of wg.fireMats) fm.opacity += (wop - fm.opacity) * k6;
    for (const nmm of wg.nozzleMats) nmm.opacity = 0.16 + wop * 0.85;
    // 僚机焰 = 主机档位 × 0.55:视觉上永远比主机小一号
    const wSize = tSize * 0.55;
    for (const fwp of wg.fireWraps) fwp.scale.setScalar(fwp.scale.x + (wSize - fwp.scale.x) * k6);
  });

  // ---- 天幕/太阳 ----
  skyMesh.rotation.y = t * 0.0032;
  starU.uTime.value = t;
  starU.uHigh.value += (high - starU.uHigh.value) * (1 - Math.exp(-dt * 6));

  // ---- HUD ----
  pick();
  if ((MODE === 'cruise' || MODE === 'orbit') && hoverPlanet) {
    el.retName.textContent = hoverPlanet.a.name;
    el.retSub.textContent = `${hoverPlanet.a.songs.length} 首 · ${MODE === 'orbit' ? '点击直航' : '点击入轨'}`;
    const ok = projectTo(el.reticle, hoverPlanet.root.position, 26, -20);
    el.reticle.classList.toggle('show', ok);
    if (MODE === 'cruise') setAccent(hoverPlanet.a.css); // orbit 中保持焦点星应援色,不闪色
  } else if (MODE === 'cruise' || MODE === 'orbit') {
    el.reticle.classList.remove('show');
    if (MODE === 'cruise' && !focus) setAccent('#ffb46b');
  }
  if (MODE === 'orbit' && hoverVinyl) {
    el.vtName.textContent = hoverVinyl.node.name;
    const ok = projectTo(el.vinylTag, hoverVinyl.group.getWorldPosition(tmpV3), 18, -14);
    el.vinylTag.classList.toggle('show', ok);
  } else {
    el.vinylTag.classList.remove('show');
  }
  if (audio.el.duration > 0 && audio.el.src) {
    (el.npBar as HTMLElement).style.width = `${(audio.el.currentTime / audio.el.duration) * 100}%`;
  }
  drawRadar(t);

  // ---- 后期强度 ----
  bloom.strength = 0.7 + bass * 0.45 + warpU.uWarp.value * 0.7;
  rgbPass.uniforms['amount'].value = 0.0009 + warpU.uWarp.value * 0.004 + bass * 0.0006;
  warpU.uTime.value = t;

  composer.render();
  if (warpU.uWarp.value > 0.012) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(warpScene, warpCam);
    renderer.autoClear = true;
  }
}

/* ============ 点火 ============ */
el.ignite.addEventListener('click', () => {
  audio.unlock();
  el.ignite.classList.add('off');
  setMode('cruise');
  say('引擎点火 · 舰载 AI 上线');
  setTimeout(() => say(`长程雷达就绪 · 扫描到 <b>${ARTISTS.length}</b> 座歌手星系`), 1400);
  setTimeout(() => say('午夜频段清澈 · 挑一颗顺眼的,点它'), 3200);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  warpU.uRes.value.set(innerWidth, innerHeight);
});

setMode('idle');
tick();
if (COMPARE) setTimeout(() => el.ignite.click(), 900);

/* ============ 调试句柄 ============ */
(window as any).__planetfall = {
  scene, camera, gsap, audio, planets, warpU,
  get mode() { return MODE; },
  get skyLoaded() { return skyLoaded; },
  goto: (i: number) => approachPlanet(planets[i]),
  jump: (i: number) => hyperjumpTo(planets[i]),
  land: (j: number) => { if (focus) landOnVinyl(focus.vinyls[j % focus.vinyls.length]); },
  back: () => (MODE === 'surface' ? takeoffToOrbit() : returnToCruise()),
};
