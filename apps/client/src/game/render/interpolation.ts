import type { Transform } from "@2dayz/shared";

type TimedTransform = {
  tick: number;
  transform: Transform;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const interpolateTransform = (
  from: TimedTransform,
  to: TimedTransform,
  renderTick: number,
): Transform => {
  if (from.tick === to.tick) {
    return to.transform;
  }

  const alpha = clamp((renderTick - from.tick) / (to.tick - from.tick), 0, 1);

  return {
    rotation: from.transform.rotation + (to.transform.rotation - from.transform.rotation) * alpha,
    x: from.transform.x + (to.transform.x - from.transform.x) * alpha,
    y: from.transform.y + (to.transform.y - from.transform.y) * alpha,
  };
};

export type { TimedTransform };
