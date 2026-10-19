interface Drop {
  x: number;
  y: number;
  depth: number;
  speed: number;
  length: number;
}
/** Viewport-relative rain, independent of camera/physics and bounded to 320 drops. */
export class RainRenderer {
  private drops: Drop[] = Array.from({ length: 320 }, () => ({
    x: Math.random(),
    y: Math.random(),
    depth: Math.random(),
    speed: 0.5 + Math.random(),
    length: 0.004 + Math.random() * 0.014,
  }));
  private time = 0;
  draw(
    ctx: CanvasRenderingContext2D,
    dt: number,
    reduced: boolean,
    strength = 1,
  ) {
    this.time += dt;
    const w = ctx.canvas.width,
      h = ctx.canvas.height,
      count = reduced ? 44 : this.drops.length;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const mist = ctx.createLinearGradient(0, h * 0.3, 0, h);
    mist.addColorStop(0, 'rgba(150,177,183,0)');
    mist.addColorStop(1, `rgba(150,177,183,${0.12 * strength})`);
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const p = this.drops[i];
      if (!p) continue;
      const speed = p.speed * (reduced ? 0.18 : 1);
      p.y = (p.y + dt * speed) % 1;
      p.x =
        (p.x + dt * speed * (0.055 + Math.sin(this.time * 0.3) * 0.015)) % 1;
      ctx.strokeStyle = `rgba(192,220,230,${(0.12 + p.depth * 0.35) * strength})`;
      ctx.lineWidth = (0.4 + p.depth * 0.6) * Math.min(2, w / 800);
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo((p.x + p.length * 0.18) * w, (p.y + p.length) * h);
      ctx.stroke();
    }
    ctx.restore();
  }
}
