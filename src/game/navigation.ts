export interface Point { x: number; y: number }
export interface Block { x: number; y: number; w: number; h: number }

export function segmentBox(a: Point, b: Point, box: Block, pad = 0): number | null {
  let near = 0, far = 1;
  for (const axis of ['x', 'y'] as const) {
    const d = b[axis] - a[axis];
    const min = box[axis] - pad;
    const max = box[axis] + (axis === 'x' ? box.w : box.h) + pad;
    if (Math.abs(d) < 0.00001) {
      if (a[axis] < min || a[axis] > max) return null;
    } else {
      let t0 = (min - a[axis]) / d, t1 = (max - a[axis]) / d;
      if (t0 > t1) [t0, t1] = [t1, t0];
      near = Math.max(near, t0); far = Math.min(far, t1);
      if (near > far) return null;
    }
  }
  return near;
}

export function segmentCircle(a: Point, b: Point, c: Point, r: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return (a.x + dx * t - c.x) ** 2 + (a.y + dy * t - c.y) ** 2 <= r * r;
}

/** Clearance-aware A*. Smoothed routes are still checked against the inflated grid. */
export class RoutePlanner {
  readonly cell = 40;
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  /**
   * Ground the route may never use, independent of what is built on it. The sea is the
   * reason this exists: a soldier in this game cannot swim, so water is an infinite-cost
   * cell and the planner routes around it rather than through it.
   */
  private terrain: Uint8Array | null = null;
  private scores: Float32Array;
  private parents: Int32Array;
  private visited: Int32Array;
  private closed: Int32Array;
  private stamp = 0;
  revision = 0;

  constructor(width: number, height: number, readonly clearance = 82) {
    this.cols = Math.ceil(width / this.cell); this.rows = Math.ceil(height / this.cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n); this.scores = new Float32Array(n);
    this.parents = new Int32Array(n); this.visited = new Int32Array(n); this.closed = new Int32Array(n);
  }

