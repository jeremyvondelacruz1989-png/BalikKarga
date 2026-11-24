# BalikKarga

Backhaul marketplace for PH shippers and truckers. Next.js 15 (App Router, server actions),
Prisma + PostgreSQL (Supabase live, local Postgres in dev), Tailwind 4. Hosting: Vercel (sin1). See README.md for features and setup.

## Where things live
- `src/app/actions.ts`: every server action (auth, listings, bookings, credits, uploads, lanes, admin).
- `src/lib/matching.ts`: matching and pricing. `src/lib/booking-rules.ts`: booking state machine.
- `src/lib/constants.ts`: fees (2.5%, min ₱75), welcome bonus, truck and cargo types, payment accounts.
- `src/lib/bonus.ts`, `credits` ledger in `CreditTransaction`: never change `User.creditBalance`
  without a matching ledger row in the same transaction.
- Database changes: edit `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`, commit the migration.
  Never use `db push` or `migrate reset` against Supabase. Live migrations run in `npm run vercel-build`.
- `src/lib/storage.ts`: uploads go to the private Supabase bucket when `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are set, else disk.
- `prisma/seed.ts`: demo data (refuses to run on a non-local database). The e2e tests depend on it, so update `e2e/` when changing it.

## Brand (Road Line)
Asphalt `#14161A`, lane yellow `#FFC400`, concrete `#F4F4F1`; Archivo headings, Inter text; tokens in
`src/app/globals.css`, logo in `src/components/Logo.tsx`. Text on yellow is asphalt; never yellow text on white
(use `text-brand-700`). The landing page (`src/lib/landing.ts`) sets the same colours in its own `:root` block.
Screens on the landing page (`public/assets/screens/`) never show real names, phone numbers or plates.

## Before finishing any change
Run `npm run test:all` (typecheck, unit tests, browser tests) and make sure everything passes.
On a fresh machine run `npm run test:e2e:setup` once first. If you change a user flow on purpose,
update the matching test in `e2e/` in the same change.

Work on a branch and open a pull request; don't push straight to `main`.
