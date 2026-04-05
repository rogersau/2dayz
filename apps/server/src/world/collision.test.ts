import { describe, expect, it } from "vitest";

import type { CollisionVolume } from "@2dayz/shared";

import { createCollisionIndex, isCircleMovementBlocked } from "./collision";

const collisionVolumes: CollisionVolume[] = [
  {
    volumeId: "volume_market",
    kind: "box",
    position: { x: 6, y: 6 },
    size: { width: 4, height: 4 },
  },
];

describe("isCircleMovementBlocked", () => {
  it("blocks movement when a circle would overlap a collision volume", () => {
    const collision = createCollisionIndex(collisionVolumes);

    expect(
      isCircleMovementBlocked(collision, {
        from: { x: 2, y: 6 },
        to: { x: 4.5, y: 6 },
        radius: 0.75,
      }),
    ).toBe(true);
  });

  it("allows movement when the circle stays outside collision volumes", () => {
    const collision = createCollisionIndex(collisionVolumes);

    expect(
      isCircleMovementBlocked(collision, {
        from: { x: 2, y: 2 },
        to: { x: 3, y: 2 },
        radius: 0.5,
      }),
    ).toBe(false);
  });
});
