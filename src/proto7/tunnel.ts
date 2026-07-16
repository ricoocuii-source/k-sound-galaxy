/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 超空间隧道 —— 主世界里的实体传送管(THREE.Group,不是独立场景)。
 * 空间连续的进出场,零硬切:
 *  进场:预备俯冲时管口在飞行前方「浮现」(uFade 0→1) → 飞船真实飞进管口 →
 *       遮光筒渐暗包裹(外界隐去) → 趁全暗把整根管连相机瞬移到目标行星旁
 *  出场:减速 → 遮光渐薄+尽头黑盘打开——透过洞口直接看见目的地行星(同场景,
 *       洞是真的洞) → 冲出洞口(星粒环带从身边掠过) → 隧道在身后淡出消散
 * 体积构成(纯管壁流光,无管腔粒子):
 *  涡旋星云外壁 / 细密流线内壁 / 体积雾团 / 洞口星粒环带×2(入口+出口)
 * tunnelState.speed 统一调制流速——入闸慢速渐上满速、出闸收速减挡。
 */

import * as THREE from 'three';

export const tunnelGroup = new THREE.Group();
tunnelGroup.visible = false;

const HALF_LEN = 700;           // 管长 1400,局部 z ∈ [+150, -1250],相机朝 -z 穿行
const Z_OFFSET = -550;
const FAR_Z = -1250;
const NEAR_Z = 150;
const LOOP = HALF_LEN * 2;
export const TUNNEL_NEAR_Z = NEAR_Z;
export const TUNNEL_FAR_Z = FAR_Z;

export const tunnelU = {
  uTime: { value: 0 },
  uMix: { value: 0 },                                    // 0 蓝白星流 → 1 应援色
  uTint: { value: new THREE.Color(0.62, 0.78, 1.0) },
  uFade: { value: 0 },                                   // 隧道整体浮现/消散
};

/**
 * 隧道状态(main.ts 的跳跃时间线 tween):
 *  speed   0..1 流速:入闸慢速起步渐上满速,出闸前减速
 *  fade    0..1 整体浮现/消散(同步 uFade 与各 JS 材质)
 *  shroud  0..1 遮光筒不透明度:进管后渐暗隔绝外界,出闸前渐薄透出目的地
 *  mawOpen 0..1 尽头黑盘打开程度(1=洞全开,透过洞口看见行星)
 *  camZ    相机在管内的局部 z(由时间线推进:深入→穿行→冲出洞口)
 */
export const tunnelState = { speed: 0, fade: 0, shroud: 0, mawOpen: 0, camZ: NEAR_Z };

/* 共享染色片段:亮度当骨架,应援色当皮 */
const TINT_GLSL = /* glsl */ `
  vec3 applyTint(vec3 col, vec3 tint, float mixv) {
    float lum = dot(col, vec3(0.35, 0.45, 0.2));
    return mix(col, tint * lum * 2.3, mixv);
  }
`;

/* ---------------- 遮光筒:进管后隔绝外界,出闸前透光 ---------------- */

const shroudMat = new THREE.MeshBasicMaterial({
  color: 0x010208, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false,
});
{
  const geo = new THREE.CylinderGeometry(215, 215, LOOP + 40, 48, 1, true);
  geo.rotateX(Math.PI / 2);
  const shroud = new THREE.Mesh(geo, shroudMat);
  shroud.position.z = Z_OFFSET;
  shroud.renderOrder = 2; // 先于隧道发光层,后于主世界透明物
  tunnelGroup.add(shroud);
}

/* ---------------- 涡旋星云外壁 + 细密流线内壁 ---------------- */

const WALL_VERT = /* glsl */ `
  varying float vDepth; varying float vAng;
  void main() {
    vDepth = (${HALF_LEN.toFixed(1)} - position.z) / ${LOOP.toFixed(1)};
    vAng = atan(position.y, position.x) / 6.28318530718 + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SWIRL_FRAG = /* glsl */ `
  uniform float uTime; uniform float uMix; uniform vec3 uTint; uniform float uFade;
  varying float vDepth; varying float vAng;
  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, amp = 0.55;
    for (int i = 0; i < 4; i++) { v += amp * vnoise(p); p *= 2.15; amp *= 0.5; }
    return v;
  }
  ${TINT_GLSL}
  void main() {
    float tw = vAng + vDepth * 1.9;
    vec2 q = vec2(tw * 4.0, vDepth * 7.0 + uTime * 0.62);
    float n = fbm(q);
    float n2 = fbm(q * 2.3 + vec2(17.0, uTime * 0.35));
    float arm = 0.0;
    for (int k = 0; k < 2; k++) {
      float band = fract(tw * 2.0 + vDepth * 1.2 + float(k) * 0.5);
      arm += smoothstep(0.42, 0.0, abs(band - 0.5)) * (0.55 + 0.45 * n);
    }
    vec3 col = vec3(0.08, 0.13, 0.34) * n * 0.7
             + vec3(0.3, 0.45, 0.95) * arm * (0.4 + 0.6 * n2)
             + vec3(0.85, 0.55, 1.0) * pow(arm * n2, 2.2) * 0.8;
    col = applyTint(col, uTint, uMix);
    col *= smoothstep(1.0, 0.42, vDepth) * (0.25 + 0.75 * smoothstep(0.0, 0.22, vDepth));
    gl_FragColor = vec4(col * 0.55 * uFade, 1.0);
  }
