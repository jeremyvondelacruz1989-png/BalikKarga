# BalikKarga

**Backhaul load marketplace for the Philippines.** Trucks that deliver cargo often drive home empty.
BalikKarga lets truckers post the empty return leg and matches it with shippers' loads along the way.
Shippers pay a discounted backhaul rate, and truckers earn on kilometers they would have driven anyway.

![Load matches](docs/screenshots/load-matches.png)

## What the MVP does

| Role | Can do |
| --- | --- |
| **Trucker / operator** | Register trucks (plate, type, capacity, LTFRB franchise no.) · post return trips (empty at → heading home, dates, max detour, asking rate) · see ranked loads along the way · offer on loads · accept requests · mark picked up / delivered with proof of delivery |
| **Shipper** | Post loads (cargo type, weight, truck type, pickup/drop-off, dates, budget) · see trucks already heading that way with a fit score and suggested price · request a truck · accept trucker offers · rate the trucker after delivery |
| **Admin** | Verify users and truck franchises · see GMV, platform fees, empty km filled and CO₂ avoided |

Also included:
- **Notifications inbox.** Every event goes through one function, `src/lib/notify.ts`, which is where SMS/Viber sending gets plugged in.
- **Contact privacy.** Phone numbers are shown only after a booking is accepted.

### How matching works (`src/lib/matching.ts`)
A load fits a return trip when **all** of these hold:
- the detour is within the trucker's limit
- the weight is within the truck's capacity
- the truck type is compatible (cold chain cargo needs a reefer, and a wing van can take a 6-wheeler load)
- the dates overlap

Each eligible pair gets a 0–100 score:
- penalised by detour, unused capacity, budget below the asking rate, and extra RoRo crossings
- the **suggested backhaul rate** is 60% of an estimated regular rate (per-km by truck class, with a minimum fare), plus the RoRo fee in full when the cargo crosses water

Distances are estimated road km between 68 PH logistics hubs. Rates in `src/lib/constants.ts` are placeholders, so tune them with real lane data.

## Try it in your browser (no install)

On the GitHub repo page, click **Code → Codespaces → Create codespace on main**.
Setup takes about 2–3 minutes the first time: it installs dependencies, creates the database and loads demo data.
The app then opens in a new tab. If it doesn't, open the **Ports** tab and click the globe icon next to port 3000.

## Run it locally

Requires Node 20+.

```bash
cp .env.example .env
npm install
npm run db:reset   # creates the SQLite DB and loads demo data
npm run dev        # http://localhost:3000
```

Demo logins (password `demo1234`): `shipper@demo.ph`, `trucker@demo.ph`, `admin@demo.ph`.
Other seeded accounts: `cebu.hardware@demo.ph`, `davao.coop@demo.ph`, `ricemill@demo.ph`, `bisaya@demo.ph`, `coldx@demo.ph`, `ilocos@demo.ph`.

```bash
npm test           # matching, pricing and booking-rule unit tests
npm run typecheck
```

## Deploy (Vercel + Supabase), about 15 minutes

1. Create a free project at **supabase.com** and copy the *Session pooler* connection string (Project Settings → Database).
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"` and commit.
3. Locally, set `DATABASE_URL` to the Supabase string and run `npx prisma db push`. Optionally run `npm run db:seed` for demo data.
4. At **vercel.com**, import this GitHub repo and add the `DATABASE_URL` environment variable. Deploy.
5. Before real users: remove the demo accounts (or don't seed), and change the admin password.

## Tech
- Next.js 15 (App Router, server actions)
- Prisma (SQLite locally, Postgres in production)
- Tailwind CSS 4
- Zod for validation
- Session-cookie auth with bcrypt-hashed passwords
- Vitest for unit tests

## Not in the MVP yet (suggested next steps)
- **SMS/Viber notifications.** Semaphore or Twilio, wired into `notify.ts`.
- **Payments and escrow.** GCash/Maya/bank via PayMongo or Xendit, plus faster payouts to truckers.
- **Document uploads for verification.** OR/CR, LTFRB CPC, driver's license, DTI/SEC, BIR 2303.
- **Live GPS tracking and photo proof of delivery.**
- **Real road distances and toll and truck-ban windows.** Google Routes or OSRM, plus MMDA truck-ban windows.
- **Recurring lanes and saved searches**, with alerts when a match appears.
- **Password reset and phone OTP login.**
- **BIR-compliant invoicing and waybill generation.**
