import { expect, test } from "@playwright/test";

test("reports when average frame time misses the 60 fps local target", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("Perf Scout");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue to session" }).click();
  await expect(page.getByRole("heading", { name: "Session HUD" })).toBeVisible();
  await page.waitForTimeout(250);

  const averageFrameTimeMs = await page.evaluate(async () => {
    return await new Promise<number>((resolve) => {
      const samples: number[] = [];
      let previousTimestamp = performance.now();

      const collectSample = (timestamp: number) => {
        samples.push(timestamp - previousTimestamp);
        previousTimestamp = timestamp;

        if (samples.length >= 60) {
          const total = samples.reduce((sum, sample) => sum + sample, 0);
          resolve(total / samples.length);
          return;
        }

        window.requestAnimationFrame(collectSample);
      };

      window.requestAnimationFrame(collectSample);
    });
  });

  expect(
    averageFrameTimeMs,
    `Average frame time ${averageFrameTimeMs.toFixed(2)}ms exceeded 16.67ms (60 fps target).`,
  ).toBeLessThanOrEqual(16.67);
});
