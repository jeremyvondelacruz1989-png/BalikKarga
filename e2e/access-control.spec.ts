import { expect, test } from "@playwright/test";
import { loginAs, openBooking, resetDb, signUp } from "./helpers";

// People must only see their own records, and pages are limited by role.
test.describe.serial("access control", () => {
  test.beforeAll(() => resetDb());

  test("signed-out visitors are sent to log in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a trucker can't open admin or shipper-only pages", async ({ browser }) => {
    const trucker = await loginAs(browser, "trucker@demo.ph");
    for (const path of ["/admin", "/loads/new"]) {
      await trucker.goto(path);
      await expect(trucker).toHaveURL(/\/dashboard/);
    }
  });

  test("a shipper can't open another shipper's booking or load", async ({ browser }) => {
    const owner = await loginAs(browser, "shipper@demo.ph");
    await openBooking(owner, "Appliances for Ilocos");
    const bookingUrl = owner.url();
    await owner.goto("/loads");
    await owner.getByRole("link", { name: /320 cartons/ }).click();
    await owner.waitForURL("**/loads/c*");
    const loadUrl = owner.url();

    const other = await loginAs(browser, "cebu.hardware@demo.ph");
    for (const url of [bookingUrl, loadUrl]) {
      await other.goto(url);
      await expect(other.getByRole("heading", { name: "Not found" })).toBeVisible();
    }
  });

  test("an ADMIN_EMAILS address does not become admin once an admin exists", async ({ browser }) => {
    // The demo data already has an admin, so signing up with a listed email gives a normal account.
    const page = await signUp(browser, { role: "SHIPPER", email: "owner@example.com", phone: "09175550999" });
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[name=email]", "shipper@demo.ph");
    await page.fill("input[name=password]", "wrong-password");
    await page.click("button[type=submit]");
    await expect(page.getByText("Wrong email or password")).toBeVisible();
  });
});
