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
  makeStarSpikeTexture,
} from '../engine/GalaxyEngine';
import { CORE_WHITE, paletteFor } from '../engine/palette';

export interface StableNebulaAssets {
  glow: THREE.Texture;
  smoke: THREE.Texture;
  spike: THREE.Texture;
}

export interface StableNebulaAudio {
  intensity: number;
  bass: number;
}

interface MorphologyFamily {
  name: string;
  armCount: number;
  turns: number;
  rExp: number;
  innerRadius: number;
  armSpread: number;
  bodyArmBias: number;
  warpAmp: number;
  warpFreq: number;
  fragmentation: number;
  ringBias: number;
  ringRadius: number;
  ringWidth: number;
  barBias: number;
  thickness: number;
  ellipticity: number;
  lopsidedness: number;
  gasFill: number;
  cloudScale: number;
  coreScale: number;
  veilX: number;
  veilY: number;
  coreMass: number;
  armMass: number;
  bodyMass: number;
  ringMass: number;
  barMass: number;
  tailMass: number;
  dustMass: number;
}

// Six spatial families share the exact same materials, palette and rendering
// pipeline. What changes is their anatomy: winding, arm count, ring/bar mass,
// thickness, asymmetry and gas distribution. Artist index cycles through the
// set, while the seeded micro-variation keeps siblings from looking cloned.
const MORPHOLOGY_FAMILIES: MorphologyFamily[] = [
  {
    name: 'grand-design', armCount: 2, turns: 1.42, rExp: 1.02, innerRadius: 0.14,
    armSpread: 0.24, bodyArmBias: 0.3, warpAmp: 0.055, warpFreq: 3.6, fragmentation: 0.12,
    ringBias: 0, ringRadius: 0.58, ringWidth: 0.06, barBias: 0.12,
    thickness: 0.065, ellipticity: 0.035, lopsidedness: 0.055, gasFill: 0.52,
    cloudScale: 1.02, coreScale: 0.22, veilX: 2.08, veilY: 1.88,
    coreMass: 0.12, armMass: 0.28, bodyMass: 0.53, ringMass: 0, barMass: 0,
    tailMass: 0, dustMass: 0.07,
  },
  {
    name: 'open-three-arm', armCount: 3, turns: 1.18, rExp: 0.9, innerRadius: 0.09,
    armSpread: 0.28, bodyArmBias: 0.26, warpAmp: 0.12, warpFreq: 4.3, fragmentation: 0.2,
    ringBias: 0, ringRadius: 0.6, ringWidth: 0.07, barBias: 0,
    thickness: 0.08, ellipticity: 0.085, lopsidedness: 0.08, gasFill: 0.56,
    cloudScale: 1.08, coreScale: 0.19, veilX: 2.2, veilY: 2.02,
    coreMass: 0.09, armMass: 0.24, bodyMass: 0.6, ringMass: 0, barMass: 0,
    tailMass: 0, dustMass: 0.07,
  },
  {
    name: 'flocculent', armCount: 7, turns: 2.12, rExp: 1.26, innerRadius: 0.055,
    armSpread: 0.38, bodyArmBias: 0.18, warpAmp: 0.17, warpFreq: 7.4, fragmentation: 0.52,
    ringBias: 0, ringRadius: 0.56, ringWidth: 0.08, barBias: 0,
    thickness: 0.11, ellipticity: 0.055, lopsidedness: 0.11, gasFill: 0.64,
    cloudScale: 0.94, coreScale: 0.16, veilX: 2.3, veilY: 2.22,
    coreMass: 0.07, armMass: 0.14, bodyMass: 0.72, ringMass: 0, barMass: 0,
    tailMass: 0, dustMass: 0.07,
  },
  {
    name: 'ringed-spiral', armCount: 4, turns: 1.38, rExp: 1.08, innerRadius: 0.12,
    armSpread: 0.27, bodyArmBias: 0.22, warpAmp: 0.085, warpFreq: 5.2, fragmentation: 0.18,
    ringBias: 0.38, ringRadius: 0.57, ringWidth: 0.18, barBias: 0.06,
    thickness: 0.072, ellipticity: 0.11, lopsidedness: 0.045, gasFill: 0.58,
    cloudScale: 1, coreScale: 0.26, veilX: 2.16, veilY: 1.96,
    coreMass: 0.1, armMass: 0.08, bodyMass: 0.75, ringMass: 0, barMass: 0,
    tailMass: 0, dustMass: 0.07,
  },
  {
    name: 'barred-spiral', armCount: 2, turns: 1.72, rExp: 1.12, innerRadius: 0.23,
    armSpread: 0.24, bodyArmBias: 0.28, warpAmp: 0.075, warpFreq: 4.6, fragmentation: 0.16,
    ringBias: 0, ringRadius: 0.6, ringWidth: 0.06, barBias: 0.78,
    thickness: 0.09, ellipticity: 0.14, lopsidedness: 0.07, gasFill: 0.55,
    cloudScale: 1.05, coreScale: 0.2, veilX: 2.28, veilY: 1.9,
    coreMass: 0.08, armMass: 0.21, bodyMass: 0.52, ringMass: 0, barMass: 0.12,
    tailMass: 0, dustMass: 0.07,
  },
  {
    name: 'diffuse-asymmetric', armCount: 5, turns: 1.35, rExp: 0.96, innerRadius: 0.07,
    armSpread: 0.42, bodyArmBias: 0.15, warpAmp: 0.145, warpFreq: 6.1, fragmentation: 0.4,
    ringBias: 0.1, ringRadius: 0.67, ringWidth: 0.11, barBias: 0,
    thickness: 0.135, ellipticity: 0.12, lopsidedness: 0.2, gasFill: 0.68,
    cloudScale: 1.18, coreScale: 0.14, veilX: 2.42, veilY: 2.28,
    coreMass: 0.06, armMass: 0.07, bodyMass: 0.7, ringMass: 0, barMass: 0,
    tailMass: 0.1, dustMass: 0.07,
  },
];

