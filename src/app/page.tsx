import Link from "next/link";
import { redirect } from "next/navigation";
import { DM_Mono, Funnel_Display, Funnel_Sans } from "next/font/google";
import type { Load, ReturnTrip, Truck } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtRange, km, php } from "@/lib/format";
import { BOOKING_FEE_MIN, BOOKING_FEE_RATE, bookingFee, cargoTypeLabel, SIGNUP_BONUS, truckTypeLabel } from "@/lib/constants";
import { CITIES } from "@/lib/geo";
import { scoreMatch, type MatchResult } from "@/lib/matching";
import { matchesForLoad, matchesForTrip } from "@/lib/queries";
import { IrisMoment } from "@/components/landing/IrisMoment";
import "@/components/landing/landing.css";

// design-taste-frontend · kind software · hero centred · palette: the app's own colours · type Funnel
// rhythm surface-pairs · buttons tonal · close close-type · moment iris-opens (#trust)
// The app's header and footer (layout.tsx) stay; this page only fills <main>.

const display = Funnel_Display({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-lp-display" });
const text = Funnel_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-lp-text" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-lp-mono" });

export const dynamic = "force-dynamic";

const REGION_NAMES = [...new Set(CITIES.map((c) => c.region))];
const REGIONS = REGION_NAMES.length;
const SHIPPER_SIGNUP = "/signup?role=SHIPPER";
const TRUCKER_SIGNUP = "/signup?role=TRUCKER";

type Row = {
  key: string;
  score: number;
  title: string;
  detail: string;
  match: MatchResult;
  verified: boolean;
};

// ---------------------------------------------------------------- data

/** The shipper's view for the hero: the open load with the most trucks heading its way. */
async function heroWindow() {
  const loads = await db.load.findMany({
    where: { status: "OPEN", deliverBy: { gte: new Date() } },
    orderBy: { pickupDate: "asc" },
    take: 20,
  });
  let best: { load: Load; rows: Row[] } | null = null;
  for (const load of loads) {
    const matches = await matchesForLoad(load, 3);
    if (matches.length > (best?.rows.length ?? 0))
      best = {
        load,
        rows: matches.map(({ item, match }) => ({
          key: item.id,
          score: match.score,
          title: truckTypeLabel(item.truck.truckType),
          detail: `${item.truck.capacityTons} t · empty at ${item.originCity}, going home to ${item.destCity}`,
          match,
          verified: item.truck.franchiseVerified,
        })),
      };
  }
  if (best && best.rows.length >= 2) return { ...best, others: loads.filter((l) => l.id !== best!.load.id).slice(0, 3) };

  // No live data yet: the same engine scores a typical Luzon backhaul.
  const day = 864e5;
  const load = {
    cargoType: "FMCG",
    weightTons: 11,
    truckType: null,
    pickupCity: "Lipa",
    dropCity: "Quezon City",
    pickupDate: new Date(Date.now() + day),
    deliverBy: new Date(Date.now() + 3 * day),
    budget: null,
  };
  const trips: [string, string, string, number][] = [
    ["Batangas City", "Valenzuela", "WING_VAN_10W", 15],
    ["Lucena", "Meycauayan", "WING_VAN_10W", 14],
    ["Lipa", "Malolos", "FLATBED_10W", 15],
  ];
  const rows = trips
    .map(([originCity, destCity, truckType, capacityTons], i) => {
    const match = scoreMatch(
      {
        originCity,
        destCity,
        availableFrom: load.pickupDate,
        availableTo: load.deliverBy,
        maxDetourKm: 60,
        askingRate: null,
        truck: { truckType, capacityTons },
      },
      load,
    );
    return {
      key: String(i),
      score: match.score,
      title: truckTypeLabel(truckType),
      detail: `${capacityTons} t · empty at ${originCity}, going home to ${destCity}`,
      match,
      verified: true,
    };
  })
    .filter((r) => r.match.eligible)
    .sort((a, b) => b.score - a.score);
  return { load: { ...load, id: "example", title: "" } as unknown as Load, rows, others: [] as Load[] };
}

