import { expect, test, type Page } from "@playwright/test";
import { adminApproveFirst, expectCredits, fixture, formError, formOk, loginAs, openBooking, resetDb } from "./helpers";

// Credits, the 2.5% booking fee (min ₱75), refunds, uploads, photo proof of delivery,
// saved-lane alerts and SMS test mode. Seed balances: trucker@demo.ph ₱2,049, ilocos@demo.ph ₱0.
test.describe.serial("credits, fees, documents and alerts", () => {
  let admin: Page, ilocos: Page, maria: Page, ramon: Page, outsider: Page;
  let offerUrl = "";

  test.beforeAll(async ({ browser }) => {
    resetDb();
    admin = await loginAs(browser, "admin@demo.ph");
    ilocos = await loginAs(browser, "ilocos@demo.ph");
    maria = await loginAs(browser, "shipper@demo.ph");
    ramon = await loginAs(browser, "trucker@demo.ph");
    outsider = await loginAs(browser, "cebu.hardware@demo.ph");
  });

  test("a trucker with no credits can't make an offer", async () => {
    await ilocos.goto("/loads");
    await ilocos.getByRole("link", { name: /Milled rice/ }).click();
    await ilocos.locator('button:has-text("Offer to carry")').first().click();
    await expect(formError(ilocos)).toContainText("You need ₱");
  });

  test("shipper can't accept an offer until the trucker has credits; contacts stay hidden", async () => {
    await openBooking(maria, "Appliances for Ilocos");
    offerUrl = maria.url();
    await expect(maria.getByText("09451231234")).toHaveCount(0);
    await maria.click('button:has-text("Accept booking")');
    await expect(formError(maria)).toContainText("doesn't have enough credits");
  });

  test("trucker submits a top-up; duplicate reference is refused", async () => {
    await ilocos.goto("/credits");
    await ilocos.selectOption("select[name=method]", "GCASH");
    await ilocos.fill("input[name=amount]", "2000");
    await ilocos.fill("input[name=reference]", "1012 777 12345");
    await ilocos.setInputFiles("input[name=receipt]", fixture("photo.png"));
    await ilocos.click('button:has-text("Submit top-up")');
    await expect(formOk(ilocos)).toContainText("Top-up submitted");

    await ilocos.fill("input[name=amount]", "500");
    await ilocos.fill("input[name=reference]", "1012 777 12345");
    await ilocos.click('button:has-text("Submit top-up")');
    await expect(formError(ilocos)).toContainText("already submitted");
  });

  test("receipt is visible to admin only", async () => {
    await admin.goto("/admin");
    const href = await admin.locator('#topups a:has-text("receipt")').first().getAttribute("href");
    const mine = await admin.request.get(href!);
    expect(mine.status()).toBe(200);
    expect(mine.headers()["content-type"]).toBe("image/png");
    expect((await outsider.request.get(href!)).status()).toBe(404);
  });

  test("admin approves top-ups and the balance updates", async () => {
    await adminApproveFirst(admin, "topups"); // ₱2,000 just submitted
    await adminApproveFirst(admin, "topups"); // ₱1,000 from the seed
    await expectCredits(ilocos, "3,000");
  });

  test("accepting deducts the 2.5% fee and reveals contacts", async () => {
    await maria.goto(offerUrl);
    await maria.click('button:has-text("Accept booking")');
    await expect(maria.getByText("09451231234")).toBeVisible();
    await expectCredits(ilocos, "2,350"); // ₱26,000 x 2.5% = ₱650
  });

  test("shipper cancelling an accepted booking refunds the fee", async () => {
    await maria.click('button:has-text("Cancel booking")');
    await expect(maria.getByText("Cancelled", { exact: true })).toBeVisible();
    await expectCredits(ilocos, "3,000");
  });

  test("delivery photos: required, type-checked, private to the booking", async () => {
    await openBooking(ramon, "Highland vegetables");
    const url = ramon.url();
    await ramon.click('button:has-text("Accept booking")');
    await expect(ramon.locator('button:has-text("Mark picked up")')).toBeVisible();
    await expectCredits(ramon, "1,824"); // ₱9,000 x 2.5% = ₱225
    await ramon.setInputFiles('form:has(button:has-text("Mark picked up")) input[name=photos]', fixture("photo.png"));
    await ramon.click('button:has-text("Mark picked up")');
    await expect(ramon.locator('button:has-text("Mark delivered")')).toBeVisible();

    const deliver = 'form:has(button:has-text("Mark delivered"))';
    await ramon.fill("input[name=podNote]", "Received by Jun Reyes, DR #2231");
    await ramon.click('button:has-text("Mark delivered")');
    await expect(formError(ramon)).toContainText("at least one photo");
    await ramon.setInputFiles(`${deliver} input[name=photos]`, fixture("fake.png"));
    await ramon.click('button:has-text("Mark delivered")');
    await expect(formError(ramon)).toContainText("JPG, PNG, WebP or PDF");
    await ramon.setInputFiles(`${deliver} input[name=photos]`, [fixture("photo.png"), fixture("photo.png")]);
    await ramon.click('button:has-text("Mark delivered")');
    await expect(ramon.getByText("Delivery photos")).toBeVisible();

    await maria.goto(url);
    const photos = maria.locator('img[alt$="photo"]');
    await expect(photos).toHaveCount(3);
    const src = (await photos.first().getAttribute("src"))!;
    expect((await maria.request.get(src)).status()).toBe(200);
    expect((await outsider.request.get(src)).status()).toBe(404);
  });

  test("verification upload: fake file refused, PDF accepted, admin approves franchise", async () => {
    await ramon.goto("/verification");
    await ramon.selectOption("select[name=docType]", "LTFRB_CPC");
    await ramon.selectOption("select[name=truckId]", { label: "NBC 4821" });
    await ramon.setInputFiles("input[name=file]", fixture("fake.png"));
    await ramon.click('button:has-text("Upload")');
    await expect(formError(ramon)).toContainText("JPG, PNG, WebP or PDF");

    await ramon.selectOption("select[name=docType]", "LTFRB_CPC");
    await ramon.selectOption("select[name=truckId]", { label: "NBC 4821" });
    await ramon.setInputFiles("input[name=file]", fixture("document.pdf"));
    await ramon.click('button:has-text("Upload")');
    await expect(formOk(ramon)).toContainText("uploaded");

    await adminApproveFirst(admin, "documents");
    await expect(admin.locator("#documents").getByText("Approved")).toBeVisible();
  });

  test("a new load on a trucker's saved lane alerts them", async () => {
    await maria.goto("/loads/new");
    await maria.fill("input[name=title]", "Pallets of snacks");
    await maria.fill("input[name=weightTons]", "8");
    await maria.selectOption("select[name=pickupCity]", "Calamba");
    await maria.selectOption("select[name=dropCity]", "Quezon City");
    await maria.click('button:has-text("Post and find trucks")');
    await maria.waitForURL(/\/loads\/c/);
    await ramon.goto("/dashboard");
    await expect(ramon.getByText("New load on your Batangas City→Valenzuela lane")).toBeVisible();
  });

  test("SMS are logged in test mode and users can turn SMS off", async () => {
    await admin.goto("/admin");
    await expect(admin.locator("#sms").getByText("TEST").first()).toBeVisible();
    await outsider.goto("/dashboard");
    await outsider.click('button:has-text("Turn off")');
    await expect(outsider.getByText("SMS alerts: Off")).toBeVisible();
  });
});
