// Swept point versus a rounded rectangle: strips plus corner circles.

export class EntitySystem {
  static segmentBox(a, b, box) {
    let lo = 0,
      hi = 1;
    for (const axis of ['x', 'y']) {
      const d = b[axis] - a[axis],
        min = box[axis],
        max = min + box[axis === 'x' ? 'w' : 'h'];
      if (Math.abs(d) < 1e-10) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        let p = (min - a[axis]) / d,
          q = (max - a[axis]) / d;
        if (p > q) [p, q] = [q, p];
        lo = Math.max(lo, p);
        hi = Math.min(hi, q);
        if (lo > hi) return false;
      }
    }
    return true;
  }
  static validateEntities(entities, width, height) {
    if (!Array.isArray(entities) || entities.length > 256)
      throw new Error('Invalid entities (maximum 256).');
    const ids = new Set();
    for (const e of entities) {
      if (
        !e ||
        typeof e.id !== 'string' ||
        !/^[-a-z0-9_]{1,64}$/i.test(e.id) ||
        ids.has(e.id)
      )
        throw new Error('Entity IDs must be unique.');
      ids.add(e.id);
      const point = (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every(Number.isFinite) &&
        p[0] >= 0 &&
        p[1] >= 0 &&
        p[0] <= width * 16 &&
        p[1] <= height * 16;
      if (e.type === 'checkpoint') {
        if (
          !point(e.position) ||
          e.position[0] < 5 ||
          e.position[0] + 5 > width * 16 ||
          e.position[1] < 14
        )
          throw new Error('Invalid checkpoint position.');
      } else if (e.type === 'saw') {
        if (
          !Array.isArray(e.path) ||
          e.path.length < 2 ||
          e.path.length > 32 ||
          !e.path.every((p) => point(p) && p.every((n) => n % 16 === 0)) ||
          !['loop', 'ping-pong'].includes(e.mode) ||
          !Number.isFinite(e.speed) ||
          e.speed < 16 ||
          e.speed > 240 ||
          !Number.isFinite(e.radius) ||
          e.radius < 4 ||
          e.radius > 12 ||
          !Number.isFinite(e.phase) ||
          e.phase < 0 ||
          e.phase > 1
        )
          throw new Error('Invalid saw path or properties.');
        if (
          e.path.some(
            (p) =>
              p[0] < e.radius ||
              p[1] < e.radius ||
              p[0] + e.radius > width * 16 ||
              p[1] + e.radius > height * 16,
          )
        )
          throw new Error('Saw radius extends outside map.');
        const path = e.path.filter(
          (p, i) =>
            i === 0 || p[0] !== e.path[i - 1][0] || p[1] !== e.path[i - 1][1],
        );
        if (path.length < 2) throw new Error('Saw needs a nonzero path.');
      } else throw new Error('Unsupported entity type.');
    }
    return structuredClone(entities).map((e) =>
      e.type === 'saw'
        ? {
            ...e,
            path: e.path.filter(
              (p, i) =>
                i === 0 ||
                p[0] !== e.path[i - 1][0] ||
                p[1] !== e.path[i - 1][1],
            ),
          }
        : e,
    );
  }
  static sawPosition(entity, time) {
    const path =
      entity.mode === 'loop' ? [...entity.path, entity.path[0]] : entity.path;
    const lengths = path
        .slice(1)
        .map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])),
      total = lengths.reduce((a, b) => a + b, 0);
    if (!total) return { x: path[0][0], y: path[0][1] };
    const period = entity.mode === 'loop' ? total : 2 * total;
    let distance =
      (((time * entity.speed + entity.phase * period) % period) + period) %
      period;
    if (distance > total) distance = period - distance;
    for (let i = 0; i < lengths.length; i++) {
      if (distance <= lengths[i] || i === lengths.length - 1) {
        const f = lengths[i] ? distance / lengths[i] : 0;
        return {
          x: path[i][0] + (path[i + 1][0] - path[i][0]) * f,
          y: path[i][1] + (path[i + 1][1] - path[i][1]) * f,
        };
      }
      distance -= lengths[i];
    }
    return { x: path[0][0], y: path[0][1] };
  }
  static circleBox(circle, radius, box) {
    return (
      (circle.x - Math.max(box.x, Math.min(box.x + box.w, circle.x))) ** 2 +
        (circle.y - Math.max(box.y, Math.min(box.y + box.h, circle.y))) ** 2 <
      radius ** 2
    );
  }
  static sweptSaw(a, b, radius, oldBox, newBox) {
    radius -= 1e-6;
    const start = { x: a.x - oldBox.x, y: a.y - oldBox.y },
      end = { x: b.x - newBox.x, y: b.y - newBox.y },
      w = oldBox.w,
      h = oldBox.h;
    if (
      segmentBox(start, end, { x: -radius, y: 0, w: w + radius * 2, h }) ||
      segmentBox(start, end, { x: 0, y: -radius, w, h: h + radius * 2 })
    )
      return true;
    const dx = end.x - start.x,
      dy = end.y - start.y,
      length = dx * dx + dy * dy;
    for (const [x, y] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]) {
      const t = length
        ? Math.max(
            0,
            Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / length),
          )
        : 0;
      if (
        (start.x + t * dx - x) ** 2 + (start.y + t * dy - y) ** 2 <
        radius ** 2
      )
        return true;
    }
    return false;
  }
  static spikePhase(props, time) {
    const cycle = props.safeTime + props.warningTime + props.activeTime,
      t = (time + props.phase * cycle) % cycle;
    return t < props.safeTime
      ? 'retracted'
      : t < props.safeTime + props.warningTime
        ? 'warning'
        : 'active';
  }
}
export const validateEntities = EntitySystem.validateEntities;
export const sawPosition = EntitySystem.sawPosition;
export const circleBox = EntitySystem.circleBox;
export const sweptSaw = EntitySystem.sweptSaw;
export const spikePhase = EntitySystem.spikePhase;

const segmentBox = EntitySystem.segmentBox;
