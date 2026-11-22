import { requireUser } from "@/lib/auth";
import { toDateInput } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CargoTypeSelect, CitySelect, PageHeader, TruckTypeSelect } from "@/components/ui";
import { createLoad } from "../../actions";

export default async function NewLoadPage() {
  const user = await requireUser("SHIPPER");
  const today = toDateInput(new Date());
  const inThree = toDateInput(new Date(Date.now() + 3 * 864e5));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post a load" subtitle="Flexible dates get more backhaul matches and lower rates." />
      <ActionForm action={createLoad} className="card space-y-4 p-6">
        <div>
          <label>What are you shipping?</label>
          <input name="title" placeholder="e.g. 400 sacks of rice, palletized" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label>Cargo type</label>
            <CargoTypeSelect name="cargoType" />
          </div>
          <div>
            <label>Weight (tons)</label>
            <input name="weightTons" type="number" step="0.1" min="0.1" required />
          </div>
          <div>
            <label>Pickup city</label>
            <CitySelect name="pickupCity" defaultValue={user.city ?? undefined} />
          </div>
          <div>
            <label>Drop-off city</label>
            <CitySelect name="dropCity" />
          </div>
          <div>
            <label>Earliest pickup</label>
            <input type="date" name="pickupDate" defaultValue={today} min={today} required />
          </div>
          <div>
            <label>Deliver by</label>
            <input type="date" name="deliverBy" defaultValue={inThree} min={today} required />
          </div>
          <div>
            <label>Truck needed</label>
            <TruckTypeSelect name="truckType" allowAny />
          </div>
          <div>
            <label>Budget (₱, optional)</label>
            <input name="budget" type="number" min={0} step="any" placeholder="We'll suggest a backhaul rate" />
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea name="notes" rows={2} placeholder="Loading dock hours, helpers needed, contact on site…" />
        </div>
        <SubmitButton>Post and find trucks</SubmitButton>
      </ActionForm>
    </div>
  );
}
