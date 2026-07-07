/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TimeMirror — a vertical elliptical "time lens" floating in space.
 * The album artwork is fused into a morphing, noise-perturbed ellipse whose
 * edge dissolves into stardust. Pointer movement spawns ripples across the
 * surface; audio levels make the rim breathe. Rendered as a billboarded
 * plane + an additive rim particle cloud.
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

const MAX_RIPPLES = 8;

// ---------- GLSL helpers ----------
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
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * vnoise(p);
      p *= 2.1;
      amp *= 0.5;
    }
    return v;
  }
`;

const MIRROR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MIRROR_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;      // crossfades procedural core -> artwork
  uniform float uTime;
  uniform float uAspect;      // plane width / height, for cover-fit sampling
  uniform vec3 uColor;
  uniform float uBass;
  uniform float uMids;
  uniform float uHighs;
  uniform float uOpacity;
  uniform vec4 uRipples[${MAX_RIPPLES}]; // (u, v, startTime, strength)
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    // Centered coords, -1..1
    vec2 p = vUv * 2.0 - 1.0;

    // ---- Ripples: displacement + brightness ----
    float rippleBright = 0.0;
    vec2 rippleDisp = vec2(0.0);
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 rip = uRipples[i];
      if (rip.w <= 0.0) continue;
      float age = uTime - rip.z;
      if (age < 0.0 || age > 3.2) continue;
      vec2 toP = vUv - rip.xy;
      float rd = length(toP);
      float wave = sin(rd * 40.0 - age * 8.5) * exp(-rd * 5.5) * exp(-age * 1.55) * rip.w;
      rippleBright += wave;
      rippleDisp += normalize(toP + 1e-5) * wave * 0.024;
    }

    // ---- Morphing elliptical SDF (seamless angular noise) ----
    float rx = 0.66;
    float ry = 0.86;
    vec2 dir = normalize(p + 1e-5);
    // sample noise on a circle so there is no seam at +-PI
    vec2 nCoord = dir * 1.55 + vec2(uTime * 0.14, -uTime * 0.09);
    float wob = (fbm(nCoord) - 0.5) * 2.0;                 // -1..1
    float wobAmp = 0.055 + uBass * 0.075 + uMids * 0.02;   // breathes with music
    float d = length(p / vec2(rx, ry)) - 1.0 + wob * wobAmp + rippleBright * 0.05;

    // ---- Artwork sample with flowing distortion (cover-fit: square art fills the tall oval) ----
    vec2 flow = vec2(
      fbm(vUv * 2.6 + uTime * 0.05),
      fbm(vUv * 2.6 - uTime * 0.04 + 7.3)
    ) - 0.5;
    vec2 texUv = vUv + flow * 0.012 + rippleDisp;
    texUv.x = (texUv.x - 0.5) * uAspect + 0.5;
    vec3 tex = texture2D(uMap, texUv).rgb;

    // Procedural nebula core (used before artwork loads / crossfade)
    float swirl = fbm(p * 2.2 + vec2(uTime * 0.12, uTime * 0.08));
    vec3 proc = mix(uColor * 0.35, uColor, swirl) + vec3(swirl * swirl * 0.55);
    vec3 img = mix(proc, tex, uHasMap);

    // Slight vignette inside the lens keeps focus at the center
    float vig = 1.0 - smoothstep(0.35, 1.15, length(p / vec2(rx, ry)));
    img *= 0.55 + 0.45 * vig;

    // ---- Region masks ----
    float inside = 1.0 - smoothstep(-0.06, 0.045, d);

    // Dissolve band: image crumbles into dots near the edge
    float grain = fbm(vUv * 34.0 + uTime * 0.18);
    float band = smoothstep(0.10, -0.10, d);      // 0 far outside -> 1 inside
    float dissolve = step(1.0 - band, grain);      // dotted erosion
    float alphaMask = max(inside, band * dissolve * 0.9);

    // ---- Rim glow ----
    float glow = exp(-abs(d) * 13.0);
    vec3 glowColor = mix(vec3(1.0), uColor, 0.5);
    float glowAmt = glow * (0.38 + uHighs * 1.0 + rippleBright * 0.35);

    vec3 col = img * (0.72 + uBass * 0.1 + max(rippleBright, 0.0) * 0.5) * alphaMask
             + glowColor * glowAmt;

    float alpha = clamp(alphaMask + glowAmt * 0.85, 0.0, 1.0) * uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

const RIM_VERT = /* glsl */ `
  attribute float aAngle;
  attribute float aRadial;   // gaussian offset from the rim, world units
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  uniform float uTime;
  uniform float uBass;
  uniform float uHighs;
  uniform float uPixelRatio;
  varying float vTwinkle;
  varying float vCore;
  void main() {
    float ang = aAngle + uTime * aSpeed;
    // Ellipse rim in the mirror's local plane (must match plane geometry below)
    float rx = 8.6;
    float ry = 15.5;
    float breathe = 1.0 + uBass * 0.16 + sin(uTime * 0.7 + aPhase) * 0.025;
    float rad = 1.0 + (aRadial + sin(uTime * 1.3 + aPhase * 9.0) * 0.35) / 12.0;
    vec3 p = vec3(cos(ang) * rx * rad * breathe, sin(ang) * ry * rad * breathe, sin(aPhase * 13.0 + uTime) * 1.4);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float att = 260.0 / max(1.0, -mv.z);
    gl_PointSize = aSize * att * uPixelRatio * (1.0 + uHighs * 0.5);
    vTwinkle = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 17.0));
    vCore = step(0.82, fract(aPhase * 3.17)); // some particles burn white-hot
  }
