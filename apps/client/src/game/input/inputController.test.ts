import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInputController } from "./inputController";

const setPointerLockElement = (next: Element | null) => {
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    value: next,
  });
  document.dispatchEvent(new Event("pointerlockchange"));
};

const installPointerLockMocks = (element: HTMLElement) => {
  const requestPointerLock = vi.fn(() => {
    setPointerLockElement(element);
  });
  const exitPointerLock = vi.fn(() => {
    setPointerLockElement(null);
  });

  Object.defineProperty(element, "requestPointerLock", {
    configurable: true,
    value: requestPointerLock,
  });
  Object.defineProperty(document, "exitPointerLock", {
    configurable: true,
    value: exitPointerLock,
  });

  return { exitPointerLock, requestPointerLock };
};

const createPointerLockMouseMoveEvent = ({ movementX, movementY }: { movementX: number; movementY: number }) => {
  const event = new MouseEvent("mousemove", { bubbles: true });
  Object.defineProperty(event, "movementX", { configurable: true, value: movementX });
  Object.defineProperty(event, "movementY", { configurable: true, value: movementY });
  return event;
};

const resolveExpectedMovement = ({ x, y }: { x: number; y: number }, yaw: number) => {
  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  const normalized = { x: x / magnitude, y: y / magnitude };
  const forwardAmount = -normalized.y;
  const rightAmount = normalized.x;

  return {
    x: forwardAmount * Math.cos(yaw) + rightAmount * Math.sin(yaw),
    y: forwardAmount * Math.sin(yaw) - rightAmount * Math.cos(yaw),
  };
};

describe("inputController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setPointerLockElement(null);
  });

  it("emits pointer-lock aiming, projected aim, and camera-relative movement", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const { exitPointerLock, requestPointerLock } = installPointerLockMocks(element);

    const controller = createInputController({ element });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    element.dispatchEvent(createPointerLockMouseMoveEvent({ movementX: 40, movementY: 20 }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));

    const viewState = controller.getViewState();
    const expectedMovement = resolveExpectedMovement({ x: 0, y: -1 }, viewState.yaw);

    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    expect(viewState.isAiming).toBe(true);
    expect(viewState.yaw).not.toBe(0);
    expect(viewState.pitch).not.toBe(0);

    expect(controller.pollInput(4)).toEqual({
      actions: {
        aiming: true,
        fire: true,
        interact: true,
        reload: true,
        sprint: true,
      },
      aim: {
        x: Math.cos(viewState.yaw),
        y: Math.sin(viewState.yaw),
      },
      movement: expectedMovement,
      sequence: 4,
      type: "input",
    });

    expect(controller.pollInput(5)).toEqual({
      actions: {
        aiming: true,
        fire: true,
        sprint: true,
      },
      aim: {
        x: Math.cos(viewState.yaw),
        y: Math.sin(viewState.yaw),
      },
      movement: expectedMovement,
      sequence: 5,
      type: "input",
    });

    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 2 }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "w" }));

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(controller.getViewState()).toEqual({
      isAiming: false,
      pitch: viewState.pitch,
      yaw: viewState.yaw,
    });
    expect(controller.pollInput(6)).toEqual({
      actions: {},
      aim: {
        x: Math.cos(viewState.yaw),
        y: Math.sin(viewState.yaw),
      },
      movement: {
        x: 0,
        y: 0,
      },
      sequence: 6,
      type: "input",
    });

    controller.destroy();
  });

  it("prevents the browser context menu when right-click aiming starts", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const { requestPointerLock } = installPointerLockMocks(element);

    const controller = createInputController({ element });
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      button: 2,
      cancelable: true,
    });
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    element.dispatchEvent(mouseDownEvent);
    element.dispatchEvent(contextMenuEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    expect(controller.getViewState().isAiming).toBe(true);

    controller.destroy();
  });

  it("clears aiming when pointer lock is lost outside mouse-up handling", () => {
    const element = document.createElement("div");
    document.body.append(element);
    installPointerLockMocks(element);

    const controller = createInputController({ element });

    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    expect(controller.getViewState().isAiming).toBe(true);

    setPointerLockElement(null);

    expect(controller.getViewState().isAiming).toBe(false);
    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    controller.destroy();
  });

  it("emits sprint while shift is held and clears it on release", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const controller = createInputController({ element });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));

    expect(controller.pollInput(1)).toEqual(
      expect.objectContaining({
        actions: { sprint: true },
        movement: { x: 0, y: 0 },
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));

    expect(controller.pollInput(2)).toEqual(
      expect.objectContaining({
        actions: {},
      }),
    );

    controller.destroy();
  });

  it("toggles inventory when tab is pressed without emitting a gameplay input action", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const onToggleInventory = vi.fn();
    const controller = createInputController({ element, onToggleInventory });

    const keydownEvent = new KeyboardEvent("keydown", { cancelable: true, key: "Tab" });
    window.dispatchEvent(keydownEvent);

    expect(onToggleInventory).toHaveBeenCalledTimes(1);
    expect(keydownEvent.defaultPrevented).toBe(true);
    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    controller.destroy();
  });

  it("does not toggle inventory or prevent Tab when a focusable control is targeted", () => {
    const element = document.createElement("div");
    const button = document.createElement("button");
    document.body.append(element, button);
    const onToggleInventory = vi.fn();
    const controller = createInputController({ element, onToggleInventory });

    const keydownEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    button.dispatchEvent(keydownEvent);

    expect(onToggleInventory).not.toHaveBeenCalled();
    expect(keydownEvent.defaultPrevented).toBe(false);

    controller.destroy();
  });

  it("ignores movement and gameplay keys when a focusable control is targeted", () => {
    const element = document.createElement("div");
    const input = document.createElement("input");
    document.body.append(element, input);
    const controller = createInputController({ element });

    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "w" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Shift" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "r" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "e" }));

    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    controller.destroy();
  });

  it("does not capture keyboard input while disabled", () => {
    const element = document.createElement("div");
    document.body.append(element);
    element.getBoundingClientRect = () => ({
      bottom: 220,
      height: 120,
      left: 10,
      right: 210,
      top: 100,
      width: 200,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });
    const onToggleInventory = vi.fn();
    const controller = createInputController({
      element,
      isEnabled: () => false,
      onToggleInventory,
    });

    const keydownEvent = new KeyboardEvent("keydown", { cancelable: true, key: "Tab" });
    window.dispatchEvent(keydownEvent);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 170, clientY: 160 }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 170, clientY: 160 }));

    expect(onToggleInventory).not.toHaveBeenCalled();
    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    controller.destroy();
  });

  it("clears held and queued input state on blur and visibility changes", () => {
    const element = document.createElement("div");
    document.body.append(element);

    const controller = createInputController({ element });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));

    window.dispatchEvent(new Event("blur"));

    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(controller.pollInput(2)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    });

    controller.destroy();
  });

  it("clears aiming on blur and hidden visibility", () => {
    const element = document.createElement("div");
    document.body.append(element);
    installPointerLockMocks(element);

    const controller = createInputController({ element });

    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    expect(controller.pollInput(1)).toEqual({
      actions: { aiming: true },
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    window.dispatchEvent(new Event("blur"));

    expect(controller.getViewState().isAiming).toBe(false);
    expect(controller.pollInput(2)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    });

    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(controller.getViewState().isAiming).toBe(false);
    expect(controller.pollInput(3)).toEqual({
      actions: {},
      aim: { x: 1, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 3,
      type: "input",
    });

    controller.destroy();
  });
});
