// AI 길찾기: 맵을 1m 격자로 나눠 걸을 수 있는 칸을 표시하고 A*로 경로를 찾은 뒤 직선으로 다듬습니다.
const SQ2 = Math.SQRT2;

export class NavGrid {
  constructor(world, bounds, cell = 1, pad = 0.45) {
    this.b = bounds;
    this.cell = cell;
    this.cols = Math.round((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.round((bounds.maxZ - bounds.minZ) / cell);
    this.walk = new Uint8Array(this.cols * this.rows);
    this.open = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const { x, z } = this.center(r * this.cols + c);
        const ok = !world.insideBox(x, z, pad);
        this.walk[r * this.cols + c] = ok ? 1 : 0;
        if (ok) this.open.push(r * this.cols + c);
      }
    }
    const n = this.cols * this.rows;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.run = 0;
  }

  center(i) {
    const c = i % this.cols, r = (i / this.cols) | 0;
    return { x: this.b.minX + (c + 0.5) * this.cell, z: this.b.minZ + (r + 0.5) * this.cell };
  }

  index(x, z) {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.b.minX) / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.b.minZ) / this.cell)));
    return r * this.cols + c;
  }

  // 가장 가까운 걸을 수 있는 칸 (벽에 붙어 있을 때 대비)
  nearestOpen(i) {
    if (this.walk[i]) return i;
    const c0 = i % this.cols, r0 = (i / this.cols) | 0;
    for (let rad = 1; rad < 6; rad++) {
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) continue;
          if (this.walk[r * this.cols + c]) return r * this.cols + c;
        }
      }
    }
    return -1;
  }

  walkable(x, z) { return !!this.walk[this.index(x, z)]; }

  // 두 점 사이를 직선으로 걸어갈 수 있는지 (0.4m 간격 샘플링)
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  randomOpen(filter) {
    for (let k = 0; k < 40; k++) {
      const p = this.center(this.open[(Math.random() * this.open.length) | 0]);
      if (!filter || filter(p)) return p;
    }
    return this.center(this.open[(Math.random() * this.open.length) | 0]);
  }

  // A* (8방향, 모서리 가로지르기 금지) → 직선 다듬기 → [{x,z}, ...]
  find(from, to) {
    const s = this.nearestOpen(this.index(from.x, from.z));
    const e = this.nearestOpen(this.index(to.x, to.z));
    if (s < 0 || e < 0) return null;
    const run = ++this.run;
    const cols = this.cols, { g, from: prev, stamp, closed } = this;
    const ec = e % cols, er = (e / cols) | 0;
    const h = (i) => {
      const dc = Math.abs(i % cols - ec), dr = Math.abs(((i / cols) | 0) - er);
      return Math.max(dc, dr) + (SQ2 - 1) * Math.min(dc, dr);
    };
    const heap = [[h(s), s]];
    g[s] = 0; stamp[s] = run; prev[s] = -1;
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    let found = false;
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === e) { found = true; break; }
      const c = cur % cols, r = (cur / cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= this.rows || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (!this.walk[ni] || closed[ni] === run) continue;
          if (dr && dc && (!this.walk[r * cols + nc] || !this.walk[nr * cols + c])) continue;
          const ng = g[cur] + (dr && dc ? SQ2 : 1);
          if (stamp[ni] !== run || ng < g[ni]) {
            stamp[ni] = run; g[ni] = ng; prev[ni] = cur;
            push([ng + h(ni), ni]);
          }
        }
      }
    }
    if (!found) return null;
    const raw = [];
    for (let i = e; i !== -1; i = prev[i]) raw.push(this.center(i));
    raw.reverse();
    if (this.walkable(to.x, to.z)) raw[raw.length - 1] = { x: to.x, z: to.z };
    // 직선 다듬기: 직선으로 갈 수 있는 가장 먼 점까지 건너뜀
    const out = [];
    let a = { x: from.x, z: from.z }, i = 0;
    while (i < raw.length) {
      let j = raw.length - 1;
      while (j > i && !this.lineClear(a.x, a.z, raw[j].x, raw[j].z)) j--;
      out.push(raw[j]);
      a = raw[j];
      i = j + 1;
    }
    return out;
  }
}