/** The trucker's view for the board: open return trips, and the loads along the busiest one. */
async function boardWindow() {
  const trips = await db.returnTrip.findMany({
    where: { status: "OPEN", availableTo: { gte: new Date() } },
    include: { truck: true },
    orderBy: { availableFrom: "asc" },
    take: 6,
  });
  let open: { trip: ReturnTrip & { truck: Truck }; matches: Awaited<ReturnType<typeof matchesForTrip>> } | null = null;
  for (const trip of trips) {
    const matches = await matchesForTrip(trip, 3);
    if (!open || matches.length > open.matches.length) open = { trip, matches };
  }
  const [openLoads, openTrips] = await Promise.all([
    db.load.count({ where: { status: "OPEN" } }),
    db.returnTrip.count({ where: { status: "OPEN" } }),
  ]);
  return { trips, open, openLoads, openTrips };
}

// ---------------------------------------------------------------- page

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  const [hero, board] = await Promise.all([heroWindow(), boardWindow()]);

  return (
    <div className={`lp ${display.variable} ${text.variable} ${mono.variable}`}>
      <Hero hero={hero} />
      <Board board={board} />
      <How />
      <Trust />
      <Fees />
      <Faq />
      <Close />
    </div>
  );
}

// ---------------------------------------------------------------- hero (centred)

