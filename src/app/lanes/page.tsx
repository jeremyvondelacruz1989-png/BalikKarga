import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { km } from "@/lib/format";
import { roadKm } from "@/lib/geo";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CitySelect, PageHeader, Pill, Route } from "@/components/ui";
import { createLane, updateLane } from "../actions";

export default async function LanesPage() {
  const user = await requireUser("SHIPPER", "TRUCKER");
  const trucker = user.role === "TRUCKER";
  const [lanes, trucks] = await Promise.all([
    db.savedLane.findMany({ where: { userId: user.id }, include: { truck: true }, orderBy: { createdAt: "desc" } }),
    trucker ? db.truck.findMany({ where: { ownerId: user.id, active: true } }) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <PageHeader
          title="Saved lanes"
          subtitle={
            trucker
              ? "Routes your trucks often drive home empty. We'll text you the moment a load is posted along one."
              : "Routes you ship often. We'll text you when a truck heading that way posts a return trip."
          }
        />
        {lanes.length === 0 ? (
          <p className="card p-6 text-sm text-slate-600">No saved lanes yet. Add your regular routes using the form.</p>
        ) : (
          <div className="card divide-y divide-slate-100">
            {lanes.map((l) => (
              <div key={l.id} className={`flex flex-wrap items-center gap-3 p-4 ${l.active ? "" : "opacity-60"}`}>
                <div className="min-w-56 flex-1">
                  <Route from={l.originCity} to={l.destCity} />
                  <div className="text-sm text-slate-500">
                    {km(roadKm(l.originCity, l.destCity))}
                    {l.truck && ` · ${l.truck.plateNumber} · detour up to ${l.maxDetourKm} km`}
                    {l.weightTons != null && ` · ~${l.weightTons} t loads`}
                  </div>
                </div>
                {l.active ? <Pill tone="green">Alerts on</Pill> : <Pill>Paused</Pill>}
                <form action={updateLane}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="op" value="toggle" />
                  <button className="btn-secondary py-1 text-xs">{l.active ? "Pause" : "Resume"}</button>
                </form>
                <form action={updateLane}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="op" value="delete" />
                  <button className="btn-danger py-1 text-xs">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
      <ActionForm action={createLane} className="card h-fit space-y-3 p-5" resetOnSuccess>
        <h2 className="font-semibold">Add a lane</h2>
        <div>
          <label>{trucker ? "Truck usually empty at" : "Pickup"}</label>
          <CitySelect name="originCity" />
        </div>
        <div>
          <label>{trucker ? "Heading back to" : "Drop-off"}</label>
          <CitySelect name="destCity" defaultValue={user.city ?? undefined} />
        </div>
        {trucker ? (
          <>
            <div>
              <label>Truck</label>
              <select name="truckId" required>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.plateNumber} ({t.capacityTons} t)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Max detour (km)</label>
              <input name="maxDetourKm" type="number" min={0} max={500} defaultValue={50} />
            </div>
          </>
        ) : (
          <div>
            <label>Typical weight (tons, optional)</label>
            <input name="weightTons" type="number" min={0} step="any" placeholder="e.g. 8" />
          </div>
        )}
        <SubmitButton className="btn-primary w-full">Save lane</SubmitButton>
      </ActionForm>
    </div>
  );
}