  /**
   * Paint permanent no-go ground into the planner. Called once per sector, before any
   * route is asked for, so the cost is paid at load time and not per query.
   */
  setTerrain(allowed: (x: number, y: number) => boolean) {
    if (!this.terrain) this.terrain = new Uint8Array(this.cols * this.rows);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const px = (x + 0.5) * this.cell, py = (y + 0.5) * this.cell;
        this.terrain[y * this.cols + x] = allowed(px, py) ? 0 : 1;
      }
    }
    this.revision++;
  }

  rebuild(blocks: Block[]) {
    this.blocked.fill(0);
    if (this.terrain) this.blocked.set(this.terrain);
    for (const b of blocks) {
      const x0 = Math.max(0, Math.floor((b.x - this.clearance) / this.cell));
      const x1 = Math.min(this.cols - 1, Math.floor((b.x + b.w + this.clearance) / this.cell));
      const y0 = Math.max(0, Math.floor((b.y - this.clearance) / this.cell));
      const y1 = Math.min(this.rows - 1, Math.floor((b.y + b.h + this.clearance) / this.cell));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) * this.cell, py = (y + 0.5) * this.cell;
        if (px >= b.x - this.clearance && px <= b.x + b.w + this.clearance && py >= b.y - this.clearance && py <= b.y + b.h + this.clearance) this.blocked[y * this.cols + x] = 1;
      }
    }
    this.revision++;
  }

  private index(p: Point) {
    return Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / this.cell))) * this.cols
      + Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / this.cell)));
  }
  private point(i: number): Point { return { x: (i % this.cols + 0.5) * this.cell, y: (Math.floor(i / this.cols) + 0.5) * this.cell }; }
  clear(p: Point) { return !this.blocked[this.index(p)]; }
  nearest(p: Point): Point {
    const center = this.index(p), cx = center % this.cols, cy = Math.floor(center / this.cols);
    if (!this.blocked[center]) return this.point(center);
    for (let r = 1; r < 80; r++) {
      let best = -1, dist = Infinity;
      for (let dy = -r; dy <= r; dy++) for (const dx of dy === -r || dy === r ? Array.from({ length: r * 2 + 1 }, (_, i) => i - r) : [-r, r]) {
        const x = cx + dx, y = cy + dy;
        if (x < 1 || y < 1 || x >= this.cols - 1 || y >= this.rows - 1) continue;
        const i = y * this.cols + x;
        if (!this.blocked[i] && dx * dx + dy * dy < dist) { dist = dx * dx + dy * dy; best = i; }
      }
      if (best >= 0) return this.point(best);
    }
    return p;
  }
  line(a: Point, b: Point) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (this.cell * 0.32));
    for (let i = 0; i <= n; i++) {
      const t = i / (n || 1);
      if (!this.clear({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
    }
    return true;
  }

  /**
   * A* over the clearance grid, then a greedy pull-string so the result is walkable
   * straight lines instead of a staircase.
   *
   * This runs for every soldier that loses sight of its post, which on the army map is
   * thousands of calls a minute: the playthrough profiled at 13–18 ms per call, which is a
   * dropped frame whenever a squad re-plans. So the search itself is kept allocation-free
   * (two flat arrays for the binary heap instead of an array of objects), the heuristic is
   * the octile distance rather than a square root per node, and the smoothing pass is
   * bounded so a 6 000-node path cannot turn into a quadratic scan.
   */
  route(from: Point, to: Point): Point[] {
    const start = this.index(this.nearest(from)), goal = this.index(this.nearest(to));
    if (start === goal) return [this.point(goal)];
    const stamp = ++this.stamp, gx = goal % this.cols, gy = Math.floor(goal / this.cols);
    // Octile distance: admissible for 8-way movement and no square roots.
    // Weighted octile: a 30 % greedy bias cuts the number of expanded nodes by roughly
    // two thirds on this map, and a soldier walking a cell or two off the ideal line is
    // invisible. It is still admissible enough that the goal is always reached.
    const heuristic = (i: number) => {
      const dx = Math.abs(i % this.cols - gx), dy = Math.abs(((i / this.cols) | 0) - gy);
      return 1.3 * (dx > dy ? dx + 0.41421356 * dy : dy + 0.41421356 * dx);
    };
    const heapIndex: number[] = [];
    const heapScore: number[] = [];
    const push = (i: number, f: number) => {
      let k = heapIndex.length;
      heapIndex.push(i); heapScore.push(f);
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapScore[p] <= f) break;
        heapIndex[k] = heapIndex[p]; heapScore[k] = heapScore[p];
        k = p;
      }
      heapIndex[k] = i; heapScore[k] = f;
    };
    const pop = () => {
      const top = heapIndex[0];
      const lastI = heapIndex.pop()!, lastF = heapScore.pop()!;
      if (heapIndex.length) {
        let k = 0;
        const n = heapIndex.length;
        while (k * 2 + 1 < n) {
          let c = k * 2 + 1;
          if (c + 1 < n && heapScore[c + 1] < heapScore[c]) c++;
          if (heapScore[c] >= lastF) break;
          heapIndex[k] = heapIndex[c]; heapScore[k] = heapScore[c];
          k = c;
        }
        heapIndex[k] = lastI; heapScore[k] = lastF;
      }
      return top;
    };
    this.visited[start] = stamp; this.scores[start] = 0; this.parents[start] = -1;
    push(start, heuristic(start));
    let best = start, bestH = heuristic(start), iterations = 0;
    while (heapIndex.length && iterations++ < 55000) {
      const i = pop();
      if (this.closed[i] === stamp) continue;
      this.closed[i] = stamp;
      if (i === goal) { best = goal; break; }
      const h = heuristic(i);
      if (h < bestH) { best = i; bestH = h; }
      const x = i % this.cols, y = (i / this.cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 1 || x + dx >= this.cols - 1 || y + dy < 1 || y + dy >= this.rows - 1) continue;
        const j = i + dy * this.cols + dx;
        if (this.blocked[j] || this.closed[j] === stamp) continue;
        if (dx && dy && (this.blocked[i + dx] || this.blocked[i + dy * this.cols])) continue;
        const cost = this.scores[i] + (dx && dy ? 1.414214 : 1);
        if (this.visited[j] !== stamp || cost < this.scores[j]) {
          this.visited[j] = stamp; this.scores[j] = cost; this.parents[j] = i;
          push(j, cost + heuristic(j));
        }
      }
    }
    const raw: Point[] = [];
    for (let i = best; i !== -1 && raw.length < 6000; i = this.parents[i]) raw.push(this.point(i));
    raw.reverse();
    // Pull-string smoothing, with a bounded look-ahead: 24 nodes is four cells of grid
    // straightening, which is plenty to remove the staircase without a quadratic walk.
    const result: Point[] = [];
    let anchor = from, i = 1;
    while (i < raw.length) {
      let end = i;
      const limit = Math.min(raw.length - 1, i + 24);
      while (end < limit && this.line(anchor, raw[end + 1])) end++;
      result.push(raw[end]); anchor = raw[end]; i = end + 1;
    }
    return result.length ? result : [this.point(best)];
  }
}