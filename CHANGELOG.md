# Changelog

## 1.0.7 - 2026-10-19

- Added Night/Day/Rain scene selection, four-layer PNG atlases, Canvas rain/mist and brighter daylight glass.
- Added bounded DOM wet-glass droplets/refraction with hidden/reduced-motion handling; weather continues during pause/results.
- Added undoable Editor background previews and custom atlas import; exported ZIPs preserve PNG bytes and JSON v4 metadata.
- Replaced Menu JSON uploads with validated, bounded level ZIPs; Editor retains legacy JSON support.
- Added temporary IndexedDB Blob transport with per-tab sessionStorage tokens, reload support and 24-hour expiry.
- Split deterministic generation into independent OOP groups over shared raster/motif core; kept original 42 PNGs byte-identical.
- Expanded schema/archive/history/lifecycle/browser/production coverage; kept gameplay, physics and map geometry unchanged.

## 1.0.6 - 2026-10-19

- Lightened emerald glass and reduced blur; added gentle, phase-offset sunlight reflections with hidden/reduced-motion handling.
- Migrated application, generator, tests, helpers, and executable configs to strict TypeScript with explicit domain/editor/browser contracts.
- Added draft/playable map narrowing, guarded DOM access, declared class APIs, and test-only typed browser hooks.
- Added type-contract/source-coverage and clean-install CLI checks, plus zero-warning type-aware lint; CI checks types/lint/format before runtime/browser stages.
- Kept Node support, generated artwork, gameplay, physics, map geometry, and JSON versions unchanged.

## 1.0.5 - 2026-10-18

- Added shared emerald glass styling, ivory/gold controls, shadows, rounded surfaces, bounded Menu/dialog tilt, and reduced decorative motion.
- Increased Menu auto-scroll to 24 world units/second, including reduced motion, with a single asset-ready animation loop and hidden-time suspension.
- Moved loading/pause/results/errors from Canvas to accessible HTML/CSS overlays with focus containment and input reset.
- Extended the Editor forest behind glass chrome and transparent foreground/minimap canvases; added asynchronous glass confirmations.
- Added MIT licensing, public GitHub publishing, annotated release tags, and SHA-pinned GitHub Actions checks.
- Expanded lifecycle, overlay, dialog, visual, and production regression coverage; gameplay and map formats remain unchanged.

## 1.0.4 - 2026-10-17

- Split Menu, Editor, and Game into independent HTML/CSS/JavaScript entrypoints with static-subdirectory support and legacy hash redirects.
- Added validated per-tab map transfer with explicit storage/token errors and reload support, without saving Editor drafts.
- Restricted the inspector to Inspect clicks on placed tiles/entities; preserved cell anchoring across scopes and pending-edit guards.
- Reused layered forest rendering for Menu scrolling and Editor parallax under a readable sage wash; regenerated horizontally seamless backgrounds.
- Reorganized source into domain, simulation, rendering, editor, infrastructure, shared, and page modules with OOP controllers/services and owned player state.
- Added dependency-boundary, session, background, multi-page, and production deployment tests; preserved both course replays and map formats.

## 1.0.3 - 2026-10-15

- Added sage forest UI, CSS motion, reduced-motion support, and a compact built-in/file Play chooser.
- Added compact/expanded inspectors for tile type defaults, per-cell overrides, collision boxes, effects, and entity properties with Apply/Cancel/Reset.
- Added sparse JSON v3, v1/v2 compatibility, and property/entity-aware editor history and clipboard behavior.
- Added timed spikes, crumbling platforms, moving saw paths, and persistent checkpoints with resettable trap state.
- Generated four parallax layers and new trap/entity assets; added background-only directional blur and bounded effect tinting.
- Replaced Forest Ruins with a five-stage 512 x 96 challenge; preserved the original easy map and verified complete legal-input replays.
- Added bounded Editor tile-chunk caching for large-map pan/zoom, expanded tests, and updated project documentation.

## 1.0.2 - 2026-10-15

- Added a light, minimal Menu and a file-based Play flow with validated JSON imports.
- Added a map Editor with tile palette, brush/erase, rectangles, fill, selection/copy/paste/move, transactional undo/redo, resize, zoom, and two-axis minimap navigation.
- Added v2 rectangle JSON drafts, v1 compatibility, export downloads, and dirty-document guards; included a tile showcase map.
- Added ice, mud, springs, spikes, one-way platforms, conveyors, dash-breakable stone, and half-slabs.
- Added true crouching with safe standing clearance, one-way drop-through, and resettable broken tiles.
- Generated player sprite sheets and effect atlases at 24 FPS; added dust, material effects, dash trails/bursts, spring compression, and debris with reduced-motion support.
- Expanded unit, smoke, browser, and regression coverage; preserved the original level.

## 1.0.1 - 2026-10-15

- Replaced surrounding HTML UI with an automatically starting, full-window canvas and responsive camera view.
- Moved loading, pause, completion, and errors into Canvas; added Escape pause/resume and Enter replay.
- Regenerated native-detail 64 x 64 tiles/player, 128 x 128 portal, and 1280 x 960 forest background.
- Moved level geometry to compact rectangle-based JSON with validated loading; preserved physics, hitboxes, and the level route.
- Added map/viewport tests and updated browser checks for canvas-only play, resize, HiDPI, and map failures.

## 1.0.0 — 2026-10-14

- Added a forest-ruins platformer with locally generated pixel-art PNG assets.
- Added acceleration, friction, variable jumps, coyote time, jump buffering, horizontal dash, and edge-safe sneak.
- Added a finite tile map, two-axis camera, fall respawn, gate completion, replay, and focus-loss pause.
- Tuned uphill steps for ordinary jumps and verified the complete route without dash.
- Added Vite, Vitest unit/smoke tests, Playwright browser tests, ESLint, and Prettier.
- Documented setup, controls, architecture, and maintenance conventions.
