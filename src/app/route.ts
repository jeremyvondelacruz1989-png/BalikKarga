import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRUCK_TYPES, type TruckType } from "@/lib/constants";
import { renderLanding, TRUCK_BADGE } from "@/lib/landing";

export const dynamic = "force-dynamic";

/** The public landing page. Signed-in users go straight to their dashboard. */
export async function GET() {
  if (await getCurrentUser()) redirect("/dashboard");

  const [openTrips, openLoads, delivered] = await Promise.all([
    db.returnTrip.findMany({
      where: { status: "OPEN" },
      include: { truck: true },
      orderBy: { availableFrom: "asc" },
      take: 6,
    }),
    db.load.count({ where: { status: "OPEN" } }),
    db.booking.aggregate({ where: { status: "DELIVERED" }, _sum: { loadedKm: true }, _count: true }),
  ]);

  const html = renderLanding({
    // The page is public: no company names, people or plates, only the truck class and the route.
    trips: openTrips.map((t) => ({
      badge: TRUCK_BADGE[t.truck.truckType] ?? "TR",
      origin: t.originCity,
      dest: t.destCity,
      truckLabel: TRUCK_TYPES[t.truck.truckType as TruckType]?.label ?? t.truck.truckType,
      from: t.availableFrom,
    })),
    openLoads,
    delivered: delivered._count,
    loadedKm: delivered._sum.loadedKm ?? 0,
    now: new Date(),
  });

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
