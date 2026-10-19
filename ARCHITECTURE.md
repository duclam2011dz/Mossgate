# Architecture

## App and lifecycle

Vite builds independent Menu, Editor, and Game documents, each with its own HTML, CSS, TypeScript entry, and controller. Shared CSS contains only common surfaces and controls. Full document navigation replaces hash routing; legacy hashes redirect. Relative URLs respect static-hosting subdirectories.

A per-tab MapSession transports a validated ZIP Blob through IndexedDB, with its random token in sessionStorage. Reload retains it for 24 hours; replacement deletes the old Blob. App entry sweeps expired packages; storage/token failures are explicit. This transport does not save Editor drafts or offer a map library. Controllers dispose listeners, observers, input, buffers, weather and animation clocks on pagehide; back/forward cache restoration reloads a clean page. Hidden documents stop animation loops.

Source groups are `pages`, `domain`, `simulation`, `rendering`, `editor`, `infrastructure`, and `shared`. Controllers own browser state; GameSimulation owns Player and runtime state. Classes encapsulate mutable services, while stateless math/codec operations use static methods. Function-name aliases preserve lightweight internal/test call sites. Dependency smoke tests reject runtime import cycles, browser references in simulation/domain, and domain dependencies on simulation.

Shared CSS tokens define clear emerald glass (32% tint, 6 px blur), ivory text, gold accents, shadow, and visible focus. Card-contained CSS pseudo-elements animate warm reflections beneath content using transform/opacity only; shared visibility handling suspends them while hidden. Reduced motion freezes decorative reflections. The map chooser hides the underlying Menu card so only forest scenery shows through. GlassMotion controls bounded pointer tilt for Menu/dialog surfaces; Editor tools never tilt. GlassDialog replaces application confirm prompts; file pickers/unload warnings remain native. Canvas draws gameplay only. GameOverlayController owns HTML/CSS loading, pause, completion, and error dialogs, action buttons, focus containment, and keyboard navigation. Playing hides and inerts the overlay; pausing clears input and freezes simulation.

## Maps and effective properties

MapCodec validates v1/v2/v3/v4 JSON, expands ordered rectangles, and exports compact v4 with deterministic run merging. Structural decoding is independent of browser I/O and gameplay validation. MapValidator checks supported markers and hazard/saw clearance. JSON is capped at 2 MiB and 512 x 128 tiles. Version 4 adds a plain-data BackgroundSpec (preset plus relative PNG path); older inputs normalize to Night. Simulation ignores this presentation metadata.

The tile registry fixes IDs, assets, kinds, and defaults. PropertyResolver validates editable fields and resolves registry < map type defaults < cell overrides. A WeakMap cache is invalidated by map property revision. Zero values remain meaningful. Collision, simulation, inspector, validation, and effects share this resolver. Sparse exports omit inherited values and empty collections.

Version 3 adds `tileDefaults`, `[x,y,patch]` cell overrides, and stable-ID entities. The editor model stores property/entity metadata with tile changes in transactional undo/redo. Copy/paste carries explicit cell patches; ID changes clear them. Resize prunes out-of-bounds overrides/entities and is reversible. Runtime never mutates source geometry or patches.

## Simulation and hazards

Simulation is browser-independent and advances at 60 Hz, capped at five steps per frame. Nearby-tile AABB collision uses resolved hitboxes and movement subdivisions. One-way/drop-through uses resolved surfaces rather than a fixed height. Crouch preserves feet and expands only with clearance. Material coefficients, conveyor motion, spring force, hazard flags, and dash-break flags use effective properties.

A run owns broken tile keys, crumble states, trap time, checkpoint ID, respawn position, active time, and deaths. Timed spikes derive visible/lethal phases from the same clock. Crumble recovery waits until the restoring collider is clear. Saw paths use constant arc-length speed; swept relative circle/AABB tests catch fast crossings. Path movement is subdivided into short segments at physics resolution.

Checkpoint activation records a safe feet-derived spawn and emits a visual event. Death preserves that checkpoint and active time/deaths, while resetting broken tiles, crumble states, and trap clocks. Restart creates a clean run. Pause freezes all runtime clocks.

## Editor and inspector

EditorModel handles fill, line/rectangle painting, clipboard, metadata, and history. Each user gesture is one transaction. Entry and changed-cell limits bound history. Revision IDs preserve dirty state across undo/redo and export.

EditorController coordinates tools/input/model changes; EditorRenderer owns canvas drawing and minimap rendering. EditorTools provides selection geometry. Editor camera/zoom map CSS pointer coordinates to cells. Only visible tiles/grid lines are drawn; backing buffers are viewport-sized. Terrain uses density-aware 16 x 16 tile raster chunks with exact ID comparisons and a 32 MiB LRU budget, avoiding thousands of draw calls when zoomed out. A small transparent map-sized color cache feeds the glass minimap. Entity tools draw static paths and allow waypoint dragging; no editor simulation runs.

