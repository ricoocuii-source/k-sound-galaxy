# Planetfall visual QA

## Direct-to-cruise entry — 2026-07-16

- Requested change: remove the `着陆计划 / 点击点火` splash entirely.
- Implementation: the splash DOM and styles are removed; the state machine starts directly in `CRUISE`. Browser audio unlock is deferred to the first real pointer or keyboard gesture without blocking the visual experience.
- Browser evidence: `/tmp/k-sound-no-splash.png`. A full reload immediately renders the galaxy, ships, radar, and concise cruise hint; no splash heading or ignition control remains.
- Checks: passed. Page identity and DOM state show `巡航 CRUISE`, no framework overlay or application error, `git diff --check`, `npm run lint`, `npm run build`, and page HTTP `200` pass. Only the pre-existing Three.js `Clock` deprecation warning remains.

final result: passed

## Immersive HUD and copy cleanup — 2026-07-16

- Direction: preserve the existing sci-fi HUD and all galaxy, mirror, ship, audio, and free-drive behavior while removing persistent explanatory copy and duplicate instructions.
- Entry: passed. The start screen now contains only `着陆计划` and `点击点火 · 建议佩戴耳机`; keyboard Enter activates ignition, and inactive HUD is visually and semantically hidden.
- Cruise: passed. Persistent content is limited to brand, bilingual mode, radar/progress, one centred contextual hint, and collapsed `CREDITS`; the former three-line SHIP AI feed is removed.
- Orbit: passed. The singer card contains only name, localized name, song count, and collection count; song hover says `播放`, and the state hint says `点击歌曲播放 · 点击星系切换 · ESC 返回`.
- Mirror: passed. Playback keeps only mode, radar, and the relevant switch/return/pause/mute hint. Mute feedback uses a single live toast and Escape restores the concise orbit card.
- Credits and responsive layout: passed. Full attribution remains in a keyboard-accessible native disclosure. Verified at the default desktop viewport, 1280×720, and 820×900 without HUD overlap or clipped hint text.
- Evidence: `/tmp/k-sound-ui-cleanup-qa/01-entry.png`, `03-cruise.png`, `04-orbit.png`, `05-mirror.png`, `07-mirror-1280x720.png`, `08-return-orbit-1280x720.png`, and `09-orbit-820x900.png`.
- Console and build: passed. No application error or framework overlay; only the pre-existing Three.js `Clock` deprecation warning remains. `git diff --check`, `npm run lint`, `npm run build`, page HTTP `200`, and API health pass.

final result: passed

## Stable mirror exposure during song approach — 2026-07-16

- Root cause: the flight state used the galaxy bloom value (`0.7+`) even though the time mirror was already visible, then switched abruptly to mirror bloom (`0.16`) on the landing frame.
- Fix: bloom now follows the visible mirror object instead of the UI state. From mirror assembly through Bezier approach, landing, playback, and close, the value stays at `0.16`; music continues to drive particle erosion and motion without pumping the whole cover brightness.
- Browser flow: passed. `Taeyeon orbit -> INVU song click -> APPROACH early/mid -> TIME MIRROR landed`.
- Evidence: `/tmp/k-sound-exposure-stable-early.png`, `/tmp/k-sound-exposure-stable-mid.png`, and `/tmp/k-sound-exposure-stable-landed.png`. Cover colour, skin tone, title highlight, and edge particles remain visually consistent between mid-flight and landing.
- Checks: passed. `git diff --check`, `npm run lint`, `npm run build`, and page HTTP `200`.

final result: passed

## Song switch re-entry transition — 2026-07-16

- Requested behavior: switching songs during mirror playback must not translate the existing mirror rigidly across the galaxy; it must replay the arrival language.
- Implementation: the current cover first disperses in place, the old song light is restored, the new song light freezes as the next anchor, and the new mirror opens there only after the old close completes. The camera then reuses the original 2.35-second Bezier mirror approach before playback resumes.
- Browser interaction: passed. `BTS orbit -> Dynamite mirror -> click Spring Day -> APPROACH -> Spring Day mirror`. The transition log records `Spring Day · 重新锁定飞入`, and the state returns to `TIME MIRROR` only after the new arrival completes.
- Evidence: `/tmp/k-sound-song-switch-dissolve.png` (old Dynamite mirror dispersing in `APPROACH`) and `/tmp/k-sound-song-switch-flight.png` (new Spring Day cover assembled at its own song anchor).
- Interruption safety: a transition epoch prevents a stale close callback from reopening a song after Escape or singer switching interrupts the approach.
- Console and build: passed. No new browser error; `git diff --check`, `npm run lint`, `npm run build`, page HTTP `200`, and API health pass.

