import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { CitySelect } from "@/components/ui";
import { signup } from "../actions";
import { SIGNUP_BONUS } from "@/lib/constants";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <ActionForm action={signup} className="card space-y-4 p-6">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">I am a…</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              ["SHIPPER", "Shipper", "I have cargo to move"],
              [
                "TRUCKER",
                "Trucker / operator",
                SIGNUP_BONUS > 0 ? `Trucks returning empty · ₱${SIGNUP_BONUS} free credits once verified` : "I have trucks returning empty",
              ],
            ].map(([v, t, d]) => (
              <label
                key={v}
                className="flex cursor-pointer flex-col rounded-md border border-slate-300 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="role" value={v} defaultChecked={(role ?? "SHIPPER") === v} className="mt-0 w-auto" />
                  <span className="font-semibold">{t}</span>
                </span>
                <span className="mt-1 text-xs font-normal text-slate-500">{d}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" required />
        </div>
        <div>
          <label htmlFor="company">Company / trucking business</label>
          <input id="company" name="company" placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phone">Mobile (for SMS/Viber)</label>
            <input id="phone" name="phone" placeholder="09171234567" required />
          </div>
          <div>
            <label>Base city</label>
            <CitySelect name="city" />
          </div>
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <SubmitButton className="btn-primary w-full">Create account</SubmitButton>
      </ActionForm>
    </div>
  );
}
