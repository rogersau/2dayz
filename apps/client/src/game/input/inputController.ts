import { inputMessageSchema } from "@2dayz/shared";

import { ACTION_KEYS, MOVEMENT_KEYS } from "./keymap";

const isMatchingKey = (eventKey: string, keys: readonly string[]) => {
  return keys.includes(eventKey.toLowerCase());
};

export const createInputController = ({
  element,
  onToggleInventory,
}: {
  element: HTMLElement;
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

  const updateAim = (event: MouseEvent) => {
    const bounds = element.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    aim.x = event.clientX - centerX;
    aim.y = centerY - event.clientY;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (isMatchingKey(key, ACTION_KEYS.inventory)) {
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
    pressedKeys.delete(event.key.toLowerCase());
  };

  const handleMouseDown = (event: MouseEvent) => {
    updateAim(event);
    if (event.button === 0) {
      isFiring = true;
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
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

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", clearLatchedState);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  element.addEventListener("mousemove", updateAim);
  element.addEventListener("mousedown", handleMouseDown);
  element.addEventListener("mouseup", handleMouseUp);
  element.addEventListener("mouseleave", handleMouseUp);

  return {
    destroy() {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearLatchedState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      element.removeEventListener("mousemove", updateAim);
      element.removeEventListener("mousedown", handleMouseDown);
      element.removeEventListener("mouseup", handleMouseUp);
      element.removeEventListener("mouseleave", handleMouseUp);
    },
    pollInput(sequence: number) {
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