function Hero({ hero }: { hero: Awaited<ReturnType<typeof heroWindow>> }) {
  const { load } = hero;
  return (
    <section className="lp-hero flex flex-col pt-12 pb-6 sm:pt-16 sm:pb-10" aria-labelledby="lp-h1">
      <div className="lp-wrap flex flex-1 flex-col">
        <div className="mx-auto flex max-w-[880px] flex-col items-center text-center" data-enter>
          <p className="rounded-full border border-[var(--p-line)] bg-white px-3 py-1 text-[14px] text-[var(--p-muted)]">
            {CITIES.length} cities across all {REGIONS} regions
          </p>
          <h1 id="lp-h1" className="lp-display mt-4 max-w-[16ch] text-[clamp(40px,4.4vw+12px,72px)] leading-[1.02] font-medium text-balance">
            Backhaul loads for Philippine trucks
          </h1>
          <p className="lp-body mt-4 max-w-[52ch] text-[18px] leading-[1.55] sm:text-[20px]">
            Truckers post the trip home they would drive empty. Shippers book that truck at a backhaul rate, suggested at
            60% of a regular trip.
          </p>
          <div className="mt-7 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href={SHIPPER_SIGNUP} className="lp-btn lp-btn--primary">
              Post a load <Arrow />
            </Link>
            <Link href={TRUCKER_SIGNUP} className="lp-btn lp-btn--secondary">
              Post a return trip
            </Link>
          </div>
        </div>

        <div className="lp-frame mt-8 min-h-[min(240px,26svh)] flex-[1_1_0] px-3 pt-6 sm:px-8 sm:pt-8">
          <div className="lp-ui mx-auto flex max-w-[880px] overflow-hidden" role="img" aria-label="BalikKarga showing a shipper's load and the trucks already heading its way, each with a fit score and a suggested backhaul rate">
            <div className="hidden w-[208px] shrink-0 border-r border-[var(--p-line)] bg-[var(--p-bg)] p-3 md:block">
              <div className="lp-ui__meta mb-2 font-medium">My loads</div>
              <LoadChip load={load} active />
              {hero.others.map((l) => (
                <LoadChip key={l.id} load={l} />
              ))}
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--p-line)] pb-3">
                <div className="min-w-0">
                  <div className="lp-ui__meta">{cargoTypeLabel(load.cargoType)} · {load.weightTons} t</div>
                  <div className="mt-0.5 text-[15px] font-medium">
                    {load.pickupCity} <span className="text-[var(--p-accent)]">→</span> {load.dropCity}
                  </div>
                </div>
                <div className="lp-ui__meta hidden shrink-0 text-right sm:block">
                  Pickup {fmtDate(load.pickupDate)}
                  <br />
                  Deliver by {fmtDate(load.deliverBy)}
                </div>
              </div>
              <div className="lp-ui__meta mt-3 mb-1 font-medium">Trucks already heading this way ({hero.rows.length})</div>
              <ul>
                {hero.rows.map((r, i) => (
                  <li key={r.key} className="lp-arrive flex items-center gap-3 border-b border-[var(--p-line)] py-2.5 last:border-0">
                    <span className="lp-score text-[13px]" style={{ color: r.score >= 75 ? "#15803d" : "#b45309" }}>
                      {r.score}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium sm:truncate">
                        {r.title}
                        {r.verified && <span className="lp-ui__meta ml-2 font-normal">LTFRB ✓</span>}
                      </div>
                      <div className="lp-ui__meta sm:truncate">{r.detail}</div>
                      <div className="lp-ui__meta">
                        +{km(r.match.detourKm)} detour · suggested <b className="font-medium text-[var(--p-ink)]">{php(r.match.suggestedRate)}</b>, regular{" "}
                        {php(r.match.marketRate)}
                      </div>
                    </div>
                    <span
                      className={`hidden shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium sm:inline ${
                        i === 0 ? "bg-[var(--p-action)] text-white" : "bg-[color-mix(in_oklab,var(--p-ink)_8%,white)]"
                      }`}
                    >
                      Request truck
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadChip({ load, active = false }: { load: Pick<Load, "cargoType" | "pickupCity" | "dropCity" | "weightTons">; active?: boolean }) {
  return (
    <div className={`mb-1 rounded-md px-2 py-1.5 ${active ? "bg-white shadow-[0_0_0_1px_var(--p-line)]" : ""}`}>
      <div className="font-medium sm:truncate">
        {load.pickupCity} → {load.dropCity}
      </div>
      <div className="lp-ui__meta sm:truncate">
        {cargoTypeLabel(load.cargoType)}, {load.weightTons} t
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg className="lp-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- board (app-frame, trucker view)

function Board({ board }: { board: Awaited<ReturnType<typeof boardWindow>> }) {
  const { trips, open } = board;
  return (
    <section id="board" className="lp-section">
      <div className="lp-wrap">
        <h2>
          Return trips open this week. <span className="lp-h-muted">Each one would otherwise run empty.</span>
        </h2>
        <p className="lp-body mt-4 max-w-[60ch] text-[17px] leading-[1.6]">
          {board.openTrips} return trips and {board.openLoads} loads are open right now. A trucker opens a trip and sees
          the loads along the way, best fit first.
        </p>

        <div className="lp-ui mt-10 flex overflow-hidden" role="img" aria-label="BalikKarga showing a trucker's open return trips and the loads along one of them">
          <div className="hidden w-[260px] shrink-0 border-r border-[var(--p-line)] bg-[var(--p-bg)] p-3 md:block">
            <div className="lp-ui__meta mb-2 font-medium">Open return trips</div>
            {trips.map((t) => (
              <div
                key={t.id}
                className={`mb-1 rounded-md px-2.5 py-2 ${open?.trip.id === t.id ? "bg-white shadow-[0_0_0_1px_var(--p-line)]" : ""}`}
              >
                <div className="font-medium sm:truncate">
                  {t.originCity} → {t.destCity}
                </div>
                <div className="lp-ui__meta sm:truncate">
                  {fmtRange(t.availableFrom, t.availableTo)} · {t.truck.capacityTons} t
                </div>
              </div>
            ))}
            {trips.length === 0 && <div className="lp-ui__meta">No open trips yet.</div>}
          </div>
          <div className="min-w-0 flex-1 p-5">
            {open ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--p-line)] pb-4">
                  <div>
                    <div className="lp-ui__meta">Return trip · {truckTypeLabel(open.trip.truck.truckType)}, {open.trip.truck.capacityTons} t</div>
                    <div className="mt-0.5 text-[16px] font-medium">
                      {open.trip.originCity} <span className="text-[var(--p-accent)]">→</span> {open.trip.destCity}
                    </div>
                  </div>
                  <div className="lp-ui__meta text-right">
                    {fmtRange(open.trip.availableFrom, open.trip.availableTo)}
                    <br />
                    Detour up to {open.trip.maxDetourKm} km
                  </div>
                </div>
                <div className="lp-ui__meta mt-4 mb-1 font-medium">Loads along your way ({open.matches.length})</div>
                {open.matches.length === 0 && <div className="lp-ui__meta py-3">No loads on this route yet.</div>}
                <ul>
                  {open.matches.map(({ item, match }, i) => (
                    <li key={item.id} className="flex items-center gap-3 border-b border-[var(--p-line)] py-3 last:border-0">
                      <span className="lp-score text-[13px]" style={{ color: match.score >= 75 ? "#15803d" : "#b45309" }}>
                        {match.score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium sm:truncate">
                          {cargoTypeLabel(item.cargoType)}, {item.weightTons} t
                        </div>
                        <div className="lp-ui__meta sm:truncate">
                          {item.pickupCity} → {item.dropCity} · pickup {fmtDate(item.pickupDate)} · +{km(match.detourKm)} detour
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <div className="font-medium">{php(item.budget ?? match.suggestedRate)}</div>
                        <div className="lp-ui__meta">{item.budget ? "budget" : "suggested"}</div>
                      </div>
                      <span
                        className={`hidden shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium md:inline ${
                          i === 0 ? "bg-[var(--p-action)] text-white" : "bg-[color-mix(in_oklab,var(--p-ink)_8%,white)]"
                        }`}
                      >
                        Offer to carry
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="lp-ui__meta py-6">Return trips appear here as truckers post them.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- how it works (steps: the order is the content)

function How() {
  return (
    <section id="how" className="lp-section lp-section--2m">
      <div className="lp-wrap">
        <h2>How a backhaul gets booked</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} title="Post the trip home" body="Where the truck unloads, where it is going and how far it can turn off the road.">
            <Field label="Truck" value="Wing van, 15 t" wide />
            <Field label="Empty at" value="Batangas City" />
            <Field label="Heading back to" value="Valenzuela" />
            <Field label="Available" value="Tue to Wed" wide />
            <Field label="Max detour" value="60 km" />
          </Step>
          <Step n={2} title="See loads scored" body="Detour, dates, capacity, truck type and ferry crossings set each load's fit.">
            <ScoredLoad score={88} title="FMCG, 11 t" route="Lipa → Quezon City" note="+12 km" />
            <ScoredLoad score={71} title="Construction, 9 t" route="Calamba → Meycauayan" note="+38 km" />
            <div className="hidden sm:block">
              <ScoredLoad score={64} title="Rice and feeds, 14 t" route="Lipa → Malolos" note="+52 km" />
            </div>
          </Step>
          <Step n={3} title="Confirm the booking" body="The other side accepts. Phone numbers appear only after that.">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--p-line)] pb-2">
              <span className="font-medium">Booking confirmed</span>
              <span className="lp-ui__meta">₱6,000</span>
            </div>
            <Field label="Shipper" value="Contact shown" wide />
            <Field label="Trucker" value="Contact shown" />
            <div className="mt-2 rounded-md bg-[var(--p-action)] py-1.5 text-center text-[12px] font-medium text-white">Call shipper</div>
          </Step>
          <Step n={4} title="Deliver with photos" body="Photos of the signed DR and the receiver's name close the booking.">
            <div className="grid grid-cols-2 gap-2">
              <PhotoTile name="signed-dr.jpg" />
              <PhotoTile name="unloaded.jpg" />
            </div>
            <Field label="Received by" value="Name and DR no." />
            <div className="lp-ui__meta">Delivered · proof of delivery saved</div>
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="lp-card flex min-w-0 flex-col p-5">
      <div className="lp-ui mb-5 p-4 sm:min-h-[236px]" role="img" aria-label={`BalikKarga: ${title.toLowerCase()}`}>
        {children}
      </div>
      <div className="lp-mono text-[13px] text-[var(--p-muted)]">0{n}</div>
      <h3 className="mt-1 text-[20px] leading-[1.3] font-medium">{title}</h3>
      <p className="lp-body mt-2 text-[16px] leading-[1.55]">{body}</p>
    </li>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      className={`mb-2 items-center justify-between gap-3 border-b border-[var(--p-line)] pb-2 last:mb-0 last:border-0 last:pb-0 ${
        wide ? "hidden sm:flex" : "flex"
      }`}
    >
      <span className="lp-ui__meta">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ScoredLoad({ score, title, route, note }: { score: number; title: string; route: string; note: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[var(--p-line)] py-2 first:pt-0 last:border-0 last:pb-0">
      <span className="lp-score h-8! w-8! text-[12px]" style={{ color: score >= 75 ? "#15803d" : "#b45309" }}>
        {score}
      </span>
      <div className="min-w-0">
        <div className="font-medium sm:truncate">{title}</div>
        <div className="lp-ui__meta sm:truncate">
          {route} · {note}
        </div>
      </div>
    </div>
  );
}

function PhotoTile({ name }: { name: string }) {
  return (
    <div className="mb-3 flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border border-[var(--p-line)] bg-[var(--p-bg)] text-[12px] text-[var(--p-muted)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </svg>
      {name}
    </div>
  );
}

// ---------------------------------------------------------------- trust (surface band, the iris moment)

function Trust() {
  const docs = ["Government ID", "Driver's license", "OR/CR · NBC 4821", "LTFRB franchise · NBC 4821"];
  return (
    <IrisMoment id="trust" className="lp-section lp-surface">
      <div className="lp-wrap grid items-start gap-10 lg:grid-cols-2 lg:gap-6">
        <div>
          <h2>BalikKarga checks every truck&apos;s franchise</h2>
          <p className="mt-5 max-w-[46ch] text-[18px] leading-[1.6]">
            Every trucker uploads an ID, a driver&apos;s license, the truck&apos;s OR/CR and its LTFRB franchise. BalikKarga
            reviews each file before the truck shows as verified.
          </p>
          <p className="lp-body mt-4 max-w-[46ch] text-[16px] leading-[1.6]">
            Carrying cargo for hire needs a franchise, so a truck without one never gets the badge.
          </p>
        </div>
        <div className="grid gap-4">
          <div className="lp-ui p-6" role="img" aria-label="A trucker's verification checklist with four approved documents">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-medium">Verification</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">✓ Verified</span>
            </div>
            {docs.map((d) => (
              <div key={d} className="flex items-center justify-between border-t border-[var(--p-line)] py-3 text-[14px]">
                <span>{d}</span>
                <span className="lp-ui__meta">Approved</span>
              </div>
            ))}
          </div>
          <div className="lp-ui hidden items-center gap-4 p-5 sm:flex" role="img" aria-label="A verified truck in BalikKarga">
            <span className="lp-mono rounded-md border-2 border-[var(--p-ink)] px-2 py-0.5 text-[14px] font-medium">NBC 4821</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">10-wheeler wing van, 15 t</div>
              <div className="lp-ui__meta">Based in Valenzuela · franchise checked</div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">LTFRB ✓</span>
          </div>
          <div className="lp-ui flex gap-3 p-5" role="img" aria-label="A text message from BalikKarga about a new load on a saved lane">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--p-action)] text-[15px] text-white">⇄</span>
            <div>
              <div className="lp-ui__meta">SMS · BalikKarga</div>
              <div>New load on your Batangas City→Valenzuela lane: FMCG, 11t, Lipa→Quezon City.</div>
            </div>
          </div>
        </div>
      </div>
    </IrisMoment>
  );
}

// ---------------------------------------------------------------- fees (pricing-two)

function Fees() {
  const examples = [2000, 9000, 16000, 26000];
  return (
    <section id="pricing" className="lp-section">
      <div className="lp-wrap">
        <h2>Fees for shippers and truckers</h2>
        <p className="lp-body mt-4 hidden max-w-[60ch] text-[17px] leading-[1.6] sm:block">
          Only truckers pay, and only when a booking goes through.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="lp-card flex flex-col p-5 sm:p-8">
            <div className="lp-ui__meta text-[13px] font-medium">Shippers</div>
            <div className="lp-display mt-2 text-[clamp(32px,2vw+20px,48px)] leading-none">₱0</div>
            <p className="mt-3 text-[16px] leading-[1.6]">
              Post loads, see matched trucks and book for free. You pay the trucker the rate you both agree.
            </p>
            <div className="mt-auto hidden pt-6 sm:block sm:pt-8">
              <Link href={SHIPPER_SIGNUP} className="lp-link">
                Sign up as a shipper
              </Link>
            </div>
          </div>
          <div className="lp-card flex flex-col p-5 sm:p-8">
            <div className="lp-ui__meta text-[13px] font-medium">Truckers</div>
            <div className="lp-display mt-2 text-[clamp(32px,2vw+20px,48px)] leading-none">{BOOKING_FEE_RATE * 100}%</div>
            <p className="mt-3 text-[16px] leading-[1.6]">
              Taken from prepaid credits only when a booking is accepted, ₱{BOOKING_FEE_MIN} minimum. Top up by GCash, Maya or
              bank transfer.
            </p>
            <div className="lp-ui mt-5 p-4" role="img" aria-label="A trucker's credit history in BalikKarga: a top-up and booking fees">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">Credits</span>
                <span className="lp-ui__meta">1 credit = ₱1</span>
              </div>
              <Ledger label="Top-up via GCash" amount={2000} />
              {examples.map((rate, i) => (
                <Ledger
                  key={rate}
                  label={`Fee on a ${php(rate)} booking`}
                  amount={-bookingFee(rate)}
                  show={i < 2 ? "flex" : i === 2 ? "hidden sm:flex" : "hidden xl:flex"}
                />
              ))}
            </div>
            <div className="mt-auto hidden pt-6 sm:block">
              <Link href={TRUCKER_SIGNUP} className="lp-link">
                Sign up as a trucker
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Ledger({ label, amount, show = "flex" }: { label: string; amount: number; show?: string }) {
  return (
    <div className={`items-center justify-between border-t border-[var(--p-line)] py-2 ${show}`}>
      <span>{label}</span>
      <span className={`tabular-nums font-medium ${amount < 0 ? "text-[#b42318]" : "text-[#15803d]"}`}>
        {amount < 0 ? "−" : "+"}
        {php(Math.abs(amount))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- faq (answers open)

function Faq() {
  const items: [string, string][] = [
    [
      "Which routes does BalikKarga cover?",
      `${CITIES.length} cities in all ${REGIONS} regions, from Laoag to General Santos. Suggested rates include the RoRo fee on sea crossings.`,
    ],
    [
      "How is the backhaul rate set?",
      "BalikKarga suggests 60% of a regular one-way rate for the truck type and distance. Shipper and trucker can agree on any rate.",
    ],
    [
      "Who can carry loads?",
      "Trucks carrying cargo for pay need an LTFRB franchise. BalikKarga checks it with the truck's OR/CR.",
    ],
    [
      "What happens if a booking is cancelled?",
      "If the shipper cancels after accepting, the trucker's fee goes back to their credits. If the trucker cancels, the fee is kept.",
    ],
    [
      "How do I hear about new loads?",
      "Save a regular lane, such as Batangas City to Valenzuela, and BalikKarga texts you when a load or a truck fits it.",
    ],
  ];
  return (
    <section id="faq" className="lp-section">
      <div className="lp-wrap grid gap-10 lg:grid-cols-2 lg:gap-6">
        <div>
          <h2>Questions from truckers and shippers</h2>
          <div className="lp-ui mt-8 hidden p-5 sm:block" role="img" aria-label={`BalikKarga covers ${CITIES.length} cities in all ${REGIONS} regions`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">Coverage</span>
              <span className="lp-ui__meta">{CITIES.length} cities · {REGIONS} regions</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {REGION_NAMES.map((r) => (
                <span key={r} className="rounded-md bg-[var(--p-bg)] px-2 py-1 text-[12px] shadow-[0_0_0_1px_var(--p-line)]">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
        <dl>
          {items.map(([q, a]) => (
            <div key={q} className="border-b border-[var(--p-line)] py-4 first:pt-0 last:max-sm:hidden">
              <dt className="text-[18px] font-medium">{q}</dt>
              <dd className="lp-body mt-2 text-[16px] leading-[1.6]">{a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- close (close-type)

function Close() {
  return (
    <section id="sign-up" className="lp-section">
      <div className="lp-wrap">
        <h2 style={{ maxWidth: "18ch" }}>Book space on trucks already heading home</h2>
        <p className="lp-body mt-5 max-w-[50ch] text-[18px] leading-[1.6]">
          Free to sign up. Truckers get ₱{SIGNUP_BONUS} in credits once their documents are approved.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="lp-card flex flex-col p-6 sm:p-8">
            <div className="lp-ui__meta text-[13px] font-medium">Shippers</div>
            <p className="lp-body mt-2 text-[16px] leading-[1.6]">Post the load once. Trucks already on that road show up with a fit score.</p>
            <div className="lp-ui mt-5 hidden p-4 sm:block" role="img" aria-label="The BalikKarga form for posting a load">
              <Field label="Cargo" value="FMCG, 11 t" />
              <Field label="Pickup" value="Lipa" />
              <Field label="Drop-off" value="Quezon City" />
            </div>
            <Link href={SHIPPER_SIGNUP} className="lp-btn lp-btn--primary mt-6 self-start">
              Post a load <Arrow />
            </Link>
          </div>
          <div className="lp-card flex flex-col p-6 sm:p-8">
            <div className="lp-ui__meta text-[13px] font-medium">Truckers</div>
            <p className="lp-body mt-2 text-[16px] leading-[1.6]">Post the trip home. Loads along the way come to you, best fit first.</p>
            <div className="lp-ui mt-5 hidden p-4 sm:block" role="img" aria-label="The BalikKarga form for posting a return trip">
              <Field label="Empty at" value="Batangas City" />
              <Field label="Heading back to" value="Valenzuela" />
              <Field label="Max detour" value="60 km" />
            </div>
            <Link href={TRUCKER_SIGNUP} className="lp-btn lp-btn--secondary mt-6 self-start">
              Post a return trip
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
