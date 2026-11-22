import Link from "next/link";
import { notFound } from "next/navigation";
import type { Load } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtRange, km, php } from "@/lib/format";
import { cargoTypeLabel, truckTypeLabel } from "@/lib/constants";
import { roadKm } from "@/lib/geo";
import { scoreMatch } from "@/lib/matching";
import { matchesForLoad } from "@/lib/queries";
import { OfferForm } from "@/components/OfferForm";
import { MatchFacts } from "@/components/MatchReasons";
import { Empty, Pill, Route, ScoreRing, StatusBadge, VerifiedBadge } from "@/components/ui";
import { cancelListing } from "../../actions";

export default async function LoadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const load = await db.load.findUnique({
    where: { id },
    include: { shipper: true, bookings: { include: { trip: { include: { truck: true } }, trucker: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!load) notFound();
  const isOwner = load.shipperId === user.id;
  if (user.role === "SHIPPER" && !isOwner) notFound();

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-sm text-slate-500">{load.title}</div>
            <h1 className="text-2xl">
              <Route from={load.pickupCity} to={load.dropCity} />
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {km(roadKm(load.pickupCity, load.dropCity))} · pickup {fmtDate(load.pickupDate)} · deliver by {fmtDate(load.deliverBy)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={load.status} />
            {isOwner && load.status === "OPEN" && (
              <form action={cancelListing}>
                <input type="hidden" name="id" value={load.id} />
                <input type="hidden" name="kind" value="load" />
                <button className="btn-danger py-1 text-xs">Cancel load</button>
              </form>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Cargo</dt>
            <dd className="font-medium">
              {load.weightTons} t · {cargoTypeLabel(load.cargoType)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Truck needed</dt>
            <dd className="font-medium">{truckTypeLabel(load.truckType)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Budget</dt>
            <dd className="font-medium">{php(load.budget)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Shipper</dt>
            <dd className="font-medium">
              {load.shipper.company ?? load.shipper.name} <VerifiedBadge verified={load.shipper.verified} />
            </dd>
          </div>
        </dl>
        {load.notes && <p className="mt-4 rounded bg-slate-50 p-3 text-sm text-slate-700">{load.notes}</p>}
      </div>

      {isOwner && load.bookings.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Bookings for this load</h2>
          <div className="card divide-y divide-slate-100">
            {load.bookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-slate-50">
                <span>
                  {b.trucker.company ?? b.trucker.name} · {b.trip.truck.plateNumber}
                  <span className="ml-2 text-slate-500">{b.initiatedBy === "TRUCKER" ? "offer from trucker" : "your request"}</span>
                </span>
                <span className="flex items-center gap-3">
                  {php(b.agreedRate)} <StatusBadge status={b.status} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isOwner && load.status === "OPEN" && <OwnerMatches load={load} />}
      {user.role === "TRUCKER" && load.status === "OPEN" && <TruckerOffer load={load} truckerId={user.id} />}
    </div>
  );
}

async function OwnerMatches({ load }: { load: Load }) {
  const matches = await matchesForLoad(load);
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Trucks already heading this way ({matches.length})</h2>
      {matches.length === 0 ? (
        <Empty>No matching return trips yet. Truckers can still find your load and make an offer, and we&apos;ll notify you.</Empty>
      ) : (
        <div className="space-y-3">
          {matches.map(({ item: trip, match }) => (
            <div key={trip.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-4">
                <ScoreRing score={match.score} />
                <div className="min-w-60 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {trip.trucker.company ?? trip.trucker.name}
                    <VerifiedBadge verified={trip.trucker.verified} />
                    {trip.truck.franchiseVerified && <Pill tone="green">LTFRB ✓</Pill>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {truckTypeLabel(trip.truck.truckType)}, {trip.truck.capacityTons} t · empty at {trip.originCity}, going home to{" "}
                    {trip.destCity} · {fmtRange(trip.availableFrom, trip.availableTo)}
                  </div>
                  <div className="mt-2">
                    <MatchFacts match={match} />
                  </div>
                </div>
                <Link href={`/trips/${trip.id}`} className="text-sm font-semibold text-brand-700">
                  Details
                </Link>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <OfferForm loadId={load.id} tripId={trip.id} rate={trip.askingRate ?? match.suggestedRate} label="Request truck" />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function TruckerOffer({ load, truckerId }: { load: Load; truckerId: string }) {
  const trips = await db.returnTrip.findMany({ where: { truckerId, status: "OPEN" }, include: { truck: true } });
  const scored = trips.map((t) => ({ trip: t, match: scoreMatch(t, load) }));
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Offer one of your return trips</h2>
      {trips.length === 0 ? (
        <Empty href="/trips/new" cta="Post a return trip">
          You need an open return trip to make an offer.
        </Empty>
      ) : (
        <div className="space-y-3">
          {scored.map(({ trip, match }) => (
            <div key={trip.id} className={`card p-4 ${match.eligible ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start gap-4">
                {match.eligible ? <ScoreRing score={match.score} /> : <Pill>Not a fit</Pill>}
                <div className="flex-1">
                  <Route from={trip.originCity} to={trip.destCity} />
                  <div className="text-sm text-slate-600">
                    {trip.truck.plateNumber} · {trip.truck.capacityTons} t · {fmtRange(trip.availableFrom, trip.availableTo)}
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
                    label="Offer to carry"
                    showFee
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