final result: passed

## Playback-state navigation and cover recovery — 2026-07-16

- Requested interaction: while a mirror track is playing, song stars and the other singer galaxies remain live targets instead of turning playback into a modal dead end.
- Song switching: passed. A real mirror run switched from the active song to `S-Class` and then `Megaverse` without leaving playback; the old song light was restored and the new light became the moving mirror anchor.
- Singer switching: implementation preserves the existing pick meshes during playback and routes a clicked non-focused singer through the existing Bezier `hyperjumpTo` flow; closing the mirror restores the previous song light and all free-drive state.
- Cover regression root cause: port 3020 was not running the Express + Vite server, so `/api/itunes/search` failed and the mirror rendered only its singer-color fallback.
- Fix: 3020 now runs the complete project server; failed cover lookups no longer poison the page cache permanently and become retryable after the local proxy recovers.
- Browser evidence: `/tmp/k-sound-mirror-cover-loaded.png` shows the real `God's Menu` artwork rendered as image particles inside the still-visible Stray Kids nebula.
- Proxy checks: passed. `/api/health` returns `200`; the `God's Menu` search returns Apple metadata; the proxied `Megaverse` JPEG returns `200 image/jpeg` with 427,767 bytes.
- Console and build: passed. No browser error after the final cover run; `npm run lint`, `npm run build`, `git diff --check`, page HTTP `200`, and API health all pass.

final result: passed

## Mirror remains inside the singer nebula — 2026-07-16

- User evidence: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-d4f4eebd-ebe2-4f9c-850e-2a0e383e8638.png`.
- Requested spatial model: the time mirror replaces one selected song light inside the current singer galaxy; it is not a separate deep-space stage.
- Fix: keep the focused singer root and nebula fully visible, hide only unrelated singers, keep the other song lights present, freeze the selected hidden song anchor, and restore that light after mirror close.
- Combined comparison: `/tmp/k-sound-nebula-mirror-compare.png`.
- Final browser evidence: `/tmp/k-sound-mirror-inside-singer-nebula.png`.
- Interaction flow: passed. Ignition -> singer hover -> Bezier orbit -> real song-star click -> mirror inside visible Stray Kids nebula -> Escape -> orbit; the selected song light returns and the orbit remains usable.
- Console regression check: passed. No new mirror/nebula or shader error was introduced. The existing Vite HMR reconnect message, Star Fighter texture/model load messages, and Three.js `Clock` deprecation remain; fallback ships render and the tested flow completes.
- Build checks: passed (`npm run lint`, `npm run build`, `git diff --check`, HTTP `200`).
- Findings: no actionable P0, P1, or P2 spatial-context regression remains.

final result: passed

## Full-screen blur and particle-noise regression — 2026-07-16

- User evidence: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-6eb8799e-c229-4115-896d-16863f24d900.png`.
- Root cause: the 30,000-grain near-field layer, always-on RGB shift, bright Milky Way panorama, and all-point mirror centre combined into a high-frequency full-screen veil.
- Fix: reduced near-field dust to 8,500 depth-separated grains, removed idle/audio chromatic shift, darkened the panorama, restored a sharp co-registered image centre, limited particle transfer to eroded pixels, and lowered mirror bloom.
- Comparison: `/tmp/k-sound-blur-fix-compare.png` (reported frame on the left, final cruise on the right).
- Final evidence: `/tmp/k-sound-blur-fix-cruise.png`, `/tmp/k-sound-blur-fix-mirror.png`, `/tmp/k-sound-blur-fix-pointer.png`.
- Browser flow: passed. Ignition -> singer hover -> Bezier orbit -> real song-star hover/click -> time mirror -> pointer interaction -> W free-drive input -> Escape -> orbit.
- Console: passed. No application or shader error; only the pre-existing Three.js `Clock` deprecation warning remains.
- Build checks: passed (`npm run lint`, `npm run build`, `git diff --check`, HTTP `200`).
- Findings: no actionable P0, P1, or P2 blur/noise regression remains.

