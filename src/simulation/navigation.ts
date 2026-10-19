import type { Box, Point } from '../domain/contracts.ts';
interface Search {
  id: string;
  start: number;
  target: number;
  open: number[];
  head: number;
  parents: Map<number, number>;
  seen: Set<number>;
  passable: (box: Box) => boolean;
  w: number;
  h: number;
}
/** FIFO incremental searches share a strict 512-expansion step budget.
 * Four-connected cells avoid diagonal corner cutting; final motion is swept too.
 */
export class NavigationQueue {
  private queue: Search[] = [];
  private results = new Map<string, Point[]>();
  expanded = 0;
  constructor(
    private readonly columns: number,
    private readonly rows: number,
  ) {}
  request(
    id: string,
    from: Point,
    to: Point,
    body: Box,
    passable: (box: Box) => boolean,
  ) {
    if (this.queue.some((s) => s.id === id)) return;
    const key = (p: Point) =>
      Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / 16))) *
        this.columns +
      Math.max(0, Math.min(this.columns - 1, Math.floor(p.x / 16)));
    const start = key(from),
      target = key(to);
    this.results.delete(id);
    this.queue.push({
      id,
      start,
      target,
      open: [start],
      head: 0,
      parents: new Map(),
      seen: new Set([start]),
      passable,
      w: body.w,
      h: body.h,
    });
  }
  take(id: string) {
    const result = this.results.get(id);
    this.results.delete(id);
    return result;
  }
  update() {
    this.expanded = 0;
    while (this.queue.length && this.expanded < 512) {
      const search = this.queue[0];
      if (!search) break;
      const current = search.open[search.head++];
      if (current === undefined) {
        this.results.set(search.id, []);
        this.queue.shift();
        continue;
      }
      this.expanded++;
      if (current === search.target) {
        const path: Point[] = [];
        let node = current;
        while (node !== search.start) {
          path.push({
            x: (node % this.columns) * 16 + 8 - search.w / 2,
            y: Math.floor(node / this.columns) * 16 + 8 - search.h / 2,
          });
          const previous = search.parents.get(node);
          if (previous === undefined) break;
          node = previous;
        }
        this.results.set(search.id, path.reverse());
        this.queue.shift();
        continue;
      }
      const x = current % this.columns,
        y = Math.floor(current / this.columns);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx,
          ny = y + dy,
          next = ny * this.columns + nx;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= this.columns ||
          ny >= this.rows ||
          search.seen.has(next)
        )
          continue;
        search.seen.add(next);
        if (
          !search.passable({
            x: nx * 16 + 8 - search.w / 2,
            y: ny * 16 + 8 - search.h / 2,
            w: search.w,
            h: search.h,
          })
        )
          continue;
        search.parents.set(next, current);
        search.open.push(next);
      }
    }
    // At most one request/result per authored enemy, capped by the map validator.
  }
}
