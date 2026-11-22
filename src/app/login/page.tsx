import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <ActionForm action={login} className="card space-y-4 p-6">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <SubmitButton className="btn-primary w-full">Log in</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-700">
          Create an account
        </Link>
      </p>
      <div className="mt-6 rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-600">
        <p className="font-semibold">Demo accounts (password: demo1234)</p>
        <p>shipper@demo.ph · trucker@demo.ph · admin@demo.ph</p>
      </div>
    </div>
  );
}
