import type { CollisionVolume, Vector2 } from "@2dayz/shared";

type IndexedCollisionVolume = CollisionVolume & {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type CollisionIndex = {
  volumes: IndexedCollisionVolume[];
};

export type CircleMovementCheck = {
  from: Vector2;
  to: Vector2;
  radius: number;
};

const toIndexedVolume = (volume: CollisionVolume): IndexedCollisionVolume => {
  const halfWidth = volume.size.width / 2;
  const halfHeight = volume.size.height / 2;

  return {
    ...volume,
    minX: volume.position.x - halfWidth,
    maxX: volume.position.x + halfWidth,
    minY: volume.position.y - halfHeight,
    maxY: volume.position.y + halfHeight,
  };
};

export const createCollisionIndex = (volumes: CollisionVolume[]): CollisionIndex => {
  return {
    volumes: volumes.map(toIndexedVolume),
  };
};

export const isCirclePositionBlocked = (collision: CollisionIndex, position: Vector2, radius: number): boolean => {
  return collision.volumes.some((volume) => {
    return (
      position.x + radius > volume.minX &&
      position.x - radius < volume.maxX &&
      position.y + radius > volume.minY &&
      position.y - radius < volume.maxY
    );
  });
};

export const isCircleMovementBlocked = (collision: CollisionIndex, movement: CircleMovementCheck): boolean => {
  const deltaX = movement.to.x - movement.from.x;
  const deltaY = movement.to.y - movement.from.y;
  const distance = Math.hypot(deltaX, deltaY);
  const steps = Math.max(1, Math.ceil(distance / Math.max(movement.radius * 0.5, 0.25)));

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const sample = {
      x: movement.from.x + deltaX * progress,
      y: movement.from.y + deltaY * progress,
    };

    if (isCirclePositionBlocked(collision, sample, movement.radius)) {
      return true;
    }
  }

  return false;
};
