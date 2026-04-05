import type { Transform } from "@2dayz/shared";

type TimedTransform = {
  receivedAtMs?: number;
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

export const sampleInterpolatedTransform = (
  from: TimedTransform,
  to: TimedTransform,
  renderTimeMs: number,
): Transform => {
  if (from.receivedAtMs === undefined || to.receivedAtMs === undefined || from.receivedAtMs === to.receivedAtMs) {
    return interpolateTransform(from, to, to.tick);
  }

  const alpha = clamp(
    (renderTimeMs - from.receivedAtMs) / (to.receivedAtMs - from.receivedAtMs),
    0,
    1,
  );

  return {
    rotation: from.transform.rotation + (to.transform.rotation - from.transform.rotation) * alpha,
    x: from.transform.x + (to.transform.x - from.transform.x) * alpha,
    y: from.transform.y + (to.transform.y - from.transform.y) * alpha,
  };
};

export type { TimedTransform };
