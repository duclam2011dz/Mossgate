export interface WaterDrop {
  x: number;
  y: number;
  radius: number;
  age: number;
  lifetime: number;
  opacity: number;
  speed: number;
  wait: number;
  fading: boolean;
}
export interface WaterTrail {
  x: number;
  y: number;
  length: number;
  width: number;
  bend: number;
  age: number;
  lifetime: number;
  opacity: number;
}
/** Surface-local, normalized coordinates survive DOM replacement and resizing.
 * Call update only while the surface is visible; hidden elapsed time is discarded.
 */
export class GlassWaterModel {
  readonly drops: WaterDrop[];
  readonly trails: WaterTrail[] = [];
  constructor(
    count: number,
    private readonly random: () => number = Math.random,
  ) {
    this.drops = Array.from(
      { length: Math.min(32, Math.max(0, count)) },
      () => {
        const drop = this.birth();
        drop.wait = this.random() * 3;
        return drop;
      },
    );
  }
  private birth(): WaterDrop {
    return {
      x: this.random(),
      y: this.random() * 0.8,
      radius: 1.5 + this.random() * 2.5,
      age: 0,
      lifetime: 6 + this.random() * 6,
      opacity: 0,
      speed: 0,
      wait: 0.2 + this.random() * 0.8,
      fading: false,
    };
  }
  update(dt: number, width: number, height: number, reduced: boolean) {
    if (width <= 0 || height <= 0 || dt <= 0) return;
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      if (!trail) continue;
      trail.age += dt;
      trail.opacity = Math.max(0, 1 - trail.age / trail.lifetime);
      if (trail.opacity === 0 || reduced) this.trails.splice(i, 1);
    }
    for (const drop of this.drops) {
      if (drop.wait > 0) {
        drop.wait -= dt;
        continue;
      }
      drop.age += dt;
      if (drop.fading) drop.opacity = Math.max(0, drop.opacity - dt * 2);
      else
        drop.opacity = Math.min(
          1,
          drop.age / 0.8,
          Math.max(0, (drop.lifetime - drop.age) / 1.8),
        );
      if ((drop.fading && drop.opacity === 0) || drop.age >= drop.lifetime) {
        Object.assign(drop, this.birth());
        continue;
      }
      if (reduced || drop.fading) continue;
      drop.radius = Math.min(7, drop.radius + dt * 0.22);
      if (drop.radius < 3.8 || drop.age < 1) continue;
      drop.speed = Math.min(40, drop.speed + dt * drop.radius * 4);
      const oldX = drop.x,
        oldY = drop.y;
      drop.y += (drop.speed * dt) / height;
      drop.x += (Math.sin(drop.y * 34 + drop.lifetime) * dt * 2) / width;
      if (drop.y > 0.98) drop.fading = true;
      if (
        this.trails.length < this.drops.length &&
        !this.trails.some(
          (t) => Math.abs(t.x - oldX) * width < 5 && t.age < 0.2,
        )
      )
        this.trails.push({
          x: oldX,
          y: oldY,
          length: Math.max(3, drop.speed * 0.25),
          width: drop.radius * 0.55,
          bend: Math.sin(drop.y * 34) * 2,
          age: 0,
          lifetime: 2 + this.random() * 2,
          opacity: 1,
        });
      for (const other of this.drops) {
        if (
          other === drop ||
          other.fading ||
          other.wait > 0 ||
          other.opacity < 0.3
        )
          continue;
        if (
          Math.hypot((drop.x - other.x) * width, (drop.y - other.y) * height) <
          drop.radius + other.radius
        ) {
          drop.radius = Math.min(7, Math.hypot(drop.radius, other.radius));
          other.fading = true;
        }
      }
    }
  }
}
