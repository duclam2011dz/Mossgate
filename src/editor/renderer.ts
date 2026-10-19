import { enemyStats } from '../domain/enemy-definitions.ts';
import type { Box } from '../domain/contracts.ts';
import { AssetManager } from '../infrastructure/assets.ts';
import type { EditorController } from './controller.ts';
import { Dom } from '../infrastructure/dom.ts';
import { EditorTools } from './tools.ts';
import { tiles } from '../domain/tiles.ts';
import { resolvedBox } from '../domain/properties.ts';
import { BackgroundRenderer } from '../rendering/background.ts';
export class EditorRenderer {
  constructor(readonly editor: EditorController) {}
  draw(dt = 0) {
    const editor = this.editor;

    const ratio = editor.canvas.width / editor.canvas.clientWidth,
      unit = 32 * editor.zoom,
      l = editor.model.level;
    const bg = BackgroundRenderer.editorPageView(
      editor.camera,
      editor.zoom,
      innerWidth,
      innerHeight,
      editor.workspace.getBoundingClientRect(),
    );
    editor.background.draw(
      editor.backdropContext,
      editor.assets,
      bg.camera,
      bg.view,
      dt,
      matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    editor.ctx.setTransform(1, 0, 0, 1, 0, 0);
    editor.ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);
    editor.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    editor.ctx.imageSmoothingEnabled = false;
    editor.ctx.fillStyle = 'rgba(174,203,165,.16)';
    editor.ctx.fillRect(
      -editor.camera.x * unit,
      -editor.camera.y * unit,
      l.width * unit,
      l.height * unit,
    );
    editor.tileCache.draw(
      editor.ctx,
      l,
      editor.camera,
      unit,
      editor.canvas.clientWidth,
      editor.canvas.clientHeight,
      ratio,
    );
    const active = editor.inspector.target;
    if (
      Dom.require(editor.root, '#show-hitboxes', HTMLInputElement).checked ||
      active?.x !== undefined
    ) {
      for (
        let y = Math.max(0, Math.floor(editor.camera.y));
        y <
        Math.min(
          l.height,
          Math.ceil(editor.camera.y + editor.canvas.clientHeight / unit),
        );
        y++
      )
        for (
          let x = Math.max(0, Math.floor(editor.camera.x));
          x <
          Math.min(
            l.width,
            Math.ceil(editor.camera.x + editor.canvas.clientWidth / unit),
          );
          x++
        ) {
          const id = l.tiles[y]?.[x] ?? 0;
          if (
            !id ||
            (!Dom.require(editor.root, '#show-hitboxes', HTMLInputElement)
              .checked &&
              (active?.x !== x || active?.y !== y))
          )
            continue;
          const box = resolvedBox(l, id, x, y);
          editor.ctx.strokeStyle =
            tiles[id]?.kind === 'hazard' ? '#a5352c' : '#426c76';
          editor.ctx.lineWidth = 1.5;
          editor.ctx.strokeRect(
            (box.x / 16 - editor.camera.x) * unit,
            (box.y / 16 - editor.camera.y) * unit,
            (box.w / 16) * unit,
            (box.h / 16) * unit,
          );
        }
    }
    for (const original of l.entities || []) {
      const entity =
        editor.inspector.previewEntity?.id === original.id
          ? editor.inspector.previewEntity
          : original;
      if (entity.type === 'saw') {
        editor.ctx.strokeStyle = '#8e553a';
        editor.ctx.lineWidth = 2;
        editor.ctx.setLineDash([5, 4]);
        editor.ctx.beginPath();
        entity.path.forEach(([x, y], i) => {
          if (i)
            editor.ctx.lineTo(
              (x / 16 - editor.camera.x) * unit,
              (y / 16 - editor.camera.y) * unit,
            );
          else
            editor.ctx.moveTo(
              (x / 16 - editor.camera.x) * unit,
              (y / 16 - editor.camera.y) * unit,
            );
        });
        if (entity.mode === 'loop') editor.ctx.closePath();
        editor.ctx.stroke();
        editor.ctx.setLineDash([]);
        entity.path.forEach(([x, y], i) => {
          editor.ctx.fillStyle = '#9a5b32';
          editor.ctx.fillRect(
            (x / 16 - editor.camera.x) * unit - 4,
            (y / 16 - editor.camera.y) * unit - 4,
            8,
            8,
          );
          editor.ctx.font = '11px monospace';
          editor.ctx.fillText(
            String(i + 1),
            (x / 16 - editor.camera.x) * unit + 6,
            (y / 16 - editor.camera.y) * unit - 6,
          );
        });
        const first = entity.path[0];
        if (!first) continue;
        const [x, y] = first;
        editor.ctx.drawImage(
          AssetManager.image(editor.assets, 'saw'),
          (x / 16 - editor.camera.x - entity.radius / 16) * unit,
          (y / 16 - editor.camera.y - entity.radius / 16) * unit,
          (entity.radius / 8) * unit,
          (entity.radius / 8) * unit,
        );
      } else if (entity.type === 'enemy') {
        const [x, y] = entity.spawn;
        editor.ctx.drawImage(
          AssetManager.image(editor.assets, `enemy-${entity.species}-preview`),
          (x / 16 - editor.camera.x - 0.5) * unit,
          (y / 16 - editor.camera.y - 0.75) * unit,
          unit * 2,
          unit * 2,
        );
        if (
          editor.inspector.selectionTarget?.kind === 'entity' &&
          editor.inspector.selectionTarget.entity === entity.id
        ) {
          const stats = enemyStats(entity);
          const cx = (x / 16 - editor.camera.x + stats.w / 32) * unit,
            cy = (y / 16 - editor.camera.y + stats.h / 32) * unit;
          editor.ctx.save();
          editor.ctx.strokeStyle = '#c2d8ab44';
          editor.ctx.setLineDash([4, 6]);
          editor.ctx.beginPath();
          editor.ctx.arc(cx, cy, (stats.leash / 16) * unit, 0, Math.PI * 2);
          editor.ctx.stroke();
          const angle = entity.facing === 1 ? 0 : Math.PI,
            half = ((stats.flying ? 135 : 60) * Math.PI) / 180;
          editor.ctx.strokeStyle = '#f2d99d88';
          editor.ctx.beginPath();
          editor.ctx.moveTo(cx, cy);
          editor.ctx.arc(
            cx,
            cy,
            (stats.detectionRange / 16) * unit,
            angle - half,
            angle + half,
          );
          editor.ctx.closePath();
          editor.ctx.stroke();
          editor.ctx.restore();
          editor.ctx.strokeStyle = '#d5dc8e';
          editor.ctx.beginPath();
          entity.patrol.forEach(([px, py], i) => {
            const ax = (px / 16 - editor.camera.x) * unit,
              ay = (py / 16 - editor.camera.y) * unit;
            if (i === 0) editor.ctx.moveTo(ax, ay);
            else editor.ctx.lineTo(ax, ay);
          });
          editor.ctx.stroke();
        }
      } else if (entity.type === 'checkpoint') {
        const [x, y] = entity.position;
        editor.ctx.drawImage(
          AssetManager.image(editor.assets, 'checkpoint'),
          (x / 16 - editor.camera.x - 0.5) * unit,
          (y / 16 - editor.camera.y - 2) * unit,
          unit,
          unit * 2,
        );
      }
    }
    if (editor.pathDraft.length) {
      editor.ctx.strokeStyle = '#a96431';
      editor.ctx.beginPath();
      editor.pathDraft.forEach(([x, y], i) => {
        if (i)
          editor.ctx.lineTo(
            (x / 16 - editor.camera.x) * unit,
            (y / 16 - editor.camera.y) * unit,
          );
        else
          editor.ctx.moveTo(
            (x / 16 - editor.camera.x) * unit,
            (y / 16 - editor.camera.y) * unit,
          );
        editor.ctx.fillStyle = '#a96431';
        editor.ctx.fillRect(
          (x / 16 - editor.camera.x) * unit - 3,
          (y / 16 - editor.camera.y) * unit - 3,
          6,
          6,
        );
      });
      editor.ctx.stroke();
    }
    editor.ctx.strokeStyle = 'rgba(220,242,211,.16)';
    editor.ctx.lineWidth = 1 / ratio;
    editor.ctx.beginPath();
    for (
      let x = Math.max(0, Math.floor(editor.camera.x));
      x <=
      Math.min(
        l.width,
        Math.ceil(editor.camera.x + editor.canvas.clientWidth / unit),
      );
      x++
    ) {
      editor.ctx.moveTo((x - editor.camera.x) * unit, 0);
      editor.ctx.lineTo(
        (x - editor.camera.x) * unit,
        editor.canvas.clientHeight,
      );
    }
    for (
      let y = Math.max(0, Math.floor(editor.camera.y));
      y <=
      Math.min(
        l.height,
        Math.ceil(editor.camera.y + editor.canvas.clientHeight / unit),
      );
      y++
    ) {
      editor.ctx.moveTo(0, (y - editor.camera.y) * unit);
      editor.ctx.lineTo(
        editor.canvas.clientWidth,
        (y - editor.camera.y) * unit,
      );
    }
    editor.ctx.stroke();
    for (const [name, b] of [
      ['spawn', l.spawn ? { ...l.spawn, w: 10, h: 14 } : null],
      ['portal', l.portal],
    ] satisfies [string, Box | null][])
      if (b) {
        editor.ctx.globalAlpha = 0.85;
        const img = AssetManager.image(
          editor.assets,
          name === 'spawn' ? 'player' : 'portal',
        );
        editor.ctx.drawImage(
          img,
          (b.x / 16 - editor.camera.x) * unit,
          (b.y / 16 - editor.camera.y) * unit,
          (b.w / 16) * unit,
          (b.h / 16) * unit,
        );
        editor.ctx.globalAlpha = 1;
        editor.ctx.strokeStyle = name === 'spawn' ? '#a57825' : '#5b8c87';
        editor.ctx.strokeRect(
          (b.x / 16 - editor.camera.x) * unit,
          (b.y / 16 - editor.camera.y) * unit,
          (b.w / 16) * unit,
          (b.h / 16) * unit,
        );
      }
    function outline(r: Box, color = '#bd8b31') {
      editor.ctx.fillStyle = color + '22';
      editor.ctx.fillRect(
        (r.x - editor.camera.x) * unit,
        (r.y - editor.camera.y) * unit,
        r.w * unit,
        r.h * unit,
      );
      editor.ctx.strokeStyle = color;
      editor.ctx.lineWidth = 2;
      editor.ctx.strokeRect(
        (r.x - editor.camera.x) * unit,
        (r.y - editor.camera.y) * unit,
        r.w * unit,
        r.h * unit,
      );
    }
    if (editor.selection) outline(editor.selection, '#587f8d');
    if (
      editor.gesture &&
      (editor.gesture.type === 'rectangle' || editor.gesture.type === 'select')
    )
      outline(EditorTools.region(editor.gesture.start, editor.gesture.end));
    if (editor.floating) {
      editor.ctx.globalAlpha = 0.6;
      for (let y = 0; y < editor.floating.data.h; y++)
        for (let x = 0; x < editor.floating.data.w; x++) {
          const id = editor.floating.data.cells[y]?.[x] ?? 0,
            tx = editor.floating.x + x,
            ty = editor.floating.y + y;
          if (id && tx < l.width && ty < l.height)
            editor.ctx.drawImage(
              AssetManager.image(editor.assets, tiles[id]?.asset ?? ''),
              (tx - editor.camera.x) * unit,
              (ty - editor.camera.y) * unit,
              unit,
              unit,
            );
        }
      editor.ctx.globalAlpha = 1;
      outline({
        x: editor.floating.x,
        y: editor.floating.y,
        w: Math.min(editor.floating.data.w, l.width - editor.floating.x),
        h: Math.min(editor.floating.data.h, l.height - editor.floating.y),
      });
    } else if (editor.hover) {
      if (editor.tool === 'spawn' || editor.tool === 'portal') {
        const spawn = editor.tool === 'spawn',
          w = spawn ? 10 / 16 : 20 / 16,
          h = spawn ? 14 / 16 : 2,
          x = editor.hover.x + (spawn ? 3 / 16 : 0),
          y = editor.hover.y + (spawn ? 2 / 16 : 0);
        editor.ctx.globalAlpha = 0.45;
        editor.ctx.drawImage(
          AssetManager.image(editor.assets, spawn ? 'player' : 'portal'),
          (x - editor.camera.x) * unit,
          (y - editor.camera.y) * unit,
          w * unit,
          h * unit,
        );
        editor.ctx.globalAlpha = 1;
        outline({ x, y, w, h });
      } else {
        if (editor.tool === 'brush' || editor.tool === 'rectangle') {
          editor.ctx.globalAlpha = 0.4;
          editor.ctx.drawImage(
            AssetManager.image(
              editor.assets,
              tiles[editor.tileId]?.asset ?? '',
            ),
            (editor.hover.x - editor.camera.x) * unit,
            (editor.hover.y - editor.camera.y) * unit,
            unit,
            unit,
          );
          editor.ctx.globalAlpha = 1;
        }
        outline({ x: editor.hover.x, y: editor.hover.y, w: 1, h: 1 });
      }
    }
    Dom.require(editor.root, '#editor-coordinates', HTMLElement).textContent =
      editor.hover ? `${editor.hover.x}, ${editor.hover.y}` : '';
    if (editor.dirtyMap) {
      editor.mapCache.width = l.width;
      editor.mapCache.height = l.height;
      const cache = Dom.context(editor.mapCache),
        pixels = cache.createImageData(l.width, l.height);
      const palette = tiles.map((t) =>
        [1, 3, 5].map((i) => parseInt(t.color.slice(i, i + 2), 16)),
      );
      for (let y = 0; y < l.height; y++)
        for (let x = 0; x < l.width; x++)
          pixels.data.set(
            [
              ...(palette[l.tiles[y]?.[x] ?? 0] ?? [0, 0, 0]),
              (l.tiles[y]?.[x] ?? 0) ? 255 : 0,
            ],
            (y * l.width + x) * 4,
          );
      cache.putImageData(pixels, 0, 0);
      editor.dirtyMap = false;
    }
    const mw = editor.mini.width,
      mh = editor.mini.height,
      scale = Math.min(mw / l.width, mh / l.height),
      ox = (mw - l.width * scale) / 2,
      oy = (mh - l.height * scale) / 2;
    editor.mctx.clearRect(0, 0, mw, mh);
    editor.mctx.imageSmoothingEnabled = false;
    editor.mctx.drawImage(
      editor.mapCache,
      ox,
      oy,
      l.width * scale,
      l.height * scale,
    );
    editor.mctx.strokeStyle = '#f5d99a';
    editor.mctx.lineWidth = 2;
    editor.mctx.strokeRect(
      ox + editor.camera.x * scale,
      oy + editor.camera.y * scale,
      Math.min(l.width, editor.canvas.clientWidth / unit) * scale,
      Math.min(l.height, editor.canvas.clientHeight / unit) * scale,
    );
    for (const marker of [l.spawn, l.portal])
      if (marker) {
        editor.mctx.fillStyle = marker === l.spawn ? '#a86d17' : '#4b8887';
        editor.mctx.fillRect(
          ox + (marker.x / 16) * scale - 2,
          oy + (marker.y / 16) * scale - 2,
          4,
          4,
        );
      }
  }
}
