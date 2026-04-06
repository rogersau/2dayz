import { describe, expect, it } from "vitest";

import type { CollisionVolume } from "@2dayz/shared";

import { createCollisionIndex } from "./collision";
import { hasLineOfSight } from "./lineOfSight";

const collisionVolumes: CollisionVolume[] = [
  {
    volumeId: "volume_wall",
    kind: "box",
    position: { x: 5, y: 5 },
    size: { width: 2, height: 6 },
  },
];

describe("hasLineOfSight", () => {
  it("returns false when a blocking volume intersects the segment", () => {
    const collision = createCollisionIndex(collisionVolumes);

    expect(hasLineOfSight(collision, { x: 2, y: 5 }, { x: 8, y: 5 })).toBe(false);
  });

  it("returns true when the segment stays clear of blocking volumes", () => {
    const collision = createCollisionIndex(collisionVolumes);

    expect(hasLineOfSight(collision, { x: 2, y: 1 }, { x: 8, y: 1 })).toBe(true);
  });

  it("keeps sight lines clear when they pass outside a blocker corner", () => {
    const collision = createCollisionIndex(collisionVolumes);

    expect(hasLineOfSight(collision, { x: 1.9, y: -0.1 }, { x: 3.1, y: 1.1 }, 1)).toBe(true);
  });
});