`;

const LANE_FRAG = /* glsl */ `
  uniform float uTime; uniform float uMix; uniform vec3 uTint; uniform float uFade;
  varying float vDepth; varying float vAng;
  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  ${TINT_GLSL}
  void main() {
    vec3 col = vec3(0.0);
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float lanes = 160.0 + fl * 120.0;
      float tw = vAng + vDepth * (1.3 - fl * 0.8);
      float lane = floor(tw * lanes);
      float h = hash(lane * 7.13 + fl * 517.7);
      float h2 = hash(lane * 3.71 + fl * 91.3);
      float on = step(0.55, hash(lane * 13.7 + fl * 77.7));
      float speed = (2.2 + h * 3.2) * (1.0 + fl * 0.4);
      float yy = fract(vDepth * (2.6 + fl * 1.6) + uTime * speed * 0.42 + h * 19.0);
      float len = 0.04 + h2 * 0.2;
      float body = smoothstep(len, 0.0, yy) * smoothstep(0.0, 0.01, yy);
      float across = smoothstep(0.5, 0.05, abs(fract(tw * lanes) - 0.5));
      vec3 base = h2 > 0.84
        ? mix(vec3(1.0, 0.55, 0.85), vec3(0.78, 0.5, 1.0), h)
        : mix(vec3(0.45, 0.7, 1.0), vec3(0.94, 0.98, 1.0), h);
      col += base * body * across * on * (0.4 + h * 0.9) / (1.0 + fl * 0.7);
    }
    col = applyTint(col, uTint, uMix);
    col *= smoothstep(1.0, 0.5, vDepth) * (0.3 + 0.7 * smoothstep(0.0, 0.18, vDepth));
    gl_FragColor = vec4(col * 0.5 * uFade, 1.0);
  }
