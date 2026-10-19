import {
  isEnemySpecies,
  enemyDefinitions,
} from '../domain/enemy-definitions.ts';
import type { EnemySpecies } from '../domain/contracts.ts';
import { BackgroundDialog } from '../infrastructure/background-dialog.ts';
import { BackgroundResources } from '../infrastructure/background-resources.ts';
import { SceneController } from '../infrastructure/scene-controller.ts';
import { LevelPackageCodec } from '../infrastructure/level-package.ts';
import { MapSession } from '../infrastructure/map-session.ts';
import { GlassMotion } from '../infrastructure/glass-motion.ts';
import type { Assets } from '../infrastructure/assets.ts';
import type {
  Point,
  Box,
  PointTuple,
  TileId,
  Entity,
} from '../domain/contracts.ts';
import type { Clipboard } from './model.ts';
import type { Tool, Gesture, Floating, Anchor } from './contracts.ts';
import { Dom } from '../infrastructure/dom.ts';
import { Guards } from '../shared/guards.ts';
import { GlassDialog } from '../infrastructure/glass-dialog.ts';
import { createViewport } from '../rendering/viewport.ts';
import { EditorRenderer } from './renderer.ts';
import { EditorTools } from './tools.ts';
import { EditorModel, blankLevel, screenCell } from './model.ts';
import { tiles } from '../domain/tiles.ts';
import { readMapFile } from '../infrastructure/map-files.ts';
import { playErrors } from '../simulation/map-validator.ts';
import { TileInspector } from './inspector.ts';
import { validateEntities } from '../domain/entities.ts';
import { BackgroundRenderer } from '../rendering/background.ts';
import { EditorTileCache } from './tile-cache.ts';
export class EditorController {
  root: HTMLElement;
  assets: Assets;
  onMenu: () => void;
  controller: AbortController;
  signal: AbortSignal;
  model: EditorModel;
  camera: Point;
  zoom: number;
  tool: Tool;
  tileId: TileId;
  selection: Box | null;
  clipboard: Clipboard | null;
  floating: Floating | null;
  gesture: Gesture | null;
  hover: Point | null;
  dirtyMap: boolean;
  last: number;
  raf: number;
  keys: Set<string>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mini: HTMLCanvasElement;
  mctx: CanvasRenderingContext2D;
  workspace: HTMLElement;
  notice: HTMLElement;
  widthInput: HTMLInputElement;
  heightInput: HTMLInputElement;
  zoomSelect: HTMLSelectElement;
  fileInput: HTMLInputElement;
  mapCache: HTMLCanvasElement;
  tileCache: EditorTileCache;
  background: BackgroundRenderer;
  scene: SceneController;
  private ioBusy = false;
  private incomingBackground:
    import('../domain/contracts.ts').BackgroundSpec | undefined;
  private sceneKey = '';
  backdrop: HTMLCanvasElement;
  backdropContext: CanvasRenderingContext2D;
  leaving: boolean;
  enemySpecies: EnemySpecies = 'bramble-guard';
  pathDraft: PointTuple[];
  entitySerial: number;
  project: (x: number, y: number) => Anchor;
  inspector: TileInspector;
  entityId: (type: string) => string;
  observer: ResizeObserver;
  miniDrag: boolean;
  typing: (e: Event) => boolean;
  renderer: EditorRenderer;
  constructor(root: HTMLElement, assets: Assets, onMenu: () => void) {
    this.root = root;
    this.assets = assets;
    this.onMenu = onMenu;
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    new GlassMotion(root, this.signal);
    Dom.require(this.root, '.tile-list', HTMLElement).innerHTML = tiles
      .filter((t) => t.id)
      .map(
        (t) =>
          `<button data-tile="${t.id}" title="${t.description || 'Solid terrain.'}" aria-pressed="${t.id === 1}"><img alt="" src="${this.assets[t.asset ?? '']?.src ?? ''}"><span>${t.name}</span></button>`,
      )
      .join('');
    this.model = new EditorModel();
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
    this.tool = 'brush';
    this.tileId = 1;
    this.selection = null;
    this.clipboard = null;
    this.floating = null;
    this.gesture = null;
    this.hover = null;
    this.dirtyMap = true;
    this.last = 0;
    this.raf = 0;
    this.keys = new Set<string>();
    this.canvas = Dom.require(this.root, '#editor-canvas', HTMLCanvasElement);
    this.ctx = Dom.context(this.canvas);
    this.mini = Dom.require(this.root, '#minimap', HTMLCanvasElement);
    this.mctx = Dom.context(this.mini);
    this.workspace = Dom.require(this.root, '.workspace', HTMLElement);
    this.notice = Dom.require(this.root, '#editor-notice', HTMLElement);
    this.widthInput = Dom.require(this.root, '#map-width', HTMLInputElement);
    this.heightInput = Dom.require(this.root, '#map-height', HTMLInputElement);
    this.zoomSelect = Dom.require(this.root, 'select', HTMLSelectElement);
    this.fileInput = Dom.require(this.root, '#editor-file', HTMLInputElement);
    this.mapCache = document.createElement('canvas');
    this.tileCache = new EditorTileCache(this.assets);
    this.background = new BackgroundRenderer();
    this.scene = new SceneController(this.background);
    void MapSession.cleanup();
    this.backdrop = Dom.require(
      document,
      '#editor-background',
      HTMLCanvasElement,
    );
    this.backdropContext = Dom.context(this.backdrop);
    this.leaving = false;
    this.pathDraft = [];
    this.entitySerial = 0;
    this.project = (x, y) => {
      const r = this.canvas.getBoundingClientRect(),
        unit = 32 * this.zoom;
      return {
        left: r.left + (x - this.camera.x) * unit,
        right: r.left + (x + 1 - this.camera.x) * unit,
        top: r.top + (y - this.camera.y) * unit,
        bottom: r.top + (y + 1 - this.camera.y) * unit,
      };
    };
    this.inspector = new TileInspector({
      root: this.root,
      assets: this.assets,
      getModel: () => this.model,
      project: this.project,
      signal: this.signal,
      onChange: (changed = true) => {
        if (changed) {
          this.dirtyMap = true;
          this.refresh();
        }
      },
    });
    this.entityId = (type) => {
      let id: string;
      do {
        id = `${type}-${++this.entitySerial}`;
      } while (this.model.level.entities?.some((e) => e.id === id));
      return id;
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.workspace);
    this.canvas.addEventListener(
      'pointerdown',
      async (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        this.canvas.focus();
        this.canvas.setPointerCapture(e.pointerId);
        const cell = this.at(e);
        this.hover = cell;
        if (this.tool === 'inspect') {
          const r = this.canvas.getBoundingClientRect(),
            point = {
              x:
                ((e.clientX - r.left) / (32 * this.zoom)) * 16 +
                this.camera.x * 16,
              y:
                ((e.clientY - r.top) / (32 * this.zoom)) * 16 +
                this.camera.y * 16,
            },
            hit = this.hitEntity(point);
          if (hit) {
            if (this.inspector.target?.entity === hit.entity.id) {
              if (!(await this.inspector.guard())) return;
              this.model.begin();
              this.gesture = {
                type: 'waypoint',
                id: hit.entity.id,
                index: hit.index,
              };
            } else await this.inspector.openEntity(hit.entity.id);
          } else if (this.model.level.tiles[cell.y]?.[cell.x] ?? 0) {
            await this.inspector.openTile(
              this.model.level.tiles[cell.y]?.[cell.x] ?? 0,
              cell,
              this.canvas,
            );
          } else if (await this.inspector.guard()) this.inspector.close();
          return;
        }
        if (this.tool === 'saw') {
          const point: PointTuple = [
            Math.max(
              16,
              Math.min((this.model.level.width - 1) * 16, cell.x * 16),
            ),
            Math.max(
              16,
              Math.min((this.model.level.height - 1) * 16, cell.y * 16),
            ),
          ];
          if (this.pathDraft.length < 32) this.pathDraft.push(point);
          this.message(
            'Saw path: click points, Enter to finish, Esc to cancel.',
          );
          return;
        }
        if (this.tool === 'enemy') {
          const stats = enemyDefinitions[this.enemySpecies];
          const x = cell.x * 16,
            y = (cell.y + 1) * 16 - stats.h;
          const span = stats.patrolRange / 2;
          this.addEntity({
            id: this.entityId('enemy'),
            type: 'enemy',
            species: this.enemySpecies,
            spawn: [x, y],
            facing: 1,
            patrol: [
              [Math.max(0, x - span), y],
              [Math.min(this.model.level.width * 16 - stats.w, x + span), y],
            ],
          });
          return;
        }
        if (this.tool === 'checkpoint') {
          this.addEntity({
            id: this.entityId('checkpoint'),
            type: 'checkpoint',
            position: [cell.x * 16 + 8, (cell.y + 1) * 16],
          });
          return;
        }
        if (this.floating) {
          if (!this.floating.source) {
            this.floating.x = cell.x;
            this.floating.y = cell.y;
          }
          this.commitFloating();
          return;
        }
        if (
          this.tool === 'select' &&
          this.selection &&
          cell.x >= this.selection.x &&
          cell.x < this.selection.x + this.selection.w &&
          cell.y >= this.selection.y &&
          cell.y < this.selection.y + this.selection.h
        ) {
          this.gesture = {
            type: 'move',
            start: cell,
            source: { ...this.selection },
          };
          this.floating = {
            data: this.model.copy(this.selection),
            x: this.selection.x,
            y: this.selection.y,
            source: { ...this.selection },
          };
          return;
        }
        this.gesture = {
          type: e.button === 2 ? 'erase' : this.tool,
          start: cell,
          last: cell,
          end: cell,
        };
        if (
          ['brush', 'erase', 'fill', 'spawn', 'portal'].includes(
            this.gesture.type,
          )
        )
          this.model.begin();
        if (this.gesture.type === 'brush' || this.gesture.type === 'erase') {
          this.model.set(
            cell.x,
            cell.y,
            this.gesture.type === 'erase' ? 0 : this.tileId,
          );
          this.dirtyMap = true;
        }
        if (this.gesture.type === 'fill') {
          this.model.fill(cell.x, cell.y, this.tileId);
          this.finish();
        }
        if (this.gesture?.type === 'spawn') {
          this.model.level.spawn = {
            x: cell.x * 16 + 3,
            y: (cell.y + 1) * 16 - 14,
          };
          this.finish();
        }
        if (this.gesture?.type === 'portal') {
          const x = cell.x * 16,
            y = cell.y * 16;
          if (
            x + 20 <= this.model.level.width * 16 &&
            y + 32 <= this.model.level.height * 16
          )
            this.model.level.portal = { x, y, w: 20, h: 32 };
          else this.message('The portal must fit inside the map.');
          this.finish();
        }
      },
      { signal: this.signal },
    );
    this.canvas.addEventListener(
      'pointermove',
      (e) => {
        this.hover = this.at(e);
        if (this.gesture?.type === 'waypoint') {
          const gesture = this.gesture;
          const entity = this.model.level.entities?.find(
            (v) => v.id === gesture.id,
          );
          if (!entity) return;
          if (entity.type === 'saw')
            entity.path[this.gesture.index] = [
              Math.max(
                16,
                Math.min((this.model.level.width - 1) * 16, this.hover.x * 16),
              ),
              Math.max(
                16,
                Math.min((this.model.level.height - 1) * 16, this.hover.y * 16),
              ),
            ];
          else if (entity.type === 'enemy') {
            const next: PointTuple = [
              this.hover.x * 16,
              (this.hover.y + 1) * 16 - enemyDefinitions[entity.species].h,
            ];
            if (this.gesture.index === 0) {
              const dx = next[0] - entity.spawn[0],
                dy = next[1] - entity.spawn[1];
              entity.spawn = next;
              entity.patrol = entity.patrol.map(([x, y]) => [x + dx, y + dy]);
            } else entity.patrol[this.gesture.index - 1] = next;
          } else if (entity.type === 'checkpoint')
            entity.position = [this.hover.x * 16 + 8, (this.hover.y + 1) * 16];
          return;
        }
        if (this.floating) {
          if (this.gesture?.type === 'move') {
            this.floating.x = Math.max(
              0,
              Math.min(
                this.model.level.width - 1,
                this.gesture.source.x + this.hover.x - this.gesture.start.x,
              ),
            );
            this.floating.y = Math.max(
              0,
              Math.min(
                this.model.level.height - 1,
                this.gesture.source.y + this.hover.y - this.gesture.start.y,
              ),
            );
          } else {
            this.floating.x = this.hover.x;
            this.floating.y = this.hover.y;
          }
        }
        if (!this.gesture) return;
        if ('end' in this.gesture) this.gesture.end = this.hover;
        if (this.gesture.type === 'brush' || this.gesture.type === 'erase') {
          this.model.line(
            this.gesture.last,
            this.hover,
            this.gesture.type === 'erase' ? 0 : this.tileId,
          );
          this.dirtyMap = true;
        }
        if ('last' in this.gesture) this.gesture.last = this.hover;
      },
      { signal: this.signal },
    );
    this.canvas.addEventListener('pointerup', this.release, {
      signal: this.signal,
    });
    this.canvas.addEventListener(
      'pointercancel',
      () => {
        this.model.cancel();
        this.gesture = null;
        this.floating = null;
        this.dirtyMap = true;
        this.refresh();
      },
      { signal: this.signal },
    );
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal: this.signal,
    });
    this.canvas.addEventListener(
      'pointerleave',
      () => {
        if (!this.gesture) this.hover = null;
      },
      { signal: this.signal },
    );
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.changeZoom(
          this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2),
          e.clientX,
          e.clientY,
        );
      },
      { signal: this.signal, passive: false },
    );
    this.zoomSelect.addEventListener(
      'change',
      () => this.changeZoom(Number(this.zoomSelect.value)),
      { signal: this.signal },
    );
    this.miniDrag = false;
    this.mini.addEventListener(
      'pointerdown',
      (e) => {
        this.miniDrag = true;
        this.mini.setPointerCapture(e.pointerId);
        this.miniNavigate(e);
      },
      { signal: this.signal },
    );
    this.mini.addEventListener(
      'pointermove',
      (e) => {
        if (this.miniDrag) this.miniNavigate(e);
      },
      { signal: this.signal },
    );
    this.mini.addEventListener('pointerup', () => (this.miniDrag = false), {
      signal: this.signal,
    });
    this.mini.addEventListener('pointercancel', () => (this.miniDrag = false), {
      signal: this.signal,
    });
    this.root.addEventListener(
      'click',
      async (e) => {
        if (!(e.target instanceof Element) || this.ioBusy) return;
        const t = e.target.closest<HTMLElement>('[data-tool]'),
          choice = e.target.closest<HTMLElement>('[data-tile]'),
          action =
            e.target.closest<HTMLElement>('[data-action]')?.dataset.action;
        if (
          t?.dataset.tool &&
          [
            'brush',
            'erase',
            'fill',
            'rectangle',
            'select',
            'spawn',
            'portal',
            'inspect',
            'saw',
            'checkpoint',
            'enemy',
          ].includes(t.dataset.tool)
        )
          await this.setTool(t.dataset.tool as Tool);
        const enemyChoice =
          e.target.closest<HTMLElement>('[data-enemy]')?.dataset.enemy;
        if (isEnemySpecies(enemyChoice)) {
          this.enemySpecies = enemyChoice;
          await this.setTool('enemy');
        }
        if (choice) {
          const id = Number(choice.dataset.tile);
          if (!Number.isInteger(id) || !tiles[id]) return;
          this.tileId = id as TileId;
          for (const b of this.root.querySelectorAll<HTMLElement>(
            '[data-tile]',
          ))
            b.setAttribute(
              'aria-pressed',
              String(Number(b.dataset.tile) === this.tileId),
            );
          Dom.require(this.root, '#tile-info', HTMLElement).textContent =
            tiles[this.tileId]?.description || 'Solid terrain.';
        }
        if (action === 'background') {
          if (!(await this.inspector.guard())) return;
          this.finish();
          const selected = await BackgroundDialog.open(
            this.model.level.background,
            this.signal,
            true,
          );
          if (selected && !this.signal.aborted) {
            this.model.begin();
            this.model.level.background = selected;
            this.model.commit();
            this.refresh();
          }
          this.collectResources();
        }
        if (action === 'menu' && (await this.canLeave())) {
          this.leaving = true;
          this.onMenu();
        }
        if (action === 'undo' || action === 'redo') {
          this.model[action]();
          this.floating = null;
          this.dirtyMap = true;
          this.refresh();
        }
        if (action === 'new') {
          const size = this.validSize();
          if (size && (await this.canLeave())) {
            this.inspector.close();
            this.model = new EditorModel(blankLevel(...size));
            this.camera = { x: 0, y: 0 };
            this.selection = null;
            this.floating = null;
            this.dirtyMap = true;
            this.refresh();
          }
        }
        if (action === 'resize') {
          const size = this.validSize();
          if (!size || !(await this.inspector.guard())) return;
          this.finish();
          const [w, h] = size,
            l = this.model.level;
          const removedTiles = l.tiles.some((row, y) =>
            row.some((id, x) => id && (x >= w || y >= h)),
          );
          const removedMarker = [
            l.spawn ? { ...l.spawn, w: 10, h: 14 } : null,
            l.portal,
          ].some((b) => b && (b.x + b.w > w * 16 || b.y + b.h > h * 16));
          if (
            (removedTiles ||
              removedMarker ||
              (l.entities || []).some((entity) =>
                entity.type === 'checkpoint'
                  ? entity.position[0] + 5 > w * 16 ||
                    entity.position[1] > h * 16
                  : entity.type === 'enemy'
                    ? [entity.spawn, ...entity.patrol].some(
                        ([x, y]) => x + 16 > w * 16 || y + 20 > h * 16,
                      )
                    : entity.path.some(
                        ([x, y]) =>
                          x + entity.radius > w * 16 ||
                          y + entity.radius > h * 16,
                      ),
              )) &&
            !(await GlassDialog.confirm(
              'Shrinking will remove tiles or markers outside the new bounds. Continue?',
              { signal: this.signal, title: 'Resize map', accept: 'Resize' },
            ))
          )
            return;
          this.model.begin();
          const removed = this.model.resize(w, h);
          this.model.commit();
          this.selection = null;
          this.floating = null;
          this.dirtyMap = true;
          this.clampCamera();
          this.refresh();
          if (removed)
            this.message(
              'Markers outside the resized map were removed. Undo restores them.',
            );
        }
        if (action === 'import') this.fileInput.click();
        if (action === 'export') {
          if (!(await this.inspector.guard())) return;
          this.finish();
          this.ioBusy = true;
          this.message('Preparing level ZIP...');
          const revision = this.model.revision,
            exporting = structuredClone(this.model.level);
          try {
            const atlas = await BackgroundResources.blob(exporting.background);
            const blob = await LevelPackageCodec.encode(exporting, atlas);
            if (this.signal.aborted) return;
            const url = URL.createObjectURL(blob),
              a = document.createElement('a');
            a.href = url;
            a.download = 'mossgate-map.zip';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.model.saved = revision;
          } catch (error) {
            if (!this.signal.aborted) this.message(Guards.error(error));
            return;
          } finally {
            this.ioBusy = false;
          }

          this.refresh();
          this.message(
            playErrors(this.model.level).length
              ? 'Draft exported. Place valid spawn and portal before playing.'
              : 'Map exported. Use Play in the main menu to open it.',
          );
        }
      },
      { signal: this.signal },
    );
    this.fileInput.addEventListener(
      'change',
      async () => {
        const file = this.fileInput.files?.[0];
        this.fileInput.value = '';
        if (!file || this.ioBusy) return;
        this.ioBusy = true;
        this.message('Opening map...');
        try {
          const imported = await readMapFile(file, { draft: true });
          this.incomingBackground = imported.background;
          if (this.signal.aborted || !(await this.canLeave())) return;
          this.inspector.close();
          this.model = new EditorModel(imported);
          this.selection = null;
          this.floating = null;
          this.camera = { x: 0, y: 0 };
          this.dirtyMap = true;
          this.refresh();
        } catch (error) {
          if (!this.signal.aborted) this.message(Guards.error(error));
        } finally {
          this.incomingBackground = undefined;
          this.ioBusy = false;
          if (!this.signal.aborted) this.collectResources();
        }
      },
      { signal: this.signal },
    );
    this.typing = (e) =>
      e.target instanceof HTMLElement &&
      !!e.target.closest('input,textarea,select');
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          this.typing(e) ||
          (e.target instanceof Element && e.target.closest('.inspector,dialog'))
        )
          return;
        if (
          e.code === 'Enter' &&
          this.tool === 'saw' &&
          this.pathDraft.length >= 2
        ) {
          e.preventDefault();
          if (
            this.addEntity({
              id: this.entityId('saw'),
              type: 'saw',
              path: this.pathDraft,
              speed: 64,
              radius: 8,
              mode: 'ping-pong',
              phase: 0,
            })
          )
            this.pathDraft = [];
          return;
        }
        if (e.code === 'Escape' && this.pathDraft.length) {
          this.pathDraft = [];
          return;
        }
        if (
          (e.code === 'Delete' || e.code === 'Backspace') &&
          this.inspector.target?.entity
        ) {
          e.preventDefault();
          this.model.begin();
          this.model.level.entities = (this.model.level.entities ?? []).filter(
            (entity) => entity.id !== this.inspector.target?.entity,
          );
          this.model.commit();
          this.inspector.close();
          this.dirtyMap = true;
          this.refresh();
          return;
        }
        if (
          e.code === 'Escape' &&
          this.inspector.target &&
          !this.pathDraft.length
        ) {
          e.preventDefault();
          this.inspector.close();
          return;
        }
        const modifier = e.ctrlKey || e.metaKey;
        if (modifier && ['KeyZ', 'KeyY', 'KeyC', 'KeyV'].includes(e.code)) {
          e.preventDefault();
          this.finish();
          if (e.code === 'KeyZ') {
            if (e.shiftKey) this.model.redo();
            else this.model.undo();
            this.dirtyMap = true;
          }
          if (e.code === 'KeyY') {
            this.model.redo();
            this.dirtyMap = true;
          }
          if (e.code === 'KeyC' && this.selection)
            this.clipboard = this.model.copy(this.selection);
          if (e.code === 'KeyV' && this.clipboard) {
            this.floating = {
              data: this.clipboard,
              x: this.hover?.x || 0,
              y: this.hover?.y || 0,
            };
            this.message(
              'Paste preview. Click or Enter to commit; Esc cancels.',
            );
          }
          this.refresh();
          return;
        }
        if (['KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
          e.preventDefault();
          this.keys.add(e.code);
        }
        if (e.code === 'Escape') {
          this.model.cancel();
          this.floating = null;
          this.gesture = null;
          this.dirtyMap = true;
          this.refresh();
        }
        if (e.code === 'Enter' && this.floating) {
          e.preventDefault();
          this.commitFloating();
        }
        if ((e.code === 'Delete' || e.code === 'Backspace') && this.selection) {
          e.preventDefault();
          this.model.begin();
          this.model.rectangle(
            { x: this.selection.x, y: this.selection.y },
            {
              x: this.selection.x + this.selection.w - 1,
              y: this.selection.y + this.selection.h - 1,
            },
            0,
          );
          this.model.removeRegionEntities(this.selection);
          this.model.commit();
          this.dirtyMap = true;
          this.refresh();
        }
      },
      { signal: this.signal },
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), {
      signal: this.signal,
    });
    window.addEventListener(
      'blur',
      () => {
        this.keys.clear();
        this.release();
      },
      { signal: this.signal },
    );
    this.root.addEventListener(
      'focusin',
      (e) => {
        if (this.typing(e)) this.keys.clear();
      },
      { signal: this.signal },
    );
    window.addEventListener(
      'beforeunload',
      (e) => {
        if (
          !this.leaving &&
          (this.model.dirty || this.model.pending || this.inspector.pending)
        ) {
          e.preventDefault();
          e.returnValue = '';
        }
      },
      { signal: this.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        cancelAnimationFrame(this.raf);
        this.keys.clear();
        this.last = performance.now();
        if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
      },
      { signal: this.signal },
    );
    this.mini.width = 240;
    this.mini.height = 144;
    this.renderer = new EditorRenderer(this);
    this.resize();
    this.refresh();
    this.raf = requestAnimationFrame(this.tick);
  }
  dispose() {
    this.controller.abort();
    this.inspector.dispose();
    this.scene.dispose();
    this.background.dispose();
    BackgroundResources.clear();
    this.backdrop.width = 1;
    this.backdrop.height = 1;
    this.tileCache.dispose();
    this.observer.disconnect();
    cancelAnimationFrame(this.raf);
  }
  addEntity = (entity: Entity) => {
    try {
      validateEntities(
        [...(this.model.level.entities || []), entity],
        this.model.level.width,
        this.model.level.height,
      );
      this.model.begin();
      this.model.level.entities ||= [];
      this.model.level.entities.push(entity);
      this.model.commit();
      this.dirtyMap = true;
      this.refresh();
      return true;
    } catch (error) {
      this.message(Guards.error(error));
      return false;
    }
  };
  hitEntity = (point: Point) => {
    let best = null;
    for (const entity of this.model.level.entities || []) {
      const path =
        entity.type === 'saw'
          ? entity.path
          : entity.type === 'enemy'
            ? [entity.spawn, ...entity.patrol]
            : [entity.position];
      for (let i = 0; i < path.length; i++)
        if (
          Math.hypot(
            point.x - (path[i]?.[0] ?? Infinity),
            point.y - (path[i]?.[1] ?? Infinity),
          ) < 12
        )
          best = { entity, index: i };
    }
    return best;
  };
  message = (text: string) => {
    this.notice.textContent = text;
  };
  finish = () => {
    if (this.model.pending) {
      this.model.commit();
      this.dirtyMap = true;
    }
    this.gesture = null;
    this.refresh();
  };
  canLeave = async () => {
    if (!(await this.inspector.guard())) return false;
    this.finish();
    return (
      !this.model.dirty ||
      (await GlassDialog.confirm(
        'Discard changes that have not been exported?',
        { signal: this.signal },
      ))
    );
  };
  collectResources = () => {
    const keys = new Set<string>();
    const add = (
      spec: import('../domain/contracts.ts').BackgroundSpec | undefined,
    ) => {
      if (spec) keys.add(BackgroundResources.key(spec));
    };
    add(this.incomingBackground);
    add(this.model.level.background);
    add(this.model.pending?.background);
    for (const command of [...this.model.history, ...this.model.future]) {
      add(command.before.background);
      add(command.after.background);
    }
    BackgroundResources.retain(keys);
  };
  refresh = () => {
    this.collectResources();
    const spec = this.model.level.background,
      key = BackgroundResources.key(spec) + ':' + (spec?.preset ?? 'night');
    if (key !== this.sceneKey) {
      this.sceneKey = key;
      void this.scene.apply(spec).catch((error) => {
        if (!this.signal.aborted) this.message(Guards.error(error));
      });
    }

    Dom.require(this.root, '[data-action="undo"]', HTMLButtonElement).disabled =
      !this.model.history.length;
    Dom.require(this.root, '[data-action="redo"]', HTMLButtonElement).disabled =
      !this.model.future.length;
    this.widthInput.value = String(this.model.level.width);
    this.heightInput.value = String(this.model.level.height);
    if (!this.gesture) {
      const problems = playErrors(this.model.level);
      this.message(
        problems.length
          ? `Draft: ${problems.join(' ')}`
          : this.model.dirty
            ? 'Ready to play. Export to save your changes.'
            : 'Ready to play.',
      );
    }
  };
  clampCamera = () => {
    this.camera.x = Math.max(
      0,
      Math.min(
        Math.max(
          0,
          this.model.level.width - this.canvas.clientWidth / (32 * this.zoom),
        ),
        this.camera.x,
      ),
    );
    this.camera.y = Math.max(
      0,
      Math.min(
        Math.max(
          0,
          this.model.level.height - this.canvas.clientHeight / (32 * this.zoom),
        ),
        this.camera.y,
      ),
    );
  };
  resize = () => {
    const backgroundView = createViewport(
      innerWidth,
      innerHeight,
      devicePixelRatio,
    );
    this.backdrop.width = backgroundView.bufferWidth;
    this.backdrop.height = backgroundView.bufferHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(
      1,
      Math.round(this.workspace.clientWidth * ratio),
    );
    this.canvas.height = Math.max(
      1,
      Math.round(this.workspace.clientHeight * ratio),
    );
    this.clampCamera();
  };
  at = (e: { clientX: number; clientY: number }) => {
    const cell = screenCell(
      e.clientX,
      e.clientY,
      this.canvas.getBoundingClientRect(),
      this.camera,
      this.zoom,
    );
    return {
      x: Math.max(0, Math.min(this.model.level.width - 1, cell.x)),
      y: Math.max(0, Math.min(this.model.level.height - 1, cell.y)),
    };
  };
  setTool = async (value: Tool) => {
    if (value !== 'inspect' && this.inspector.target) {
      if (!(await this.inspector.guard())) return;
      this.inspector.close();
    }
    this.finish();
    this.floating = null;
    this.tool = value;
    for (const button of this.root.querySelectorAll<HTMLElement>(
      '[data-enemy]',
    ))
      button.setAttribute(
        'aria-pressed',
        String(
          this.tool === 'enemy' && button.dataset.enemy === this.enemySpecies,
        ),
      );
    for (const b of this.root.querySelectorAll<HTMLElement>('[data-tool]'))
      b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool));
  };
  commitFloating = () => {
    if (!this.floating) return;
    this.model.begin();
    if (this.floating.source)
      this.model.rectangle(
        { x: this.floating.source.x, y: this.floating.source.y },
        {
          x: this.floating.source.x + this.floating.source.w - 1,
          y: this.floating.source.y + this.floating.source.h - 1,
        },
        0,
      );
    if (this.floating.source)
      this.model.removeRegionEntities(this.floating.source);
    const skipped = this.model.paste(
      this.floating.data,
      this.floating.x,
      this.floating.y,
      !!this.floating.source,
    );
    this.model.commit();
    this.selection = {
      x: this.floating.x,
      y: this.floating.y,
      w: Math.min(
        this.floating.data.w,
        this.model.level.width - this.floating.x,
      ),
      h: Math.min(
        this.floating.data.h,
        this.model.level.height - this.floating.y,
      ),
    };
    this.floating = null;
    this.dirtyMap = true;
    this.refresh();
    if (skipped)
      this.message(
        `${skipped} entities skipped: complete paths must fit inside the map.`,
      );
  };
  release = () => {
    if (!this.gesture) return;
    if (this.gesture.type === 'waypoint') {
      try {
        validateEntities(
          this.model.level.entities,
          this.model.level.width,
          this.model.level.height,
        );
        this.finish();
        this.inspector.refresh();
      } catch (error) {
        this.model.cancel();
        this.gesture = null;
        this.message(Guards.error(error));
      }
      return;
    }
    if (this.gesture.type === 'rectangle') {
      this.model.begin();
      this.model.rectangle(this.gesture.start, this.gesture.end, this.tileId);
    }
    if (this.gesture.type === 'select')
      this.selection = EditorTools.region(this.gesture.start, this.gesture.end);
    if (this.gesture.type === 'move') {
      this.gesture = null;
      this.message('Move preview. Enter or click to commit; Esc cancels.');
      return;
    }
    this.finish();
  };
  changeZoom = (next: number, clientX?: number, clientY?: number) => {
    const r = this.canvas.getBoundingClientRect(),
      px = (clientX ?? r.left + r.width / 2) - r.left,
      py = (clientY ?? r.top + r.height / 2) - r.top,
      wx = this.camera.x + px / (32 * this.zoom),
      wy = this.camera.y + py / (32 * this.zoom);
    this.zoom = Math.max(0.25, Math.min(4, next));
    this.camera.x = wx - px / (32 * this.zoom);
    this.camera.y = wy - py / (32 * this.zoom);
    this.clampCamera();
    const option = [...this.zoomSelect.options].find(
      (o) => Number(o.value) === this.zoom,
    );
    if (option) this.zoomSelect.value = option.value;
    else this.zoomSelect.selectedIndex = -1;
  };
  miniNavigate = (e: { clientX: number; clientY: number }) => {
    const r = this.mini.getBoundingClientRect(),
      l = this.model.level;
    const scale = Math.min(
        this.mini.width / l.width,
        this.mini.height / l.height,
      ),
      ox = (this.mini.width - l.width * scale) / 2,
      oy = (this.mini.height - l.height * scale) / 2;
    const px =
        ((e.clientX - r.left - this.mini.clientLeft) * this.mini.width) /
        this.mini.clientWidth,
      py =
        ((e.clientY - r.top - this.mini.clientTop) * this.mini.height) /
        this.mini.clientHeight;
    this.camera.x =
      (px - ox) / scale - this.canvas.clientWidth / (64 * this.zoom);
    this.camera.y =
      (py - oy) / scale - this.canvas.clientHeight / (64 * this.zoom);
    this.clampCamera();
  };
  validSize = (): [number, number] | null => {
    const w = Number(this.widthInput.value),
      h = Number(this.heightInput.value);
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 16 ||
      w > 512 ||
      h < 12 ||
      h > 128
    ) {
      this.message('Map size: width 16-512, height 12-128.');
      return null;
    }
    return [w, h];
  };
  draw = (dt = 0) => this.renderer.draw(dt);
  tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    this.camera.x +=
      ((Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))) *
        600 *
        dt) /
      (32 * this.zoom);
    this.camera.y +=
      ((Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'))) *
        600 *
        dt) /
      (32 * this.zoom);
    this.clampCamera();
    if (!document.hidden) {
      this.draw(dt);
      this.inspector.position();
    }
    if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
  };
}
export const mountEditor = (
  ...args: ConstructorParameters<typeof EditorController>
) => new EditorController(...args);
