/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TimeMirror v3 — a complete, readable artwork whose EDGES dissolve into
 * living particles (the reference behavior: the image itself stays intact;
 * turbulence and fluidity belong to the rim).
 *
 * Two co-registered layers:
 *   1. The image plane — normal blending (physically cannot blow out),
 *      zero distortion in the center, a gentle flow that only wakes up near
 *      the rim, pointer ripples, and a noise-torn alpha fade toward the edge.
 *   2. The rim particle band — pixels of the edge region reborn as grains
 *      (color continuity is what sells the fusion), curl-noise wind, radial
 *      plumes, and a pointer repulsion hole that heals itself.
 */

import * as THREE from 'three';
import { gsap } from 'gsap';

const PLANE_W = 26;
const PLANE_H = 36;
const MAX_RIPPLES = 8;

// ---------- shared GLSL noise ----------
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
    float amp = 0.55;
    for (int i = 0; i < 3; i++) {
      v += amp * vnoise(p);
      p *= 2.13;
      amp *= 0.5;
    }
    return v;
  }
`;

// ---------- layer 1: the image plane ----------
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
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uColor;
  uniform float uBass;
  uniform float uHighs;
  uniform float uOpacity;
  uniform float uReveal;                  // 0 hidden behind the dust -> 1 fully developed
  uniform vec4 uRipples[${MAX_RIPPLES}];  // (u, v, startTime, strength)
  varying vec2 vUv;

  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float e = length(p / vec2(0.66, 0.86)); // 0 center .. 1 ellipse rim

    // ---- pointer ripples: a soft sheen only — NO uv displacement.
    // Displacing the texture made the whole image judder under the cursor;
    // the picture must stay rock-steady, light is feedback enough. ----
    float rippleBright = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 rip = uRipples[i];
      if (rip.w <= 0.0) continue;
      float age = uTime - rip.z;
      if (age < 0.0 || age > 2.0) continue;
      vec2 toP = vUv - rip.xy;
      float rd = length(toP);
      rippleBright += sin(rd * 40.0 - age * 7.0) * exp(-rd * 9.0) * exp(-age * 2.2) * rip.w;
    }
    rippleBright *= smoothstep(0.98, 0.55, e); // fades out toward the rim

    // ---- flow distortion ONLY at the outer rim; the image core is static ----
    float flowZone = smoothstep(0.68, 1.02, e);
    vec2 flow = vec2(
      fbm(vUv * 3.0 + uTime * 0.07),
      fbm(vUv * 3.0 - uTime * 0.055 + 7.3)
    ) - 0.5;

    // ---- develop-under-dust (opening): the lens is born as pure grain dust;
    // when the cover is ready the veil blows away and the image fades up
    // patchily beneath it. Pure noise threshold — no geometric wipe, no
    // centre-out pattern. uReveal 1 -> exactly the steady-state image. ----
    float g = fbm(vUv * 9.0 + 3.1);
    float reveal = smoothstep(g - 0.35, g + 0.35, uReveal * 1.7 - 0.35);

    vec2 texUv = vUv + flow * flowZone * (0.022 + uBass * 0.014);
    texUv.x = (texUv.x - 0.5) * uAspect + 0.5;

    vec3 tex = texture2D(uMap, texUv).rgb;
    float swirl = fbm(p * 2.1 + vec2(uTime * 0.1, -uTime * 0.07));
    vec3 proc = uColor * (0.3 + 0.7 * swirl);
    vec3 col = mix(proc, tex, uHasMap);

    // ---- torn, irregular edge — NOT an ellipse. A large-amplitude angular
    // contour noise rips the outline into lobes/spikes (matches the reference:
    // a ragged blob, not a ring). The image and the rim particles share this
    // SAME contour, so they read as one crumbling body. ----
    vec2 dir = normalize(p + 1e-5);
    // seamless angular fbm (sample on a circle so there is no atan seam)
    float lobe = fbm(dir * 2.1 + vec2(uTime * 0.05, -uTime * 0.045)) - 0.5;  // big lobes
    float fine = fbm(dir * 6.5 - uTime * 0.035 + 3.7) - 0.5;                 // fine tears
    float contour = lobe * 0.34 + fine * 0.12;                              // total swing ~0.23
    float ee = e + contour;
    // wide fade band [0.62, 1.06]: clear core then a long ragged dissolve, the
    // large contour swing making the actual boundary highly irregular.
    float edgeFade = 1.0 - smoothstep(0.62, 1.06, ee);
    // dotted erosion inside the fade band — the image breaks into grains
    float grain = fbm(vUv * 40.0 + uTime * 0.1);
    float band = smoothstep(0.62, 1.06, ee);
    edgeFade = max(edgeFade, (1.0 - band) * step(band, grain) * 0.6);

    float alpha = edgeFade * reveal * uOpacity;
    if (alpha < 0.004) discard;

    // dusk-dim, and hard-clamped BELOW the bloom threshold (0.82) so even a
    // white/bright-yellow cover reads as a photo, never a light source
    col *= 0.5 + rippleBright * 0.18 + uHighs * 0.04;
    col = min(col, vec3(0.78));
    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------- layer 2: the rim particle band ----------
const RIM_VERT = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uTime;
  uniform float uForm;
  uniform float uOpacity;
  uniform float uBass;
  uniform float uHighs;
  uniform vec3 uColor;
  uniform vec4 uRipples[${MAX_RIPPLES}]; // (u, v, startTime, strength) — same waves as the plane
  uniform float uPixelRatio;
  uniform float uAspect;
  uniform float uVeil;    // 1 interior dust covers the image .. 0 blown away
  attribute vec2 aHome;   // uv-space rest position (band or interior)
  attribute float aRand;
  attribute float aEdge;  // 0 inner band edge .. 1 outer plume tip
  attribute float aInner; // 1 = interior veil dust (covers the image area)
  varying vec3 vColor;
  varying float vAlpha;

  ${NOISE_GLSL}

  vec2 curl(vec2 p) {
    float e = 0.14;
    float n1 = fbm(p + vec2(0.0, e));
    float n2 = fbm(p - vec2(0.0, e));
    float n3 = fbm(p + vec2(e, 0.0));
    float n4 = fbm(p - vec2(e, 0.0));
    return vec2(n1 - n2, n4 - n3) / (2.0 * e);
  }

  void main() {
    vec2 homeW = (aHome - 0.5) * vec2(${PLANE_W.toFixed(1)}, ${PLANE_H.toFixed(1)});
    vec2 pEll = (aHome * 2.0 - 1.0) / vec2(0.66, 0.86);
    vec2 outDir = normalize(pEll + 1e-5);

    // SAME irregular contour as the image plane — the particle cloud warps to
    // the identical ragged outline, so grains + image read as one crumbling
    // body (not a ring stuck onto an ellipse).
    float clobe = fbm(outDir * 2.1 + vec2(uTime * 0.05, -uTime * 0.045)) - 0.5;
    float cfine = fbm(outDir * 6.5 - uTime * 0.035 + 3.7) - 0.5;
    float contour = clobe * 0.34 + cfine * 0.12; // matches PLANE_FRAG
    homeW += outDir * contour * 12.0;            // push grains along the ragged edge

    // scatter origin for the opening assembly
    float r1 = hash21(vec2(aRand, 1.7));
    float r2 = hash21(vec2(aRand, 9.2));
    float r3 = hash21(vec2(aRand, 4.4));
    vec3 scatter = vec3((r1 - 0.5) * 150.0, (r2 - 0.5) * 170.0, (r3 - 0.5) * 80.0);
    float formT = smoothstep(0.0, 1.0, clamp(uForm * 1.6 - aRand * 0.6, 0.0, 1.0));

    // wind: nearly still at the inner edge (must match the plane), wild outside
    float wildness = pow(aEdge, 1.3);
    float amp = (0.4 + uBass * 1.4) * mix(0.12, 3.6, wildness);
    vec2 wind = curl(aHome * 3.2 + vec2(uTime * 0.055, uTime * 0.04)) * amp;
    // radial plumes streaming off the rim
    float plume = (fbm(aHome * 2.2 + uTime * 0.06 + aRand) - 0.35);
    wind += outDir * wildness * plume * (2.6 + uBass * 2.0);

    vec3 pos = vec3(homeW + wind, (vnoise(aHome * 5.0 + uTime * 0.12) - 0.5) * (1.0 + wildness * 5.0));

    // pointer ripples — the SAME gentle waves as the image plane. Grains bob
    // softly on the passing wave (no repulsion, no smearing, no shaking).
    float rippleSum = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 rip = uRipples[i];
      if (rip.w <= 0.0) continue;
      float age = uTime - rip.z;
      if (age < 0.0 || age > 2.0) continue;
      float rd = distance(aHome, rip.xy);
      rippleSum += sin(rd * 40.0 - age * 7.0) * exp(-rd * 9.0) * exp(-age * 2.2) * rip.w;
    }
    pos.xy += outDir * rippleSum * 0.35; // a breath, not a shove
    pos.z += rippleSum * 0.3;

    pos = mix(scatter, pos, formT);

    // interior veil dust: while the cover has nothing to show, these grains
    // ARE the lens body. When the cover develops (uVeil -> 0) each grain is
    // carried off on its own gust — staggered departure, drifting out and up,
    // like dust blown off a surface.
    float gone = aInner * smoothstep(aRand * 0.5, aRand * 0.5 + 0.5, 1.0 - uVeil);
    vec2 blowDir = normalize(outDir * 0.7 + vec2(hash21(vec2(aRand, 3.3)) - 0.35, hash21(vec2(aRand, 6.1)) - 0.2) + 1e-4);
    pos.xy += blowDir * gone * (9.0 + 15.0 * r1);
    pos.z += gone * (2.5 + 4.0 * r2);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // grain color: born from the edge pixel but reborn as COOL FAINT DUST.
    // Additive stacking is unbounded, so bright covers must NOT make bright
    // grains — the reference rim is silvery sand regardless of the artwork.
    vec2 texUv = aHome;
    texUv.x = (texUv.x - 0.5) * uAspect + 0.5;
    vec3 tex = texture2D(uMap, clamp(texUv, 0.02, 0.98)).rgb;
    vec3 proc = uColor * (0.35 + 0.7 * fbm(aHome * 3.0 + aRand * 7.0));
    vec3 src = mix(proc, tex, uHasMap);
    float lum = dot(src, vec3(0.299, 0.587, 0.114));
    // 85% desaturate → then pull hard toward the dust tone: the HOST NEBULA's
    // arm color. One artist region = one hue family, from overview all the way
    // into the lens — covers contribute content, never tinting.
    // (additive stacking bleaches hue, so the lean must be strong to survive)
    vec3 col = mix(vec3(lum), src, 0.3);
    vec3 dustTone = mix(vec3(0.80, 0.83, 0.92), uColor, 0.6);
    col = mix(col, dustTone, 0.6);
    col = min(col * (0.42 + uHighs * 0.15 + max(rippleSum, 0.0) * 0.2), vec3(0.7)); // faint, capped low

    float att = 300.0 / max(1.0, -mv.z);
    float size = mix(0.5, 1.9, wildness * 0.6 + 0.4 * lum);
    gl_PointSize = clamp(size * att * uPixelRatio * (0.6 + 0.4 * formT), 0.5, 7.0);

    vColor = col;
    // bell-shaped density across the widened band [e 0.6..1.35]: sparse where
    // the image is still solid, densest through the dissolve zone, feathering
    // out to the plume tips. Contour makes spikes denser, hollows sparser — so
    // the cloud's own outline is ragged too.
    float profile = smoothstep(0.0, 0.25, aEdge) * (1.0 - 0.9 * smoothstep(0.45, 1.0, aEdge));
    profile *= clamp(1.0 + contour * 1.3, 0.55, 1.5);
    // interior dust keeps its own steady density while veiled, fades as it departs
    float innerProfile = 0.5 + 0.35 * hash21(vec2(aRand, 2.2));
    profile = mix(profile, innerProfile, aInner);
    vAlpha = uOpacity * profile * (0.3 + 0.7 * formT) * 0.5 * (1.0 - gone);
  }
`;