final result: passed

## Douyin-style 3D image particle dispersion — 2026-07-16

- Source visual truth:
  - `https://www.douyin.com/video/7621414148248726137` and `/tmp/mmguo-memory-visualized.mp4` (moving 3D particle-fabric reference)
  - `/tmp/mmguo-analysis/keyframes/2.jpg` (readable image centre plus same-colour eroded perimeter)
  - `/tmp/mmguo-analysis/keyframes/16.jpg` (continuous mouse gravity well and compressed bright ring)
  - `/tmp/mmguo-analysis/keyframes/24.jpg` (edge-on bent particle membrane and surrounding depth cloud)
  - `https://mediamodifier.com/image-tools/dispersion-effect` (reference only for solid-to-fragment-to-dust scale transition; its flat square fragments and one-way spray were intentionally not copied)
- Implementation URL: `http://127.0.0.1:3020/proto7.html`
- Viewport and states: 1280 × 720; clean entry, cruise, singer hover, Bezier orbit, real song-star click, mirror front, continuous pointer well, side, back, unrestricted free flight, Escape return.
- Final evidence:
  - `/tmp/k-sound-image-dispersion-front.png`
  - `/tmp/k-sound-image-dispersion-pointer.png`
  - `/tmp/k-sound-image-dispersion-free-drive.png`
  - `/tmp/k-sound-mirror-side.png`
  - `/tmp/k-sound-mirror-back-pointer.png`
- Combined source/implementation comparison: `/tmp/k-sound-image-dispersion-compare.png`.

### Comparison and iteration history

1. First implementation was an overexposed circular cloud and did not preserve the cover image. A later all-point pass blurred the cover at normal viewing distance. The final system uses a stable co-registered image centre and converts only genuinely eroded edge pixels into matching particles.
2. Second pass exposed a square particle card. Replaced the hard edge with asymmetric organic erosion, persistent same-colour feather plumes, and independent curl-driven excursions.
3. Side view was initially a straight line. Added low-frequency spatial folds, luminance relief, seeded base thickness, and a wider edge depth cloud.
4. Hover initially behaved like repeated clicks. Replaced it with one continuous velocity-aware gravity well; click ripples remain a separate interaction.
5. Initial mirror median was about 47 fps. Reduced repeated noise work, selected a 36,720-point quality/performance balance, isolated off-focus nebula draw calls, and used a mirror-only 1.24 DPR cap. Steady-state browser runs measured 60.6 fps median, 21.4 ms p95, and 24.6 ms p99 during back-face pointer interaction.

### Fidelity and interaction checks

- Image-to-particle transformation: passed. The centre remains a sharp sampled image while every transferred edge sample becomes a same-colour point; the two layers share one erosion field and do not form an unrelated particle halo.
- Natural motion: passed. Per-particle period, phase, delay, departure, free-drift, return, direction, depth, and local curl differ; no whole-layer bass scale or synchronized sine breathing remains.
- Audio response: passed. Smoothed music energy changes the local erosion front and depth while transients open only shader-selected clusters; quiet playback condenses toward home positions.
- Mouse texture: passed. Hover creates a persistent black Z-depth well with a bright compressed ring and velocity-coupled tangent drag; leaving the image springs back. Click ripple remains functional.
- 360-degree object: passed. The mirror is oriented once toward the final Bezier stop, stays fixed in world space, has front/back/side hit volume, and shows bent-film thickness plus edge cloud from the side.
- Free driving and state restoration: passed. Browser-tested mouse look plus repeated W movement until the mirror left the viewport, followed by Escape returning to `ORBIT`; hints and full-resolution render quality restored.
- Tool boundaries: passed. Three.js owns scene/camera/raycast, GLSL owns image particles and forces, GSAP owns camera/uniform macro transitions, and Motion mini owns only DOM mode/hint transitions.
- Console: passed. No application or shader error. Only the pre-existing Three.js `Clock` deprecation warning remains.
- Build checks: passed (`npm run lint`, `npm run build`, `git diff --check`).
- Findings: no actionable P0, P1, or P2 issue remains for this particle-mirror replacement.

