import { expect, test } from "@playwright/test";

const TARGET_FRAME_TIME_MS = 1000 / 60;
const FRAME_TIME_JITTER_TOLERANCE_MS = 0.05;

test("reports when average frame time misses the 60 fps local target", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Display name").fill("Perf Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(page.getByLabel("game shell")).toBeVisible();
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
    `Average frame time ${averageFrameTimeMs.toFixed(2)}ms exceeded ${(TARGET_FRAME_TIME_MS + FRAME_TIME_JITTER_TOLERANCE_MS).toFixed(2)}ms (60 fps target plus browser scheduling tolerance).`,
  ).toBeLessThanOrEqual(TARGET_FRAME_TIME_MS + FRAME_TIME_JITTER_TOLERANCE_MS);
});