TileInspector owns compact/expanded forms, inheritance labels, staged values, Apply/Cancel/Reset, and pending-edit dialogs. Applying validates both scope values and affected instance combinations before one model transaction. Only an Inspect click opens the panel; palette clicks only select the brush tile. Cell identity is separate from editing scope. Pan/zoom repositions popovers; offscreen instance targets hide the compact view. Entity forms edit numeric path points, speed, radius, phase, and loop mode.

## Generated visuals

The deterministic generator emits 92 PNGs and a manifest: native-detail tiles, player/effect sheets, timed-spike poses, crumble/saw sheets, checkpoint flags, and four separate forest layers. BackgroundResources loads one scene atlas for Menu; AssetManager loads static editor assets for Editor and gameplay atlases for Game. Metadata lives in shared asset definitions, so the generator never imports rendering runtime. All asset URLs respect Vite base URL.

Player/effect clips use 24 FPS independently of render rate. Physics emits events with cell keys and resolved effect properties, so destruction does not lose material information. Pooled particles are capped at 512 with 64 visible ambient emitters; tint masks use a 32-entry cache. Pause freezes visuals; respawn clears transient effects.

BackgroundRenderer composites sky, distant forest, ruins, and near trees into a half-resolution viewport buffer with independent parallax factors. Up to three directional samples blur only this buffer, capped at six CSS pixels. Camera jumps, restart, respawn, and resize reset velocity history. Reduced motion removes gameplay blur. Foreground rendering stays pixel-sharp. The same renderer drives Menu auto-scroll at 24 world units/second and a full-page Editor background behind transparent map/chrome surfaces. Editor camera offsets account for workspace bounds; tall views fit the scene to the viewport without exposing blank lower space. Generated layer edges match horizontally and vertical motion is bounded. Menu/Editor disable directional blur. AnimationLoop owns one scheduled frame, starts only after asset loading, and discards hidden time. Reduced motion disables UI tilt/shimmer, keeps wet-glass positions stationary while opacity lifecycles continue, reduces Canvas rain density/speed and intentionally keeps Menu scrolling.

## Scene, package and resource APIs

`SceneController.apply(spec, animate)` resolves immutable PNG resources with last-request-wins loading, then updates BackgroundRenderer and the document glass theme. Failed loads keep the previous scene. Menu uses a 0.6-second atlas crossfade; Editor commits only after preview/Apply. Game follows its level. RainRenderer owns a fixed 320-drop viewport-relative pool (44 slower drops with reduced motion), separate from physics/effects clocks. Background-only rain continues while paused/completed; hidden time is discarded.

GlassMotion owns one GlassWeather coordinator per document. It discovers visible glass surfaces, caps droplets at 32 per surface / 180 per document, merges moving beads and suspends while hidden. DOM/CSS gradients, highlights and backdrop filtering sit beneath controls; an inline SVG displacement filter improves local refraction with a CSS fallback. Scene CSS tokens distinguish Night, Day (18% tint / 3 px blur) and Rain. No Canvas glass or text displacement is used.

`BackgroundResources` owns immutable Blob/image pairs. Map metadata and undo commands hold resource keys, never PNG bytes. Editor retains resources referenced by current/pending maps, in-flight imports and undo/redo history; unreferenced custom resources are collected, and page disposal clears ownership. Custom atlas bytes survive export unchanged. The fixed atlas is 2560 x 1920, with sky/distant/midground/near in a 2 x 2 grid of 1280 x 960 layers. To add a preset, extend BackgroundPreset, generator atlas output, scene selection and CSS tokens together.

`LevelPackageCodec.encode/decode` handles one folder containing level.json and background.png, JSON v4/v5 and a relative ./background.png reference. It validates names, entry counts, encryption, duplicates, declared and streamed output sizes, JSON and decoded PNGs. ZIP/unpacked content is limited to 24 MiB, JSON to 2 MiB, PNG to 20 MiB. zip.js is bundled locally with workers disabled; it never fetches third-party runtime code. MapFiles keeps browser file I/O separate from codecs and playable validation. Menu accepts ZIP; Editor also reads legacy JSON.

`PackageStore` abstracts temporary Blob transport; IndexedPackageStore implements it with transactions. MapSession manages per-tab token access, replacement and 24-hour expiry. Failed storage cannot silently select another map. No persistence enters domain/simulation.

Generator groups terrain/player/effects/background/entities/enemies expose generate APIs without cross-imports. Shared raster/noise/color and anatomical/terrain motifs live below them in core; the entry orchestrates and writes PNG/manifest files. Original PNG bytes are preserved. Composition remains the default elsewhere; existing domain/editor/simulation contracts keep their responsibilities instead of acquiring unrelated inheritance hierarchies.

## Validation and maintenance