const RIM_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float a = exp(-d2 * 11.0) - 0.012;
    if (a <= 0.0) discard;
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
  public group: THREE.Group;
  public mirrorMat: THREE.ShaderMaterial; // the plane material (uHasMap read by dev/QA)
  private plane: THREE.Mesh;
  private rim: THREE.Points;
  private rimMat: THREE.ShaderMaterial;
  private hit: THREE.Mesh;
  private halo: THREE.Sprite;
  private ripples: Float32Array;
  private rippleIndex = 0;
  private fallbackTex: THREE.Texture;
  private texEpoch = 0; // bumped on every setTexture; guards close()'s deferred wipe
  private lastTime = 0;
  private openAt = 0;
  private unveilStarted = false;
  private hasTexture = false;
  public isOpen = false;

  constructor(haloTexture: THREE.Texture) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const dark = new Uint8Array([10, 10, 16, 255]);
    this.fallbackTex = new THREE.DataTexture(dark, 1, 1, THREE.RGBAFormat);
    this.fallbackTex.needsUpdate = true;

    this.ripples = new Float32Array(MAX_RIPPLES * 4);

    // ---- layer 1: image plane ----
    this.mirrorMat = new THREE.ShaderMaterial({
      vertexShader: PLANE_VERT,
      fragmentShader: PLANE_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: this.fallbackTex },
        uHasMap: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: PLANE_W / PLANE_H },
        uColor: { value: new THREE.Color('#8d85c6') },
        uBass: { value: 0 },
        uHighs: { value: 0 },
        uOpacity: { value: 0 },
        uReveal: { value: 0 },
        uRipples: { value: this.ripples },
      },
    });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), this.mirrorMat);
    this.plane.renderOrder = 20;
    this.group.add(this.plane);

    // ---- layer 2: rim particle band, WIDE (e ∈ [0.62, 1.35]) ----
    // overlaps the image's dissolve zone (grains take over as the image fades)
    // and feathers far out into plumes. Density profile keeps it a soft glow.
    const GRID_W = 108;
    const GRID_H = 146;
    const homes: number[] = [];
    const rands: number[] = [];
    const edges: number[] = [];
    const inners: number[] = [];
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const u = (gx + 0.5) / GRID_W + (Math.random() - 0.5) * (0.8 / GRID_W);
        const v = (gy + 0.5) / GRID_H + (Math.random() - 0.5) * (0.8 / GRID_H);
        const ex = (u - 0.5) / 0.33;
        const ey = (v - 0.5) / 0.43;
        const e = Math.sqrt(ex * ex + ey * ey);
        if (e > 1.35) continue;
        const inner = e < 0.62; // interior veil dust — the lens body before the cover develops
        if (inner && Math.random() < 0.2) continue; // keep the veil airy
        homes.push(u, v);
        rands.push(Math.random());
        edges.push(inner ? 0 : THREE.MathUtils.clamp((e - 0.62) / (1.35 - 0.62), 0, 1));
        inners.push(inner ? 1 : 0);
      }
    }
    const COUNT = rands.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    geo.setAttribute('aHome', new THREE.BufferAttribute(new Float32Array(homes), 2));
    geo.setAttribute('aRand', new THREE.BufferAttribute(new Float32Array(rands), 1));
    geo.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(edges), 1));
    geo.setAttribute('aInner', new THREE.BufferAttribute(new Float32Array(inners), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);

    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: RIM_VERT,
      fragmentShader: RIM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: this.fallbackTex },
        uHasMap: { value: 0 },
        uTime: { value: 0 },
        uForm: { value: 0 },
        uVeil: { value: 1 },
        uOpacity: { value: 0 },
        uBass: { value: 0 },
        uHighs: { value: 0 },
        uColor: { value: new THREE.Color('#8d85c6') },
        uRipples: { value: this.ripples }, // shared with the plane — one set of waves
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uAspect: { value: PLANE_W / PLANE_H },
      },
    });
    this.rim = new THREE.Points(geo, this.rimMat);
    this.rim.renderOrder = 21;
    this.group.add(this.rim);

    // pointer raycast plane (slightly oversized to catch the rim band)
    this.hit = new THREE.Mesh(
      new THREE.PlaneGeometry(PLANE_W * 1.2, PLANE_H * 1.2),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.group.add(this.hit);

    // soft halo behind everything — faint and cool, not a theme-color backlight
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture,
        color: new THREE.Color('#6b7290'),
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.halo.scale.setScalar(80);
    this.halo.renderOrder = 19;
    this.group.add(this.halo);
  }

  get hitMesh(): THREE.Mesh {
    return this.hit;
  }

  open(position: THREE.Vector3, color: string) {
    this.group.position.copy(position);
    (this.mirrorMat.uniforms.uColor.value as THREE.Color).set(color);
    (this.rimMat.uniforms.uColor.value as THREE.Color).set(color);
    (this.halo.material as THREE.SpriteMaterial).color.set(color);
    this.ripples.fill(0);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    this.isOpen = true;

    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    gsap.killTweensOf([pm.uReveal, pm.uOpacity, rm.uForm, rm.uOpacity, rm.uVeil]);
    // the lens is BORN AS PURE GRAIN DUST — the whole particle body (band +
    // interior veil) assembles during the flight. The cover develops only
    // once its texture is ready: the veil blows away and the image fades up
    // beneath it (scheduleUnveil).
    pm.uReveal.value = 0;
    rm.uVeil.value = 1;
    this.unveilStarted = false;
    this.openAt = this.lastTime;
    gsap.fromTo(rm.uForm, { value: 0 }, { value: 1, duration: 0.8, ease: 'expo.out' });
    gsap.fromTo(rm.uOpacity, { value: 0 }, { value: 1, duration: 0.4, ease: 'power2.out' });
    gsap.fromTo(pm.uOpacity, { value: 0 }, { value: 1, duration: 0.45, ease: 'power2.out', delay: 0.15 });
    gsap.fromTo(this.halo.material as THREE.SpriteMaterial, { opacity: 0 }, { opacity: 0.1, duration: 0.8 });
    // texture already loaded (cached cover): unveil as soon as the dust body
    // has taken shape — the WHOLE sequence must finish within the flight
    if (this.hasTexture) this.scheduleUnveil(0.45);
  }

  close(onDone?: () => void) {
    if (!this.isOpen) { onDone?.(); return; }
    this.isOpen = false;
    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    gsap.killTweensOf([pm.uReveal, pm.uOpacity, rm.uForm, rm.uOpacity, rm.uVeil]);
    gsap.to(pm.uReveal, { value: 0, duration: 0.5, ease: 'power2.in' });
    gsap.to(rm.uForm, { value: 0, duration: 0.9, ease: 'power2.in' });
    gsap.to(this.halo.material as THREE.SpriteMaterial, { opacity: 0, duration: 0.5 });
    const epochAtClose = this.texEpoch;
    gsap.to([pm.uOpacity, rm.uOpacity], {
      value: 0,
      duration: 0.8,
      ease: 'power2.in',
      onComplete: () => {
        this.group.visible = false;
        // Wipe the texture only if nothing newer arrived while we were fading
        // out — otherwise a fast (cached) cover for the NEXT song would be
        // erased by this deferred callback and the mirror would open empty.
        if (this.texEpoch === epochAtClose) this.setTexture(null);
        // reset to a dust body for the next opening — unless a newer open()
        // already took over (isOpen flipped back to true)
        if (!this.isOpen) {
          pm.uReveal.value = 0;
          rm.uVeil.value = 1;
          this.unveilStarted = false;
        }
        onDone?.();
      },
    });
  }

  setTexture(tex: THREE.Texture | null) {
    this.texEpoch++;
    this.hasTexture = !!tex;
    const target = tex || this.fallbackTex;
    this.mirrorMat.uniforms.uMap.value = target;
    this.rimMat.uniforms.uMap.value = target;
    if (tex) {
      gsap.to([this.mirrorMat.uniforms.uHasMap, this.rimMat.uniforms.uHasMap], {
        value: 1, duration: 1.0, ease: 'power2.inOut',
      });
      // the cover is ready — let the dust body finish forming, then blow the
      // veil away and develop the image beneath it
      if (this.isOpen && !this.unveilStarted) {
        this.scheduleUnveil(Math.max(0.1, 0.45 - (this.lastTime - this.openAt)));
      }
    } else {
      this.mirrorMat.uniforms.uHasMap.value = 0;
      this.rimMat.uniforms.uHasMap.value = 0;
      gsap.killTweensOf([this.mirrorMat.uniforms.uReveal, this.rimMat.uniforms.uVeil]);
      this.mirrorMat.uniforms.uReveal.value = 0;
      this.rimMat.uniforms.uVeil.value = 1;
      this.unveilStarted = false;
    }
  }

  /** Blow the interior dust away and develop the cover beneath it. */
  private scheduleUnveil(delay: number) {
    this.unveilStarted = true;
    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    gsap.killTweensOf([pm.uReveal, rm.uVeil]);
    gsap.to(rm.uVeil, { value: 0, duration: 1.0, ease: 'power2.inOut', delay });
    gsap.to(pm.uReveal, { value: 1, duration: 0.9, ease: 'power2.inOut', delay: delay + 0.1 });
  }

  /**
   * Spawn a ripple at uv (0..1). The single wave rolls across BOTH the image
   * plane and the rim particles — one soft, unified reaction, no repulsion.
   */
  addRipple(u: number, v: number, time: number, strength = 1) {
    const i = this.rippleIndex * 4;
    this.ripples[i] = u;
    this.ripples[i + 1] = v;
    this.ripples[i + 2] = time;
    this.ripples[i + 3] = strength * 0.8;
    this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  update(time: number, audio: AudioLevels, camera: THREE.Camera) {
    this.lastTime = time;
    if (!this.group.visible) return;
    const pm = this.mirrorMat.uniforms;
    const rm = this.rimMat.uniforms;
    pm.uTime.value = time;
    pm.uBass.value = audio.bass;
    pm.uHighs.value = audio.highs;
    rm.uTime.value = time;
    rm.uBass.value = audio.bass;
    rm.uHighs.value = audio.highs;
    this.group.quaternion.copy((camera as THREE.PerspectiveCamera).quaternion);
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
