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

type FrameStats = {
  average: number;
  p90: number;
};

const measureFrameStats = async (page: import("@playwright/test").Page) => {
  return await page.evaluate(async (): Promise<FrameStats> => {
    return await new Promise<FrameStats>((resolve) => {
      const samples: number[] = [];
      let previousTimestamp = performance.now();

      const collectSample = (timestamp: number) => {
        samples.push(timestamp - previousTimestamp);
        previousTimestamp = timestamp;

        if (samples.length >= 120) {
          const sortedSamples = [...samples].sort((left, right) => left - right);
          const total = samples.reduce((sum, sample) => sum + sample, 0);

          resolve({
            average: total / samples.length,
            p90: sortedSamples[Math.floor(sortedSamples.length * 0.9)] ?? Number.POSITIVE_INFINITY,
          });
          return;
        }

        window.requestAnimationFrame(collectSample);
      };

      window.requestAnimationFrame(collectSample);
    });
  });
};

test("reports when average frame time misses the 60 fps local target", async ({ page }) => {
  await page.bringToFront();
  await page.goto("/");
  await page.getByLabel("Display name").fill("Perf Scout");
  await page.getByRole("button", { name: "Review briefing" }).click();
  await page.getByRole("button", { name: "Enter session" }).click();
  await expect(page.getByLabel("survival hud")).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let remainingFrames = 360;

      const warmUp = () => {
        remainingFrames -= 1;

        if (remainingFrames <= 0) {
          resolve();
          return;
        }

        window.requestAnimationFrame(warmUp);
      };

      window.requestAnimationFrame(warmUp);
    });
  });

  const frameStats = await measureFrameStats(page);

  expect(
    frameStats.average,
    `Average frame time ${frameStats.average.toFixed(2)}ms exceeded 16.67ms (60 fps target).`,
  ).toBeLessThanOrEqual(16.67);
  expect(
    frameStats.p90,
    `90th percentile frame time ${frameStats.p90.toFixed(2)}ms exceeded the 20ms steady-state budget. Average was ${frameStats.average.toFixed(2)}ms.`,
  ).toBeLessThanOrEqual(20);
});
