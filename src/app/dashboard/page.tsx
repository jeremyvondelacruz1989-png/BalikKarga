import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, km, php } from "@/lib/format";
import { matchesForLoad, matchesForTrip } from "@/lib/queries";
import { KG_CO2_PER_KM } from "@/lib/constants";
import { Empty, PageHeader, Route, ScoreRing, Stat, VerifiedBadge } from "@/components/ui";
import { markNotificationsRead, toggleSms } from "../actions";

export default async function Dashboard() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Magandang araw, ${user.name.split(" ")[0]}!`}
        subtitle={user.company ?? undefined}
        action={user.role !== "ADMIN" ? <VerifiedBadge verified={user.verified} /> : undefined}
      />
      {user.role === "SHIPPER" && <ShipperHome userId={user.id} />}
      {user.role === "TRUCKER" && <TruckerHome userId={user.id} />}
      {user.role === "ADMIN" && <AdminHome />}

      <section id="inbox" className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Notifications</h2>
          <div className="flex items-center gap-4">
            <form action={toggleSms}>
              <button className="text-xs font-semibold text-slate-600 hover:text-ink">
                SMS alerts: {user.smsEnabled ? "On" : "Off"} ({user.phone ?? "no number"}) · {user.smsEnabled ? "Turn off" : "Turn on"}
              </button>
            </form>
            {notifications.some((n) => !n.read) && (
              <form action={markNotificationsRead}>
                <button className="text-xs font-semibold text-brand-700">Mark all read</button>
              </form>
            )}
          </div>
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet. Important updates are also sent to you by SMS.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-200" : "bg-brand-500"}`} />
                <div className="flex-1">
                  {n.href ? (
                    <Link href={n.href} className="hover:underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function ShipperHome({ userId }: { userId: string }) {
  const [openLoads, active, delivered] = await Promise.all([
    db.load.findMany({ where: { shipperId: userId, status: "OPEN" }, orderBy: { pickupDate: "asc" } }),
    db.booking.count({ where: { shipperId: userId, status: { in: ["PENDING", "ACCEPTED", "IN_TRANSIT"] } } }),
    db.booking.findMany({ where: { shipperId: userId, status: "DELIVERED" }, include: { trip: { include: { truck: true } } } }),
  ]);
  const spent = delivered.reduce((s, b) => s + b.agreedRate, 0);
  const top = await Promise.all(openLoads.slice(0, 4).map(async (l) => ({ load: l, best: (await matchesForLoad(l, 1))[0] })));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open loads" value={openLoads.length} />
        <Stat label="Active bookings" value={active} />
        <Stat label="Spent on backhauls" value={php(spent)} hint={`${delivered.length} delivered`} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Best return trucks for your open loads</h2>
          <Link href="/loads/new" className="btn-primary">
            + Post a load
          </Link>
        </div>
        {top.length === 0 ? (
          <Empty href="/loads/new" cta="Post your first load">
            Post a load and we&apos;ll find trucks already heading that way.
          </Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {top.map(({ load, best }) => (
              <Link key={load.id} href={`/loads/${load.id}`} className="card block p-4 hover:border-brand-500">
                <div className="text-sm text-slate-500">{load.title}</div>
                <Route from={load.pickupCity} to={load.dropCity} />
                {best ? (
                  <div className="mt-3 flex items-center gap-3 rounded-md bg-slate-50 p-3 text-sm">
                    <ScoreRing score={best.match.score} />
                    <div>
                      <div>
                        {best.item.trucker.company ?? best.item.trucker.name} · empty at {best.item.originCity} → home{" "}
                        {best.item.destCity}
                      </div>
                      <div className="text-slate-500">
                        Suggested {php(best.match.suggestedRate)} vs. {php(best.match.marketRate)} regular
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No matching return trips yet. We&apos;ll notify you.</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

async function TruckerHome({ userId }: { userId: string }) {
  const [me, trucks, openTrips, active, delivered] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } }),
    db.truck.count({ where: { ownerId: userId } }),
    db.returnTrip.findMany({ where: { truckerId: userId, status: "OPEN" }, include: { truck: true }, orderBy: { availableFrom: "asc" } }),
    db.booking.count({ where: { truckerId: userId, status: { in: ["PENDING", "ACCEPTED", "IN_TRANSIT"] } } }),
    db.booking.findMany({ where: { truckerId: userId, status: "DELIVERED" } }),
  ]);
  const earned = delivered.reduce((s, b) => s + b.agreedRate, 0);
  const filled = delivered.reduce((s, b) => s + (b.loadedKm ?? 0), 0);
  const top = await Promise.all(openTrips.slice(0, 4).map(async (t) => ({ trip: t, matches: await matchesForTrip(t, 3) })));

  if (trucks === 0)
    return (
      <Empty href="/trucks" cta="Add your truck">
        Add a truck first. You&apos;ll need its plate number and LTFRB franchise number.
      </Empty>
    );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Link href="/credits" className="block">
          <Stat label="Credits" value={php(me.creditBalance)} hint={me.creditBalance < 150 ? "Top up to accept bookings →" : "Top up →"} />
        </Link>
        <Stat label="Open return trips" value={openTrips.length} />
        <Stat label="Active bookings" value={active} />
        <Stat label="Backhaul earnings" value={php(earned)} hint={`${km(filled)} that would have been empty`} />
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Loads on your way home</h2>
          <Link href="/trips/new" className="btn-primary">
            + Post a return trip
          </Link>
        </div>
        {top.length === 0 ? (
          <Empty href="/trips/new" cta="Post a return trip">
            Tell us where your truck will be empty and where it&apos;s heading. We&apos;ll find loads along the way.
          </Empty>
        ) : (
          <div className="space-y-4">
            {top.map(({ trip, matches }) => (
              <div key={trip.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Route from={trip.originCity} to={trip.destCity} />
                    <span className="ml-2 text-sm text-slate-500">
                      {trip.truck.plateNumber} · {fmtDate(trip.availableFrom)}
                    </span>
                  </div>
                  <Link href={`/trips/${trip.id}`} className="text-sm font-semibold text-brand-700">
                    All matches →
                  </Link>
                </div>
                {matches.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No loads on this route yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {matches.map(({ item, match }) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                        <ScoreRing score={match.score} />
                        <div className="flex-1">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-slate-500">
                            {item.pickupCity} → {item.dropCity} · {item.weightTons} t · +{match.detourKm} km detour
                          </div>
                        </div>
                        <div className="text-right font-semibold">{php(item.budget ?? match.suggestedRate)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

async function AdminHome() {
  const [fees, bonuses, pendingTopups, pendingDocs, users, unverifiedUsers, unverifiedTrucks, openLoads, openTrips, delivered] = await Promise.all([
    db.creditTransaction.aggregate({ where: { status: "APPROVED", type: { in: ["BOOKING_FEE", "REFUND"] } }, _sum: { amount: true } }),
    db.creditTransaction.aggregate({ where: { type: "SIGNUP_BONUS" }, _sum: { amount: true }, _count: true }),
    db.creditTransaction.count({ where: { type: "TOPUP", status: "PENDING" } }),
    db.verificationDocument.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { role: { not: "ADMIN" } } }),
    db.user.count({ where: { verified: false, role: { not: "ADMIN" } } }),
    db.truck.count({ where: { franchiseVerified: false } }),
    db.load.count({ where: { status: "OPEN" } }),
    db.returnTrip.count({ where: { status: "OPEN" } }),
    db.booking.findMany({ where: { status: "DELIVERED" } }),
  ]);
  const gmv = delivered.reduce((s, b) => s + b.agreedRate, 0);
  const filled = delivered.reduce((s, b) => s + (b.loadedKm ?? 0), 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat
          label="Users"
          value={users}
          hint={`${unverifiedUsers} awaiting verification · ${bonuses._count} welcome bonuses (${php(bonuses._sum.amount ?? 0)})`}
        />
        <Stat label="Open loads / trips" value={`${openLoads} / ${openTrips}`} />
        <Stat label="GMV delivered" value={php(gmv)} hint={`Booking fees earned: ${php(-(fees._sum.amount ?? 0))}`} />
        <Stat label="Empty km filled" value={km(filled)} hint={`≈ ${Math.round(filled * KG_CO2_PER_KM).toLocaleString()} kg CO₂ avoided`} />
      </div>
      {(pendingTopups > 0 || pendingDocs > 0 || unverifiedUsers > 0 || unverifiedTrucks > 0) && (
        <Link href="/admin" className="card block border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          To review: {pendingTopups} top-up(s), {pendingDocs} document(s), {unverifiedUsers} unverified user(s),{" "}
          {unverifiedTrucks} unverified truck franchise(s) →
        </Link>
      )}
    </>
  );
}
