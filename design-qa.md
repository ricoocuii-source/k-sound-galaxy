# Design QA — Bezier Stable song stars

- Source visual truth: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-c0d00b85-30bb-4ac0-aecc-a1d039114e9c.png`
- Implementation screenshot: `/tmp/k-sound-star-final-2.png`
- Combined focused comparison: `/tmp/k-sound-star-compare-2.png`
- URL: `http://127.0.0.1:3020/proto7.html`
- Viewport: 1280 × 720 desktop
- State: BLACKPINK artist orbit, 12 song stars visible

## Full-view comparison evidence

The implementation preserves the current Planetfall camera, ship, HUD, and nebula while replacing every vinyl disc with a white diffraction-spike song star. All 12 song names remain visible and follow their stars on the rotating spiral arms. No bottom player or right drawer is visible.

## Focused region comparison evidence

The combined comparison places the supplied Bezier Stable crop beside the implementation's artist-nebula crop. Both use a hot white stellar core, long horizontal/vertical diffraction spikes, small neutral song titles, and song nodes distributed through the particle arms. The implementation intentionally contains more simultaneous song nodes because the selected artist has 12 tracks.

## Required fidelity surfaces

- Fonts and typography: compact neutral sans labels, light weight, tight line height, subtle tracking, and dark-space text shadow match the reference hierarchy.
- Spacing and layout rhythm: song stars are spread 20% farther along the arms and labels use alternating offsets to prevent the 12-track set collapsing into the core.
- Colors and visual tokens: near-white star color with a restrained artist-color tint matches the reference without changing the existing palette.
- Image quality and asset fidelity: the original Bezier Stable diffraction texture is reused; no CSS or placeholder star replaces it.
- Copy and content: real song titles are retained; no tracks are removed or renamed.

## Findings

No actionable P0, P1, or P2 mismatch remains for the requested song-star replacement.

## Comparison history

1. First pass: vinyl discs were removed, but the 12 labels clustered around the core and the diffraction spikes were too subdued.
2. Fix: expanded song-arm radius, staggered and tightened labels, increased star size, and pulled star color toward white.
3. Post-fix evidence: `/tmp/k-sound-star-compare-2.png` shows distinct cross-shaped bright stars and readable distributed labels.

## Interaction checks

- Point at song star → hover target resolves to the correct song.
- Click song star → Time Mirror opens and preview audio plays.
- ESC → returns to artist orbit and restores all 12 labels.
- Console → no application errors; only the existing Three.js `Clock` deprecation warning.

## Follow-up polish

- P3: artists with unusually long song names can still produce occasional label overlap during rotation; hover remains fully readable.

final result: passed
