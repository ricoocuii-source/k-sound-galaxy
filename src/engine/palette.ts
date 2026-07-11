/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Refined nebula color system.
 *
 * Design rules (after the Penderecki's Garden study):
 *  - One shared warm-white core temperature for EVERY galaxy — like real
 *    deep-space photography, only the arms/dust differ.
 *  - 8 low-saturation color families instead of 25 saturated UI colors.
 *    Color is an accent, not a fill: most particles stay near warm white.
 *  - Every family carries: arm (theme/UI color), accent (bright neighbor),
 *    dust (dark warm dust), deep (outer-edge falloff).
 */

export const CORE_WHITE = '#ffe9c8';
export const SPACE_BG = '#05060a';

export interface NebulaPalette {
  arm: string;
  accent: string;
  dust: string;
  deep: string;
}

export const FAMILIES: Record<string, NebulaPalette> = {
  gold:   { arm: '#c9a06a', accent: '#ecd0a0', dust: '#7a5a3a', deep: '#3c2e22' },
  rose:   { arm: '#c98a8f', accent: '#eab8b4', dust: '#7a4a50', deep: '#3a262b' },
  indigo: { arm: '#8d85c6', accent: '#b9b3e6', dust: '#4a4270', deep: '#262238' },
  teal:   { arm: '#7cb3b5', accent: '#aadcd6', dust: '#3e5f63', deep: '#20302f' },
  blue:   { arm: '#8fa6c9', accent: '#c2d2ec', dust: '#46536e', deep: '#232936' },
  mauve:  { arm: '#b08bb5', accent: '#dab8dc', dust: '#5e4463', deep: '#2e2331' },
  copper: { arm: '#bd7f63', accent: '#e6ad8c', dust: '#6e452f', deep: '#35251c' },
  sage:   { arm: '#a3b08a', accent: '#ccd8ae', dust: '#55603f', deep: '#2a2f21' },
};

/** linear mix of two hex colors, t in 0..1 */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

// Global harmony pass: pull every family a little toward one shared cosmic
// silver, so the eight hues read as one night sky instead of eight pigments.
const COSMIC_SILVER = '#aab2c4';
for (const p of Object.values(FAMILIES)) {
  p.arm = mixHex(p.arm, COSMIC_SILVER, 0.12);
  p.accent = mixHex(p.accent, COSMIC_SILVER, 0.12);
}

/** legacy Tailwind hex (as authored in data.ts) → family key */
const LEGACY_TO_FAMILY: Record<string, keyof typeof FAMILIES> = {
  '#A855F7': 'indigo', // BTS
  '#F472B6': 'rose',   // BLACKPINK
  '#FF5E97': 'mauve',  // TWICE
  '#EF4444': 'copper', // Stray Kids
  '#34D399': 'sage',   // IVE
  '#60A5FA': 'blue',   // LE SSERAFIM
  '#3B82F6': 'teal',   // IU
  '#00E5FF': 'gold',   // G-Dragon
  '#0EA5E9': 'blue',   // SUGA
  '#6366F1': 'blue',   // Taeyeon
  '#10B981': 'sage',   // JENNIE
  '#06B6D4': 'teal',   // ROSÉ / SHINee
  '#F59E0B': 'gold',   // LISA
  '#8B5CF6': 'indigo', // NewJeans
  '#C084FC': 'mauve',  // aespa
  '#818CF8': 'blue',   // SEVENTEEN
  '#E11D48': 'rose',   // Red Velvet
  '#A3E635': 'sage',   // NCT 127
  '#22D3EE': 'teal',   // TXT
  '#94A3B8': 'blue',   // EXO
  '#DC2626': 'copper', // BABYMONSTER
  '#F43F5E': 'rose',   // ITZY
  '#FBBF24': 'gold',   // BIGBANG
  '#6D28D9': 'indigo', // Jungkook
};

/** Map a legacy data color to its refined arm color (UI theme color). */
export function refineColor(legacyHex: string): string {
  const fam = LEGACY_TO_FAMILY[legacyHex.toUpperCase()];
  return fam ? FAMILIES[fam].arm : legacyHex;
}

/** Full palette lookup from a refined arm color (falls back to indigo). */
const ARM_TO_PALETTE = new Map<string, NebulaPalette>(
  Object.values(FAMILIES).map((p) => [p.arm.toLowerCase(), p])
);
export function paletteFor(armHex: string): NebulaPalette {
  return ARM_TO_PALETTE.get(armHex.toLowerCase()) || FAMILIES.indigo;
}