`;

function buildTube(radius: number, frag: string) {
  const geo = new THREE.CylinderGeometry(radius, radius, LOOP, 96, 1, true);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: tunnelU.uTime, uMix: tunnelU.uMix, uTint: tunnelU.uTint, uFade: tunnelU.uFade,
    } as any,
    vertexShader: WALL_VERT,
    fragmentShader: frag,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = Z_OFFSET;
  mesh.renderOrder = 3;
  tunnelGroup.add(mesh);
  return mesh;
}
buildTube(195, SWIRL_FRAG);
buildTube(135, LANE_FRAG);

/* ---------------- 洞口环带的星粒配色 ---------------- */

const cCool = new THREE.Color(0.5, 0.72, 1.0);
const cWhite = new THREE.Color(0.95, 0.98, 1.0);
const cPink = new THREE.Color(1.0, 0.55, 0.85);
const cViolet = new THREE.Color(0.72, 0.48, 1.0);
const tmpCol = new THREE.Color();

function pickStreakColor(gain: number) {
  const roll = Math.random();
  tmpCol.copy(roll > 0.86 ? (roll > 0.94 ? cViolet : cPink) : Math.random() > 0.45 ? cCool : cWhite);
  return tmpCol.multiplyScalar(gain);
}

/* ---------------- 体积雾团 ---------------- */

function makeGlowTex(): THREE.Texture {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTex();
const fogSprites: THREE.Sprite[] = [];
const FOG_BASE = [0x2a3f8f, 0x40308a, 0x1e3a7a, 0x37276e];
for (let i = 0; i < 4; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: FOG_BASE[i], transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sp.position.set((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 90, -240 - i * 260);
  sp.scale.setScalar(420 + i * 90);
  sp.renderOrder = 3;
  tunnelGroup.add(sp);
  fogSprites.push(sp);
}

/* ---------------- 洞口组件:入口环带 + 尽头黑洞口 ---------------- */

const gaussRnd = () => Math.random() + Math.random() + Math.random() - 1.5;

/** 星粒环带(洞口的「框」——参考图那圈糊成光带的星粒) */
function buildHaloRing(n: number, rCenter: number, rSpread: number, size: number, opacity: number, gain: number) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = rCenter + gaussRnd() * rSpread;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = Math.sin(a) * rr;
    pos[i * 3 + 2] = gaussRnd() * 9;
    const c = pickStreakColor(gain * (0.7 + Math.random() * 0.6));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    map: glowTex, size, vertexColors: true, sizeAttenuation: true,
    transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.renderOrder = 3;
  return { points: p, mat, baseOpacity: opacity };
}

// 入口环带:管口的光圈(进场浮现时最醒目的元素)
const entryRing = buildHaloRing(700, 150, 20, 11, 0.7, 0.9);
entryRing.points.position.z = NEAR_Z - 4;
tunnelGroup.add(entryRing.points);

// 尽头黑洞口
const mawGroup = new THREE.Group();
mawGroup.position.z = FAR_Z + 6;
tunnelGroup.add(mawGroup);

const mawDiscMat = new THREE.MeshBasicMaterial({ color: 0x01020a, transparent: true, opacity: 1 });
const mawDisc = new THREE.Mesh(new THREE.CircleGeometry(132, 64), mawDiscMat);
mawDisc.renderOrder = 3;
mawGroup.add(mawDisc);

// 盘内星空(洞未开时的「异空间星点」,开洞后淡出让位给真行星)
const mawStarsMat = new THREE.PointsMaterial({
  color: 0xdde8ff, size: 1.7, sizeAttenuation: false,
  transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
});
{
  const N = 260;
  const sPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * 105;
    sPos[i * 3] = Math.cos(a) * rr;
    sPos[i * 3 + 1] = Math.sin(a) * rr;
    sPos[i * 3 + 2] = 2 + Math.random() * 3;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const stars = new THREE.Points(sGeo, mawStarsMat);
  stars.renderOrder = 3;
  mawGroup.add(stars);
}

const exitRing = buildHaloRing(1600, 150, 26, 13, 0.75, 1.0);
mawGroup.add(exitRing.points);
const outerSwirl = buildHaloRing(520, 230, 46, 9, 0.4, 0.55);
mawGroup.add(outerSwirl.points);

/* ---------------- 灯光(随管瞬移,洗亮三只飞船) ---------------- */

tunnelGroup.add(new THREE.AmbientLight(0x9aa7c8, 0.85));
const rim = new THREE.DirectionalLight(0xcfe0ff, 1.7);
rim.position.set(60, 220, 260);
rim.target.position.set(0, 0, -300);
tunnelGroup.add(rim);
tunnelGroup.add(rim.target);

/* ---------------- API ---------------- */

const ringTint = { v: 0 };
const tmpC = new THREE.Color();
const RING_BASE = new THREE.Color(0xffffff);
const tmpQ = new THREE.Quaternion();
const AXIS_NEG_Z = new THREE.Vector3(0, 0, -1);
const tmpOff = new THREE.Vector3();

export function setTunnelTint(css: string) {
  tunnelU.uTint.value.set(css);
}

/** 把管摆到世界:局部 anchorZ 处对准 worldPos,局部 -z 指向 worldDir */
export function placeTunnel(anchorZ: number, worldPos: THREE.Vector3, worldDir: THREE.Vector3) {
  tmpQ.setFromUnitVectors(AXIS_NEG_Z, worldDir.clone().normalize());
  tunnelGroup.quaternion.copy(tmpQ);
  tmpOff.set(0, 0, anchorZ).applyQuaternion(tmpQ);
  tunnelGroup.position.copy(worldPos).sub(tmpOff);
  tunnelGroup.updateMatrixWorld(true);
}

/** 每帧推进(跳跃期间调用):流速被 tunnelState.speed 调制,fade/shroud/mawOpen 同步各材质 */
export function updateTunnel(dt: number) {
  const { speed, fade, shroud, mawOpen } = tunnelState;
  tunnelU.uTime.value += dt * speed;
  tunnelU.uFade.value = fade;
  const t = tunnelU.uTime.value;

  shroudMat.opacity = shroud;
  mawDiscMat.opacity = (1 - mawOpen) * fade;
  mawStarsMat.opacity = 0.9 * (1 - mawOpen) * fade;
  entryRing.mat.opacity = entryRing.baseOpacity * fade;
  exitRing.mat.opacity = exitRing.baseOpacity * fade;
  outerSwirl.mat.opacity = outerSwirl.baseOpacity * fade;

  entryRing.points.rotation.z += dt * 0.35;
  exitRing.points.rotation.z += dt * (0.15 + 0.4 * speed);
  outerSwirl.points.rotation.z -= dt * (0.06 + 0.18 * speed);
  mawGroup.scale.setScalar(1 + Math.sin(t * 2.1) * 0.03);
  fogSprites.forEach((sp, i) => {
    (sp.material as THREE.SpriteMaterial).opacity = (0.055 + 0.03 * Math.sin(t * (0.7 + i * 0.23) + i * 2.1)) * fade;
    sp.material.rotation += dt * (i % 2 ? 0.08 : -0.06) * (0.4 + 0.6 * speed);
  });
  // 环带随染色进度转向应援色
  ringTint.v += (tunnelU.uMix.value - ringTint.v) * Math.min(1, dt * 3);
  exitRing.mat.color.copy(tmpC.copy(RING_BASE).lerp(tunnelU.uTint.value, ringTint.v * 0.8));
  entryRing.mat.color.copy(tmpC.copy(RING_BASE).lerp(tunnelU.uTint.value, ringTint.v * 0.5));
}
