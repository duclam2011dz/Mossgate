import type { PlayableMap, Point } from '../domain/contracts.ts';
import type { Assets } from '../infrastructure/assets.ts';
import type { GameSimulation } from '../simulation/game-simulation.ts';
import type { AnimationSnapshot } from './animation.ts';
import type { EffectsSystem } from './effects.ts';
import type { BackgroundRenderer } from './background.ts';
import { Dom } from '../infrastructure/dom.ts';
import { tiles } from '../domain/tiles.ts';
import { effectNames } from './effects.ts';
import { resolveProperties } from '../domain/properties.ts';
import { spikePhase, sawPosition } from '../domain/entities.ts';
const tintCache = new Map<string, HTMLCanvasElement>();

export class GameRenderer {
  static tinted(this: void, image: HTMLImageElement, color?: string) {
    if (!color) return image;
    const key = image.src + color;
    const cached = tintCache.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = Dom.context(canvas);
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    tintCache.set(key, canvas);
    const oldest = tintCache.keys().next().value;
    if (tintCache.size > 32 && oldest !== undefined) tintCache.delete(oldest);
    return canvas;
  }
  static render(
    this: void,
    ctx: CanvasRenderingContext2D,
    assets: Assets,
    level: PlayableMap,
    run: GameSimulation,
    camera: Point,
    viewport: { width: number; height: number },
    anim: AnimationSnapshot,
    fx: EffectsSystem,
    reduced = false,
    background: BackgroundRenderer | undefined,
    frameDt = 1 / 60,
  ) {
    const sx = ctx.canvas.width / viewport.width,
      sy = ctx.canvas.height / viewport.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#142c29';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const shake =
        !reduced && fx.shake > 0
          ? Math.sin(fx.clock * 160) * 1.5 * (fx.shake / 0.1)
          : 0,
      cx = camera.x + shake,
      cy = camera.y + shake * 0.5;
    const draw = (
      img: CanvasImageSource | undefined,
      x: number,
      y: number,
      w: number,
      h: number,
      source?: [number, number, number, number],
    ) => {
      if (!img) return;
      const dx = Math.round(x * sx),
        dy = Math.round(y * sy),
        dw = Math.round((x + w) * sx) - dx,
        dh = Math.round((y + h) * sy) - dy;
      if (source) ctx.drawImage(img, ...source, dx, dy, dw, dh);
      else ctx.drawImage(img, dx, dy, dw, dh);
    };
    if (background)
      background.draw(
        ctx,
        assets,
        camera,
        viewport,
        frameDt,
        reduced,
        run.state === 'playing',
        run.player.dash > 0,
      );
    for (
      let y = Math.max(0, Math.floor(cy / 16));
      y < Math.min(level.height, Math.ceil((cy + viewport.height) / 16));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx / 16));
        x < Math.min(level.width, Math.ceil((cx + viewport.width) / 16));
        x++
      ) {
        let id = level.tiles[y]?.[x];
        if (
          !id ||
          run.broken.has(y * level.width + x) ||
          run.crumble.get(y * level.width + x)?.missing
        )
          continue;
        const props = resolveProperties(level, id, x, y);
        if (id === 2 && (x + y) % 7 === 0) id = 3;
        const spring = fx.springs.get(`${x},${y}`),
          compression =
            spring !== undefined
              ? Math.sin(Math.min(1, (fx.clock - spring) / 0.3) * Math.PI) * 3
              : 0;
        const phase = id === 13 ? spikePhase(props, run.trapTime) : null;
        let image = assets[tiles[id]?.asset ?? ''],
          source: [number, number, number, number] | undefined;
        if (id === 13 && phase !== 'active')
          image = assets[`timed-spikes-${phase}`];
        if (id === 14 && run.crumble.has(y * level.width + x)) {
          image = assets['trap-crumble'];
          source = [
            Math.min(
              11,
              Math.floor(
                ((run.trapTime -
                  (run.crumble.get(y * level.width + x)?.start ?? 0)) /
                  props.delay) *
                  12,
              ),
            ) * 64,
            0,
            64,
            64,
          ];
        }
        ctx.save();
        if (tiles[id]?.kind === 'hazard' && !props.hazard)
          ctx.globalAlpha = 0.35;
        draw(
          image,
          x * 16 - cx,
          y * 16 - cy + compression,
          16,
          16 - compression,
          source,
        );
        ctx.restore();
      }
    for (const entity of level.entities || []) {
      if (entity.type === 'saw') {
        const p = sawPosition(entity, run.trapTime);
        if (
          p.x < cx - 32 ||
          p.x > cx + viewport.width + 32 ||
          p.y < cy - 32 ||
          p.y > cy + viewport.height + 32
        )
          continue;
        draw(
          assets['entity-saw'],
          p.x - cx - entity.radius,
          p.y - cy - entity.radius,
          entity.radius * 2,
          entity.radius * 2,
          [(Math.floor(run.trapTime * 24) % 12) * 64, 0, 64, 64],
        );
      } else {
        const [x, y] = entity.position;
        draw(
          assets[
            run.checkpoint === entity.id ? 'checkpoint-active' : 'checkpoint'
          ],
          x - cx - 8,
          y - cy - 32,
          16,
          32,
        );
      }
    }
    const gate = level.portal;
    draw(assets.portal, gate.x - cx - 6, gate.y - cy, 32, 32);
    function player(
      x: number,
      feet: number,
      facing: number,
      state: AnimationSnapshot['state'],
      frame: number,
      alpha = 1,
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(
        Math.round((x + 5 - cx) * sx),
        Math.round((feet - cy) * sy),
      );
      ctx.scale(facing, 1);
      draw(assets[`player-${state}`], -8, -16, 16, 16, [frame * 64, 0, 64, 64]);
      ctx.restore();
    }
    for (const g of fx.ghosts)
      player(g.x, g.y, g.facing, g.state, g.frame, (1 - g.age / 0.18) * 0.35);
    const p = run.player;
    player(p.x, p.y + p.h, p.facing, anim.state, anim.frame);
    for (const part of fx.particles) {
      const index = effectNames.indexOf(part.kind);
      if (index < 0) continue;
      const frame = Math.min(11, Math.floor(part.age * 24));
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - part.age / part.life);
      if (!reduced && ['spark', 'burst', 'ring'].includes(part.kind))
        ctx.globalCompositeOperation = 'lighter';
      const scale = part.kind === 'ring' ? 1 + part.age * 3 : 1;
      const effectImage = assets[`effect-${part.kind}`];
      draw(
        effectImage ? tinted(effectImage, part.color) : undefined,
        part.x - cx - (part.size * scale) / 2,
        part.y - cy - (part.size * scale) / 2,
        part.size * scale,
        part.size * scale,
        [frame * 32, 0, 32, 32],
      );
      ctx.restore();
    }
  }
}
export const render = GameRenderer.render;

const tinted = GameRenderer.tinted;