`;

const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;
  varying float vCore;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.06, d);
    vec3 col = mix(uColor, vec3(1.0), 0.35 + vCore * 0.65);
    gl_FragColor = vec4(col, a * vTwinkle * uOpacity);
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
  private mesh: THREE.Mesh;
  private mirrorMat: THREE.ShaderMaterial;
  private rim: THREE.Points;
  private rimMat: THREE.ShaderMaterial;
  private halo: THREE.Sprite;
  private ripples: Float32Array;
  private rippleIndex = 0;
  private fallbackTex: THREE.Texture;
  private openTween: gsap.core.Tween | null = null;
  public isOpen = false;

  constructor(haloTexture: THREE.Texture) {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1x1 black fallback so the sampler is always valid
    const black = new Uint8Array([4, 6, 14, 255]);
    this.fallbackTex = new THREE.DataTexture(black, 1, 1, THREE.RGBAFormat);
    this.fallbackTex.needsUpdate = true;

    this.ripples = new Float32Array(MAX_RIPPLES * 4);

    // --- Lens plane ---
    this.mirrorMat = new THREE.ShaderMaterial({
      vertexShader: MIRROR_VERT,
      fragmentShader: MIRROR_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: this.fallbackTex },
        uHasMap: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 26 / 36 },
        uColor: { value: new THREE.Color('#8B5CF6') },
        uBass: { value: 0 },
        uMids: { value: 0 },
        uHighs: { value: 0 },
        uOpacity: { value: 1 },
        uRipples: { value: this.ripples },
      },
    });
    // Plane sized to give a vertical oval: rim rx/ry above assume half extents 13 x 18
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 36), this.mirrorMat);
    this.mesh.renderOrder = 20;
    this.group.add(this.mesh);

    // --- Rim stardust ---
    const COUNT = 1300;
    const geo = new THREE.BufferGeometry();
    const angle = new Float32Array(COUNT);
    const radial = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const speed = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      angle[i] = Math.random() * Math.PI * 2;
      // Gaussian-ish spread hugging the rim, drifting slightly outward
      const g = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      radial[i] = g * 4.4 + 0.8;
      size[i] = Math.random() * 1.5 + 0.35;
      speed[i] = (Math.random() * 0.16 + 0.03) * (Math.random() > 0.5 ? 1 : -1);
      phase[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
    geo.setAttribute('aRadial', new THREE.BufferAttribute(radial, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: RIM_VERT,
      fragmentShader: RIM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uHighs: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColor: { value: new THREE.Color('#8B5CF6') },
        uOpacity: { value: 1 },
      },
    });
    this.rim = new THREE.Points(geo, this.rimMat);
    this.rim.renderOrder = 21;
    this.group.add(this.rim);

    // --- Soft halo behind the lens ---
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture,
        color: new THREE.Color('#8B5CF6'),
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halo.scale.setScalar(88);
    this.halo.renderOrder = 19;
    this.group.add(this.halo);
  }

  /** Raycast target for pointer ripples. */
  get hitMesh(): THREE.Mesh {
    return this.mesh;
  }

  open(position: THREE.Vector3, color: string) {
    this.group.position.copy(position);
    (this.mirrorMat.uniforms.uColor.value as THREE.Color).set(color);
    (this.rimMat.uniforms.uColor.value as THREE.Color).set(color);
    (this.halo.material as THREE.SpriteMaterial).color.set(color);
    this.ripples.fill(0);
    this.group.visible = true;
    this.isOpen = true;

    this.openTween?.kill();
    this.group.scale.setScalar(0.001);
    this.openTween = gsap.to(this.group.scale, {
      x: 1, y: 1, z: 1,
      duration: 1.35,
      ease: 'elastic.out(1, 0.62)',
    });
    gsap.fromTo(this.mirrorMat.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 0.6, ease: 'power2.out' });
    gsap.fromTo(this.rimMat.uniforms.uOpacity, { value: 0 }, { value: 1, duration: 0.9, ease: 'power2.out' });
  }

  close(onDone?: () => void) {
    if (!this.isOpen) { onDone?.(); return; }
    this.isOpen = false;
    this.openTween?.kill();
    this.openTween = gsap.to(this.group.scale, {
      x: 0.001, y: 0.001, z: 0.001,
      duration: 0.45,
      ease: 'power3.in',
      onComplete: () => {
        this.group.visible = false;
        this.setTexture(null);
        onDone?.();
      },
    });
    gsap.to(this.mirrorMat.uniforms.uOpacity, { value: 0, duration: 0.4, ease: 'power2.in' });
    gsap.to(this.rimMat.uniforms.uOpacity, { value: 0, duration: 0.35, ease: 'power2.in' });
  }

  setTexture(tex: THREE.Texture | null) {
    if (tex) {
      this.mirrorMat.uniforms.uMap.value = tex;
      gsap.to(this.mirrorMat.uniforms.uHasMap, { value: 1, duration: 0.9, ease: 'power2.inOut' });
    } else {
      this.mirrorMat.uniforms.uMap.value = this.fallbackTex;
      this.mirrorMat.uniforms.uHasMap.value = 0;
    }
  }

  /** uv in [0,1] on the lens plane. */
  addRipple(u: number, v: number, time: number, strength = 1) {
    const i = this.rippleIndex * 4;
    this.ripples[i] = u;
    this.ripples[i + 1] = v;
    this.ripples[i + 2] = time;
    this.ripples[i + 3] = strength;
    this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  update(time: number, audio: AudioLevels, camera: THREE.Camera) {
    if (!this.group.visible) return;
    this.mirrorMat.uniforms.uTime.value = time;
    this.mirrorMat.uniforms.uBass.value = audio.bass;
    this.mirrorMat.uniforms.uMids.value = audio.mids;
    this.mirrorMat.uniforms.uHighs.value = audio.highs;
    this.rimMat.uniforms.uTime.value = time;
    this.rimMat.uniforms.uBass.value = audio.bass;
    this.rimMat.uniforms.uHighs.value = audio.highs;
    // Billboard toward the camera
    this.group.quaternion.copy((camera as THREE.PerspectiveCamera).quaternion);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mirrorMat.dispose();
    this.rim.geometry.dispose();
    this.rimMat.dispose();
    (this.halo.material as THREE.SpriteMaterial).dispose();
    this.fallbackTex.dispose();
  }
}
