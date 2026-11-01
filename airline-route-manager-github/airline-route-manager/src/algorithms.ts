import type { Airport, Edge, MSTResult, PathResult, Route } from './types';

// All data structures and algorithms of the project, hand-written (no graph/tree/priority-queue libraries).

// ===================== random.ts =====================
/** Seeded PRNG (mulberry32) so benchmarks and tests are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===================== graph.ts =====================

/** Graph ADT backed by an adjacency LIST. Built from the single central routes array. */
export class AdjacencyListGraph {
  readonly nodes: string[];
  readonly directed: boolean;
  private adj = new Map<string, Edge[]>();

  constructor(nodes: string[], directed = false) {
    this.nodes = [...nodes];
    this.directed = directed;
    for (const n of nodes) this.adj.set(n, []);
  }

  hasNode(n: string): boolean { return this.adj.has(n); }

  addEdge(from: string, to: string, weight = 1, flightNo?: string): boolean {
    if (!this.adj.has(from) || !this.adj.has(to)) return false;
    this.adj.get(from)!.push({ from, to, weight, flightNo });
    if (!this.directed && from !== to) this.adj.get(to)!.push({ from: to, to: from, weight, flightNo });
    return true;
  }

  neighbors(n: string): Edge[] { return this.adj.get(n) ?? []; }

  /** Each logical edge once (undirected edges are not duplicated). */
  edges(): Edge[] {
    const out: Edge[] = [];
    for (const n of this.nodes) {
      for (const e of this.neighbors(n)) {
        if (this.directed || n <= e.to) out.push(e);
      }
    }
    return out;
  }

  /** Approximate memory in bytes: 8 per list head + 16 per stored edge record. */
  memoryBytes(): number {
    let records = 0;
    for (const n of this.nodes) records += this.neighbors(n).length;
    return this.nodes.length * 8 + records * 16;
  }
}

/** Graph ADT backed by an adjacency MATRIX (Infinity = no edge). */
export class AdjacencyMatrixGraph {
  readonly nodes: string[];
  readonly directed: boolean;
  readonly matrix: number[][];
  private index = new Map<string, number>();

  constructor(nodes: string[], directed = false) {
    this.nodes = [...nodes];
    this.directed = directed;
    nodes.forEach((n, i) => this.index.set(n, i));
    this.matrix = nodes.map(() => nodes.map(() => Infinity));
  }

  addEdge(from: string, to: string, weight = 1): boolean {
    const i = this.index.get(from), j = this.index.get(to);
    if (i === undefined || j === undefined) return false;
    this.matrix[i][j] = weight;
    if (!this.directed) this.matrix[j][i] = weight;
    return true;
  }

  hasEdge(from: string, to: string): boolean {
    const i = this.index.get(from), j = this.index.get(to);
    return i !== undefined && j !== undefined && this.matrix[i][j] !== Infinity;
  }

  /** Approximate memory in bytes: V*V cells of 8 bytes. */
  memoryBytes(): number { return this.nodes.length * this.nodes.length * 8; }
}

/** Airline routes are bidirectional, so the route network is modelled as UNDIRECTED. */
export function buildRouteGraph(airports: Airport[], routes: Route[], weight: 'fare' | 'distance' | 'hops' = 'fare'): AdjacencyListGraph {
  const g = new AdjacencyListGraph(airports.map(a => a.code), false);
  for (const r of routes) {
    const w = weight === 'fare' ? r.fare : weight === 'distance' ? r.distance : 1;
    g.addEdge(r.from, r.to, w, r.flightNo);
  }
  return g;
}

export function buildMatrixGraph(airports: Airport[], routes: Route[]): AdjacencyMatrixGraph {
  const g = new AdjacencyMatrixGraph(airports.map(a => a.code), false);
  for (const r of routes) g.addEdge(r.from, r.to, r.fare);
  return g;
}

// ===================== pathfinding.ts =====================

function empty(reason: string, steps: string[] = []): PathResult {
  return { found: false, reason, path: [], legs: [], totalFare: 0, totalDistance: 0, stops: 0, steps };
}

function findLeg(routes: Route[], a: string, b: string): Route | undefined {
  let best: Route | undefined;
  for (const r of routes) {
    if ((r.from === a && r.to === b) || (r.from === b && r.to === a)) {
      if (!best || r.fare < best.fare) best = r;
    }
  }
  return best;
}

