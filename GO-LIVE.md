# Going live: checklist

BalikKarga runs on **Vercel** (the app) and **Supabase** (PostgreSQL database and file storage), both in Singapore.

## 1. Supabase (one time)
- [ ] **Project created:** region Southeast Asia (Singapore), Data API off.
- [ ] **Tables created:** by applying `prisma/migrations/*` (later changes apply automatically on each deploy).
- [ ] **Storage bucket:** `uploads` created and **private**.
- [ ] **Security advisor:** checked, with no open errors (Supabase → Advisors).

## 2. Vercel project (one time)
- [ ] **Import:** import the GitHub repo `BalikKarga`. Framework: Next.js. The build command comes from `vercel.json`.
- [ ] **Environment variables:** add these for Production (and Preview if you use it).

| Name | Value | Secret? |
|---|---|---|
| `DATABASE_URL` | Supabase → **Connect** → *Transaction pooler* string (port **6543**), with `?pgbouncer=true&connection_limit=1` added at the end, and `[YOUR-PASSWORD]` replaced by the database password | **Yes** |
| `DIRECT_URL` | Supabase → **Connect** → *Session pooler* string (port **5432**), password filled in | **Yes** |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | No |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → **API Keys** → a *secret* key (`sb_secret_…`) | **Yes** |
| `SUPABASE_BUCKET` | `uploads` | No |
| `APP_URL` | The site's address, e.g. `https://balikkarga.vercel.app` | No |
| `ADMIN_EMAILS` | Your email (the first sign-up with it becomes the admin) | No |
| `SIGNUP_BONUS` | `300` | No |
| `NEXT_PUBLIC_PAY_GCASH` / `_MAYA` / `_BANK` | The accounts truckers pay top-ups into | No |
| `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER_NAME` | Only when you're ready for real SMS (otherwise test mode) | Key: **Yes** |

Secrets are pasted into Vercel or Supabase directly. Never put them in chat, email or the repo.

## 3. First deploy
- [ ] **Deploy:** wait for it to show **Ready**. The build runs the database migrations first.
- [ ] **Create the admin:** open the site, **Sign up** with the `ADMIN_EMAILS` address, and you land on the admin page. Do this right away.
- [ ] **Smoke test:**
  - sign up a test shipper and a test trucker (use your own spare numbers)
  - post a load and a return trip
  - request a booking and accept it
  - upload a verification document and a delivery photo
  - as admin, approve the document and a top-up
- [ ] **Clean up:** delete the test accounts afterwards (Supabase → Table Editor), or keep them as your own.

## 4. Before real customers
- [ ] **Payment accounts:** GCash, Maya and bank account numbers set (`NEXT_PUBLIC_PAY_*`).
- [ ] **SMS:** Semaphore account, approved sender name, and `SEMAPHORE_API_KEY` set.
- [ ] **Paid plans:** Supabase Pro (daily backups, no pausing) and Vercel Pro (commercial use).
- [ ] **Domain:** a custom domain (e.g. `balikkarga.ph`) added in Vercel, and `APP_URL` updated.
- [ ] **Security:** 2FA turned on for GitHub, Vercel and Supabase.
