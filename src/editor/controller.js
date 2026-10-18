import { GlassDialog } from '../infrastructure/glass-dialog.js';
import { createViewport } from '../rendering/viewport.js';
import { EditorRenderer } from './renderer.js';
import { EditorTools } from './tools.js';
import { EditorModel, blankLevel, screenCell } from './model.js';
import { tiles } from '../domain/tiles.js';
import { readMapFile } from '../infrastructure/map-files.js';
import { playErrors } from '../simulation/map-validator.js';
import { TileInspector } from './inspector.js';
import { validateEntities } from '../domain/entities.js';
import { BackgroundRenderer } from '../rendering/background.js';
import { EditorTileCache } from './tile-cache.js';
export class EditorController {
  constructor(root, assets, onMenu) {
    const self = this;
    self.root = root;
    self.assets = assets;
    self.onMenu = onMenu;
    self.controller = new AbortController();
    self.signal = self.controller.signal;
    self.root.querySelector('.tile-list').innerHTML = tiles
      .filter((t) => t.id)
      .map(
        (t) =>
          `<button data-tile="${t.id}" title="${t.description || 'Solid terrain.'}" aria-pressed="${t.id === 1}"><img alt="" src="${self.assets[t.asset].src}"><span>${t.name}</span></button>`,
      )
      .join('');
    self.model = new EditorModel();
    self.camera = { x: 0, y: 0 };
    self.zoom = 1;
    self.tool = 'brush';
    self.tileId = 1;
    self.selection = null;
    self.clipboard = null;
    self.floating = null;
    self.gesture = null;
    self.hover = null;
    self.dirtyMap = true;
    self.last = 0;
    self.raf = 0;
    self.keys = new Set();
    self.canvas = self.root.querySelector('#editor-canvas');
    self.ctx = self.canvas.getContext('2d');
    self.mini = self.root.querySelector('#minimap');
    self.mctx = self.mini.getContext('2d');
    self.workspace = self.root.querySelector('.workspace');
    self.notice = self.root.querySelector('#editor-notice');
    self.widthInput = self.root.querySelector('#map-width');
    self.heightInput = self.root.querySelector('#map-height');
    self.zoomSelect = self.root.querySelector('select');
    self.fileInput = self.root.querySelector('#editor-file');
    self.mapCache = document.createElement('canvas');
    self.tileCache = new EditorTileCache(self.assets);
    self.background = new BackgroundRenderer();
    self.backdrop = document.querySelector('#editor-background');
    self.backdropContext = self.backdrop.getContext('2d');
    self.leaving = false;
    self.pathDraft = [];
    self.entitySerial = 0;
    self.project = (x, y) => {
      const r = self.canvas.getBoundingClientRect(),
        unit = 32 * self.zoom;
      return {
        left: r.left + (x - self.camera.x) * unit,
        right: r.left + (x + 1 - self.camera.x) * unit,
        top: r.top + (y - self.camera.y) * unit,
        bottom: r.top + (y + 1 - self.camera.y) * unit,
      };
    };
    self.inspector = new TileInspector({
      root: self.root,
      assets: self.assets,
      getModel: () => self.model,
      project: self.project,
      signal: self.signal,
      onChange: (changed = true) => {
        if (changed) {
          self.dirtyMap = true;
          self.refresh();
        }
      },
    });
    self.entityId = (type) => {
      let id;
      do {
        id = `${type}-${++self.entitySerial}`;
      } while (self.model.level.entities?.some((e) => e.id === id));
      return id;
    };
    self.observer = new ResizeObserver(self.resize);
    self.observer.observe(self.workspace);
    self.canvas.addEventListener(
      'pointerdown',
      async (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        self.canvas.focus();
        self.canvas.setPointerCapture(e.pointerId);
        const cell = self.at(e);
        self.hover = cell;
        if (self.tool === 'inspect') {
          const r = self.canvas.getBoundingClientRect(),
            point = {
              x:
                ((e.clientX - r.left) / (32 * self.zoom)) * 16 +
                self.camera.x * 16,
              y:
                ((e.clientY - r.top) / (32 * self.zoom)) * 16 +
                self.camera.y * 16,
            },
            hit = self.hitEntity(point);
          if (hit) {
            if (self.inspector.target?.entity === hit.entity.id) {
              if (!(await self.inspector.guard())) return;
              self.model.begin();
              self.gesture = {
                type: 'waypoint',
                id: hit.entity.id,
                index: hit.index,
              };
            } else await self.inspector.openEntity(hit.entity.id);
          } else if (self.model.level.tiles[cell.y][cell.x]) {
            await self.inspector.openTile(
              self.model.level.tiles[cell.y][cell.x],
              cell,
              self.canvas,
            );
          } else if (await self.inspector.guard()) self.inspector.close();
          return;
        }
        if (self.tool === 'saw') {
          const point = [
            Math.max(
              16,
              Math.min((self.model.level.width - 1) * 16, cell.x * 16),
            ),
            Math.max(
              16,
              Math.min((self.model.level.height - 1) * 16, cell.y * 16),
            ),
          ];
          if (self.pathDraft.length < 32) self.pathDraft.push(point);
          self.message(
            'Saw path: click points, Enter to finish, Esc to cancel.',
          );
          return;
        }
        if (self.tool === 'checkpoint') {
          self.addEntity({
            id: self.entityId('checkpoint'),
            type: 'checkpoint',
            position: [cell.x * 16 + 8, (cell.y + 1) * 16],
          });
          return;
        }
        if (self.floating) {
          if (!self.floating.source) {
            self.floating.x = cell.x;
            self.floating.y = cell.y;
          }
          self.commitFloating();
          return;
        }
        if (
          self.tool === 'select' &&
          self.selection &&
          cell.x >= self.selection.x &&
          cell.x < self.selection.x + self.selection.w &&
          cell.y >= self.selection.y &&
          cell.y < self.selection.y + self.selection.h
        ) {
          self.gesture = {
            type: 'move',
            start: cell,
            source: { ...self.selection },
          };
          self.floating = {
            data: self.model.copy(self.selection),
            x: self.selection.x,
            y: self.selection.y,
            source: { ...self.selection },
          };
          return;
        }
        self.gesture = {
          type: e.button === 2 ? 'erase' : self.tool,
          start: cell,
          last: cell,
          end: cell,
        };
        if (
          ['brush', 'erase', 'fill', 'spawn', 'portal'].includes(
            self.gesture.type,
          )
        )
          self.model.begin();
        if (self.gesture.type === 'brush' || self.gesture.type === 'erase') {
          self.model.set(
            cell.x,
            cell.y,
            self.gesture.type === 'erase' ? 0 : self.tileId,
          );
          self.dirtyMap = true;
        }
        if (self.gesture.type === 'fill') {
          self.model.fill(cell.x, cell.y, self.tileId);
          self.finish();
        }
        if (self.gesture?.type === 'spawn') {
          self.model.level.spawn = {
            x: cell.x * 16 + 3,
            y: (cell.y + 1) * 16 - 14,
          };
          self.finish();
        }
        if (self.gesture?.type === 'portal') {
          const x = cell.x * 16,
            y = cell.y * 16;
          if (
            x + 20 <= self.model.level.width * 16 &&
            y + 32 <= self.model.level.height * 16
          )
            self.model.level.portal = { x, y, w: 20, h: 32 };
          else self.message('The portal must fit inside the map.');
          self.finish();
        }
      },
      { signal: self.signal },
    );
    self.canvas.addEventListener(
      'pointermove',
      (e) => {
        self.hover = self.at(e);
        if (self.gesture?.type === 'waypoint') {
          const entity = self.model.level.entities.find(
            (v) => v.id === self.gesture.id,
          );
          if (entity.type === 'saw')
            entity.path[self.gesture.index] = [
              Math.max(
                16,
                Math.min((self.model.level.width - 1) * 16, self.hover.x * 16),
              ),
              Math.max(
                16,
                Math.min((self.model.level.height - 1) * 16, self.hover.y * 16),
              ),
            ];
          else
            entity.position = [self.hover.x * 16 + 8, (self.hover.y + 1) * 16];
          return;
        }
        if (self.floating) {
          if (self.gesture?.type === 'move') {
            self.floating.x = Math.max(
              0,
              Math.min(
                self.model.level.width - 1,
                self.gesture.source.x + self.hover.x - self.gesture.start.x,
              ),
            );
            self.floating.y = Math.max(
              0,
              Math.min(
                self.model.level.height - 1,
                self.gesture.source.y + self.hover.y - self.gesture.start.y,
              ),
            );
          } else {
            self.floating.x = self.hover.x;
            self.floating.y = self.hover.y;
          }
        }
        if (!self.gesture) return;
        self.gesture.end = self.hover;
        if (self.gesture.type === 'brush' || self.gesture.type === 'erase') {
          self.model.line(
            self.gesture.last,
            self.hover,
            self.gesture.type === 'erase' ? 0 : self.tileId,
          );
          self.dirtyMap = true;
        }
        self.gesture.last = self.hover;
      },
      { signal: self.signal },
    );
    self.canvas.addEventListener('pointerup', self.release, {
      signal: self.signal,
    });
    self.canvas.addEventListener(
      'pointercancel',
      () => {
        self.model.cancel();
        self.gesture = null;
        self.floating = null;
        self.dirtyMap = true;
        self.refresh();
      },
      { signal: self.signal },
    );
    self.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal: self.signal,
    });
    self.canvas.addEventListener(
      'pointerleave',
      () => {
        if (!self.gesture) self.hover = null;
      },
      { signal: self.signal },
    );
    self.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        self.changeZoom(
          self.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2),
          e.clientX,
          e.clientY,
        );
      },
      { signal: self.signal, passive: false },
    );
    self.zoomSelect.addEventListener(
      'change',
      () => self.changeZoom(Number(self.zoomSelect.value)),
      { signal: self.signal },
    );
    self.miniDrag = false;
    self.mini.addEventListener(
      'pointerdown',
      (e) => {
        self.miniDrag = true;
        self.mini.setPointerCapture(e.pointerId);
        self.miniNavigate(e);
      },
      { signal: self.signal },
    );
    self.mini.addEventListener(
      'pointermove',
      (e) => {
        if (self.miniDrag) self.miniNavigate(e);
      },
      { signal: self.signal },
    );
    self.mini.addEventListener('pointerup', () => (self.miniDrag = false), {
      signal: self.signal,
    });
    self.mini.addEventListener('pointercancel', () => (self.miniDrag = false), {
      signal: self.signal,
    });
    self.root.addEventListener(
      'click',
      async (e) => {
        const t = e.target.closest('[data-tool]'),
          choice = e.target.closest('[data-tile]'),
          action = e.target.closest('[data-action]')?.dataset.action;
        if (t) await self.setTool(t.dataset.tool);
        if (choice) {
          self.tileId = Number(choice.dataset.tile);
          for (const b of self.root.querySelectorAll('[data-tile]'))
            b.setAttribute(
              'aria-pressed',
              String(Number(b.dataset.tile) === self.tileId),
            );
          self.root.querySelector('#tile-info').textContent =
            tiles[self.tileId].description || 'Solid terrain.';
        }
        if (action === 'menu' && (await self.canLeave())) {
          self.leaving = true;
          self.onMenu();
        }
        if (action === 'undo' || action === 'redo') {
          self.model[action]();
          self.floating = null;
          self.dirtyMap = true;
          self.refresh();
        }
        if (action === 'new') {
          const size = self.validSize();
          if (size && (await self.canLeave())) {
            self.inspector.close();
            self.model = new EditorModel(blankLevel(...size));
            self.camera = { x: 0, y: 0 };
            self.selection = null;
            self.floating = null;
            self.dirtyMap = true;
            self.refresh();
          }
        }
        if (action === 'resize') {
          const size = self.validSize();
          if (!size || !(await self.inspector.guard())) return;
          self.finish();
          const [w, h] = size,
            l = self.model.level;
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
                  : entity.path.some(
                      ([x, y]) =>
                        x + entity.radius > w * 16 ||
                        y + entity.radius > h * 16,
                    ),
              )) &&
            !(await GlassDialog.confirm(
              'Shrinking will remove tiles or markers outside the new bounds. Continue?',
              { signal: self.signal, title: 'Resize map', accept: 'Resize' },
            ))
          )
            return;
          self.model.begin();
          const removed = self.model.resize(w, h);
          self.model.commit();
          self.selection = null;
          self.floating = null;
          self.dirtyMap = true;
          self.clampCamera();
          self.refresh();
          if (removed)
            self.message(
              'Markers outside the resized map were removed. Undo restores them.',
            );
        }
        if (action === 'import') self.fileInput.click();
        if (action === 'export') {
          if (!(await self.inspector.guard())) return;
          self.finish();
          const blob = new Blob([self.model.export()], {
              type: 'application/json',
            }),
            url = URL.createObjectURL(blob),
            a = document.createElement('a');
          a.href = url;
          a.download = 'mossgate-map.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          self.model.saved = self.model.revision;
          self.refresh();
          self.message(
            playErrors(self.model.level).length
              ? 'Draft exported. Place valid spawn and portal before playing.'
              : 'Map exported. Use Play in the main menu to open it.',
          );
        }
      },
      { signal: self.signal },
    );
    self.fileInput.addEventListener(
      'change',
      async () => {
        const file = self.fileInput.files[0];
        self.fileInput.value = '';
        if (!file) return;
        try {
          const imported = await readMapFile(file, { draft: true });
          if (self.signal.aborted || !(await self.canLeave())) return;
          self.inspector.close();
          self.model = new EditorModel(imported);
          self.selection = null;
          self.floating = null;
          self.camera = { x: 0, y: 0 };
          self.dirtyMap = true;
          self.refresh();
        } catch (error) {
          if (!self.signal.aborted) self.message(error.message);
        }
      },
      { signal: self.signal },
    );
    self.typing = (e) =>
      e.target instanceof HTMLElement &&
      !!e.target.closest('input,textarea,select');
    window.addEventListener(
      'keydown',
      (e) => {
        if (self.typing(e) || e.target.closest?.('.inspector,dialog')) return;
        if (
          e.code === 'Enter' &&
          self.tool === 'saw' &&
          self.pathDraft.length >= 2
        ) {
          e.preventDefault();
          if (
            self.addEntity({
              id: self.entityId('saw'),
              type: 'saw',
              path: self.pathDraft,
              speed: 64,
              radius: 8,
              mode: 'ping-pong',
              phase: 0,
            })
          )
            self.pathDraft = [];
          return;
        }
        if (e.code === 'Escape' && self.pathDraft.length) {
          self.pathDraft = [];
          return;
        }
        if (
          (e.code === 'Delete' || e.code === 'Backspace') &&
          self.inspector.target?.entity
        ) {
          e.preventDefault();
          self.model.begin();
          self.model.level.entities = self.model.level.entities.filter(
            (entity) => entity.id !== self.inspector.target.entity,
          );
          self.model.commit();
          self.inspector.close();
          self.dirtyMap = true;
          self.refresh();
          return;
        }
        if (
          e.code === 'Escape' &&
          self.inspector.target &&
          !self.pathDraft.length
        ) {
          e.preventDefault();
          self.inspector.close();
          return;
        }
        const modifier = e.ctrlKey || e.metaKey;
        if (modifier && ['KeyZ', 'KeyY', 'KeyC', 'KeyV'].includes(e.code)) {
          e.preventDefault();
          self.finish();
          if (e.code === 'KeyZ') {
            if (e.shiftKey) self.model.redo();
            else self.model.undo();
            self.dirtyMap = true;
          }
          if (e.code === 'KeyY') {
            self.model.redo();
            self.dirtyMap = true;
          }
          if (e.code === 'KeyC' && self.selection)
            self.clipboard = self.model.copy(self.selection);
          if (e.code === 'KeyV' && self.clipboard) {
            self.floating = {
              data: self.clipboard,
              x: self.hover?.x || 0,
              y: self.hover?.y || 0,
            };
            self.message(
              'Paste preview. Click or Enter to commit; Esc cancels.',
            );
          }
          self.refresh();
          return;
        }
        if (['KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
          e.preventDefault();
          self.keys.add(e.code);
        }
        if (e.code === 'Escape') {
          self.model.cancel();
          self.floating = null;
          self.gesture = null;
          self.dirtyMap = true;
          self.refresh();
        }
        if (e.code === 'Enter' && self.floating) {
          e.preventDefault();
          self.commitFloating();
        }
        if ((e.code === 'Delete' || e.code === 'Backspace') && self.selection) {
          e.preventDefault();
          self.model.begin();
          self.model.rectangle(
            { x: self.selection.x, y: self.selection.y },
            {
              x: self.selection.x + self.selection.w - 1,
              y: self.selection.y + self.selection.h - 1,
            },
            0,
          );
          self.model.commit();
          self.dirtyMap = true;
          self.refresh();
        }
      },
      { signal: self.signal },
    );
    window.addEventListener('keyup', (e) => self.keys.delete(e.code), {
      signal: self.signal,
    });
    window.addEventListener(
      'blur',
      () => {
        self.keys.clear();
        self.release();
      },
      { signal: self.signal },
    );
    self.root.addEventListener(
      'focusin',
      (e) => {
        if (self.typing(e)) self.keys.clear();
      },
      { signal: self.signal },
    );
    window.addEventListener(
      'beforeunload',
      (e) => {
        if (
          !self.leaving &&
          (self.model.dirty || self.model.pending || self.inspector.pending)
        ) {
          e.preventDefault();
          e.returnValue = '';
        }
      },
      { signal: self.signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        cancelAnimationFrame(self.raf);
        self.keys.clear();
        self.last = performance.now();
        if (!document.hidden) self.raf = requestAnimationFrame(self.tick);
      },
      { signal: self.signal },
    );
    self.mini.width = 240;
    self.mini.height = 144;
    self.renderer = new EditorRenderer(self);
    self.resize();
    self.refresh();
    self.raf = requestAnimationFrame(self.tick);
    self.api = {
      canLeave: self.canLeave,
      dispose() {
        self.controller.abort();
        self.inspector.dispose();
        self.background.dispose();
        self.backdrop.width = 1;
        self.backdrop.height = 1;
        self.tileCache.dispose();
        self.observer.disconnect();
        cancelAnimationFrame(self.raf);
      },
    };
    if (import.meta.env.MODE === 'test')
      Object.assign(self.api, {
        snapshot: () =>
          structuredClone({
            level: self.model.level,
            camera: self.camera,
            zoom: self.zoom,
            dirty: self.model.dirty,
            history: self.model.history.length,
            future: self.model.future.length,
            tool: self.tool,
            selection: self.selection,
          }),
      });
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(self.api));
  }
  addEntity = (entity) => {
    const self = this;

    try {
      validateEntities(
        [...(self.model.level.entities || []), entity],
        self.model.level.width,
        self.model.level.height,
      );
      self.model.begin();
      self.model.level.entities ||= [];
      self.model.level.entities.push(entity);
      self.model.commit();
      self.dirtyMap = true;
      self.refresh();
      return true;
    } catch (error) {
      self.message(error.message);
      return false;
    }
  };
  hitEntity = (point) => {
    const self = this;

    let best = null;
    for (const entity of self.model.level.entities || []) {
      const path = entity.type === 'saw' ? entity.path : [entity.position];
      for (let i = 0; i < path.length; i++)
        if (Math.hypot(point.x - path[i][0], point.y - path[i][1]) < 12)
          best = { entity, index: i };
    }
    return best;
  };
  message = (text) => {
    const self = this;

    self.notice.textContent = text;
  };
  finish = () => {
    const self = this;

    if (self.model.pending) {
      self.model.commit();
      self.dirtyMap = true;
    }
    self.gesture = null;
    self.refresh();
  };
  canLeave = async () => {
    const self = this;

    if (!(await self.inspector.guard())) return false;
    self.finish();
    return (
      !self.model.dirty ||
      (await GlassDialog.confirm(
        'Discard changes that have not been exported?',
        { signal: self.signal },
      ))
    );
  };
  refresh = () => {
    const self = this;

    self.root.querySelector('[data-action="undo"]').disabled =
      !self.model.history.length;
    self.root.querySelector('[data-action="redo"]').disabled =
      !self.model.future.length;
    self.widthInput.value = self.model.level.width;
    self.heightInput.value = self.model.level.height;
    if (!self.gesture) {
      const problems = playErrors(self.model.level);
      self.message(
        problems.length
          ? `Draft: ${problems.join(' ')}`
          : self.model.dirty
            ? 'Ready to play. Export to save your changes.'
            : 'Ready to play.',
      );
    }
  };
  clampCamera = () => {
    const self = this;

    self.camera.x = Math.max(
      0,
      Math.min(
        Math.max(
          0,
          self.model.level.width - self.canvas.clientWidth / (32 * self.zoom),
        ),
        self.camera.x,
      ),
    );
    self.camera.y = Math.max(
      0,
      Math.min(
        Math.max(
          0,
          self.model.level.height - self.canvas.clientHeight / (32 * self.zoom),
        ),
        self.camera.y,
      ),
    );
  };
  resize = () => {
    const self = this;

    const backgroundView = createViewport(
      innerWidth,
      innerHeight,
      devicePixelRatio,
    );
    self.backdrop.width = backgroundView.bufferWidth;
    self.backdrop.height = backgroundView.bufferHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    self.canvas.width = Math.max(
      1,
      Math.round(self.workspace.clientWidth * ratio),
    );
    self.canvas.height = Math.max(
      1,
      Math.round(self.workspace.clientHeight * ratio),
    );
    self.clampCamera();
  };
  at = (e) => {
    const self = this;

    const cell = screenCell(
      e.clientX,
      e.clientY,
      self.canvas.getBoundingClientRect(),
      self.camera,
      self.zoom,
    );
    return {
      x: Math.max(0, Math.min(self.model.level.width - 1, cell.x)),
      y: Math.max(0, Math.min(self.model.level.height - 1, cell.y)),
    };
  };
  setTool = async (value) => {
    const self = this;

    if (value !== 'inspect' && self.inspector.target) {
      if (!(await self.inspector.guard())) return;
      self.inspector.close();
    }
    self.finish();
    self.floating = null;
    self.tool = value;
    for (const b of self.root.querySelectorAll('[data-tool]'))
      b.setAttribute('aria-pressed', String(b.dataset.tool === self.tool));
  };
  commitFloating = () => {
    const self = this;

    if (!self.floating) return;
    self.model.begin();
    if (self.floating.source)
      self.model.rectangle(
        { x: self.floating.source.x, y: self.floating.source.y },
        {
          x: self.floating.source.x + self.floating.source.w - 1,
          y: self.floating.source.y + self.floating.source.h - 1,
        },
        0,
      );
    self.model.paste(self.floating.data, self.floating.x, self.floating.y);
    self.model.commit();
    self.selection = {
      x: self.floating.x,
      y: self.floating.y,
      w: Math.min(
        self.floating.data.w,
        self.model.level.width - self.floating.x,
      ),
      h: Math.min(
        self.floating.data.h,
        self.model.level.height - self.floating.y,
      ),
    };
    self.floating = null;
    self.dirtyMap = true;
    self.refresh();
  };
  release = () => {
    const self = this;

    if (!self.gesture) return;
    if (self.gesture.type === 'waypoint') {
      try {
        validateEntities(
          self.model.level.entities,
          self.model.level.width,
          self.model.level.height,
        );
        self.finish();
        self.inspector.refresh();
      } catch (error) {
        self.model.cancel();
        self.gesture = null;
        self.message(error.message);
      }
      return;
    }
    if (self.gesture.type === 'rectangle') {
      self.model.begin();
      self.model.rectangle(self.gesture.start, self.gesture.end, self.tileId);
    }
    if (self.gesture.type === 'select')
      self.selection = EditorTools.region(self.gesture.start, self.gesture.end);
    if (self.gesture.type === 'move') {
      self.gesture = null;
      self.message('Move preview. Enter or click to commit; Esc cancels.');
      return;
    }
    self.finish();
  };
  changeZoom = (next, clientX, clientY) => {
    const self = this;

    const r = self.canvas.getBoundingClientRect(),
      px = (clientX ?? r.left + r.width / 2) - r.left,
      py = (clientY ?? r.top + r.height / 2) - r.top,
      wx = self.camera.x + px / (32 * self.zoom),
      wy = self.camera.y + py / (32 * self.zoom);
    self.zoom = Math.max(0.25, Math.min(4, next));
    self.camera.x = wx - px / (32 * self.zoom);
    self.camera.y = wy - py / (32 * self.zoom);
    self.clampCamera();
    const option = [...self.zoomSelect.options].find(
      (o) => Number(o.value) === self.zoom,
    );
    if (option) self.zoomSelect.value = option.value;
    else self.zoomSelect.selectedIndex = -1;
  };
  miniNavigate = (e) => {
    const self = this;

    const r = self.mini.getBoundingClientRect(),
      l = self.model.level;
    const scale = Math.min(
        self.mini.width / l.width,
        self.mini.height / l.height,
      ),
      ox = (self.mini.width - l.width * scale) / 2,
      oy = (self.mini.height - l.height * scale) / 2;
    const px =
        ((e.clientX - r.left - self.mini.clientLeft) * self.mini.width) /
        self.mini.clientWidth,
      py =
        ((e.clientY - r.top - self.mini.clientTop) * self.mini.height) /
        self.mini.clientHeight;
    self.camera.x =
      (px - ox) / scale - self.canvas.clientWidth / (64 * self.zoom);
    self.camera.y =
      (py - oy) / scale - self.canvas.clientHeight / (64 * self.zoom);
    self.clampCamera();
  };
  validSize = () => {
    const self = this;

    const w = Number(self.widthInput.value),
      h = Number(self.heightInput.value);
    if (
      !Number.isInteger(w) ||
      !Number.isInteger(h) ||
      w < 16 ||
      w > 512 ||
      h < 12 ||
      h > 128
    ) {
      self.message('Map size: width 16-512, height 12-128.');
      return null;
    }
    return [w, h];
  };
  draw = () => this.renderer.draw();
  tick = (now) => {
    const self = this;

    const dt = Math.min(0.05, (now - self.last) / 1000 || 0);
    self.last = now;
    self.camera.x +=
      ((Number(self.keys.has('KeyD')) - Number(self.keys.has('KeyA'))) *
        600 *
        dt) /
      (32 * self.zoom);
    self.camera.y +=
      ((Number(self.keys.has('KeyS')) - Number(self.keys.has('KeyW'))) *
        600 *
        dt) /
      (32 * self.zoom);
    self.clampCamera();
    if (!document.hidden) {
      self.draw();
      self.inspector.position();
    }
    if (!document.hidden) self.raf = requestAnimationFrame(self.tick);
  };
}
export const mountEditor = (...args) => new EditorController(...args);
