import { describe, expect, it } from "vitest";

import { interpolateTransform } from "./interpolation";

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
});