function assemble(path: string[], routes: Route[], steps: string[]): PathResult {
  const legs: Route[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const leg = findLeg(routes, path[i], path[i + 1]);
    if (!leg) return empty('Internal error: leg missing for ' + path[i] + '-' + path[i + 1], steps);
    legs.push(leg);
  }
  return {
    found: true, path, legs, steps,
    totalFare: legs.reduce((s, l) => s + l.fare, 0),
    totalDistance: legs.reduce((s, l) => s + l.distance, 0),
    stops: Math.max(0, path.length - 2),
  };
}

function validate(airports: Airport[], src: string, dst: string): string | null {
  const codes = new Set(airports.map(a => a.code));
  if (!codes.has(src)) return `Unknown source airport "${src}".`;
  if (!codes.has(dst)) return `Unknown destination airport "${dst}".`;
  if (src === dst) return 'Source and destination are the same airport.';
  return null;
}

/** Dijkstra, array-based O(V^2): cheapest total weight. Requires non-negative weights. */
export function dijkstra(graph: AdjacencyListGraph, src: string, dst?: string): { dist: Map<string, number>; prev: Map<string, string | null>; steps: string[] } {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const done = new Set<string>();
  const steps: string[] = [];
  for (const n of graph.nodes) { dist.set(n, Infinity); prev.set(n, null); }
  dist.set(src, 0);
  for (let iter = 0; iter < graph.nodes.length; iter++) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of graph.nodes) {
      if (!done.has(n) && dist.get(n)! < best) { best = dist.get(n)!; u = n; }
    }
    if (u === null) break; // remaining nodes unreachable
    done.add(u);
    steps.push(`Settle ${u} (cost ${best})`);
    if (u === dst) break;
    for (const e of graph.neighbors(u)) {
      if (e.weight < 0) throw new Error('Dijkstra requires non-negative edge weights.');
      const nd = best + e.weight;
      if (!done.has(e.to) && nd < dist.get(e.to)!) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        steps.push(`  Relax ${u}→${e.to}: new cost ${nd}`);
      }
    }
  }
  return { dist, prev, steps };
}

function rebuildPath(prev: Map<string, string | null>, dst: string, limit: number): string[] {
  const path: string[] = [];
  let cur: string | null = dst;
  let guard = 0;
  while (cur !== null && guard++ <= limit) { path.unshift(cur); cur = prev.get(cur) ?? null; }
  return path;
}

export function cheapestRoute(airports: Airport[], routes: Route[], src: string, dst: string): PathResult {
  const err = validate(airports, src, dst);
  if (err) return empty(err);
  const g = buildRouteGraph(airports, routes, 'fare');
  const { dist, prev, steps } = dijkstra(g, src, dst);
  if (dist.get(dst) === Infinity) return empty(`No route exists from ${src} to ${dst} (destination unreachable).`, steps);
  return assemble(rebuildPath(prev, dst, airports.length), routes, steps);
}

/** BFS: fewest flights (hops). */
export function fewestFlightsRoute(airports: Airport[], routes: Route[], src: string, dst: string): PathResult {
  const err = validate(airports, src, dst);
  if (err) return empty(err);
  const g = buildRouteGraph(airports, routes, 'hops');
  const prev = new Map<string, string | null>([[src, null]]);
  const queue: string[] = [src];
  const steps: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    steps.push(`Visit ${u}`);
    if (u === dst) break;
    for (const e of g.neighbors(u)) {
      if (!prev.has(e.to)) { prev.set(e.to, u); queue.push(e.to); steps.push(`  Enqueue ${e.to}`); }
    }
  }
  if (!prev.has(dst)) return empty(`No route exists from ${src} to ${dst} (destination unreachable).`, steps);
  return assemble(rebuildPath(prev, dst, airports.length), routes, steps);
}

// ===================== mst.ts =====================

/** Prim, array-based O(V^2). Restarts from every unvisited node => minimum spanning FOREST if disconnected. */
export function prim(g: AdjacencyListGraph, start?: string): MSTResult {
  const key = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const inTree = new Set<string>();
  const edges: Edge[] = [];
  const steps: string[] = [];
  let components = 0;
  for (const n of g.nodes) { key.set(n, Infinity); parent.set(n, null); }
  const order = start && g.hasNode(start) ? [start, ...g.nodes.filter(n => n !== start)] : [...g.nodes];
  for (const root of order) {
    if (inTree.has(root)) continue;
    components++;
    key.set(root, 0);
    steps.push(`Start tree #${components} at ${root}`);
    for (;;) {
      let u: string | null = null;
      let best = Infinity;
      for (const n of g.nodes) if (!inTree.has(n) && key.get(n)! < best) { best = key.get(n)!; u = n; }
      if (u === null) break;
      inTree.add(u);
      const p = parent.get(u) ?? null;
      if (p !== null) {
        const e = g.neighbors(p).find(x => x.to === u && x.weight === best)!;
        edges.push(e);
        steps.push(`Add edge ${p}–${u} (weight ${best})`);
      }
      for (const e of g.neighbors(u)) {
        if (!inTree.has(e.to) && e.weight < key.get(e.to)!) { key.set(e.to, e.weight); parent.set(e.to, u); }
      }
    }
  }
  return { edges, total: edges.reduce((s, e) => s + e.weight, 0), components, steps };
}

