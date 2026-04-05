import type { Vector2 } from "@2dayz/shared";

import { isCircleMovementBlocked, type CollisionIndex } from "./collision";

export const hasLineOfSight = (
  collision: CollisionIndex,
  from: Vector2,
  to: Vector2,
  padding = 0.1,
): boolean => {
  return !isCircleMovementBlocked(collision, {
    from,
    to,
    radius: padding,
  });
};
