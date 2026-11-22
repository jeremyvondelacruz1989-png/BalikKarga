import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtRange, km, php } from "@/lib/format";
import { truckTypeLabel } from "@/lib/constants";
import { roadKm } from "@/lib/geo";
import { Empty, PageHeader, Pill, Route, StatusBadge } from "@/components/ui";
import { citiesIn, RegionFilter } from "@/components/RegionFilter";

export default async function TripsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireUser();
  const { from, to } = await searchParams;
  const mine = user.role === "TRUCKER";
  const fromCities = citiesIn(from);
  const toCities = citiesIn(to);

  const trips = await db.returnTrip.findMany({
    where: mine
      ? { truckerId: user.id }
      : {
          status: "OPEN",
          availableTo: { gte: new Date() },
          ...(fromCities && { originCity: { in: fromCities } }),
          ...(toCities && { destCity: { in: toCities } }),
        },
    include: { truck: true, trucker: true, _count: { select: { bookings: { where: { status: "PENDING" } } } } },
    orderBy: { availableFrom: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={mine ? "My return trips" : "Trucks heading home"}
        subtitle={
          mine
            ? "Each return trip is a leg your truck would otherwise drive empty."
            : "Trucks that will be empty soon. Open one to request it for your load."
        }
        action={
          mine && (
            <Link href="/trips/new" className="btn-primary">
              + Post a return trip
            </Link>
          )
        }
      />
      {!mine && <RegionFilter from={from} to={to} fromLabel="Truck empty in" toLabel="Heading to" />}
      {trips.length === 0 ? (
        mine ? (
          <Empty href="/trips/new" cta="Post a return trip">
            No return trips yet.
          </Empty>
        ) : (
          <Empty>No open return trips match. Try another region, or post your load and truckers will come to you.</Empty>
        )
      ) : (
        <div className="card divide-y divide-slate-100">
          {trips.map((t) => (
            <Link key={t.id} href={`/trips/${t.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-slate-50">
              <div className="min-w-60 flex-1">
                <Route from={t.originCity} to={t.destCity} />
                <div className="mt-0.5 text-sm text-slate-500">
                  {fmtRange(t.availableFrom, t.availableTo)} · {km(roadKm(t.originCity, t.destCity))} · detour up to {t.maxDetourKm} km
                </div>
              </div>
              <div className="text-sm">
                <div>{truckTypeLabel(t.truck.truckType)}</div>
                <div className="text-slate-500">
                  {t.truck.capacityTons} t · {t.trucker.company ?? t.trucker.name}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {t.truck.franchiseVerified && <Pill tone="green">LTFRB ✓</Pill>}
                {t.askingRate && <Pill tone="brand">Asks {php(t.askingRate)}</Pill>}
                {mine && t._count.bookings > 0 && <Pill tone="amber">{t._count.bookings} request(s)</Pill>}
                <StatusBadge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
