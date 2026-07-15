import * as THREE from 'three';
import {
  MISTDISK_FRAG,
  MISTDISK_VERT,
  NEBULA_FRAG,
  NEBULA_VERT,
  SMOKE_FRAG,
  SMOKE_VERT,
  makeGlowTexture,
  makeSmokeAtlas,
} from '../engine/GalaxyEngine';
import { CORE_WHITE, paletteFor, refineColor } from '../engine/palette';

export interface StableNebulaAssets {
  glow: THREE.Texture;
  smoke: THREE.Texture;
}

export interface StableNebulaAudio {
  intensity: number;
  bass: number;
}

export interface StableNebulaVisual {
  group: THREE.Group;
  cloudMat: THREE.ShaderMaterial;
  gasMat: THREE.ShaderMaterial;
  dustMat: THREE.ShaderMaterial;
  mistMat: THREE.ShaderMaterial;
  core: THREE.Sprite;
  veil: THREE.Sprite;
  radius: number;
  tick: (dt: number, audio: StableNebulaAudio, cameraDistance: number) => void;
  setDimmed: (dimmed: boolean) => void;
}

export function createStableNebulaAssets(): StableNebulaAssets {
  return { glow: makeGlowTexture(), smoke: makeSmokeAtlas() };
}

function seeded(id: string) {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 9973;
  return () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return (seed % 10000) / 10000;
  };
}

