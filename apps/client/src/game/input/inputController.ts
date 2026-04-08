import { inputMessageSchema } from "@2dayz/shared";

import { ACTION_KEYS, MOVEMENT_KEYS } from "./keymap";
import { resolveCameraRelativeMovement, resolveProjectedAim } from "../thirdPersonMath";

const LOOK_SENSITIVITY = 0.01;
const MAX_PITCH = Math.PI / 3;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const isMatchingKey = (eventKey: string, keys: readonly string[]) => {
  return keys.includes(eventKey.toLowerCase());
};

const isFocusableControl = (eventTarget: EventTarget | null) => {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  return eventTarget.matches("button, input, select, textarea, [contenteditable='true'], [tabindex]");
};

const isTextEntryControl = (eventTarget: EventTarget | null) => {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  return eventTarget.matches("input, select, textarea, [contenteditable='true']");
};

export const createInputController = ({
  element,
  isEnabled,
  onToggleInventory,
}: {
  element: HTMLElement;
  isEnabled?: () => boolean;
  onToggleInventory?: () => void;
}) => {
  const pressedKeys = new Set<string>();
  const queuedActions = {
    interact: false,
    reload: false,
  };
  let isFiring = false;
  let isAiming = false;
  let yaw = 0;
  let pitch = 0;

  const clearLatchedState = () => {
    pressedKeys.clear();
    queuedActions.interact = false;
    queuedActions.reload = false;
  };

  const clearPointerCaptureState = () => {
    isAiming = false;
    isFiring = false;
  };

  const clearDisabledState = () => {
    clearLatchedState();
    if (document.pointerLockElement === element) {
      document.exitPointerLock?.();
      return;
    }

    clearPointerCaptureState();
  };

  const canCaptureInput = () => {
    if (isEnabled?.() === false) {
      clearDisabledState();
      return false;
    }

    return true;
  };

  const requestPointerCapture = () => {
    if (document.pointerLockElement !== element) {
      element.requestPointerLock?.();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    const key = event.key.toLowerCase();
    const isFocusableTarget = isFocusableControl(event.target);

    if (isMatchingKey(key, ACTION_KEYS.inventory)) {
      if (isFocusableTarget) {
        return;
      }

      event.preventDefault();
      if (!event.repeat) {
        onToggleInventory?.();
      }
      return;
    }

    if (isTextEntryControl(event.target)) {
      return;
    }

    pressedKeys.add(key);

    if (isMatchingKey(key, ACTION_KEYS.reload)) {
      queuedActions.reload = true;
    }

    if (isMatchingKey(key, ACTION_KEYS.interact)) {
      queuedActions.interact = true;
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    pressedKeys.delete(event.key.toLowerCase());
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    if (event.button === 0) {
      isFiring = true;
      requestPointerCapture();
    }

    if (event.button === 2) {
      event.preventDefault();
      isAiming = true;
      requestPointerCapture();
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    if (event.button === 0) {
      isFiring = false;
    }

    if (event.button === 2) {
      isAiming = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      clearDisabledState();
    }
  };

  const handleBlur = () => {
    clearDisabledState();
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    if (document.pointerLockElement !== element) {
      return;
    }

    yaw += (event.movementX ?? 0) * LOOK_SENSITIVITY;
    pitch = clamp(pitch - (event.movementY ?? 0) * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
  };

  const handlePointerLockChange = () => {
    if (document.pointerLockElement !== element) {
      clearPointerCaptureState();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleBlur);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("mousemove", handleMouseMove);
  element.addEventListener("mousedown", handleMouseDown);
  element.addEventListener("contextmenu", handleContextMenu);
  window.addEventListener("mouseup", handleMouseUp);

  return {
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mousedown", handleMouseDown);
      element.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("mouseup", handleMouseUp);
    },
    getViewState() {
      return { isAiming, pitch, yaw };
    },
    reset() {
      clearDisabledState();
    },
    pollInput(sequence: number) {
      const aim = resolveProjectedAim({ pitch, yaw });

      if (!canCaptureInput()) {
        return inputMessageSchema.parse({
          actions: {},
          aim,
          movement: { x: 0, y: 0 },
          sequence,
          type: "input",
        });
      }

      const movement = {
        x: (MOVEMENT_KEYS.right.some((key) => pressedKeys.has(key)) ? 1 : 0)
          - (MOVEMENT_KEYS.left.some((key) => pressedKeys.has(key)) ? 1 : 0),
        y: (MOVEMENT_KEYS.down.some((key) => pressedKeys.has(key)) ? 1 : 0)
          - (MOVEMENT_KEYS.up.some((key) => pressedKeys.has(key)) ? 1 : 0),
      };
      const isSprinting = ACTION_KEYS.sprint.some((key) => pressedKeys.has(key));
      const resolvedMovement = resolveCameraRelativeMovement(movement, yaw);

      const nextInput = inputMessageSchema.parse({
        actions: {
          ...(isAiming ? { aiming: true } : {}),
          ...(isFiring ? { fire: true } : {}),
          ...(isSprinting ? { sprint: true } : {}),
          ...(queuedActions.interact ? { interact: true } : {}),
          ...(queuedActions.reload ? { reload: true } : {}),
        },
        aim,
        movement: resolvedMovement,
        sequence,
        type: "input",
      });

      queuedActions.interact = false;
      queuedActions.reload = false;

      return nextInput;
    },
  };
};

export type InputController = ReturnType<typeof createInputController>;
