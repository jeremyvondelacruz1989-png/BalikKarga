"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLink = { href: string; label: string };

function isActive(path: string, href: string) {
  return path === href || (href !== "/dashboard" && path.startsWith(href + "/"));
}

/**
 * Header navigation. From md up the links sit in the bar; on phones they fold into a
 * Menu button that opens a full-width panel (with `mobileExtra`, e.g. credits and Log out).
 */
export function NavLinks({ links, mobileExtra }: { links: NavLink[]; mobileExtra?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <nav aria-label="Main" className="hidden flex-wrap gap-0.5 text-sm md:flex">
        {links.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(path, n.href) ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 font-medium transition ${
              isActive(path, n.href) ? "bg-asphalt-2 text-lane" : "text-slate-300 hover:bg-asphalt-2 hover:text-white"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        className="order-3 flex h-10 items-center gap-2 rounded-md border border-asphalt-3 px-3 text-sm font-semibold text-white md:hidden"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
        Menu
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Main" className="order-last flex w-full flex-col border-t border-asphalt-2 pt-2 pb-1 md:hidden">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-md px-3 text-base font-medium ${
                isActive(path, n.href) ? "bg-asphalt-2 text-lane" : "text-slate-200"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {mobileExtra && <div className="mt-2 flex items-center gap-3 border-t border-asphalt-2 px-3 pt-3">{mobileExtra}</div>}
        </nav>
      )}
    </>
  );
}
