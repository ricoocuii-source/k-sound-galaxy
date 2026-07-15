# Design QA — Stable 3D Singer Galaxies

## Source of truth

- User requirements: preserve real 3D volume, use the ordinary default visual state in orbit, and remove shake.
- Default-state visual reference: `/tmp/k-sound-galaxy-stable-cruise.png`
- Implementation: `http://127.0.0.1:3020/proto7.html`
- Viewport: 1280 × 720
- State: BTS orbit view with ship and HUD visible

## Evidence

- Orbit capture A: `/tmp/k-sound-galaxy-stable-orbit-a.png`
- Orbit capture B, 5.2 seconds later: `/tmp/k-sound-galaxy-stable-orbit-b.png`
- Full-view default-versus-orbit comparison: `/tmp/k-sound-galaxy-default-vs-orbit.png`
- Focused stability comparison: `/tmp/k-sound-galaxy-stability-comparison.png`

## Findings and iteration history

1. P1 — Camera-facing billboard made each singer galaxy read as a flat plane.
   - Fix: removed the per-frame camera-facing quaternion and assigned each galaxy a stable, oblique world-space orientation.
   - Post-fix evidence: the orbit captures show visible depth and changing perspective from the moving camera rather than a face-on sprite.
2. P1 — Entering orbit activated a scale, opacity and white-tint highlight.
   - Fix: removed all focus-specific scale, opacity, point-size and tint changes. Orbit now uses the same default particle material and scale as cruise.
   - Post-fix evidence: `/tmp/k-sound-galaxy-default-vs-orbit.png` shows consistent particle treatment between default and orbit states.
3. P2 — Audio-reactive scale pulse and orbit camera bob made the galaxy appear to shake.
   - Fix: removed bass-driven galaxy scale pulsing and the vertical sine bob from the orbit camera.
   - Post-fix evidence: the two orbit captures taken 5.2 seconds apart remain visually stable while the camera continues its smooth orbit.

## Required fidelity surfaces

- Fonts and typography: unchanged.
- Spacing and layout rhythm: HUD, ship and song-orbit layout unchanged.
- Colors and visual tokens: focused singer keeps its ordinary artist tint; no focus whitening or activation glow.
- Image quality and asset fidelity: supplied 50k-point glTF model remains the visible singer-galaxy asset.
- Copy and content: unchanged.

## Browser checks

- Page identity matches Prototype v7 at port 3020.
- Point fire enters cruise mode.
- Clicking a singer enters orbit mode and loads 12 song targets.
- No framework overlay or application error observed.
- Existing non-blocking `THREE.Clock` deprecation warning remains.

## Remaining differences

- P3 intentional: a slow, continuous model rotation remains to provide depth; there is no random shake, scale pulse or camera-facing correction.

final result: passed
