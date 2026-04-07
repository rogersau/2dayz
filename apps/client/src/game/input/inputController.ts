import { inputMessageSchema } from "@2dayz/shared";

import { ACTION_KEYS, MOVEMENT_KEYS } from "./keymap";

const isMatchingKey = (eventKey: string, keys: readonly string[]) => {
  return keys.includes(eventKey.toLowerCase());
};

const isFocusableControl = (eventTarget: EventTarget | null) => {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  return eventTarget.matches("button, input, select, textarea, [contenteditable='true'], [tabindex]");
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
  const aim = { x: 0, y: 0 };
  let isFiring = false;

  const clearLatchedState = () => {
    pressedKeys.clear();
    isFiring = false;
    queuedActions.interact = false;
    queuedActions.reload = false;
  };

  const clearDisabledState = () => {
    clearLatchedState();
    aim.x = 0;
    aim.y = 0;
  };

  const updateAim = (event: MouseEvent) => {
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    aim.x = event.clientX - centerX;
    aim.y = centerY - event.clientY;
  };

  const canCaptureInput = () => {
    if (isEnabled?.() === false) {
      clearDisabledState();
      return false;
    }

    return true;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    const key = event.key.toLowerCase();

    if (isMatchingKey(key, ACTION_KEYS.inventory)) {
      if (isFocusableControl(event.target)) {
        return;
      }

      event.preventDefault();
      if (!event.repeat) {
        onToggleInventory?.();
      }
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

    updateAim(event);
    if (event.button === 0) {
      isFiring = true;
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    updateAim(event);
    if (event.button === 0) {
      isFiring = false;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      clearLatchedState();
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!canCaptureInput()) {
      return;
    }

    updateAim(event);
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearLatchedState);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  element.addEventListener("mousemove", handleMouseMove);
  element.addEventListener("mousedown", handleMouseDown);
  element.addEventListener("mouseup", handleMouseUp);
  element.addEventListener("mouseleave", handleMouseUp);

  return {
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearLatchedState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mousedown", handleMouseDown);
      element.removeEventListener("mouseup", handleMouseUp);
      element.removeEventListener("mouseleave", handleMouseUp);
    },
    reset() {
      clearDisabledState();
    },
    pollInput(sequence: number) {
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

      const nextInput = inputMessageSchema.parse({
        actions: {
          ...(isFiring ? { fire: true } : {}),
          ...(queuedActions.interact ? { interact: true } : {}),
          ...(queuedActions.reload ? { reload: true } : {}),
        },
        aim,
        movement,
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
