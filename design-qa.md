# Design QA — Singer Galaxy Distance Consistency

## Source of truth

- Far-view issue reference: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-1a59b3f9-4fd0-482a-b500-c8f4afec4ada.png`
- Near-view issue reference: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-ccf44597-ab60-46e9-a32f-85ad3f90fccf.png`
- Implementation: `http://127.0.0.1:3020/proto7.html`
- Viewport: 1280 × 720
- States: cruise far view and BTS orbit near view

## Evidence

- Rendered far view: `/tmp/k-sound-galaxy-lod-far-v1.png`
- Rendered near view: `/tmp/k-sound-galaxy-lod-near-v1.png`
- Full-view comparison: `/tmp/k-sound-galaxy-lod-full-comparison.png`
- Focused source-versus-implementation comparison: `/tmp/k-sound-galaxy-lod-focused-comparison.png`

## Findings and comparison history

1. P1 — Fixed screen-space particle size caused severe distance drift.
   - Earlier evidence: the supplied far screenshot compresses the galaxy into an overexposed white mass, while the near screenshot spreads the same 50k points into a sparse mesh.
   - Fix: enabled perspective point-size attenuation on the real glTF particle material.
   - Post-fix evidence: the rendered far and near states preserve comparable core brightness, particle coverage and arm visibility. Near particles grow naturally with proximity instead of being spread into a thin grid.

No actionable P0, P1 or P2 mismatch remains for the requested distance-consistency surface.

## Required fidelity surfaces

- Fonts and typography: unchanged.
- Spacing and layout rhythm: HUD, ship, camera path and song-orbit layout unchanged.
- Colors and visual tokens: artist tint, opacity and non-highlighted default state unchanged.
- Image quality and asset fidelity: the supplied 50k-point glTF remains the visible singer-galaxy asset; only its physically correct perspective sizing changed.
- Copy and content: unchanged.

## Browser checks

- Page identity matches Prototype v7 at port 3020.
- Point fire enters cruise mode and provides the far-view evidence.
- Clicking BTS enters orbit mode and provides the near-view evidence.
- No framework overlay or application error observed.
- Existing non-blocking `THREE.Clock` deprecation warning remains.

## Remaining risk

- P3 expected: a close galaxy occupies more screen area than a distant one; the fix unifies particle density and brightness, not physical perspective scale.

final result: passed
