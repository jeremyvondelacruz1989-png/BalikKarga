"use client";

import { useEffect, useRef } from "react";

type MomentEl = HTMLElement & { __moment?: { destroy?: () => void }; __momentP?: Promise<unknown> };

/**
 * The page's dealt moment (design-taste-frontend: iris-opens). The kit's runtime lives in
 * public/assets/moments and is loaded as a plain module, so it never enters the app bundle.
 * Without script, on a phone or under reduced motion the section simply shows as it is.
 */
export function IrisMoment({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as MomentEl | null;
    if (!el) return;
    (window as unknown as { __momentsManual?: boolean }).__momentsManual = true;
    let cancelled = false;
    import(/* webpackIgnore: true */ "/assets/moments/moments.js" as string)
      .then((m: { mount: (el: HTMLElement) => Promise<unknown> }) => (cancelled ? null : m.mount(el)))
      .catch(() => el.setAttribute("data-moment-failed", ""));
    return () => {
      cancelled = true;
      el.__moment?.destroy?.();
      delete el.__moment;
      delete el.__momentP;
    };
  }, []);

  return (
    <section
      ref={ref}
      id={id}
      className={className}
      data-moment="iris-opens"
      data-moment-opts='{"from": "base"}'
    >
      {children}
    </section>
  );
}
