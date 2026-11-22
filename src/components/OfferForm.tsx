import { ActionForm, SubmitButton } from "./ActionForm";
import { proposeBooking } from "@/app/actions";

export function OfferForm({ loadId, tripId, rate, label }: { loadId: string; tripId: string; rate: number; label: string }) {
  return (
    <ActionForm action={proposeBooking} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="loadId" value={loadId} />
      <input type="hidden" name="tripId" value={tripId} />
      <div className="w-32">
        <label className="text-xs">Rate (₱)</label>
        <input name="agreedRate" type="number" min={1} step="any" defaultValue={rate} required />
      </div>
      <div className="min-w-40 flex-1">
        <label className="text-xs">Message</label>
        <input name="message" placeholder="Optional, e.g. pickup after 2pm" />
      </div>
      <SubmitButton>{label}</SubmitButton>
    </ActionForm>
  );
}