final result: passed

## Natural volumetric singer nebulae — 2026-07-16

- Source visual truth:
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-51f645af-138a-4c84-a703-da0005b4da73.png` (preserve the current particles, fog, palette, and varied family identity)
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-889fde1c-61de-47fe-9f7b-cf6f6658d3a3.png` (negative reference: avoid isolated, diagrammatic whirlpool lanes)
- Implementation URL: `http://127.0.0.1:3020/proto7.html`
- Viewport and states: 1518 × 1348; automatic cruise overview, singer orbit close-up, song time mirror, mirror exit, and unrestricted manual cruise.
- Full-view implementation: `/tmp/k-sound-natural-volume-final.png`.
- Focused close-up: `/tmp/k-sound-natural-volume-orbit.png`.
- Combined reference/prototype comparison: `/tmp/k-sound-natural-volume-qa-contact.png`.

### Comparison history

1. First distribution pass still exposed a few crisp spiral and annular lanes at overview distance.
   - Evidence: `/tmp/k-sound-natural-volume-pass1.png`.
   - Fix: reduced curve-locked particle mass, replaced binary arm/background placement with continuous angular mixing, gave every arm a separate width/pitch/extent/weight, broadened gas coverage, and removed the explicit ring mass.
2. Final comparison shows irregular complete cloud bodies rather than isolated line drawings.
   - Evidence: `/tmp/k-sound-natural-volume-final.png` and `/tmp/k-sound-natural-volume-orbit.png`.
   - The remaining internal flow is a low-contrast density tendency that becomes visible only inside the full cloud body; no repeated S silhouette, caterpillar chain, fingerprint ring, or detached whirlpool lane remains.

### Required fidelity surfaces

- Fonts and typography: passed. HUD and song-label type families, weights, tracking, antialiasing, hierarchy, wrapping, and copy are unchanged.
- Spacing and layout rhythm: passed. Existing HUD, radar, ship, label, and orbit-card geometry is unchanged.
- Colors and visual tokens: passed. Singer palettes, core tone, particle colors, opacity uniforms, fog tint, blending, and bloom settings are unchanged.
- Image quality and asset fidelity: passed. The existing particle shader, smoke atlas, glow texture, diffraction-star texture, ship models, sky panorama, and cover-art flow are retained; no generated or placeholder asset was introduced.
- Copy and content: passed. No user-facing copy changed in this pass.

### Spatial and interaction findings

- Volume: passed. Each singer now samples seeded thin-disk, thick-disk, and sparse halo layers plus two coherent vertical fields, producing front/back parallax and non-uniform thickness instead of a single centered plane.
- Natural variation: passed. Family anatomy remains distinct, while seeded arm pitch, width, radial extent, weight, vertical phase, lopsided radius, and gas distribution prevent copy/paste silhouettes.
- Material constraint: passed. Only CPU-side position and density attributes changed; ShaderMaterial definitions, texture inputs, colors, and rendering pipeline remain intact.
- Default presentation: passed. Automatic cruise still maintains the existing 34°–44° oblique presentation, so the entry overview does not collapse to an edge-on streak. Manual flight keeps fixed real 3D orientation and remains unrestricted.
- Core flow: passed. Browser-tested cruise → singer hover → Bezier approach → orbit → song bright-star selection → time mirror → Escape to orbit → Escape to cruise → held-W manual flight.
- Console: passed. No application error was recorded; only the pre-existing Three.js `Clock` deprecation warning remains.
- Findings: no actionable P0, P1, or P2 issue remains for the requested natural volume, structural blending, or interaction preservation.

final result: passed

## Large / medium / small singer-galaxy hierarchy — 2026-07-16

