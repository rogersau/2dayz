export const MOVEMENT_KEYS = {
  down: ["s", "arrowdown"],
  left: ["a", "arrowleft"],
  right: ["d", "arrowright"],
  up: ["w", "arrowup"],
} as const;

export const ACTION_KEYS = {
  interact: ["e"],
  inventory: ["tab"],
  reload: ["r"],
  sprint: ["shift"],
} as const;
