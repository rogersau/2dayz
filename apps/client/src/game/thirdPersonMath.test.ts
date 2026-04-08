import { describe, expect, it } from "vitest";

import {
  resolveCameraPose,
  resolveCameraRelativeMovement,
  resolveProjectedAim,
} from "./thirdPersonMath";

describe("thirdPersonMath", () => {
  it("resolves camera-relative movement on the gameplay plane", () => {
    expect(resolveCameraRelativeMovement({ x: 0, y: -1 }, Math.PI / 2)).toEqual({ x: 0, y: 1 });
    expect(resolveCameraRelativeMovement({ x: 1, y: 0 }, 0)).toEqual({ x: 0, y: 1 });
  });

  it("projects view yaw into the 2D aim contract", () => {
    expect(resolveProjectedAim({ pitch: -0.4, yaw: 0 })).toEqual({ x: 1, y: 0 });
    expect(resolveProjectedAim({ pitch: 0.2, yaw: Math.PI / 2 })).toEqual({ x: 0, y: 1 });
  });

  it("tightens the chase camera while aiming without changing the look-at point", () => {
    const traversalPose = resolveCameraPose({
      isAiming: false,
      pitch: -0.3,
      target: { x: 12, y: 0, z: -6 },
      yaw: Math.PI / 4,
    });
    const aimingPose = resolveCameraPose({
      isAiming: true,
      pitch: -0.3,
      target: { x: 12, y: 0, z: -6 },
      yaw: Math.PI / 4,
    });

    const traversalDistance = Math.hypot(
      traversalPose.position.x - traversalPose.lookAt.x,
      traversalPose.position.y - traversalPose.lookAt.y,
      traversalPose.position.z - traversalPose.lookAt.z,
    );
    const aimingDistance = Math.hypot(
      aimingPose.position.x - aimingPose.lookAt.x,
      aimingPose.position.y - aimingPose.lookAt.y,
      aimingPose.position.z - aimingPose.lookAt.z,
    );

    expect(aimingPose.lookAt).toEqual(traversalPose.lookAt);
    expect(aimingDistance).toBeLessThan(traversalDistance);
  });
});
