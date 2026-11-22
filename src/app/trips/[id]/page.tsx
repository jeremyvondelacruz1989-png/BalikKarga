import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtRange, km, php } from "@/lib/format";
import { cargoTypeLabel, truckTypeLabel } from "@/lib/constants";
import { roadKm } from "@/lib/geo";
import { scoreMatch } from "@/lib/matching";
import { matchesForTrip, truckerRating } from "@/lib/queries";
import { OfferForm } from "@/components/OfferForm";
import { MatchFacts } from "@/components/MatchReasons";
import { Empty, Pill, Route, ScoreRing, StatusBadge, VerifiedBadge } from "@/components/ui";
import { cancelListing } from "../../actions";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const trip = await db.returnTrip.findUnique({
    where: { id },
    include: { truck: true, trucker: true, bookings: { include: { load: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!trip) notFound();
  const isOwner = trip.truckerId === user.id;
  if (user.role === "TRUCKER" && !isOwner) notFound();
  const rating = await truckerRating(trip.truckerId);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-sm text-slate-500">Return trip</div>
            <h1 className="text-2xl">
              <Route from={trip.originCity} to={trip.destCity} />
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {fmtRange(trip.availableFrom, trip.availableTo)} · {km(roadKm(trip.originCity, trip.destCity))} home · detour up to{" "}
              {trip.maxDetourKm} km
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={trip.status} />
            {isOwner && trip.status === "OPEN" && (
              <form action={cancelListing}>
                <input type="hidden" name="id" value={trip.id} />
                <input type="hidden" name="kind" value="trip" />
                <button className="btn-danger py-1 text-xs">Cancel trip</button>
              </form>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Truck</dt>
            <dd className="font-medium">
              {trip.truck.plateNumber} · {truckTypeLabel(trip.truck.truckType)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Capacity</dt>
            <dd className="font-medium">{trip.truck.capacityTons} t</dd>
          </div>
          <div>
            <dt className="text-slate-500">Trucker</dt>
            <dd className="flex flex-wrap items-center gap-1 font-medium">
              {trip.trucker.company ?? trip.trucker.name} <VerifiedBadge verified={trip.trucker.verified} />
              {trip.truck.franchiseVerified && <Pill tone="green">LTFRB ✓</Pill>}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Rating</dt>
            <dd className="font-medium">{rating.avg ? `★ ${rating.avg.toFixed(1)} (${rating.count})` : "No ratings yet"}</dd>
          </div>
        </dl>
        {trip.askingRate && <p className="mt-4 text-sm">Asking rate: <b>{php(trip.askingRate)}</b></p>}
        {trip.notes && <p className="mt-2 rounded bg-slate-50 p-3 text-sm text-slate-700">{trip.notes}</p>}
      </div>

      {isOwner && trip.bookings.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Bookings on this trip</h2>
          <div className="card divide-y divide-slate-100">
            {trip.bookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-slate-50">
                <span>
                  {b.load.title} — {b.load.pickupCity} → {b.load.dropCity}
                  <span className="ml-2 text-slate-500">{b.initiatedBy === "SHIPPER" ? "request from shipper" : "your offer"}</span>
                </span>
                <span className="flex items-center gap-3">
                  {php(b.agreedRate)} <StatusBadge status={b.status} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isOwner && trip.status === "OPEN" && <OwnerMatches trip={trip} />}
      {user.role === "SHIPPER" && trip.status === "OPEN" && <ShipperRequest trip={trip} shipperId={user.id} />}
    </div>
  );
}

async function OwnerMatches({ trip }: { trip: Parameters<typeof matchesForTrip>[0] & { askingRate: number | null } }) {
  const matches = await matchesForTrip(trip);
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Loads along your way ({matches.length})</h2>
      {matches.length === 0 ? (
        <Empty>No matching loads yet. We&apos;ll notify you when a shipper requests this trip.</Empty>
      ) : (
        <div className="space-y-3">
          {matches.map(({ item: load, match }) => (
            <div key={load.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-4">
                <ScoreRing score={match.score} />
                <div className="min-w-60 flex-1">
                  <div className="font-semibold">{load.title}</div>
                  <div className="text-sm text-slate-600">
                    <Route from={load.pickupCity} to={load.dropCity} /> · {load.weightTons} t · {cargoTypeLabel(load.cargoType)} · pickup{" "}
                    {fmtDate(load.pickupDate)}, deliver by {fmtDate(load.deliverBy)}
                  </div>
                  <div className="mt-1 text-sm">
                    {load.shipper.company ?? load.shipper.name} <VerifiedBadge verified={load.shipper.verified} />
                    {load.budget && <span className="ml-2">Budget <b>{php(load.budget)}</b></span>}
                  </div>
                  <div className="mt-2">
                    <MatchFacts match={match} />
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <OfferForm
                  loadId={load.id}
                  tripId={trip.id}
                  rate={trip.askingRate ?? load.budget ?? match.suggestedRate}
                  label="Offer to carry"
                    showFee
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function ShipperRequest({
  trip,
  shipperId,
}: {
  trip: Parameters<typeof scoreMatch>[0] & { id: string };
  shipperId: string;
}) {
  const loads = await db.load.findMany({ where: { shipperId, status: "OPEN" }, orderBy: { pickupDate: "asc" } });
  const scored = loads.map((l) => ({ load: l, match: scoreMatch(trip, l) }));
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Request this truck for one of your loads</h2>
      {loads.length === 0 ? (
        <Empty href="/loads/new" cta="Post a load">
          You have no open loads.
        </Empty>
      ) : (
        <div className="space-y-3">
          {scored.map(({ load, match }) => (
            <div key={load.id} className={`card p-4 ${match.eligible ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start gap-4">
                {match.eligible ? <ScoreRing score={match.score} /> : <Pill>Not a fit</Pill>}
                <div className="flex-1">
                  <div className="font-semibold">{load.title}</div>
                  <div className="text-sm text-slate-600">
                    {load.pickupCity} → {load.dropCity} · {load.weightTons} t · {fmtDate(load.pickupDate)}
                  </div>
                  <div className="mt-2">
                    <MatchFacts match={match} />
                  </div>
                </div>
              </div>
              {match.eligible && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <OfferForm
                    loadId={load.id}
                    tripId={trip.id}
                    rate={trip.askingRate ?? load.budget ?? match.suggestedRate}
                    label="Request truck"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
