# Mossgate - v1.0.6

A desktop pixel-art platformer with a file-based map editor. Artwork, animation atlases, and layered forest backgrounds are generated locally. No backend, external art, or runtime service is used.

## Run and play

Use Node.js 20.19+, 22.13+, or 24+ and npm. Vitest 4 retains Node 20 support.

```sh
npm ci
npm run dev
```

Choose **Play > Forest Ruins** to start the built-in challenge, or **Open JSON file** for your own map. **Editor** opens an empty map. Canceling file selection leaves the menu unchanged.

Forest Ruins is a 512 x 96, five-stage course: Momentum, Crawl & Break, Spring & Drop, Timing, and Final Gauntlet. Four checkpoints preserve progress across deaths; Restart returns to the beginning. The first-play design target is 5-8 minutes, including observation and retries; the verified optimal input replay takes about 1:41. No human first-play timing has been measured.

Sample JSONs live in `public/maps`: `forest-ruins.json` is the new course, `forest-ruins-legacy.json` preserves the original easy level, and `tile-showcase.json` demonstrates special tiles. Editor Import opens any of these for editing.

## Pages and temporary maps

Menu is `index.html`, Editor is `editor.html`, and Play is `game.html`. Each has its own HTML, CSS, and TypeScript entry. Direct Play opens Forest Ruins; old hash links redirect to the corresponding page. Relative URLs support deployment below a static-hosting subdirectory.

Imported Play maps use one temporary sessionStorage entry per browser tab. Reload keeps the selected map; choosing another replaces it. Missing tokens, blocked storage, and quota errors are reported instead of loading another map. This is file transfer only: Editor drafts are never saved automatically. Export before leaving Editor; navigation and reload guard unsaved changes.

Menu shows a slowly scrolling forest. Editor pans the same layered scene under a sage wash and grid. Layers repeat horizontally with bounded vertical parallax. Menu scrolls at 24 world units/second even with reduced motion enabled; reduced motion disables decorative tilt and shimmer. Gameplay alone uses background motion blur.

## Controls

| Key                  | Action                                                            |
| -------------------- | ----------------------------------------------------------------- |
| A / D                | Move                                                              |
| W                    | Jump; hold for height                                             |
| S + W                | Drop through the one-way platform below you                       |
| Tab                  | Horizontal dash; 0.8-second cooldown                              |
| Shift (hold)         | Crouch, move slowly, jump lower, and protect edges; dash disabled |
| Esc                  | Pause / resume                                                    |
| Arrows or Tab, Enter | Choose an HTML pause/result action                                |

Crouch changes the hitbox from 10 x 14 to 10 x 8 world units, keeping feet fixed. Releasing Shift under a ceiling stays crouched until standing is safe. Sneak also prevents walking down an unsupported edge: release it to step down into a lower passage, then crouch. Jump to climb out over a half-slab lip.

Spikes, saws, and falling cause a respawn and increment Deaths. Death restores broken/crumbling blocks and resets trap cycles; the last activated checkpoint remains. Pause offers Resume, Restart, and Main Menu. Completion offers Play Again and Main Menu. Both support clicking. Focus loss pauses and never resumes automatically.

## Tiles and traps

| ID   | Tile                | Default behavior                                            |
| ---- | ------------------- | ----------------------------------------------------------- |
| 0    | Empty               | No collision                                                |
| 1-3  | Grass, dirt, stone  | Solid terrain                                               |
| 4    | Ice                 | 20% acceleration and friction                               |
| 5    | Mud                 | 50% run speed, 60% acceleration                             |
| 6    | Spring              | Bounces on landing at 420 units/second                      |
| 7    | Spikes              | Hazard tips; no standing support                            |
| 8    | One-way             | Four-unit top surface; jump through from below              |
| 9-10 | Conveyor left/right | Carries at 45 units/second                                  |
| 11   | Breakable           | Dash into a side; respawn restores it                       |
| 12   | Slab                | Solid lower half of a tile                                  |
| 13   | Timed spikes        | Safe 1.2 s, amber warning 0.4 s, active 1 s                 |
| 14   | Crumbling platform  | Collapses 0.8 s after contact, returns after 2 s when clear |

