import { expect, test } from "@playwright/test";
import { fixture, formError, loginAs, openBooking, resetDb } from "./helpers";

// The main marketplace loop: shipper and trucker find each other, book, deliver, rate.
test.describe.serial("core marketplace flows", () => {
  test.beforeAll(() => resetDb());

  test("public landing page shows the redesign and its sign-up links", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Backhaul loads for trucks driving home empty" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Every load, matched to trucks going home" })).toBeAttached();
    await expect(page.getByText(/Lanes across 66 hubs/)).toBeAttached();
    await expect(page.locator('a[href="/signup?role=SHIPPER"]').first()).toBeVisible();
    await expect(page.locator('a[href="/signup?role=TRUCKER"]').first()).toBeVisible();
    // The page is public: no company or person names and no plate numbers, in text or in image alt text
    const text = (await page.locator("body").innerText()) + (await page.locator("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("alt")).join(" ")));
    for (const name of ["RDC Trucking", "Ilocos Freight", "Bisaya Haulers", "Mindanao Cold", "Luzon Fresh", "Mandaue Home", "Golden Grain", "Ramon", "Maria Santos", "Jun Reyes"])
      expect(text, `public page shows "${name}"`).not.toContain(name);
    expect(text).not.toMatch(/\b[A-Z]{3} \d{4}\b/);
    expect(errors).toEqual([]);
  });

  test("trucker accepts a request, picks up and delivers with proof", async ({ browser }) => {
    const trucker = await loginAs(browser, "trucker@demo.ph");
    await expect(trucker.getByText("Loads on your way home")).toBeVisible();
    await openBooking(trucker, "Highland vegetables");

    await trucker.click('button:has-text("Accept booking")');
    await expect(trucker.locator('button:has-text("Mark picked up")')).toBeVisible();
    await trucker.click('button:has-text("Mark picked up")');
    await expect(trucker.locator('button:has-text("Mark delivered")')).toBeVisible();

    // Delivery needs a photo and a receiver name / DR number.
    await trucker.click('button:has-text("Mark delivered")');
    await expect(formError(trucker)).toContainText("at least one photo");
    await trucker.fill("input[name=podNote]", "Received by Jun Reyes, DR #2231");
    await trucker.setInputFiles('form:has(button:has-text("Mark delivered")) input[name=photos]', fixture("photo.png"));
    await trucker.click('button:has-text("Mark delivered")');
    await expect(trucker.getByText("Proof of delivery:")).toBeVisible();
  });

  test("shipper rates the delivered booking", async ({ browser }) => {
    const shipper = await loginAs(browser, "shipper@demo.ph");
    await openBooking(shipper, "Highland vegetables");
    await shipper.click('button:has-text("Submit rating")');
    await expect(shipper.getByText("Shipper rating:")).toBeVisible();
  });

  test("trucker offers on a load along a return trip; shipper accepts", async ({ browser }) => {
    const trucker = await loginAs(browser, "trucker@demo.ph");
    await trucker.goto("/trips");
    await trucker.getByRole("link", { name: /Batangas City/ }).first().click();
    await expect(trucker.getByText(/Loads along your way/)).toBeVisible();
    await trucker.locator('button:has-text("Offer to carry")').first().click();
    await trucker.waitForURL("**/bookings/*");

    const shipper = await loginAs(browser, "shipper@demo.ph");
    await openBooking(shipper, "320 cartons");
    await expect(shipper.getByText(/Phone numbers are revealed once/)).toBeVisible();
    await shipper.click('button:has-text("Accept booking")');
    await expect(shipper.getByText("09181239876")).toBeVisible(); // trucker's phone now shown
  });

  test("shipper posts a load and sees matching return trucks", async ({ browser }) => {
    const shipper = await loginAs(browser, "shipper@demo.ph");
    await shipper.goto("/loads/new");
    await shipper.fill("input[name=title]", "200 bags of feeds");
    await shipper.selectOption("select[name=cargoType]", "RICE_GRAINS");
    await shipper.fill("input[name=weightTons]", "10");
    await shipper.selectOption("select[name=pickupCity]", "Tarlac City");
    await shipper.selectOption("select[name=dropCity]", "Laoag");
    await shipper.fill("input[name=budget]", "25000");
    await shipper.click('button:has-text("Post and find trucks")');
    await shipper.waitForURL(/\/loads\/c/);
    await expect(shipper.getByRole("heading", { name: /Trucks already heading this way \([1-9]/ })).toBeVisible();
  });

  test("a load with no trucks on the route shows no matches", async ({ browser }) => {
    const shipper = await loginAs(browser, "shipper@demo.ph");
    await shipper.goto("/loads");
    await shipper.getByRole("link", { name: /Office furniture/ }).click();
    await expect(shipper.getByRole("heading", { name: "Trucks already heading this way (0)" })).toBeVisible();
  });

  test("new trucker signs up and adds a truck", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/signup?role=TRUCKER");
    await page.fill("input[name=name]", "New Trucker");
    await page.fill("input[name=phone]", "09170001111");
    await page.selectOption("select[name=city]", "Iloilo City");
    await page.fill("input[name=email]", "new.trucker@example.com");
    await page.fill("input[name=password]", "password123");
    await page.click('button:has-text("Create account")');
    await page.waitForURL("**/trucks");
    await page.fill("input[name=plateNumber]", "xyz 987");
    await page.selectOption("select[name=truckType]", "SIX_WHEELER");
    await page.fill("input[name=capacityTons]", "6");
    await page.click('button:has-text("Add truck")');
    await expect(page.getByText("XYZ 987")).toBeVisible();
  });

  test("landing page fits a phone screen", async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
