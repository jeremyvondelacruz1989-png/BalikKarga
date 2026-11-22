import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { truckTypeLabel } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CitySelect, PageHeader } from "@/components/ui";
import { createTrip } from "../../actions";

export default async function NewTripPage() {
  const user = await requireUser("TRUCKER");
  const trucks = await db.truck.findMany({ where: { ownerId: user.id, active: true } });
  const today = toDateInput(new Date());

  if (trucks.length === 0)
    return (
      <div className="card mx-auto max-w-lg p-6 text-sm">
        Add an active truck before posting a return trip.{" "}
        <Link className="font-semibold text-brand-700" href="/trucks">
          Go to trucks →
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post a return trip" subtitle="Where will your truck be empty, and where is it going home?" />
      <ActionForm action={createTrip} className="card space-y-4 p-6">
        <div>
          <label>Truck</label>
          <select name="truckId" required>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plateNumber} — {truckTypeLabel(t.truckType)}, {t.capacityTons} t
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label>Empty at (after unloading)</label>
            <CitySelect name="originCity" />
          </div>
          <div>
            <label>Heading back to</label>
            <CitySelect name="destCity" defaultValue={trucks[0].homeCity} />
          </div>
          <div>
            <label>Available from</label>
            <input type="date" name="availableFrom" defaultValue={today} min={today} required />
          </div>
          <div>
            <label>Must be home by</label>
            <input type="date" name="availableTo" defaultValue={today} min={today} required />
          </div>
          <div>
            <label>Max detour (km)</label>
            <input type="number" name="maxDetourKm" defaultValue={50} min={0} max={500} required />
            <p className="mt-1 text-xs text-slate-500">Extra km you&apos;re willing to drive off your route home.</p>
          </div>
          <div>
            <label>Asking rate (₱, optional)</label>
            <input type="number" name="askingRate" min={0} step="any" placeholder="Leave blank for our suggestion" />
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea name="notes" rows={2} placeholder="e.g. With helper, can load by 6am, no hazardous cargo" />
        </div>
        <SubmitButton>Post and find loads</SubmitButton>
      </ActionForm>
    </div>
  );
}
