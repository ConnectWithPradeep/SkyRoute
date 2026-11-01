import { useCallback, useEffect, useRef, useState } from 'react';
import type { Airport, AppData, Route } from './types';
import { DEMO_AIRPORTS, DEMO_ROUTES } from './data';
import { removeAirport, validateAirport, validateRoute, type Validation } from './algorithms';

const KEY = 'skyroute.airline.v1';

function demo(): AppData {
  return {
    airports: DEMO_AIRPORTS.map(a => ({ ...a })),
    routes: DEMO_ROUTES.map(r => ({ ...r })),
    activity: [{ id: 1, time: new Date().toISOString(), text: 'Loaded demo data (15 airports, simulated flights)' }],
  };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return demo();
    const p = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(p.airports) || !Array.isArray(p.routes)) return demo();
    const codes = new Set(p.airports.map(a => a.code));
    // Drop any route that references a missing airport so stored data can never become inconsistent.
    const routes = p.routes.filter(r => codes.has(r.from) && codes.has(r.to));
    return { airports: p.airports, routes, activity: Array.isArray(p.activity) ? p.activity : [] };
  } catch {
    return demo();
  }
}

export function useAirlineData() {
  const [data, setData] = useState<AppData>(load);
  const ref = useRef(data);
  ref.current = data;

  // Persist whatever the latest committed state is (never a stale closure).
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full/blocked: app still works in memory */ }
  }, [data]);

  const commit = useCallback((next: Omit<AppData, 'activity'>, text: string) => {
    const cur = ref.current;
    const entry = { id: Date.now() + Math.floor(Math.random() * 1000), time: new Date().toISOString(), text };
    setData({ ...next, activity: [entry, ...cur.activity].slice(0, 30) });
  }, []);

  const addAirport = useCallback((a: Airport): Validation => {
    const cur = ref.current;
    const clean = { ...a, code: a.code.trim().toUpperCase(), name: a.name.trim(), city: a.city.trim(), country: a.country.trim() };
    const v = validateAirport(clean, cur.airports);
    if (v.ok) commit({ airports: [...cur.airports, clean], routes: cur.routes }, `Added airport ${clean.code}`);
    return v;
  }, [commit]);

  const editAirport = useCallback((oldCode: string, a: Airport): Validation => {
    const cur = ref.current;
    const clean = { ...a, code: a.code.trim().toUpperCase(), name: a.name.trim(), city: a.city.trim(), country: a.country.trim() };
    const v = validateAirport(clean, cur.airports, oldCode);
    if (!v.ok) return v;
    const routes = cur.routes.map(r => ({ ...r, from: r.from === oldCode ? clean.code : r.from, to: r.to === oldCode ? clean.code : r.to }));
    commit({ airports: cur.airports.map(x => (x.code === oldCode ? clean : x)), routes }, `Edited airport ${oldCode}${oldCode !== clean.code ? ' → ' + clean.code : ''}`);
    return v;
  }, [commit]);

  const deleteAirport = useCallback((code: string): number => {
    const cur = ref.current;
    const r = removeAirport(cur.airports, cur.routes, code);
    commit({ airports: r.airports, routes: r.routes }, `Deleted airport ${code} and ${r.removedRoutes} connected flight(s)`);
    return r.removedRoutes;
  }, [commit]);

  const addRoute = useCallback((r: Route): Validation => {
    const cur = ref.current;
    const clean = { ...r, flightNo: r.flightNo.trim().toUpperCase() };
    const v = validateRoute(clean, cur.airports, cur.routes);
    if (v.ok) commit({ airports: cur.airports, routes: [...cur.routes, clean] }, `Added flight ${clean.flightNo} (${clean.from}–${clean.to})`);
    return v;
  }, [commit]);

  const editRoute = useCallback((oldNo: string, r: Route): Validation => {
    const cur = ref.current;
    const clean = { ...r, flightNo: r.flightNo.trim().toUpperCase() };
    const v = validateRoute(clean, cur.airports, cur.routes, oldNo);
    if (v.ok) commit({ airports: cur.airports, routes: cur.routes.map(x => (x.flightNo === oldNo ? clean : x)) }, `Edited flight ${oldNo}`);
    return v;
  }, [commit]);

  const deleteRoute = useCallback((no: string) => {
    const cur = ref.current;
    commit({ airports: cur.airports, routes: cur.routes.filter(r => r.flightNo !== no) }, `Deleted flight ${no}`);
  }, [commit]);

  const resetDemo = useCallback(() => { setData(demo()); }, []);

  return { data, addAirport, editAirport, deleteAirport, addRoute, editRoute, deleteRoute, resetDemo };
}
export type AirlineStore = ReturnType<typeof useAirlineData>;
