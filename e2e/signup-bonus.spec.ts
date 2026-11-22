import { expect, test } from "@playwright/test";
import { adminApproveFirst, creditsPill, expectCredits, fixture, formError, loginAs, resetDb, signUp } from "./helpers";

// ₱300 welcome bonus: reserved at sign-up, credited when ID, driver's license and one
// truck's OR/CR + LTFRB franchise are approved. One bonus per mobile number.
test.describe.serial("trucker welcome bonus", () => {
  test.beforeAll(() => resetDb());

  test("landing page advertises the bonus", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Truckers get ₱300 in credits once their documents are approved.")).toBeVisible();
  });

  test("bonus is held until all required documents are approved", async ({ browser }) => {
    const t = await signUp(browser, { role: "TRUCKER", email: "bonus1@example.com", phone: "09175550001" });
    await expect(creditsPill(t)).toHaveText("₱0 credits");

    await t.fill("input[name=plateNumber]", "BON 1234");
    await t.selectOption("select[name=truckType]", "SIX_WHEELER");
    await t.fill("input[name=capacityTons]", "6");
    await t.fill("input[name=franchiseNo]", "2025-VI-00001");
    await t.click('button:has-text("Add truck")');
    await expect(t.getByText("BON 1234")).toBeVisible();

    await t.goto("/credits");
    await expect(t.getByText("₱300 welcome bonus waiting")).toBeVisible();

    await t.goto("/verification");
    await expect(t.getByText("Unlock your ₱300 welcome bonus")).toBeVisible();
    for (const [docType, truck] of [["GOV_ID"], ["DRIVERS_LICENSE"], ["OR_CR", "BON 1234"], ["LTFRB_CPC", "BON 1234"]]) {
      const uploaded = t.locator('a[href^="/files/"]');
      const before = await uploaded.count();
      await t.selectOption("select[name=docType]", docType);
      if (truck) await t.selectOption("select[name=truckId]", { label: truck });
      await t.setInputFiles("input[name=file]", fixture("document.pdf"));
      await t.click('button:has-text("Upload")');
      await expect(uploaded).toHaveCount(before + 1);
      await expect(formError(t)).toHaveCount(0);
    }

    const admin = await loginAs(browser, "admin@demo.ph");
    for (let i = 0; i < 3; i++) await adminApproveFirst(admin, "documents");
    await expectCredits(t, "0");

    await adminApproveFirst(admin, "documents");
    await expectCredits(t, "300");
    await t.goto("/credits");
    await expect(t.getByText("welcome bonus waiting")).toHaveCount(0);
    await t.goto("/dashboard");
    await expect(t.getByText("Your ₱300 welcome bonus is now in your credits")).toBeVisible();
    await expect(t.locator("main").getByText("Verified")).toBeVisible();

    await admin.goto("/dashboard");
    await expect(admin.getByText("1 welcome bonuses paid (₱300)")).toBeVisible();
  });

  test("the same number in +63 format gets no second bonus", async ({ browser }) => {
    const t2 = await signUp(browser, { role: "TRUCKER", email: "bonus2@example.com", phone: "+639175550001" });
    await t2.goto("/credits");
    await expect(t2.getByText("welcome bonus waiting")).toHaveCount(0);
  });

  test("shippers don't get the bonus", async ({ browser }) => {
    const s = await signUp(browser, { role: "SHIPPER", email: "bonus3@example.com", phone: "09175550003" });
    await s.goto("/credits");
    await expect(s).toHaveURL(/\/dashboard/); // credits page is trucker-only
  });
});
