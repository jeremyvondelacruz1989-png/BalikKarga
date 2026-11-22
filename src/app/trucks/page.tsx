import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { truckTypeLabel } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CitySelect, PageHeader, Pill, TruckTypeSelect } from "@/components/ui";
import { addTruck, toggleTruck } from "../actions";

export default async function TrucksPage() {
  const user = await requireUser("TRUCKER");
  const trucks = await db.truck.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <PageHeader title="My trucks" subtitle="Only franchise-verified trucks get the Verified badge shippers look for." />
        {trucks.length === 0 ? (
          <p className="card p-6 text-sm text-slate-600">No trucks yet. Add one using the form.</p>
        ) : (
          <div className="card divide-y divide-slate-100">
            {trucks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="rounded border-2 border-ink bg-white px-2 py-0.5 font-mono text-sm font-bold">{t.plateNumber}</div>
                <div className="flex-1 text-sm">
                  <div className="font-medium">{truckTypeLabel(t.truckType)}</div>
                  <div className="text-slate-500">
                    {t.capacityTons} t · based in {t.homeCity} · Franchise {t.franchiseNo ?? "—"}
                  </div>
                </div>
                {t.franchiseVerified ? <Pill tone="green">LTFRB verified</Pill> : <Pill tone="amber">Pending verification</Pill>}
                {!t.active && <Pill>Inactive</Pill>}
                <form action={toggleTruck}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn-secondary py-1 text-xs">{t.active ? "Deactivate" : "Activate"}</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
      <ActionForm action={addTruck} className="card h-fit space-y-3 p-5" resetOnSuccess>
        <h2 className="font-semibold">Add a truck</h2>
        <div>
          <label>Plate number</label>
          <input name="plateNumber" placeholder="NBC 1234" required />
        </div>
        <div>
          <label>Truck type</label>
          <TruckTypeSelect name="truckType" />
        </div>
        <div>
          <label>Payload capacity (tons)</label>
          <input name="capacityTons" type="number" step="0.5" min="0.5" required />
        </div>
        <div>
          <label>Home base</label>
          <CitySelect name="homeCity" defaultValue={user.city ?? undefined} />
        </div>
        <div>
          <label>LTFRB franchise / CPC case no.</label>
          <input name="franchiseNo" placeholder="e.g. 2024-NCR-01234" />
          <p className="mt-1 text-xs text-slate-500">Required to carry third-party cargo for hire.</p>
        </div>
        <SubmitButton className="btn-primary w-full">Add truck</SubmitButton>
      </ActionForm>
    </div>
  );
}