/** Union-find with path compression and union by rank. */
export class UnionFind {
  private parent: number[];
  private rank: number[];
  constructor(n: number) { this.parent = Array.from({ length: n }, (_, i) => i); this.rank = new Array<number>(n).fill(0); }
  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== root) { const nx = this.parent[x]; this.parent[x] = root; x = nx; }
    return root;
  }
  union(a: number, b: number): boolean {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
    return true;
  }
}

/** Own merge sort for edges (stable, O(E log E)). */
export function sortEdges(edges: Edge[]): Edge[] {
  if (edges.length <= 1) return edges.slice();
  const mid = edges.length >> 1;
  const l = sortEdges(edges.slice(0, mid)), r = sortEdges(edges.slice(mid));
  const out: Edge[] = [];
  let i = 0, j = 0;
  while (i < l.length && j < r.length) out.push(l[i].weight <= r[j].weight ? l[i++] : r[j++]);
  while (i < l.length) out.push(l[i++]);
  while (j < r.length) out.push(r[j++]);
  return out;
}

export function kruskal(g: AdjacencyListGraph): MSTResult {
  const idx = new Map<string, number>();
  g.nodes.forEach((n, i) => idx.set(n, i));
  const uf = new UnionFind(g.nodes.length);
  const edges: Edge[] = [];
  const steps: string[] = [];
  for (const e of sortEdges(g.edges())) {
    if (uf.union(idx.get(e.from)!, idx.get(e.to)!)) {
      edges.push(e);
      steps.push(`Accept ${e.from}–${e.to} (weight ${e.weight})`);
    } else steps.push(`Reject ${e.from}–${e.to} (weight ${e.weight}): would form a cycle`);
  }
  return { edges, total: edges.reduce((s, e) => s + e.weight, 0), components: g.nodes.length - edges.length, steps };
}

// ===================== traversal.ts =====================

export function bfsOrder(g: AdjacencyListGraph, start: string): string[] {
  if (!g.hasNode(start)) return [];
  const seen = new Set([start]);
  const q = [start];
  const order: string[] = [];
  let h = 0;
  while (h < q.length) {
    const u = q[h++];
    order.push(u);
    for (const e of g.neighbors(u)) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
  }
  return order;
}

export type EdgeKind = 'tree' | 'back' | 'forward' | 'cross';
export interface DFSResult {
  order: string[];
  discovery: Map<string, number>;
  finish: Map<string, number>;
  classified: Array<{ from: string; to: string; kind: EdgeKind }>;
}

/** Recursive DFS with discovery/finish times and edge classification (forward/cross only occur in directed graphs). */
export function dfs(g: AdjacencyListGraph, start?: string): DFSResult {
  const color = new Map<string, 0 | 1 | 2>();
  const discovery = new Map<string, number>();
  const finish = new Map<string, number>();
  const order: string[] = [];
  const classified: DFSResult['classified'] = [];
  let time = 0;
  const visit = (u: string, parent: string | null) => {
    color.set(u, 1); discovery.set(u, ++time); order.push(u);
    for (const e of g.neighbors(u)) {
      if (!g.directed && e.to === parent) continue;
      const c = color.get(e.to) ?? 0;
      if (c === 0) { classified.push({ from: u, to: e.to, kind: 'tree' }); visit(e.to, u); }
      else if (c === 1) classified.push({ from: u, to: e.to, kind: 'back' });
      else if (g.directed) classified.push({ from: u, to: e.to, kind: discovery.get(u)! < discovery.get(e.to)! ? 'forward' : 'cross' });
    }
    color.set(u, 2); finish.set(u, ++time);
  };
  const roots = start && g.hasNode(start) ? [start, ...g.nodes.filter(n => n !== start)] : g.nodes;
  for (const r of roots) if (!color.get(r)) visit(r, null);
  return { order, discovery, finish, classified };
}