- Root cause: the previous linear radius formula produced only `62.8–94`, while 20/25 singers sat inside `86.2–94` and 14/25 were exactly `94`; the authored `112` cap never activated.
- New hierarchy: passed. Catalogue count remains the primary ordering, stable artist-id hashing breaks ties, and the 25 singers are distributed into 6 large (`104–112`), 10 medium (`80–88`), and 9 small (`56–64`) galaxies. The radius span is now a clear 2× without exceeding the existing safe maximum.
- Overview evidence:
  - `/tmp/k-sound-galaxy-size-tiers-overview.png` (initial cruise)
  - `/tmp/k-sound-galaxy-size-tiers-late.png` (continued automatic cruise)
- Proportion preservation: passed. Particle and smoke footprints scale by `clamp(R / 94, 0.7, 1.2)`. Song-star groups and hit targets scale by `R / 94`; because orbit distance remains `3.6R`, songs retain the same screen size and singer/song proportion in every tier.
- Interaction evidence: `/tmp/k-sound-galaxy-size-tier-orbit.png`. Hover identified BLACKPINK, click entered the existing Bezier approach, orbit completed, and twelve song stars rendered with readable labels and working hit geometry.
- Spatial safety: passed. Pick spheres remain separated at the closest galaxy pair; all orbit, landing, mirror, and return distances continue to derive from `p.r`.
- Material constraint: passed. Morphology families, shaders, textures, blending, colors, fog, bloom, and automatic-cruise orientation are unchanged.
- Build and type checks: passed (`npm run lint`, `npm run build`, `git diff --check`, HTTP `200`).
- Console: no new error from the size change. Existing Three.js `Clock` deprecation warning and non-blocking Star Fighter metallic/roughness texture load error remain.

final result: passed

## Singer morphology diversity and persistent overview angle — 2026-07-16

- User references:
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-b8191e5d-da25-4921-928e-a91b6b0a9770.png` (uniform copy/paste morphology)
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-dc7537cb-5912-4ed3-8d9c-62b1f79cef5c.png` (thin edge-on default presentation)
- Combined comparison: `/tmp/k-sound-morphology-angle-compare.png`.
- Final rendered evidence:
  - `/tmp/k-sound-morphology-angle-pass4-start.png` (first cruise frame)
  - `/tmp/k-sound-morphology-angle-pass4-late.png` (automatic cruise after sustained rotation)
  - `/tmp/k-sound-morphology-bts-orbit.png` (Bezier arrival, close galaxy body, and twelve song stars)
- Morphology: passed. The old shared five-arm anatomy was replaced by six curated families: grand-design, open three-arm, flocculent, ringed, barred, and diffuse/tidal. Each family has different core/arm/body/ring/bar/tail/dust mass, arm count, winding, thickness, asymmetry, gas layout, and silhouette. Artist-seeded handedness, arm-count shifts, winding, fragmentation, ring radius, bar length, core size, and cloud variation prevent siblings from cloning one template.
- Default overview angle: passed. Automatic cruise now keeps each galaxy at its own 34°–44° three-dimensional inclination with a distinct roll, using smooth precession rather than a face-on billboard. A complete 502.7-second route simulation measured a worst projected short/long axis ratio of `0.695`, so default cruise cannot collapse into the thin streaks in the user reference.
- Free-flight boundary: passed. The presentation update runs only in automatic cruise. WASD, mouse flight, Bezier approach, orbit, mirror, and all manual modes freeze the current world quaternion immediately; no camera path, boundary, or control is introduced. Browser validation confirmed `W` enters manual flight and `C` returns through the existing Bezier cruise handoff.
- Material constraint: passed. Existing particle shaders, smoke atlas, diffraction texture, blending, singer palettes, fog, core glow, and bloom settings are unchanged in this pass; only CPU particle distribution, family proportions, and parent presentation transforms changed.
- Interaction: passed. Cruise hover resolved BTS, click entered the existing Bezier approach, orbit completed, and twelve song stars rendered over the new galaxy body.
- Build and type checks: passed (`npm run lint`, `npm run build`, and `git diff --check`).
- Console: no new application error from this pass. The existing Three.js `Clock` deprecation warning and non-blocking Star Fighter metallic/roughness texture load error remain; the ship still renders and the interaction flow completes.
- Findings: no actionable P0, P1, or P2 issue remains for the requested morphology diversity or default automatic-cruise angle.

