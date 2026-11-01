export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

/** One flight leg. Stored ONCE in the central routes array (undirected: usable both ways). */
export interface Route {
  flightNo: string;
  from: string;
  to: string;
  distance: number; // km
  fare: number; // INR (simulated)
}

export interface Edge {
  from: string;
  to: string;
  weight: number;
  flightNo?: string;
}

export interface PathResult {
  found: boolean;
  reason?: string;
  path: string[];
  legs: Route[];
  totalFare: number;
  totalDistance: number;
  stops: number;
  steps: string[];
}

export interface MSTResult {
  edges: Edge[];
  total: number;
  components: number; // 1 => spanning tree, >1 => spanning forest
  steps: string[];
}

export interface Activity {
  id: number;
  time: string;
  text: string;
}

export interface AppData {
  airports: Airport[];
  routes: Route[];
  activity: Activity[];
}