export interface StableNebulaVisual {
  group: THREE.Group;
  cloudMat: THREE.ShaderMaterial;
  gasMat: THREE.ShaderMaterial;
  dustMat: THREE.ShaderMaterial;
  mistMat: THREE.ShaderMaterial;
  core: THREE.Sprite;
  radius: number;
  morphology: string;
  tick: (dt: number, audio: StableNebulaAudio, cameraDistance: number) => void;
  setDimmed: (dimmed: boolean) => void;
  songPosition: (index: number, total: number, out: THREE.Vector3) => THREE.Vector3;
}

export function createStableNebulaAssets(): StableNebulaAssets {
  return { glow: makeGlowTexture(), smoke: makeSmokeAtlas(), spike: makeStarSpikeTexture() };
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
  color: string;
  radius: number;
  assets: StableNebulaAssets;
  pixelRatio: number;
  morphologyIndex?: number;
}): StableNebulaVisual {
  const { id, color, radius: R, assets, pixelRatio, morphologyIndex = 0 } = options;
  const detailScale = THREE.MathUtils.clamp(R / 94, 0.7, 1.2);
  const palette = paletteFor(color);
  const group = new THREE.Group();
  group.name = `stable_nebula_${id}`;

  const rand = seeded(id);
  const gauss = () => rand() + rand() + rand() - 1.5;
  const normal = () => {
    const u = Math.max(rand(), 1e-6);
    return THREE.MathUtils.clamp(
      Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * rand()),
      -2.4,
      2.4,
    );
  };
  const family = MORPHOLOGY_FAMILIES[Math.abs(morphologyIndex) % MORPHOLOGY_FAMILIES.length];
  const handedness = rand() > 0.5 ? 1 : -1;
  const armDelta = rand() > 0.62 ? (rand() > 0.5 ? 1 : -1) : 0;
  const morphology = {
    ...family,
    armCount: THREE.MathUtils.clamp(family.armCount + armDelta, 2, 9),
    turns: family.turns * (0.86 + rand() * 0.28) * handedness,
    rExp: family.rExp * (0.94 + rand() * 0.12),
    innerRadius: family.innerRadius * (0.82 + rand() * 0.36),
    armSpread: family.armSpread * (0.9 + rand() * 0.22),
    bodyArmBias: THREE.MathUtils.clamp(family.bodyArmBias + (rand() - 0.5) * 0.24, 0.12, 0.82),
    warpAmp: family.warpAmp * (0.86 + rand() * 0.28),
    fragmentation: THREE.MathUtils.clamp(family.fragmentation + (rand() - 0.5) * 0.2, 0.04, 0.68),
    ringRadius: THREE.MathUtils.clamp(family.ringRadius + (rand() - 0.5) * 0.13, 0.46, 0.72),
    ringWidth: family.ringWidth * (0.78 + rand() * 0.5),
    barBias: family.barBias * (0.86 + rand() * 0.26),
    thickness: family.thickness * (0.9 + rand() * 0.22),
    ellipticity: family.ellipticity * (0.82 + rand() * 0.34),
    lopsidedness: family.lopsidedness * (0.78 + rand() * 0.44),
    gasFill: THREE.MathUtils.clamp(family.gasFill + (rand() - 0.5) * 0.13, 0.4, 0.76),
    cloudScale: family.cloudScale * (0.88 + rand() * 0.24),
    coreScale: family.coreScale * (0.86 + rand() * 0.28),
    veilX: family.veilX * (0.9 + rand() * 0.2),
    veilY: family.veilY * (0.9 + rand() * 0.2),
  };
  group.userData.morphology = morphology.name;
  const tiltAxis = new THREE.Vector3(Math.cos(rand() * Math.PI * 2), 0, Math.sin(rand() * Math.PI * 2)).normalize();
  // Lift the disk toward the pilot's orbital view so the vortex is readable,
  // while retaining a real fixed 3D inclination instead of billboard facing.
  group.quaternion.setFromAxisAngle(tiltAxis, 0.78 + rand() * 0.22);

  const armCount = morphology.armCount;
  const turns = Math.PI * morphology.turns;
  const rExp = morphology.rExp;
  const armR = (t: number) => morphology.innerRadius
    + (1 - morphology.innerRadius) * Math.pow(t, rExp);
  const armPhase = rand() * Math.PI * 2;
  const armSep = (Math.PI * 2) / armCount;
  const shapePhase = rand() * Math.PI * 2;
  const laneWarpAt = (t: number, arm: number) =>
    Math.sin(t * Math.PI * morphology.warpFreq + arm * 1.73)
      * morphology.warpAmp * (0.62 + t * 0.72);
  const shapeRadius = (radius: number, theta: number, t: number) => radius * (
    1
    + morphology.ellipticity * Math.cos((theta - shapePhase) * 2)
    + morphology.lopsidedness * Math.cos(theta - shapePhase * 0.73) * t
  );

  // Every arm gets its own pitch, width, extent and density. The arm curve is
  // now only a buried density field; these offsets prevent a repeated spiral
  // stamp while keeping the same particles, smoke atlas and shaders.
  const armProfiles = Array.from({ length: armCount }, (_, index) => ({
    index,
    phase: (rand() - 0.5) * armSep * 0.3,
    pitch: 0.82 + rand() * 0.36,
    width: 0.72 + rand() * 0.72,
    weight: 0.58 + rand() * 0.86,
    start: rand() * 0.15,
    end: 0.73 + rand() * 0.25,
    flowPhase: rand() * Math.PI * 2,
    verticalPhase: rand() * Math.PI * 2,
  }));
  const armWeightTotal = armProfiles.reduce((sum, profile) => sum + profile.weight, 0);
  const pickArmProfile = () => {
    let ticket = rand() * armWeightTotal;
    for (const profile of armProfiles) {
      ticket -= profile.weight;
      if (ticket <= 0) return profile;
    }
    return armProfiles[armProfiles.length - 1];
  };
  const armThetaAt = (t: number, profile: (typeof armProfiles)[number]) =>
    armPhase + profile.index * armSep + profile.phase
      + t * turns * profile.pitch + laneWarpAt(t, profile.index);
  const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

  type HeightLayer = 'arm' | 'body' | 'ring' | 'bar' | 'tail' | 'gas' | 'dust';
  const HEIGHT_MIX: Record<HeightLayer, [number, number, number]> = {
    arm: [0.72, 0.24, 0.04],
    body: [0.48, 0.43, 0.09],
    ring: [0.76, 0.21, 0.03],
    bar: [0.58, 0.36, 0.06],
    tail: [0.33, 0.48, 0.19],
    gas: [0.35, 0.5, 0.15],
    dust: [0.62, 0.33, 0.05],
  };
  const heightPhaseA = rand() * Math.PI * 2;
  const heightPhaseB = rand() * Math.PI * 2;
  const heightRateA = 1.45 + rand() * 0.8;
  const heightRateB = 3.2 + rand() * 1.5;
  const sampleHeight = (
    layer: HeightLayer,
    theta: number,
    t: number,
    localPhase = 0,
  ) => {
    const weights = HEIGHT_MIX[layer];
    const roll = rand();
    const layerScale = roll < weights[0]
      ? 0.35
      : roll < weights[0] + weights[1]
        ? 0.88
        : 1.62;
    const radialProfile = layer === 'gas'
      ? 0.78 + 0.42 * t
      : layer === 'tail'
        ? 0.85 + 0.55 * t
        : 1.08 - 0.32 * t;
    const coherentLift = (
      Math.sin(theta * heightRateA + t * Math.PI * 1.7 + heightPhaseA + localPhase) * 0.68
      + Math.sin(theta * heightRateB - t * Math.PI * 1.15 + heightPhaseB) * 0.32
    ) * R * morphology.thickness * (0.08 + 0.18 * t);
    const height = normal() * R * morphology.thickness * layerScale * radialProfile + coherentLift;
    return THREE.MathUtils.clamp(height, -R * 0.34, R * 0.34);
  };

  // Dense enough to read as a galaxy, but keep the nucleus from becoming an
  // additive white disk. Most of the extra mass lives in the arms and halo.
  // The procedural mist already supplies the continuous body. Keeping 5.6k
  // pinpoints preserves the silhouette while cutting refresh-time CPU work and
  // steady-state vertex load by 20% across all 25 systems.
  const count = 5600;
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
  const massTotal = morphology.coreMass + morphology.barMass + morphology.ringMass
    + morphology.armMass + morphology.bodyMass + morphology.tailMass + morphology.dustMass;
  const massScale = 1 / massTotal;
  const coreEnd = morphology.coreMass * massScale;
  const barEnd = coreEnd + morphology.barMass * massScale;
  const ringEnd = barEnd + morphology.ringMass * massScale;
  const armEnd = ringEnd + morphology.armMass * massScale;
  const bodyEnd = armEnd + morphology.bodyMass * massScale;
  const tailEnd = bodyEnd + morphology.tailMass * massScale;

  for (let i = 0; i < count; i++) {
    const kind = i / count;
    let r: number;
    let theta: number;
    let h: number;
    let size: number;
    let bright: number;
    if (kind < coreEnd) {
      r = Math.abs(gauss()) * R * (0.13 + morphology.coreScale * 0.24);
      theta = rand() * Math.PI * 2;
      const coreEnvelope = Math.sqrt(Math.max(
        0.08,
        1 - Math.pow(Math.min(1, r / (R * 0.34)), 2),
      ));
      h = normal() * R * (0.038 + morphology.coreScale * 0.13)
        * (0.5 + coreEnvelope * 0.5);
      size = 0.8 + rand() * 1.7;
      bright = 0.24 + rand() * 0.28;
      tmp.copy(cCore).lerp(cArm, 0.5 + rand() * 0.3);
    } else if (kind < barEnd) {
      // A true stellar bar gets its own mass instead of borrowing a few core
      // points. This makes barred galaxies readable from the outer silhouette.
      const x = (rand() * 2 - 1) * R * (0.18 + morphology.barBias * 0.34);
      const z = normal() * R * (0.07 + morphology.armSpread * 0.16);
      r = Math.hypot(x, z);
      theta = armPhase + Math.atan2(z, x);
      h = sampleHeight('bar', theta, THREE.MathUtils.clamp(r / R, 0, 1));
      size = 0.9 + rand() * 2.1;
      bright = 0.3 + rand() * 0.32;
      tmp.copy(cCore).lerp(cArm, 0.42 + rand() * 0.42);
    } else if (kind < ringEnd) {
      theta = rand() * Math.PI * 2;
      r = R * THREE.MathUtils.clamp(
        morphology.ringRadius + gauss() * morphology.ringWidth,
        0.22,
        0.96,
      );
      r = shapeRadius(r, theta, morphology.ringRadius);
      h = sampleHeight('ring', theta, morphology.ringRadius);
      size = 0.85 + rand() * 2.45;
      bright = 0.24 + rand() * 0.25;
      tmp.copy(cArm).lerp(rand() > 0.56 ? cAccent : cCore, 0.32 + rand() * 0.38);
    } else if (kind < armEnd) {
      const profile = pickArmProfile();
      const t = profile.start + Math.sqrt(rand()) * (profile.end - profile.start);
      const ridge = rand() < 0.05;
      const shoulderScale = ridge ? 0.68 : 1.2 + rand() * 1.5;
      const spread = morphology.armSpread * (0.72 + 0.88 * t)
        * profile.width * shoulderScale;
      const flowNoise = (
        Math.sin(t * Math.PI * (3.7 + morphology.fragmentation * 4.2) + profile.flowPhase) * 0.66
        + Math.sin(t * Math.PI * (8.1 + morphology.fragmentation * 5.4) - profile.flowPhase * 0.7) * 0.34
      );
      const curveTheta = armThetaAt(t, profile);
      const uniformTheta = rand() * Math.PI * 2;
      const curveLock = ridge ? 0.84 + rand() * 0.1 : 0.22 + rand() * 0.3;
      theta = uniformTheta + wrapAngle(curveTheta - uniformTheta) * curveLock + normal() * spread
        + flowNoise * morphology.fragmentation * (0.05 + t * 0.12);
      r = R * armR(t) * (
        1 + normal() * (0.025 + 0.045 * t + 0.03 * morphology.fragmentation)
      );
      r = shapeRadius(r, theta, t);
      h = sampleHeight('arm', theta, t, profile.verticalPhase);
      size = 0.85 + rand() * 2.4;
      bright = (0.27 + rand() * 0.3) * (0.92 + 0.08 * (0.5 + flowNoise * 0.5));
      if (t < 0.24) tmp.copy(cCore).lerp(cArm, t / 0.24);
      else if (t < 0.68) tmp.copy(cArm).lerp(cAccent, (t - 0.24) / 0.44);
      else tmp.copy(cAccent).lerp(cDeep, (t - 0.68) / 0.32);
      if (rand() > 0.955) {
        bright = 0.95 + rand() * 0.5;
        size *= 1.85;
        tmp.lerp(cCore, 0.45);
      }
      tmp.offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.06);
    } else if (kind < bodyEnd) {
      // The star field is the body of the galaxy, not decoration on two arms.
      // Keep a faint spiral bias while spreading most small stars across the
      // whole disk so particles, dust and fog read as one oval atmosphere.
      const profile = pickArmProfile();
      const t = rand() < 0.62 ? Math.pow(rand(), 1.18) : Math.sqrt(rand());
      const bodySpread = morphology.armSpread * 1.9 + (0.2 + 0.32 * t);
      const uniformTheta = rand() * Math.PI * 2;
      const armTheta = armThetaAt(t, profile);
      const lock = morphology.bodyArmBias * Math.pow(rand(), 1.6);
      theta = uniformTheta + wrapAngle(armTheta - uniformTheta) * lock
        + normal() * bodySpread * (0.34 + 0.62 * lock);
      r = R * armR(t) * (0.86 + rand() * 0.24 + normal() * 0.025);
      r = shapeRadius(r, theta, t);
      h = sampleHeight('body', theta, t, profile.verticalPhase * lock);
      size = 0.7 + rand() * 1.9;
      bright = 0.2 + rand() * 0.3;
      if (t < 0.28) tmp.copy(cCore).lerp(cArm, 0.55 + t);
      else if (t < 0.72) tmp.copy(cArm).lerp(cAccent, (t - 0.28) / 0.44);
      else tmp.copy(cAccent).lerp(cDeep, (t - 0.72) / 0.28);
      tmp.multiplyScalar(0.82 + rand() * 0.14);
      // Sparse bright pinpoints use the same particle material and make the
      // expanded disk sparkle beyond the original S-shaped ridges.
      if (rand() > 0.965) {
        bright = 0.72 + rand() * 0.38;
        size *= 1.45;
        tmp.lerp(cCore, 0.36);
      }
    } else if (kind < tailEnd) {
      // Diffuse systems gain a one-sided, curved tidal plume. It uses the same
      // particles and palette, but breaks the repeated circular silhouette.
      const t = Math.pow(rand(), 0.7);
      theta = shapePhase + 0.34 * Math.sin(t * Math.PI)
        + normal() * (0.15 + t * 0.25);
      r = R * (0.44 + t * 0.64) * (0.94 + rand() * 0.1);
      h = sampleHeight('tail', theta, t);
      size = 0.75 + rand() * 2.4;
      bright = (0.16 + rand() * 0.26) * (1 - t * 0.34);
      tmp.copy(cArm).lerp(cDeep, 0.45 + t * 0.42);
    } else {
      const profile = pickArmProfile();
      const t = 0.18 + 0.82 * Math.sqrt(rand());
      theta = rand() < (0.46 + morphology.gasFill * 0.16)
        ? rand() * Math.PI * 2
        : armThetaAt(t, profile) - 0.1
          + normal() * (morphology.armSpread * 1.5 + 0.2 + 0.28 * t);
      r = R * armR(t) * (0.88 + rand() * 0.2);
      r = shapeRadius(r, theta, t);
      h = sampleHeight('dust', theta, t, profile.verticalPhase);
      size = (2.2 + rand() * 3.2) * morphology.cloudScale;
      bright = 0.16 + rand() * 0.16;
      tmp.copy(cDust).lerp(cDeep, rand() * 0.5);
    }
    aRadius[i] = r;
    aTheta[i] = theta;
    aHeight[i] = h;
    aSize[i] = size * detailScale;
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
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.8);

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
      uOpacity: { value: 0.78 },
      uBrightness: { value: 0.86 },
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
      const profile = pickArmProfile();
      const t = dustLayer ? 0.15 + 0.85 * Math.sqrt(rand()) : Math.pow(rand(), 0.85);
      let r = R * armR(t);
      // Volumetric puffs fill the disk around the bright ridges. This is the
      // fullness change; the smoke atlas/material itself remains untouched.
      const spread = (dustLayer ? 0.16 + 0.28 * t : 0.22 + 0.38 * t)
        + morphology.armSpread * 0.8;
      const ringPuff = morphology.ringMass > 0 && rand() < morphology.ringMass * 0.6;
      const barPuff = !ringPuff && morphology.barMass > 0 && rand() < morphology.barMass * 0.6;
      const tailPuff = !ringPuff && !barPuff && morphology.tailMass > 0
        && rand() < morphology.tailMass * 0.6;
      const fillsDisk = !ringPuff && !barPuff && !tailPuff && rand() < (dustLayer
        ? 0.44 + morphology.gasFill * 0.18
        : 0.58 + morphology.gasFill * 0.22);
      let theta: number;
      let heightLayer: HeightLayer = dustLayer ? 'dust' : 'gas';
      if (ringPuff) {
        theta = rand() * Math.PI * 2;
        r = R * THREE.MathUtils.clamp(
          morphology.ringRadius + gauss() * morphology.ringWidth * 1.7,
          0.18,
          1.02,
        );
        heightLayer = 'ring';
      } else if (barPuff) {
        const x = (rand() * 2 - 1) * R * (0.2 + morphology.barBias * 0.32);
        const z = normal() * R * (0.075 + morphology.armSpread * 0.15);
        r = Math.hypot(x, z);
        theta = armPhase + Math.atan2(z, x);
        heightLayer = 'bar';
      } else if (tailPuff) {
        theta = shapePhase + 0.34 * Math.sin(t * Math.PI)
          + normal() * (0.16 + t * 0.24);
        r = R * (0.44 + t * 0.64) * (0.94 + rand() * 0.1);
        heightLayer = 'tail';
      } else {
        theta = fillsDisk
          ? rand() * Math.PI * 2
          : armThetaAt(t, profile)
            + normal() * spread * profile.width * (1.2 + rand() * 0.8)
            + (dustLayer ? -0.1 : 0);
      }
      sTheta[i] = theta;
      sRadius[i] = shapeRadius(r, theta, t) * (0.86 + rand() * 0.28);
      sHeight[i] = sampleHeight(heightLayer, theta, t, profile.verticalPhase);
      const big = rand() > 0.6;
      sSize[i] = dustLayer
        ? (big ? 42 + rand() * 34 : 22 + rand() * 24) * morphology.cloudScale * detailScale
        : (big ? 58 + rand() * 46 : 28 + rand() * 34) * morphology.cloudScale * detailScale;
      sPhase[i] = rand();
      sRot[i] = (rand() - 0.5) * 0.45;
      sVariant[i] = (rand() * 4) | 0;
      if (dustLayer) {
        tmp.copy(cDust).lerp(cDeep, rand() * 0.7);
        sAlpha[i] = 0.08 + rand() * 0.08;
      } else {
        if (t < 0.3) tmp.copy(cCore).lerp(cArm, t / 0.3);
        else tmp.copy(cArm).lerp(cAccent, (t - 0.3) / 0.7);
        tmp.multiplyScalar(0.82);
        sAlpha[i] = (0.035 + rand() * 0.05) * (0.45 + t * 0.55);
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
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.8);
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
        uLightGain: { value: dustLayer ? 0.24 : 0.32 },
      },
    });
    group.add(new THREE.Points(geo, mat));
    return mat;
  };

  const gasMat = buildSmoke(420, false);
  const dustMat = buildSmoke(180, true);
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
      uOpacity: { value: 0 },
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
  // The old continuous plane produced two broad dart/boomerang silhouettes
  // at grazing angles. Keep the material in the public interface, but remove
  // that flat mesh; the enlarged volumetric smoke field now supplies the body.

  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: assets.glow,
    color: new THREE.Color(CORE_WHITE),
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  core.scale.setScalar(R * morphology.coreScale);
  group.add(core);

  const veil = new THREE.Sprite(new THREE.SpriteMaterial({
    map: assets.glow,
    color: cArm,
    transparent: true,
    opacity: 0.032,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  veil.scale.set(R * morphology.veilX, R * morphology.veilY, 1);
  group.add(veil);

  let dim = 1;
  let dimTarget = 1;
  const setDimmed = (dimmed: boolean) => { dimTarget = dimmed ? 0 : 1; };
  const tick = (dt: number, audio: StableNebulaAudio, cameraDistance: number) => {
    const familySpin = morphology.barMass > 0 ? 0.44 : 1;
    spinTime += dt * (0.5 + audio.bass * 0.28) * handedness * familySpin;
    dim += (dimTarget - dim) * Math.min(1, dt * 3.5);
    cloudMat.uniforms.uSpinTime.value = spinTime;
    gasMat.uniforms.uSpinTime.value = spinTime;
    dustMat.uniforms.uSpinTime.value = spinTime;
    mistMat.uniforms.uSpinTime.value = spinTime;
    cloudMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.035, 0.78, dim);
    gasMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.025, 1, dim);
    dustMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.08, 1, dim);
    mistMat.uniforms.uOpacity.value = 0;
    // Keep the whole body stable: only light breathes with playback, geometry never shakes/scales.
    (core.material as THREE.SpriteMaterial).opacity = (0.18 + audio.intensity * 0.08) * THREE.MathUtils.lerp(0.015, 1, dim);
    // Keep the same low-energy body visible in overview; previously it faded
    // to 20%, leaving only unnaturally regular spiral ridges at long range.
    const veilFade = 1 - 0.42 * THREE.MathUtils.smoothstep(cameraDistance, 480, 950);
    (veil.material as THREE.SpriteMaterial).opacity = 0.032 * veilFade * THREE.MathUtils.lerp(0.02, 1, dim);
  };

  const songPosition = (index: number, total: number, out: THREE.Vector3) => {
    // Deterministic golden-angle scatter: songs cover the complete oval disk
    // instead of lining up along the former caterpillar-shaped spiral path.
    // A small seeded jitter keeps the layout organic without allowing clumps.
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const hash1 = Math.sin((index + 1) * 12.9898 + total * 3.17) * 43758.5453;
    const hash2 = Math.sin((index + 1) * 78.233 + total * 1.91) * 24634.6345;
    const jitter1 = hash1 - Math.floor(hash1);
    const jitter2 = hash2 - Math.floor(hash2);
    const radialSlot = (index + 0.58 + (jitter1 - 0.5) * 0.52) / Math.max(1, total);
    const radius = R * (0.2 + 0.72 * Math.sqrt(THREE.MathUtils.clamp(radialSlot, 0.04, 0.98)));
    const theta0 = armPhase + index * goldenAngle + (jitter2 - 0.5) * 0.72;
    const height = (jitter1 - 0.5) * R * 0.09;
    const speed = 0.185 * 0.82 + (1.6 / (Math.sqrt(radius) + 2)) * 0.18;
    const theta = theta0 + spinTime * speed;
    return out.set(Math.cos(theta) * radius, height, Math.sin(theta) * radius);
  };

  return {
    group, cloudMat, gasMat, dustMat, mistMat, core, radius: R,
    morphology: morphology.name,
    tick, setDimmed, songPosition,
  };
}
