import { describe, expect, it } from "vitest";

import { interpolateTransform, sampleInterpolatedTransform } from "./interpolation";

describe("interpolation", () => {
  it("smooths a remote entity transform between snapshots", () => {
    expect(
      interpolateTransform(
        {
          tick: 10,
          transform: { rotation: 0, x: 0, y: 0 },
        },
        {
          tick: 14,
          transform: { rotation: 0.8, x: 8, y: 4 },
        },
        12,
      ),
    ).toEqual({
      rotation: 0.4,
      x: 4,
      y: 2,
    });
  });

  it("advances interpolation based on frame time between server updates", () => {
    const previous = {
      receivedAtMs: 1_000,
      tick: 10,
      transform: { rotation: 0, x: 0, y: 0 },
    };
    const current = {
      receivedAtMs: 1_200,
      tick: 14,
      transform: { rotation: 0.8, x: 8, y: 4 },
    };

    expect(sampleInterpolatedTransform(previous, current, 1_050)).toEqual({
      rotation: 0.2,
      x: 2,
      y: 1,
    });
    const laterSample = sampleInterpolatedTransform(previous, current, 1_150);

    expect(laterSample.x).toBe(6);
    expect(laterSample.y).toBe(3);
    expect(laterSample.rotation).toBeCloseTo(0.6);
  });
});