final result: passed

## Larger, faster, staggered drifting particles — 2026-07-16

- Target flow: `proto7.html` → click ignition → cruise overview shows larger floating particles moving at visibly different natural speeds.
- Final evidence: `/tmp/k-sound-drift-particles-larger-faster-a.png` and `/tmp/k-sound-drift-particles-larger-faster-b.png`, captured 650 ms apart at 1280 × 720.
- Size: passed. Near-field point footprints now use a wider 1.9–8.7 source-size range and an 8.5 px shader cap, preserving small background grains while making foreground particles easier to perceive.
- Motion: passed. Every particle now has an independent nonlinear speed, three-axis flow vector, phase, amplitude, and twinkle rate. A quiet majority is mixed with a smaller fast population, so the field no longer moves as one synchronized sheet.
- Integration: passed. The singer galaxies, background panorama, HUD, ships, and unrestricted driving logic are unchanged.
- Console: no application errors; only the existing Three.js `Clock` deprecation warning.

final result: passed

## Cosmic background, drifting dust, and default galaxy angle — 2026-07-16

- Source references:
  - `http://127.0.0.1:3000/proto7.html` and `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-e3f0c4d0-fe2c-4a57-986c-5bb0a3ebda54.png` (ESO Milky Way panorama background)
  - `http://127.0.0.1:3000/proto6.html` and `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-9208bd53-2d11-4ea2-b2ba-9a71e8766cf3.png` (floating point-cloud atmosphere)
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-e3772535-fdf8-45cb-85de-6025dc59ac5f.png` (edge-on singer galaxies to avoid)
- Final evidence:
  - `/tmp/k-sound-background-particles-45-overview.png`
  - `/tmp/k-sound-background-particles-45-overview-later.png`
- Background: passed. Planetfall now uses the exact equirectangular ESO panorama and sky tint from the 3000 proto7 source instead of a flat black sky.
- Floating atmosphere: passed. A 30,000-point near-field dust volume surrounds the free-flight space, with slow deterministic three-axis drift, depth-scaled footprints, restrained warm/cool neutral tints, and no route or boundary dependency.
- Default singer presentation: passed. Every singer disk is initialized against the pilot's entry position at a true 45-degree world-space inclination, so the overview reads as circular/elliptical galaxy bodies rather than edge-on streaks. The orientation remains fixed in 3D and does not billboard toward the camera during flight.
- Material constraint: passed. This pass does not alter the current singer particle, smoke, fog, core, diffraction-star, blending, or palette materials; only the parent transform is initialized for the entry view.
- Page and console: passed. The intro click enters a nonblank cruise scene at 1280 × 720. No application errors were logged; only the existing Three.js `Clock` deprecation warning remains.
- Findings: no actionable P0, P1, or P2 issue remains for the requested background, free-space particles, or default overview angle.

final result: passed

## Distance-consistent galaxy atmosphere — 2026-07-15

- User references:
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-63904c94-c653-4a93-8ef5-93f642389b84.png` (far view reduced to regular fingerprint-like lanes)
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-12f4b765-45fb-4d6d-bf81-98f33ca0bbac.png` (near-view target atmosphere)
- Final evidence:
  - `/tmp/k-sound-far-lod-final.png` (cruise overview)
  - `/tmp/k-sound-near-lod-preserved.png` (BLACKPINK orbit close-up)
- Root cause: distant smoke opacity previously fell to 10%, the body veil fell to 20%, and sub-pixel particles preserved only the mathematical spiral ridges.
- Fix: retain smoke and veil energy at distance, compensate smoke footprint for downsampling, and apply small stable per-particle/per-puff offsets only in far LOD. This prevents fingerprint rings while preserving the near distribution.
- Material constraint: passed. The existing particle/smoke textures, colors, blending, glow, and singer palettes remain unchanged; this pass changes distance LOD only.
- Comparison result: the far view now retains soft cloud volume, fragmented edges, and scattered stars. The orbit close-up remains full and song labels continue to occupy the same galaxy body.
- Findings: no actionable P0, P1, or P2 issue remains for the requested distance consistency.

final result: passed

## Pinwheel vortex morphology — 2026-07-15

- User problem screenshot: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-d39a62a2-4e67-4dcb-9250-1728ec84eb5d.png` (the residual two-sided S silhouette).
- Astronomical grounding:
  - NASA M101 Pinwheel Galaxy: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-101/`
  - NASA M51 Whirlpool Galaxy: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-51/`
