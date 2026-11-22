import type { Load, ReturnTrip, SavedLane, Truck } from "@prisma/client";
import { db } from "./db";
import { scoreMatch, type LoadInput, type TripInput } from "./matching";
import { notify } from "./notify";

/** Treat a trucker's saved lane as a return trip with the load's own dates. */
export function laneAsTrip(lane: SavedLane & { truck: Truck }, load: Pick<Load, "pickupDate" | "deliverBy">): TripInput {
  return {
    originCity: lane.originCity,
    destCity: lane.destCity,
    availableFrom: load.pickupDate,
    availableTo: load.deliverBy,
    maxDetourKm: lane.maxDetourKm,
    askingRate: null,
    truck: lane.truck,
  };
}

/** Treat a shipper's saved lane as a typical load in the trip's date window. */
export function laneAsLoad(lane: SavedLane, trip: Pick<ReturnTrip, "availableFrom" | "availableTo">): LoadInput {
  return {
    cargoType: "GENERAL",
    weightTons: lane.weightTons ?? 1,
    truckType: null,
    pickupCity: lane.originCity,
    dropCity: lane.destCity,
    pickupDate: trip.availableFrom,
    deliverBy: trip.availableTo,
    budget: null,
  };
}

/** After a load is posted: alert truckers whose saved lanes it fits. Returns how many were alerted. */
export async function alertLanesForLoad(load: Load): Promise<number> {
  const lanes = await db.savedLane.findMany({
    where: { active: true, truckId: { not: null }, userId: { not: load.shipperId } },
    include: { truck: true },
  });
  const alerted = new Set<string>();
  for (const lane of lanes) {
    if (!lane.truck || !lane.truck.active || alerted.has(lane.userId)) continue;
    const m = scoreMatch(laneAsTrip({ ...lane, truck: lane.truck }, load), load);
    if (!m.eligible) continue;
    alerted.add(lane.userId);
    await notify(
      lane.userId,
      `New load on your ${lane.originCity}→${lane.destCity} lane: ${load.title}, ${load.weightTons}t, ${load.pickupCity}→${load.dropCity}`,
      `/loads/${load.id}`,
    );
  }
  return alerted.size;
}

/** After a return trip is posted: alert shippers whose saved lanes it can carry. */
export async function alertLanesForTrip(trip: ReturnTrip & { truck: Truck }): Promise<number> {
  const lanes = await db.savedLane.findMany({ where: { active: true, truckId: null, userId: { not: trip.truckerId } } });
  const alerted = new Set<string>();
  for (const lane of lanes) {
    if (alerted.has(lane.userId)) continue;
    const m = scoreMatch(trip, laneAsLoad(lane, trip));
    if (!m.eligible) continue;
    alerted.add(lane.userId);
    await notify(
      lane.userId,
      `Truck heading your way: empty at ${trip.originCity}, going to ${trip.destCity} (${trip.truck.capacityTons}t). Fits your ${lane.originCity}→${lane.destCity} lane.`,
      `/trips/${trip.id}`,
    );
  }
  return alerted.size;
}
