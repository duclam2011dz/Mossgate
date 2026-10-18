import { EditorTools } from './tools.js';
import { tiles } from '../domain/tiles.js';
import { resolvedBox } from '../domain/properties.js';
import { BackgroundRenderer } from '../rendering/background.js';
export class EditorRenderer {
  constructor(editor) {
    this.editor = editor;
  }
  draw() {
    const self = this.editor;

    const ratio = self.canvas.width / self.canvas.clientWidth,
      unit = 32 * self.zoom,
      l = self.model.level;
    const bg = BackgroundRenderer.editorPageView(
      self.camera,
      self.zoom,
      innerWidth,
      innerHeight,
      self.workspace.getBoundingClientRect(),
    );
    self.background.draw(self.backdropContext, self.assets, bg.camera, bg.view);
    self.ctx.setTransform(1, 0, 0, 1, 0, 0);
    self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
    self.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    self.ctx.imageSmoothingEnabled = false;
    self.ctx.fillStyle = 'rgba(174,203,165,.16)';
    self.ctx.fillRect(
      -self.camera.x * unit,
      -self.camera.y * unit,
      l.width * unit,
      l.height * unit,
    );
    self.tileCache.draw(
      self.ctx,
      l,
      self.camera,
      unit,
      self.canvas.clientWidth,
      self.canvas.clientHeight,
      ratio,
    );
    const active = self.inspector.target;
    if (
      self.root.querySelector('#show-hitboxes').checked ||
      active?.x !== undefined
    ) {
      for (
        let y = Math.max(0, Math.floor(self.camera.y));
        y <
        Math.min(
          l.height,
          Math.ceil(self.camera.y + self.canvas.clientHeight / unit),
        );
        y++
      )
        for (
          let x = Math.max(0, Math.floor(self.camera.x));
          x <
          Math.min(
            l.width,
            Math.ceil(self.camera.x + self.canvas.clientWidth / unit),
          );
          x++
        ) {
          const id = l.tiles[y][x];
          if (
            !id ||
            (!self.root.querySelector('#show-hitboxes').checked &&
              (active.x !== x || active.y !== y))
          )
            continue;
          const box = resolvedBox(l, id, x, y);
          self.ctx.strokeStyle =
            tiles[id].kind === 'hazard' ? '#a5352c' : '#426c76';
          self.ctx.lineWidth = 1.5;
          self.ctx.strokeRect(
            (box.x / 16 - self.camera.x) * unit,
            (box.y / 16 - self.camera.y) * unit,
            (box.w / 16) * unit,
            (box.h / 16) * unit,
          );
        }
    }
    for (const original of l.entities || []) {
      const entity =
        self.inspector.previewEntity?.id === original.id
          ? self.inspector.previewEntity
          : original;
      if (entity.type === 'saw') {
        self.ctx.strokeStyle = '#8e553a';
        self.ctx.lineWidth = 2;
        self.ctx.setLineDash([5, 4]);
        self.ctx.beginPath();
        entity.path.forEach(([x, y], i) => {
          if (i)
            self.ctx.lineTo(
              (x / 16 - self.camera.x) * unit,
              (y / 16 - self.camera.y) * unit,
            );
          else
            self.ctx.moveTo(
              (x / 16 - self.camera.x) * unit,
              (y / 16 - self.camera.y) * unit,
            );
        });
        if (entity.mode === 'loop') self.ctx.closePath();
        self.ctx.stroke();
        self.ctx.setLineDash([]);
        entity.path.forEach(([x, y], i) => {
          self.ctx.fillStyle = '#9a5b32';
          self.ctx.fillRect(
            (x / 16 - self.camera.x) * unit - 4,
            (y / 16 - self.camera.y) * unit - 4,
            8,
            8,
          );
          self.ctx.font = '11px monospace';
          self.ctx.fillText(
            String(i + 1),
            (x / 16 - self.camera.x) * unit + 6,
            (y / 16 - self.camera.y) * unit - 6,
          );
        });
        const [x, y] = entity.path[0];
        self.ctx.drawImage(
          self.assets.saw,
          (x / 16 - self.camera.x - entity.radius / 16) * unit,
          (y / 16 - self.camera.y - entity.radius / 16) * unit,
          (entity.radius / 8) * unit,
          (entity.radius / 8) * unit,
        );
      } else {
        const [x, y] = entity.position;
        self.ctx.drawImage(
          self.assets.checkpoint,
          (x / 16 - self.camera.x - 0.5) * unit,
          (y / 16 - self.camera.y - 2) * unit,
          unit,
          unit * 2,
        );
      }
    }
    if (self.pathDraft.length) {
      self.ctx.strokeStyle = '#a96431';
      self.ctx.beginPath();
      self.pathDraft.forEach(([x, y], i) => {
        if (i)
          self.ctx.lineTo(
            (x / 16 - self.camera.x) * unit,
            (y / 16 - self.camera.y) * unit,
          );
        else
          self.ctx.moveTo(
            (x / 16 - self.camera.x) * unit,
            (y / 16 - self.camera.y) * unit,
          );
        self.ctx.fillStyle = '#a96431';
        self.ctx.fillRect(
          (x / 16 - self.camera.x) * unit - 3,
          (y / 16 - self.camera.y) * unit - 3,
          6,
          6,
        );
      });
      self.ctx.stroke();
    }
    self.ctx.strokeStyle = 'rgba(220,242,211,.16)';
    self.ctx.lineWidth = 1 / ratio;
    self.ctx.beginPath();
    for (
      let x = Math.max(0, Math.floor(self.camera.x));
      x <=
      Math.min(
        l.width,
        Math.ceil(self.camera.x + self.canvas.clientWidth / unit),
      );
      x++
    ) {
      self.ctx.moveTo((x - self.camera.x) * unit, 0);
      self.ctx.lineTo((x - self.camera.x) * unit, self.canvas.clientHeight);
    }
    for (
      let y = Math.max(0, Math.floor(self.camera.y));
      y <=
      Math.min(
        l.height,
        Math.ceil(self.camera.y + self.canvas.clientHeight / unit),
      );
      y++
    ) {
      self.ctx.moveTo(0, (y - self.camera.y) * unit);
      self.ctx.lineTo(self.canvas.clientWidth, (y - self.camera.y) * unit);
    }
    self.ctx.stroke();
    for (const [name, b] of [
      ['spawn', l.spawn ? { ...l.spawn, w: 10, h: 14 } : null],
      ['portal', l.portal],
    ])
      if (b) {
        self.ctx.globalAlpha = 0.85;
        const img = self.assets[name === 'spawn' ? 'player' : 'portal'];
        self.ctx.drawImage(
          img,
          (b.x / 16 - self.camera.x) * unit,
          (b.y / 16 - self.camera.y) * unit,
          (b.w / 16) * unit,
          (b.h / 16) * unit,
        );
        self.ctx.globalAlpha = 1;
        self.ctx.strokeStyle = name === 'spawn' ? '#a57825' : '#5b8c87';
        self.ctx.strokeRect(
          (b.x / 16 - self.camera.x) * unit,
          (b.y / 16 - self.camera.y) * unit,
          (b.w / 16) * unit,
          (b.h / 16) * unit,
        );
      }
    function outline(r, color = '#bd8b31') {
      self.ctx.fillStyle = color + '22';
      self.ctx.fillRect(
        (r.x - self.camera.x) * unit,
        (r.y - self.camera.y) * unit,
        r.w * unit,
        r.h * unit,
      );
      self.ctx.strokeStyle = color;
      self.ctx.lineWidth = 2;
      self.ctx.strokeRect(
        (r.x - self.camera.x) * unit,
        (r.y - self.camera.y) * unit,
        r.w * unit,
        r.h * unit,
      );
    }
    if (self.selection) outline(self.selection, '#587f8d');
    if (self.gesture && ['rectangle', 'select'].includes(self.gesture.type))
      outline(EditorTools.region(self.gesture.start, self.gesture.end));
    if (self.floating) {
      self.ctx.globalAlpha = 0.6;
      for (let y = 0; y < self.floating.data.h; y++)
        for (let x = 0; x < self.floating.data.w; x++) {
          const id = self.floating.data.cells[y][x],
            tx = self.floating.x + x,
            ty = self.floating.y + y;
          if (id && tx < l.width && ty < l.height)
            self.ctx.drawImage(
              self.assets[tiles[id].asset],
              (tx - self.camera.x) * unit,
              (ty - self.camera.y) * unit,
              unit,
              unit,
            );
        }
      self.ctx.globalAlpha = 1;
      outline({
        x: self.floating.x,
        y: self.floating.y,
        w: Math.min(self.floating.data.w, l.width - self.floating.x),
        h: Math.min(self.floating.data.h, l.height - self.floating.y),
      });
    } else if (self.hover) {
      if (self.tool === 'spawn' || self.tool === 'portal') {
        const spawn = self.tool === 'spawn',
          w = spawn ? 10 / 16 : 20 / 16,
          h = spawn ? 14 / 16 : 2,
          x = self.hover.x + (spawn ? 3 / 16 : 0),
          y = self.hover.y + (spawn ? 2 / 16 : 0);
        self.ctx.globalAlpha = 0.45;
        self.ctx.drawImage(
          self.assets[spawn ? 'player' : 'portal'],
          (x - self.camera.x) * unit,
          (y - self.camera.y) * unit,
          w * unit,
          h * unit,
        );
        self.ctx.globalAlpha = 1;
        outline({ x, y, w, h });
      } else {
        if (self.tool === 'brush' || self.tool === 'rectangle') {
          self.ctx.globalAlpha = 0.4;
          self.ctx.drawImage(
            self.assets[tiles[self.tileId].asset],
            (self.hover.x - self.camera.x) * unit,
            (self.hover.y - self.camera.y) * unit,
            unit,
            unit,
          );
          self.ctx.globalAlpha = 1;
        }
        outline({ x: self.hover.x, y: self.hover.y, w: 1, h: 1 });
      }
    }
    self.root.querySelector('#editor-coordinates').textContent = self.hover
      ? `${self.hover.x}, ${self.hover.y}`
      : '';
    if (self.dirtyMap) {
      self.mapCache.width = l.width;
      self.mapCache.height = l.height;
      const cache = self.mapCache.getContext('2d'),
        pixels = cache.createImageData(l.width, l.height);
      const palette = tiles.map((t) =>
        [1, 3, 5].map((i) => parseInt(t.color.slice(i, i + 2), 16)),
      );
      for (let y = 0; y < l.height; y++)
        for (let x = 0; x < l.width; x++)
          pixels.data.set(
            [...palette[l.tiles[y][x]], l.tiles[y][x] ? 255 : 0],
            (y * l.width + x) * 4,
          );
      cache.putImageData(pixels, 0, 0);
      self.dirtyMap = false;
    }
    const mw = self.mini.width,
      mh = self.mini.height,
      scale = Math.min(mw / l.width, mh / l.height),
      ox = (mw - l.width * scale) / 2,
      oy = (mh - l.height * scale) / 2;
    self.mctx.clearRect(0, 0, mw, mh);
    self.mctx.imageSmoothingEnabled = false;
    self.mctx.drawImage(
      self.mapCache,
      ox,
      oy,
      l.width * scale,
      l.height * scale,
    );
    self.mctx.strokeStyle = '#f5d99a';
    self.mctx.lineWidth = 2;
    self.mctx.strokeRect(
      ox + self.camera.x * scale,
      oy + self.camera.y * scale,
      Math.min(l.width, self.canvas.clientWidth / unit) * scale,
      Math.min(l.height, self.canvas.clientHeight / unit) * scale,
    );
    for (const marker of [l.spawn, l.portal])
      if (marker) {
        self.mctx.fillStyle = marker === l.spawn ? '#a86d17' : '#4b8887';
        self.mctx.fillRect(
          ox + (marker.x / 16) * scale - 2,
          oy + (marker.y / 16) * scale - 2,
          4,
          4,
        );
      }
  }
}
