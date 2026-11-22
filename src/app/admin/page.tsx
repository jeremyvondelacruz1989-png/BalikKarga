import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { truckTypeLabel } from "@/lib/constants";
import { PageHeader, Pill, VerifiedBadge } from "@/components/ui";
import { adminVerify } from "../actions";

export default async function AdminPage() {
  await requireUser("ADMIN");
  const [users, trucks] = await Promise.all([
    db.user.findMany({ where: { role: { not: "ADMIN" } }, orderBy: [{ verified: "asc" }, { createdAt: "desc" }] }),
    db.truck.findMany({ include: { owner: true }, orderBy: [{ franchiseVerified: "asc" }, { createdAt: "desc" }] }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin"
        subtitle="Verify users (IDs, DTI/SEC, BIR 2303) and truck franchises (OR/CR, LTFRB CPC) before they appear as Verified."
      />
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
    </div>
  );
}
