// Backhaul matching: scores how well a shipper's load fits a trucker's empty return leg.
// Pure functions only, so it is easy to unit test and to move into a worker later.

import { BACKHAUL_DISCOUNT, TRUCK_TYPES, type TruckType } from "./constants";
import { needsRoro, roadKm } from "./geo";

export interface TripInput {
  originCity: string;
  destCity: string;
  availableFrom: Date;
  availableTo: Date;
  maxDetourKm: number;
  askingRate: number | null;
  truck: { truckType: string; capacityTons: number };
}

export interface LoadInput {
  cargoType: string;
  weightTons: number;
  truckType: string | null;
  pickupCity: string;
  dropCity: string;
  pickupDate: Date;
  deliverBy: Date;
  budget: number | null;
}

export interface MatchResult {
  eligible: boolean;
  score: number; // 0-100, higher is better
  reasons: string[]; // why it fits or doesn't, shown to users
  detourKm: number; // extra km the truck drives vs. going straight home
  loadedKm: number; // pickup -> drop distance (empty km that become paid km)
  roroCrossings: number;
  marketRate: number; // regular one-way rate estimate
  suggestedRate: number; // backhaul rate we suggest
}

const DAY = 24 * 60 * 60 * 1000;

function rateFor(truckType: string) {
  return (TRUCK_TYPES as Record<string, (typeof TRUCK_TYPES)[TruckType]>)[truckType] ?? TRUCK_TYPES.SIX_WHEELER;
}

/** Regular (non-backhaul) one-way market rate estimate for a loaded trip. */
export function marketRate(truckType: string, loadedKm: number, roroCrossings = 0): number {
  const r = rateFor(truckType);
  const base = Math.max(r.minFare, r.ratePerKm * loadedKm);
  return roundTo(base + roroCrossings * r.roroFee, 100);
}

/** Suggested backhaul price: a discount on the market rate, but RoRo fees are passed through in full. */
export function suggestedBackhaulRate(truckType: string, loadedKm: number, roroCrossings = 0): number {
  const r = rateFor(truckType);
  const base = Math.max(r.minFare, r.ratePerKm * loadedKm) * BACKHAUL_DISCOUNT;
  return roundTo(base + roroCrossings * r.roroFee, 100);
}

function roundTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

function truckTypeCompatible(required: string | null, cargoType: string, actual: string): boolean {
  if (cargoType === "COLD_CHAIN" && actual !== "REEFER") return false;
  if (!required) return true;
  if (required === actual) return true;
  // A wing van can carry anything a closed 6-wheeler can; a trailer can stand in for a 10W flatbed.
  if (required === "SIX_WHEELER" && (actual === "WING_VAN_6W" || actual === "WING_VAN_10W")) return true;
  if (required === "FLATBED_10W" && actual === "TRAILER") return true;
  return false;
}

export function scoreMatch(trip: TripInput, load: LoadInput): MatchResult {
  const reasons: string[] = [];
  let eligible = true;

  // --- Geography ---------------------------------------------------------
  const direct = roadKm(trip.originCity, trip.destCity);
  const toPickup = roadKm(trip.originCity, load.pickupCity);
  const loadedKm = roadKm(load.pickupCity, load.dropCity);
  const dropToHome = roadKm(load.dropCity, trip.destCity);
  const detourKm = Math.max(0, toPickup + loadedKm + dropToHome - direct);

  const legs: [string, string][] = [
    [trip.originCity, load.pickupCity],
    [load.pickupCity, load.dropCity],
    [load.dropCity, trip.destCity],
  ];
  const roroCrossings = legs.filter(([a, b]) => needsRoro(a, b)).length;
  const directRoro = needsRoro(trip.originCity, trip.destCity) ? 1 : 0;
  const extraRoro = Math.max(0, roroCrossings - directRoro);
  // Only the crossing the shipper's cargo itself makes is charged to the load.
  const loadRoro = needsRoro(load.pickupCity, load.dropCity) ? 1 : 0;

  if (detourKm > trip.maxDetourKm) {
    eligible = false;
    reasons.push(`Detour of ${detourKm} km is over the trucker's limit of ${trip.maxDetourKm} km`);
  } else {
    reasons.push(detourKm <= 10 ? "Right on the way home" : `Only ${detourKm} km off the way home`);
  }
  if (extraRoro > 0) reasons.push(`Adds ${extraRoro} extra RoRo crossing${extraRoro > 1 ? "s" : ""}`);

  // --- Truck -------------------------------------------------------------
  if (load.weightTons > trip.truck.capacityTons) {
    eligible = false;
    reasons.push(`Load is ${load.weightTons} t but truck carries ${trip.truck.capacityTons} t`);
  }
  if (!truckTypeCompatible(load.truckType, load.cargoType, trip.truck.truckType)) {
    eligible = false;
    reasons.push(load.cargoType === "COLD_CHAIN" ? "Cold chain cargo needs a reefer van" : "Truck type doesn't match");
  }
  const utilization = Math.min(1, load.weightTons / trip.truck.capacityTons);

  // --- Timing ------------------------------------------------------------
  const earliest = Math.max(trip.availableFrom.getTime(), load.pickupDate.getTime());
  const latest = Math.min(trip.availableTo.getTime(), load.deliverBy.getTime());
  if (earliest > latest) {
    eligible = false;
    reasons.push("Dates don't overlap");
  } else {
    const slackDays = (latest - earliest) / DAY;
    if (slackDays < 0.5) reasons.push("Tight timing window");
  }

  // --- Price -------------------------------------------------------------
  const market = marketRate(trip.truck.truckType, loadedKm, loadRoro);
  const suggested = suggestedBackhaulRate(trip.truck.truckType, loadedKm, loadRoro);
  const ask = trip.askingRate ?? suggested;
  let pricePenalty = 0;
  if (load.budget != null) {
    if (load.budget >= ask) reasons.push("Budget covers the asking rate");
    else {
      const gap = (ask - load.budget) / ask;
      pricePenalty = Math.min(25, gap * 50);
      reasons.push(`Budget is ${Math.round(gap * 100)}% below asking rate`);
    }
  }
  if (market > 0) reasons.push(`Shipper saves ~${Math.round((1 - ask / market) * 100)}% vs. a regular trip`);

  // --- Score -------------------------------------------------------------
  const detourPenalty = trip.maxDetourKm > 0 ? Math.min(40, (detourKm / trip.maxDetourKm) * 40) : detourKm > 0 ? 40 : 0;
  const utilPenalty = (1 - utilization) * 15;
  const roroPenalty = extraRoro * 10;
  const score = eligible
    ? Math.max(0, Math.min(100, Math.round(100 - detourPenalty - utilPenalty - pricePenalty - roroPenalty)))
    : 0;

  return {
    eligible,
    score,
    reasons,
    detourKm,
    loadedKm,
    roroCrossings: loadRoro,
    marketRate: market,
    suggestedRate: suggested,
  };
}

/** Rank many candidates; eligible matches first, best score first. */
export function rankMatches<T>(items: T[], score: (item: T) => MatchResult): { item: T; match: MatchResult }[] {
  return items
    .map((item) => ({ item, match: score(item) }))
    .sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score);
}