export function connectedComponents(g: AdjacencyListGraph): string[][] {
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const n of g.nodes) {
    if (seen.has(n)) continue;
    const comp: string[] = [];
    const stack = [n];
    seen.add(n);
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (const e of g.neighbors(u)) if (!seen.has(e.to)) { seen.add(e.to); stack.push(e.to); }
    }
    comps.push(comp);
  }
  return comps;
}

/** Kosaraju SCC for directed graphs. */
export function stronglyConnectedComponents(g: AdjacencyListGraph): string[][] {
  const seen = new Set<string>();
  const finishOrder: string[] = [];
  const first = (u: string) => {
    seen.add(u);
    for (const e of g.neighbors(u)) if (!seen.has(e.to)) first(e.to);
    finishOrder.push(u);
  };
  for (const n of g.nodes) if (!seen.has(n)) first(n);
  const rev = new AdjacencyListGraph(g.nodes, true);
  for (const e of g.edges()) rev.addEdge(e.to, e.from, e.weight);
  const seen2 = new Set<string>();
  const comps: string[][] = [];
  const second = (u: string, comp: string[]) => {
    seen2.add(u); comp.push(u);
    for (const e of rev.neighbors(u)) if (!seen2.has(e.to)) second(e.to, comp);
  };
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const u = finishOrder[i];
    if (!seen2.has(u)) { const c: string[] = []; second(u, c); comps.push(c); }
  }
  return comps;
}

/** Kahn's topological sort. order is null (with the unsortable nodes listed) when a cycle exists. */
export function topologicalSort(g: AdjacencyListGraph): { order: string[] | null; cycleNodes: string[] } {
  const indeg = new Map<string, number>();
  for (const n of g.nodes) indeg.set(n, 0);
  for (const e of g.edges()) indeg.set(e.to, indeg.get(e.to)! + 1);
  const q = g.nodes.filter(n => indeg.get(n) === 0);
  const order: string[] = [];
  let h = 0;
  while (h < q.length) {
    const u = q[h++];
    order.push(u);
    for (const e of g.neighbors(u)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) q.push(e.to);
    }
  }
  if (order.length === g.nodes.length) return { order, cycleNodes: [] };
  const done = new Set(order);
  return { order: null, cycleNodes: g.nodes.filter(n => !done.has(n)) };
}

// ===================== bst.ts =====================
export interface BNode<K> { key: K; left: BNode<K> | null; right: BNode<K> | null; height: number; }

export type Cmp<K> = (a: K, b: K) => number;
export const strCmp: Cmp<string> = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function heightOf<K>(n: BNode<K> | null): number { return n ? n.height : 0; }

/** Plain (unbalanced) Binary Search Tree. */
export class BST<K = string> {
  root: BNode<K> | null = null;
  size = 0;
  constructor(protected cmp: Cmp<K> = strCmp as unknown as Cmp<K>) {}

  insert(key: K): boolean {
    if (!this.root) { this.root = { key, left: null, right: null, height: 1 }; this.size++; return true; }
    let cur = this.root;
    const path: BNode<K>[] = [];
    for (;;) {
      path.push(cur);
      const c = this.cmp(key, cur.key);
      if (c === 0) return false; // duplicate
      if (c < 0) { if (!cur.left) { cur.left = { key, left: null, right: null, height: 1 }; break; } cur = cur.left; }
      else { if (!cur.right) { cur.right = { key, left: null, right: null, height: 1 }; break; } cur = cur.right; }
    }
    for (let i = path.length - 1; i >= 0; i--) path[i].height = 1 + Math.max(heightOf(path[i].left), heightOf(path[i].right));
    this.size++;
    return true;
  }

  search(key: K): { found: boolean; path: K[] } {
    const path: K[] = [];
    let cur = this.root;
    while (cur) {
      path.push(cur.key);
      const c = this.cmp(key, cur.key);
      if (c === 0) return { found: true, path };
      cur = c < 0 ? cur.left : cur.right;
    }
    return { found: false, path };
  }

  delete(key: K): boolean {
    const before = this.size;
    this.root = this.del(this.root, key);
    return this.size < before;
  }

