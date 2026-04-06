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
