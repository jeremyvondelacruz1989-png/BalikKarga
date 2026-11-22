import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, km, php } from "@/lib/format";
import { cargoTypeLabel, truckTypeLabel } from "@/lib/constants";
import { roadKm } from "@/lib/geo";
import { Empty, PageHeader, Pill, Route, StatusBadge } from "@/components/ui";
import { citiesIn, RegionFilter } from "@/components/RegionFilter";

export default async function LoadsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireUser();
  const { from, to } = await searchParams;
  const mine = user.role === "SHIPPER";
  const fromCities = citiesIn(from);
  const toCities = citiesIn(to);

  const loads = await db.load.findMany({
    where: mine
      ? { shipperId: user.id }
      : {
          status: "OPEN",
          deliverBy: { gte: new Date() },
          ...(fromCities && { pickupCity: { in: fromCities } }),
          ...(toCities && { dropCity: { in: toCities } }),
        },
    include: { shipper: true, _count: { select: { bookings: { where: { status: "PENDING" } } } } },
    orderBy: { pickupDate: "asc" },
  });

  return (
    <div>
      <PageHeader
        title={mine ? "My loads" : "Open loads"}
        subtitle={
          mine
            ? "Cargo you've posted. Open a load to see trucks already heading that way."
            : "To see only loads on your way home, open one of your return trips."
        }
        action={
          mine ? (
            <Link href="/loads/new" className="btn-primary">
              + Post a load
            </Link>
          ) : (
            <Link href="/trips" className="btn-secondary">
              Match with my trips
            </Link>
          )
        }
      />
      {!mine && <RegionFilter from={from} to={to} fromLabel="Pickup in" toLabel="Deliver to" />}
      {loads.length === 0 ? (
        <Empty href={mine ? "/loads/new" : undefined} cta={mine ? "Post a load" : undefined}>
          {mine ? "No loads yet." : "No open loads match these filters."}
        </Empty>
      ) : (
        <div className="card divide-y divide-slate-100">
          {loads.map((l) => (
            <Link key={l.id} href={`/loads/${l.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-slate-50">
              <div className="min-w-60 flex-1">
                <div className="text-sm text-slate-500">{l.title}</div>
                <Route from={l.pickupCity} to={l.dropCity} />
                <div className="text-sm text-slate-500">
                  {km(roadKm(l.pickupCity, l.dropCity))} · pickup {fmtDate(l.pickupDate)} · deliver by {fmtDate(l.deliverBy)}
                </div>
              </div>
              <div className="text-sm">
                <div>
                  {l.weightTons} t · {cargoTypeLabel(l.cargoType)}
                </div>
                <div className="text-slate-500">{truckTypeLabel(l.truckType)}</div>
              </div>
              <div className="flex items-center gap-2">
                {l.budget && <Pill tone="brand">{php(l.budget)}</Pill>}
                {mine && l._count.bookings > 0 && <Pill tone="amber">{l._count.bookings} pending</Pill>}
                <StatusBadge status={l.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