  private del(n: BNode<K> | null, key: K): BNode<K> | null {
    if (!n) return null;
    const c = this.cmp(key, n.key);
    if (c < 0) n.left = this.del(n.left, key);
    else if (c > 0) n.right = this.del(n.right, key);
    else {
      this.size--;
      if (!n.left) return n.right; // case 1 & 2
      if (!n.right) return n.left;
      let s = n.right; while (s.left) s = s.left; // case 3: inorder successor
      n.key = s.key;
      this.size++; // compensate: successor removal below decrements again
      n.right = this.del(n.right, s.key);
    }
    n.height = 1 + Math.max(heightOf(n.left), heightOf(n.right));
    return n;
  }

  height(): number { return heightOf(this.root); }
  min(): K | null { let n = this.root; if (!n) return null; while (n.left) n = n.left; return n.key; }
  max(): K | null { let n = this.root; if (!n) return null; while (n.right) n = n.right; return n.key; }

  inorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { f(n.left); o.push(n.key); f(n.right); } }; f(this.root); return o; }
  preorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { o.push(n.key); f(n.left); f(n.right); } }; f(this.root); return o; }
  postorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { f(n.left); f(n.right); o.push(n.key); } }; f(this.root); return o; }
  levelorder(): K[] {
    const o: K[] = []; if (!this.root) return o;
    const q: BNode<K>[] = [this.root]; let h = 0;
    while (h < q.length) { const n = q[h++]; o.push(n.key); if (n.left) q.push(n.left); if (n.right) q.push(n.right); }
    return o;
  }
  range(lo: K, hi: K): K[] { return this.inorder().filter(k => this.cmp(k, lo) >= 0 && this.cmp(k, hi) <= 0); }
}

// ===================== avl.ts =====================

/** AVL tree with LL/RR/LR/RL rotations, a rotation trace and a verify() self-check. */
export class AVL<K = string> {
  root: BNode<K> | null = null;
  size = 0;
  trace: string[] = [];
  rotations = { LL: 0, RR: 0, LR: 0, RL: 0 };
  constructor(private cmp: Cmp<K> = strCmp as unknown as Cmp<K>) {}

  private upd(n: BNode<K>) { n.height = 1 + Math.max(heightOf(n.left), heightOf(n.right)); }
  balanceOf(n: BNode<K> | null): number { return n ? heightOf(n.left) - heightOf(n.right) : 0; }

  private rotR(y: BNode<K>): BNode<K> { const x = y.left!; y.left = x.right; x.right = y; this.upd(y); this.upd(x); return x; }
  private rotL(x: BNode<K>): BNode<K> { const y = x.right!; x.right = y.left; y.left = x; this.upd(x); this.upd(y); return y; }

  private rebalance(n: BNode<K>): BNode<K> {
    this.upd(n);
    const b = this.balanceOf(n);
    if (b > 1) {
      if (this.balanceOf(n.left) >= 0) { this.log(`LL imbalance at ${String(n.key)} → right rotation`); this.rotations.LL++; return this.rotR(n); }
      this.log(`LR imbalance at ${String(n.key)} → left rotation on ${String(n.left!.key)}, then right rotation`);
      this.rotations.LR++; n.left = this.rotL(n.left!); return this.rotR(n);
    }
    if (b < -1) {
      if (this.balanceOf(n.right) <= 0) { this.log(`RR imbalance at ${String(n.key)} → left rotation`); this.rotations.RR++; return this.rotL(n); }
      this.log(`RL imbalance at ${String(n.key)} → right rotation on ${String(n.right!.key)}, then left rotation`);
      this.rotations.RL++; n.right = this.rotR(n.right!); return this.rotL(n);
    }
    return n;
  }
  private log(s: string) { this.trace.push(s); }

  insert(key: K): boolean {
    this.trace = [];
    const before = this.size;
    this.root = this.ins(this.root, key);
    if (this.size === before) { this.log(`${String(key)} already exists – ignored`); return false; }
    if (this.trace.length === 0) this.log(`Inserted ${String(key)}; no rotation needed`);
    return true;
  }
  private ins(n: BNode<K> | null, key: K): BNode<K> {
    if (!n) { this.size++; return { key, left: null, right: null, height: 1 }; }
    const c = this.cmp(key, n.key);
    if (c < 0) n.left = this.ins(n.left, key);
    else if (c > 0) n.right = this.ins(n.right, key);
    else return n;
    return this.rebalance(n);
  }

