# Design QA — Singer Galaxy Scale and Density

## Source of truth

- Reference: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-d0cb5871-94a8-4676-b24c-87e0f94a0162.png`
- Implementation: `http://127.0.0.1:3020/proto7.html`
- Viewport: 1280 × 720
- State: TWICE orbit view, ship and HUD retained

## Evidence

- Final orbit screenshot: `/tmp/k-sound-ratio-final-browser-orbit.png`
- Full comparison: `/tmp/k-sound-design-qa-final-full.png`
- Focused comparison: `/tmp/k-sound-design-qa-final-focus.png`

## Required fidelity surfaces

- Typography: unchanged; the request concerns spatial hierarchy and particle treatment.
- Layout hierarchy: singer galaxy is now the dominant object; song discs are subordinate satellites.
- Color: focused galaxy is neutral silver-white with RGB separation removed.
- Asset fidelity: continues to render the supplied 50k-point glTF particle model.
- Copy: unchanged.

## Iteration history

1. Baseline: singer galaxy was too small and sparse; song discs and glow competed with it.
2. First pass: hierarchy was corrected, but the focused galaxy was oversized, coarse and overly chromatic.
3. Final pass: scale, point size, opacity and neutral tint were refined; song discs and glow were reduced; invisible hit targets preserve song clickability.

## Interaction and browser checks

- Point fire enters cruise mode.
- W/V flight controls respond.
- Clicking a singer galaxy enters orbit mode.
- Clicking a small song target enters surface mode.
- No application errors or Vite error overlay observed.
- Existing non-blocking `THREE.Clock` deprecation warning remains.

## Remaining differences

- P3 intentional: the implementation retains the ship, HUD and starfield, so it is busier than the pure-black reference.
- P3 intentional: the galaxy silhouette follows the supplied glTF asset rather than copying the reference particle geometry.

final result: passed