- Final evidence:
  - `/tmp/k-sound-vortex-overview.png` (cruise overview)
  - `/tmp/k-sound-vortex-orbit.png` (BLACKPINK orbit close-up)
- Morphology fix: replaced the two-arm bilateral skeleton with five interleaved, tightly curved and lightly fragmented density lanes inside one complete disk. The disk is lifted into a fixed 3D inclination so the vortex remains readable without camera-facing billboard behavior.
- Material constraint: passed. No particle, smoke, star-spike, color, blending, glow, opacity, or texture material was changed in this pass; only spatial distribution and fixed disk orientation changed.
- Song distribution: passed. Existing golden-angle disk scattering remains independent of the spiral lanes.
- Visual comparison: the previous bright particles joined into an S-shaped chain; the result now has a centered pinwheel core and multiple curved lanes that wrap into a complete round/oval galaxy body.
- Findings: no actionable P0, P1, or P2 issue remains for the requested whirlpool morphology.

final result: passed

## Full-disk particles and songs — 2026-07-15

- Selected source state: `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-fb93678b-6ad8-43bb-8272-6c693d520b11.png`.
- User-directed target: keep the current particle, star, dust, fog, and diffraction-star materials, but distribute every layer across one round/oval galaxy body; songs must no longer sit on the S-shaped spiral path.
- Final rendered evidence: `/tmp/k-sound-nebula-full-disk-final.png`, 1280 × 720, BLACKPINK orbit state.
- Full-view comparison: the small-star field now fills the complete oval disk, while a reduced spiral bias preserves galaxy structure without recreating the caterpillar silhouette.
- Focused-region comparison: bright song stars use deterministic golden-angle scattering from the inner disk to the outer rim. They remain stable, rotate with the galaxy, and no longer form two arm-aligned queues.
- Interaction proof: cruise → BLACKPINK Bezier approach → orbit → click the newly scattered Whistle star → particle time mirror → Escape back to orbit; all states passed.
- Console: no application errors; only the existing Three.js `Clock` deprecation warning.
- Findings: no actionable P0, P1, or P2 issue remains for this full-disk distribution pass.

final result: passed

## Latest fullness pass — 2026-07-15

- User reference:
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-a2339e9e-4550-4b5e-be13-18926d4a2c34.png` (thin caterpillar-like current silhouette)
  - `/var/folders/mz/sf7g9l2n4dn16mzwwf039rgh0000gn/T/codex-clipboard-5d52ca50-6a38-4bd2-98bf-18a0cee24f1d.png` (fullness and overall galaxy volume only)
- Final implementation screenshot: `/tmp/k-sound-nebula-fullness-v2.png`
- Side-by-side comparison: `/tmp/k-sound-nebula-fullness-compare-v2.png`
- Viewport and state: 1280 × 720, LE SSERAFIM orbit close-up with twelve song stars.
- Result: the singer body now fills a broad oval volume with a longer spiral winding, distributed inter-arm particles, and a wider gas/dust envelope. The narrow segmented silhouette is gone.
- Intentional deviation: the blue color and photographic texture of the reference were not copied. Existing white/silver particles, diffraction stars, fog sprites, singer palette, labels, and interaction behavior remain unchanged.
- Findings: no actionable P0, P1, or P2 visual issues remain for the requested fullness-only change.

final result: passed

- Source visual truth:
  - `/Users/cuiguangzhen/.codex/attachments/363f7190-e1b2-4457-b5d7-5885618cb983/image-1.png` (avoid an overexposed galaxy nucleus)
  - `/Users/cuiguangzhen/.codex/attachments/363f7190-e1b2-4457-b5d7-5885618cb983/image-2.png` (remove the broad dart-shaped mist planes)
  - `/Users/cuiguangzhen/.codex/attachments/363f7190-e1b2-4457-b5d7-5885618cb983/image-3.png` (full, atmospheric spiral body)
  - `/Users/cuiguangzhen/.codex/attachments/363f7190-e1b2-4457-b5d7-5885618cb983/image-4.png` (orbital HUD and song-label context)
  - `/Users/cuiguangzhen/.codex/attachments/363f7190-e1b2-4457-b5d7-5885618cb983/image-5.png` (particle mirror presentation)
- Implementation URL: `http://127.0.0.1:3020/proto7.html`
- Implementation screenshots:
  - `/tmp/k-sound-orbit-final-labels.png`
  - `/tmp/k-sound-mirror-before-drive.png`
  - `/tmp/k-sound-mirror-after-drive.png`
