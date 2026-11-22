import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { km } from "@/lib/format";
import { KG_CO2_PER_KM, SIGNUP_BONUS } from "@/lib/constants";
import { Route } from "@/components/ui";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");

  const [openTrips, openLoads, delivered] = await Promise.all([
    db.returnTrip.findMany({ where: { status: "OPEN" }, include: { truck: true }, orderBy: { availableFrom: "asc" }, take: 5 }),
    db.load.count({ where: { status: "OPEN" } }),
    db.booking.aggregate({ where: { status: "DELIVERED" }, _sum: { loadedKm: true }, _count: true }),
  ]);
  const savedKm = delivered._sum.loadedKm ?? 0;

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Para sa pabalik na trak
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
            Don&apos;t drive home empty.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            BalikKarga matches shippers with trucks already heading back to base. Shippers pay backhaul rates
            (around 40% less than a regular trip), and truckers earn on kilometers they would have driven empty.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup?role=SHIPPER" className="btn-primary px-5 py-2.5">
              I need to ship cargo
            </Link>
            <Link href="/signup?role=TRUCKER" className="btn-secondary px-5 py-2.5">
              I have an empty return trip
            </Link>
          </div>
          {SIGNUP_BONUS > 0 && (
            <p className="mt-4 rounded-md border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-700">
              🎁 Truckers: get <b>₱{SIGNUP_BONUS} free credits</b> once your documents are verified, enough for your first booking fees.
            </p>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Trucks heading home soon</h2>
            <span className="text-xs text-slate-500">{openLoads} open loads waiting</span>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {openTrips.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <Route from={t.originCity} to={t.destCity} />
                <span className="text-slate-500">{t.truck.capacityTons} t</span>
              </li>
            ))}
            {openTrips.length === 0 && <li className="py-4 text-slate-500">No open return trips yet.</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1. Trucker posts the return leg", "Where the truck will be empty, when, and where it's going home."],
          ["2. We match loads along the way", "Scored by detour, dates, capacity, truck type, RoRo crossings and price."],
          ["3. Book, deliver, get rated", "Accept in one tap, track pickup and delivery, and record proof of delivery."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </div>
        ))}
      </section>

      <section className="card flex flex-wrap items-center justify-around gap-6 p-6 text-center">
        <div>
          <div className="text-3xl font-bold">{delivered._count}</div>
          <div className="text-sm text-slate-500">backhauls delivered</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{km(savedKm)}</div>
          <div className="text-sm text-slate-500">empty kilometers filled</div>
        </div>
        <div>
          <div className="text-3xl font-bold">{Math.round((savedKm * KG_CO2_PER_KM) / 1000).toLocaleString()} t</div>
          <div className="text-sm text-slate-500">CO₂ avoided (est.)</div>
        </div>
      </section>
    </div>
  );
}
