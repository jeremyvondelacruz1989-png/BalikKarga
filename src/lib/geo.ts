// Philippine logistics hubs with approximate coordinates.
// `island` is used to detect sea crossings (RoRo) between two points.
// Samar and Leyte share one group because they are linked by the San Juanico Bridge.

export type Island =
  | "Luzon"
  | "Mindoro"
  | "Palawan"
  | "Panay"
  | "Negros"
  | "Cebu"
  | "Bohol"
  | "Samar-Leyte"
  | "Mindanao";

export interface City {
  name: string;
  province: string;
  region: string;
  island: Island;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  // NCR
  { name: "Manila", province: "Metro Manila", region: "NCR", island: "Luzon", lat: 14.5995, lng: 120.9842 },
  { name: "Quezon City", province: "Metro Manila", region: "NCR", island: "Luzon", lat: 14.676, lng: 121.0437 },
  { name: "Valenzuela", province: "Metro Manila", region: "NCR", island: "Luzon", lat: 14.7011, lng: 120.983 },
  { name: "Taguig", province: "Metro Manila", region: "NCR", island: "Luzon", lat: 14.5176, lng: 121.0509 },
  { name: "Navotas", province: "Metro Manila", region: "NCR", island: "Luzon", lat: 14.6667, lng: 120.9417 },
  // CAR
  { name: "Baguio", province: "Benguet", region: "CAR", island: "Luzon", lat: 16.4023, lng: 120.596 },
  { name: "La Trinidad", province: "Benguet", region: "CAR", island: "Luzon", lat: 16.455, lng: 120.587 },
  // Region I
  { name: "Laoag", province: "Ilocos Norte", region: "Ilocos Region", island: "Luzon", lat: 18.196, lng: 120.5927 },
  { name: "Vigan", province: "Ilocos Sur", region: "Ilocos Region", island: "Luzon", lat: 17.5747, lng: 120.3869 },
  { name: "San Fernando (La Union)", province: "La Union", region: "Ilocos Region", island: "Luzon", lat: 16.6159, lng: 120.3166 },
  { name: "Dagupan", province: "Pangasinan", region: "Ilocos Region", island: "Luzon", lat: 16.0433, lng: 120.3333 },
  { name: "Urdaneta", province: "Pangasinan", region: "Ilocos Region", island: "Luzon", lat: 15.9761, lng: 120.5711 },
  // Region II
  { name: "Tuguegarao", province: "Cagayan", region: "Cagayan Valley", island: "Luzon", lat: 17.6132, lng: 121.727 },
  { name: "Cauayan", province: "Isabela", region: "Cagayan Valley", island: "Luzon", lat: 16.9333, lng: 121.7667 },
  { name: "Santiago", province: "Isabela", region: "Cagayan Valley", island: "Luzon", lat: 16.6877, lng: 121.5487 },
  // Region III
  { name: "Cabanatuan", province: "Nueva Ecija", region: "Central Luzon", island: "Luzon", lat: 15.4865, lng: 120.9675 },
  { name: "San Jose (Nueva Ecija)", province: "Nueva Ecija", region: "Central Luzon", island: "Luzon", lat: 15.7893, lng: 120.991 },
  { name: "Tarlac City", province: "Tarlac", region: "Central Luzon", island: "Luzon", lat: 15.4802, lng: 120.5979 },
  { name: "Angeles", province: "Pampanga", region: "Central Luzon", island: "Luzon", lat: 15.145, lng: 120.5887 },
  { name: "San Fernando (Pampanga)", province: "Pampanga", region: "Central Luzon", island: "Luzon", lat: 15.0286, lng: 120.6898 },
  { name: "Subic / Olongapo", province: "Zambales", region: "Central Luzon", island: "Luzon", lat: 14.8292, lng: 120.2828 },
  { name: "Balanga", province: "Bataan", region: "Central Luzon", island: "Luzon", lat: 14.6764, lng: 120.536 },
  { name: "Malolos", province: "Bulacan", region: "Central Luzon", island: "Luzon", lat: 14.8527, lng: 120.816 },
  { name: "Meycauayan", province: "Bulacan", region: "Central Luzon", island: "Luzon", lat: 14.7369, lng: 120.9608 },
  // Region IV-A
  { name: "Calamba", province: "Laguna", region: "CALABARZON", island: "Luzon", lat: 14.2117, lng: 121.1653 },
  { name: "Santa Rosa (Laguna)", province: "Laguna", region: "CALABARZON", island: "Luzon", lat: 14.3122, lng: 121.1114 },
  { name: "Batangas City", province: "Batangas", region: "CALABARZON", island: "Luzon", lat: 13.7565, lng: 121.0583 },
  { name: "Lipa", province: "Batangas", region: "CALABARZON", island: "Luzon", lat: 13.9411, lng: 121.1631 },
  { name: "Lucena", province: "Quezon", region: "CALABARZON", island: "Luzon", lat: 13.9311, lng: 121.617 },
  { name: "Antipolo", province: "Rizal", region: "CALABARZON", island: "Luzon", lat: 14.5864, lng: 121.176 },
  { name: "Dasmariñas", province: "Cavite", region: "CALABARZON", island: "Luzon", lat: 14.3294, lng: 120.9367 },
  // MIMAROPA
  { name: "Calapan", province: "Oriental Mindoro", region: "MIMAROPA", island: "Mindoro", lat: 13.4115, lng: 121.1803 },
  { name: "Puerto Princesa", province: "Palawan", region: "MIMAROPA", island: "Palawan", lat: 9.7392, lng: 118.7353 },
  // Region V
  { name: "Naga", province: "Camarines Sur", region: "Bicol Region", island: "Luzon", lat: 13.6218, lng: 123.1948 },
  { name: "Legazpi", province: "Albay", region: "Bicol Region", island: "Luzon", lat: 13.1391, lng: 123.7438 },
  { name: "Sorsogon City", province: "Sorsogon", region: "Bicol Region", island: "Luzon", lat: 12.9742, lng: 124.0058 },
  { name: "Matnog", province: "Sorsogon", region: "Bicol Region", island: "Luzon", lat: 12.5856, lng: 124.0853 },
  // Region VI
  { name: "Iloilo City", province: "Iloilo", region: "Western Visayas", island: "Panay", lat: 10.7202, lng: 122.5621 },
  { name: "Roxas City", province: "Capiz", region: "Western Visayas", island: "Panay", lat: 11.5853, lng: 122.7511 },
  { name: "Kalibo", province: "Aklan", region: "Western Visayas", island: "Panay", lat: 11.7061, lng: 122.3647 },
  // NIR
  { name: "Bacolod", province: "Negros Occidental", region: "Negros Island Region", island: "Negros", lat: 10.6765, lng: 122.9509 },
  { name: "Dumaguete", province: "Negros Oriental", region: "Negros Island Region", island: "Negros", lat: 9.3068, lng: 123.3054 },
  // Region VII
  { name: "Cebu City", province: "Cebu", region: "Central Visayas", island: "Cebu", lat: 10.3157, lng: 123.8854 },
  { name: "Mandaue", province: "Cebu", region: "Central Visayas", island: "Cebu", lat: 10.3236, lng: 123.9223 },
  { name: "Toledo", province: "Cebu", region: "Central Visayas", island: "Cebu", lat: 10.3773, lng: 123.6386 },
  { name: "Tagbilaran", province: "Bohol", region: "Central Visayas", island: "Bohol", lat: 9.65, lng: 123.85 },
  // Region VIII
  { name: "Tacloban", province: "Leyte", region: "Eastern Visayas", island: "Samar-Leyte", lat: 11.2444, lng: 125.0047 },
  { name: "Ormoc", province: "Leyte", region: "Eastern Visayas", island: "Samar-Leyte", lat: 11.0064, lng: 124.6075 },
  { name: "Catbalogan", province: "Samar", region: "Eastern Visayas", island: "Samar-Leyte", lat: 11.7753, lng: 124.8862 },
  { name: "Allen", province: "Northern Samar", region: "Eastern Visayas", island: "Samar-Leyte", lat: 12.5011, lng: 124.283 },
  // Region IX
  { name: "Zamboanga City", province: "Zamboanga del Sur", region: "Zamboanga Peninsula", island: "Mindanao", lat: 6.9214, lng: 122.079 },
  { name: "Dipolog", province: "Zamboanga del Norte", region: "Zamboanga Peninsula", island: "Mindanao", lat: 8.5872, lng: 123.3409 },
  { name: "Pagadian", province: "Zamboanga del Sur", region: "Zamboanga Peninsula", island: "Mindanao", lat: 7.8257, lng: 123.437 },
  // Region X
  { name: "Cagayan de Oro", province: "Misamis Oriental", region: "Northern Mindanao", island: "Mindanao", lat: 8.4542, lng: 124.6319 },
  { name: "Iligan", province: "Lanao del Norte", region: "Northern Mindanao", island: "Mindanao", lat: 8.228, lng: 124.2452 },
  { name: "Ozamiz", province: "Misamis Occidental", region: "Northern Mindanao", island: "Mindanao", lat: 8.1481, lng: 123.8405 },
  { name: "Malaybalay", province: "Bukidnon", region: "Northern Mindanao", island: "Mindanao", lat: 8.1575, lng: 125.1278 },
  { name: "Valencia (Bukidnon)", province: "Bukidnon", region: "Northern Mindanao", island: "Mindanao", lat: 7.9064, lng: 125.0942 },
  // Region XI
  { name: "Davao City", province: "Davao del Sur", region: "Davao Region", island: "Mindanao", lat: 7.1907, lng: 125.4553 },
  { name: "Tagum", province: "Davao del Norte", region: "Davao Region", island: "Mindanao", lat: 7.4478, lng: 125.8078 },
  { name: "Digos", province: "Davao del Sur", region: "Davao Region", island: "Mindanao", lat: 6.7497, lng: 125.3572 },
  // Region XII
  { name: "General Santos", province: "South Cotabato", region: "SOCCSKSARGEN", island: "Mindanao", lat: 6.1164, lng: 125.1716 },
  { name: "Koronadal", province: "South Cotabato", region: "SOCCSKSARGEN", island: "Mindanao", lat: 6.5031, lng: 124.8469 },
  // BARMM
  { name: "Cotabato City", province: "Maguindanao del Norte", region: "BARMM", island: "Mindanao", lat: 7.2236, lng: 124.2464 },
  // Caraga
  { name: "Butuan", province: "Agusan del Norte", region: "Caraga", island: "Mindanao", lat: 8.9475, lng: 125.5406 },
  { name: "Surigao City", province: "Surigao del Norte", region: "Caraga", island: "Mindanao", lat: 9.7838, lng: 125.4888 },
];

const BY_NAME = new Map(CITIES.map((c) => [c.name, c]));

export function getCity(name: string): City | undefined {
  return BY_NAME.get(name);
}

export function isKnownCity(name: string): boolean {
  return BY_NAME.has(name);
}

/** Road distances in the PH run roughly 1.3–1.4x the straight-line distance. */
export const ROAD_FACTOR = 1.35;

function haversineKm(a: City, b: City): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated road distance in km between two known cities (0 if either is unknown or same). */
export function roadKm(from: string, to: string): number {
  const a = getCity(from);
  const b = getCity(to);
  if (!a || !b || a === b) return 0;
  return Math.round(haversineKm(a, b) * ROAD_FACTOR);
}

/** True when travelling between the two cities needs a RoRo/ferry crossing. */
export function needsRoro(from: string, to: string): boolean {
  const a = getCity(from);
  const b = getCity(to);
  return !!a && !!b && a.island !== b.island;
}

export function cityLabel(name: string): string {
  const c = getCity(name);
  return c ? `${c.name}, ${c.province}` : name;
}