- Combined comparisons:
  - `/tmp/k-sound-nebula-compare-final.png`
  - `/tmp/k-sound-mirror-compare.png`
- Viewport: 1280 × 720
- States: orbit close-up; time mirror playing; time mirror after free-flight departure

## Full-view comparison evidence

- The current galaxy has a broad particle-and-smoke body with visible depth and arm structure. The previous flat continuous mist plane and its dart/boomerang silhouettes are absent.
- The core keeps particle detail instead of clipping into a solid white disk. Song diffraction stars remain intentionally brighter than the singer-galaxy body.
- The mirror stays below the bloom threshold and preserves its cover-art values; its particle rim remains readable against the deep-space background.
- During playback, repeated Shift+W/A input moves the ship away until the mirror fades out, while the HUD remains in `TIME MIRROR` and the event log continues to show the active song.

## Focused-region comparison evidence

- Galaxy center and arms: checked in `/tmp/k-sound-nebula-compare-final.png`; the nucleus no longer dominates the frame, the smoke field fills the disk, and the flat mist darts are gone.
- Song labels and HUD: checked in `/tmp/k-sound-orbit-final-labels.png`; all UI uses the same Avenir/PingFang display family plus SF Mono technical family and a shared size/spacing scale. Screen-space collision suppression keeps overlapping labels hidden while hover can reveal them.
- Mirror and driving: checked with `/tmp/k-sound-mirror-before-drive.png` and `/tmp/k-sound-mirror-after-drive.png`; artwork fades with distance without switching mode or stopping playback.

## Comparison history

1. Earlier orbit capture: center remained too white, flat mist produced broad dart shapes, and twelve song labels collided.
   - Fixes: reduced core particle/sprite energy, removed the continuous mist mesh, expanded low-alpha volumetric smoke, added label collision suppression.
   - Post-fix evidence: `/tmp/k-sound-orbit-final-labels.png`.
2. Earlier mirror capture: bright cover areas crossed the global bloom threshold and washed out.
   - Fixes: capped mirror and rim luminance below bloom, reduced halo energy, and added independent distance-fade uniforms.
   - Post-fix evidence: `/tmp/k-sound-mirror-before-drive.png` and `/tmp/k-sound-mirror-after-drive.png`.

## Required fidelity surfaces

- Fonts and typography: passed. One display family, one technical family, shared tokenized sizes and tracking, no undefined font variable.
- Spacing and layout rhythm: passed. Existing Planetfall HUD geometry is preserved; song-label collisions are suppressed.
- Colors and visual tokens: passed. Singer colors remain data-driven; core, mist, and mirror brightness are restrained.
- Image quality and asset fidelity: passed. Real ship/cover assets and shader particles are retained; no placeholder assets were introduced.
- Copy and content: passed. Playback hint now documents free flight and distance fading in the mirror state.

## Findings

- No actionable P0, P1, or P2 findings remain for the requested desktop flow.
- P3: mobile HUD density was not redesigned because this iteration targets the existing desktop Planetfall experience.

## Interaction checks

- Page identity and nonblank render: passed.
- Cruise → singer Bezier approach → orbit: passed.
- Song star → particle mirror → active playback: passed.
- Playback + Shift/W/A free flight → mirror distance fade while playback state remains active: passed.
- Console: no application errors; only the existing Three.js `Clock` deprecation warning.

final result: passed
