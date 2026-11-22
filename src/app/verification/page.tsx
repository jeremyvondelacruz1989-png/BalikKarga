import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { DOC_TYPES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader, StatusBadge, VerifiedBadge } from "@/components/ui";
import { uploadDocument } from "../actions";

export default async function VerificationPage() {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const [docs, trucks] = await Promise.all([
    db.verificationDocument.findMany({ where: { userId: user.id }, include: { truck: true }, orderBy: { createdAt: "desc" } }),
    user.role === "TRUCKER" ? db.truck.findMany({ where: { ownerId: user.id } }) : Promise.resolve([]),
  ]);
  const applicable = Object.entries(DOC_TYPES).filter(
    ([, m]) => m.for === "ALL" || (user.role === "TRUCKER" && (m.for === "TRUCKER" || m.for === "TRUCK")),
  );

  // Checklist: what still needs an approved document
  const has = (type: string, truckId?: string) =>
    docs.find((d) => d.docType === type && (truckId ? d.truckId === truckId : true) && d.status !== "REJECTED");
  const checklist: { label: string; doc?: (typeof docs)[number] }[] = [
    { label: DOC_TYPES.GOV_ID.label, doc: has("GOV_ID") },
    ...(user.role === "TRUCKER" ? [{ label: DOC_TYPES.DRIVERS_LICENSE.label, doc: has("DRIVERS_LICENSE") }] : []),
    { label: `${DOC_TYPES.DTI_SEC.label} or ${DOC_TYPES.BIR_2303.label}`, doc: has("DTI_SEC") ?? has("BIR_2303") },
    ...trucks.flatMap((t) => [
      { label: `${t.plateNumber}: ${DOC_TYPES.OR_CR.label}`, doc: has("OR_CR", t.id) },
      { label: `${t.plateNumber}: ${DOC_TYPES.LTFRB_CPC.label}`, doc: has("LTFRB_CPC", t.id) },
    ]),
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <PageHeader
          title="Verification"
          subtitle="Verified accounts get more bookings. Upload clear photos or PDFs; only our admins can see them."
          action={<VerifiedBadge verified={user.verified} />}
        />
        <section className="card divide-y divide-slate-100">
          {checklist.map((c) => (
            <div key={c.label} className="flex items-center justify-between p-3 text-sm">
              <span>{c.label}</span>
              {c.doc ? <StatusBadge status={c.doc.status} /> : <span className="text-xs text-slate-400">Not uploaded</span>}
            </div>
          ))}
        </section>
        {docs.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Uploaded documents</h2>
            <div className="card divide-y divide-slate-100">
              {docs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <a href={`/files/${d.fileId}`} target="_blank" rel="noreferrer" className="flex-1 font-medium text-brand-700">
                    {DOC_TYPES[d.docType as keyof typeof DOC_TYPES]?.label ?? d.docType}
                    {d.truck && ` · ${d.truck.plateNumber}`}
                  </a>
                  <span className="text-xs text-slate-500">{fmtDateTime(d.createdAt)}</span>
                  <StatusBadge status={d.status} />
                  {d.reviewNote && <p className="w-full text-xs text-slate-600">Reviewer: {d.reviewNote}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <ActionForm action={uploadDocument} className="card h-fit space-y-3 p-5" resetOnSuccess>
        <h2 className="font-semibold">Upload a document</h2>
        <div>
          <label>Document</label>
          <select name="docType" required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {applicable.map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
                {m.for === "TRUCK" ? " (per truck)" : ""}
              </option>
            ))}
          </select>
        </div>
        {trucks.length > 0 && (
          <div>
            <label>Truck (for OR/CR and franchise)</label>
            <select name="truckId" defaultValue="">
              <option value="">—</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plateNumber}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label>File (JPG, PNG, WebP or PDF, max 5 MB)</label>
          <input name="file" type="file" accept="image/*,application/pdf" required />
        </div>
        <SubmitButton className="btn-primary w-full">Upload</SubmitButton>
      </ActionForm>
    </div>
  );
}
