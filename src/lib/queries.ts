import type { Load, ReturnTrip, Truck, User } from "@prisma/client";
import { db } from "./db";
import { rankMatches } from "./matching";
import { scoreMatch } from "./matching";

type TripWithTruck = ReturnTrip & { truck: Truck; trucker: User };
type LoadWithShipper = Load & { shipper: User };

/** Open return trips that could carry this load, best first. */
export async function matchesForLoad(load: Load, limit = 20) {
  const trips = await db.returnTrip.findMany({
    where: {
      status: "OPEN",
      availableTo: { gte: load.pickupDate },
      availableFrom: { lte: load.deliverBy },
      truck: { capacityTons: { gte: load.weightTons }, active: true },
      truckerId: { not: load.shipperId },
    },
    include: { truck: true, trucker: true },
  });
  return rankMatches<TripWithTruck>(trips, (t) => scoreMatch(t, load))
    .filter((m) => m.match.eligible)
    .slice(0, limit);
}

/** Open loads along this return trip, best first. */
export async function matchesForTrip(trip: ReturnTrip & { truck: Truck }, limit = 20) {
  const loads = await db.load.findMany({
    where: {
      status: "OPEN",
      pickupDate: { lte: trip.availableTo },
      deliverBy: { gte: trip.availableFrom },
      weightTons: { lte: trip.truck.capacityTons },
      shipperId: { not: trip.truckerId },
    },
    include: { shipper: true },
  });
  return rankMatches<LoadWithShipper>(loads, (l) => scoreMatch(trip, l))
    .filter((m) => m.match.eligible)
    .slice(0, limit);
}

export async function truckerRating(truckerId: string) {
  const r = await db.booking.aggregate({ where: { truckerId, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } });
  return { avg: r._avg.rating, count: r._count.rating };
}