Material under the center of your feet wins, with nearest support as fallback. Sneak preserves material effects; dash ignores mud speed penalties. Saw entities follow constant-speed waypoint paths. Checkpoint flags record a safe respawn position and change color when active.

## Editor

Maps start empty at 160 x 40. Width/height limits are 16 x 12 through 512 x 128. New and Resize use the size fields; shrinking warns before removing content and is undoable.

- **Brush / Erase:** click or drag; right-drag erases. **Rectangle / Fill:** paint a region.
- **Select:** drag a region; Ctrl/Cmd+C copies and Ctrl/Cmd+V previews a paste. Drag inside a selection to preview a move. Click/Enter commits; Esc cancels. Delete clears a selection. Copies include empty cells and explicit cell properties; out-of-bounds paste is clipped.
- **Spawn / Portal / Checkpoint:** click to place. Spawn/checkpoint feet snap to the cell bottom; portal top-left snaps to the grid.
- **Saw:** click 2-32 grid points, Enter completes, Esc cancels. **Inspect** selects an entity; drag its waypoint handles to change the path, or edit points in the expanded inspector.
- **A/D, W/S:** pan except while typing. Wheel zooms around the pointer; zoom spans 25-400%. Click/drag the minimap to navigate both axes.
- **Undo / Redo:** Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, or Ctrl+Y. One transaction per edit; capped at 100 actions and one million changed cells.

Import is editing only; Export downloads JSON, including unfinished drafts. There is no in-editor playtest, local map library, or autosave. Export and use Menu Play to test. Unsaved replacement/navigation requires confirmation.

## Inspector

Palette clicks only choose a painting tile. Select **Inspect**, then click a placed tile or entity to open the inspector; hovering never opens it. Tiles default to **This cell**, with **Tile type in this map** available in the same panel. The compact panel appears beside the target; **Show more...** opens the right sidebar. On narrow windows it becomes a drawer. The panel stays anchored to the selected cell across scopes and hides when the cell leaves the view. Escape/Close returns focus to the editor. Leaving Inspect or selecting an empty cell closes the panel after resolving pending edits.

Values inherit from registry defaults, then map-wide type properties, then cell overrides. The panel shows each value's source. **Apply** commits the form as one undo action; **Cancel** discards it. **Reset** stages removal of overrides and requires Apply. Changing target or scope with pending edits offers Apply, Discard, or Cancel.

Editable fields depend on tile kind: material multipliers, spring force, signed conveyor speed/direction, hazard/break flags, hitbox, effect color/intensity, and trap timing. ID, asset, kind, and coordinates are read-only. Show hitboxes overlays collision geometry. Modified hitboxes may differ from sprite artwork.

| Property                | Allowed values                                            |
| ----------------------- | --------------------------------------------------------- |
| Speed multiplier        | 0-3                                                       |
| Acceleration / friction | 0-5                                                       |
| Spring force            | 100-700 units/s                                           |
| Conveyor                | -160 to 160 units/s                                       |
| Hitbox                  | 0.5-unit steps, minimum 1 x 1, contained in 16 x 16       |
| Effects                 | RGB hex color, intensity 0-2                              |
| Trap times / phase      | 0.1-30 seconds / 0-1; crumble warning cannot exceed delay |
| Saw                     | Speed 16-240, radius 4-12, ping-pong or loop, phase 0-1   |

Changing tile ID clears that cell's overrides; painting the same ID preserves them. Copy/paste carries explicit properties, inheriting type defaults from the destination map. Resize removes out-of-bounds markers/entities after confirmation; undo restores them.

## JSON format

Exports use minified **version 3**; v1/v2 remain readable. Base fields are `size`, nullable `spawn` and `portal`, `deathY`, and `rects`. Rectangles are `[x,y,width,height,tileId]` in tile units; later ones overwrite earlier ones. Spawn/portal/death depth use world units. Export merges equal runs vertically.

Optional v3 fields:

- `tileDefaults`: patches keyed by tile ID, such as `{"4":{"friction":0}}`.
- `cellOverrides`: `[x,y,patch]`, such as `[[12,30,{"speed":0.5}]]`.
- `entities`: stable IDs with `type: "checkpoint"` and `position: [feetX,feetY]`, or `type: "saw"` with `path`, `speed`, `radius`, `mode`, and `phase`.

