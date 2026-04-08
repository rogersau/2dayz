const DEFAULT_TRAVERSAL_DISTANCE = 18;
const DEFAULT_AIMING_DISTANCE = 12;
const CAMERA_HEIGHT = 10;
const AIMING_CAMERA_HEIGHT = 8;
const LOOK_AT_HEIGHT = 4;
const ZERO_EPSILON = 1e-9;

type Vector2 = { x: number; y: number };
type Vector3 = { x: number; y: number; z: number };

const normalizeZero = (value: number) => {
  return Math.abs(value) <= ZERO_EPSILON ? 0 : value;
};

export const resolveCameraRelativeMovement = (input: Vector2, yaw: number): Vector2 => {
  const magnitude = Math.hypot(input.x, input.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  const normalized = { x: input.x / magnitude, y: input.y / magnitude };
  const forwardAmount = -normalized.y;
  const rightAmount = normalized.x;

  return {
    x: normalizeZero(forwardAmount * Math.cos(yaw) - rightAmount * Math.sin(yaw)),
    y: normalizeZero(forwardAmount * Math.sin(yaw) + rightAmount * Math.cos(yaw)),
  };
};

export const resolveProjectedAim = ({ yaw }: { pitch: number; yaw: number }): Vector2 => {
  return {
    x: normalizeZero(Math.cos(yaw)),
    y: normalizeZero(Math.sin(yaw)),
  };
};

export const resolveCameraPose = ({
  isAiming,
  pitch,
  target,
  yaw,
}: {
  isAiming: boolean;
  pitch: number;
  target: Vector3;
  yaw: number;
}) => {
  const distance = isAiming ? DEFAULT_AIMING_DISTANCE : DEFAULT_TRAVERSAL_DISTANCE;
  const verticalOffset = isAiming ? AIMING_CAMERA_HEIGHT : CAMERA_HEIGHT;
  const planarDistance = Math.cos(pitch) * distance;
  const lookAt = {
    x: target.x,
    y: target.y + LOOK_AT_HEIGHT,
    z: target.z,
  };

  return {
    lookAt,
    position: {
      x: lookAt.x - Math.cos(yaw) * planarDistance,
      y: lookAt.y + Math.sin(-pitch) * distance + verticalOffset,
      z: lookAt.z - Math.sin(yaw) * planarDistance,
    },
  };
};
