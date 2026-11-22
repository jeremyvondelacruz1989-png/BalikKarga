import { execSync } from "node:child_process";
import path from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";
import { E2E_ENV } from "../playwright.config";

export const FIXTURES = path.join(__dirname, "fixtures");
export const fixture = (name: string) => path.join(FIXTURES, name);
export const PASSWORD = "demo1234";

/** Wipe and reseed the e2e database so each test file starts from the demo data. */
export function resetDb() {
  execSync("npx tsx prisma/seed.ts", { env: { ...process.env, ...E2E_ENV }, stdio: "ignore" });
}

/** A fresh browser context signed in as the given user. */
export async function loginAs(browser: Browser, email: string, password = PASSWORD): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button[type=submit]")]);
  return page;
}

export async function signUp(browser: Browser, opts: { role: "SHIPPER" | "TRUCKER"; email: string; phone: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/signup?role=${opts.role}`);
  await page.fill("input[name=name]", `Test ${opts.role.toLowerCase()}`);
  await page.fill("input[name=phone]", opts.phone);
  await page.selectOption("select[name=city]", "Iloilo City");
  await page.fill("input[name=email]", opts.email);
  await page.fill("input[name=password]", "password123");
  await page.click('button:has-text("Create account")');
  await page.waitForURL(/\/(trucks|dashboard)/);
  return page;
}

/** The credits pill in the header, e.g. "₱1,600 credits". */
export const creditsPill = (page: Page) => page.locator('header a[href="/credits"]', { hasText: "₱" });

export async function expectCredits(page: Page, amount: string) {
  await page.reload();
  await expect(creditsPill(page)).toHaveText(`₱${amount} credits`);
}

/** Error banner from a form. */
export const formError = (page: Page) => page.locator("p[role=alert]");
export const formOk = (page: Page) => page.locator("p[role=status]");

/** Opens a booking from the Bookings list by its load title. */
export async function openBooking(page: Page, loadTitle: string) {
  await page.goto("/bookings");
  await page.getByRole("link", { name: new RegExp(loadTitle) }).first().click();
  await page.waitForURL("**/bookings/*");
}

/** Clicks the first Approve button in an admin section (#topups or #documents), reloading first. */
export async function adminApproveFirst(admin: Page, section: "topups" | "documents") {
  await admin.goto("/admin");
  const before = await admin.locator(`#${section} button:has-text("Approve")`).count();
  await admin.locator(`#${section} button:has-text("Approve")`).first().click();
  await expect(admin.locator(`#${section} button:has-text("Approve")`)).toHaveCount(before - 1);
}
