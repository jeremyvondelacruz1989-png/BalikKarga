import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "BalikKarga — Backhaul loads for Philippine trucks",
  description: "Fill empty return trips. Shippers save, truckers earn on the way home.",
};

const NAV: Record<string, { href: string; label: string }[]> = {
  SHIPPER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/loads", label: "My loads" },
    { href: "/trips", label: "Find return trucks" },
    { href: "/bookings", label: "Bookings" },
  ],
  TRUCKER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/trips", label: "My return trips" },
    { href: "/loads", label: "Find loads" },
    { href: "/bookings", label: "Bookings" },
    { href: "/trucks", label: "Trucks" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/admin", label: "Admin" },
    { href: "/bookings", label: "All bookings" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, read: false } }) : 0;

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-lg text-white">⇄</span>
              <span className="leading-tight">
                <span className="block font-bold">BalikKarga</span>
                <span className="block text-[11px] text-slate-500">Backhaul loads PH</span>
              </span>
            </Link>
            {user && (
              <nav className="flex flex-wrap gap-1 text-sm">
                {NAV[user.role]?.map((n) => (
                  <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
                    {n.label}
                  </Link>
                ))}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard#inbox" className="relative rounded-md px-2 py-1.5 hover:bg-slate-100" aria-label="Notifications">
                    🔔
                    {unread > 0 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                  <span className="hidden text-slate-600 sm:inline">
                    {user.name} · <span className="text-xs uppercase">{user.role.toLowerCase()}</span>
                  </span>
                  <form action={logout}>
                    <button className="btn-secondary py-1.5">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="font-medium text-slate-700 hover:text-ink">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-slate-500">
          Rates and distances are estimates. Truckers carrying third-party cargo must hold a valid LTFRB franchise.
        </footer>
      </body>
    </html>
  );
}