Vitest covers legacy/new physics, codec inheritance, editor transactions, timing, swept hazards, checkpoint resets, and animation/effects limits. Smoke tests verify locked dependency CLI files, compare regenerated assets/manifest, verify map structure, and complete the challenge with real inputs. Playwright covers Menu, inspector, editor entity tools, file workflows, and both complete course replays.

The original easy level is preserved as forest-ruins-legacy.json. The new five-stage 512 x 96 course has four checkpoints and an approximately 1:41 optimal replay; 5-8 minutes is an unmeasured first-play design target, not a forced minimum. Browser review includes Firefox/Edge, viewport variants, reduced motion, and large maps.

Test-only APIs are gated by Vite test mode and absent from production. Production tests serve all pages below /mossgate/, audit bundles for hooks, capture viewport screenshots, and measure maximum-map frame intervals. Set MOSSGATE_REVIEW_BROWSERS=1 when running the production Playwright config to include installed Firefox and Edge. Run npm run check before handoff. Update README, this document, CHANGELOG, and generated assets together. CI uses Ubuntu 24.04 / Node 24 and npm ci, then checks types/lint/format before installing Chromium and running check:runtime. Official actions are SHA-pinned with read-only repository permissions, a 20-minute limit, cancellation per ref, and seven-day failure diagnostics. Release publishing pushes a validated main commit, waits for CI, then pushes an annotated version tag and verifies its CI. No backend or deployment is provided.

## Type contracts

All project code, tools, configs, and tests are TypeScript. `tsconfig.base.json` enables strict checks, checked indexing, exact optional properties, unused/fallthrough/override/return checks, isolated modules, verbatim imports, no emit, and declaration checking. Domain compilation uses ES libraries and portable Node globals without DOM; browser and tooling configs cover their respective environments. The root tsconfig.json exposes the complete strict project to IDEs. TypeScript 6.0 stays within the supported typescript-eslint range; tsx runs generation and jiti loads ESLint configuration on Node 20.

Domain contracts distinguish nullable drafts from playable maps and discriminate entities/events. Editor gestures/targets and resize/history transactions are unions; forms stage typed tile/entity drafts. JSON starts as unknown, and codecs/validators establish runtime guarantees before use. Controllers declare fields and methods directly. Test-hook interfaces have no runtime footprint; entry points create hooks only in test mode. Source-coverage smoke tests inspect compiler configs and reject forgotten JavaScript. Type-only edges are excluded from runtime-cycle checks.

## Actor, combat and water contracts (v1.0.8)

`Enemy` is authored data: stable ID, species, top-left spawn, facing, patrol and sparse stat overrides. Species definitions are separate from `EnemyActor` runtime state. `EnemyRegistry` owns actor/projectile IDs and bounded body queries; allies do not block each other. `EnemySystem` orchestrates state transitions, movement and attacks through the shared terrain/body APIs; the `Perception` interface isolates `TerrainPerception` vision tests. Player-only `PlayerHealth` owns direct immunity, recoil, poison and slow. Runtime entities/statuses are never serialized. No browser API enters these modules.

Physics processes traps/movement and lethal hazards before combat, then defeat before checkpoint healing/portal completion. Direct hits choose greatest damage with ID ordering for ties. Retry re-creates all actors/projectiles and resets health/terrain/traps while retaining elapsed time, Deaths, checkpoint and the set of already-healed checkpoint IDs. Swept actor movement cannot break terrain; only player dash and Bloom projectiles use their explicit break rules. Crumble restoration queries every actor body.

`NavigationQueue` incrementally searches a four-connected clearance grid, with a shared ceiling of 512 expansions per step. Each flying actor requests at most twice per second; paths remain subject to swept terrain collision. Requests/results are bounded by 64 authored enemies, projectiles by 192. Failed paths wait/search/return rather than teleport. Ground movement tests support ahead and falls naturally if its floor disappears.

`entityAnchor`, `translateEntity` and `entityFits` are shared geometry APIs for region selection, full-path movement/copy, resize and playable validation. Copies receive fresh IDs; moves retain IDs. Structural codec validation is separate from body clearance/support checks for Play. JSON v5 adds enemy definitions; package content remains only JSON and background PNG. App-owned enemy art loads by the species used in the map; Editor loads static previews. To add a species, extend the typed species union, definitions, validator, generator, palette and behavior/render tests together.

`GlassWaterModel` owns normalized positions, age, growth, merge/fade phases and bounded trails; it receives elapsed visible time and surface dimensions, never DOM objects. Active droplets live 6-12 seconds unless absorbed, then rebirth after a short delay; trails fade for 2-4 seconds. `GlassWeather` owns one document clock and persistent host/model bindings. Detached decorations are reattached after Inspector rendering without resetting models; resize changes projection only. Hidden/offscreen surfaces are not stepped. Pools cap at 32 drops/trails per surface and 180 per document. Reduced motion suppresses movement/trails, retaining opacity renewal. Decoration remains below sharp, interactive content with CSS refraction fallback.
