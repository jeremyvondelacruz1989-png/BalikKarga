import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { TRUCK_TYPES, type TruckType } from "@/lib/constants";
import { renderLanding } from "@/lib/landing";

export const dynamic = "force-dynamic";

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** The public landing page. Signed-in users go straight to their dashboard. */
export async function GET() {
  if (await getCurrentUser()) redirect("/dashboard");

  const [openTrips, openLoads, delivered] = await Promise.all([
    db.returnTrip.findMany({
      where: { status: "OPEN" },
      include: { truck: true, trucker: true },
      orderBy: { availableFrom: "asc" },
      take: 6,
    }),
    db.load.count({ where: { status: "OPEN" } }),
    db.booking.aggregate({ where: { status: "DELIVERED" }, _sum: { loadedKm: true }, _count: true }),
  ]);

  const html = renderLanding({
    trips: openTrips.map((t) => {
      const company = t.trucker.company || t.trucker.name;
      return {
        company,
        initials: initials(company),
        origin: t.originCity,
        dest: t.destCity,
        truckLabel: TRUCK_TYPES[t.truck.truckType as TruckType]?.label ?? t.truck.truckType,
        from: t.availableFrom,
      };
    }),
    openLoads,
    delivered: delivered._count,
    loadedKm: delivered._sum.loadedKm ?? 0,
    now: new Date(),
  });

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
