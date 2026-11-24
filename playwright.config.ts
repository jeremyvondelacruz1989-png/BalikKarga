import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build on port 3100 with their own
// database (balikkarga_e2e on the local Postgres, or E2E_DATABASE_URL) and upload
// folder, so your dev data is never touched. Supabase Storage is switched off here.
// SMS always runs in test mode here (SEMAPHORE_API_KEY is blanked).
export const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/balikkarga_e2e",
  DIRECT_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/balikkarga_e2e",
  UPLOAD_DIR: "./uploads-e2e",
  SEMAPHORE_API_KEY: "",
  SIGNUP_BONUS: "300",
  ADMIN_EMAILS: "owner@example.com",
  SUPABASE_URL: "",
  SUPABASE_SECRET_KEY: "",
  APP_URL: "http://localhost:3100",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // tests share one database and reset it per file
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "off",
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next build && npx next start -p 3100",
    url: "http://localhost:3100/login",
    timeout: 300_000,
    reuseExistingServer: false,
    env: E2E_ENV,
  },
});
