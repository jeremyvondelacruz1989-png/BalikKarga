import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, km, php } from "@/lib/format";
import { bookingFee, cargoTypeLabel, truckTypeLabel } from "@/lib/constants";
import { availableActions } from "@/lib/booking-rules";
import { marketRate } from "@/lib/matching";
import { needsRoro } from "@/lib/geo";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Pill, Route, StatusBadge, VerifiedBadge } from "@/components/ui";
import { rateBooking, updateBooking } from "../../actions";

const STEPS = ["PENDING", "ACCEPTED", "IN_TRANSIT", "DELIVERED"];
const ACTION_LABELS = {
  accept: "Accept booking",
  decline: "Decline",
  cancel: "Cancel booking",
  start: "Mark picked up",
  deliver: "Mark delivered",
} as const;

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      load: true,
      trip: { include: { truck: true } },
      shipper: true,
      trucker: true,
      photos: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!b) notFound();
  const isParty = b.shipperId === user.id || b.truckerId === user.id;
  if (!isParty && user.role !== "ADMIN") notFound();

  const actions = isParty ? availableActions(b, { userId: user.id, role: user.role }) : [];
  const regular = marketRate(b.trip.truck.truckType, b.loadedKm ?? 0, needsRoro(b.load.pickupCity, b.load.dropCity) ? 1 : 0);
  const saving = regular > 0 ? Math.round((1 - b.agreedRate / regular) * 100) : 0;
  const stepIdx = STEPS.indexOf(b.status);
  const showContacts = ["ACCEPTED", "IN_TRANSIT", "DELIVERED"].includes(b.status);
  const fee = b.feeCharged ?? bookingFee(b.agreedRate);
  const isTrucker = user.id === b.truckerId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">
              Booking · {b.initiatedBy === "SHIPPER" ? "requested by shipper" : "offered by trucker"} · {fmtDateTime(b.createdAt)}
            </div>
            <h1 className="mt-1 text-2xl font-bold">{b.load.title}</h1>
            <Route from={b.load.pickupCity} to={b.load.dropCity} />
          </div>
          <StatusBadge status={b.status} />
        </div>

        {stepIdx >= 0 && (
          <ol className="mt-6 grid grid-cols-4 gap-2 text-xs">
            {["Requested", "Confirmed", "Picked up", "Delivered"].map((s, i) => (
              <li key={s} className={`border-t-4 pt-2 ${i <= stepIdx ? "border-brand-500 font-semibold" : "border-slate-200 text-slate-400"}`}>
                {s}
              </li>
            ))}
          </ol>
        )}

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Agreed rate</dt>
            <dd className="text-xl font-bold">{php(b.agreedRate)}</dd>
            {saving > 0 && <dd className="text-xs text-emerald-700">~{saving}% below a regular trip ({php(regular)})</dd>}
          </div>
          <div>
            <dt className="text-slate-500">Cargo</dt>
            <dd className="font-medium">
              {b.load.weightTons} t · {cargoTypeLabel(b.load.cargoType)}
            </dd>
            <dd className="text-xs text-slate-500">{km(b.loadedKm ?? 0)} loaded</dd>
          </div>
          <div>
            <dt className="text-slate-500">Window</dt>
            <dd className="font-medium">
              {fmtDate(b.load.pickupDate)} – {fmtDate(b.load.deliverBy)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Shipper</dt>
            <dd className="font-medium">
              {b.shipper.company ?? b.shipper.name} <VerifiedBadge verified={b.shipper.verified} />
            </dd>
            {showContacts && <dd className="text-xs">{b.shipper.name} · {b.shipper.phone}</dd>}
          </div>
          <div>
            <dt className="text-slate-500">Trucker</dt>
            <dd className="font-medium">
              {b.trucker.company ?? b.trucker.name} <VerifiedBadge verified={b.trucker.verified} />
            </dd>
            {showContacts && <dd className="text-xs">{b.trucker.name} · {b.trucker.phone}</dd>}
          </div>
          <div>
            <dt className="text-slate-500">Truck</dt>
            <dd className="font-medium">
              {b.trip.truck.plateNumber} · {truckTypeLabel(b.trip.truck.truckType)}
            </dd>
            {b.trip.truck.franchiseVerified && <Pill tone="green">LTFRB ✓</Pill>}
          </div>
        </dl>
        {!showContacts && isParty && (
          <p className="mt-4 rounded border border-dashed border-slate-300 p-3 text-xs text-slate-600">
            🔒 Phone numbers are revealed once the booking is accepted and the trucker&apos;s ₱{fee.toLocaleString()} booking fee is
            paid from credits.
            {isTrucker && b.status === "PENDING" && (
              <>
                {" "}
                You have <b>₱{user.creditBalance.toLocaleString()}</b> in credits.
                {user.creditBalance < fee && (
                  <a href="/credits" className="ml-1 font-semibold text-brand-700">
                    Top up →
                  </a>
                )}
              </>
            )}
          </p>
        )}
        {b.message && <p className="mt-4 rounded bg-slate-50 p-3 text-sm">&ldquo;{b.message}&rdquo;</p>}
        {b.podNote && (
          <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <b>Proof of delivery:</b> {b.podNote} {b.deliveredAt && <span className="text-slate-500">· {fmtDateTime(b.deliveredAt)}</span>}
          </p>
        )}
        {(user.role === "ADMIN" || isTrucker) && b.feeCharged != null && (
          <p className="mt-4 text-xs text-slate-500">Booking fee paid by trucker: {php(b.feeCharged)}</p>
        )}
        {b.photos.length > 0 && (
          <div className="mt-5 space-y-3">
            {(["PICKUP", "DELIVERY"] as const).map((stage) => {
              const photos = b.photos.filter((p) => p.stage === stage);
              if (photos.length === 0) return null;
              return (
                <div key={stage}>
                  <h3 className="mb-2 text-sm font-semibold">{stage === "PICKUP" ? "Pickup photos" : "Delivery photos"}</h3>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p) => (
                      <a key={p.id} href={`/files/${p.fileId}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/files/${p.fileId}`}
                          alt={`${stage.toLowerCase()} photo`}
                          className="h-28 w-28 rounded-md border border-slate-200 object-cover hover:opacity-90"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="card flex flex-wrap items-end gap-3 p-5">
          {actions.map((a) => (
            <ActionForm
              key={a}
              action={updateBooking}
              className={a === "deliver" || a === "start" ? "flex w-full flex-wrap items-end gap-2" : ""}
            >
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="action" value={a} />
              {a === "deliver" && (
                <div className="min-w-64 flex-1">
                  <label>Proof of delivery</label>
                  <input name="podNote" placeholder="Received by Juan Santos, DR #00123" />
                </div>
              )}
              {(a === "deliver" || a === "start") && (
                <div className="min-w-64 flex-1">
                  <label>
                    {a === "deliver" ? "Photos of signed DR/waybill & unloaded cargo (required)" : "Photos of loaded cargo (optional)"}
                  </label>
                  <input name="photos" type="file" accept="image/*" capture="environment" multiple />
                </div>
              )}
              {a === "accept" && (
                <p className="w-full pb-2 text-xs text-slate-600">
                  {isTrucker
                    ? `Accepting deducts ₱${fee.toLocaleString()} from your credits and reveals contact details.`
                    : `The trucker pays a ₱${fee.toLocaleString()} booking fee from their credits; contact details are then revealed.`}
                </p>
              )}
              <SubmitButton className={a === "cancel" || a === "decline" ? "btn-danger" : "btn-primary"}>
                {ACTION_LABELS[a]}
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      )}
      {b.status === "PENDING" && isParty && !actions.includes("accept") && (
        <p className="text-sm text-slate-600">Waiting for the other side to accept. They&apos;ve been notified.</p>
      )}

      {b.status === "DELIVERED" && b.shipperId === user.id && b.rating == null && (
        <ActionForm action={rateBooking} className="card flex flex-wrap items-end gap-3 p-5">
          <input type="hidden" name="id" value={b.id} />
          <div>
            <label>Rate this trucker</label>
            <select name="rating" defaultValue="5" className="w-32">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton>Submit rating</SubmitButton>
        </ActionForm>
      )}
      {b.rating != null && <p className="text-sm">Shipper rating: {"★".repeat(b.rating)}</p>}

      <div className="flex gap-4 text-sm">
        <Link href={`/loads/${b.loadId}`} className="font-semibold text-brand-700">
          View load
        </Link>
        <Link href={`/trips/${b.tripId}`} className="font-semibold text-brand-700">
          View return trip
        </Link>
      </div>
    </div>
  );
}
