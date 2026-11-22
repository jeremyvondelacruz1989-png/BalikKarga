import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, php } from "@/lib/format";
import {
  BOOKING_FEE_MIN,
  BOOKING_FEE_RATE,
  PAYMENT_ACCOUNTS,
  PAYMENT_METHODS,
  TOPUP_MIN,
  TOPUP_PACKAGES,
} from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requestTopup } from "../actions";
import { missingBonusDocs } from "@/lib/bonus";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "Top-up",
  BOOKING_FEE: "Booking fee",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
  SIGNUP_BONUS: "Welcome bonus",
};

export default async function CreditsPage() {
  const user = await requireUser("TRUCKER");
  const txns = await db.creditTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  const pending = txns.filter((t) => t.type === "TOPUP" && t.status === "PENDING").reduce((s, t) => s + t.amount, 0);
  const heldBonus = txns.find((t) => t.type === "SIGNUP_BONUS" && t.status === "PENDING");
  const missing = heldBonus
    ? missingBonusDocs(
        await db.verificationDocument.findMany({ where: { userId: user.id } }),
        (await db.truck.findMany({ where: { ownerId: user.id }, select: { id: true } })).map((t) => t.id),
      )
    : [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <PageHeader
          title="Credits"
          subtitle={`Credits pay the booking fee (${BOOKING_FEE_RATE * 100}% of the agreed rate, minimum ₱${BOOKING_FEE_MIN}) when a booking is accepted. Contact details are revealed after the fee is paid. 1 credit = ₱1.`}
        />
        {heldBonus && (
          <div className="card border-brand-100 bg-brand-50 p-5 text-sm">
            <div className="font-semibold text-brand-700">
              🎁 ₱{heldBonus.amount.toLocaleString()} welcome bonus waiting for you
            </div>
            <p className="mt-1 text-slate-700">It&apos;s credited as soon as these documents are approved:</p>
            <ul className="mt-1 list-inside list-disc text-slate-700">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <Link href="/verification" className="btn-primary mt-3">
              Upload documents
            </Link>
          </div>
        )}
        <div className="card flex flex-wrap items-center gap-8 p-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Available balance</div>
            <div className="text-4xl font-bold">{php(user.creditBalance)}</div>
          </div>
          {pending > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Awaiting confirmation</div>
              <div className="text-2xl font-semibold text-amber-700">{php(pending)}</div>
            </div>
          )}
          <p className="text-sm text-slate-600">
            Example: a ₱12,000 backhaul costs a ₱{Math.max(BOOKING_FEE_MIN, 12000 * BOOKING_FEE_RATE).toLocaleString()} fee. If the
            shipper cancels after accepting, your fee is refunded.
          </p>
        </div>

        <section>
          <h2 className="mb-2 text-lg font-semibold">History</h2>
          {txns.length === 0 ? (
            <p className="card p-6 text-sm text-slate-600">No transactions yet.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Details</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td className="p-3 text-xs whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                      <td className="p-3">{TYPE_LABEL[t.type] ?? t.type}</td>
                      <td className="p-3 text-xs text-slate-600">
                        {t.method && `${PAYMENT_METHODS[t.method as keyof typeof PAYMENT_METHODS]} · ref ${t.reference}`}
                        {t.bookingId && (
                          <a href={`/bookings/${t.bookingId}`} className="text-brand-700">
                            {t.note ?? "Booking"}
                          </a>
                        )}
                        {(t.type === "TOPUP" || t.type === "SIGNUP_BONUS") && t.note && <div>{t.note}</div>}
                      </td>
                      <td className={`p-3 text-right font-semibold ${t.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {t.amount > 0 ? "+" : "−"}
                        {php(Math.abs(t.amount))}
                      </td>
                      <td className="p-3 text-right">{t.status !== "APPROVED" && <StatusBadge status={t.status} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <ActionForm action={requestTopup} className="card h-fit space-y-4 p-5" resetOnSuccess>
        <h2 className="font-semibold">Top up credits</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
          <li>Send payment to one of our accounts below.</li>
          <li>Enter the amount and reference number from your receipt.</li>
          <li>Credits are added once we confirm the payment.</li>
        </ol>
        <div className="space-y-1 rounded-md bg-slate-50 p-3 text-xs">
          {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
            <div key={k}>
              <b>{v}:</b> {PAYMENT_ACCOUNTS[k as keyof typeof PAYMENT_ACCOUNTS]}
            </div>
          ))}
        </div>
        <div>
          <label>Paid via</label>
          <select name="method" defaultValue="GCASH">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Amount (₱)</label>
          <input name="amount" type="number" min={TOPUP_MIN} step={1} list="topup-packages" required placeholder="e.g. 1000" />
          <datalist id="topup-packages">
            {TOPUP_PACKAGES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label>Reference number</label>
          <input name="reference" required placeholder="e.g. 1012 345 678901" />
        </div>
        <div>
          <label>Receipt screenshot (optional, speeds up approval)</label>
          <input name="receipt" type="file" accept="image/*,application/pdf" />
        </div>
        <SubmitButton className="btn-primary w-full">Submit top-up</SubmitButton>
      </ActionForm>
    </div>
  );
}