  delete(key: K): boolean {
    this.trace = [];
    const before = this.size;
    this.root = this.del(this.root, key);
    const ok = this.size < before;
    if (!ok) this.log(`${String(key)} not found`);
    else if (this.trace.length === 0) this.log(`Deleted ${String(key)}; no rotation needed`);
    return ok;
  }
  private del(n: BNode<K> | null, key: K): BNode<K> | null {
    if (!n) return null;
    const c = this.cmp(key, n.key);
    if (c < 0) n.left = this.del(n.left, key);
    else if (c > 0) n.right = this.del(n.right, key);
    else {
      if (!n.left || !n.right) { this.size--; return n.left ?? n.right; }
      let s = n.right; while (s.left) s = s.left;
      n.key = s.key;
      n.right = this.del(n.right, s.key);
    }
    return this.rebalance(n);
  }

  search(key: K): { found: boolean; path: K[] } {
    const path: K[] = [];
    let cur = this.root;
    while (cur) {
      path.push(cur.key);
      const c = this.cmp(key, cur.key);
      if (c === 0) return { found: true, path };
      cur = c < 0 ? cur.left : cur.right;
    }
    return { found: false, path };
  }

  height(): number { return heightOf(this.root); }
  inorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { f(n.left); o.push(n.key); f(n.right); } }; f(this.root); return o; }
  preorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { o.push(n.key); f(n.left); f(n.right); } }; f(this.root); return o; }
  postorder(): K[] { const o: K[] = []; const f = (n: BNode<K> | null) => { if (n) { f(n.left); f(n.right); o.push(n.key); } }; f(this.root); return o; }
  levelorder(): K[] {
    const o: K[] = []; if (!this.root) return o;
    const q: BNode<K>[] = [this.root]; let h = 0;
    while (h < q.length) { const n = q[h++]; o.push(n.key); if (n.left) q.push(n.left); if (n.right) q.push(n.right); }
    return o;
  }

  /** Checks BST ordering, stored heights and balance factors. Returns [] when valid, else error messages. */
  verify(): string[] {
    const errs: string[] = [];
    const walk = (n: BNode<K> | null, lo: K | null, hi: K | null): number => {
      if (!n) return 0;
      if (lo !== null && this.cmp(n.key, lo) <= 0) errs.push(`BST order violated at ${String(n.key)}`);
      if (hi !== null && this.cmp(n.key, hi) >= 0) errs.push(`BST order violated at ${String(n.key)}`);
      const lh = walk(n.left, lo, n.key), rh = walk(n.right, n.key, hi);
      const h = 1 + Math.max(lh, rh);
      if (n.height !== h) errs.push(`Stored height wrong at ${String(n.key)}`);
      if (Math.abs(lh - rh) > 1) errs.push(`Balance factor out of range at ${String(n.key)}`);
      return h;
    };
    walk(this.root, null, null);
    return errs;
  }
}

// ===================== generalTree.ts =====================
export interface GNode { label: string; children: GNode[]; }

export function findNode(root: GNode, label: string): GNode | null {
  if (root.label === label) return root;
  for (const c of root.children) { const f = findNode(c, label); if (f) return f; }
  return null;
}
export function insertChild(root: GNode, parentLabel: string, label: string): boolean {
  if (!label.trim() || findNode(root, label)) return false;
  const p = findNode(root, parentLabel);
  if (!p) return false;
  p.children.push({ label, children: [] });
  return true;
}
/** Deletes a whole subtree (the root cannot be deleted). */
export function deleteSubtree(root: GNode, label: string): boolean {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].label === label) { root.children.splice(i, 1); return true; }
    if (deleteSubtree(root.children[i], label)) return true;
  }
  return false;
}
export function preorderG(n: GNode, out: string[] = []): string[] { out.push(n.label); n.children.forEach(c => preorderG(c, out)); return out; }
export function postorderG(n: GNode, out: string[] = []): string[] { n.children.forEach(c => postorderG(c, out)); out.push(n.label); return out; }
export function levelorderG(root: GNode): string[] {
  const out: string[] = []; const q = [root]; let h = 0;
  while (h < q.length) { const n = q[h++]; out.push(n.label); q.push(...n.children); }
  return out;
}
/** Country → Airport hierarchy built from the airports list (single source of truth). */
export function buildCountryTree(airports: Array<{ code: string; country: string }>): GNode {
  const root: GNode = { label: 'World', children: [] };
  for (const a of airports) {
    let c = root.children.find(x => x.label === a.country);
    if (!c) { c = { label: a.country, children: [] }; root.children.push(c); }
    c.children.push({ label: a.code, children: [] });
  }
  return root;
}

// ===================== expression.ts =====================
export interface ENode { value: string; left: ENode | null; right: ENode | null; }
export class ExprError extends Error {}

