import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, php } from "@/lib/format";
import { DOC_TYPES, PAYMENT_METHODS, truckTypeLabel } from "@/lib/constants";
import { PageHeader, Pill, StatusBadge, VerifiedBadge } from "@/components/ui";
import { adminReviewDocument, adminReviewTopup, adminVerify } from "../actions";

function ReviewButtons({
  id,
  action,
}: {
  id: string;
  action: (decision: "approve" | "reject", fd: FormData) => Promise<void>;
}) {
  return (
    <form className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="note" placeholder="Note (optional)" className="mt-0 w-40 py-1 text-xs" />
      <button formAction={action.bind(null, "approve")} className="btn-primary py-1 text-xs">
        Approve
      </button>
      <button formAction={action.bind(null, "reject")} className="btn-danger py-1 text-xs">
        Reject
      </button>
    </form>
  );
}

export default async function AdminPage() {
  await requireUser("ADMIN");
  const [topups, docs, smsLog, users, trucks] = await Promise.all([
    db.creditTransaction.findMany({
      where: { type: "TOPUP" },
      include: { user: true },
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    db.verificationDocument.findMany({
      include: { user: true, truck: true },
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.user.findMany({ where: { role: { not: "ADMIN" } }, orderBy: [{ verified: "asc" }, { createdAt: "desc" }] }),
    db.truck.findMany({ include: { owner: true }, orderBy: [{ franchiseVerified: "asc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        subtitle="Verify users (IDs, DTI/SEC, BIR 2303) and truck franchises (OR/CR, LTFRB CPC) before they appear as Verified."
      />
      <section id="topups">
        <h2 className="mb-2 text-lg font-semibold">Credit top-ups</h2>
        <p className="mb-2 text-xs text-slate-500">Check the amount and reference number against your GCash/Maya/bank history before approving.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Submitted</th>
                <th className="p-3">Trucker</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topups.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-slate-500">
                    No top-ups yet.
                  </td>
                </tr>
              )}
              {topups.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 text-xs">{fmtDateTime(t.createdAt)}</td>
                  <td className="p-3">{t.user.company ?? t.user.name}</td>
                  <td className="p-3 text-xs">
                    {PAYMENT_METHODS[t.method as keyof typeof PAYMENT_METHODS] ?? t.method} · ref <b>{t.reference}</b>
                    {t.receiptId && (
                      <a href={`/files/${t.receiptId}`} target="_blank" rel="noreferrer" className="ml-2 text-brand-700">
                        receipt
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold">{php(t.amount)}</td>
                  <td className="p-3 text-right">
                    {t.status === "PENDING" ? <ReviewButtons id={t.id} action={adminReviewTopup} /> : <StatusBadge status={t.status} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="documents">
        <h2 className="mb-2 text-lg font-semibold">Verification documents</h2>
        <p className="mb-2 text-xs text-slate-500">Approving an LTFRB franchise (CPC) marks that truck as LTFRB-verified.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Submitted</th>
                <th className="p-3">User</th>
                <th className="p-3">Document</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-3 text-slate-500">
                    No documents yet.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="p-3 text-xs">{fmtDateTime(d.createdAt)}</td>
                  <td className="p-3">
                    {d.user.name}
                    <div className="text-xs text-slate-500">{d.user.company}</div>
                  </td>
                  <td className="p-3">
                    <a href={`/files/${d.fileId}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700">
                      {DOC_TYPES[d.docType as keyof typeof DOC_TYPES]?.label ?? d.docType}
                    </a>
                    {d.truck && <span className="text-xs text-slate-500"> · {d.truck.plateNumber}</span>}
                  </td>
                  <td className="p-3 text-right">
                    {d.status === "PENDING" ? <ReviewButtons id={d.id} action={adminReviewDocument} /> : <StatusBadge status={d.status} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Trucks</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Plate</th>
                <th className="p-3">Type</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Franchise no.</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trucks.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono font-semibold">{t.plateNumber}</td>
                  <td className="p-3">
                    {truckTypeLabel(t.truckType)}, {t.capacityTons} t
                  </td>
                  <td className="p-3">{t.owner.company ?? t.owner.name}</td>
                  <td className="p-3">{t.franchiseNo ?? <Pill tone="amber">Missing</Pill>}</td>
                  <td className="p-3 text-right">
                    {t.franchiseVerified ? (
                      <Pill tone="green">Verified</Pill>
                    ) : (
                      <form action={adminVerify}>
                        <input type="hidden" name="kind" value="truck" />
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn-secondary py-1 text-xs" disabled={!t.franchiseNo}>
                          Verify franchise
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Users</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Joined</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.company}</div>
                  </td>
                  <td className="p-3 text-xs uppercase">{u.role}</td>
                  <td className="p-3 text-xs">
                    {u.email}
                    <br />
                    {u.phone}
                  </td>
                  <td className="p-3 text-xs">{fmtDate(u.createdAt)}</td>
                  <td className="p-3 text-right">
                    {u.verified ? (
                      <VerifiedBadge verified />
                    ) : (
                      <form action={adminVerify}>
                        <input type="hidden" name="kind" value="user" />
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn-secondary py-1 text-xs">Mark verified</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section id="sms">
        <h2 className="mb-2 text-lg font-semibold">Recent SMS</h2>
        <p className="mb-2 text-xs text-slate-500">
          {process.env.SEMAPHORE_API_KEY
            ? "Sending live through Semaphore."
            : "Test mode: no SEMAPHORE_API_KEY is set, so messages are logged here instead of being sent."}
        </p>
        <div className="card divide-y divide-slate-100 text-sm">
          {smsLog.length === 0 && <p className="p-3 text-slate-500">No messages yet.</p>}
          {smsLog.map((m) => (
            <div key={m.id} className="flex flex-wrap items-start gap-3 p-3">
              <span className="w-28 shrink-0 font-mono text-xs">{m.phone}</span>
              <span className="flex-1">{m.message}</span>
              <Pill tone={m.status === "SENT" ? "green" : m.status === "FAILED" ? "amber" : "slate"}>{m.status}</Pill>
              <span className="text-xs text-slate-400">{fmtDateTime(m.createdAt)}</span>
              {m.error && <span className="w-full text-xs text-red-700">{m.error}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
