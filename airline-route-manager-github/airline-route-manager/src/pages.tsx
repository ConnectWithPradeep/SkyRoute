import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MapPin, Plane, IndianRupee, Ruler, Pencil, Plus, Trash2, X, Play } from 'lucide-react';
import type { Airport, AppData, PathResult, Route } from './types';
import type { AirlineStore } from './store';
import { Stat, TreeView, RouteMap, toVisual, type VNode } from './components';
import { runAllTests, type TestResult } from './tests';
import {
  AdjacencyListGraph, buildMatrixGraph, buildRouteGraph, connectedComponents, kruskal, prim, bfsOrder, dfs,
  stronglyConnectedComponents, topologicalSort, cheapestRoute, fewestFlightsRoute, BST, AVL, GNode,
  buildCountryTree, deleteSubtree, findNode, insertChild, levelorderG, postorderG, preorderG,
  ENode, buildExpressionTree, evaluateTree, infixOf, postfixOf, prefixOf, benchMst, benchTrees, MstBench, TreeBench,
} from './algorithms';

// ===== Dashboard.tsx =====

export function Dashboard({ data }: { data: AppData }) {
  const { airports, routes, activity } = data;
  const stats = useMemo(() => {
    const totalFare = routes.reduce((s, r) => s + r.fare, 0);
    const totalDist = routes.reduce((s, r) => s + r.distance, 0);
    const deg = new Map<string, number>(airports.map(a => [a.code, 0]));
    for (const r of routes) { deg.set(r.from, (deg.get(r.from) ?? 0) + 1); deg.set(r.to, (deg.get(r.to) ?? 0) + 1); }
    const chart = [...deg.entries()].map(([code, flights]) => ({ code, flights })).sort((a, b) => b.flights - a.flights);
    const g = buildRouteGraph(airports, routes, 'distance');
    const comps = connectedComponents(g).length;
    const v = airports.length;
    const density = v > 1 ? (routes.length / ((v * (v - 1)) / 2)) * 100 : 0;
    return { avgFare: routes.length ? Math.round(totalFare / routes.length) : 0, totalDist, chart, comps, density, mst: kruskal(g).total, hub: chart[0] };
  }, [airports, routes]);

  return (
    <div className="grid">
      <div className="grid g4">
        <Stat icon={<MapPin />} value={airports.length} label="Total airports" />
        <Stat icon={<Plane />} value={routes.length} label="Total flights / routes" />
        <Stat icon={<IndianRupee />} value={`₹${stats.avgFare.toLocaleString('en-IN')}`} label="Average fare (simulated)" />
        <Stat icon={<Ruler />} value={`${stats.totalDist.toLocaleString('en-IN')} km`} label="Total network distance" />
      </div>
      <div className="grid g2">
        <div className="card">
          <h3>Airport distribution – flights per airport</h3>
          {stats.chart.length === 0 ? <div className="empty">No airports yet.</div> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="code" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="flights" fill="#2f7df6" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3>Route network summary</h3>
          <div className="kv">
            <span className="muted">Connected groups</span><b>{stats.comps}{stats.comps > 1 ? ' (network is split)' : ' (fully connected)'}</b>
            <span className="muted">Network density</span><b>{stats.density.toFixed(1)}%</b>
            <span className="muted">Busiest hub</span><b>{stats.hub ? `${stats.hub.code} (${stats.hub.flights} flights)` : '—'}</b>
            <span className="muted">Minimum spanning cost (by fare)</span><b>₹{stats.mst.toLocaleString('en-IN')}</b>
          </div>
          <div className="note">Fares, schedules and flight numbers are simulated demonstration data, not real airline information.</div>
        </div>
      </div>
      <div className="card">
        <h3>Recent activity</h3>
        {activity.length === 0 ? <div className="empty">No activity yet.</div> : (
          <div className="tbl-wrap"><table><tbody>
            {activity.slice(0, 8).map(a => <tr key={a.id}><td className="muted">{new Date(a.time).toLocaleString()}</td><td>{a.text}</td></tr>)}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}

// ===== AirportsPage.tsx =====

const blankAirport = { code: '', name: '', city: '', country: 'India', lat: '', lng: '' };

export function AirportsPage({ store }: { store: AirlineStore }) {
  const { airports } = store.data;
  const [form, setForm] = useState(blankAirport);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');

  const countries = useMemo(() => [...new Set(airports.map(a => a.country))].sort(), [airports]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return airports.filter(a => (country === 'all' || a.country === country) && (!s || [a.code, a.name, a.city].some(x => x.toLowerCase().includes(s))));
  }, [airports, q, country]);

  const set = (k: keyof typeof blankAirport) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    setMsg('');
    if (form.lat.trim() === '' || form.lng.trim() === '') { setError('Latitude and longitude are required.'); return; }
    const a: Airport = { code: form.code, name: form.name, city: form.city, country: form.country, lat: Number(form.lat), lng: Number(form.lng) };
    const v = editing ? store.editAirport(editing, a) : store.addAirport(a);
    if (!v.ok) { setError(v.error ?? 'Invalid airport'); return; }
    setError(''); setMsg(editing ? `Updated ${a.code.toUpperCase()}` : `Added ${a.code.toUpperCase()}`);
    setForm(blankAirport); setEditing(null);
  };
  const startEdit = (a: Airport) => { setEditing(a.code); setForm({ ...a, lat: String(a.lat), lng: String(a.lng) }); setError(''); setMsg(''); };
  const remove = (a: Airport) => {
    const n = store.data.routes.filter(r => r.from === a.code || r.to === a.code).length;
    if (window.confirm(`Delete ${a.code}? This also removes ${n} connected flight(s).`)) { store.deleteAirport(a.code); setMsg(`Deleted ${a.code} and ${n} flight(s)`); if (editing === a.code) { setEditing(null); setForm(blankAirport); } }
  };

  return (
    <div className="grid">
      <div className="card">
        <h3>{editing ? `Edit airport ${editing}` : 'Add airport'}</h3>
        <div className="form">
          <label>Code (3 letters)<input value={form.code} maxLength={3} onChange={set('code')} placeholder="TRZ" /></label>
          <label>Airport name<input value={form.name} onChange={set('name')} /></label>
          <label>City<input value={form.city} onChange={set('city')} /></label>
          <label>Country<input value={form.country} onChange={set('country')} /></label>
          <label>Latitude<input type="number" step="any" value={form.lat} onChange={set('lat')} /></label>
          <label>Longitude<input type="number" step="any" value={form.lng} onChange={set('lng')} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={submit}><Plus size={16} />{editing ? 'Save' : 'Add'}</button>
            {editing && <button className="btn ghost" onClick={() => { setEditing(null); setForm(blankAirport); setError(''); }}><X size={16} />Cancel</button>}
          </div>
        </div>
        {error && <div className="err" role="alert">{error}</div>}
        {msg && <div className="okmsg">{msg}</div>}
      </div>

      <div className="card">
        <div className="toolbar">
          <label>Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Code, name or city" /></label>
          <label>Country<select value={country} onChange={e => setCountry(e.target.value)}><option value="all">All</option>{countries.map(c => <option key={c}>{c}</option>)}</select></label>
          <span className="muted">{shown.length} of {airports.length} airports</span>
        </div>
        {shown.length === 0 ? <div className="empty">No airports match.</div> : (
          <>
            <div className="tbl-wrap"><table>
              <thead><tr><th>Code</th><th>Airport</th><th>City</th><th>Country</th><th>Latitude</th><th>Longitude</th><th></th></tr></thead>
              <tbody>{shown.map(a => (
                <tr key={a.code}><td><span className="code">{a.code}</span></td><td>{a.name}</td><td>{a.city}</td><td>{a.country}</td><td>{a.lat.toFixed(4)}</td><td>{a.lng.toFixed(4)}</td>
                  <td><button className="btn ghost sm" onClick={() => startEdit(a)}><Pencil size={13} />Edit</button>{' '}<button className="btn danger sm" onClick={() => remove(a)}><Trash2 size={13} />Delete</button></td></tr>
              ))}</tbody>
            </table></div>
            <div className="cards">{shown.map(a => (
              <div className="acard" key={a.code}><span className="code">{a.code}</span><div style={{ fontWeight: 600, margin: '8px 0 2px' }}>{a.city}</div><div className="muted small">{a.name}</div><div className="muted small">{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</div></div>
            ))}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== FlightsPage.tsx =====

const blankFlight = { flightNo: '', from: '', to: '', distance: '', fare: '' };

export function FlightsPage({ store }: { store: AirlineStore }) {
  const { airports, routes } = store.data;
  const [form, setForm] = useState(blankFlight);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');

  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return routes.filter(r => !s || r.flightNo.toLowerCase().includes(s)); }, [routes, q]);
  const set = (k: keyof typeof blankFlight) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    setMsg('');
    const r: Route = { flightNo: form.flightNo, from: form.from, to: form.to, distance: Number(form.distance), fare: Number(form.fare) };
    if (form.distance.trim() === '' || form.fare.trim() === '') { setError('Distance and fare are required.'); return; }
    const v = editing ? store.editRoute(editing, r) : store.addRoute(r);
    if (!v.ok) { setError(v.error ?? 'Invalid flight'); return; }
    setError(''); setMsg(editing ? `Updated ${r.flightNo.toUpperCase()}` : `Added ${r.flightNo.toUpperCase()}`);
    setForm(blankFlight); setEditing(null);
  };
  const startEdit = (r: Route) => { setEditing(r.flightNo); setForm({ flightNo: r.flightNo, from: r.from, to: r.to, distance: String(r.distance), fare: String(r.fare) }); setError(''); setMsg(''); };

  return (
    <div className="grid">
      <div className="card">
        <h3>{editing ? `Edit flight ${editing}` : 'Add flight'}</h3>
        {airports.length < 2 ? <div className="empty">Add at least two airports before creating flights.</div> : (
          <div className="form">
            <label>Flight number<input value={form.flightNo} onChange={set('flightNo')} placeholder="SIM200" /></label>
            <label>Source<select value={form.from} onChange={set('from')}><option value="">Select…</option>{airports.map(a => <option key={a.code} value={a.code}>{a.code} – {a.city}</option>)}</select></label>
            <label>Destination<select value={form.to} onChange={set('to')}><option value="">Select…</option>{airports.map(a => <option key={a.code} value={a.code}>{a.code} – {a.city}</option>)}</select></label>
            <label>Distance (km)<input type="number" min="1" value={form.distance} onChange={set('distance')} /></label>
            <label>Fare (₹, simulated)<input type="number" min="1" value={form.fare} onChange={set('fare')} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={submit}><Plus size={16} />{editing ? 'Save' : 'Add'}</button>
              {editing && <button className="btn ghost" onClick={() => { setEditing(null); setForm(blankFlight); setError(''); }}><X size={16} />Cancel</button>}
            </div>
          </div>
        )}
        {error && <div className="err" role="alert">{error}</div>}
        {msg && <div className="okmsg">{msg}</div>}
      </div>
      <div className="card">
        <div className="toolbar"><label>Search by flight number<input value={q} onChange={e => setQ(e.target.value)} placeholder="SIM1" /></label><span className="muted">{shown.length} of {routes.length} flights</span></div>
        {shown.length === 0 ? <div className="empty">No flights match.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Flight</th><th>From</th><th>To</th><th>Distance</th><th>Fare</th><th></th></tr></thead>
            <tbody>{shown.map(r => (
              <tr key={r.flightNo}><td><b>{r.flightNo}</b></td><td>{r.from}</td><td>{r.to}</td><td>{r.distance} km</td><td>₹{r.fare.toLocaleString('en-IN')}</td>
                <td><button className="btn ghost sm" onClick={() => startEdit(r)}><Pencil size={13} />Edit</button>{' '}
                  <button className="btn danger sm" onClick={() => { if (window.confirm(`Delete flight ${r.flightNo}?`)) { store.deleteRoute(r.flightNo); if (editing === r.flightNo) { setEditing(null); setForm(blankFlight); } } }}><Trash2 size={13} />Delete</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
        <div className="note">Each flight is stored once and can be flown in both directions. Fares and flight numbers are simulated.</div>
      </div>
    </div>
  );
}

// ===== PlannerPage.tsx =====

type Algo = 'dijkstra' | 'bfs';

export function PlannerPage({ data, variant }: { data: AppData; variant: 'map' | 'planner' }) {
  const { airports, routes } = data;
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [algo, setAlgo] = useState<Algo>('dijkstra');
  const [result, setResult] = useState<PathResult | null>(null);
  const [picking, setPicking] = useState<'src' | 'dst'>('src');

  // If an airport is deleted/renamed, forget stale selections and results.
  useEffect(() => {
    const codes = new Set(airports.map(a => a.code));
    if (src && !codes.has(src)) setSrc('');
    if (dst && !codes.has(dst)) setDst('');
    setResult(null);
  }, [airports, routes]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    if (!src || !dst) { setResult({ found: false, reason: 'Please select both a source and a destination airport.', path: [], legs: [], totalFare: 0, totalDistance: 0, stops: 0, steps: [] }); return; }
    setResult(algo === 'dijkstra' ? cheapestRoute(airports, routes, src, dst) : fewestFlightsRoute(airports, routes, src, dst));
  };

  const onMapClick = (code: string) => {
    setResult(null);
    if (picking === 'src') { setSrc(code); setPicking('dst'); } else { setDst(code); setPicking('src'); }
  };
  const path = useMemo(() => (result?.found ? result.path : []), [result]);
  const name = (c: string) => airports.find(a => a.code === c)?.city ?? c;

  return (
    <div className="grid">
      <div className="card">
        <div className="toolbar">
          <label>Source<select value={src} onChange={e => { setSrc(e.target.value); setResult(null); }}><option value="">Select…</option>{airports.map(a => <option key={a.code} value={a.code}>{a.code} – {a.city}</option>)}</select></label>
          <label>Destination<select value={dst} onChange={e => { setDst(e.target.value); setResult(null); }}><option value="">Select…</option>{airports.map(a => <option key={a.code} value={a.code}>{a.code} – {a.city}</option>)}</select></label>
          <label>Algorithm<select value={algo} onChange={e => { setAlgo(e.target.value as Algo); setResult(null); }}>
            <option value="dijkstra">Dijkstra – cheapest fare</option><option value="bfs">BFS – fewest flights</option></select></label>
          <button className="btn" onClick={run}>Find route</button>
          <button className="btn ghost" onClick={() => { setSrc(''); setDst(''); setResult(null); setPicking('src'); }}>Clear</button>
        </div>
        <div className="muted small">Tip: click airports on the map to set the {picking === 'src' ? <b>source</b> : <b>destination</b>}.</div>
      </div>

      <div className="card">
        <RouteMap airports={airports} routes={routes} path={path} source={src} destination={dst} height={variant === 'map' ? 560 : 400} onAirportClick={onMapClick} />
        <div className="legend"><span><i style={{ background: '#5b8def' }} />Flight connection</span><span><i style={{ background: '#f59e0b' }} />Calculated route</span><span><i style={{ background: '#16a34a' }} />Source</span><span><i style={{ background: '#dc2626' }} />Destination</span></div>
      </div>

      {result && (
        <div className="card">
          <h3>{algo === 'dijkstra' ? 'Cheapest route (Dijkstra)' : 'Fewest flights (BFS)'}</h3>
          {!result.found ? <div className="err" role="alert">{result.reason}</div> : (
            <>
              <div className="route-line">{result.path.map((c, i) => <span key={c + i}><span className="pill">{c}</span>{i < result.path.length - 1 && '→'}</span>)}</div>
              <div className="muted small">{name(result.path[0])} to {name(result.path[result.path.length - 1])}</div>
              <div className="grid g4" style={{ margin: '12px 0' }}>
                <div className="acard"><div className="muted small">Total fare</div><b>₹{result.totalFare.toLocaleString('en-IN')}</b></div>
                <div className="acard"><div className="muted small">Total distance</div><b>{result.totalDistance.toLocaleString('en-IN')} km</b></div>
                <div className="acard"><div className="muted small">Flights</div><b>{result.legs.length}</b></div>
                <div className="acard"><div className="muted small">Intermediate stops</div><b>{result.stops}{result.stops ? ` (${result.path.slice(1, -1).join(', ')})` : ' (direct)'}</b></div>
              </div>
              <div className="tbl-wrap"><table><thead><tr><th>Leg</th><th>Flight</th><th>Distance</th><th>Fare</th></tr></thead><tbody>
                {result.legs.map((l, i) => <tr key={l.flightNo}><td>{result.path[i]} → {result.path[i + 1]}</td><td><b>{l.flightNo}</b></td><td>{l.distance} km</td><td>₹{l.fare.toLocaleString('en-IN')}</td></tr>)}
              </tbody></table></div>
            </>
          )}
          {variant === 'planner' && result.steps.length > 0 && <><h3 style={{ marginTop: 14 }}>Algorithm steps</h3><div className="steps">{result.steps.join('\n')}</div></>}
        </div>
      )}
    </div>
  );
}

// ===== TreesPage.tsx =====

type Tab = 'general' | 'bst' | 'avl';
type Order = 'inorder' | 'preorder' | 'postorder' | 'levelorder';

/** BST / AVL panel. Starts from the real data (flight numbers / airport codes); further edits are an experiment sandbox. */
function KeyTreePanel({ kind, initial }: { kind: 'bst' | 'avl'; initial: string[] }) {
  const tree = useRef<BST<string> | AVL<string>>(kind === 'bst' ? new BST<string>() : new AVL<string>());
  const [, bump] = useState(0);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [hl, setHl] = useState<string[]>([]);
  const [order, setOrder] = useState<Order>('inorder');
  const [trace, setTrace] = useState<string[]>([]);

  const rebuild = () => {
    const t = kind === 'bst' ? new BST<string>() : new AVL<string>();
    initial.forEach(k => t.insert(k));
    tree.current = t; setHl([]); setTrace([]); setMsg(`Rebuilt from data in stored order (${initial.length} keys).`); bump(x => x + 1);
  };
  useEffect(rebuild, [initial.join('|'), kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = tree.current;
  const k = key.trim().toUpperCase();
  const needKey = () => { if (!k) { setMsg('Enter a key first.'); return false; } return true; };
  const insert = () => {
    if (!needKey()) return;
    const ok = t.insert(k);
    setMsg(ok ? `Inserted ${k}.` : `${k} already exists – duplicates are not allowed.`);
    setTrace(kind === 'avl' ? (t as AVL<string>).trace : []); setHl(ok ? [k] : []); bump(x => x + 1);
  };
  const del = () => {
    if (!needKey()) return;
    const ok = t.delete(k);
    setMsg(ok ? `Deleted ${k}.` : `${k} not found.`);
    setTrace(kind === 'avl' ? (t as AVL<string>).trace : []); setHl([]); bump(x => x + 1);
  };
  const search = () => {
    if (!needKey()) return;
    const r = t.search(k);
    setHl(r.path); setMsg(r.found ? `Found ${k} after ${r.path.length} comparison(s): ${r.path.join(' → ')}` : `${k} not found. Path searched: ${r.path.join(' → ') || '(empty tree)'}`);
  };
  const traversal = useMemo(() => {
    const tt = tree.current;
    if (order === 'inorder') return tt.inorder();
    if (order === 'preorder') return tt.preorder();
    if (order === 'postorder') return tt.postorder();
    return tt.levelorder();
  }, [order, trace, msg]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors = kind === 'avl' ? (t as AVL<string>).verify() : [];
  const root: VNode | null = toVisual(t.root, kind === 'avl');
  const size = t.size;
  return (
    <div className="card">
      <div className="note">
        {kind === 'bst'
          ? 'BST of flight numbers. Flights are inserted in stored (sorted) order, so the plain BST degenerates into a chain – compare this with the AVL tree below.'
          : 'AVL tree of airport codes (self-balancing). h = height, bf = balance factor (left − right), always −1, 0 or +1.'}
      </div>
      <div className="toolbar">
        <label>Key<input value={key} onChange={e => setKey(e.target.value)} placeholder={kind === 'bst' ? 'SIM999' : 'XYZ'} onKeyDown={e => e.key === 'Enter' && insert()} /></label>
        <button className="btn" onClick={insert}>Insert</button>
        <button className="btn danger" onClick={del}>Delete</button>
        <button className="btn ghost" onClick={search}>Search</button>
        <button className="btn ghost" onClick={rebuild}>Rebuild from data</button>
        <label>Traversal<select value={order} onChange={e => setOrder(e.target.value as Order)}><option value="inorder">Inorder</option><option value="preorder">Preorder</option><option value="postorder">Postorder</option><option value="levelorder">Level order</option></select></label>
      </div>
      <div className="muted small">Nodes: {size} · Height: {t.height()} {kind === 'avl' && <> · Rotations LL/RR/LR/RL: {Object.values((t as AVL<string>).rotations).join(' / ')} · verify(): {errors.length === 0 ? <span className="pass">valid</span> : <span className="fail">{errors[0]}</span>}</>}</div>
      {msg && <div className="okmsg">{msg}</div>}
      {trace.length > 0 && <div className="steps" style={{ margin: '10px 0' }}>{trace.join('\n')}</div>}
      <div style={{ margin: '10px 0' }}><b>{order}:</b> {traversal.join(', ') || '(empty)'}</div>
      <TreeView root={root} highlight={hl} />
    </div>
  );
}

function gToV(n: GNode): VNode { return { id: n.label, label: n.label, children: n.children.map(gToV) }; }

function GeneralPanel({ data }: { data: AppData }) {
  const fresh = () => buildCountryTree(data.airports);
  const root = useRef<GNode>(fresh());
  const [, bump] = useState(0);
  const [parent, setParent] = useState('India');
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [hl, setHl] = useState<string[]>([]);
  const [order, setOrder] = useState<'pre' | 'post' | 'level'>('pre');
  useEffect(() => { root.current = fresh(); setHl([]); bump(x => x + 1); }, [data.airports]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = root.current;
  const out = order === 'pre' ? preorderG(r) : order === 'post' ? postorderG(r) : levelorderG(r);
  return (
    <div className="card">
      <div className="note">General tree: World → Country → Airport, generated from the airports list. Edits here are a demo sandbox and reset when airports change.</div>
      <div className="toolbar">
        <label>Parent node<input value={parent} onChange={e => setParent(e.target.value)} /></label>
        <label>New / target node<input value={label} onChange={e => setLabel(e.target.value)} /></label>
        <button className="btn" onClick={() => { const ok = insertChild(r, parent.trim(), label.trim()); setMsg(ok ? `Inserted ${label.trim()} under ${parent.trim()}.` : 'Insert failed: parent must exist and the label must be new and non-empty.'); setHl(ok ? [label.trim()] : []); bump(x => x + 1); }}>Insert</button>
        <button className="btn danger" onClick={() => { const l = label.trim(); const ok = l !== r.label && deleteSubtree(r, l); setMsg(ok ? `Deleted subtree ${l}.` : 'Delete failed: node not found (the root cannot be deleted).'); setHl([]); bump(x => x + 1); }}>Delete subtree</button>
        <button className="btn ghost" onClick={() => { const n = findNode(r, label.trim()); setHl(n ? [n.label] : []); setMsg(n ? `Found ${n.label} (${n.children.length} child(ren)).` : `${label.trim() || '(empty)'} not found.`); }}>Search</button>
        <label>Traversal<select value={order} onChange={e => setOrder(e.target.value as 'pre' | 'post' | 'level')}><option value="pre">Preorder</option><option value="post">Postorder</option><option value="level">Level order</option></select></label>
      </div>
      {msg && <div className="okmsg">{msg}</div>}
      <div style={{ margin: '10px 0' }}><b>{order}order:</b> {out.join(', ')}</div>
      <TreeView root={gToV(r)} highlight={hl} />
    </div>
  );
}

export function TreesPage({ data }: { data: AppData }) {
  const [tab, setTab] = useState<Tab>('general');
  const flights = useMemo(() => data.routes.map(r => r.flightNo), [data.routes]);
  const codes = useMemo(() => data.airports.map(a => a.code), [data.airports]);
  return (
    <div>
      <div className="tabs">
        {([['general', 'General Tree'], ['bst', 'BST – Flight Numbers'], ['avl', 'AVL – Airport Codes']] as const).map(([id, l]) => (
          <button key={id} className={'tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>
      {tab === 'general' && <GeneralPanel data={data} />}
      {tab === 'bst' && <KeyTreePanel kind="bst" initial={flights} />}
      {tab === 'avl' && <KeyTreePanel kind="avl" initial={codes} />}
    </div>
  );
}

// ===== GraphsPage.tsx =====

type Weight = 'fare' | 'distance';

export function GraphsPage({ data }: { data: AppData }) {
  const { airports, routes } = data;
  const [weight, setWeight] = useState<Weight>('distance');
  const [start, setStart] = useState('');
  const first = airports[0]?.code ?? '';
  const s = airports.some(a => a.code === start) ? start : first;

  const undirected = useMemo(() => buildRouteGraph(airports, routes, weight), [airports, routes, weight]);
  const p = useMemo(() => prim(undirected, s || undefined), [undirected, s]);
  const k = useMemo(() => kruskal(undirected), [undirected]);
  const mat = useMemo(() => buildMatrixGraph(airports, routes), [airports, routes]);
  const list = useMemo(() => buildRouteGraph(airports, routes), [airports, routes]);
  const comps = useMemo(() => connectedComponents(undirected), [undirected]);
  const bfs = useMemo(() => (s ? bfsOrder(undirected, s) : []), [undirected, s]);
  const d = useMemo(() => (s ? dfs(undirected, s) : null), [undirected, s]);

  // Directed model: each stored route is treated as a ONE-WAY flight from → to.
  const directed = useMemo(() => {
    const g = new AdjacencyListGraph(airports.map(a => a.code), true);
    routes.forEach(r => g.addEdge(r.from, r.to, r.fare, r.flightNo));
    return g;
  }, [airports, routes]);
  const scc = useMemo(() => stronglyConnectedComponents(directed), [directed]);
  const topo = useMemo(() => topologicalSort(directed), [directed]);
  const dd = useMemo(() => dfs(directed), [directed]);
  const kindCount = dd.classified.reduce<Record<string, number>>((m, e) => { m[e.kind] = (m[e.kind] ?? 0) + 1; return m; }, {});

  if (airports.length === 0) return <div className="card empty">Add airports to run graph algorithms.</div>;
  const unit = weight === 'fare' ? '₹' : '';
  const sameTotal = p.total === k.total;
  const EdgeList = ({ edges }: { edges: { from: string; to: string; weight: number }[] }) => (
    <div className="tbl-wrap" style={{ maxHeight: 220 }}><table><thead><tr><th>Edge</th><th>Weight</th></tr></thead><tbody>
      {edges.map(e => <tr key={e.from + e.to}><td>{e.from} – {e.to}</td><td>{unit}{e.weight}{weight === 'distance' ? ' km' : ''}</td></tr>)}
    </tbody></table></div>
  );

  return (
    <div className="grid">
      <div className="card">
        <div className="toolbar">
          <label>Edge weight<select value={weight} onChange={e => setWeight(e.target.value as Weight)}><option value="distance">Distance (km)</option><option value="fare">Fare (₹)</option></select></label>
          <label>Start airport<select value={s} onChange={e => setStart(e.target.value)}>{airports.map(a => <option key={a.code}>{a.code}</option>)}</select></label>
        </div>
        <div className="note"><b>Model choice:</b> flights run both ways, so BFS, DFS, components, Prim and Kruskal use an <b>undirected</b> weighted graph. SCC, topological sort and edge classification only make sense on <b>directed</b> graphs, so there each stored route is treated as a one-way flight (from → to).</div>
      </div>

      <div className="grid g2">
        <div className="card"><h3>Prim (array-based, from {s})</h3>
          <div><b>Total: {unit}{p.total.toLocaleString('en-IN')}{weight === 'distance' ? ' km' : ''}</b> · {p.edges.length} edges · {p.components} component(s)</div>
          <EdgeList edges={p.edges} />
          <div className="steps" style={{ marginTop: 8 }}>{p.steps.join('\n')}</div></div>
        <div className="card"><h3>Kruskal (union-find, own merge sort)</h3>
          <div><b>Total: {unit}{k.total.toLocaleString('en-IN')}{weight === 'distance' ? ' km' : ''}</b> · {k.edges.length} edges · {k.components} component(s)</div>
          <EdgeList edges={k.edges} />
          <div className="steps" style={{ marginTop: 8 }}>{k.steps.join('\n')}</div></div>
      </div>
      <div className="card"><h3>Prim vs Kruskal comparison</h3>
        <p>{sameTotal ? <span className="pass">Both algorithms give the same minimum total ({unit}{p.total}).</span> : <span className="fail">Totals differ – this should never happen; please report it.</span>}
          {' '}The edge sets may differ only when several edges have equal weights.</p>
        <p className="muted">Why this is a minimum spanning {p.components > 1 ? 'forest' : 'tree'}: by the <b>cut property</b>, the cheapest edge crossing any cut of the graph belongs to some MST. Prim always adds the cheapest edge leaving the current tree (a cut), and Kruskal accepts the cheapest edge that joins two different components (also a cut) while rejecting edges that would close a <b>cycle</b>. Both therefore choose only safe edges and finish with V − {p.components} = {airports.length - p.components} edges.</p></div>

      <div className="grid g2">
        <div className="card"><h3>Adjacency matrix vs adjacency list</h3>
          <div className="kv"><span className="muted">Airports (V)</span><b>{airports.length}</b><span className="muted">Flights (E)</span><b>{routes.length}</b>
            <span className="muted">Matrix memory</span><b>{mat.memoryBytes().toLocaleString()} bytes (V² cells)</b>
            <span className="muted">List memory</span><b>{list.memoryBytes().toLocaleString()} bytes (V + 2E records)</b></div>
          <p className="muted small">Estimates: 8 bytes per matrix cell; 8 per list head and 16 per stored edge record. Matrix edge lookup is O(1); list lookup is O(deg).</p></div>
        <div className="card"><h3>Traversals from {s}</h3>
          <p><b>BFS:</b> {bfs.join(' → ')}</p>
          <p><b>DFS (discovery/finish):</b> {d?.order.map(c => `${c} (${d.discovery.get(c)}/${d.finish.get(c)})`).join(', ')}</p>
          <p><b>Connected components ({comps.length}):</b> {comps.map(c => `{${c.join(', ')}}`).join('  ')}</p></div>
      </div>

      <div className="card"><h3>Directed analysis (one-way flights)</h3>
        <p><b>Strongly connected components – Kosaraju ({scc.length}):</b> {scc.map(c => `{${c.join(', ')}}`).join('  ')}</p>
        <p><b>DFS edge classification:</b> {(['tree', 'back', 'forward', 'cross'] as const).map(x => `${x}: ${kindCount[x] ?? 0}`).join(' · ')}</p>
        <p><b>Topological sort (Kahn):</b> {topo.order ? topo.order.join(' → ') : <span className="fail">Not possible – the directed network contains a cycle. Airports involved or blocked by it: {topo.cycleNodes.join(', ')}</span>}</p>
        <p className="muted small">A topological order exists only for acyclic graphs. Airline networks usually contain cycles (A→B→A), so a cycle report is the correct result here.</p></div>
    </div>
  );
}

// ===== ExpressionPage.tsx =====

let uid = 0;
function eToV(n: ENode): VNode { return { id: String(uid++), label: n.value, children: [n.left, n.right].filter((x): x is ENode => x !== null).map(eToV) }; }

export function ExpressionPage() {
  const [text, setText] = useState('(1500 + 3.4 * 800) * 2 - 250 / 5');
  const out = useMemo(() => {
    try {
      const t = buildExpressionTree(text);
      uid = 0;
      let value: string;
      try { value = String(Math.round(evaluateTree(t) * 1e6) / 1e6); } catch (e) { value = e instanceof Error ? `Error: ${e.message}` : 'Error'; }
      return { ok: true as const, tree: eToV(t), infix: infixOf(t), prefix: prefixOf(t).join(' '), postfix: postfixOf(t).join(' '), value };
    } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid expression' }; }
  }, [text]);
  return (
    <div className="card">
      <div className="note">Fare calculator example: base fare + distance × rate. Supports + − * / ^ and parentheses.</div>
      <div className="toolbar"><label style={{ flex: 1 }}>Arithmetic expression<input value={text} onChange={e => setText(e.target.value)} /></label></div>
      {!out.ok ? <div className="err" role="alert">{out.error}</div> : (
        <>
          <div className="kv"><span className="muted">Infix</span><b>{out.infix}</b><span className="muted">Prefix</span><b>{out.prefix}</b><span className="muted">Postfix</span><b>{out.postfix}</b><span className="muted">Value</span><b>{out.value}</b></div>
          <div style={{ marginTop: 12 }}><TreeView root={out.tree} /></div>
        </>
      )}
    </div>
  );
}

// ===== PerformancePage.tsx =====

const PRESETS = {
  quick: { trees: [1000, 5000], graphs: [100, 200, 400], label: 'Quick (a few seconds)' },
  full: { trees: [1000, 5000, 20000], graphs: [200, 1000, 2000], label: 'Assignment sizes (can take a minute; the page may freeze briefly)' },
} as const;
const f = (x: number) => x.toFixed(3);

export function PerformancePage() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('quick');
  const [running, setRunning] = useState(false);
  const [trees, setTrees] = useState<TreeBench[]>([]);
  const [mst, setMst] = useState<MstBench[]>([]);

  const run = () => {
    setRunning(true); setTrees([]); setMst([]);
    const cfg = PRESETS[preset];
    // Yield between jobs so the browser can repaint progress.
    const jobs: Array<() => void> = [];
    const tAcc: TreeBench[] = [], mAcc: MstBench[] = [];
    for (const n of cfg.trees) for (const inp of ['sorted', 'random'] as const) jobs.push(() => { tAcc.push(benchTrees(n, inp)); setTrees([...tAcc]); });
    for (const v of cfg.graphs) for (const kind of ['sparse', 'dense'] as const) jobs.push(() => { mAcc.push(benchMst(v, kind, preset === 'full' ? 1 : 3)); setMst([...mAcc]); });
    const step = (i: number) => { if (i >= jobs.length) { setRunning(false); return; } setTimeout(() => { try { jobs[i](); } catch { /* skip failed job */ } step(i + 1); }, 20); };
    step(0);
  };

  const treeChart = trees.map(t => ({ name: `${t.input} ${t.n}`, BST: Number(f(t.bstSearchMs)), AVL: Number(f(t.avlSearchMs)) }));
  const mstChart = mst.map(m => ({ name: `${m.kind} V=${m.v}`, Prim: Number(f(m.primMs)), Kruskal: Number(f(m.kruskalMs)) }));

  return (
    <div className="grid">
      <div className="card">
        <div className="toolbar">
          <label>Size preset<select value={preset} onChange={e => setPreset(e.target.value as keyof typeof PRESETS)}>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <button className="btn" onClick={run} disabled={running}>{running ? 'Running…' : 'Run benchmarks'}</button>
        </div>
        <div className="note">Every number below is measured live in your browser on seeded random data (reproducible inputs, machine-dependent times). Nothing is hardcoded. Sparse: E≈2V; dense: E≈V²/4.</div>
      </div>
      {trees.length > 0 && (
        <div className="card"><h3>BST vs AVL – search time for up to 2000 lookups (ms)</h3>
          <ResponsiveContainer width="100%" height={260}><BarChart data={treeChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="BST" fill="#dc2626" /><Bar dataKey="AVL" fill="#2f7df6" /></BarChart></ResponsiveContainer>
          <div className="tbl-wrap"><table><thead><tr><th>Input</th><th>n</th><th>BST height</th><th>AVL height</th><th>BST search ms</th><th>AVL search ms</th></tr></thead><tbody>
            {trees.map(t => <tr key={t.input + t.n}><td>{t.input}</td><td>{t.n}</td><td>{t.bstHeight}</td><td>{t.avlHeight}</td><td>{f(t.bstSearchMs)}</td><td>{f(t.avlSearchMs)}</td></tr>)}</tbody></table></div>
          <p className="muted">Theory: AVL height ≤ 1.44·log₂(n+2) so search is O(log n). A BST built from sorted input is a chain of height n, so search is O(n); on random input its expected height is O(log n).</p></div>
      )}
      {mst.length > 0 && (
        <div className="card"><h3>Prim (array, O(V²)) vs Kruskal (O(E log E)) – time (ms)</h3>
          <ResponsiveContainer width="100%" height={260}><BarChart data={mstChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="Prim" fill="#16a34a" /><Bar dataKey="Kruskal" fill="#f59e0b" /></BarChart></ResponsiveContainer>
          <div className="tbl-wrap"><table><thead><tr><th>Density</th><th>V</th><th>E</th><th>Prim ms</th><th>Kruskal ms</th><th>MST totals agree</th></tr></thead><tbody>
            {mst.map(m => <tr key={m.kind + m.v}><td>{m.kind}</td><td>{m.v}</td><td>{m.e}</td><td>{f(m.primMs)}</td><td>{f(m.kruskalMs)}</td><td>{m.primTotal === m.kruskalTotal ? <span className="pass">yes</span> : <span className="fail">NO</span>}</td></tr>)}</tbody></table></div>
          <p className="muted">Theory: array-based Prim is Θ(V²) regardless of E, so it suits dense graphs. Kruskal is Θ(E log E) (dominated by sorting), so it suits sparse graphs. Compare the ratios when V doubles: Prim should grow ≈4×; Kruskal ≈2–2.5× when E ∝ V and ≈4× or more when E ∝ V².</p></div>
      )}
    </div>
  );
}

// ===== TestsPage.tsx =====

export function TestsPage() {
  const [results, setResults] = useState<TestResult[]>(() => runAllTests());
  const passed = results.filter(r => r.passed).length;
  return (
    <div className="card">
      <div className="toolbar">
        <button className="btn" onClick={() => setResults(runAllTests())}><Play size={16} />Run all tests</button>
        <b className={passed === results.length ? 'pass' : 'fail'}>{passed}/{results.length} passed</b>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 'none' }}><table><thead><tr><th>Result</th><th>Test</th><th>Detail</th></tr></thead><tbody>
        {results.map(r => <tr key={r.name}><td className={r.passed ? 'pass' : 'fail'}>{r.passed ? 'PASS' : 'FAIL'}</td><td style={{ whiteSpace: 'normal' }}>{r.name}</td><td className="muted" style={{ whiteSpace: 'normal' }}>{r.detail}</td></tr>)}
      </tbody></table></div>
    </div>
  );
}