type Tok = { t: 'num' | 'op' | 'lp' | 'rp'; v: string };
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = s.slice(i, j);
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(num)) throw new ExprError(`Invalid number "${num}"`);
      out.push({ t: 'num', v: num }); i = j; continue;
    }
    if (ch in PREC) { out.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '(') { out.push({ t: 'lp', v: ch }); i++; continue; }
    if (ch === ')') { out.push({ t: 'rp', v: ch }); i++; continue; }
    throw new ExprError(`Unexpected character "${ch}"`);
  }
  return out;
}

/** Infix → postfix (shunting-yard), then postfix → tree. ^ is right-associative. */
export function buildExpressionTree(expr: string): ENode {
  const toks = tokenize(expr);
  if (toks.length === 0) throw new ExprError('Expression is empty');
  const outq: Tok[] = [];
  const ops: Tok[] = [];
  let expectOperand = true;
  for (const tk of toks) {
    if (tk.t === 'num') { if (!expectOperand) throw new ExprError('Missing operator'); outq.push(tk); expectOperand = false; }
    else if (tk.t === 'op') {
      if (expectOperand) throw new ExprError(`Operator "${tk.v}" is missing an operand`);
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === 'op' && (PREC[top.v] > PREC[tk.v] || (PREC[top.v] === PREC[tk.v] && tk.v !== '^'))) outq.push(ops.pop()!);
        else break;
      }
      ops.push(tk); expectOperand = true;
    } else if (tk.t === 'lp') { if (!expectOperand) throw new ExprError('Missing operator before "("'); ops.push(tk); }
    else {
      if (expectOperand) throw new ExprError('Missing operand before ")"');
      let ok = false;
      while (ops.length) { const o = ops.pop()!; if (o.t === 'lp') { ok = true; break; } outq.push(o); }
      if (!ok) throw new ExprError('Unbalanced parentheses');
    }
  }
  if (expectOperand) throw new ExprError('Expression ends with an operator');
  while (ops.length) { const o = ops.pop()!; if (o.t === 'lp') throw new ExprError('Unbalanced parentheses'); outq.push(o); }
  const st: ENode[] = [];
  for (const tk of outq) {
    if (tk.t === 'num') st.push({ value: tk.v, left: null, right: null });
    else { const r = st.pop(), l = st.pop(); if (!l || !r) throw new ExprError('Operand shortage'); st.push({ value: tk.v, left: l, right: r }); }
  }
  if (st.length !== 1) throw new ExprError('Malformed expression');
  return st[0];
}

export function evaluateTree(n: ENode): number {
  if (!n.left && !n.right) return parseFloat(n.value);
  const a = evaluateTree(n.left!), b = evaluateTree(n.right!);
  switch (n.value) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': if (b === 0) throw new ExprError('Division by zero'); return a / b;
    case '^': return Math.pow(a, b);
  }
  throw new ExprError(`Unknown operator ${n.value}`);
}
export const prefixOf = (n: ENode | null): string[] => (n ? [n.value, ...prefixOf(n.left), ...prefixOf(n.right)] : []);
export const postfixOf = (n: ENode | null): string[] => (n ? [...postfixOf(n.left), ...postfixOf(n.right), n.value] : []);
/** Infix with minimal parentheses. */
export function infixOf(n: ENode, parentPrec = 0, isRight = false): string {
  if (!n.left || !n.right) return n.value;
  const p = PREC[n.value];
  const s = `${infixOf(n.left, p, false)} ${n.value} ${infixOf(n.right, p, true)}`;
  const need = p < parentPrec || (p === parentPrec && isRight && n.value !== '^') || (p === parentPrec && !isRight && n.value === '^');
  return need ? `(${s})` : s;
}

// ===================== validation.ts =====================

export interface Validation { ok: boolean; error?: string; }
const fail = (error: string): Validation => ({ ok: false, error });

export function validateAirport(a: Airport, existing: Airport[], editingCode?: string): Validation {
  const code = a.code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return fail('Airport code must be exactly 3 letters (e.g. DEL).');
  if (existing.some(x => x.code === code && x.code !== editingCode)) return fail(`Airport code ${code} already exists.`);
  if (!a.name.trim()) return fail('Airport name is required.');
  if (!a.city.trim()) return fail('City is required.');
  if (!a.country.trim()) return fail('Country is required.');
  if (!Number.isFinite(a.lat) || a.lat < -90 || a.lat > 90) return fail('Latitude must be between -90 and 90.');
  if (!Number.isFinite(a.lng) || a.lng < -180 || a.lng > 180) return fail('Longitude must be between -180 and 180.');
  return { ok: true };
}

