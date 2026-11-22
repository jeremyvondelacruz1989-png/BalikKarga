"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import type { FormState } from "@/app/actions";

const PendingContext = createContext(false);

/**
 * Form bound to a server action that shows its error/success message.
 * Submits via onSubmit (not the `action` prop) so that React does not clear
 * what the user typed when the server returns a validation error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, actionPending] = useActionState(action, undefined);
  const [transitionPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const pending = actionPending || transitionPending;

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {state?.error && (
        <p role="alert" className="mb-3 w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mb-3 w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
