import { useEffect, useRef, type ReactNode } from 'react';
import L from 'leaflet';
import type { Airport, Route } from './types';
import type { BNode } from './algorithms';

// ===== Stat.tsx =====
export function Stat({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="card stat">
      <div className="ico">{icon}</div>
      <div><div className="num">{value}</div><div className="lbl">{label}</div></div>
    </div>
  );
}

// ===== TreeView.tsx =====

export interface VNode { id: string; label: string; sub?: string; children: VNode[]; }

interface Pos { node: VNode; x: number; y: number; }
const DX = 74, DY = 78, R = 22, PAD = 40;

/** Leaf-slot layout: leaves take consecutive x slots, parents are centred above their children. */
function layout(root: VNode): { pos: Pos[]; links: Array<[Pos, Pos]>; w: number; h: number } {
  let slot = 0, maxDepth = 0;
  const pos: Pos[] = [], links: Array<[Pos, Pos]> = [];
  const walk = (n: VNode, d: number): Pos => {
    maxDepth = Math.max(maxDepth, d);
    const kids = n.children.map(c => walk(c, d + 1));
    const x = kids.length ? (kids[0].x + kids[kids.length - 1].x) / 2 : PAD + slot++ * DX;
    const p: Pos = { node: n, x, y: PAD + d * DY };
    pos.push(p);
    kids.forEach(k => links.push([p, k]));
    return p;
  };
  walk(root, 0);
  return { pos, links, w: Math.max(PAD * 2 + (slot - 1) * DX, 200), h: PAD * 2 + maxDepth * DY };
}

interface TreeViewProps { root: VNode | null; highlight?: string[]; empty?: ReactNode; }

/** Draws a real tree: circles for nodes and straight lines from each parent to its children. */
export function TreeView({ root, highlight = [], empty }: TreeViewProps) {
  if (!root) return <div className="empty">{empty ?? 'Tree is empty'}</div>;
  const { pos, links, w, h } = layout(root);
  const hl = new Set(highlight);
  return (
    <div className="tree-scroll">
      <svg width={w} height={h} role="img" aria-label="Tree diagram">
        {links.map(([a, b]) => (
          <line key={a.node.id + '>' + b.node.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={hl.has(a.node.id) && hl.has(b.node.id) ? 'tlink hl' : 'tlink'} />
        ))}
        {pos.map(p => (
          <g key={p.node.id} transform={`translate(${p.x},${p.y})`}>
            <circle r={R} className={hl.has(p.node.id) ? 'tnode hl' : 'tnode'} />
            <text textAnchor="middle" dy="4" className="tlabel">{p.node.label}</text>
            {p.node.sub && <text textAnchor="middle" y={R + 13} className="tsub">{p.node.sub}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function toVisual<K>(n: BNode<K> | null, withBalance: boolean): VNode | null {
  if (!n) return null;
  const hOf = (x: BNode<K> | null) => (x ? x.height : 0);
  const kids = [toVisual(n.left, withBalance), toVisual(n.right, withBalance)].filter((x): x is VNode => x !== null);
  const bf = hOf(n.left) - hOf(n.right);
  return { id: String(n.key), label: String(n.key), sub: withBalance ? `h${n.height} bf${bf >= 0 ? '+' : ''}${bf}` : `h${n.height}`, children: kids };
}

// ===== RouteMap.tsx =====

interface RouteMapProps {
  airports: Airport[];
  routes: Route[];
  path: string[];            // highlighted airport codes in order
  source: string;
  destination: string;
  height?: number;
  onAirportClick: (code: string) => void;
}

/** Leaflet + OpenStreetMap. The map is created once and removed on unmount; layers are redrawn when data changes. */
export function RouteMap({ airports, routes, path, source, destination, height = 420, onAirportClick }: RouteMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onAirportClick);
  clickRef.current = onAirportClick;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView([22.5, 79], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; layer.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const byCode = new Map(airports.map(a => [a.code, a]));
    const onPath = new Set<string>();
    for (let i = 0; i + 1 < path.length; i++) onPath.add([path[i], path[i + 1]].sort().join('|'));
    for (const r of routes) {
      const a = byCode.get(r.from), b = byCode.get(r.to);
      if (!a || !b) continue; // never draw a route whose airport is missing
      const hot = onPath.has([r.from, r.to].sort().join('|'));
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: hot ? '#f59e0b' : '#5b8def', weight: hot ? 5 : 2, opacity: hot ? 0.95 : 0.55 })
        .bindTooltip(`${r.flightNo}: ${r.from}–${r.to} · ${r.distance} km · ₹${r.fare}`, { sticky: true })
        .addTo(g);
    }
    const inPath = new Set(path);
    for (const a of airports) {
      const cls = a.code === source ? 'src' : a.code === destination ? 'dst' : inPath.has(a.code) ? 'on' : '';
      const icon = L.divIcon({ className: '', html: `<div class="ap-marker ${cls}">${a.code}</div>`, iconSize: [36, 24], iconAnchor: [18, 12] });
      const mk = L.marker([a.lat, a.lng], { icon }).addTo(g);
      mk.bindPopup(`<b>${a.code}</b> – ${a.name}<br>${a.city}, ${a.country}<br><small>${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</small>`);
      mk.on('click', () => clickRef.current(a.code));
    }
  }, [airports, routes, path, source, destination]);

  return <div ref={el} className="map" style={{ height }} />;
}
