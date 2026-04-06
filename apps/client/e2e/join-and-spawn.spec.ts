import { expect, test } from "@playwright/test";

test("joins from landing page and reaches the in-game HUD", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "2D DayZ" })).toBeVisible();
  await page.getByLabel("Display name").fill("Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();

  await expect(page.getByRole("heading", { name: "Field briefing" })).toBeVisible();
  await page.getByRole("button", { name: "Enter session" }).click();

  await expect(page.getByLabel("survival hud")).toBeVisible();
  await expect(page.getByText("Health")).toBeVisible();
  await expect(page.getByText("Ammo")).toBeVisible();
  await expect(page.getByText(/\d\/\d slots filled/i)).toBeVisible();
  await expect(page.getByLabel("game shell")).toBeVisible();
});

test("keeps the title menu usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("title menu")).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review briefing" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Display name").fill("Phone Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();

  await expect(page.getByRole("heading", { name: "Field briefing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter session" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(page.getByLabel("survival hud")).toBeVisible();
  await page.getByRole("button", { name: "Open inventory" }).click();
  await expect(page.getByRole("button", { name: "Collapse inventory" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(
    await page.evaluate(() => {
      const inventoryPanel = document.querySelector(".inventory-card");
      if (!(inventoryPanel instanceof HTMLElement)) {
        return false;
      }

      return inventoryPanel.getBoundingClientRect().bottom <= window.innerHeight;
    }),
  ).toBe(true);
});

test("keeps the joined hud reachable on a shorter phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto("/");

  await page.getByLabel("Display name").fill("Short Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();

  await expect(page.getByLabel("survival hud")).toBeVisible();
  await page.getByRole("button", { name: "Open inventory" }).click();

  const collapseInventoryButton = page.getByRole("button", { name: "Collapse inventory" });
  const lastInventorySlot = page.getByText("Slot 6");
  await expect(collapseInventoryButton).toBeVisible();
  await expect(collapseInventoryButton).toBeInViewport();
  await expect(lastInventorySlot).not.toBeInViewport();

  await page.getByLabel("survival hud").hover();
  await page.mouse.wheel(0, 600);
  await page.locator(".inventory-card").hover();
  await page.mouse.wheel(0, 1200);

  await expect(lastInventorySlot).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("landing-to-spawn stays under 10 seconds in healthy local conditions", async ({ page }) => {
  const startedAt = Date.now();

  await page.goto("/");
  await page.getByLabel("Display name").fill("Speed Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(page.getByLabel("survival hud")).toBeVisible();

  const joinDurationMs = Date.now() - startedAt;
  expect(
    joinDurationMs,
    `Landing-to-spawn took ${joinDurationMs}ms, exceeding the 10000ms local target.`,
  ).toBeLessThanOrEqual(10_000);
});

test("health endpoint returns 200 for local verification", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  await expect(response).toBeOK();
});

test("reported tick rate stays within the 20-30 Hz target range", async ({ request }) => {
  const response = await request.get("/health");
  const payload = (await response.json()) as { tickRateHz: number };

  expect(payload.tickRateHz).toBeGreaterThanOrEqual(20);
  expect(payload.tickRateHz).toBeLessThanOrEqual(30);
});