Patch keys are `speed`, `acceleration`, `friction`, `springForce`, `conveyor`, `hazard`, `breakable`, `offsetX`, `offsetY`, `width`, `height`, `effectsColor`, `effectsIntensity`, `safeTime`, `warningTime`, `activeTime`, `delay`, `downtime`, and `phase`; only relevant fields are accepted. Missing values inherit; redundant patches and empty collections are omitted. Saw waypoints snap to 16-unit grid nodes and stay within map bounds including radius.

Imports are capped at 2 MiB. Editor accepts incomplete drafts; Play additionally requires clear, supported spawn/portal/checkpoints away from hazards and saw paths. It does not prove reachability. New/Resize defaults death depth to map bottom + 64.

## Commands and validation

| Command                                   | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                             | Development server                                                      |
| `npm run build` / `npm run preview`       | Production build / preview                                              |
| `npm run assets:generate`                 | Generate 42 PNGs and manifest                                           |
| `npm run typecheck`                       | Strict TypeScript across domain, browser, tooling and tests             |
| `npm run lint`                            | Type-aware ESLint, zero warnings                                        |
| `npm run format` / `npm run format:check` | Format / verify style                                                   |
| `npm test`                                | Physics, codec, editor, properties, animation and traps                 |
| `npm run test:smoke`                      | Deterministic assets/maps and complete challenge replay                 |
| `npm run test:e2e`                        | Chromium UI and gameplay workflows                                      |
| `npm run test:production`                 | Build and test static subdirectory deployment, screenshots, and buffers |
| `npm run check`                           | Typecheck, lint, format, then runtime/build/browser checks              |

Install Chromium once with `npx playwright install chromium`. E2E starts port 4173 and writes screenshots to `output/playwright`. The legacy course and the full challenge have legal-input traversal tests. Test hooks are excluded from production.

Physics is 60 Hz; sprite clips are 24 FPS. Loading, pause, completion, and errors use keyboard-accessible HTML/CSS glass overlays. Playing has no permanent HUD. Four generated background layers use parallax and a half-resolution buffer with directional blur only on the background. Player, terrain, hazards, and text remain sharp. Reduced motion disables blur, shake, flashes, and CSS motion. Effects remain capped at 512 particles / 64 ambient emitters; tint caches are bounded.

Keep README, ARCHITECTURE, CHANGELOG, and generated assets synchronized. No enemy AI, audio, backend, or persistent map library is included.

## Glass UI and publishing

Clear emerald glass uses a 32% tint, six-pixel backdrop blur, ivory text, gold accents, and layered shadows. Warm reflections drift gently across surfaces; reduced motion freezes reflections and hidden documents suspend them. Menu scrolling remains enabled. Menu/chooser tilt is limited to four degrees. Editor tools remain stationary; the forest fills the page behind panels and the transparent map canvas. Browser file pickers and unload warnings remain native.

Source and generated artwork are MIT licensed; see LICENSE. Public repository: https://github.com/duclam2011dz/Mossgate.

GitHub Actions checks pushes to main, pull requests, version tags, and manual runs on Ubuntu 24.04 / Node 24. It installs locked dependencies, checks types/lint/format before installing Chromium, then runs npm run check:runtime, and retains failure diagnostics for seven days. Official actions are pinned to commit SHAs.

For each release, update package/lockfile and affected docs/changelog together. Regenerate PNGs if the generator changes, run npm run check, commit and push main, wait for CI, then create and push an annotated vX.Y.Z tag. Verify the tag workflow before handing off. Do not move published release tags. This project does not deploy Pages or publish an npm package.

## TypeScript maintenance

All owned executable source, configuration, generators, and tests use TypeScript 6.0 with full strict checks. `npm run typecheck` checks DOM-free domain/simulation, browser, and tooling/test groups with no emit and no skipped declaration checks. Type-aware lint treats warnings as failures. `npm run check:runtime` runs the runtime stages after these gates; it does not replace type-checking.

Run the generator through `npm run assets:generate` (`tsx scripts/generate-assets.ts`). Its seeded output remains byte-identical to v1.0.5. Keep external data `unknown` until validated; use draft/playable map and entity/event unions rather than casts or compiler suppressions. Tests under `tests/types` verify contracts during typecheck.
