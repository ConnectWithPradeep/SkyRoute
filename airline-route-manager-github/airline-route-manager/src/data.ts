import type { Airport, Route } from './types';

// Airport reference-point coordinates (aerodrome locations, not city centres).
export const DEMO_AIRPORTS: Airport[] = [
  { code: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', lat: 28.5562, lng: 77.1 },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India', lat: 19.0896, lng: 72.8656 },
  { code: 'MAA', name: 'Chennai International', city: 'Chennai', country: 'India', lat: 12.9941, lng: 80.1709 },
  { code: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', lat: 13.1986, lng: 77.7066 },
  { code: 'HYD', name: 'Rajiv Gandhi International', city: 'Hyderabad', country: 'India', lat: 17.2403, lng: 78.4294 },
  { code: 'CCU', name: 'Netaji Subhas Chandra Bose International', city: 'Kolkata', country: 'India', lat: 22.6547, lng: 88.4467 },
  { code: 'COK', name: 'Cochin International', city: 'Kochi', country: 'India', lat: 10.152, lng: 76.4019 },
  { code: 'AMD', name: 'Sardar Vallabhbhai Patel International', city: 'Ahmedabad', country: 'India', lat: 23.0772, lng: 72.6347 },
  { code: 'PNQ', name: 'Pune Airport', city: 'Pune', country: 'India', lat: 18.5821, lng: 73.9197 },
  { code: 'GOI', name: 'Goa International (Dabolim)', city: 'Goa', country: 'India', lat: 15.3808, lng: 73.8314 },
  { code: 'JAI', name: 'Jaipur International', city: 'Jaipur', country: 'India', lat: 26.8242, lng: 75.8122 },
  { code: 'LKO', name: 'Chaudhary Charan Singh International', city: 'Lucknow', country: 'India', lat: 26.7606, lng: 80.8893 },
  { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi International', city: 'Guwahati', country: 'India', lat: 26.1061, lng: 91.5859 },
  { code: 'BBI', name: 'Biju Patnaik International', city: 'Bhubaneswar', country: 'India', lat: 20.2444, lng: 85.8178 },
  { code: 'CJB', name: 'Coimbatore International', city: 'Coimbatore', country: 'India', lat: 11.03, lng: 77.0434 },
];

// [from, to, distanceKm] — fares/flight numbers are SIMULATED demo data, not real airline information.
const RAW: Array<[string, string, number]> = [
  ['DEL', 'BOM', 1140], ['DEL', 'JAI', 240], ['DEL', 'LKO', 415], ['DEL', 'AMD', 770],
  ['DEL', 'CCU', 1310], ['DEL', 'HYD', 1250], ['DEL', 'BLR', 1740], ['DEL', 'GAU', 1440],
  ['BOM', 'PNQ', 120], ['BOM', 'GOI', 430], ['BOM', 'AMD', 440], ['BOM', 'HYD', 620],
  ['BOM', 'BLR', 840], ['BOM', 'MAA', 1030], ['BOM', 'COK', 1090], ['BOM', 'JAI', 920],
  ['MAA', 'BLR', 290], ['MAA', 'HYD', 520], ['MAA', 'CCU', 1370], ['MAA', 'COK', 520],
  ['MAA', 'CJB', 380], ['BLR', 'HYD', 500], ['BLR', 'COK', 360], ['BLR', 'GOI', 480],
  ['BLR', 'CJB', 300], ['HYD', 'BBI', 780], ['HYD', 'PNQ', 490], ['CCU', 'GAU', 530],
  ['CCU', 'BBI', 380], ['CCU', 'LKO', 990], ['COK', 'CJB', 150], ['GOI', 'PNQ', 330],
  ['JAI', 'AMD', 530], ['LKO', 'GAU', 1230],
];

export const DEMO_ROUTES: Route[] = RAW.map(([from, to, distance], i) => ({
  flightNo: `SIM${101 + i}`,
  from,
  to,
  distance,
  fare: Math.round((1500 + distance * 3.4) / 50) * 50,
}));
