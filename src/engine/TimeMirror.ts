/**
 * Particle Fusion TimeMirror.
 *
 * A single, image-coloured particle field: the centre resolves into a clear
 * cover while the perimeter dissolves into moving particles. The 34 × 30
 * footprint is intentionally the same as the previous main-branch mirror.
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

const PLANE_W = 34;
const PLANE_H = 30;
const DENSITY = 204;
const MAX_RIPPLES = 8;

const NOISE = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0, amp = 0.55;
    for (int i = 0; i < 3; i++) { value += noise(p) * amp; p = p * 2.13 + 7.1; amp *= 0.5; }
    return value;
  }
`;

const VERT = /* glsl */ `
  precision highp float;
  attribute float aBright;
  attribute float aRand;
  attribute float aInset;
  uniform float uTime, uForm, uOpacity, uHighs, uBaseScreen, uDistance;
  uniform vec3 uColor;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  varying vec3 vColor;
  varying float vAlpha;
  ${NOISE}

  void main() {
    vec3 pos = position;
    // Same Particle Fusion transition: clear core, then a wide edge blend.
    float scatter = 1.0 - smoothstep(-0.18, 0.19, aInset);
    float flowTime = uTime * 0.1;
    float n1 = fbm(pos.xy * 0.48 + vec2(flowTime, -flowTime * 0.7)) - 0.5;
    float n2 = fbm(pos.yx * 0.62 + vec2(12.3, flowTime * 0.8)) - 0.5;
    float n3 = fbm(pos.xy * 0.27 - vec2(flowTime * 0.5, 5.0)) - 0.5;
    pos.x += n1 * 13.6 * scatter;
    pos.y += (n2 * 1.3 + 0.35 * scatter) * 8.4 * scatter;
    pos.z += aBright * 1.1 + n3 * 1.1 + scatter * 5.2 * n1;

    float ripple = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      if (r.w <= 0.0) continue;
      float age = uTime - r.z;
      if (age < 0.0 || age > 2.0) continue;
      vec2 hit = (r.xy - 0.5) * vec2(${PLANE_W.toFixed(1)}, ${PLANE_H.toFixed(1)});
      float d = distance(pos.xy, hit);
      ripple += sin(d * 1.45 - age * 7.0) * exp(-d * 0.46) * exp(-age * 2.2) * r.w;
    }
    pos.z += ripple * 0.9;

    // The open animation assembles loose cover-coloured dust into the field.
    vec3 source = vec3((aRand - 0.5) * 58.0, (fract(aRand * 97.13) - 0.5) * 54.0, (fract(aRand * 41.71) - 0.5) * 30.0);
    float settle = smoothstep(0.0, 1.0, clamp(uForm * 1.45 - aRand * 0.45, 0.0, 1.0));
    pos = mix(source, pos, settle);

    float sparkle = smoothstep(0.67, 1.0, fbm(pos.xy * 1.4 + vec2(uTime * 1.5, aRand * 21.0)));
    float sweep = smoothstep(0.82, 1.0, sin((pos.x + pos.y * 0.6) * 0.28 - uTime * 1.1));
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float sizeVar = mix(1.0, 0.5 + aRand, scatter) * (1.0 + sparkle * 0.8);
    gl_PointSize = clamp(1.4 * uBaseScreen * sizeVar * (uDistance / max(1.0, -mv.z)), 0.7, 8.0);
    gl_Position = projectionMatrix * mv;

    vec3 toned = mix(color, uColor, 0.10 + scatter * 0.15);
    vColor = min(toned * (0.56 + uHighs * 0.12) + sparkle * vec3(0.34, 0.30, 0.20) + sweep * vec3(0.08), vec3(0.82));
    float keep = step(aRand, 1.0 - scatter * 0.76);
    vAlpha = uOpacity * (0.36 + 0.64 * settle) * max(keep, sparkle * 0.9);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.34, 0.5, d);
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export interface AudioLevels {
  intensity: number;
  bass: number;
  mids: number;
  highs: number;
}

export class TimeMirror {
  public group = new THREE.Group();
  public mirrorMat: THREE.ShaderMaterial;
  /** Kept for V7's galaxy-dimming decision. */
  public distanceFade = 1;
  private particles: THREE.Points;
  private hit: THREE.Mesh;
  private halo: THREE.Sprite;
  private ripples = new Float32Array(MAX_RIPPLES * 4);
  private rippleIndex = 0;
  private fallback = this.makeFallback();
  private lastTime = 0;
  private lastPointerRipple = -Infinity;
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  private hasTexture = false;
  public isOpen = false;

  constructor(haloTexture: THREE.Texture) {
    this.group.visible = false;
    this.mirrorMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 }, uForm: { value: 0 }, uOpacity: { value: 0 }, uHighs: { value: 0 },
        uBaseScreen: { value: 1.5 }, uDistance: { value: 100 },
        uColor: { value: new THREE.Color('#8d85c6') }, uRipples: { value: this.ripples },
      },
    });
    const geometry = new THREE.BufferGeometry();
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    this.particles = new THREE.Points(geometry, this.mirrorMat);
    this.particles.renderOrder = 20;
    this.group.add(this.particles);
    this.buildParticles(this.fallback);

    this.hit = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W * 1.25, PLANE_H * 1.25), new THREE.MeshBasicMaterial({ visible: false }));
    this.group.add(this.hit);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture, color: new THREE.Color('#6b7290'), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.halo.scale.setScalar(68);
    this.halo.renderOrder = 19;
    this.group.add(this.halo);
  }

  get hitMesh() { return this.hit; }

  open(position: THREE.Vector3, color: string) {
    this.group.position.copy(position);
    (this.mirrorMat.uniforms.uColor.value as THREE.Color).set(color);
    (this.halo.material as THREE.SpriteMaterial).color.set(color);
    this.ripples.fill(0);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.isOpen = true;
    this.distanceFade = 1;
    const u = this.mirrorMat.uniforms;
    gsap.killTweensOf([u.uForm, u.uOpacity]);
    u.uForm.value = 0;
    u.uOpacity.value = 0;
    gsap.to(u.uForm, { value: 1, duration: 0.82, ease: 'expo.out' });
    gsap.to(u.uOpacity, { value: this.hasTexture ? 1 : 0.72, duration: 0.42, ease: 'power2.out' });
    gsap.to(this.halo.material as THREE.SpriteMaterial, { opacity: 0.065, duration: 0.75 });
  }

  close(onDone?: () => void) {
    if (!this.isOpen) { onDone?.(); return; }
    this.isOpen = false;
    const u = this.mirrorMat.uniforms;
    gsap.killTweensOf([u.uForm, u.uOpacity]);
    gsap.to(u.uForm, { value: 0, duration: 0.72, ease: 'power2.in' });
    gsap.to(this.halo.material as THREE.SpriteMaterial, { opacity: 0, duration: 0.42 });
    gsap.to(u.uOpacity, { value: 0, duration: 0.68, ease: 'power2.in', onComplete: () => {
      if (!this.isOpen) { this.group.visible = false; this.distanceFade = 0; }
      onDone?.();
    } });
  }

  setTexture(texture: THREE.Texture | null) {
    this.hasTexture = !!texture;
    this.buildParticles((texture?.image as CanvasImageSource | undefined) || this.fallback);
    if (texture && this.isOpen) gsap.to(this.mirrorMat.uniforms.uOpacity, { value: 1, duration: 0.35, ease: 'power2.out' });
  }

  addRipple(u: number, v: number, time: number, strength = 1) {
    const i = this.rippleIndex * 4;
    this.ripples[i] = u; this.ripples[i + 1] = v; this.ripples[i + 2] = time; this.ripples[i + 3] = strength * 0.8;
    this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  /** Compatibility with V7's pointer-trail interaction. */
  setPointer(u: number, v: number, vx = 0, vy = 0) {
    const speed = Math.min(1, Math.hypot(vx, vy) * 1.6);
    if (speed > 0.04 && this.lastTime - this.lastPointerRipple > 0.14) {
      this.addRipple(u, v, this.lastTime, 0.28 + speed * 0.42);
      this.lastPointerRipple = this.lastTime;
    }
  }
  clearPointer() { /* ripples decay naturally */ }
  setPixelRatio(pixelRatio: number) { this.pixelRatio = Math.min(Math.max(pixelRatio, 0.5), 2); }
  faceToward(position: THREE.Vector3) { this.group.lookAt(position); }

  update(time: number, audio: AudioLevels, camera: THREE.Camera) {
    this.lastTime = time;
    if (!this.group.visible) return;
    const u = this.mirrorMat.uniforms;
    const perspective = camera as THREE.PerspectiveCamera;
    const distance = Math.max(1, perspective.position.distanceTo(this.group.position));
    const worldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov * 0.5));
    u.uTime.value = time;
    u.uHighs.value = audio.highs;
    u.uDistance.value = distance;
    u.uBaseScreen.value = (PLANE_W / DENSITY) * ((window.innerHeight * this.pixelRatio) / worldHeight);
    this.distanceFade = this.isOpen ? 1 : 0;
    this.group.quaternion.copy(perspective.quaternion);
  }

  dispose() {
    this.particles.geometry.dispose();
    this.mirrorMat.dispose();
    this.hit.geometry.dispose();
    (this.hit.material as THREE.Material).dispose();
    (this.halo.material as THREE.SpriteMaterial).dispose();
  }

  private buildParticles(source: CanvasImageSource) {
    const gridH = Math.round(DENSITY * (PLANE_H / PLANE_W));
    const canvas = document.createElement('canvas');
    canvas.width = DENSITY; canvas.height = gridH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    // Match CSS `object-fit: cover`: keep the artwork's original proportions
    // while filling the slightly landscape mirror. Drawing the square album
    // art directly into the 34:30 grid used to stretch faces horizontally.
    const sourceWidth = Number(
      (source as HTMLImageElement).naturalWidth ||
      (source as HTMLVideoElement).videoWidth ||
      (source as HTMLCanvasElement).width,
    );
    const sourceHeight = Number(
      (source as HTMLImageElement).naturalHeight ||
      (source as HTMLVideoElement).videoHeight ||
      (source as HTMLCanvasElement).height,
    );
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = DENSITY / gridH;
    if (Number.isFinite(sourceAspect) && sourceAspect > 0) {
      let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
      if (sourceAspect > targetAspect) {
        sw = sourceHeight * targetAspect;
        sx = (sourceWidth - sw) * 0.5;
      } else {
        sh = sourceWidth / targetAspect;
        sy = (sourceHeight - sh) * 0.5;
      }
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, DENSITY, gridH);
    } else {
      ctx.drawImage(source, 0, 0, DENSITY, gridH);
    }
    const pixels = ctx.getImageData(0, 0, DENSITY, gridH).data;
    const count = DENSITY * gridH;
    const position = new Float32Array(count * 3), color = new Float32Array(count * 3);
    const brightness = new Float32Array(count), random = new Float32Array(count), inset = new Float32Array(count);
    let i = 0;
    for (let y = 0; y < gridH; y++) for (let x = 0; x < DENSITY; x++, i++) {
      const p = (y * DENSITY + x) * 4, r = pixels[p] / 255, g = pixels[p + 1] / 255, b = pixels[p + 2] / 255;
      const u = x / (DENSITY - 1), v = y / (gridH - 1);
      position[i * 3] = (u - 0.5) * PLANE_W;
      position[i * 3 + 1] = (0.5 - v) * PLANE_H;
      color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b;
      brightness[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      random[i] = Math.random();
      inset[i] = Math.min(u, 1 - u, v, 1 - v) * 2;
    }
    const geo = this.particles.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aBright', new THREE.BufferAttribute(brightness, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(random, 1));
    geo.setAttribute('aInset', new THREE.BufferAttribute(inset, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
  }

  private makeFallback() {
    const canvas = document.createElement('canvas');
    canvas.width = 360; canvas.height = 320;
    const ctx = canvas.getContext('2d')!;
    const glow = ctx.createRadialGradient(180, 145, 12, 180, 160, 250);
    glow.addColorStop(0, '#d6d3ea'); glow.addColorStop(0.36, '#716c9d'); glow.addColorStop(1, '#070812');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }
}