export function createStableNebulaVisual(options: {
  id: string;
  legacyColor: string;
  radius: number;
  assets: StableNebulaAssets;
  pixelRatio: number;
}): StableNebulaVisual {
  const { id, radius: R, assets, pixelRatio } = options;
  const palette = paletteFor(refineColor(options.legacyColor));
  const group = new THREE.Group();
  group.name = `stable_nebula_${id}`;

  const rand = seeded(id);
  const gauss = () => rand() + rand() + rand() - 1.5;
  const tiltAxis = new THREE.Vector3(Math.cos(rand() * Math.PI * 2), 0, Math.sin(rand() * Math.PI * 2)).normalize();
  group.quaternion.setFromAxisAngle(tiltAxis, 0.15 + rand() * 0.75);

  const armCount = rand() < 0.28 ? 3 : 2;
  const turns = Math.PI * 1.05 * (0.8 + rand() * 0.75);
  const rExp = 1.18 + rand() * 0.4;
  const armR = (t: number) => 0.13 + 0.87 * Math.pow(t, rExp);
  const armPhase = rand() * Math.PI * 2;
  const armSep = (Math.PI * 2) / armCount;

  const count = 3400;
  const aRadius = new Float32Array(count);
  const aTheta = new Float32Array(count);
  const aHeight = new Float32Array(count);
  const aSize = new Float32Array(count);
  const aBright = new Float32Array(count);
  const aPhase = new Float32Array(count);
  const aColor = new Float32Array(count * 3);

  const cCore = new THREE.Color(CORE_WHITE);
  const cArm = new THREE.Color(palette.arm);
  const cAccent = new THREE.Color(palette.accent);
  const cDust = new THREE.Color(palette.dust);
  const cDeep = new THREE.Color(palette.deep);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const kind = i / count;
    let r: number;
    let theta: number;
    let h: number;
    let size: number;
    let bright: number;
    if (kind < 0.15) {
      r = Math.abs(gauss()) * R * 0.13;
      theta = rand() * Math.PI * 2;
      h = gauss() * R * 0.045;
      size = 1 + rand() * 2.1;
      bright = 1 + rand() * 0.7;
      tmp.copy(cCore).lerp(cArm, rand() * 0.25);
    } else if (kind < 0.77) {
      const arm = i % armCount;
      const t = Math.sqrt(rand());
      r = R * armR(t);
      const spread = (0.11 + 0.2 * t) * (1 + Math.abs(gauss()) * 0.4);
      theta = armPhase + arm * armSep + t * turns + gauss() * spread;
      h = gauss() * R * 0.028 * (1 + t * 1.1);
      size = 0.85 + rand() * 2.4;
      bright = 0.4 + rand() * 0.45;
      if (t < 0.24) tmp.copy(cCore).lerp(cArm, t / 0.24);
      else if (t < 0.68) tmp.copy(cArm).lerp(cAccent, (t - 0.24) / 0.44);
      else tmp.copy(cAccent).lerp(cDeep, (t - 0.68) / 0.32);
      if (rand() > 0.94) {
        bright = 1.5 + rand() * 0.7;
        size *= 2.1;
        tmp.lerp(cCore, 0.45);
      }
      tmp.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06);
    } else {
      const arm = i % armCount;
      const t = 0.18 + 0.82 * Math.sqrt(rand());
      r = R * armR(t) * (0.96 + rand() * 0.04);
      theta = armPhase + arm * armSep + t * turns - 0.13 + gauss() * 0.07;
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1));
  geometry.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
  geometry.setAttribute('aHeight', new THREE.BufferAttribute(aHeight, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geometry.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);

  let spinTime = rand() * 80;
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSpinTime: { value: spinTime },
      uFocus: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0.92 },
      uBrightness: { value: 1 },
    },
  });
  group.add(new THREE.Points(geometry, cloudMat));

  const buildSmoke = (smokeCount: number, dustLayer: boolean) => {
    const sRadius = new Float32Array(smokeCount);
    const sTheta = new Float32Array(smokeCount);
    const sHeight = new Float32Array(smokeCount);
    const sSize = new Float32Array(smokeCount);
    const sPhase = new Float32Array(smokeCount);
    const sRot = new Float32Array(smokeCount);
    const sVariant = new Float32Array(smokeCount);
    const sColor = new Float32Array(smokeCount * 3);
    const sAlpha = new Float32Array(smokeCount);
    for (let i = 0; i < smokeCount; i++) {
      const arm = i % armCount;
      const t = dustLayer ? 0.15 + 0.85 * Math.sqrt(rand()) : Math.pow(rand(), 0.85);
      const r = R * (0.06 + 0.94 * Math.pow(t, rExp));
      const spread = dustLayer ? 0.1 + 0.12 * t : 0.16 + 0.22 * t;
      sRadius[i] = r;
      sTheta[i] = armPhase + arm * armSep + t * turns + gauss() * spread + (dustLayer ? -0.14 : 0);
      sHeight[i] = gauss() * R * 0.05 * (0.55 + t);
      const big = rand() > 0.6;
      sSize[i] = dustLayer
        ? (big ? 34 + rand() * 26 : 16 + rand() * 18)
        : (big ? 40 + rand() * 34 : 18 + rand() * 22);
      sPhase[i] = rand();
      sRot[i] = (rand() - 0.5) * 0.45;
      sVariant[i] = (rand() * 4) | 0;
      if (dustLayer) {
        tmp.copy(cDust).lerp(cDeep, 0.15 + rand() * 0.75);
        sAlpha[i] = 0.18 + rand() * 0.14;
      } else {
        if (t < 0.3) tmp.copy(cCore).lerp(cArm, t / 0.3);
        else tmp.copy(cArm).lerp(cAccent, (t - 0.3) / 0.7);
        tmp.multiplyScalar(0.82);
        sAlpha[i] = 0.09 + rand() * 0.09;
      }
      sColor[i * 3] = tmp.r;
      sColor[i * 3 + 1] = tmp.g;
      sColor[i * 3 + 2] = tmp.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(smokeCount * 3), 3));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(sRadius, 1));
    geo.setAttribute('aTheta', new THREE.BufferAttribute(sTheta, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(sHeight, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
    geo.setAttribute('aRotSpeed', new THREE.BufferAttribute(sRot, 1));
    geo.setAttribute('aVariant', new THREE.BufferAttribute(sVariant, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(sColor, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: dustLayer ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uSpinTime: { value: spinTime },
        uFocus: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uMap: { value: assets.smoke },
        uOpacity: { value: 1 },
        uLightGain: { value: dustLayer ? 0.35 : 0.55 },
      },
    });
    group.add(new THREE.Points(geo, mat));
    return mat;
  };

  const gasMat = buildSmoke(130, false);
  const dustMat = buildSmoke(70, true);
  const mistMat = new THREE.ShaderMaterial({
    vertexShader: MISTDISK_VERT,
    fragmentShader: MISTDISK_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSpinTime: { value: spinTime },
      uFocus: { value: 0 },
      uOpacity: { value: 0.27 },
      uArmPhase: { value: armPhase },
      uArmCount: { value: armCount },
      uRExpInv: { value: 1 / rExp },
      uTurns: { value: turns },
      uRadius: { value: R },
      uSeed: { value: rand() * 40 },
      uCore: { value: new THREE.Color(CORE_WHITE).multiplyScalar(0.85) },
      uArm: { value: cArm.clone() },
      uAccent: { value: cAccent.clone().multiplyScalar(0.8) },
    },
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.15, R * 2.15), mistMat);
  mist.rotation.x = -Math.PI / 2;
  group.add(mist);

  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: assets.glow,
    color: new THREE.Color(CORE_WHITE),
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  core.scale.setScalar(R * 0.42);
  group.add(core);

  const veil = new THREE.Sprite(new THREE.SpriteMaterial({
    map: assets.glow,
    color: cArm,
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  veil.scale.setScalar(R * 1.9);
  group.add(veil);

  let dim = 1;
  let dimTarget = 1;
  const setDimmed = (dimmed: boolean) => { dimTarget = dimmed ? 0 : 1; };
  const tick = (dt: number, audio: StableNebulaAudio, cameraDistance: number) => {
    spinTime += dt * (0.5 + audio.bass * 0.28);
    dim += (dimTarget - dim) * Math.min(1, dt * 3.5);
    cloudMat.uniforms.uSpinTime.value = spinTime;
    gasMat.uniforms.uSpinTime.value = spinTime;
    dustMat.uniforms.uSpinTime.value = spinTime;
    mistMat.uniforms.uSpinTime.value = spinTime;
    cloudMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.045, 0.92, dim);
    gasMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.025, 1, dim);
    dustMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.08, 1, dim);
    mistMat.uniforms.uOpacity.value = 0.27 * dim;
    // Keep the whole body stable: only light breathes with playback, geometry never shakes/scales.
    (core.material as THREE.SpriteMaterial).opacity = (0.72 + audio.intensity * 0.18) * THREE.MathUtils.lerp(0.02, 1, dim);
    const veilFade = THREE.MathUtils.clamp(1 - (cameraDistance - 420) / 900, 0.18, 1);
    (veil.material as THREE.SpriteMaterial).opacity = 0.055 * veilFade * THREE.MathUtils.lerp(0.02, 1, dim);
  };

  return { group, cloudMat, gasMat, dustMat, mistMat, core, veil, radius: R, tick, setDimmed };
}
