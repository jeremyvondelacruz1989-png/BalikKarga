import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, php } from "@/lib/format";
import { Empty, PageHeader, Route, StatusBadge } from "@/components/ui";

const GROUPS = [
  { title: "Needs action", statuses: ["PENDING"] },
  { title: "Upcoming & on the road", statuses: ["ACCEPTED", "IN_TRANSIT"] },
  { title: "History", statuses: ["DELIVERED", "DECLINED", "CANCELLED"] },
];

export default async function BookingsPage() {
  const user = await requireUser();
  const where =
    user.role === "ADMIN" ? {} : user.role === "SHIPPER" ? { shipperId: user.id } : { truckerId: user.id };
  const bookings = await db.booking.findMany({
    where,
    include: { load: true, trip: { include: { truck: true } }, shipper: true, trucker: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader title={user.role === "ADMIN" ? "All bookings" : "Bookings"} />
      {bookings.length === 0 && <Empty>No bookings yet. Request a truck or offer on a load to get started.</Empty>}
      {GROUPS.map((g) => {
        const rows = bookings.filter((b) => g.statuses.includes(b.status));
        if (rows.length === 0) return null;
        return (
          <section key={g.title}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.title} ({rows.length})
            </h2>
            <div className="card divide-y divide-slate-100">
              {rows.map((b) => {
                const waitingOnMe =
                  b.status === "PENDING" &&
                  ((b.initiatedBy === "SHIPPER" && b.truckerId === user.id) || (b.initiatedBy === "TRUCKER" && b.shipperId === user.id));
                return (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-4 p-4 hover:bg-slate-50">
                    <div className="min-w-60 flex-1">
                      <div className="text-sm text-slate-500">{b.load.title}</div>
                      <Route from={b.load.pickupCity} to={b.load.dropCity} />
                      <div className="text-sm text-slate-500">
                        {user.role !== "SHIPPER" && `${b.shipper.company ?? b.shipper.name} · `}
                        {user.role !== "TRUCKER" && `${b.trucker.company ?? b.trucker.name} (${b.trip.truck.plateNumber}) · `}
                        pickup {fmtDate(b.load.pickupDate)}
                      </div>
                    </div>
                    {waitingOnMe && <span className="text-xs font-semibold text-brand-700">Your response needed</span>}
                    <span className="font-semibold">{php(b.agreedRate)}</span>
                    <StatusBadge status={b.status} />
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
