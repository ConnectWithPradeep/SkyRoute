import type { Airport, Route } from './types';
import { DEMO_AIRPORTS, DEMO_ROUTES } from './data';
import { AdjacencyListGraph, AdjacencyMatrixGraph, buildRouteGraph, cheapestRoute, fewestFlightsRoute, dijkstra, prim, kruskal, connectedComponents, stronglyConnectedComponents, topologicalSort, dfs, bfsOrder, BST, AVL, buildExpressionTree, evaluateTree, infixOf, postfixOf, prefixOf, validateAirport, validateRoute, removeAirport, benchMst, randomGraph, makeRng } from './algorithms';

export interface TestResult { name: string; passed: boolean; detail: string; }
type TestFn = () => string | void; // return a detail string; throw to fail

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
const eq = <T,>(a: T, b: T, msg: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// A small hand-checkable graph: A-B 4, A-C 1, C-B 2, B-D 5, C-D 8
const smallAirports: Airport[] = ['A', 'B', 'C', 'D', 'E'].map(c => ({ code: c.repeat(3), name: c, city: c, country: 'T', lat: 0, lng: 0 }));
const R = (flightNo: string, from: string, to: string, fare: number): Route => ({ flightNo, from: from.repeat(3), to: to.repeat(3), distance: fare * 10, fare });
const smallRoutes: Route[] = [R('F1', 'A', 'B', 4), R('F2', 'A', 'C', 1), R('F3', 'C', 'B', 2), R('F4', 'B', 'D', 5), R('F5', 'C', 'D', 8)]; // E isolated

const tests: Array<[string, TestFn]> = [
  ['15 default airports are loaded', () => { eq(DEMO_AIRPORTS.length, 15, 'airport count'); }],
  ['At least 26 default routes, all with valid airport codes', () => {
    assert(DEMO_ROUTES.length >= 26, 'fewer than 26 routes');
    const codes = new Set(DEMO_AIRPORTS.map(a => a.code));
    assert(DEMO_ROUTES.every(r => codes.has(r.from) && codes.has(r.to) && r.from !== r.to), 'invalid code in routes');
    assert(new Set(DEMO_ROUTES.map(r => r.flightNo)).size === DEMO_ROUTES.length, 'duplicate flight numbers in demo data');
    return `${DEMO_ROUTES.length} routes`;
  }],
  ['Normal connected graph (demo network is one component with 15 nodes)', () => {
    const g = buildRouteGraph(DEMO_AIRPORTS, DEMO_ROUTES);
    eq(connectedComponents(g).length, 1, 'components');
    eq(bfsOrder(g, 'DEL').length, 15, 'BFS reach');
  }],
  ['Graph with at least 12 nodes works end-to-end', () => {
    const g = randomGraph(12, 20, 1);
    assert(g.nodes.length >= 12, 'size');
    eq(prim(g).total, kruskal(g).total, 'prim vs kruskal on 12 nodes');
  }],
  ['Disconnected graph: components and spanning forest', () => {
    const g = buildRouteGraph(smallAirports, smallRoutes);
    eq(connectedComponents(g).length, 2, 'components');
    const p = prim(g), k = kruskal(g);
    eq(p.components, 2, 'prim forest'); eq(k.components, 2, 'kruskal forest');
    eq(p.edges.length, 3, 'forest edge count');
  }],
  ['Directed graph: DFS edge classification + SCC (Kosaraju)', () => {
    const g = new AdjacencyListGraph(['1', '2', '3', '4', '5'], true);
    [['1', '2'], ['2', '3'], ['3', '1'], ['3', '4'], ['4', '5'], ['1', '4']].forEach(([a, b]) => g.addEdge(a, b));
    const sccs = stronglyConnectedComponents(g).map(c => c.sort()).sort();
    eq(sccs, [['1', '2', '3'], ['4'], ['5']], 'SCCs');
    const kinds = dfs(g, '1').classified.map(c => c.kind);
    assert(kinds.includes('back'), 'expected a back edge'); assert(kinds.includes('forward'), 'expected a forward edge');
  }],
  ['Topological sort: DAG ordered, cycle detected', () => {
    const dag = new AdjacencyListGraph(['a', 'b', 'c'], true); dag.addEdge('a', 'b'); dag.addEdge('b', 'c');
    eq(topologicalSort(dag).order, ['a', 'b', 'c'], 'order');
    const cyc = new AdjacencyListGraph(['a', 'b', 'c'], true); cyc.addEdge('a', 'b'); cyc.addEdge('b', 'c'); cyc.addEdge('c', 'b');
    const r = topologicalSort(cyc); assert(r.order === null, 'cycle not detected'); eq(r.cycleNodes.sort(), ['b', 'c'], 'cycle nodes');
  }],
  ['Unreachable destination returns found=false (no fabricated path)', () => {
    const r1 = cheapestRoute(smallAirports, smallRoutes, 'AAA', 'EEE');
    const r2 = fewestFlightsRoute(smallAirports, smallRoutes, 'AAA', 'EEE');
    assert(!r1.found && !r2.found, 'should be unreachable'); assert(r1.path.length === 0 && r2.path.length === 0, 'path must be empty');
  }],
  ['Dijkstra correctness (A→D cheapest = A-C-B-D, fare 8)', () => {
    const r = cheapestRoute(smallAirports, smallRoutes, 'AAA', 'DDD');
    eq(r.path, ['AAA', 'CCC', 'BBB', 'DDD'], 'path'); eq(r.totalFare, 8, 'fare'); eq(r.legs.map(l => l.flightNo), ['F2', 'F3', 'F4'], 'flights');
  }],
  ['BFS correctness (A→D fewest flights = 2 legs, 1 stop)', () => {
    const r = fewestFlightsRoute(smallAirports, smallRoutes, 'AAA', 'DDD');
    assert(r.found, 'found'); eq(r.legs.length, 2, 'legs'); eq(r.stops, 1, 'stops');
  }],
  ['Dijkstra cross-check: BFS hop count equals Dijkstra on unit weights', () => {
    const g = buildRouteGraph(DEMO_AIRPORTS, DEMO_ROUTES, 'hops');
    const d = dijkstra(g, 'COK');
    for (const a of DEMO_AIRPORTS) { const b = fewestFlightsRoute(DEMO_AIRPORTS, DEMO_ROUTES, 'COK', a.code); if (a.code !== 'COK') eq(b.legs.length, d.dist.get(a.code), `hops to ${a.code}`); }
  }],
  ['Dijkstra rejects negative edge weights', () => {
    const g = new AdjacencyListGraph(['a', 'b'], true); g.addEdge('a', 'b', -3);
    let threw = false; try { dijkstra(g, 'a'); } catch { threw = true; }
    assert(threw, 'expected an error for negative weight');
  }],
  ['Prim correctness (small graph MST weight = 8)', () => { eq(prim(buildRouteGraph(smallAirports, smallRoutes)).total, 8, 'prim total'); }],
  ['Kruskal correctness (small graph MST weight = 8)', () => { eq(kruskal(buildRouteGraph(smallAirports, smallRoutes)).total, 8, 'kruskal total'); }],
  ['Prim and Kruskal agree on demo network and random graphs', () => {
    const g = buildRouteGraph(DEMO_AIRPORTS, DEMO_ROUTES, 'distance');
    const p = prim(g), k = kruskal(g);
    eq(p.total, k.total, 'demo total'); eq(p.edges.length, 14, 'spanning tree has V-1 edges');
    for (let s = 1; s <= 5; s++) { const b = benchMst(60, s % 2 ? 'sparse' : 'dense', 1, s); eq(b.primTotal, b.kruskalTotal, `random seed ${s}`); }
  }],
  ['AVL balancing: 1000 sorted inserts stay O(log n) and verify() passes', () => {
    const t = new AVL<number>((a, b) => a - b);
    for (let i = 0; i < 1000; i++) t.insert(i);
    eq(t.verify(), [], 'verify'); assert(t.height() <= 14, `height ${t.height()} too large`);
    return `height ${t.height()}`;
  }],
  ['AVL rotations: LL, RR, LR, RL each occur and are traced', () => {
    const mk = (keys: number[]) => { const t = new AVL<number>((a, b) => a - b); keys.forEach(k => t.insert(k)); return t; };
    assert(mk([3, 2, 1]).rotations.LL === 1, 'LL'); assert(mk([1, 2, 3]).rotations.RR === 1, 'RR');
    assert(mk([3, 1, 2]).rotations.LR === 1, 'LR'); assert(mk([1, 3, 2]).rotations.RL === 1, 'RL');
    assert(mk([3, 1, 2]).trace.some(s => s.includes('LR')), 'trace missing');
  }],
  ['AVL stress: 10,000 random inserts/deletes keep verify() clean', () => {
    const rng = makeRng(99); const t = new AVL<number>((a, b) => a - b); const ref = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const k = Math.floor(rng() * 3000);
      if (rng() < 0.6) { t.insert(k); ref.add(k); } else { t.delete(k); ref.delete(k); }
      if (i % 500 === 0) eq(t.verify(), [], `verify at step ${i}`);
    }
    eq(t.verify(), [], 'final verify'); eq(t.size, ref.size, 'size matches reference set');
  }],
  ['BST search, delete (leaf / one child / two children) and range', () => {
    const t = new BST<number>((a, b) => a - b); [50, 30, 70, 20, 40, 60, 80].forEach(k => t.insert(k));
    assert(t.search(60).found, 'find 60'); assert(!t.search(65).found, 'not find 65');
    t.delete(20); t.delete(30); t.delete(50);
    eq(t.inorder(), [40, 60, 70, 80], 'inorder after deletes'); eq(t.size, 4, 'size'); eq(t.range(41, 70), [60, 70], 'range');
  }],
  ['BST degenerates on sorted input while AVL does not', () => {
    const b = new BST<number>((a, c) => a - c), a = new AVL<number>((x, y) => x - y);
    for (let i = 0; i < 500; i++) { b.insert(i); a.insert(i); }
    eq(b.height(), 500, 'BST height'); assert(a.height() < 12, 'AVL height');
  }],
  ['Expression tree: evaluation, traversals, errors', () => {
    const t = buildExpressionTree('(2 + 3) * 4 - 6 / 2');
    eq(evaluateTree(t), 17, 'value'); eq(postfixOf(t).join(' '), '2 3 + 4 * 6 2 / -', 'postfix');
    eq(prefixOf(t).join(' '), '- * + 2 3 4 / 6 2', 'prefix'); eq(infixOf(t), '(2 + 3) * 4 - 6 / 2', 'infix');
    let e1 = false, e2 = false, e3 = false;
    try { evaluateTree(buildExpressionTree('4 / (2 - 2)')); } catch { e1 = true; }
    try { buildExpressionTree('3 +'); } catch { e2 = true; }
    try { buildExpressionTree('(3 + 4'); } catch { e3 = true; }
    assert(e1 && e2 && e3, 'expected errors for div-by-zero / dangling operator / unbalanced parens');
  }],
  ['Duplicate flight number is rejected', () => {
    const v = validateRoute({ flightNo: 'SIM101', from: 'DEL', to: 'BOM', distance: 100, fare: 100 }, DEMO_AIRPORTS, DEMO_ROUTES);
    assert(!v.ok, 'should reject'); assert(/already exists/.test(v.error ?? ''), 'message');
  }],
  ['Invalid airport code is rejected (flight and airport forms)', () => {
    const v = validateRoute({ flightNo: 'NEW1', from: 'XXX', to: 'BOM', distance: 100, fare: 100 }, DEMO_AIRPORTS, DEMO_ROUTES);
    assert(!v.ok && /Invalid source/.test(v.error ?? ''), 'invalid route code');
    const a = validateAirport({ code: 'DEL', name: 'x', city: 'x', country: 'x', lat: 1, lng: 1 }, DEMO_AIRPORTS);
    assert(!a.ok, 'duplicate airport code'); assert(!validateAirport({ code: 'D1', name: 'x', city: 'x', country: 'x', lat: 1, lng: 1 }, DEMO_AIRPORTS).ok, 'bad format');
  }],
  ['Airport deletion removes its flights; no route references a missing airport', () => {
    const r = removeAirport(DEMO_AIRPORTS, DEMO_ROUTES, 'BOM');
    const expected = DEMO_ROUTES.filter(x => x.from === 'BOM' || x.to === 'BOM').length;
    eq(r.airports.length, 14, 'airports'); eq(r.removedRoutes, expected, 'removed routes'); eq(r.routes.length, DEMO_ROUTES.length - expected, 'remaining routes');
    const codes = new Set(r.airports.map(a => a.code));
    assert(r.routes.every(x => codes.has(x.from) && codes.has(x.to)), 'dangling route');
  }],
  ['Matrix and list graphs describe the same network', () => {
    const m = new AdjacencyMatrixGraph(['x', 'y', 'z']); m.addEdge('x', 'y', 3);
    assert(m.hasEdge('y', 'x') && !m.hasEdge('x', 'z'), 'matrix symmetric');
    const l = buildRouteGraph(DEMO_AIRPORTS, DEMO_ROUTES);
    assert(l.edges().length === DEMO_ROUTES.length, 'list edge count equals routes array length');
  }],
];

export function runAllTests(): TestResult[] {
  return tests.map(([name, fn]) => {
    try { const d = fn(); return { name, passed: true, detail: typeof d === 'string' ? d : 'OK' }; }
    catch (e) { return { name, passed: false, detail: e instanceof Error ? e.message : String(e) }; }
  });
}
