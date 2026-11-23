import type { Metadata, Viewport } from "next";
import Link from "next/link";
// Brand fonts, self-hosted from npm so builds never depend on a font download.
import "@fontsource-variable/archivo";
import "@fontsource-variable/inter";
import "./globals.css";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "BalikKarga — Backhaul loads for Philippine trucks",
  description: "Fill empty return trips. Shippers save, truckers earn on the way home.",
};

export const viewport: Viewport = { themeColor: "#14161a" };

const NAV: Record<string, { href: string; label: string }[]> = {
  SHIPPER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/loads", label: "My loads" },
    { href: "/trips", label: "Find return trucks" },
    { href: "/bookings", label: "Bookings" },
    { href: "/lanes", label: "Lanes" },
    { href: "/verification", label: "Verification" },
  ],
  TRUCKER: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/trips", label: "My trips" },
    { href: "/loads", label: "Find loads" },
    { href: "/bookings", label: "Bookings" },
    { href: "/lanes", label: "Lanes" },
    { href: "/trucks", label: "Trucks" },
    { href: "/verification", label: "Verification" },
    { href: "/credits", label: "Credits" },
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
      <body className="flex min-h-screen flex-col">
        <header className="bg-asphalt text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} aria-label="BalikKarga home" className="rounded-md">
              <Logo tone="dark" />
            </Link>
            {user && (
              <NavLinks
                links={NAV[user.role] ?? []}
                mobileExtra={
                  <>
                    {user.role === "TRUCKER" && (
                      <Link href="/credits" className="rounded-md bg-asphalt-2 px-2.5 py-1.5 text-sm font-bold text-lane">
                        ₱{user.creditBalance.toLocaleString()} credits
                      </Link>
                    )}
                    <form action={logout} className="ml-auto">
                      <button className="btn border border-asphalt-3 text-white">Log out</button>
                    </form>
                  </>
                }
              />
            )}
            <div className="order-2 ml-auto flex items-center gap-2 text-sm md:order-none">
              {user ? (
                <>
                  <Link
                    href="/dashboard#inbox"
                    className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-300 hover:bg-asphalt-2 hover:text-white"
                    aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-lane px-1 text-center text-[10px] leading-4 font-bold text-asphalt">
                        {unread}
                      </span>
                    )}
                  </Link>
                  {user.role === "TRUCKER" && (
                    <Link href="/credits" className="hidden rounded-md bg-asphalt-2 px-2.5 py-1.5 text-xs font-bold text-lane hover:bg-asphalt-3 md:inline-block">
                      ₱{user.creditBalance.toLocaleString()} credits
                    </Link>
                  )}
                  <span className="hidden text-slate-400 2xl:inline">
                    {user.name} · <span className="text-xs uppercase">{user.role.toLowerCase()}</span>
                  </span>
                  <form action={logout} className="hidden md:block">
                    <button className="btn border border-asphalt-3 py-1.5 text-white hover:bg-asphalt-2">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="rounded-md px-2.5 py-1.5 font-medium text-slate-200 hover:text-white">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="lane-line" aria-hidden="true" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-slate-600">
            <Logo size={24} />
            <p>Rates and distances are estimates. Truckers carrying third-party cargo must hold a valid LTFRB franchise.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
