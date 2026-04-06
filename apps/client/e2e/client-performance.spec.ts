import { expect, test } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  },
});

test("reports when average frame time misses the 60 fps local target", async ({ page }) => {
  await page.bringToFront();
  await page.goto("/");
  await page.getByLabel("Display name").fill("Perf Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(page.getByLabel("survival hud")).toBeVisible();
  let averageFrameTimeMs = Number.POSITIVE_INFINITY;

  await expect.poll(async () => {
    averageFrameTimeMs = await page.evaluate(async () => {
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

    return averageFrameTimeMs;
  }, {
    message: "Average frame time never settled under the 60 fps local target.",
    timeout: 20_000,
  }).toBeLessThanOrEqual(16.67);

  expect(
    averageFrameTimeMs,
    `Average frame time ${averageFrameTimeMs.toFixed(2)}ms exceeded 16.67ms (60 fps target).`,
  ).toBeLessThanOrEqual(16.67);
});