export function validateRoute(r: Route, airports: Airport[], existing: Route[], editingFlightNo?: string): Validation {
  const no = r.flightNo.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(no)) return fail('Flight number must be 3–8 letters/digits.');
  if (existing.some(x => x.flightNo === no && x.flightNo !== editingFlightNo)) return fail(`Flight number ${no} already exists.`);
  const codes = new Set(airports.map(a => a.code));
  if (!codes.has(r.from)) return fail(`Invalid source airport code "${r.from}".`);
  if (!codes.has(r.to)) return fail(`Invalid destination airport code "${r.to}".`);
  if (r.from === r.to) return fail('Source and destination must be different airports.');
  if (!Number.isFinite(r.distance) || r.distance <= 0) return fail('Distance must be greater than 0 km.');
  if (!Number.isFinite(r.fare) || r.fare <= 0) return fail('Fare must be greater than 0.');
  return { ok: true };
}

/** Deleting an airport also removes every flight that touches it, so no route points at a missing airport. */
export function removeAirport(airports: Airport[], routes: Route[], code: string): { airports: Airport[]; routes: Route[]; removedRoutes: number } {
  const keep = routes.filter(r => r.from !== code && r.to !== code);
  return { airports: airports.filter(a => a.code !== code), routes: keep, removedRoutes: routes.length - keep.length };
}

export function haversineKm(a: Airport, b: Airport): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// ===================== benchmark.ts =====================

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Connected random graph: a random spanning chain + extra random edges, so it is always connected. */
export function randomGraph(v: number, e: number, seed: number): AdjacencyListGraph {
  const rng = makeRng(seed);
  const nodes = Array.from({ length: v }, (_, i) => `N${i}`);
  const g = new AdjacencyListGraph(nodes, false);
  const used = new Set<string>();
  const add = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || used.has(k)) return false;
    used.add(k);
    g.addEdge(nodes[a], nodes[b], 1 + Math.floor(rng() * 1000));
    return true;
  };
  for (let i = 1; i < v; i++) add(i, Math.floor(rng() * i));
  const maxEdges = (v * (v - 1)) / 2;
  const target = Math.min(e, maxEdges);
  let guard = 0;
  while (used.size < target && guard++ < target * 20) add(Math.floor(rng() * v), Math.floor(rng() * v));
  return g;
}

export interface TreeBench { n: number; input: 'sorted' | 'random'; bstHeight: number; avlHeight: number; bstSearchMs: number; avlSearchMs: number; }
export function benchTrees(n: number, input: 'sorted' | 'random', runs = 3, seed = 42): TreeBench {
  const rng = makeRng(seed);
  const keys = Array.from({ length: n }, (_, i) => i);
  if (input === 'random') for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
  const cmp = (a: number, b: number) => a - b;
  const bst = new BST<number>(cmp), avl = new AVL<number>(cmp);
  // Iterative insert in BST keeps sorted input from overflowing the call stack.
  for (const k of keys) { bst.insert(k); avl.insert(k); }
  const queries = Array.from({ length: Math.min(n, 2000) }, () => Math.floor(rng() * n));
  const time = (f: (k: number) => void) => {
    let total = 0;
    for (let r = 0; r < runs; r++) { const t0 = now(); for (const q of queries) f(q); total += now() - t0; }
    return total / runs;
  };
  return { n, input, bstHeight: bst.height(), avlHeight: avl.height(), bstSearchMs: time(k => bst.search(k)), avlSearchMs: time(k => avl.search(k)) };
}

export interface MstBench { v: number; e: number; kind: 'sparse' | 'dense'; primMs: number; kruskalMs: number; primTotal: number; kruskalTotal: number; }
export function benchMst(v: number, kind: 'sparse' | 'dense', runs = 3, seed = 7): MstBench {
  const e = kind === 'sparse' ? 2 * v : Math.floor((v * v) / 4);
  const g = randomGraph(v, e, seed);
  let pt = 0, kt = 0, pTot = 0, kTot = 0;
  for (let r = 0; r < runs; r++) {
    let t0 = now(); const p = prim(g); pt += now() - t0; pTot = p.total;
    t0 = now(); const k = kruskal(g); kt += now() - t0; kTot = k.total;
  }
  return { v, e: g.edges().length, kind, primMs: pt / runs, kruskalMs: kt / runs, primTotal: pTot, kruskalTotal: kTot };
}
