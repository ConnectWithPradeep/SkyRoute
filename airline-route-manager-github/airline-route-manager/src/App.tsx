import { useState, type ReactNode } from 'react';
import { LayoutDashboard, MapPin, Plane, Map as MapIcon, Route as RouteIcon, GitBranch, Share2, Calculator, Gauge, FlaskConical, PanelLeftClose, PanelLeftOpen, Menu, RotateCcw, PlaneTakeoff } from 'lucide-react';
import { useAirlineData } from './store';
import { Dashboard, AirportsPage as AirportsPage, FlightsPage, PlannerPage, TreesPage, GraphsPage, ExpressionPage, PerformancePage, TestsPage } from './pages';

type PageId = 'dashboard' | 'airports' | 'flights' | 'map' | 'planner' | 'trees' | 'graphs' | 'expr' | 'perf' | 'tests';
const NAV: Array<{ id: PageId; label: string; icon: ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'airports', label: 'Airports', icon: <MapPin size={18} /> },
  { id: 'flights', label: 'Flights', icon: <Plane size={18} /> },
  { id: 'map', label: 'Route Map', icon: <MapIcon size={18} /> },
  { id: 'planner', label: 'Route Planner', icon: <RouteIcon size={18} /> },
  { id: 'trees', label: 'Trees', icon: <GitBranch size={18} /> },
  { id: 'graphs', label: 'Graph Algorithms', icon: <Share2 size={18} /> },
  { id: 'expr', label: 'Expression Tree', icon: <Calculator size={18} /> },
  { id: 'perf', label: 'Performance', icon: <Gauge size={18} /> },
  { id: 'tests', label: 'Self-Tests', icon: <FlaskConical size={18} /> },
];

type SidebarMode = 'expanded' | 'collapsed' | 'hidden';

export default function App() {
  const store = useAirlineData();
  const [page, setPage] = useState<PageId>('dashboard');
  const [side, setSide] = useState<SidebarMode>('expanded');
  const { data } = store;

  const body = ((): ReactNode => {
    switch (page) {
      case 'dashboard': return <Dashboard data={data} />;
      case 'airports': return <AirportsPage store={store} />;
      case 'flights': return <FlightsPage store={store} />;
      case 'map': return <PlannerPage data={data} variant="map" />;
      case 'planner': return <PlannerPage data={data} variant="planner" />;
      case 'trees': return <TreesPage data={data} />;
      case 'graphs': return <GraphsPage data={data} />;
      case 'expr': return <ExpressionPage />;
      case 'perf': return <PerformancePage />;
      case 'tests': return <TestsPage />;
    }
  })();

  return (
    <div className={`shell side-${side}`}>
      <aside className="sidebar" aria-hidden={side === 'hidden'}>
        <div className="brand"><PlaneTakeoff size={24} /><span className="brand-text">SkyRoute</span></div>
        <nav>
          {NAV.map(n => (
            <button key={n.id} className={'nav-item' + (page === n.id ? ' active' : '')} onClick={() => setPage(n.id)} title={n.label}>
              {n.icon}<span className="nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="nav-item" onClick={() => setSide(side === 'collapsed' ? 'expanded' : 'collapsed')} title="Collapse / expand sidebar">
            {side === 'collapsed' ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span className="nav-label">Collapse</span>
          </button>
          <button className="nav-item" onClick={() => setSide('hidden')} title="Hide sidebar completely">
            <Menu size={18} /><span className="nav-label">Hide sidebar</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSide(side === 'hidden' ? 'expanded' : 'hidden')} aria-label="Toggle sidebar" title="Show / hide sidebar"><Menu size={20} /></button>
          <h1>{NAV.find(n => n.id === page)?.label}</h1>
          <span className="badge">Simulated demo data – not real airline information</span>
          <button className="btn ghost" onClick={() => { if (window.confirm('Reset all airports and flights to the demo data? Your changes will be lost.')) store.resetDemo(); }}>
            <RotateCcw size={16} /> Reset demo data
          </button>
        </header>
        <main className="content">{body}</main>
      </div>
    </div>
  );
}
